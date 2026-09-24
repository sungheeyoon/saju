/**
 * **두 세션이 한 자리를 다투는 경우**를 로컬 스택에 대고 실제로 일으킨다 (`20261013090000`).
 *
 * pgTAP 은 한 세션이라 이것을 못 만든다 — 커밋 안 된 줄은 제 트랜잭션에서는 보이고 남에게는 안 보이는데,
 * 한 세션 안에서는 「남」이 없다. 그래서 여기서 psql 을 둘 · 셋 띄우고 `pg_sleep` 으로 차례를 세운다. 앞 세션이
 * 쓰고 커밋하기 전에 뒤 세션이 같은 자리를 읽거나 쓰게 한다. 앱 서버는 안 띄운다 — 다투는 것은 DB 의 문이다.
 *
 *   1. **반출이 늦게 커밋된 줄을 건너뛰지 않는다** — 낮은 번호를 받고 커밋이 늦은 줄이 있는 동안 반출은 그
 *      커밋을 기다리고, 기다린 뒤 두 줄을 함께 가져간다. 번호는 문장 트리거가 자물쇠를 쥔 **뒤에** 받는다
 *   2. **같은 열쇠로 동시에 연 주문은 하나다** — 뒤 세션이 `unique_violation` 대신 같은 주문을 받는다
 *   3. **거절 기록 한 시간 서른 줄은 동시에 불러도 서른이다**
 *   4. **두 반출 실행이 나란히 시작하면 하나만 돈다** — 뒤는 「도는 중」(`20261014090000`)
 *   5. **CLI 질의 하나의 결과는 두 세션이 나란히 적어도 한 줄이다** — 같은 결과면 뒤는 앞 줄의 번호를, 다른 결과면
 *      거절을 받는다(`20261015090000`)
 *   6. **두 표에 나란히 적는 경고는 같은 안내번호를 못 받는다** — 지금 계정의 신고(`public.report`)와 떠난 사람의
 *      신고(`retention.report`)에 같은 씨앗으로 경고를 적으면 둘 다 같은 번호를 뽑는다. 뒤 세션은 앞 세션의 커밋을
 *      기다렸다가 다른 번호를 받는다(`20261020090000`, ADR 0108 추기)
 *
 * 남는 것 — 접속기록 표는 추가만 되므로 이 검사가 적은 줄(무작위 actor, 1 · 3 · CLI 질의와 결과, 5)과 반출 시도
 * 둘(4, 「설정 없음」으로 끝낸다)은 로컬 DB 에 남는다. 주문을 연 계정은 끝에 지운다. 판매 스위치는 2 동안만 켜고 `finally` 에서 끈다.
 * 6 의 계정과 신고는 끝에 지우고, 안내번호 대장의 두 줄은 남는다 — 한 번 쓴 번호는 다시 안 쓰는 것이 그 대장의 뜻이다.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

import { createChecks, sql } from './checks.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const { check, finish } = createChecks('check-db-races');
const container = worktreeStack().dbContainer;

/** psql 한 세션 — `at` 밀리초 뒤에 시작해 SQL 을 끝까지 돌리고, 걸린 시간과 출력을 낸다 */
const session = (at, statements) =>
  new Promise((resolve) => {
    setTimeout(() => {
      const started = Date.now();
      const child = spawn('docker', [
        'exec', '-i', container, 'psql', '-U', 'postgres', '-tAq', '-v', 'ON_ERROR_STOP=1',
      ]);
      let out = '';
      let err = '';
      child.stdout.on('data', (chunk) => { out += chunk; });
      child.stderr.on('data', (chunk) => { err += chunk; });
      child.on('close', (code) => resolve({ code, out, err, ms: Date.now() - started }));
      child.stdin.end(statements);
    }, at);
  });

/** 출력에서 `이름=값` 한 줄을 집는다 — 세션이 찍는 표지 */
const marked = (result, name) => new RegExp(`^${name}=(.*)$`, 'm').exec(result.out)?.[1] ?? null;

const asUser = (uid) => `
  set local role authenticated;
  select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true) is null;`;

const accessRow = (actor, outcome = 'allowed') => `
  insert into audit.operator_access (channel, actor_user_id, action, outcome, at)
  values ('app', '${actor}', 'reports.list', '${outcome}', now() - interval '1 hour')`;

// ── 1. 반출과 늦은 커밋 ─────────────────────────────────────────────────────────

