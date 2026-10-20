-- 운영자가 보는 회원의 잔액은 그 회원이 제 화면에서 보는 잔액과 같다 (`20261214080000`, 운영자 2026-10-17)
--
--   1. **같은 잔액** — 무료만 · 무료 + 운영 지급 · 산 묶음 · 도는 풀이(예약) · 환불 확보 · 풀이 대상을 지운 뒤, 걸음마다
--      `operator_member(그 사람).available` 이 그 사람의 `my_reading_credits().available` 과 같다
--   2. **출처별 장부** — 받은 수 · 확정 쓰임 · 빈자리, 예약 중 · 확보 중. 대상을 지우면 잔액은 돌아오지만 장부의 확정 줄은 남아
--      출처별 빈자리의 합이 잔액보다 작다
--   3. **운영자만** — 안쪽 셈은 아무에게도 안 열리고, 운영자가 아니면 회원 문이 던진다
--
-- 운영자 문이 잔액을 따로 세면(예: 출처별 빈자리를 더하면) 1 의 마지막 걸음이 붉다.
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
  tests.signup('mb-member@example.com') as member,
  tests.signup('mb-stranger@example.com') as stranger,
  tests.signup('mb-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 회원 잔액');
insert into public.reading_sale_reviewer (user_id, note) values ((select member from folks), '시험 — 회원 잔액');

/** 그 사람이 제 화면에서 보는 잔액 — 부르고 나면 운영자로 돌아온다 */
create or replace function pg_temp.mine()
returns integer language plpgsql as $$
declare n integer;
begin
  perform pg_temp.acting((select member from folks));
  select available into n from public.my_reading_credits();
  perform pg_temp.acting((select operator from folks));
  return n;
end;
$$;

/** 운영자가 회원 화면에서 보는 그 사람의 잔액 */
create or replace function pg_temp.theirs()
returns integer language plpgsql as $$
declare n integer;
begin
  perform pg_temp.acting((select operator from folks));
  select available into n from public.operator_member((select member from folks)::text);
  return n;
end;
$$;

create or replace function pg_temp.save(run uuid)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, '## 풀이', null, '한 사람을 한마디로.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 그 사람 이름으로 대상 하나의 풀이를 연다 — `keep` 이면 끝까지 밀어 확정한다 */
create or replace function pg_temp.run(target uuid, key text, keep boolean)
returns uuid language plpgsql as $$
declare started uuid;
begin
  perform pg_temp.acting((select member from folks));
  select run_id into started from public.start_reading_run('person', key, target);
  if keep then
    perform pg_temp.save(started);
  end if;
  perform pg_temp.acting((select operator from folks));
  return started;
end;
$$;

set local role authenticated;
select pg_temp.acting((select member from folks));

