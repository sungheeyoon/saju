-- 결제 알림의 재시도는 같은 요청일 때만 — 같은 알림 번호를 다른 주문 · 다른 금액 · 다른 종류로 부르면 거절한다 (ADR 0106)
--
-- `20261013090000` 까지 `approve_reading_order` 는 `(provider, provider_event_id)` 가 부딪히면 그 줄의 결과만 돌려줬다
-- — 주문 A 에서 `applied` 된 알림 번호로 주문 B 를 부르면 B 는 묶음이 없는데 `applied` 를 받았다. 환불도 같은 모양
-- 이었다 — 같은 환불 번호를 다른 금액 · 회차로 다시 부르면 첫 환불을 「적혔다」로 돌려줬다. (`20261015090000`)
--
--   1. **알림** — 다른 주문 · 다른 금액 · 다른 종류 · (승인된 알림이면) 다른 거래 번호는 `22023`. 같은 요청의 재시도는
--      처음의 결과 그대로, 알림은 한 줄
--   2. **환불** — 같은 환불 번호에 다른 금액 · 회차 · 사유는 `22023`. 같은 요청의 재시도는 한 번만 적힌다
begin;
select plan(20);

create temporary table folks as select tests.signup('per-buyer@example.com') as buyer;
grant select on folks to authenticated, service_role;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 판매를 연다 — 이 트랜잭션 안에서만 */
create or replace function public.reading_sale_is_open()
returns boolean language sql immutable set search_path = '' as $$ select true $$;

set local role authenticated;
select pg_temp.acting((select buyer from folks));
create temporary table ords as
select 'a' as name, o.* from public.open_reading_order(3, 'dev', 'per-order-a') o
union all
select 'b', o.* from public.open_reading_order(3, 'dev', 'per-order-b') o
union all
select 'c', o.* from public.open_reading_order(3, 'dev', 'per-order-c') o;
grant select on ords to authenticated, service_role;

create or replace function pg_temp.ord(n text)
returns uuid language sql as $$ select order_id from ords where name = n $$;

-- ── 1. 알림 ───────────────────────────────────────────────────────────────────

set local role service_role;
create temporary table bought as
select r.* from public.approve_reading_order(pg_temp.ord('a'), 'per-pay-a', 12900, 'per-evt-1') r;
grant select on bought to service_role;
select is((select outcome from bought), 'applied', '주문 A 가 알림 1 로 승인된다');

select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-b', 12900, 'per-evt-1')$$, pg_temp.ord('b')),
  '22023', 'payment_event: the event id belongs to another request',
  'A 의 알림 번호로 주문 B 를 부르면 거절한다 — B 에 applied 를 돌려주지 않는다');
select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-a', 4900, 'per-evt-1')$$, pg_temp.ord('a')),
  '22023', 'payment_event: the event id belongs to another request',
  '같은 주문이라도 금액이 다르면 재시도가 아니다');
select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-x', 12900, 'per-evt-1')$$, pg_temp.ord('a')),
  '22023', 'payment_event: the event id belongs to another request',
  '승인된 알림을 다른 거래 번호로 부르면 재시도가 아니다');
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order(pg_temp.ord('a'), 'per-pay-a', 12900, 'per-evt-1') r),
  array['applied', (select bundle_id::text from bought)],
  '같은 요청의 재시도는 처음의 결과 그대로 — 같은 묶음');

reset role;
insert into public.payment_event (provider, provider_event_id, order_id, kind, amount, outcome)
values ('dev', 'per-evt-k', pg_temp.ord('c'), 'refunded', 12900, 'applied');
set local role service_role;
select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-c', 12900, 'per-evt-k')$$, pg_temp.ord('c')),
  '22023', 'payment_event: the event id belongs to another request',
  '종류가 다른 알림의 번호로 승인을 부르면 재시도가 아니다');

