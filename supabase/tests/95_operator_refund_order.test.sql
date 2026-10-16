-- 운영자가 주문 화면에서 환불을 적는다 (`20261211090000`, G-110 ②, ADR 0184)
--
-- 여기서 재는 것 다섯.
--
-- 1. **운영자만** — 산 사람 자신도 못 부른다(`42501`)
-- 2. **금액은 DB 가 다시 셈한다** — ADR 0148 의 누적 산식과 다른 금액은 적지 않는다. 나눠 돌려줘도 합이 결제액을 넘지 않는다
-- 3. **안 쓴 것만 · 취소 번호 필수 · 닫힌 주문 거절** — 쓴 회차 · 빈 번호 · 결제 전 주문은 거절된다
-- 4. **같은 취소 번호는 한 번** — 같은 회차 · 사유면 재시도, 다르면 거절
-- 5. **접속기록** — 적을 때마다 `credits.refund` 한 줄(주문 id 만), 운영자가 아니면 거절 한 줄
--
-- 산식에서 `b.refunded_credits` 를 빼면(누적이 아니라 이번 회차만 셈하면) 둘째 환불이, 운영자 판정을 빼면 1 이 붉다.
begin;
select plan(17);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('refund-buyer@example.com') as buyer,
  tests.signup('refund-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 주문 화면에서 환불을 적는 사람');

-- 판매는 닫혀 있다 — 심사 계정으로 넣어 주문을 연다(ADR 0171)
insert into public.reading_sale_reviewer (user_id, note)
values ((select buyer from folks), '시험 — 운영자 환불');

set local role authenticated;
select pg_temp.acting((select buyer from folks));

create temporary table ord (label text, order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'three', order_id from public.open_reading_order(3, 'portone', 'refund-three-0001');
insert into ord select 'one', order_id from public.open_reading_order(1, 'portone', 'refund-one-00001');
insert into ord select 'pending', order_id from public.open_reading_order(5, 'portone', 'refund-five-0001');

set local role service_role;
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'three'), 'tx-refund-3', 12900, 'whk-refund-3')),
  'applied',
  '준비 — 3회 주문(12,900원)이 승인된다');
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'one'), 'tx-refund-1', 4900, 'whk-refund-1')),
  'applied',
  '준비 — 1회 주문(4,900원)이 승인된다');

-- 3회 묶음에서 하나를 쓴다 — 표는 밖에서 못 쓰므로 소유자 권한으로
reset role;
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
select (select buyer from folks), 'bundle', b.id, 'run', 'confirmed', now()
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'three');

-- ── 1. 운영자만 ───────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select buyer from folks));
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 4300, 'unused', 'pg-cancel-1')$$,
         (select order_id from ord where label = 'three')),
  '42501', null, '산 사람 자신도 환불을 적지 못한다');
select lives_ok(
  $$select public.note_operator_denial('credits.refund')$$,
  '앱의 문이 그 거절을 따로 적는다');

-- ── 3. 안 쓴 것만 · 취소 번호 필수 · 닫힌 주문 거절 ────────────────────────────

select pg_temp.acting((select op from folks));
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 4300, 'unused', '  ')$$,
         (select order_id from ord where label = 'three')),
  '22023', 'PG 취소 번호를 적어 주세요.', 'PG 취소 번호 없이는 적지 않는다');
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 3, 12900, 'unused', 'pg-cancel-1')$$,
         (select order_id from ord where label = 'three')),
  '22023', '걷을 수 있는 회차는 2장입니다.', '쓴 회차는 걷지 못한다 — 안 쓴 것은 둘이다');
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 5000, 'pending', 'pg-cancel-x')$$,
         (select order_id from ord where label = 'pending')),
  '55000', '환불할 수 없는 상태의 주문입니다.', '결제 전 주문은 환불하지 못한다');

-- ── 2. 금액은 DB 가 다시 셈한다 ───────────────────────────────────────────────

select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 4900, 'unused', 'pg-cancel-1')$$,
         (select order_id from ord where label = 'three')),
  '22023', '환불 금액이 4300원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '1회권 정가(4,900원)로 셈한 금액은 적지 않는다 — 12,900 × 1 ÷ 3 = 4,300원');
select is(
  public.operator_refund_reading_order((select order_id from ord where label = 'three'), 1, 4300, 'unused', 'pg-cancel-1'),
  'partially_refunded',
  '안 쓴 하나를 걷고 4,300원을 적는다');

-- ── 4. 같은 취소 번호는 한 번 ─────────────────────────────────────────────────

select is(
  public.operator_refund_reading_order((select order_id from ord where label = 'three'), 1, 4300, 'unused', 'pg-cancel-1'),
  'partially_refunded',
  '같은 취소 번호 · 회차 · 사유로 다시 눌러도 한 번만 적힌다');
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 4300, 'withdrawal', 'pg-cancel-1')$$,
         (select order_id from ord where label = 'three')),
  '22023', '이 PG 취소 번호는 다른 환불에 이미 적혔습니다.', '같은 취소 번호에 다른 사유는 거절한다');

-- 둘째 환불 — 누적 산식: 12,900 × 2 ÷ 3 = 8,600 에서 이미 돌려준 4,300 을 뺀다
select is(
  public.operator_refund_reading_order((select order_id from ord where label = 'three'), 1, 4300, 'unused', 'pg-cancel-2'),
  'partially_refunded',
  '나눠 돌려주면 누적으로 셈한다 — 둘째도 4,300원');
select throws_ok(
  format($$select public.operator_refund_reading_order(%L, 1, 4300, 'unused', 'pg-cancel-3')$$,
         (select order_id from ord where label = 'three')),
  '22023', '걷을 수 있는 회차는 0장입니다.', '다 걷은 뒤에는 더 걷지 못한다 — 쓴 하나는 남는다');
select is(
  public.operator_refund_reading_order((select order_id from ord where label = 'one'), 1, 4900, 'withdrawal', 'pg-cancel-4'),
  'refunded',
  '안 쓴 1회권은 결제액 전부를 돌려주고 주문이 닫힌다');

reset role;
select is(
  (select array[b.refunded_credits, o.refunded_amount,
                (select count(*)::integer from public.reading_order_refund f where f.order_id = o.id)]
   from public.reading_bundle b join public.reading_order o on o.id = b.order_id
   where o.id = (select order_id from ord where label = 'three')),
  array[2, 8600, 2],
  '3회 주문의 장부 — 걷은 둘 · 돌려준 8,600원 · 환불 줄 둘(재시도는 줄을 더하지 않았다)');

-- ── 5. 접속기록 ───────────────────────────────────────────────────────────────

select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select op from folks) and a.action = 'credits.refund' and a.outcome = 'allowed'
     and a.filter_summary in (select 'order=' || order_id from ord)),
  4,
  '적은 셋과 재시도 하나가 줄마다 남고 거절된 시도는 되감긴다 — 거른 조건 칸에는 주문 id 만');
select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select buyer from folks) and a.action = 'credits.refund' and a.outcome = 'denied'),
  1,
  '운영자가 아닌 사람의 시도는 거절 한 줄로 남는다');

select * from finish();
rollback;
