-- 프로필은 가입할 때 만든다 — **이름은 계정의 것이지 인연에 내놓은 것이 아니다**
--
-- PRD §5.1 · §5.2. 이슈 #14.
--
-- ## 무엇이 어긋나 있었나
--
-- 닉네임이 `discovery_profile` 에 살고 있었다. 그 표는 **인연 찾기에 내놓은 것**을 드는
-- 자리다 — 참여를 끄면 오행 요약을 거두고, 애초에 참여하지 않는 사람에게는 행 자체가
-- 없다. 그런데 §5.2 는 「매칭·요청·소식·채팅 어디서나 사람은 닉네임으로 불린다」고
-- 말한다. 앱 전체의 이름이 **참여의 부속물**로 놓여 있으면, 참여하지 않는 사람은 이름이
-- 없는 사람이 되고 소식과 요청 목록은 빈 자리를 이름 자리에 세운다.
--
-- 그래서 자리를 옮긴다. 옮기는 것이 이 파일의 값이다 — 규칙(2~8자·유일)은 옮긴 뒤에
-- 따라오는 것이고, 옮기지 않으면 그 규칙을 어디에 걸어도 참여자에게만 걸린다.
--
-- ## 사진도 같은 결정 안에 있다
--
-- §5.1 은 닉네임·프로필 사진·자기소개를 **한 화면에서 만드는 것**으로 말한다. 셋을 갈라
-- 두면 「프로필을 만든다」가 세 군데에 흩어지고, 그중 하나는 안 만들어진다. 다만 사진은
-- 다른 종류의 자료다 — 얼굴이고, 낯선 사람의 카드에 선다. 그 차이는 아래 `profile_photo`
-- 가 표를 갈라 드는 것으로 적는다.
--
-- ## 바이트를 Postgres 안에 둔다
--
-- 파일 저장소(Storage)에 두면 지우는 일이 둘로 갈린다. ADR 0023 이 정한 것은 **지우는
-- 일이 FK 를 따라간다**는 것이고, 안 매인 것만 `forget_user` 가 손으로 적는다. 그런데
-- Storage 의 파일은 Postgres 밖에 있어서 `forget_user` 가 **지울 수가 없다** — 행만
-- 지우고 파일은 남는다. 「탈퇴하면 사라진다」고 적어 놓고 얼굴만 남는 것이다.
--
-- bytea 로 두면 그 문제가 통째로 없다. 사진은 `app_user` 에 cascade 로 매여 있고,
-- 계정이 사라지면 함께 사라진다. 값은 512KB 상한이다 — 폐쇄 베타의 규모에서 이 선택이
-- 비싸지는 지점은 아직 멀고, 멀어지는 날 표 하나를 옮기면 된다.

-- ---------------------------------------------------------------------------
-- 이름의 열쇠 — **한 자리에서 정한다**
-- ---------------------------------------------------------------------------

/**
 * 두 이름이 같은가를 판정하는 **한 벌**.
 *
 * 유일 인덱스와 「쓸 수 있나」를 묻는 함수와 저장하는 함수가 각자 `lower(btrim(...))` 을
 * 적으면, 셋 중 하나가 안 고쳐지는 날 **확인은 비었다고 하는데 저장은 거절하는** 상태가
 * 만들어진다. 사용자에게는 고장으로만 보인다.
 *
 * 「지영」과 「 지영 」과 「JIYOUNG」과 「jiyoung」 중 뒤의 둘만 같은 이름이다. 대소문자를
 * 접는 것은 라틴 문자에만 뜻이 있지만, 그 자리에서 갈리는 사람이 실제로 생긴다.
 */
