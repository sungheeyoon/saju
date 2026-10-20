-- 7일이 지난 뒤의 「안 쓴 몫 환불」은 10% 를 위약금으로 뺀다 (`20261221090000`, ADR 0192)
--
-- 여기서 재는 것 다섯. 기대 금액은 앱의 셈(`src/lib/reading/bundle.test.ts` 「환불 금액」)과 같은 수다 — 확보가 받는 금액
-- (`p_expected_amount`)이 DB 의 셈과 다르면 거절되므로, 확보가 서면 두 셈이 같은 값을 냈다는 뜻이다.
--
-- 1. **사유가 금액을 가른다** — 같은 17장이 청약철회면 50,150원, 「안 쓴 몫 환불」이면 45,135원(20장 · 59,000원에서 3장 씀).
--    위약금 없는 금액으로 「안 쓴 몫 환불」을 내면 거절되고 DB 가 셈한 금액을 말한다
-- 2. **나눠 돌려줘도 위약금은 한 번** — 1장 + 16장으로 나눠 걷은 합이 한 번에 걷을 때(45,135원)와 같다
-- 3. **섞어도 위약금은 그 회차에만** — 철회 5장(14,750원) 뒤 「안 쓴 몫 환불」 12장은 31,860원(35,400 − 3,540)
-- 4. **버림은 누적 값에 한 번씩** — 3장 · 10,001원 묶음을 1장씩 세 번: 3,000 · 3,001 · 3,000원, 합 9,001원 = 10,001 − 1,000
-- 5. **운영자 셈이 위약금 회차를 낸다** — `operator_reading_refund_basis` 의 `penalized_credits`
--
-- 위약금을 빼지 않으면 1 의 둘째 줄과 2 · 3 · 4 가, 누적이 아니라 회마다 버리면 4 의 둘째 줄이 붉다.
begin;
select plan(17);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 확보 → 확정 — 확보에 낸 금액이 DB 의 셈과 같아야 선다. 확정된 금액을 돌려준다 */
create or replace function pg_temp.refund(p_order uuid, p_credits integer, p_reason text, p_amount integer, p_refund_id text)
returns integer language plpgsql as $$
declare
  h record;
begin
  select * into h from public.operator_hold_reading_refund(p_order, p_credits, p_reason, p_amount, gen_random_uuid());
  perform public.operator_book_reading_refund(h.hold_id, p_refund_id);
  return h.amount;
end;
$$;

create temporary table folks as
select
  tests.signup('penalty-buyer@example.com') as buyer,
  tests.signup('penalty-op@example.com') as op;
grant select on folks to authenticated, service_role;

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 위약금 환불');
insert into public.reading_sale_reviewer (user_id, note) values ((select buyer from folks), '시험 — 위약금 환불');

set local role authenticated;
select pg_temp.acting((select buyer from folks));

create temporary table ord (label text, order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'whole', order_id from public.open_reading_order(20, 'portone', 'penalty-whole-0001');
insert into ord select 'split', order_id from public.open_reading_order(20, 'portone', 'penalty-split-0001');
insert into ord select 'mixed', order_id from public.open_reading_order(20, 'portone', 'penalty-mixed-0001');
insert into ord select 'odd', order_id from public.open_reading_order(3, 'portone', 'penalty-odd-00001');

-- 버림을 보려고 3장 묶음의 결제액을 10,001원으로 둔다 — 파는 가격은 모두 장수로 나누어떨어진다. 소유자 권한으로 트리거를 잠깐 끈다
reset role;
alter table public.reading_order disable trigger reading_order_moves;
update public.reading_order set amount = 10001 where id = (select order_id from ord where label = 'odd');
alter table public.reading_order enable trigger reading_order_moves;

set local role service_role;
select public.approve_reading_order((select order_id from ord where label = 'whole'), 'tx-penalty-w', 59000, 'whk-penalty-w');
select public.approve_reading_order((select order_id from ord where label = 'split'), 'tx-penalty-s', 59000, 'whk-penalty-s');
select public.approve_reading_order((select order_id from ord where label = 'mixed'), 'tx-penalty-m', 59000, 'whk-penalty-m');
select public.approve_reading_order((select order_id from ord where label = 'odd'), 'tx-penalty-o', 10001, 'whk-penalty-o');

-- 20장 묶음 셋에서 3장씩 쓴다 — 남은 17장
reset role;
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
select (select buyer from folks), 'bundle', b.id, 'run', 'confirmed', now()
from public.reading_bundle b cross join generate_series(1, 3)
where b.order_id in (select order_id from ord where label in ('whole', 'split', 'mixed'));

set local role authenticated;
select pg_temp.acting((select op from folks));

-- ── 1. 사유가 금액을 가른다 ───────────────────────────────────────────────────

select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 17, 'unused', 50150, gen_random_uuid())$$,
         (select order_id from ord where label = 'whole')),
  '22023', '환불 금액이 45135원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '「안 쓴 몫 환불」에 위약금 없는 금액을 내면 거절하고 10% 를 뺀 금액을 말한다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 17, 'withdrawal', 45135, gen_random_uuid())$$,
         (select order_id from ord where label = 'whole')),
  '22023', '환불 금액이 50150원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '청약철회는 위약금을 빼지 않는다 — 59,000 × 17 ÷ 20 = 50,150원');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 17, 'other', 45135, gen_random_uuid())$$,
         (select order_id from ord where label = 'whole')),
  '22023', '환불 금액이 50150원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '그 밖(정지 · 서비스 종료 등)도 위약금을 빼지 않는다');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 17, 'failure', 45135, gen_random_uuid())$$,
         (select order_id from ord where label = 'whole')),
  '22023', '환불 금액이 50150원으로 바뀌었습니다. 새로 읽고 다시 확인해 주세요.',
  '미제공도 위약금을 빼지 않는다');
