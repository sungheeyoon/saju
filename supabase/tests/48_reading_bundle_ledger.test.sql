-- 산 풀이권 — 묶음이 결제 주문에 매이고, 어느 쓰임이 어느 몫을 썼는지가 남는다 (G-21 ⑤ ④, ADR 0106)
--
-- 여기서 재는 것 일곱.
--
-- 1. **지금 동작이 그대로다.** 산 몫이 없는 계정은 한도 · 잔액이 전과 같다 — 이 DB 의 모든 계정에 대고 잰다.
-- 2. **몫을 만드는 길은 서버의 문뿐이다.** 판매는 닫혀 있고, 로그인한 사람은 표에도 승인 문에도 못 닿는다.
--    같은 열쇠를 다른 묶음에 쓰면 거절하고, 금액이 다른 알림은 **던지지 않고 거절을 돌려주며 남는다**
--    (`20261013090000`). 두 세션이 같은 열쇠로 나란히 여는 경우는 여기서 못 만든다 — `scripts/check-db-races.mjs`
-- 3. **쓴 순서.** 무료 → 예외 → 오래된 묶음. 예약 → 확정 · 풀림, 수락은 요청의 예약을 이어 받는다.
-- 4. **환불은 안 쓴 것만.** 예약 중인 것은 풀릴 때까지 안 쓴 것이 아니다. 운영자의 읽기는 적힌다.
-- 5. **두 문이 마지막 한 번을 다투면 하나만** — 두 문이 같은 자물쇠 안에서 센다.
-- 6. **떠나면** 결제 기록이 따로 5년 남고 일반 표에서는 사라진다.
-- 7. **무료 · 유료가 함께 있으면** 무료 → 예외 → 먼저 산 묶음. 풀린 무료 · 예외 자리가 묶음보다 먼저 돌아오고,
--    인연 요청도 같은 순서이며, 무료를 쓰는 동안 묶음의 환불 셈은 안 준다(운영자 요구 2026-10-16).
begin;
select plan(76);

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform tests.set_discovery_participation(true, summary, tests.need());
  return uid;
end;
$$;

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(run uuid)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, '## 풀이', null, '한 사람을 한마디로.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 대상 하나를 열고 끝까지 민다 — 풀이권 하나가 확정되는 온전한 한 바퀴 */
create or replace function pg_temp.burn(who uuid, key text)
returns uuid language plpgsql as $$
declare started uuid;
begin
  select run_id into started from public.start_reading_run('person', key, who);
  perform pg_temp.save(started);
  return started;
end;
$$;

/** 그 시도 · 요청의 쓰임 — 몫과 상태. 표는 밖에서 못 읽으므로 소유자 권한으로 */
create or replace function pg_temp.use_of_run(run uuid)
returns text language sql security definer as $$
  select u.share || ':' || u.state from public.reading_credit_use u where u.run_id = run
$$;

create or replace function pg_temp.use_of_request(req uuid)
returns text language sql security definer as $$
  select u.share || ':' || u.state from public.reading_credit_use u where u.request_id = req
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-ledger@example.com', '김장', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-ledger@example.com', '이장', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('park-ledger@example.com', '박장', pg_temp.summary(2, 2, 2, 2, 0)) as park,
  pg_temp.participant('choi-ledger@example.com', '최장', pg_temp.summary(0, 0, 0, 0, 8)) as choi,
  tests.signup('op-ledger@example.com') as op;
grant select on folks to authenticated, service_role, anon;

reset role;

update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks
                      union all select park from folks union all select choi from folks);

insert into public.operator (user_id, note) values ((select op from folks), '시험 — 환불 셈을 읽는 사람');

-- ── 1. 지금 동작이 그대로다 ──────────────────────────────────────────────────

/**
 * **산 몫이 0 이면 한도는 전과 같다 — 모든 계정에서.** 전의 한도는 상수 + 예외였다(ADR 0043).
 * 이 DB 에 있는 계정 전부(다른 시험이 남긴 것까지)에 대고 잰다.
 */
select is(
  (select count(*)::integer from public.app_user u
   where public.reading_credit_limit_for(u.id)
         <> public.reading_credit_limit()
            + coalesce((select g.extra from public.reading_credit_grant g where g.user_id = u.id), 0)),
  0,
  '산 몫이 없는 계정은 한도가 전과 같다 — 이 DB 의 모든 계정');

