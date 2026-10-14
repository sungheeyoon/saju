-- 결제 내역 — 산 사람은 제 주문만 다시 본다 (`20261208090000`, G-21, ADR 0174)
--
-- 여기서 재는 것 넷.
--
-- 1. **승인된 적 있는 주문만** — 대기 주문은 거래가 아니라 안 선다
-- 2. **칸** — 주문 번호(`rdo_…`) · 회차 · 금액 · 환불한 금액 · 상태 · 결제 시각
-- 3. **남은 회차** = 산 수 − 걷은 수 − 쓴 것 − 살아 있는 예약. 죽은 예약(시도 · 요청이 없는 것)은 세지 않는다
-- 4. **제 것만** — 남은 빈 결과, 로그인 안 한 사람과 서버의 열쇠는 못 부른다
--
-- 문의 `where` 에서 부른 사람 조건을 빼면 4 가, 확정 쓰임을 안 세면 3 이 붉다.
begin;
select plan(13);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('history-buyer@example.com') as buyer,
  tests.signup('history-other@example.com') as other;
grant select on folks to authenticated, service_role;

-- 판매는 닫혀 있다 — 심사 계정으로 넣어 주문을 연다(ADR 0171)
insert into public.reading_sale_reviewer (user_id, note)
values ((select buyer from folks), '시험 — 결제 내역');

set local role authenticated;
select pg_temp.acting((select buyer from folks));

create temporary table ord (label text, order_id uuid, provider_order_id text);
grant select, insert on ord to authenticated, service_role;
insert into ord select 'one', order_id, provider_order_id from public.open_reading_order(1, 'portone', 'history-one-0001');
insert into ord select 'three', order_id, provider_order_id from public.open_reading_order(3, 'portone', 'history-three-0001');
insert into ord select 'five', order_id, provider_order_id from public.open_reading_order(5, 'portone', 'history-five-0001');

set local role service_role;
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'one'), 'tx-history-1', 4900, 'whk-history-1')),
  'applied',
  '준비 — 1회 주문이 승인된다');
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord where label = 'three'), 'tx-history-3', 12900, 'whk-history-3')),
  'applied',
  '준비 — 3회 주문이 승인된다');
select is(
  public.refund_reading_order((select order_id from ord where label = 'three'), 4300, 1, 'unused', 'rf-history-3'),
  'partially_refunded',
  '준비 — 3회 주문에서 하나를 돌려준다');

-- 쓴 것 하나(1회 묶음)와 죽은 예약 하나(3회 묶음) — 표는 밖에서 못 쓰므로 소유자 권한으로
reset role;
insert into public.reading_credit_use (user_id, share, bundle_id, source, state, confirmed_at)
select (select buyer from folks), 'bundle', b.id, 'run', 'confirmed', now()
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'one');
insert into public.reading_credit_use (user_id, share, bundle_id, source)
select (select buyer from folks), 'bundle', b.id, 'run'
from public.reading_bundle b where b.order_id = (select order_id from ord where label = 'three');

-- ── 1. 승인된 적 있는 주문만 ──────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select buyer from folks));

select is(
  (select count(*)::int from public.my_reading_orders()),
  2,
  '승인된 두 주문만 선다 — 결제 전 대기 주문은 거래가 아니다');

-- ── 2. 칸 ─────────────────────────────────────────────────────────────────────

select is(
  (select h.provider_order_id from public.my_reading_orders() h where h.bundle_credits = 1),
  (select provider_order_id from ord where label = 'one'),
  '주문 번호는 결제창 · PG 가 아는 가맹점 주문 번호(rdo_…)다');
-- 웹훅(`app/api/portone/webhook/settle.ts` 의 `orderIdOf`)이 이 모양을 거꾸로 풀어 주문 id 를 찾는다 — 모양을 바꾸면 여기가 붉다
select is(
  (select count(*)::int from ord where provider_order_id <> 'rdo_' || replace(order_id::text, '-', '')),
  0,
  '주문 번호는 rdo_ 와 주문 id 의 하이픈 뺀 소문자 32자다 — 웹훅이 거꾸로 푼다');
select ok(
  (select bool_and(h.paid_at is not null) from public.my_reading_orders() h),
  '결제 시각이 선다');
select is(
  (select array[h.status, h.amount::text, h.refunded_amount::text] from public.my_reading_orders() h where h.bundle_credits = 3),
  array['partially_refunded', '12900', '4300'],
  '일부를 돌려받은 주문은 부분 환불과 돌려받은 금액으로 읽힌다');

-- ── 3. 남은 회차 ──────────────────────────────────────────────────────────────

select is(
  (select h.remaining from public.my_reading_orders() h where h.bundle_credits = 1),
  0,
  '1회 묶음에서 하나를 썼으면 남은 것은 없다');
select is(
  (select h.remaining from public.my_reading_orders() h where h.bundle_credits = 3),
  2,
  '3회 묶음에서 하나를 돌려받았으면 둘이 남는다 — 시도도 요청도 없는 죽은 예약은 세지 않는다');

-- ── 4. 제 것만 ────────────────────────────────────────────────────────────────

select pg_temp.acting((select other from folks));
select is(
  (select count(*)::int from public.my_reading_orders()),
  0,
  '남의 결제 내역은 빈 결과다');

set local role anon;
select throws_ok($$select * from public.my_reading_orders()$$, '42501', null, '로그인 안 한 사람은 못 부른다');

set local role service_role;
select throws_ok($$select * from public.my_reading_orders()$$, '42501', null, '서버의 열쇠도 이 문을 안 쓴다 — 부른 사람이 없다');

select * from finish();
rollback;
