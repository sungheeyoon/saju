-- 카드사 심사 계정 — 판매가 닫힌 채로 그 계정만 주문을 연다 (`20261207090000`, G-21, ADR 0171)
--
-- 여기서 재는 것 넷.
--
-- 1. **판매는 닫힌 그대로다** — 스위치는 false, 심사 계정이 아닌 사람의 주문 문은 「판매가 닫혔다」로 던진다
-- 2. **심사 계정만 지나간다** — 주문이 서고, 승인 문이 그 주문에 묶음을 세우며, 화면의 판정(`my_reading_sale_is_open`)이 문과 같다
-- 3. **표는 밖에서 못 닿는다** — 로그인한 사람도 서버의 열쇠도 심사 표를 읽거나 쓰지 못하고, 판정 함수도 직접 못 부른다
-- 4. **주문 상태는 제 것만** — `my_reading_order` 는 남의 주문에 빈 결과다
--
-- 스위치 판정을 옛 `reading_sale_is_open()` 으로 되돌리면 2 가, 표를 `authenticated` 에 열면 3 이 붉다.
begin;
select plan(16);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('reviewer-sale@example.com') as reviewer,
  tests.signup('plain-sale@example.com') as plain;
grant select on folks to authenticated, service_role;

insert into public.reading_sale_reviewer (user_id, note)
values ((select reviewer from folks), '시험 — 카드사 심사 계정');

-- ── 1. 판매는 닫힌 그대로다 ──────────────────────────────────────────────────

select is(public.reading_sale_is_open(), false, '판매 스위치는 꺼져 있다 — 이 마이그레이션이 켜지 않는다');

set local role authenticated;
select pg_temp.acting((select plain from folks));

select is(public.my_reading_sale_is_open(), false, '심사 계정이 아니면 화면의 판정도 닫혀 있다');
select throws_ok(
  $$select * from public.open_reading_order(1, 'portone', 'plain-sale-0001')$$,
  '55000', 'reading_order: the sale is closed',
  '심사 계정이 아니면 주문이 안 열린다');

-- ── 2. 심사 계정만 지나간다 ─────────────────────────────────────────────────

select pg_temp.acting((select reviewer from folks));

select is(public.my_reading_sale_is_open(), true, '심사 계정에게는 화면의 판정이 열려 있다 — 문과 같은 판정이다');

create temporary table ord as
select * from public.open_reading_order(1, 'portone', 'reviewer-sale-0001');
grant select on ord to authenticated, service_role;

select is((select amount from ord), 4900, '심사 계정의 주문도 금액은 가격표에서 온다 — 0원이 아니다');
select is(
  (select array[status, bundle_credits::text, amount::text] from public.my_reading_order((select order_id from ord))),
  array['pending', '1', '4900'],
  '제 주문의 상태를 읽는다 — 결제 전이면 대기');

set local role service_role;
select is(
  (select outcome from public.approve_reading_order(
     (select order_id from ord), 'tx-reviewer-1', 4900, 'whk-reviewer-1')),
  'applied',
  '승인 문(웹훅이 부른다)이 심사 계정의 주문에 묶음을 세운다');

set local role authenticated;
select pg_temp.acting((select reviewer from folks));
select is(
  (select status from public.my_reading_order((select order_id from ord))),
  'approved',
  '승인 뒤 제 주문은 승인으로 읽힌다');
select is(
  (select credit_limit from public.my_reading_credits()),
  tests.reading_credit_limit() + 1,
  '산 1회가 한도 위에 얹힌다');

-- ── 3. 표는 밖에서 못 닿는다 ─────────────────────────────────────────────────

select throws_ok($$select 1 from public.reading_sale_reviewer$$, '42501', null, '로그인한 사람은 심사 표를 못 읽는다');
select throws_ok(
  format($$insert into public.reading_sale_reviewer (user_id, note) values (%L, '스스로')$$, (select plain from folks)),
  '42501', null, '로그인한 사람은 스스로 심사 계정이 되지 못한다');
select throws_ok(
  format($$select public.reading_sale_is_open_for(%L)$$, (select plain from folks)),
  '42501', null, '남의 판정을 묻는 함수는 직접 못 부른다');

set local role service_role;
select throws_ok($$select 1 from public.reading_sale_reviewer$$, '42501', null, '서버의 열쇠로도 심사 표를 못 읽는다');

set local role anon;
select throws_ok($$select public.my_reading_sale_is_open()$$, '42501', null, '로그인 안 한 사람은 판정을 못 부른다');

-- ── 4. 주문 상태는 제 것만 ───────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select plain from folks));
select is(
  (select count(*)::int from public.my_reading_order((select order_id from ord))),
  0,
  '남의 주문은 빈 결과다 — 있는지도 말하지 않는다');

reset role;
delete from public.reading_sale_reviewer where user_id = (select reviewer from folks);
set local role authenticated;
select pg_temp.acting((select reviewer from folks));
select throws_ok(
  $$select * from public.open_reading_order(1, 'portone', 'reviewer-sale-0002')$$,
  '55000', 'reading_order: the sale is closed',
  '심사 표에서 걷으면 그 계정도 다시 닫힌다');

select * from finish();
rollback;