select is(
  (select count(*)::integer from public.app_user),
  (select count(*)::integer from public.app_user u
   where not exists (select 1 from public.reading_bundle b where b.user_id = u.id)),
  '아직 아무도 묶음이 없다 — 위 줄이 빈 참이 아니다');

set local role authenticated;
select pg_temp.acting((select kim from folks));

create temporary table kin as
select
  public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
    'female', '부산', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as mom,
  public.create_managed_person('아빠', null, 'solar', '1960-11-08', '1960-11-08', '05:40',
    'male', '대구', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as dad,
  public.create_managed_person('누나', null, 'solar', '1988-01-19', '1988-01-19', '22:05',
    'female', '광주', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as sis,
  public.create_managed_person('형', null, 'solar', '1986-07-23', '1986-07-23', '11:15',
    'male', '인천', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as bro,
  public.create_managed_person('삼촌', null, 'solar', '1958-09-30', '1958-09-30', '16:50',
    'male', '대전', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as unc;
grant select on kin to authenticated, service_role;

select is(
  (select array[credit_limit, used, reserved, requested, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit(), 0, 0, 0, tests.reading_credit_limit()],
  '묶음이 없는 사람의 잔액은 상수 그대로다');

-- ── 2. 몫을 만드는 길은 서버의 문뿐이다 ─────────────────────────────────────

reset role;
select is(
  array[public.reading_bundle_price(1), public.reading_bundle_price(3), public.reading_bundle_price(5),
        public.reading_bundle_price(20), public.reading_bundle_price(2)],
  array[4900, 12900, 19900, 59000, null],
  '가격표는 넷이고 그 밖의 수는 팔지 않는다 — src/lib/reading/bundle.ts 와 같은 값');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  $$select * from public.open_reading_order(3, 'dev', 'ledger-order-0001')$$,
  '55000', 'reading_order: the sale is closed',
  '판매가 닫혀 있으면 주문도 안 열린다 — 공개 출시의 스위치는 꺼져 있다');

select throws_ok($$select 1 from public.reading_order$$, '42501', null, '주문 표는 밖에서 못 읽는다');
select throws_ok($$select 1 from public.reading_credit_use$$, '42501', null, '사용 이력도 밖에서 못 읽는다');
select throws_ok(
  format($$insert into public.reading_bundle (order_id, user_id, credits, price)
           values (gen_random_uuid(), %L, 20, 59000)$$, (select kim from folks)),
  '42501', null, '로그인한 사람이 묶음을 스스로 넣지 못한다');
select throws_ok(
  $$select public.approve_reading_order(gen_random_uuid(), 'x', 4900)$$,
  '42501', null, '로그인한 사람은 승인 문을 못 부른다');
select throws_ok(
  $$select * from public.operator_reading_refund_basis(gen_random_uuid())$$,
  '42501', '운영자만 읽는 자리입니다.', '운영자가 아니면 환불 셈을 못 읽는다');

set local role anon;
select throws_ok(
  $$select * from public.open_reading_order(3, 'dev', 'ledger-order-0001')$$,
  '42501', null, '로그인 안 한 사람은 주문 문도 못 부른다');

set local role service_role;
select throws_ok(
  format($$insert into public.reading_bundle (order_id, user_id, credits, price)
           values (gen_random_uuid(), %L, 20, 59000)$$, (select kim from folks)),
  '42501', null, '서버의 열쇠로도 묶음을 직접 넣지 못한다 — 승인 문만');
select throws_ok($$select 1 from retention.reading_payment$$, '42501', null,
  '떠난 사람의 결제 기록은 서버의 열쇠로도 못 읽는다');

-- ── 3. 쓴 순서 ──────────────────────────────────────────────────────────────

reset role;
insert into public.reading_credit_grant (user_id, extra, note)
values ((select kim from folks), 1, '시험 — 예외 몫이 무료 다음, 묶음 앞에 서는지 잰다');

set local role authenticated;
select pg_temp.acting((select kim from folks));

select pg_temp.burn((select mom from kin), 'ledger-run-0001');
select pg_temp.burn((select dad from kin), 'ledger-run-0002');
select pg_temp.burn((select sis from kin), 'ledger-run-0003');
select pg_temp.burn((select bro from kin), 'ledger-run-0004');

reset role;
select is(
  (select array_agg(u.share || ':' || u.state order by u.id) from public.reading_credit_use u
   where u.user_id = (select kim from folks)),
  array['free:confirmed', 'free:confirmed', 'free:confirmed', 'free:confirmed'],
  '처음 넷은 무료 몫에서 확정된다');

/** 판매를 연다 — 이 트랜잭션 안에서만. 공개 출시의 스위치를 흉내 낸다 */
create or replace function public.reading_sale_is_open()
returns boolean language sql immutable set search_path = '' as $$ select true $$;

set local role authenticated;
select pg_temp.acting((select kim from folks));

create temporary table ord as
select * from public.open_reading_order(3, 'dev', 'ledger-order-0001');
grant select on ord to authenticated, service_role;

select is((select amount from ord), 12900, '주문 금액은 가격표에서 온다 — 부르는 쪽이 대지 않는다');
select is(
  (select order_id from public.open_reading_order(3, 'dev', 'ledger-order-0001')),
  (select order_id from ord),
  '같은 열쇠로 다시 누르면 같은 주문이다');
select throws_ok(
  $$select * from public.open_reading_order(5, 'dev', 'ledger-order-0001')$$,
  '22023', 'reading_order: the idempotency key belongs to another order',
  '같은 열쇠로 다른 묶음을 누르면 옛 주문을 돌려주지 않고 거절한다');
select throws_ok(
  $$select * from public.open_reading_order(3, 'other', 'ledger-order-0001')$$,
  '22023', 'reading_order: the idempotency key belongs to another order',
  '같은 열쇠로 다른 제공자도 거절한다');
select is(
  (select credit_limit from public.my_reading_credits()),
  tests.reading_credit_limit() + 1,
  '대기 주문은 아무것도 얹지 않는다');

set local role service_role;
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 4900) r),
  array['refused', null],
  '낸 금액이 주문과 다르면 승인하지 않고 거절을 돌려준다 — 던지지 않는다');
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 4900, 'dev-evt-0000') r),
  array['refused', null],
  '금액이 다른 알림도 거절을 돌려준다');
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 4900, 'dev-evt-0000') r),
  array['refused', null],
  '같은 거절 알림이 다시 와도 처음의 결과 그대로다');