{
  const early = randomUUID();
  const late = randomUUID();

  const [slow, fast, exporter] = await Promise.all([
    // 먼저 번호를 받고 늦게 커밋한다
    session(0, `begin; ${accessRow(early)} returning 'EARLY=' || id; select pg_sleep(2.5); commit;`),
    // 뒤에 번호를 받고 바로 커밋한다
    session(600, `${accessRow(late)} returning 'LATE=' || id;`),
    // 앞 줄이 아직 커밋 전일 때 반출을 부른다 — 적지는 않는다(되감는다)
    session(1200, `begin; set local role service_role;
      select 'SEEN=' || coalesce(string_agg(case b.actor_user_id when '${early}' then 'early' else 'late' end, ','
                                            order by b.id), '')
      from public.audit_export_batch(50000) b where b.actor_user_id in ('${early}', '${late}');
      rollback;`),
  ]);

  const failed = [slow, fast, exporter].find((one) => one.code !== 0);
  check('세 세션이 끝까지 돈다', !failed, failed?.err.trim());
  check('앞 세션이 낮은 번호를 받았다 — 경쟁이 성립한다',
    Number(marked(slow, 'EARLY')) < Number(marked(fast, 'LATE')),
    `${marked(slow, 'EARLY')} < ${marked(fast, 'LATE')}`);
  check('반출은 늦게 커밋된 낮은 번호와 그 뒤 번호를 함께 가져간다 — 뒤 번호만 가져가 커서를 넘기지 않는다',
    marked(exporter, 'SEEN') === 'early,late', `가져간 것: ${marked(exporter, 'SEEN') || '없음'}`);
  check('반출은 앞 세션의 커밋을 기다렸다', exporter.ms >= 800, `${exporter.ms}ms`);
}

// ── 1'. 번호는 자물쇠 뒤에 받는다 ───────────────────────────────────────────────

{
  const seq = `select 'SEQ=' || coalesce(pg_sequence_last_value('audit.operator_access_id_seq'), 0);`;
  const [holder, writer, watcher] = await Promise.all([
    session(0, `begin; set local role service_role; select count(*) from public.audit_export_batch(1);
      reset role; ${seq} select pg_sleep(2); rollback;`),
    session(500, `begin; ${accessRow(randomUUID())}; rollback;`),
    session(1200, seq),
  ]);

  const failed = [holder, writer, watcher].find((one) => one.code !== 0);
  check('반출이 자물쇠를 쥔 동안 쓰는 세션이 끝까지 돈다', !failed, failed?.err.trim());
  check('반출이 자물쇠를 쥔 동안 쓰는 세션은 번호를 받기 전에 기다린다 — 기다린 뒤 받은 번호는 반출이 본 것보다 크다',
    marked(holder, 'SEQ') !== null && marked(holder, 'SEQ') === marked(watcher, 'SEQ'),
    `반출 때 ${marked(holder, 'SEQ')} · 기다리는 동안 ${marked(watcher, 'SEQ')}`);
  check('쓰는 세션은 반출이 끝날 때까지 섰다', writer.ms >= 1000, `${writer.ms}ms`);
}

// ── 2. 같은 열쇠의 주문 둘 ──────────────────────────────────────────────────────

{
  const buyer = sql(`insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'race-${Date.now()}@example.com', now(), now()) returning id`);
  const open = (at, tail = '') =>
    session(at, `begin; ${asUser(buyer)}
      select 'ORDER=' || order_id from public.open_reading_order(3, 'dev', 'race-order-key-0001');
      ${tail} commit;`);

  sql(`create or replace function public.reading_sale_is_open()
       returns boolean language sql immutable set search_path = '' as $$ select true $$`);
  try {
    const [first, second] = await Promise.all([open(0, 'select pg_sleep(2);'), open(600)]);

    check('앞 주문은 열린다', first.code === 0 && marked(first, 'ORDER') !== null, first.err.trim());
    check('같은 열쇠로 동시에 연 뒤 세션도 넘어지지 않는다 — unique_violation 이 아니다',
      second.code === 0, second.err.trim());
    check('둘은 같은 주문을 받는다', marked(first, 'ORDER') === marked(second, 'ORDER'),
      `${marked(first, 'ORDER')} · ${marked(second, 'ORDER')}`);
    check('주문은 하나다',
      sql(`select count(*) from public.reading_order where user_id = '${buyer}'`) === '1');
  } finally {
    sql(`create or replace function public.reading_sale_is_open()
         returns boolean language sql immutable set search_path = '' as $$ select false $$`);
    sql(`delete from auth.users where id = '${buyer}'`);
  }
  check('판매 스위치는 다시 꺼졌다', sql('select public.reading_sale_is_open()') === 'f');
}

