-- 운영자가 오늘 · 이번 주(서울 시간)의 가입 · 풀이 · 주문 · 매출 · 환불 수를 본다 (`20261210090000`, G-110 ①, ADR 0183)
--
-- 여기서 재는 것 넷.
--
-- 1. **기간** — 오늘은 서울 0시부터, 이번 주는 서울 월요일 0시부터다. 경계 1초 앞의 줄은 오늘에 안 든다
-- 2. **센 것** — 가입 · 성공한 풀이 · 승인된 주문 · 그 금액 · 환불 줄 · 그 금액. 실패한 풀이 · 대기 주문 · 지난주 줄은 안 든다
-- 3. **접속기록** — 운영자가 읽으면 `today.figures` 한 줄, 거절은 따로 부르는 문이 적는다
-- 4. **모양** — 쓰므로 `volatile`, 로그인한 사람에게만 열려 있다
--
-- 표는 전역이라 다른 줄이 섞여 있다 — 수는 이 파일이 넣기 전과 뒤의 차이로 잰다.
begin;
select plan(17);

create temporary table folks as
select
  tests.signup('figures-buyer@example.com') as buyer,
  tests.signup('figures-early@example.com') as early,
  tests.signup('figures-old@example.com') as old,
  tests.signup('figures-stranger@example.com') as stranger,
  tests.signup('figures-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 오늘의 숫자');
-- 판매는 닫혀 있다 — 심사 계정으로 주문을 연다(ADR 0171)
insert into public.reading_sale_reviewer (user_id, note) values ((select buyer from folks), '시험 — 오늘의 숫자');

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.lines(who uuid)
returns table (action text, target uuid, filter text, outcome text)
language sql security definer as $$
  select a.action, a.target_report_id, a.filter_summary, a.outcome
  from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated, service_role, anon;

create temporary table seen (moment text, period text, since timestamptz, signups integer, readings integer,
                             orders integer, revenue bigint, refunds integer, refunded bigint);
grant select, insert on seen to authenticated, service_role;

-- 넣기 전 — 이 파일의 계정이 가입을 마친 시각은 아직 비어 있다
reset role;
update public.app_user set signed_up_at = null
where id in (select unnest(array[buyer, early, old, stranger, operator]) from folks);

set local role authenticated;
select pg_temp.acting((select operator from folks));
insert into seen select 'before', f.* from public.operator_today_figures() f;

-- ── 1. 기간 ─────────────────────────────────────────────────────────────────

select results_eq(
  $$select period from seen where moment = 'before'$$,
  $$values ('today'), ('week')$$,
  '두 줄 — 오늘 먼저, 이번 주 다음');

select is(
  (select to_char(since at time zone 'Asia/Seoul', 'HH24:MI:SS') || ' ' || (now() - since < interval '1 day')::text
   from seen where moment = 'before' and period = 'today'),
  '00:00:00 true',
  '오늘은 서울 0시부터 — 지금에서 하루 안');

select is(
  (select extract(isodow from since at time zone 'Asia/Seoul')::integer || ' '
          || to_char(since at time zone 'Asia/Seoul', 'HH24:MI:SS') || ' ' || (now() - since < interval '7 days')::text
   from seen where moment = 'before' and period = 'week'),
  '1 00:00:00 true',
  '이번 주는 서울 월요일 0시부터 — 지금에서 이레 안');

-- ── 2. 센 것 — 넣는다 ───────────────────────────────────────────────────────

reset role;
-- 가입 — 지금 하나, 오늘 경계 1초 앞 하나(이번 주가 오늘 시작이면 그것도 밖), 지난주 하나
update public.app_user set signed_up_at = now() where id = (select buyer from folks);
update public.app_user set signed_up_at = (select since from seen where moment = 'before' and period = 'today') - interval '1 second'
where id = (select early from folks);
update public.app_user set signed_up_at = now() - interval '8 days' where id = (select old from folks);

-- 풀이 — 성공 둘(지금 · 지난주), 실패 하나(지금)
insert into public.reading_run (user_id, kind, status, idempotency_key, finished_at)
values ((select buyer from folks), 'self', 'succeeded', 'figures-run-now', now()),
       ((select old from folks), 'self', 'succeeded', 'figures-run-old', now() - interval '8 days'),
       ((select buyer from folks), 'self', 'failed', 'figures-run-failed', now());