select is(
  pg_temp.refund((select order_id from ord where label = 'whole'), 17, 'unused', 45135, 'pg-penalty-w1'),
  45135,
  '7일 뒤 17장을 한 번에 — 50,150 − 5,015 = 45,135원');

-- ── 2. 나눠 돌려줘도 위약금은 한 번 ───────────────────────────────────────────

select is(
  pg_temp.refund((select order_id from ord where label = 'split'), 1, 'unused', 2655, 'pg-penalty-s1'),
  2655,
  '첫 1장 — 2,950 − 295 = 2,655원');
select is(
  pg_temp.refund((select order_id from ord where label = 'split'), 16, 'unused', 42480, 'pg-penalty-s2'),
  42480,
  '남은 16장 — 누적 50,150 − 누적 위약금 5,015 − 이미 돌려준 2,655 = 42,480원');

reset role;
select is(
  (select array[o.refunded_amount, b.refunded_credits]
   from public.reading_order o join public.reading_bundle b on b.order_id = o.id
   where o.id = (select order_id from ord where label = 'split')),
  array[45135, 17],
  '나눠 걷은 합이 한 번에 걷을 때와 같다 — 위약금이 두 번 빠지지 않았다');

-- ── 3. 섞어도 위약금은 그 회차에만 ────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  pg_temp.refund((select order_id from ord where label = 'mixed'), 5, 'withdrawal', 14750, 'pg-penalty-m1'),
  14750,
  '7일 안에 5장을 철회한다 — 59,000 × 5 ÷ 20 = 14,750원');
select is(
  pg_temp.refund((select order_id from ord where label = 'mixed'), 12, 'unused', 31860, 'pg-penalty-m2'),
  31860,
  '7일 뒤 12장 — 50,150 − 위약금 3,540(12장 몫만) − 14,750 = 31,860원');

-- ── 4. 버림은 누적 값에 한 번씩 ───────────────────────────────────────────────

select is(
  pg_temp.refund((select order_id from ord where label = 'odd'), 1, 'unused', 3000, 'pg-penalty-o1'),
  3000,
  '10,001원 3장 묶음의 첫 1장 — ⌊10,001 ÷ 3⌋ 3,333 − ⌊10,001 ÷ 30⌋ 333 = 3,000원');
select is(
  pg_temp.refund((select order_id from ord where label = 'odd'), 1, 'unused', 3001, 'pg-penalty-o2'),
  3001,
  '둘째 — 누적 6,667 − 누적 위약금 666 − 3,000 = 3,001원(회마다 버리면 3,000원이다)');
select is(
  pg_temp.refund((select order_id from ord where label = 'odd'), 1, 'unused', 3000, 'pg-penalty-o3'),
  3000,
  '셋째 — 10,001 − 1,000 − 6,001 = 3,000원');

reset role;
select is(
  (select array[o.refunded_amount, o.amount - o.refunded_amount]
   from public.reading_order o where o.id = (select order_id from ord where label = 'odd')),
  array[9001, 1000],
  '다 걷은 합은 결제액에서 ⌊결제액 × 10%⌋ 를 뺀 것이고 결제액을 넘지 않는다');

-- ── 5. 운영자 셈이 위약금 회차를 낸다 ─────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select op from folks));
select is(
  (select penalized_credits from public.operator_reading_refund_basis((select order_id from ord where label = 'mixed')) where asked),
  12,
  '섞은 주문 — 걷은 17장 가운데 위약금을 뗀 것은 12장이다');
select is(
  (select penalized_credits from public.operator_reading_refund_basis((select order_id from ord where label = 'whole')) where asked),
  17,
  '한 번에 걷은 주문 — 17장');
select is(
  (select array_agg(penalized_credits order by order_id) from public.operator_reading_refund_basis((select order_id from ord where label = 'whole')) where not asked),
  (select array_agg(n order by order_id) from (values
     ((select order_id from ord where label = 'split'), 17),
     ((select order_id from ord where label = 'mixed'), 12),
     ((select order_id from ord where label = 'odd'), 3)) v(order_id, n)),
  '같은 계정의 다른 주문도 저마다 제 위약금 회차를 낸다');

select * from finish();
rollback;
