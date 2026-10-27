-- 자기소개는 500자까지 (`20270101090000`, 운영자 결정 2026-10-27)
--
-- 앱의 상한 `INTRO_MAX` 와 DB 의 두 자리(검사식 · `save_my_profile`)가 같은 수를 말하는지 잰다. 쓰는 문으로 500자는 들고 501자는 거절되며,
-- 문을 거치지 않은 쓰기도 검사식이 막는다. 옛 이름의 검사식(`intro_fits_in_three_hundred`)은 없다.
begin;
select plan(6);

create temporary table who as
select tests.signup('intro500@example.com') as me;
grant select on who to authenticated;

select is(
  (select count(*)::int from pg_constraint
    where conrelid = 'public.app_user'::regclass and conname = 'intro_fits_in_three_hundred'),
  0,
  '1. 300자 검사식은 없다');

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
    where conrelid = 'public.app_user'::regclass and conname = 'intro_fits_in_five_hundred'),
  'CHECK (((intro IS NULL) OR ((length(btrim(intro)) >= 1) AND (length(btrim(intro)) <= 500))))',
  '2. 검사식은 1~500자');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select me from who)), true);

select lives_ok(
  $$select public.save_my_profile('소개쓴이', repeat('가', 500))$$,
  '3. 500자 소개는 저장된다');

select throws_ok(
  $$select public.save_my_profile('소개쓴이', repeat('가', 501))$$,
  '22023', '소개는 500자까지입니다.',
  '4. 501자는 쓰는 문이 거절한다 — 그 수를 말한다');

reset role;

select is(
  (select length(intro) from public.app_user where id = (select me from who)),
  500,
  '5. 저장된 소개는 500자 그대로다');

select throws_ok(
  $$update public.app_user set intro = repeat('가', 501) where id = (select me from who)$$,
  '23514', null,
  '6. 문을 거치지 않은 501자도 검사식이 막는다');

select * from finish();
rollback;
