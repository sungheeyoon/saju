-- 가입과 로그인 거절 — **DB 가 던지는 문장이 상황과 다음 행동을 말한다** (`20261105090000`, 운영자 확정 2026-09-30)
--
-- 앱은 우리 한국어 문장을 그대로 화면에 세운다(`app/db-error.ts`). 그래서 DB 가 던지는 문장이 곧 사람이 읽는 문장이다.
--
--   1. **옛 문장을 던지는 함수가 없다** — 살아 있는 정의(`pg_proc.prosrc`)를 센다. 새 함수가 옛 마이그레이션에서
--      본문을 베껴 오면 여기서 빨개진다.
--   2. 대표 거절을 부르면 **새 문장이 선다** — errcode 까지. 틀린 코드 · 가입 멈춤 · 잠금 · 정원은 제 시험이 잰다
--      (`66_signup_code_misses` · `47_review_and_signup_pause` · `01_signup_code`).
begin;
select plan(11);

-- ── 1. 살아 있는 정의 ─────────────────────────────────────────────────────────

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''로그인이 필요합니다.''%'),
  0,
  '1. 「로그인이 필요합니다.」를 던지는 함수는 없다');

select cmp_ok(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.''%'),
  -- 27 이었다 — 그중 옛 문 `clear_my_photo` 를 `20261110090000` 이 걷어 26
  '>=', 26,
  '1. 로그인을 묻는 함수 26개가 새 문장을 든다');

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%''이미 쓰고 있는 닉네임입니다.''%'),
  0,
  '1. 옛 닉네임 중복 문장을 던지는 함수는 없다');

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
          unnest(array[
            '안내 판본을 알 수 없습니다.', '비공개 테스트가 끝났습니다.', '아직 테스트 기간이 정해지지 않았습니다.',
            '안내가 바뀌었습니다.', '계정을 찾지 못했습니다.', '닉네임은 2~8자입니다.', '지금 쓸 수 있는 코드가 아닙니다.',
            '코드를 여러 번 잘못 넣었습니다.', '이 코드는 오늘 정원이 찼습니다.']) as old(sentence)
    where n.nspname = 'public' and p.proname = 'complete_signup' and p.prosrc like '%' || old.sentence || '%'),
  0,
  '1. 가입 함수에 옛 합쇼체 거절이 남지 않았다');

-- ── 2. 부르면 무엇이 서나 ──────────────────────────────────────────────────────

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$
  select s.schedule_id from public.current_beta_schedule() s
$$;

select tests.schedule_beta();

create temporary table folks as
select tests.signup_raw('refusal-kim@example.com') as kim,
       tests.signup_raw('refusal-lee@example.com') as lee;
grant select on folks to authenticated;

update public.app_user set nickname = '이미있음' where id = (select lee from folks);

set local role authenticated;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select public.complete_signup('ANY001', '김새사람', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '28000', '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.',
  '2. 로그인 안 한 사람은 로그인하라는 말을 듣는다');

select pg_temp.acting((select kim from folks));

select throws_ok(
  $$select public.complete_signup('ANY001', '김새사람', '', pg_temp.schedule_id(), false, false)$$,
  '23514', '안내를 확인하지 못했어요. 새로고침한 뒤 다시 확인해 주세요.',
  '2. 판본이 비면 새로고침하라고 한다');

select throws_ok(
  $$select public.complete_signup('ANY001', '김새사람', 'notice-v9', pg_temp.schedule_id() + 1000, false, false)$$,
  '23514', '안내가 바뀌었어요. 새로고침한 뒤 다시 확인해 주세요.',
  '2. 안내가 바뀌었으면 새로고침하라고 한다');

select throws_ok(
  $$select public.complete_signup('ANY001', '김', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '22023', '닉네임을 2~8자로 입력해 주세요.',
  '2. 닉네임 길이는 무엇을 넣을지로 말한다');

select throws_ok(
  $$select public.complete_signup('ANY001', '이미있음', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '23505', '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
  '2. 가입에서 겹친 닉네임');

select throws_ok(
  $$select public.save_my_profile('이미있음', null)$$,
  '23505', '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.',
  '2. 프로필에서 겹친 닉네임도 같은 문장이다');

/** `auth.uid()` 는 있는데 `app_user` 행이 없다 — `auth.users` 가 지워진 뒤 남은 토큰의 자리 */
select pg_temp.acting(gen_random_uuid());
select throws_ok(
  $$select public.complete_signup('ANY001', '김새사람', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  'P0002', '계정을 찾지 못했어요. 다시 로그인해 주세요.',
  '2. 계정 행이 없으면 다시 로그인하라고 한다');

select * from finish();
rollback;
