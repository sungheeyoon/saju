/**
 * 웹 푸시의 **「보낸 뒤 60초」가 두 세션이 겹쳐도 서는가**를 로컬 스택에 대고 실제로 일으킨다
 * (`20261121090000`, ADR 0156).
 *
 * pgTAP 은 한 세션이라 이것을 못 만든다 — 커밋 안 된 줄은 남에게 안 보이는데 한 세션에는 「남」이 없다. 그래서
 * `check-db-races.mjs` 처럼 psql 둘을 띄우고 `pg_sleep` 으로 차례를 세운다. 앱 서버 · 푸시 서비스는 안 띄운다 —
 * 다투는 것은 DB 의 문 둘이다.
 *
 *   세션 1 — 배달 문이 보내는 중이던 줄 A 를 `sent` 로 닫는다(`settle_push_delivery`)
 *   세션 2 — 같은 구독 · 방에 메시지가 선다(트리거 `queue_push_for_chat_message` 가 대기 줄 B 를 세운다)
 *
 * 누가 먼저 쓰고 누가 먼저 커밋하든 **B 는 A 의 보낸 시각 + 60초 전에 잡히지 않아야** 한다. A 는 70초 전에 잡혔다고
 * 적어 둔다 — 묶음(50줄 · 동시 6 · 35초 마감)의 뒤쪽에서 늦게 보낸 줄의 모양이다. 그러면 「잡은 시각 + 60초」는 이미 지났고,
 * 닫는 문이 민 것을 놓치면 B 는 바로 잡힌다. 잡기(`claim_push_deliveries`)는 되감는 트랜잭션에서 불러 남의 줄을 건드리지 않는다.
 *
 * 남는 것 — 두 계정 · 매칭 · 구독은 끝에 지운다(방 · 메시지 · 배달 줄이 FK 를 따라간다).
 */
import { spawn } from 'node:child_process';

import { createChecks, sql } from './checks.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const { check, finish } = createChecks('check-push-race');
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

const stamp = Date.now();
const newUser = (who) => sql(`insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          'push-race-${who}-${stamp}@example.com', now(), now()) returning id`);

const sender = newUser('a');
const recipient = newUser('b');
const endpoint = `https://fcm.googleapis.com/fcm/send/race-${stamp}`;