create temporary table kin as
select
  public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
    'female', '부산', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as mom,
  public.create_managed_person('아빠', null, 'solar', '1960-11-08', '1960-11-08', '05:40',
    'male', '대구', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as dad,
  public.create_managed_person('누나', null, 'solar', '1988-01-19', '1988-01-19', '22:05',
    'female', '광주', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as sis,
  public.create_managed_person('형', null, 'solar', '1986-07-23', '1986-07-23', '11:15',
    'male', '인천', 'jo', 'localMean', tests.chart(), 'chart-for-tests') as bro;
grant select on kin to authenticated, service_role;

select pg_temp.acting((select operator from folks));

-- ── 1 · 2. 걸음마다 같은 잔액 ────────────────────────────────────────────────

select is(pg_temp.theirs(), pg_temp.mine(), '무료만 — 운영자가 보는 잔액이 본인 화면과 같다');
select is(pg_temp.theirs(), tests.reading_credit_limit(), '…그리고 그 값은 무료 몫 그대로다');

select pg_temp.run((select mom from kin), 'mb-run-0001', true);
select pg_temp.run((select dad from kin), 'mb-run-0002', true);
select results_eq(
  $$select available, free_credits, free_used, free_left from public.operator_member((select member from folks)::text)$$,
  $$values (tests.reading_credit_limit() - 2, tests.reading_credit_limit(), 2, tests.reading_credit_limit() - 2)$$,
  '무료에서 둘을 쓰면 — 잔액과 무료의 빈자리가 함께 준다');

reset role;
insert into public.reading_credit_grant (user_id, extra, note)
values ((select member from folks), 2, '시험 — 운영 지급분이 잔액에 얹힌다');
set local role authenticated;
select is(pg_temp.theirs(), pg_temp.mine(), '무료 + 운영 지급 — 같은 잔액');
select results_eq(
  $$select granted_credits, granted_used, granted_left from public.operator_member((select member from folks)::text)$$,
  $$values (2, 0, 2)$$,
  '운영 지급 둘 — 아직 안 썼다');

select pg_temp.acting((select member from folks));
create temporary table ord (order_id uuid);
grant select, insert on ord to authenticated, service_role;
insert into ord select order_id from public.open_reading_order(3, 'portone', 'mb-order-0001');
set local role service_role;
select public.approve_reading_order((select order_id from ord), 'tx-mb-3', 12900, 'whk-mb-3');
set local role authenticated;
select pg_temp.acting((select operator from folks));
select is(pg_temp.theirs(), pg_temp.mine(), '산 묶음 — 같은 잔액');
select results_eq(
  $$select bought_credits, used_bought, bundle_left from public.operator_member((select member from folks)::text)$$,
  $$values (3, 0, 3)$$,
  '산 셋 — 아직 안 썼다');

select pg_temp.run((select sis from kin), 'mb-run-0003', false);
select is(pg_temp.theirs(), pg_temp.mine(), '도는 풀이가 자리를 잡으면(예약) — 같은 잔액');
select results_eq(
  $$select reserved_all, free_left from public.operator_member((select member from folks)::text)$$,
  $$values (1, tests.reading_credit_limit() - 3)$$,
  '예약 하나 — 무료 몫의 빈자리에서 빠진다');

select lives_ok(
  $$select * from public.operator_hold_reading_refund((select order_id from ord), 1, 'withdrawal', 4300,
                                                      'b0000000-0000-4000-8000-000000000001'::uuid)$$,
  '운영자가 묶음에서 하나를 환불로 확보한다');
select is(pg_temp.theirs(), pg_temp.mine(), '환불 확보 중 — 같은 잔액');
select results_eq(
  $$select held_credits, bundle_left from public.operator_member((select member from folks)::text)$$,
  $$values (1, 2)$$,
  '확보 하나 — 묶음의 빈자리에서 빠진다');

-- 대상을 지우면 셈은 자리를 돌려주고 장부의 확정 줄은 남는다(ADR 0106)
select pg_temp.run((select bro from kin), 'mb-run-0004', true);
reset role;
delete from public.person where id = (select bro from kin);
set local role authenticated;
select is(pg_temp.theirs(), pg_temp.mine(), '풀이 대상을 지운 뒤 — 같은 잔액');
select results_eq(
  $$select available, free_used, free_left + granted_left + bundle_left
    from public.operator_member((select member from folks)::text)$$,
  $$values (tests.reading_credit_limit() + 2 + 2 - 2 - 1, 3, tests.reading_credit_limit() + 2 + 2 - 3 - 1)$$,
  '잔액은 지운 풀이의 자리를 돌려받고, 장부는 확정 줄을 남겨 출처별 빈자리의 합이 하나 작다');

-- ── 3. 운영자만 ──────────────────────────────────────────────────────────────

select pg_temp.acting((select stranger from folks));
select throws_ok(
  format($$select * from public.operator_member(%L)$$, (select member from folks)),
  '42501', null, '운영자가 아니면 남의 잔액을 못 읽는다');
select throws_ok(
  format($$select * from public.reading_credits_for(%L)$$, (select member from folks)),
  '42501', null, '안쪽 셈은 로그인한 사람에게 안 열린다');

reset role;
select is(
  (select array_agg(r order by r) from unnest(array['anon', 'authenticated', 'service_role']) r
   where has_function_privilege(r, 'public.reading_credits_for(uuid)', 'EXECUTE')),
  null,
  '안쪽 셈은 어느 API 역할에도 안 열린다');

select * from finish();
rollback;
