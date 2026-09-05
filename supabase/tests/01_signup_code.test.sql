-- 가입은 **한 문**이고, 그 문을 여는 것은 코드다 (ADR 0042).
--
-- 여기서 재는 것 다섯.
--
-- 1. **코드가 실제로 문이다.** 없는 코드·지난 코드·정원 찬 코드는 못 지난다.
-- 2. **한 번에 적힌다.** 코드·이름·안내 확인·선택 답이 한 트랜잭션에 남는다 —
--    갈라 적히면 그 사이에서 멈춘 계정이 생기고, 관문이 그런 사람을 어디로 보낼지
--    다시 정해야 한다.
-- 3. **미완성 계정은 아무것도 못 쓴다.** 되돌릴 수 없는 첫 쓰기 둘이 거절한다 —
--    화면만 막으면 RPC 로 지나가고, 그 상태는 이제 실재한다.
-- 4. **코드는 한 사람에게 한 번만 쓰인다.** 안내가 바뀌어 다시 지나도 두 번 안 센다.
-- 5. **명단은 안 보인다.** 살아 있는 코드가 열려 있으면 그것을 퍼뜨릴 수 있고,
--    그 순간 정원이 뜻을 잃는다.
begin;
select plan(20);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 일정이 있어야 확인이 남는다 — 안내가 만들어질 수 없으면 가입도 못 한다 */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
select '2026-10-31', '시험', '운영자', '담당', 'ops@example.com'
where not exists (select 1 from public.beta_schedule);

insert into public.signup_code (code, note, valid_on, max_uses) values
  ('TODAY1', '오늘 두 명', public.signup_today(), 2),
  ('YESTER', '어제 것', public.signup_today() - 1, 10),
  ('FULL01', '정원 하나', public.signup_today(), 1);

create temporary table folks as
select tests.signup_raw('kim-code@example.com') as kim,
       tests.signup_raw('lee-code@example.com') as lee,
       tests.signup_raw('park-code@example.com') as park,
       tests.signup_raw('choi-code@example.com') as choi;
grant select on folks to authenticated, service_role;

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$
  select s.schedule_id from public.current_beta_schedule() s
$$;

set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 1. 코드가 문이다 ────────────────────────────────────────────────────────

select is(
  (select a.signed_up_at from public.app_user a where a.id = (select kim from folks)),
  null,
  '구글 로그인만 한 사람은 가입이 안 끝난 상태다');