reset role;
select is(
  (select array_agg(e.outcome || ':' || e.amount order by e.id) from public.payment_event e
   where e.provider_event_id = 'dev-evt-0000'),
  array['refused:4900'],
  '거절한 알림은 되감기지 않고 한 줄로 남는다 — 두 번 와도 한 줄');
select is(
  (select array[o.status, (select count(*)::text from public.reading_bundle b where b.order_id = o.id)]
   from public.reading_order o where o.id = (select order_id from ord)),
  array['pending', '0'],
  '거절은 주문을 움직이지 않고 묶음도 세우지 않는다');
set local role service_role;

create temporary table bought as
select r.bundle_id
from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 12900, 'dev-evt-0001') r;
grant select on bought to authenticated, service_role;

select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 12900, 'dev-evt-0001') r),
  array['applied', (select bundle_id::text from bought)],
  '같은 알림이 두 번 와도 묶음은 하나다');
select is(
  (select r.bundle_id from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 12900) r),
  (select bundle_id from bought),
  '같은 거래 번호로 다시 와도 묶음은 하나다');
select is(
  (select array[r.outcome, r.bundle_id::text]
   from public.approve_reading_order((select order_id from ord), 'dev-pay-0001', 4900, 'dev-evt-0000') r),
  array['refused', null],
  '승인 뒤에 그 거절 알림이 다시 와도 거절 그대로다 — 묶음 id 를 내주지 않는다');
select throws_ok(
  format($$select public.approve_reading_order(%L, 'dev-pay-9999', 12900)$$, (select order_id from ord)),
  '55000', null, '승인된 주문에 다른 거래가 붙지 않는다');

reset role;
select is(
  (select array[(select count(*)::integer from public.reading_bundle where order_id = (select order_id from ord)),
                (select count(*)::integer from public.payment_event where provider_event_id = 'dev-evt-0001')]),
  array[1, 1],
  '묶음 하나 · 알림 한 줄');