// ── 3. 거절 기록의 한도 ─────────────────────────────────────────────────────────

{
  const stranger = randomUUID();
  sql(`insert into audit.operator_access (channel, actor_user_id, action, outcome)
       select 'app', '${stranger}', 'reports.list', 'denied' from generate_series(1, 29)`);

  const deny = (at, tail = '') =>
    session(at, `begin; ${asUser(stranger)} select public.note_operator_denial('reports.list'); ${tail} commit;`);
  const [first, second] = await Promise.all([deny(0, 'select pg_sleep(2);'), deny(600)]);

  check('두 거절 세션이 끝까지 돈다', first.code === 0 && second.code === 0, `${first.err}${second.err}`.trim());
  check('스물아홉에서 두 세션이 함께 불러도 서른에서 멈춘다',
    sql(`select count(*) from audit.operator_access where actor_user_id = '${stranger}'`) === '30',
    `${sql(`select count(*) from audit.operator_access where actor_user_id = '${stranger}'`)}줄`);
}

// ── 4. 두 반출 실행 ─────────────────────────────────────────────────────────────

{
  const begin = `set local role service_role;
    select 'RUN=' || attempt_id || ':' || busy from public.audit_export_begin();`;
  const [first, second] = await Promise.all([
    session(0, `begin; ${begin} select pg_sleep(2); commit;`),
    session(600, `begin; ${begin} commit;`),
  ]);
  const runs = [marked(first, 'RUN'), marked(second, 'RUN')];

  check('두 시작 세션이 끝까지 돈다', first.code === 0 && second.code === 0, `${first.err}${second.err}`.trim());
  check('나란히 시작한 두 반출 중 하나만 돈다 — 뒤는 「도는 중」', runs[0]?.endsWith(':false') && runs[1]?.endsWith(':true'),
    runs.join(' · '));
  check('뒤 시작은 앞 시작의 커밋을 기다렸다', second.ms >= 1000, `${second.ms}ms`);

  // 앞 실행을 끝내 둔다 — 남은 임대가 다음 시험의 시작을 막지 않게
  for (const run of runs) {
    const [attempt, busy] = (run ?? '').split(':');
    if (attempt && busy === 'false') sql(`select public.audit_export_finish(${Number(attempt)}, 'not_configured')`);
  }
}

// ── 5. CLI 결과 한 줄 ───────────────────────────────────────────────────────────

{
  const note = (at, result, tail = '') =>
    (query) => session(at, `begin;
      select 'WROTE=' || audit.note_cli_result(${query}, '${result}'${result === 'failed' ? ", 'sql'" : ''});
      ${tail} commit;`);
  const resultRows = (query) =>
    sql(`select count(*) from audit.operator_access where result_of = ${query}`);

  // 같은 결과를 두 세션이 — 앞이 적고 커밋하기 전에 뒤가 적는다
  const same = sql(`select audit.note_cli_query('race-check', '결과 경합 확인', repeat('a', 64))`);
  const [first, second] = await Promise.all([
    note(0, 'succeeded', 'select pg_sleep(2);')(same),
    note(600, 'succeeded')(same),
  ]);
  check('같은 결과를 적는 두 세션이 끝까지 돈다', first.code === 0 && second.code === 0,
    `${first.err}${second.err}`.trim());
  check('두 세션이 나란히 적어도 결과는 한 줄이다', resultRows(same) === '1', `${resultRows(same)}줄`);
  check('뒤 세션은 앞 세션이 적은 줄의 번호를 받는다', marked(first, 'WROTE') !== null
    && marked(first, 'WROTE') === marked(second, 'WROTE'), `${marked(first, 'WROTE')} · ${marked(second, 'WROTE')}`);
  check('뒤 세션은 앞 세션의 커밋을 기다렸다', second.ms >= 1000, `${second.ms}ms`);

  // 다른 결과를 두 세션이 — 뒤는 거절된다
  const differ = sql(`select audit.note_cli_query('race-check', '결과 경합 확인', repeat('b', 64))`);
  const [kept, refused] = await Promise.all([
    note(0, 'succeeded', 'select pg_sleep(2);')(differ),
    note(600, 'failed')(differ),
  ]);
  check('다른 결과를 적는 앞 세션은 끝까지 돈다', kept.code === 0, kept.err.trim());
  check('다른 결과를 적는 뒤 세션은 거절된다 — 23505', refused.code !== 0 && /already written/.test(refused.err),
    refused.err.trim() || '거절되지 않았다');
  check('다른 결과가 나란히 와도 결과는 한 줄이다', resultRows(differ) === '1', `${resultRows(differ)}줄`);
}