select throws_like(
  $$select public.complete_signup(null, '민수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%테스트 코드%',
  '코드 없이는 못 지난다');

select throws_like(
  $$select public.complete_signup('NOSUCH', '민수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%지금 쓸 수 있는 코드%',
  '없는 코드는 거절된다');

/**
 * **어제 코드와 없는 코드가 같은 문장이다.** 갈라 말하면 「그런 코드는 있는데 어제
 * 것」이 되고, 그것은 코드 하나를 맞혔다는 답이다.
 */
select throws_like(
  $$select public.complete_signup('YESTER', '민수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%지금 쓸 수 있는 코드%',
  '어제 코드는 오늘 안 열린다');

select throws_like(
  $$select public.complete_signup('TODAY1', '가', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%2~8자%',
  '이름이 짧으면 거절된다');

/** 그 사이에 운영자가 일정을 옮겼으면 지금 약속에 대한 확인이 아니다 */
select throws_like(
  $$select public.complete_signup('TODAY1', '민수', 'notice-v9', pg_temp.schedule_id() + 1, false, false)$$,
  '%안내가 바뀌%',
  '본 줄이 다르면 거절된다');

-- ── 2. 한 번에 적힌다 ──────────────────────────────────────────────────────

select lives_ok(
  $$select public.complete_signup('TODAY1', '민수', 'notice-v9', pg_temp.schedule_id(), true, false)$$,
  '코드·이름·확인이 한 번에 지나간다');

select results_eq(
  $$select a.nickname, a.signup_code, a.notice_version, a.improvement_consent, a.contact_consent,
           a.signed_up_at is not null, a.notice_ack_at is not null
    from public.app_user a where a.id = (select kim from folks)$$,
  $$values ('민수'::text, 'TODAY1'::text, 'notice-v9'::text, true, false, true, true)$$,
  '다섯 칸이 한 트랜잭션에 함께 남는다');

select is(
  (select a.notice_ends_on from public.app_user a where a.id = (select kim from folks)),
  '2026-10-31'::date,
  '본 종료일도 함께 남는다 — 일정이 움직이면 다시 물어야 하므로');

-- ── 3. 이름은 유일하다 ────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

select throws_like(
  $$select public.complete_signup('TODAY1', '민수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%이미 쓰고 있는%',
  '같은 이름으로는 못 들어온다');

select lives_ok(
  $$select public.complete_signup('todAy1', '영희', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '코드는 대소문자로 갈리지 않는다');

-- ── 4. 정원 ───────────────────────────────────────────────────────────────

select pg_temp.acting((select park from folks));

/** `TODAY1` 은 둘이 정원이고 둘이 들어왔다 */
select throws_like(
  $$select public.complete_signup('TODAY1', '철수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '%정원이 찼%',
  '정원을 넘으면 거절된다');

select lives_ok(
  $$select public.complete_signup('FULL01', '철수', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '다른 코드에는 자리가 있다');

-- ── 5. 미완성 계정은 아무것도 못 쓴다 ──────────────────────────────────────

select pg_temp.acting((select choi from folks));

select throws_like(
  $$select public.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30',
      'male', '서울', 'jo', 'localMean')$$,
  '%가입을 먼저%',
  '가입을 안 끝냈으면 내 사주를 못 넣는다');

/**
 * **이 문은 안내를 한 번도 안 물었다.** 화면 관문이 `/me` 를 지키니 닿을 수 없다고
 * 여겼지만, RPC 는 로그인한 사람이 브라우저에서 그대로 부를 수 있다 — 남의 생년월일시가
 * 들어오는 문이 가입도 안 끝난 계정에게 열려 있었다.
 */
select throws_like(
  $$select public.create_managed_person('어머니', null, 'solar', '1965-03-02', '1965-03-02',
      '09:00', 'female', '서울', 'jo', 'localMean')$$,
  '%가입을 먼저%',
  '가입을 안 끝냈으면 남의 사주도 못 넣는다');

-- ── 6. 다시 지나도 코드는 한 번만 ─────────────────────────────────────────

select pg_temp.acting((select kim from folks));

/**
 * 안내가 새 판본이 되면 이미 가입한 사람도 이 문으로 돌아온다. 그때 코드를 다시 물으면
 * 두 번째 코드를 어디서 구하라는 말이 된다.
 */
select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v10', pg_temp.schedule_id(), false, true)$$,
  '이미 가진 사람은 코드도 이름도 없이 다시 확인만 한다');

select results_eq(
  $$select a.nickname, a.signup_code, a.notice_version, a.contact_consent
    from public.app_user a where a.id = (select kim from folks)$$,
  $$values ('민수'::text, 'TODAY1'::text, 'notice-v10'::text, true)$$,
  '이름과 코드는 그대로이고 확인만 새로 남는다');

/**
 * 두 번 세면 `TODAY1` 이 셋이 되고, 정원이 뜻을 잃는다.
 *
 * **역할을 내려놓고 센다.** `app_user` 는 자기 행만 내주므로, `authenticated` 인 채로
 * 세면 언제나 하나가 나온다 — 그 하나는 정원과 아무 상관이 없는 수다.
 */
reset role;
select is(
  (select count(*)::integer from public.app_user a where a.signup_code = 'TODAY1'),
  2,
  '다시 지나도 그 코드를 쓴 사람은 늘지 않는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 7. 명단은 안 보인다 ───────────────────────────────────────────────────

select throws_ok(
  'select * from public.signup_code',
  42501,
  null,
  '로그인한 사람도 코드 표는 못 읽는다');

select throws_ok(
  'select public.signup_today()',
  42501,
  null,
  '오늘을 묻는 문도 닫혀 있다');

select * from finish();
rollback;