create or replace function public.nickname_key(p_nickname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(btrim(p_nickname));
$$;

-- ---------------------------------------------------------------------------
-- 이름을 계정으로 옮긴다
-- ---------------------------------------------------------------------------

alter table public.app_user
  add column nickname text,
  add column intro text;

/*
  **옮기고 나서 규칙을 좁힌다.** 좁힌 뒤에 옮기면 1자·9~12자로 지어 둔 이름들이 이
  마이그레이션 자체를 세우고, 그때 멈추는 자리는 「어느 이름이 문제인가」를 말해 주지
  않는다. 프로덕션에는 참여자가 없어 옮길 이름이 한 줄도 없지만, 그 사실에 기대어 적지
  않는다 — 개발 DB 는 사람마다 다르다.
*/
update public.app_user u
set nickname = p.nickname,
    intro = p.intro
from public.discovery_profile p
where p.user_id = u.id;

/**
 * 2~8자 — **가입할 때 짓는 이름의 규칙**(§5.1).
 *
 * `null` 을 받는다. 가입 트리거가 만드는 행에는 아직 이름이 없기 때문이다. 「이름이
 * 없는 상태」를 표현할 수 없으면 이름을 짓는 화면 자체가 설 자리가 없다.
 */
alter table public.app_user add constraint nickname_is_two_to_eight
  check (nickname is null or length(btrim(nickname)) between 2 and 8);

alter table public.app_user add constraint intro_fits_in_three_hundred
  check (intro is null or length(btrim(intro)) between 1 and 300);

/*
  **「사주가 있으면 이름도 있다」를 검사식으로 안 적는다.**

  적고 싶었다 — `check (self_person_id is null or nickname is not null)` 한 줄이면
  이름 없이 사주를 든 계정이 영영 못 생긴다. 그런데 **이미 있는 사람들이 정확히 그
  상태다.** 지금 계정 둘 다 사주가 있고 이름이 없다(참여한 적이 없어 별명을 지을 자리를
  안 지났다). 검사식을 걸면 이 마이그레이션이 그 두 줄에서 멈춘다.

  넘어가는 길은 둘인데 둘 다 나쁘다. 이름을 지어 넣으면 **본인이 안 고른 이름이 남의
  카드에 선다** — 그리고 지어낼 재료는 자기 `local_label` 뿐인데 그것은 내 목록 안에서만
  쓰는 말이고 실명일 수 있다(§5.2). `not valid` 로 걸면 그 행을 **다른 이유로 고칠 때마다**
  걸린다 — 안내 판본이 바뀌는 날 그 두 사람만 확인이 안 남는다.

  그래서 이름을 지키는 자리를 셋으로 둔다: 레이아웃이 길을 가리키고,
  `create_self_person` 이 새 계정을 막고, `set_discovery_participation` 이 **남에게
  보이는 문**을 막는다. 마지막 것이 실제로 지키는 성질이다 — 이름 없는 계정은 후보로도
  요청으로도 소식으로도 남에게 안 선다. 이미 있는 둘은 다음에 홈을 열 때 이름부터 짓는다.
*/

/**
 * 이름은 유일하다 — **한 사람을 두 이름으로도, 두 사람을 한 이름으로도 부르지 않는다**(§5.2).
 *
 * `null` 은 여럿이어도 된다. 유일 인덱스는 `null` 을 서로 다른 값으로 보므로 아직
 * 이름을 안 지은 계정들이 서로를 막지 않는다.
 */
create unique index app_user_nickname_is_unique
  on public.app_user (public.nickname_key(nickname));

-- ---------------------------------------------------------------------------
-- 인연 프로필에는 인연에 내놓은 것만 남는다
-- ---------------------------------------------------------------------------

/*
  열을 지우면 그 열에 준 권한도 함께 간다 — `grant insert (nickname, intro, ...)` 은
  여기서 저절로 좁아진다. 남는 것은 `prefer_gender` 하나이고, 그것은 실제로 「인연에
  내놓은 것」이다.
*/
alter table public.discovery_profile drop column nickname;
alter table public.discovery_profile drop column intro;

-- ---------------------------------------------------------------------------
-- 이름을 짓고 고치는 문
-- ---------------------------------------------------------------------------

/**
 * 프로필을 저장한다 — **`app_user` 는 열어 준 칸이 없다.**
 *
 * `discovery_profile` 은 별명·소개를 열 단위로 열어 두었고 서버 액션이 그 칸에 직접
 * 썼다(정책이 이미 「내 행만」을 묻고 있었으므로). `app_user` 는 그렇게 열려 있지 않다 —
 * 그 표에는 계정 상태와 안내 확인 기록이 함께 있어서, 한 칸을 열면 그 옆 칸을 안 여는
 * 이유를 정책이 매번 다시 대야 한다. 그래서 문을 함수로 낸다.
 *
 * **거절의 문장이 여기서 난다.** 유일 인덱스가 내는 말은 「중복된 키 값이 유일성 제약
 * 조건을 위반함」이고, 그것은 이름을 짓는 사람에게 할 말이 아니다.
 */
create or replace function public.save_my_profile(p_nickname text, p_intro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
  about text := nullif(btrim(coalesce(p_intro, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  if about is not null and length(about) > 300 then
    raise exception '소개는 300자까지입니다.' using errcode = '22023';
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
    raise exception '이미 쓰고 있는 닉네임입니다.' using errcode = '23505';
  end if;

  update public.app_user
  set nickname = name, intro = about
  where id = actor;

exception
  when unique_violation then
    raise exception '이미 쓰고 있는 닉네임입니다.' using errcode = '23505';
end;
$$;

/**
 * 이 이름을 쓸 수 있나 — **참·거짓 하나만 낸다.**
 *
 * 이 문은 「그 이름을 쓰는 사람이 있느냐」를 묻는 길이다. 그 사실은 문을 어떻게 만들든
 * 그대로 남으므로, 열되 **딱 그만큼만** 연다. 누구인지도, 비슷한 이름도, 대신 쓸 이름도
 * 내주지 않는다 — 대안을 추천하려면 남들이 쓰는 이름들을 훑어야 하고, 그것은 다른 문이다.
 *
 * 로그인한 사람만 부른다. 닉네임은 후보 카드에 서는 공개 이름이지만, 그 카드는 로그인한
 * 사람에게만 보인다. 확인 문을 그보다 넓게 열 이유가 없다.
 *
 * **내 이름은 쓸 수 있다고 답한다.** 고치는 화면에서 이름을 그대로 두고 확인을 누른
 * 사람에게 「이미 쓰고 있습니다」라고 하면, 그 말이 가리키는 사람이 자신이라는 것을
 * 알 길이 없다.
 */
create or replace function public.nickname_is_available(p_nickname text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if name is null or length(name) < 2 or length(name) > 8 then
    raise exception '닉네임은 2자에서 8자까지입니다.' using errcode = '22023';
  end if;

  return not exists (
    select 1 from public.app_user u
    where u.id <> actor
      and public.nickname_key(u.nickname) = public.nickname_key(name)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 얼굴 — **다른 종류의 자료라 표를 가른다**
-- ---------------------------------------------------------------------------

/**
 * 프로필 사진.
 *
 * `app_user` 에 열 두 개를 더하지 않는다. 그 표는 계정을 읽는 거의 모든 질의가 지나는
 * 자리이고, 거기에 수백 KB 짜리 열이 서면 「닉네임만 알고 싶은」 질의까지 그것을 끌고
 * 다니게 된다(TOAST 가 대개 막아 주지만, 막아 준다는 사실에 기대어 설계하지 않는다).
 *
 * 무엇보다 **얼굴은 다른 종류의 자료다.** 표가 갈려 있으면 「사진만 지운다」가 행 하나를
 * 지우는 일이 되고, 「사진이 있는가」가 계정 행을 안 건드리고 답해진다.
 */
create table public.profile_photo (
  -- 기본값이 `auth.uid()` 라 남의 자리에 사진을 놓을 수 없다.
  user_id uuid primary key default auth.uid() references public.app_user (id) on delete cascade,

  /** 받아 주는 것만 적는다 — 목록 밖의 것은 브라우저가 그릴 수 있는지도 우리가 모른다 */
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),

  /** 512KB. 상한이 없으면 한 사람이 DB 를 채울 수 있다 */
  bytes bytea not null check (octet_length(bytes) between 1 and 524288),

  updated_at timestamptz not null default now()
);

/**
 * **정책을 하나도 세우지 않는다.**
 *
 * RLS 를 켜고 정책이 없으면 아무도 못 읽는다. 그것이 여기서 원하는 것이다 — 사진은
 * 「내 행인가」로 답할 수 없다. 남의 사진을 보는 것이 정상 동작이고, 볼 수 있는 조건은
 * 「지금 그 사람의 이름이 내게 보이는가」라서 표 하나로는 물을 수 없다.
 *
 * 그래서 읽는 것도 쓰는 것도 아래 함수들이 한다. RPC 가 내주는 것이 곧 브라우저가 볼
 * 수 있는 것이다(ADR 0008).
 */
alter table public.profile_photo enable row level security;
revoke all on public.profile_photo from anon, authenticated;

/**
 * 이 사람의 사진을 볼 수 있나 — **이름이 보이는 자리에서 함께 보인다.**
 *
 * 조건을 새로 짓지 않았다. 사진이 서는 자리는 이미 이름이 서는 자리들이고(후보 카드 ·
 * 요청 · 함께 보기), 그 셋의 좁힘은 이미 각자 있다. 여기서 새 규칙을 지으면 화면에는
 * 없는 사람의 사진이 주소로는 열리거나, 화면에는 있는데 사진만 안 열리는 자리가 난다.
 *
 * **후보는 「지금 내 목록」이다.** 스냅샷을 새로 뽑아 그 사람이 빠지면 사진도 함께 닫힌다.
 * 여기서 목록을 새로 만들지는 않는다 — 사진 한 장을 여는 일이 스물다섯 명을 줄 세우는
 * 일을 일으키면 안 된다.
 */
create or replace function public.may_see_photo(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and (select auth.uid()) is not null
    and public.is_active_account()
    and (
      p_user_id = (select auth.uid())
      or (
        exists (select 1 from public.app_user u where u.id = p_user_id and u.status = 'active')
        and (
          exists (
            select 1
            from public.discovery_snapshot s
            join public.discovery_snapshot_slot slot on slot.snapshot_id = s.id
            where s.user_id = (select auth.uid())
              and s.seq = (
                select max(s2.seq) from public.discovery_snapshot s2
                where s2.user_id = (select auth.uid())
              )
              and slot.candidate_user_id = p_user_id
              and public.discovery_eligible((select auth.uid()), p_user_id)
          )
          or exists (
            select 1 from public.match_request r
            where r.status <> 'cancelled'
              and (
                (r.requester_user_id = (select auth.uid()) and r.addressee_user_id = p_user_id)
                or (r.addressee_user_id = (select auth.uid()) and r.requester_user_id = p_user_id)
              )
          )
          or exists (
            select 1 from public.visible_matches() m
            where m.user_low = p_user_id or m.user_high = p_user_id
          )
        )
      )
    );
$$;

/**
 * 사진을 올린다 — **base64 로 받는다.**
 *
 * PostgREST 를 지나는 것은 JSON 이라 bytea 를 그대로 실을 자리가 없다. 16진수로 실으면
 * 두 배이고 base64 는 1.33배다 — 어느 쪽이든 옮기는 동안만이고, 표에 앉는 것은 바이트다.
 *
 * 모양은 DB 가 다시 본다. 브라우저가 적어 보낸 `content_type` 을 믿지 않는 것이 아니라,
 * 믿을 수 있는 자리가 여기밖에 없기 때문이다 — 이 함수는 주소만 알면 부를 수 있다.
 */
create or replace function public.set_my_photo(p_content_type text, p_base64 text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  raw bytea;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  begin
    raw := decode(p_base64, 'base64');
  exception
    when others then
      raise exception '사진을 읽지 못했습니다.' using errcode = '22023';
  end;

  if raw is null or octet_length(raw) = 0 then
    raise exception '사진을 읽지 못했습니다.' using errcode = '22023';
  end if;

  if octet_length(raw) > 524288 then
    raise exception '사진은 512KB까지입니다.' using errcode = '22023';
  end if;

  if p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'JPG · PNG · WebP 만 올릴 수 있습니다.' using errcode = '22023';
  end if;

  insert into public.profile_photo (user_id, content_type, bytes, updated_at)
  values (actor, p_content_type, raw, now())
  on conflict (user_id) do update
    set content_type = excluded.content_type,
        bytes = excluded.bytes,
        updated_at = excluded.updated_at;
end;
$$;

/**
 * 사진을 내린다 — **행을 지운다.**
 *
 * 빈 바이트로 덮지 않는다. 「사진이 없다」가 두 값이 되면 「있는가」를 묻는 자리마다
 * 둘 다 알아야 한다.
 */
create or replace function public.clear_my_photo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  delete from public.profile_photo where user_id = actor;
end;
$$;

/**
 * 사진 한 장 — **없는 사람과 못 보는 사람이 같은 답을 받는다.**
 *
 * 갈라서 말하면 「저 사람이 이 서비스를 쓰나」를 묻는 문이 된다(`request_match` 와 같은
 * 규율). 둘 다 행이 안 나온다.
 */
create or replace function public.photo_of(p_user_id uuid)
returns table (content_type text, base64 text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.content_type, encode(p.bytes, 'base64')
  from public.profile_photo p
  where p.user_id = p_user_id
    and public.may_see_photo(p_user_id);
$$;

/*
  로그인한 사람만 지나간다. `may_see_photo` 는 `photo_of` 안에서만 불리므로 아무에게도
  안 연다 — 「볼 수 있나」만 따로 물을 수 있으면 그것이 곧 사람을 세는 문이다.
*/
/*
  `nickname_key` 도 권한을 손댄다 — 손 안 댄 함수가 하나라도 있으면 그것은 「누가 부를
  수 있는지 정한 적 없는 함수」다(`13_reading` 이 그것을 잰다). 아무에게도 안 연다:
  이 함수를 밖에서 부를 일이 없고, 유일 인덱스와 두 함수는 안에서 쓴다.
*/
revoke execute on function public.nickname_key(text) from anon, public;

revoke execute on function public.save_my_profile(text, text) from anon, public;
grant execute on function public.save_my_profile(text, text) to authenticated;

revoke execute on function public.nickname_is_available(text) from anon, public;
grant execute on function public.nickname_is_available(text) to authenticated;

revoke execute on function public.set_my_photo(text, text) from anon, public;
grant execute on function public.set_my_photo(text, text) to authenticated;

revoke execute on function public.clear_my_photo() from anon, public;
grant execute on function public.clear_my_photo() to authenticated;

revoke execute on function public.photo_of(uuid) from anon, public;
grant execute on function public.photo_of(uuid) to authenticated;

revoke execute on function public.may_see_photo(uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 관문 — **이름 없이 사주를 등록하지 않는다**
-- ---------------------------------------------------------------------------

/**
 * 첫 입력 앞의 관문이 하나 늘었다.
 *
 * 화면은 레이아웃이 가리키지만, 막는 일은 여기서 한다 — 주소로 지나가는 길과 RPC 를
 * 그대로 부르는 길이 남아 있기 때문이다. 검사식(`the_name_comes_before_the_chart`)이
 * 결국 막지만, 그때 나오는 말은 제약 위반 문장이라 사용자에게 할 말이 아니다.
 */
create or replace function public.create_self_person(
  p_local_label text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.notice_ack_at is null then
    raise exception '먼저 처리 안내를 확인해 주세요.' using errcode = '42501';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '42501';
  end if;

  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person set current_revision_id = new_revision where id = new_person;
  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

/**
 * 참여를 켤 때 **행이 없으면 만든다.**
 *
 * 전에는 별명을 저장하는 길이 곧 이 행을 만드는 길이었다(서버 액션이 `insert` 했다).
 * 이름이 계정으로 옮겨 가면서 그 길이 사라졌으므로, 참여를 켜는 자리가 자기 행을
 * 스스로 세운다. 안 그러면 `update` 가 0행을 고치고 **켰다고 답하는데 아무것도 안 켜진다.**
 *
 * 자격을 묻는 자리도 옮겼다 — 「별명이 있는가」는 이제 `discovery_profile` 행이 아니라
 * 계정의 이름을 묻는다.
 */
create or replace function public.set_discovery_participation(p_on boolean, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  current_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    update public.discovery_profile
    set opted_in_at = null, element_summary = null, element_revision_id = null
    where user_id = actor;
    return false;
  end if;

  -- 사주가 없으면 후보가 될 수 없다. 오행 요약이 나올 데가 없기 때문이다.
  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  /*
    **이름이 남에게 보이는 문은 여기다.**

    새 계정은 `create_self_person` 이 이미 이름을 물었으므로 이 줄은 대개 안 돈다.
    그런데 **이름이 계정으로 옮겨 오기 전에 사주를 등록한 사람들**이 있고, 그들에게는
    이 줄이 마지막 문이다. 여기가 없으면 이름 없는 카드가 남의 목록에 선다.
  */
  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select current_revision_id into current_revision
  from public.person where id = account.self_person_id;

  if current_revision is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (user_id, opted_in_at, element_summary, element_revision_id)
  values (actor, now(), p_summary, current_revision)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_revision_id = excluded.element_revision_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 이름을 내주던 자리들 — **여섯이 같은 표를 다시 본다**
-- ---------------------------------------------------------------------------

/*
  넷은 반환형이 늘어난다(`has_photo`). 반환형이 바뀌는 함수는 `create or replace` 로
  못 고치므로 지우고 다시 세운다 — 권한도 함께 지워지므로 아래에서 다시 건다.
*/
drop function if exists public.my_discovery_board();
drop function if exists public.my_match_requests();
drop function if exists public.my_match_scope(uuid);
drop function if exists public.my_matches();

/**
 * 후보 목록 — 이름과 소개는 이제 **계정에서 온다.**
 *
 * `discovery_profile` 을 여전히 조인한다. 그 표가 드는 것은 **그때 그 요약**이고, 카드가
 * 지금도 그 요약을 가리키는지 묻는 자리가 여기이기 때문이다(ADR 0037).
 */
create or replace function public.my_discovery_board()
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  has_photo boolean,
  seat integer,
  exploration boolean,
  supplied_elements text[],
  balance_band text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_revision uuid;
  opted timestamptz;
  current_revision uuid;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id, p.opted_in_at
    into my_summary, my_revision, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  select pe.current_revision_id into current_revision
  from public.app_user u
  join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  if my_revision is null or my_revision is distinct from current_revision then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id, s.generated_at, s.viewer_summary into snap, made_at, snap_summary
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id),
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band
  from public.discovery_snapshot_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    -- 카드가 그때 그 요약을 가리키는가. `discovery_eligible` 은 「지금 판본인가」만 묻는다.
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$$;

create or replace function public.my_match_requests()
returns table (
  request_id uuid,
  direction text,
  counterpart_user_id uuid,
  counterpart_nickname text,
  counterpart_intro text,
  counterpart_has_photo boolean,
  status text,
  supplied_to_me text[],
  supplied_to_them text[],
  balance_band text,
  created_at timestamptz,
  decided_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    case when r.requester_user_id = (select auth.uid()) then 'sent' else 'received' end,
    counterpart.id,
    counterpart.nickname,
    counterpart.intro,
    exists (select 1 from public.profile_photo f where f.user_id = counterpart.id),
    r.status,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    r.created_at,
    r.decided_at
  from public.match_request r
  -- **중지된 계정과의 요청은 서지 않는다.** 제재는 새 접근과 접촉을 함께 멈춘다(`prd-archive`).
  -- 답할 수 없는 요청이 목록에 남아 있으면, 누를 때마다 「찾지 못했습니다」만 나온다.
  --
  -- 조인이 하나로 줄었다 — 이름이 계정으로 옮겨 오면서, 이름을 드는 표와 상태를 드는
  -- 표가 같아졌다.
  join public.app_user counterpart
    on counterpart.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
   and counterpart.status = 'active'
  where (r.requester_user_id = (select auth.uid()) or r.addressee_user_id = (select auth.uid()))
    and r.status <> 'cancelled'
    and public.is_active_account()
  order by r.created_at desc
  limit 50;
$$;

create or replace function public.my_match_scope(p_match_id uuid)
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_intro text,
  partner_has_photo boolean,
  my_revision_id uuid,
  partner_revision_id uuid,
  supplied_to_me text[],
  supplied_to_them text[],
  balance_band text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    partner.id,
    partner.nickname,
    partner.intro,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    case when m.user_low = (select auth.uid()) then m.low_revision_id else m.high_revision_id end,
    case when m.user_low = (select auth.uid()) then m.high_revision_id else m.low_revision_id end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    m.created_at
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  where m.id = p_match_id;
$$;

create or replace function public.my_matches()
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_intro text,
  partner_has_photo boolean,
  supplied_to_me text[],
  balance_band text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.id,
    partner.id,
    partner.nickname,
    partner.intro,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    r.balance_band,
    m.created_at
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  order by m.created_at desc;
$$;

/**
 * 소식 — **사진은 안 든다.**
 *
 * 소식은 한 줄짜리 문장이고 그 줄에 얼굴이 설 자리가 없다. 반환형을 늘려 두면 화면이
 * 언젠가 그것을 쓰게 되고, 그때 「어디에 사진이 서는가」가 늘어난 것을 아무도 정한 적이 없다.
 */
create or replace function public.my_notifications()
returns table (
  notification_id uuid,
  kind text,
  counterpart_nickname text,
  request_id uuid,
  match_id uuid,
  reading_kind text,
  reading_person_a uuid,
  reading_person_b uuid,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    n.id,
    n.kind,
    coalesce(by_request.nickname, by_match.nickname),
    n.request_id,
    n.match_id,
    run.kind,
    run.person_a,
    run.person_b,
    n.created_at,
    n.read_at
  from public.visible_notifications() n
  left join public.match_request r on r.id = n.request_id
  left join public.app_user by_request
    on by_request.id = case
      when r.requester_user_id = (select auth.uid()) then r.addressee_user_id
      else r.requester_user_id end
  left join public.match m on m.id = n.match_id
  left join public.app_user by_match
    on by_match.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  left join public.reading_run run on run.id = n.run_id
  order by n.created_at desc
  limit 50;
$$;

/**
 * 풀이 목록 — 함께 본 궁합의 이름도 계정에서 온다.
 *
 * 나머지는 그대로다. 이 목록에서 이름이 서는 근거는 두 가지인데(내 목록의 부를 이름과
 * 상대의 닉네임) 바뀐 것은 뒤의 하나뿐이다.
 */
create or replace function public.my_readings()
returns table (
  kind text,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  label_a text,
  label_b text,
  score smallint,
  created_at timestamptz,
  from_current_revision boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.kind, l.person_a, l.person_b, l.match_id,
    l.label_a, l.label_b, l.score, l.created_at, l.from_current_revision
  from (
    /**
     * 내가 주인인 셋 — `self` · `person` · `private`.
     *
     * **이름이 붙는 근거가 곧 좁힘이다.** 엣지가 없으면 그 줄이 안 선다. 결과가 남아
     * 있어도 내가 그 사람을 목록에서 빼면 이 목록에서 사라진다 — 접근이 끊긴 사람의
     * 이름이 옛 결과를 통해 계속 보이지 않는 것이 요점이다(`my_private_readings` 와
     * 같은 규율). 그래서 `exists` 로 적는다: 붙이는 이름은 아래 스칼라 하위질의가
     * 내고, **줄이 서는가**는 여기서 정한다.
     */
    select
      r.kind,
      r.person_a,
      r.person_b,
      null::uuid as match_id,
      case when r.kind = 'self' then null else (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      ) end as label_a,
      (
        select e.local_label from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_b
      ) as label_b,
      r.score,
      r.created_at,
      /**
       * 한 사람짜리에서는 `pb` 가 없는 행이라 오른쪽이 `null is not distinct from null`
       * 로 참이 된다. 두 번째 사람을 따로 갈래 지어 세지 않는 것이 요점이다 — kind 로
       * 나누면 `person` 이 늘어난 날처럼 한 갈래만 안 고쳐진다.
       */
      r.revision_a = pa.current_revision_id
        and r.revision_b is not distinct from pb.current_revision_id as from_current_revision
    from public.reading r
    join public.person pa on pa.id = r.person_a
    left join public.person pb on pb.id = r.person_b
    where public.is_active_account()
      and r.owner_user_id = (select auth.uid())
      and exists (
        select 1 from public.user_person_access e
        where e.user_id = (select auth.uid()) and e.person_id = r.person_a
      )
      and (
        r.person_b is null
        or exists (
          select 1 from public.user_person_access e
          where e.user_id = (select auth.uid()) and e.person_id = r.person_b
        )
      )

    union all

    /**
     * 함께 본 궁합 — **좁힘은 `visible_matches()` 가 이미 든다.**
     *
     * 중지된 계정도, 상대가 중지된 것도, 차단도 저 함수 안에 있다. 여기서 조건을 다시
     * 적으면 두 자리가 갈리고, 갈리는 날 이 목록이 결과 화면보다 넓어진다.
     *
     * **「이전 입력」이 없다.** 공유 결과는 매인 판본으로 나고 그 판본이 곧 동의한
     * 대상이라(ADR 0010), 「그 뒤에 고친 입력으로 다시 봐야 한다」는 말이 성립하지 않는다.
     */
    select
      r.kind,
      null::uuid,
      null::uuid,
      r.match_id,
      partner.nickname,
      null::text,
      r.score,
      r.created_at,
      true
    from public.reading r
    join public.visible_matches() m on m.id = r.match_id
    join public.app_user partner
      on partner.id = case
        when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
    where r.kind = 'match'
  ) l (
    kind, person_a, person_b, match_id,
    label_a, label_b, score, created_at, from_current_revision
  )
  order by l.created_at desc;
$$;

/* 지웠다 다시 세운 넷은 권한도 다시 건다 */
revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;

revoke execute on function public.my_match_requests() from anon, public;
grant execute on function public.my_match_requests() to authenticated;

revoke execute on function public.my_match_scope(uuid) from anon, public;
grant execute on function public.my_match_scope(uuid) to authenticated;

revoke execute on function public.my_matches() from anon, public;
grant execute on function public.my_matches() to authenticated;