set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select array[credit_limit, used, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit() + 1 + 3, 4, tests.reading_credit_limit() + 1 + 3 - 4],
  '산 몫이 한도 위에 얹혀 잔액에 선다');

create temporary table runs as
select pg_temp.burn((select unc from kin), 'ledger-run-0005') as fifth;
grant select, update on runs to authenticated, service_role;

select is(pg_temp.use_of_run((select fifth from runs)), 'free:confirmed', '다섯째도 무료 몫이다');

alter table runs add column sixth uuid;
update runs set sixth = pg_temp.burn((select mom from kin), 'ledger-run-0006');
select is(pg_temp.use_of_run((select sixth from runs)), 'grant:confirmed', '무료를 다 쓰면 예외 몫이다');

alter table runs add column seventh uuid;
update runs set seventh = (select run_id from public.start_reading_run('person', 'ledger-run-0007', (select dad from kin)));
select is(pg_temp.use_of_run((select seventh from runs)), 'bundle:reserved', '그다음은 묶음이다 — 도는 동안 예약');

-- 닫는 문은 열쇠의 것이다(ADR 0120)
reset role;
select public.fail_reading_job((select seventh from runs), 'provider_error');
set local role authenticated;
select is(pg_temp.use_of_run((select seventh from runs)), 'bundle:released', '실패하면 풀린다');

select pg_temp.acting((select kim from folks));
select count(*) from public.my_discovery_board();

create temporary table asked as
select public.request_match((select lee from folks)) as to_lee;
grant select, update on asked to authenticated, service_role;

select is(pg_temp.use_of_request((select to_lee from asked)), 'bundle:reserved', '인연 요청도 묶음에서 예약한다');

select pg_temp.acting((select lee from folks));
select public.respond_to_match_request((select to_lee from asked), false);
select is(pg_temp.use_of_request((select to_lee from asked)), 'bundle:released', '거절되면 풀린다');

select pg_temp.acting((select kim from folks));
alter table asked add column to_park uuid;
update asked set to_park = public.request_match((select park from folks));

reset role;
create temporary table held as
select u.id from public.reading_credit_use u where u.request_id = (select to_park from asked);
grant select on held to authenticated, service_role;

set local role authenticated;
select pg_temp.acting((select park from folks));
select is(public.respond_to_match_request((select to_park from asked), true), 'accepted', '박이 수락한다');

reset role;
select is(
  (select u.id::text || ':' || u.share || ':' || u.state || ':' || (u.run_id is not null)::text
   from public.reading_credit_use u where u.request_id = (select to_park from asked)),
  (select id::text from held) || ':bundle:reserved:true',
  '수락이 연 시도는 요청의 예약을 그대로 이어 받는다 — 새 몫을 고르지 않는다');

select pg_temp.save((select u.run_id from public.reading_credit_use u where u.request_id = (select to_park from asked)));
select is(pg_temp.use_of_request((select to_park from asked)), 'bundle:confirmed', '궁합이 서면 확정이다');

/** 유효시간을 넘긴 시도 — 셈은 이미 안 세는데 행은 running 이다. 장부는 다음 고름 때 정리한다 */
insert into public.reading_run (user_id, kind, person_a, idempotency_key, created_at)
values ((select kim from folks), 'person', (select sis from kin), 'ledger-run-stale', now() - interval '1 day');
select is(
  pg_temp.use_of_run((select id from public.reading_run where idempotency_key = 'ledger-run-stale')),
  'bundle:reserved', '끊긴 시도도 설 때는 예약이다');
select public.settle_reading_credit_uses((select kim from folks));
select is(
  pg_temp.use_of_run((select id from public.reading_run where idempotency_key = 'ledger-run-stale')),
  'bundle:released', '유효시간을 넘기면 정리가 푼다 — 셈과 같은 물음이다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
alter table runs add column eighth uuid;
update runs set eighth = (select run_id from public.start_reading_run('person', 'ledger-run-0008', (select bro from kin)));
select is(pg_temp.use_of_run((select eighth from runs)), 'bundle:reserved', '여덟째가 묶음에서 예약 중이다');

-- ── 4. 환불은 안 쓴 것만 ────────────────────────────────────────────────────

select pg_temp.acting((select op from folks));
create temporary table basis as
select * from public.operator_reading_refund_basis((select order_id from ord));
grant select on basis to authenticated, service_role;

select is(
  (select array[credits, used, reserved, unused, amount, refunded_amount] from basis where asked),
  array[3, 1, 1, 1, 12900, 0],
  '환불 셈의 입력 — 산 셋 · 쓴 하나 · 예약 중 하나 · 안 쓴 하나 · 결제 금액');
select ok((select approved_at is not null and provider_payment_id = 'dev-pay-0001' from basis where asked),
  '결제 시각과 거래 번호가 함께 온다');

reset role;
select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select op from folks) and a.action = 'credits.refund_basis'
     and a.filter_summary = 'order=' || (select order_id from ord) and a.outcome = 'allowed'),
  1,
  '운영자가 환불 셈을 읽은 것이 접속기록에 남는다');

