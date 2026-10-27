-- 자기소개의 최대 길이를 300자에서 500자로 넓힌다 (운영자 결정 2026-10-27)
--
-- 운영자가 상대 프로필 시트의 넓은 화면 두 열을 보며 소개 최대를 500자로 늘렸다 — 넘치는 소개는 그 열 안에서 스크롤한다(ADR 0155
-- 「2026-10-27 덧」). 앱의 상한은 `INTRO_MAX`(`src/lib/profile/index.ts`)다. DB 에는 같은 상한이 두 자리에 산다:
--
-- - **표의 검사식** `app_user.intro_fits_in_three_hundred`(`20260909120000_the_name_is_made_at_signup.sql`) — 지우고
--   `intro_fits_in_five_hundred` 로 다시 건다. 넓히는 것이라 지금 있는 행은 모두 통과한다. 옛 `discovery_profile.intro` 의 검사식은 그
--   표와 함께 이미 없다(살아 있는 `pg_constraint` 에서 `intro` 를 드는 것은 이 하나뿐이다, 로컬 2026-10-27).
-- - **쓰는 문** `save_my_profile` 의 「소개는 300자까지입니다.」 — 본문은 저장소의 마지막 정의(`20261105090000_the_refusal_says_what_to_do_next.sql`)
--   를 그대로 옮기고 그 두 자리(숫자 · 문장)만 바꿨다. 그 정의는 로컬의 살아 있는 정의(`pg_get_functiondef`)와 글자까지 같고, 그 뒤로 이 함수를
--   다시 적은 마이그레이션은 없다. `create or replace` 라 권한과 주석도 남는다.
--
-- **넓히기라 옛 앱에 안전하다** — 옛 앱은 300자까지만 보낸다. 새 앱(500자)은 이 마이그레이션 뒤에 나가야 한다 — 먼저 나가면 301~500자 저장이
-- 막힌다(`docs/ops/runbook/deploy.md` 규약 넷).
--
-- 재는 자리는 `supabase/tests/99_intro_holds_five_hundred.test.sql`.

alter table public.app_user drop constraint intro_fits_in_three_hundred;

alter table public.app_user add constraint intro_fits_in_five_hundred
  check (intro is null or length(btrim(intro)) between 1 and 500);

CREATE OR REPLACE FUNCTION public.save_my_profile(p_nickname text, p_intro text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
  about text := nullif(btrim(coalesce(p_intro, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  if about is not null and length(about) > 500 then
    raise exception '소개는 500자까지입니다.' using errcode = '22023';
  end if;

  /*
    **먼저 묻고, 그래도 인덱스가 막게 둔다.** 물어보는 것과 쓰는 것 사이에 남이 같은
    이름을 채 갈 수 있다. 그 좁은 틈에서 나오는 것은 여전히 제약 위반 문장이라, 그
    자리도 같은 말로 받아 낸다.
  */
  if exists (
    select 1 from public.app_user u
    where u.id <> actor
      and public.nickname_key(u.nickname) = public.nickname_key(name)
  ) then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
  end if;

  update public.app_user
  set nickname = name, intro = about
  where id = actor;

exception
  when unique_violation then
    raise exception '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해 주세요.' using errcode = '23505';
end;
$function$
;