-- 주문 — 승인 둘, 대기 하나, 승인한 것 중 하나에서 두 번 나눠 환불
set local role authenticated;
select pg_temp.acting((select buyer from folks));
create temporary table ord (label text, order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'one', order_id from public.open_reading_order(1, 'portone', 'figures-one-0001');
insert into ord select 'three', order_id from public.open_reading_order(3, 'portone', 'figures-three-0001');
insert into ord select 'waiting', order_id from public.open_reading_order(5, 'portone', 'figures-five-0001');

reset role;
create temporary table paid as
select o.id, o.amount from public.reading_order o where o.id in (select order_id from ord where label in ('one', 'three'));
grant select on paid to service_role;

set local role service_role;
select public.approve_reading_order(id, 'tx-' || id::text, amount, 'whk-' || id::text) from paid;
select public.refund_reading_order((select order_id from ord where label = 'three'), 1000, 1, 'unused', 'rf-figures-1');
select public.refund_reading_order((select order_id from ord where label = 'three'), 500, 0, 'other', 'rf-figures-2');

set local role authenticated;
select pg_temp.acting((select operator from folks));
insert into seen select 'after', f.* from public.operator_today_figures() f;

create temporary table grew as
select a.period,
       a.signups - b.signups as signups, a.readings - b.readings as readings, a.orders - b.orders as orders,
       a.revenue - b.revenue as revenue, a.refunds - b.refunds as refunds, a.refunded - b.refunded as refunded
from seen a join seen b on b.period = a.period and b.moment = 'before'
where a.moment = 'after';

-- ── 2. 센 것 — 잰다 ─────────────────────────────────────────────────────────

select is((select signups from grew where period = 'today'), 1,
  '오늘의 가입은 지금 마친 하나 — 경계 1초 앞 · 지난주는 안 든다');
select is((select signups from grew where period = 'week'),
  (select case when w.since = t.since then 1 else 2 end
   from seen t join seen w on w.moment = 'before' and w.period = 'week' where t.moment = 'before' and t.period = 'today'),
  '이번 주의 가입은 오늘 경계 1초 앞까지 든다(월요일이면 그것도 지난주다) — 지난주는 안 든다');
select is((select readings from grew where period = 'today'), 1, '풀이는 성공한 것만 — 실패 · 지난주는 안 든다');
select is((select readings from grew where period = 'week'), 1, '이번 주도 지난주 풀이는 안 든다');
select results_eq(
  $$select orders, revenue from grew order by period$$,
  $$select 2, (select sum(amount) from paid)::bigint union all select 2, (select sum(amount) from paid)::bigint$$,
  '주문 · 매출은 승인된 두 주문과 그 결제 금액 — 대기 주문은 안 든다, 환불해도 매출은 그대로');
select results_eq(
  $$select refunds, refunded from grew order by period$$,
  $$values (2, 1500::bigint), (2, 1500::bigint)$$,
  '환불은 적은 줄마다 — 한 주문을 두 번 나눠 돌려주면 둘');

-- ── 3. 접속기록 ─────────────────────────────────────────────────────────────

select results_eq(
  $$select action, target, filter, outcome from pg_temp.lines((select operator from folks))$$,
  $$values ('today.figures', null::uuid, null::text, 'allowed'), ('today.figures', null, null, 'allowed')$$,
  '읽을 때마다 today.figures 한 줄 — 대상 · 거른 조건 없이');

select pg_temp.acting((select stranger from folks));
select throws_ok($$select * from public.operator_today_figures()$$, '42501', null, '운영자가 아니면 던진다');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '던진 문 안에서는 아무것도 안 남는다 — 되감긴다');
select lives_ok($$select public.note_operator_denial('today.figures')$$, '거절은 따로 부르는 문이 적는다');
select results_eq(
  $$select action, outcome from pg_temp.lines((select stranger from folks))$$,
  $$values ('today.figures', 'denied')$$,
  '거절한 줄이 동작 · 거절로 남는다');
select throws_ok($$select public.note_operator_denial('today.everything')$$, '22023', null,
  '모르는 동작은 여전히 안 받는다');

-- ── 4. 모양 ─────────────────────────────────────────────────────────────────

reset role;
select is(
  (select p.provolatile::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'operator_today_figures'),
  'v',
  'volatile — stable 이면 적지 못한다');
select ok(
  has_function_privilege('authenticated', 'public.operator_today_figures()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.operator_today_figures()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.operator_today_figures()', 'EXECUTE'),
  '로그인한 사람에게만 열려 있다');

select * from finish();
rollback;