set local role service_role;
select throws_ok(
  format($$select public.refund_reading_order(%L, 8000, 2, 'unused', 'dev-refund-0001')$$, (select order_id from ord)),
  '22023', null, '예약 중인 몫은 풀릴 때까지 걷지 못한다 — 안 쓴 하나를 넘는다');
select is(
  public.refund_reading_order((select order_id from ord), 4900, 1, 'unused', 'dev-refund-0001'),
  'partially_refunded',
  '안 쓴 하나를 걷고 일부를 돌려준다');
select is(
  public.refund_reading_order((select order_id from ord), 4900, 1, 'unused', 'dev-refund-0001'),
  'partially_refunded',
  '같은 환불 번호로 다시 와도 한 번만 적힌다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 9000, 0, 'other')$$, (select order_id from ord)),
  '22023', null, '낸 것보다 많이 돌려주지 못한다');

reset role;
select is(
  (select array[b.refunded_credits, o.refunded_amount, (select count(*)::integer from public.reading_order_refund f where f.order_id = o.id)]
   from public.reading_bundle b join public.reading_order o on o.id = b.order_id
   where o.id = (select order_id from ord)),
  array[1, 4900, 1],
  '걷은 회차 · 돌려준 금액 · 환불 한 줄');
select is(
  public.reading_credit_limit_for((select kim from folks)),
  tests.reading_credit_limit() + 1 + 3 - 1,
  '걷은 회차만큼 한도가 준다');

select throws_ok(
  format($$update public.reading_order set status = 'pending' where id = %L$$, (select order_id from ord)),
  '55000', null, '주문은 뒤로 가지 않는다');
select throws_ok(
  format($$update public.reading_credit_use set state = 'released', released_at = now(), confirmed_at = null
           where run_id = %L$$, (select fifth from runs)),
  '55000', null, '확정된 쓰임은 풀리지 않는다');

-- ── 5. 두 문은 같은 자물쇠 안에서 센다 ──────────────────────────────────────

/**
 * 한 세션으로는 나란히 부르는 둘을 못 만든다. 대신 **셈하는 순간 그 사람의 자물쇠를 쥐고 있는가**를 잰다 —
 * 셈 함수를 이 트랜잭션 안에서만 감싸 그 순간을 적는다. 인연 요청이 셈 뒤에야(트리거에서) 자물쇠를 잡으면
 * 풀이 시작과 나란히 마지막 한 번을 읽고 둘 다 지나간다. 최는 이 트랜잭션에서 아직 아무 자물쇠도 안 잡았다.
 */
create temporary table lock_seen (actor uuid, held boolean);
grant insert, select on lock_seen to authenticated;

alter function public.reading_credits_used(uuid) rename to reading_credits_used_real;
create function public.reading_credits_used(p_actor uuid)
returns table (used integer, reserved integer, requested integer)
language plpgsql volatile security definer set search_path = '' as $$
begin
  insert into pg_temp.lock_seen values (p_actor, exists (
    select 1 from pg_catalog.pg_locks l
    where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
      and ((l.classid::bigint << 32) | l.objid::bigint)
          = pg_catalog.hashtext('reading:user:' || p_actor::text)::bigint));
  return query select * from public.reading_credits_used_real(p_actor);
end;
$$;

set local role authenticated;
select pg_temp.acting((select choi from folks));
select count(*) from public.my_discovery_board();
select public.request_match((select lee from folks));

reset role;
select is(
  (select array_agg(held) from lock_seen where actor = (select choi from folks)),
  array[true],
  '인연 요청은 셈하는 순간 풀이 시작과 같은 자물쇠를 쥐고 있다');

