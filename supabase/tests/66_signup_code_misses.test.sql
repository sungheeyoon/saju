-- 틀린 가입 코드는 계정마다 한 시간에 열 번까지다 (`20261101090000`, 결정 대기)
--
-- 여기서 재는 것 넷.
--
-- 1. **틀린 시도가 남는다.** 틀린 코드는 `false` 로 돌아오고 그 한 줄이 되감기지 않는다 — 던지던 때는 셀 길이 없었다
-- 2. **열 번 틀리면 맞는 코드도 안 받는다** — 받으면 열한 번째에 맞히는 것이 그대로 열린다
-- 3. **창이 지나면 다시 열리고, 들어오면 센 것이 걷힌다**
-- 4. **세는 것은 그 계정뿐이고, 표는 아무에게도 안 열려 있다**
--
-- 옛 정의(틀린 코드에 던진다)를 되살리면 1 · 2 가 붉다.
begin;
select plan(10);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

select tests.schedule_beta();

insert into public.signup_code (code, note, valid_on, max_uses) values
  ('MISS01', '틀린 시도 시험', public.signup_today(), 10);

create temporary table folks as
select tests.signup_raw('miss-kim@example.com') as kim,
       tests.signup_raw('miss-lee@example.com') as lee;
grant select on folks to authenticated;

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$
  select s.schedule_id from public.current_beta_schedule() s
$$;

/** 표가 아무에게도 안 열려 있으므로 세는 손잡이를 따로 둔다 */
create or replace function pg_temp.misses(uid uuid)
returns bigint language sql security definer as $$
  select count(*) from public.signup_code_miss m where m.user_id = uid
$$;

set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 1. 틀린 시도가 남는다 ────────────────────────────────────────────────────

select is(
  public.complete_signup('NOPE01', '김틀림', 'notice-v9', pg_temp.schedule_id(), false, false),
  false,
  '1. 틀린 코드는 false 로 돌아온다');

select is(pg_temp.misses((select kim from folks)), 1::bigint, '1. 그 한 번이 남는다');

select is(
  (select signed_up_at from public.app_user where id = (select kim from folks)),
  null,
  '1. 틀린 코드로는 가입이 안 끝난다');

-- ── 2. 열 번이면 맞는 코드도 안 받는다 ──────────────────────────────────────

select public.complete_signup('NOPE' || lpad(i::text, 2, '0'), '김틀림', 'notice-v9', pg_temp.schedule_id(), false, false)
from generate_series(2, 10) as i;

select is(pg_temp.misses((select kim from folks)), 10::bigint, '2. 열 번이 남았다');

select throws_ok(
  $$select public.complete_signup('MISS01', '김틀림', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '42501', '코드를 여러 번 잘못 넣었습니다. 한 시간 뒤에 다시 시도해 주세요.',
  '2. 열 번 틀린 뒤에는 맞는 코드도 막힌다');

-- ── 4. 세는 것은 그 계정뿐 ──────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));
select is(
  public.complete_signup('MISS01', '이맞음', 'notice-v9', pg_temp.schedule_id(), false, false),
  true,
  '4. 다른 계정은 그대로 들어온다');

select throws_ok(
  $$select count(*) from public.signup_code_miss$$,
  '42501', null,
  '4. 틀린 시도 표는 사용자에게 안 열려 있다');

-- ── 3. 창이 지나면 다시 열린다 ──────────────────────────────────────────────

reset role;
update public.signup_code_miss set missed_at = now() - interval '61 minutes'
where user_id = (select kim from folks);
set local role authenticated;

select pg_temp.acting((select kim from folks));
select is(
  public.complete_signup('MISS01', '김틀림', 'notice-v9', pg_temp.schedule_id(), false, false),
  true,
  '3. 한 시간이 지나면 맞는 코드로 들어온다');

select is(pg_temp.misses((select kim from folks)), 0::bigint, '3. 들어오면 센 것이 걷힌다');

reset role;

select ok(
  not has_function_privilege('authenticated', 'public.signup_code_miss_limit()', 'execute'),
  '4. 한도 함수는 사용자가 못 부른다');

select * from finish();
rollback;