// ── 6. 두 표의 안내번호 ─────────────────────────────────────────────────────────

{
  const stamp = Date.now();
  const person = (label) => sql(`insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'race-${label}-${stamp}@example.com', now(), now()) returning id`);
  const reporter = person('reporter');
  const warned = person('warned');
  const operator = person('operator');
  sql(`insert into public.operator (user_id, note) values ('${operator}', '경합 검사 — 안내번호')`);
  const current = sql(`insert into public.report (reporter_user_id, reported_user_id, reason)
    values ('${reporter}', '${warned}', 'harassment') returning id`);
  // 떠난 사람의 신고 — 옮기는 트리거를 거치지 않고 그 모양 그대로 넣는다
  const retained = sql(`insert into retention.report
      (report_id, reason, reported_at, reporter_user_id, reported_user_id, reporter_left_at)
    values (gen_random_uuid(), 'other', now(), gen_random_uuid(), '${warned}', now()) returning report_id`);

  // 같은 씨앗이면 두 세션의 첫 번호가 같다 — 드문 우연을 매번 일으킨다. 씨앗은 돌 때마다 새로 고른다 — 대장이 쓴 번호를
  // 남기므로 같은 씨앗을 다시 쓰면 두 번째 실행의 첫 번호는 이미 잡혀 있다
  const seed = Math.random().toFixed(6);
  const warn = (at, report, tail = '') => session(at, `begin; select setseed(${seed}) is null;
    select public.review_report('${report}', '${operator}', 'warning', null, '${warned}') is null;
    select 'REF=' || coalesce(
      (select warning_ref from public.report where id = '${report}'),
      (select warning_ref from retention.report where report_id = '${report}'));
    ${tail} commit;`);

  try {
    const [first, second] = await Promise.all([warn(0, current, 'select pg_sleep(2);'), warn(600, retained)]);
    const refs = [marked(first, 'REF'), marked(second, 'REF')];

    check('두 표에 경고를 적는 두 세션이 끝까지 돈다', first.code === 0 && second.code === 0,
      `${first.err}${second.err}`.trim());
    check('앞 세션은 씨앗의 첫 번호를 받았다 — 같은 씨앗의 뒤 세션도 처음엔 그 번호를 뽑는다, 경합이 성립한다',
      sql(`select setseed(${seed}) is null; select 'W-' || string_agg(
             substr('23456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + floor(random() * 30)::integer, 1), '')
           from generate_series(1, 4)`).split('\n').pop() === refs[0],
      refs.join(' · '));
    check('두 표의 경고가 같은 안내번호를 받지 않는다', refs[0] !== null && refs[1] !== null && refs[0] !== refs[1],
      refs.join(' · '));
    check('뒤 세션은 앞 세션의 커밋을 기다렸다 — 번호를 잡는 자리가 두 표에 하나다', second.ms >= 1000, `${second.ms}ms`);
    const doubled = sql(`select count(*) from (
        select w.warning_ref from (select warning_ref from public.report
                                   union all select warning_ref from retention.report) w
        where w.warning_ref in ('${refs[0]}', '${refs[1]}') group by w.warning_ref having count(*) > 1) d`);
    check('두 표를 합쳐 두 번 선 번호가 없다', doubled === '0', `${doubled}개`);
  } finally {
    sql(`delete from retention.report where report_id = '${retained}'`);
    sql(`delete from public.operator where user_id = '${operator}'`);
    sql(`delete from auth.users where id in ('${reporter}', '${warned}', '${operator}')`);
    // 신고한 사람이 떠나며 옮겨진 줄도 걷는다
    sql(`delete from retention.report where report_id = '${current}'`);
  }
}

finish();