-- ── 6. 떠나면 ──────────────────────────────────────────────────────────────

delete from auth.users where id = (select kim from folks);

select is(
  (select array[k.amount, k.refunded_amount, (k.bundle ->> 'credits')::integer,
                jsonb_array_length(k.bundle -> 'uses'), jsonb_array_length(k.refunds),
                jsonb_array_length(k.events)]
   from retention.reading_payment k where k.order_id = (select order_id from ord)),
  array[12900, 4900, 3, 5, 1, 2],
  '떠나면 결제 · 묶음 · 쓰임 · 환불 · 알림이 따로 옮겨진다');
select is(
  (select array_agg((e ->> 'provider_event_id') || ':' || (e ->> 'outcome') order by e ->> 'received_at')
   from retention.reading_payment k, jsonb_array_elements(k.events) e
   where k.order_id = (select order_id from ord)),
  array['dev-evt-0000:refused', 'dev-evt-0001:applied'],
  '거절한 알림도 결과째 옮겨진다');
select ok(
  (select k.keep_until = k.last_refunded_at + interval '5 years'
   from retention.reading_payment k where k.order_id = (select order_id from ord)),
  '마지막 결제 사건부터 5년 둔다');
select is(
  (select count(*)::integer from public.reading_order where user_id = (select kim from folks))
  + (select count(*)::integer from public.reading_credit_use where user_id = (select kim from folks)),
  0,
  '일반 표에는 떠난 사람의 주문도 쓰임도 안 남는다');
select throws_ok(
  format($$update retention.reading_payment set amount = 1 where order_id = %L$$, (select order_id from ord)),
  '55000', null, '옮긴 기록은 고치지 못한다');

update retention.reading_payment set hold_reason = '시험 — 분쟁 중', held_at = now()
where order_id = (select order_id from ord);
insert into retention.reading_payment (
  order_id, user_id, provider, provider_order_id, provider_payment_id, bundle_credits, amount, currency,
  status, refunded_amount, ordered_at, approved_at, bundle, keep_until)
values (gen_random_uuid(), gen_random_uuid(), 'dev', 'old-order', 'old-pay', 1, 4900, 'KRW',
        'approved', 0, now() - interval '6 years', now() - interval '6 years', '{}'::jsonb,
        now() - interval '1 year');
select is(
  (select array[retention.purge_expired_payments(),
                (select count(*)::integer from retention.reading_payment where order_id = (select order_id from ord))]),
  array[1, 1],
  '5년이 지난 줄은 지우고 보류가 걸린 줄은 남긴다');

-- ── 7. 무료 · 유료가 함께 있을 때의 순서 ─────────────────────────────────────

/**
 * 운영자 요구(2026-10-16): 가입 무료분 → 운영자 무상 지급분(grant) → 먼저 산 묶음. 풀이 시작과 인연 요청이
 * 같은 순서로 예약하고, 실패 · 거절로 풀리면 그 출처로 돌아간다. 3 절은 묶음 하나와 무료를 다 쓴 뒤의 차례를
 * 잰다 — 여기는 **처음부터 묶음 둘을 쥔 사람**이 무료를 쓰는 동안 묶음이 안 줄고, 풀린 무료 · 예외 자리가
 * 묶음보다 먼저 돌아오며, 묶음 둘 사이는 산 때가 이른 쪽부터인지를 잰다.
 *
 * 승인 문은 한 트랜잭션 안에서 묶음 둘에 같은 `acquired_at` 을 준다. 그래서 **id 가 큰 쪽**을 하루 앞으로
 * 당겨 「먼저 산 묶음」으로 삼는다 — id 로만 고르면 붉다. 묶음은 걷은 회차만 늘 수 있어(`reading_bundle_moves`)
 * 이 한 줄 동안만 그 트리거를 끈다.
 */
create temporary table pair (
  jung uuid, han uuid, me uuid, early uuid, late uuid, early_order uuid, late_order uuid, early_no text, late_no text);
grant select, update on pair to authenticated, service_role;

insert into pair (jung, han)
select pg_temp.participant('jung-ledger@example.com', '정장', pg_temp.summary(4, 4, 0, 0, 0)),
       pg_temp.participant('han-ledger@example.com', '한장', pg_temp.summary(0, 0, 4, 4, 0));