try {
  const matchId = sql(`insert into public.match (user_low, user_high)
    values (least('${sender}'::uuid, '${recipient}'::uuid), greatest('${sender}'::uuid, '${recipient}'::uuid)) returning id`);
  const room = sql(`select id from public.chat_room where match_id = '${matchId}'`);
  const subscription = sql(`insert into public.push_subscription (user_id, endpoint, p256dh, auth)
    values ('${recipient}', '${endpoint}', 'BRaceKey', 'raceAuth') returning id`);

  /** 이 구독의 줄을 걷고, 70초 전에 잡혀 아직 보내는 중인 줄 A 하나를 세운다 */
  const stage = () => {
    sql(`delete from public.push_delivery where subscription_id = '${subscription}'`);
    return sql(`insert into public.push_delivery (subscription_id, room_id, status, due_at, claimed_at)
      values ('${subscription}', '${room}', 'sending', now() - interval '70 seconds', now() - interval '70 seconds')
      returning id`);
  };

  const settle = (at, a, tail = '') => session(at, `begin; set local role service_role;
    select 'SETTLED=' || public.settle_push_delivery('${a}', 'sent'); ${tail} commit;`);
  const message = (at, tail = '') => session(at, `begin;
    insert into public.chat_message (room_id, sender_user_id, body) values ('${room}', '${sender}', '겹침');
    ${tail} commit;`);

  /** 되감는 트랜잭션에서 잡아 본다 — 이 구독의 줄을 잡았나 */
  const claimed = async () => {
    const result = await session(0, `begin; set local role service_role;
      select 'CLAIMED=' || count(*) from public.claim_push_deliveries(500) c where c.endpoint = '${endpoint}';
      rollback;`);
    return /^CLAIMED=(\d+)$/m.exec(result.out)?.[1] ?? `오류 ${result.err.trim()}`;
  };

  const waiting = () => JSON.parse(sql(`select coalesce(json_agg(x), '[]') from (
    select b.status,
           extract(epoch from b.due_at - a.sent_at)::numeric(8, 1) as after_sent
    from public.push_delivery b, public.push_delivery a
    where b.subscription_id = '${subscription}' and b.status = 'pending' and a.status = 'sent'
      and a.subscription_id = '${subscription}') x`));

  /*
    `waits` — 뒤에 온 세션이 앞 세션의 커밋을 기다렸다면 걸렸을 시간의 아래 끝(제 `pg_sleep` 포함). 앞 세션이 2초(넷째는 2.5초)를
    쥐고, 뒤 세션은 0.6초에 온다.
  */
  const cases = [
    { name: '닫기가 먼저 쓰고 먼저 커밋한다', waits: 3500,
      run: (a) => [settle(0, a, 'select pg_sleep(2);'), message(600, 'select pg_sleep(2.5);')] },
    { name: '닫기가 먼저 쓰고, 메시지는 바로 커밋하려 한다', waits: 1000,
      run: (a) => [settle(0, a, 'select pg_sleep(2);'), message(600)] },
    { name: '메시지가 먼저 쓰고 먼저 커밋한다', waits: 1000,
      run: (a) => [message(0, 'select pg_sleep(2);'), settle(600, a)] },
    { name: '메시지가 먼저 쓰고, 닫기가 먼저 커밋하려 한다', waits: 1500,
      run: (a) => [message(0, 'select pg_sleep(2.5);'), settle(600, a, 'select pg_sleep(0.3);')] },
  ];

  for (const [n, one] of cases.entries()) {
    const a = stage();
    const [first, second] = await Promise.all(one.run(a));
    const failed = [first, second].find((x) => x.code !== 0);
    check(`${n + 1}. ${one.name} — 두 세션이 끝까지 돈다`, !failed, failed?.err.trim());
    check(`${n + 1}. ${one.name} — A 는 보냄으로 닫혔다`,
      sql(`select status from public.push_delivery where id = '${a}'`) === 'sent');

    const rows = waiting();
    check(`${n + 1}. ${one.name} — 대기 줄 B 가 하나 섰다`, rows.length === 1, JSON.stringify(rows));
    check(`${n + 1}. ${one.name} — 잡는 문이 B 를 A 의 보낸 시각 + 60초 전에 잡지 않는다`,
      await claimed() === '0', `B 의 기한 − A 의 보낸 시각 = ${rows[0]?.after_sent ?? '?'}초`);
    check(`${n + 1}. ${one.name} — 뒤에 온 세션은 앞 세션의 커밋을 기다렸다(구독 · 방의 자물쇠)`,
      second.ms >= one.waits, `${second.ms}ms`);
  }

  // ── 잡는 문 스스로 막는다 — 기한이 틀려도 ───────────────────────────────────────
  {
    const a = stage();
    sql(`select public.settle_push_delivery('${a}', 'sent')`);
    sql(`insert into public.chat_message (room_id, sender_user_id, body) values ('${room}', '${sender}', '당김')`);
    sql(`update public.push_delivery set due_at = now() where subscription_id = '${subscription}' and status = 'pending'`);
    check('기한을 지금으로 당겨도 마지막 보냄 + 60초 전이면 잡지 않는다', await claimed() === '0');

    sql(`update public.push_delivery set sent_at = now() - interval '61 seconds', settled_at = now() - interval '61 seconds'
         where id = '${a}'`);
    check('마지막 보냄이 60초를 넘겼으면 잡는다 — 막는 것이 그 60초뿐이다', await claimed() === '1');

    sql(`update public.push_delivery set status = 'sending', sent_at = null, settled_at = null,
           claimed_at = now() - interval '70 seconds' where id = '${a}'`);
    check('같은 구독 · 방에 보내는 중인 줄이 있으면 대기 줄을 잡지 않는다', await claimed() === '0');
  }
} finally {
  sql(`delete from public.match where user_low in ('${sender}', '${recipient}') or user_high in ('${sender}', '${recipient}')`);
  sql(`delete from auth.users where id in ('${sender}', '${recipient}')`);
}

finish();
