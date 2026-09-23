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
 *
 * 남는 것 — 접속기록 표는 추가만 되므로 이 검사가 적은 줄(무작위 actor, 1 · 3)은 로컬 DB 에 남는다. 주문을 연
 * 계정은 끝에 지운다. 판매 스위치는 2 동안만 켜고 `finally` 에서 끈다.
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

finish();