insert into public.reading_credit_grant (user_id, extra, note)
values ((select jung from pair), 1, '시험 — 풀린 예외 자리가 묶음보다 먼저 돌아오는지 잰다');

set local role authenticated;
select pg_temp.acting((select jung from pair));
update pair set me = public.create_managed_person('동생', null, 'solar', '1994-04-04', '1994-04-04', '09:30',
  'male', '수원', 'jo', 'localMean', tests.chart(), 'chart-for-tests');
update pair set early_order = (select order_id from public.open_reading_order(3, 'dev', 'ledger-order-0101')),
                late_order = (select order_id from public.open_reading_order(3, 'dev', 'ledger-order-0102'));

set local role service_role;
select public.approve_reading_order((select early_order from pair), 'dev-pay-0101', 12900, 'dev-evt-0101');
select public.approve_reading_order((select late_order from pair), 'dev-pay-0102', 12900, 'dev-evt-0102');

reset role;
/** id 가 큰 묶음을 먼저 산 것으로 — 이름도 그쪽으로 맞춘다 */
update pair p set
  early = (select b.id from public.reading_bundle b where b.user_id = p.jung order by b.id desc limit 1),
  late = (select b.id from public.reading_bundle b where b.user_id = p.jung order by b.id asc limit 1),
  early_order = (select b.order_id from public.reading_bundle b where b.user_id = p.jung order by b.id desc limit 1),
  late_order = (select b.order_id from public.reading_bundle b where b.user_id = p.jung order by b.id asc limit 1);
update pair p set
  early_no = (select o.provider_order_id from public.reading_order o where o.id = p.early_order),
  late_no = (select o.provider_order_id from public.reading_order o where o.id = p.late_order);
alter table public.reading_bundle disable trigger reading_bundle_moves;
update public.reading_bundle set acquired_at = now() - interval '1 day' where id = (select early from pair);
alter table public.reading_bundle enable trigger reading_bundle_moves;

/** 그 시도 · 요청이 든 묶음 — 먼저 산 것 · 나중 산 것 · 묶음 아님 */
create or replace function pg_temp.bundle_of_run(run uuid)
returns text language sql security definer as $$
  select case u.bundle_id when p.early then 'early' when p.late then 'late' else u.share end
  from public.reading_credit_use u, pg_temp.pair p where u.run_id = run
$$;

/** 묶음 둘의 안 쓴 회차 — 운영자 환불 셈 · 산 사람의 결제 내역 · 환불 문이 각자 센다 */
create or replace function pg_temp.unused_by_basis()
returns integer[] language plpgsql as $$
declare seen integer[];
begin
  perform pg_temp.acting((select op from pg_temp.folks));
  select array[(select unused from public.operator_reading_refund_basis((select early_order from pg_temp.pair)) where asked),
               (select unused from public.operator_reading_refund_basis((select late_order from pg_temp.pair)) where asked)]
  into seen;
  perform pg_temp.acting((select jung from pg_temp.pair));
  return seen;
end;
$$;

create or replace function pg_temp.remaining_by_history()
returns integer[] language sql as $$
  select array[(select h.remaining from public.my_reading_orders() h where h.provider_order_id = p.early_no),
               (select h.remaining from public.my_reading_orders() h where h.provider_order_id = p.late_no)]
  from pg_temp.pair p
$$;

create temporary table steps (label text, run_id uuid, request_id uuid);
grant select, insert on steps to authenticated, service_role;

set local role authenticated;
select pg_temp.acting((select jung from pair));

insert into steps
select 'free-' || n, pg_temp.burn((select me from pair), 'ledger-run-01' || lpad(n::text, 2, '0')), null
from generate_series(1, tests.reading_credit_limit() - 1) n;

select is(
  (select array_agg(distinct pg_temp.use_of_run(s.run_id)) from steps s where s.label like 'free-%'),
  array['free:confirmed'],
  '묶음 둘을 먼저 사 두었어도 무료 몫부터 쓴다');

select count(*) from public.my_discovery_board();
insert into steps (label, request_id) values ('ask-han', public.request_match((select han from pair)));
select is(pg_temp.use_of_request((select request_id from steps where label = 'ask-han')), 'free:reserved',
  '무료가 남아 있으면 인연 요청도 무료에서 예약한다');