select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order(pg_temp.ord('b'), 'per-pay-b', 4900, 'per-evt-2') r),
  array['refused', null],
  '주문 B 의 금액이 다른 알림 2 는 거절을 돌려준다');
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order(pg_temp.ord('b'), 'per-pay-b', 4900, 'per-evt-2') r),
  array['refused', null],
  '같은 거절 알림의 재시도는 거절 그대로');
select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-b', 12900, 'per-evt-2')$$, pg_temp.ord('b')),
  '22023', 'payment_event: the event id belongs to another request',
  '거절된 알림 번호를 맞는 금액으로 다시 쓰면 재시도가 아니다 — 거절을 승인으로 바꾸지 않는다');
select throws_ok(
  format($$select * from public.approve_reading_order(%L, 'per-pay-c', 4900, 'per-evt-2')$$, pg_temp.ord('c')),
  '22023', 'payment_event: the event id belongs to another request',
  'B 의 거절 알림 번호로 주문 C 를 불러도 거절한다');

reset role;
select is(
  (select array[o.status, (select count(*)::text from public.reading_bundle b where b.order_id = o.id)]
   from public.reading_order o where o.id = pg_temp.ord('b')),
  array['pending', '0'],
  '주문 B 는 움직이지 않았고 묶음도 없다');
select is(
  (select array_agg(e.provider_event_id || ':' || e.order_id::text || ':' || e.outcome order by e.provider_event_id)
   from public.payment_event e where e.provider_event_id in ('per-evt-1', 'per-evt-2')),
  array['per-evt-1:' || pg_temp.ord('a') || ':applied', 'per-evt-2:' || pg_temp.ord('b') || ':refused'],
  '알림은 번호마다 처음의 한 줄 그대로다');

-- ── 2. 환불 ───────────────────────────────────────────────────────────────────

set local role service_role;
select is(
  public.refund_reading_order(pg_temp.ord('a'), 4300, 1, 'unused', 'per-refund-1'),
  'partially_refunded',
  '안 쓴 하나를 걷고 일부를 돌려준다');
select is(
  public.refund_reading_order(pg_temp.ord('a'), 4300, 1, 'unused', 'per-refund-1'),
  'partially_refunded',
  '같은 요청의 재시도는 한 번만 적힌다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 8600, 1, 'unused', 'per-refund-1')$$, pg_temp.ord('a')),
  '22023', 'reading_order: the refund id belongs to another refund',
  '같은 환불 번호에 다른 금액은 거절한다 — 첫 환불을 「적혔다」로 돌려주지 않는다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 4300, 2, 'unused', 'per-refund-1')$$, pg_temp.ord('a')),
  '22023', 'reading_order: the refund id belongs to another refund',
  '같은 환불 번호에 다른 회차는 거절한다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 4300, 1, 'failure', 'per-refund-1')$$, pg_temp.ord('a')),
  '22023', 'reading_order: the refund id belongs to another refund',
  '같은 환불 번호에 다른 사유는 거절한다');

reset role;
select is(
  (select array[b.refunded_credits, o.refunded_amount,
                (select count(*)::integer from public.reading_order_refund f where f.order_id = o.id)]
   from public.reading_bundle b join public.reading_order o on o.id = b.order_id
   where o.id = pg_temp.ord('a')),
  array[1, 4300, 1],
  '걷은 회차 · 돌려준 금액 · 환불 한 줄 — 거절된 부름은 아무것도 적지 않았다');

-- ── 모양 ──────────────────────────────────────────────────────────────────────

select is(
  (select array[p.prosecdef::text, array_to_string(p.proconfig, ',')]
   from pg_proc p where p.oid = 'public.approve_reading_order(uuid, text, integer, text)'::regprocedure),
  array['true', 'search_path=""'],
  '승인 문은 정의자 권한 · 빈 search_path 그대로');
select ok(
  not has_function_privilege('authenticated', 'public.refund_reading_order(uuid, integer, integer, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.approve_reading_order(uuid, text, integer, text)', 'execute'),
  '로그인한 사람은 못 부르고 서버는 부른다 — 권한 그대로');

select * from finish();
rollback;