select is(pg_temp.unused_by_basis(), array[3, 3], '무료로 예약하는 동안 두 묶음의 환불 셈은 그대로다');

select pg_temp.acting((select han from pair));
select public.respond_to_match_request((select request_id from steps where label = 'ask-han'), false);
select is(pg_temp.use_of_request((select request_id from steps where label = 'ask-han')), 'free:released',
  '거절되면 무료 예약이 풀린다');

select pg_temp.acting((select jung from pair));
insert into steps (label, run_id)
select 'after-refusal', run_id from public.start_reading_run('person', 'ledger-run-0150', (select me from pair));
select is(pg_temp.use_of_run((select run_id from steps where label = 'after-refusal')), 'free:reserved',
  '거절로 풀린 무료 자리가 돌아온다 — 묶음에서 먼저 빼지 않는다');

reset role;
select public.fail_reading_job((select run_id from steps where label = 'after-refusal'), 'provider_error');
set local role authenticated;
select pg_temp.acting((select jung from pair));
select is(pg_temp.use_of_run((select run_id from steps where label = 'after-refusal')), 'free:released',
  '무료로 예약한 풀이가 실패하면 풀린다');

insert into steps select 'after-failure', pg_temp.burn((select me from pair), 'ledger-run-0151'), null;
select is(pg_temp.use_of_run((select run_id from steps where label = 'after-failure')), 'free:confirmed',
  '실패로 풀린 무료 자리가 돌아온다 — 산 묶음이 있어도');

reset role;
select is(
  (select array[count(*) filter (where u.share = 'free'), count(*) filter (where u.share <> 'free')]::integer[]
   from public.reading_credit_use u where u.user_id = (select jung from pair) and u.state <> 'released'),
  array[tests.reading_credit_limit(), 0],
  '무료를 다 쓸 때까지 예외 · 묶음 몫은 하나도 안 잡혔다');

set local role authenticated;
select pg_temp.acting((select jung from pair));
select is(pg_temp.unused_by_basis(), array[3, 3], '무료를 다 쓴 때에도 운영자 환불 셈의 안 쓴 회차는 셋 · 셋이다');
select is(pg_temp.remaining_by_history(), array[3, 3], '산 사람의 결제 내역도 남은 회차 셋 · 셋이다');

set local role service_role;
select throws_ok(
  format($$select public.refund_reading_order(%L, 100, 4, 'unused')$$, (select early_order from pair)),
  '22023', 'reading_order: only unused credits are taken back (3 left)',
  '환불 문도 먼저 산 묶음의 안 쓴 것을 셋으로 센다');
select throws_ok(
  format($$select public.refund_reading_order(%L, 100, 4, 'unused')$$, (select late_order from pair)),
  '22023', 'reading_order: only unused credits are taken back (3 left)',
  '나중 산 묶음도 셋이다');

set local role authenticated;
select pg_temp.acting((select jung from pair));
insert into steps (label, run_id)
select 'grant-held', run_id from public.start_reading_run('person', 'ledger-run-0152', (select me from pair));
select is(pg_temp.use_of_run((select run_id from steps where label = 'grant-held')), 'grant:reserved',
  '무료를 다 쓰면 예외 몫에서 예약한다');

reset role;
select public.fail_reading_job((select run_id from steps where label = 'grant-held'), 'provider_error');
set local role authenticated;
select pg_temp.acting((select jung from pair));
insert into steps select 'grant-back', pg_temp.burn((select me from pair), 'ledger-run-0153'), null;
select is(pg_temp.use_of_run((select run_id from steps where label = 'grant-back')), 'grant:confirmed',
  '실패로 풀린 예외 자리가 돌아온다 — 묶음에서 먼저 빼지 않는다');

insert into steps
select 'bundle-' || n, pg_temp.burn((select me from pair), 'ledger-run-016' || n), null
from generate_series(1, 4) n;
select is(
  (select array_agg(pg_temp.bundle_of_run(s.run_id) order by s.label) from steps s where s.label like 'bundle-%'),
  array['early', 'early', 'early', 'late'],
  '묶음 둘이면 먼저 산 묶음을 다 쓴 뒤에 다음 묶음으로 간다');

select is(pg_temp.unused_by_basis(), array[0, 2], '묶음에서 쓴 만큼만 그 묶음의 환불 셈이 준다');

select * from finish();
rollback;
