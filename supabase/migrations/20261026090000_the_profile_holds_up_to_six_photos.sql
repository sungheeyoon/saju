-- 프로필 사진이 **여섯 장까지**다 — 첫 장이 대표이고 순서를 바꾼다 (G-60, 이슈 #235)
--
-- 지금까지 `profile_photo` 는 한 사람 한 줄이었다(기본키 `user_id`, `20260909120000`). 운영자가
-- 2026-09-25 에 고른 모양은 편집 칸 여섯 · 첫 칸이 대표 · 길게 눌러 끌어 순서를 바꾸는 것이고,
-- 카드는 그 사진들을 넘겨 본다. 그래서 줄에 **자리**(`position`, 1..6)가 붙는다.
--
-- ## 무엇이 그대로인가
--
-- - **볼 수 있는 조건은 한 글자도 안 바뀐다.** 새 문 `photo_at` 도 `may_see_photo(p_user_id)` 하나를
--   묻는다 — 사람 단위의 답이고 장 단위의 답은 없다. 한 사람의 사진 한 장이 열리면 여섯 장이 다 열리고,
--   닫히면 다 닫힌다.
-- - 한 장 512KB · 형식 셋 · base64 로 받는 것 · RLS 켜고 정책 0 · 표를 아무에게도 안 여는 것.
-- - 떠나면 함께 사라진다 — FK 가 여전히 `app_user` 에 `cascade` 다(ADR 0023). 손으로 적은 줄이 없다.
--
-- ## 자리는 빈틈없이 1..k 다
--
-- 쓰는 문은 넷뿐이고(`add_my_photo` · `remove_my_photo` · `move_my_photo` · 옛 `set_my_photo`), 넷 다
-- 계정 행을 잠그고 돈다 — 같은 사람의 두 올림이 같은 자리를 세지 않는다. 지우면 뒤의 장이 한 칸씩
-- 당겨 앉고, 옮기면 사이의 장이 한 칸씩 밀린다. 문장 하나로 자리를 돌리므로 기본키를 **문장 끝에
-- 재도록**(`deferrable`) 세웠다 — 줄마다 재면 3→2 로 당기는 순간 2 가 아직 있어서 부딪친다.
--
-- ## 넓히고, 재고, 좁힌다 — 옛 앱이 새 DB 에서 돈다
--
-- 옛 앱이 부르는 문 넷을 남기고 뜻만 「대표 사진」으로 옮긴다.
--
--   - `photo_of(uuid)` — 대표 사진(1번). `/me/photo/{id}` 가 그대로 연다.
--   - `set_my_photo(text, text)` — 대표 사진을 바꾼다(없으면 1번에 놓는다). 나머지 장은 그대로다.
--   - `clear_my_photo()` — **전부** 내린다. 옛 앱의 「사진 지우기」는 「내 얼굴을 내린다」였다 —
--     대표만 지우고 둘째 장이 대표로 올라오면 그 사람이 안 한 일을 한 것이 된다.
--   - `my_discovery_board()` · `my_passed_connections()` — `has_photo` 를 그대로 두고 끝에
--     `photo_count` 를 더한다. 반환 칸이 느는 쪽은 옛 앱이 모르는 칸을 흘려보낸다.
--
-- 옛 문을 좁히는 일(`set_my_photo` · `clear_my_photo` · `photo_of` 를 닫는 것)은 새 앱이 운영에 선
-- 뒤의 마이그레이션이 한다 — `/me/photo/{id}` 는 아바타가 계속 쓰므로 `photo_of` 는 남을 수도 있다.
--
-- **배포 순서: 이 마이그레이션 → 앱.** 새 앱은 `my_photos` · `add_my_photo` 를 부르므로 옛 DB 에서는
-- 프로필 화면이 선다. 새 앱의 카드는 옛 DB 에서 `photo_count` 가 없으면 `has_photo` 로 한 장을 센다.
--
-- 재는 자리는 `supabase/tests/61_profile_photos.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 표 — 줄에 자리가 붙는다
-- ---------------------------------------------------------------------------

/*
  있던 사진은 모두 대표(1번)가 된다 — 한 사람 한 줄이었으므로 부딪칠 줄이 없다. 기본값은 옮긴 뒤에
  걷는다. 자리를 세는 일은 문이 하고, 표가 「말 안 하면 1」이라고 답하면 둘째 자리가 첫째를 덮는다.
*/
alter table public.profile_photo
  add column position smallint not null default 1
    constraint profile_photo_position_check check (position between 1 and 6);

alter table public.profile_photo alter column position drop default;

/*
  기본키를 `(user_id, position)` 으로 옮긴다. 앞 칸이 `user_id` 라 FK 의 cascade 가 찾는 색인은
  그대로 선다(`20261012090000`). 떠나는 사람의 줄을 찾는 길이 바뀌지 않는다.
*/
alter table public.profile_photo drop constraint profile_photo_pkey;
alter table public.profile_photo
  add constraint profile_photo_pkey primary key (user_id, position) deferrable initially immediate;

/*
  같은 순간에 올린 두 장이 같은 `updated_at` 을 들지 않게 한다 — 앱이 이 값을 사진 주소의 판본으로
  쓴다(`?v=`). 문장 시각(`now()`)은 한 거래 안에서 같다.
*/
alter table public.profile_photo alter column updated_at set default clock_timestamp();

-- ---------------------------------------------------------------------------
-- 2. 받은 바이트를 읽는 한 벌 — 문 넷이 같은 거절을 낸다
-- ---------------------------------------------------------------------------

/**
 * base64 를 바이트로 풀고 상한과 형식을 본다. **거절 문장은 앞 `set_my_photo` 그대로다.**
 *
 * 아무에게도 안 연다 — 부르는 자리는 소유자 권한으로 도는 두 문뿐이다.
 */
create function public.profile_photo_bytes(p_content_type text, p_base64 text)
returns bytea
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw bytea;
begin
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

  if p_content_type is null or p_content_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'JPG · PNG · WebP 만 올릴 수 있습니다.' using errcode = '22023';
  end if;

  return raw;
end;
$$;

revoke execute on function public.profile_photo_bytes(text, text) from anon, authenticated, public;

/**
 * 쓰는 문 넷의 앞머리 — 로그인 · 정지 · **계정 행 잠금.**
 *
 * 잠금이 자리를 빈틈없이 지킨다. 같은 사람의 두 올림이 동시에 「지금 몇 장인가」를 세면 둘 다
 * 같은 다음 자리를 고른다. 아무에게도 안 연다.
 */
create function public.lock_my_photos()
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  perform 1 from public.app_user where id = actor for update;
  return actor;
end;
$$;

revoke execute on function public.lock_my_photos() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. 쓰는 문 — 올리기 · 지우기 · 옮기기
-- ---------------------------------------------------------------------------

/**
 * 한 장을 **맨 뒤에** 놓는다 — 놓인 자리를 돌려준다.
 *
 * 빈 칸을 골라 놓는 문은 없다. 자리가 빈틈없어야 「n 번째 사진」이 모두에게 같은 장을 가리킨다.
 */
create function public.add_my_photo(p_content_type text, p_base64 text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
  placed integer;
begin
  select count(*)::integer + 1 into placed
  from public.profile_photo where user_id = actor;

  if placed > 6 then
    raise exception '사진은 6장까지입니다.' using errcode = '22023';
  end if;

  insert into public.profile_photo (user_id, position, content_type, bytes)
  values (actor, placed, p_content_type, raw);

  return placed;
end;
$$;

/**
 * 한 장을 내린다 — **뒤의 장이 한 칸씩 당겨 앉는다.** 대표를 지우면 둘째 장이 대표가 된다.
 *
 * 없는 자리를 지우라고 하면 조용히 지나간다 — 두 탭에서 같은 장을 지운 둘째 누름이다.
 */
create function public.remove_my_photo(p_position integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
begin
  delete from public.profile_photo where user_id = actor and position = p_position;
  if not found then
    return;
  end if;

  update public.profile_photo
  set position = position - 1
  where user_id = actor and position > p_position;
end;
$$;

/**
 * 한 장을 다른 자리로 옮긴다 — **사이의 장이 한 칸씩 밀린다**(끌어다 놓기의 뜻).
 *
 * 맞바꾸기가 아니다. 넷째 장을 첫 칸에 두면 1 · 2 · 3 이 한 칸씩 뒤로 가고, 첫 칸에 있던 장이
 * 넷째로 날아가지 않는다. 문장 하나로 돌려서 중간 모양이 남지 않는다.
 */
create function public.move_my_photo(p_from integer, p_to integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  held integer;
begin
  select count(*)::integer into held from public.profile_photo where user_id = actor;

  if p_from is null or p_to is null
     or p_from < 1 or p_from > held or p_to < 1 or p_to > held then
    raise exception '사진을 옮기지 못했습니다.' using errcode = '22023';
  end if;

  if p_from = p_to then
    return;
  end if;

  update public.profile_photo
  set position = case
    when position = p_from then p_to
    when p_from < p_to then position - 1
    else position + 1
  end
  where user_id = actor
    and position between least(p_from, p_to) and greatest(p_from, p_to);
end;
$$;

/**
 * 대표 사진을 바꾼다 — **옛 앱의 문**(위 머리말). 없으면 1번에 놓는다.
 *
 * 1번이 있으면 그 줄의 바이트만 바꾼다. 둘째 장부터는 손대지 않는다.
 */
create or replace function public.set_my_photo(p_content_type text, p_base64 text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
begin
  update public.profile_photo
  set content_type = p_content_type, bytes = raw, updated_at = clock_timestamp()
  where user_id = actor and position = 1;

  if not found then
    insert into public.profile_photo (user_id, position, content_type, bytes)
    values (actor, 1, p_content_type, raw);
  end if;
end;
$$;

/**
 * 내 사진을 **전부** 내린다 — 옛 앱의 「사진 지우기」(위 머리말).
 *
 * 정지된 계정도 지울 수 있다 — 앞과 같다. 얼굴을 내리는 일은 막을 까닭이 없다.
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

-- ---------------------------------------------------------------------------
-- 4. 읽는 문 — 내 사진의 자리 · 한 장
-- ---------------------------------------------------------------------------

/**
 * 내 사진들의 자리와 판본 — **바이트는 안 실린다.** 편집 칸이 이것으로 칸을 세우고, 그림은 주소로 받는다.
 *
 * 판본(`version`)은 그 장을 올린 시각의 마이크로초다. 옮겨도 안 바뀌므로 주소 `?v=` 가 **그 장**을 가리킨다 —
 * 2번 자리에 다른 장이 앉으면 판본이 달라 브라우저가 옛 그림을 안 쓴다.
 */
create function public.my_photos()
returns table ("position" integer, version bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.position::integer, (extract(epoch from p.updated_at) * 1000000)::bigint
  from public.profile_photo p
  where p.user_id = (select auth.uid())
  order by p.position;
$$;

/**
 * 사진 한 장 — `photo_of` 와 **같은 조건**, 자리 하나를 더 받는다.
 *
 * 없는 자리 · 없는 사람 · 못 보는 사람이 같은 답(0행)을 받는다.
 */
create function public.photo_at(p_user_id uuid, p_position integer)
returns table (content_type text, base64 text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.content_type, encode(p.bytes, 'base64')
  from public.profile_photo p
  where p.user_id = p_user_id
    and p.position = p_position
    and public.may_see_photo(p_user_id);
$$;

/** 대표 사진 — 옛 주소 `/me/photo/{id}` 와 아바타가 연다. 조건은 앞과 같다 */
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
    and p.position = 1
    and public.may_see_photo(p_user_id);
$$;

revoke execute on function public.add_my_photo(text, text) from anon, public;
revoke execute on function public.remove_my_photo(integer) from anon, public;
revoke execute on function public.move_my_photo(integer, integer) from anon, public;
revoke execute on function public.my_photos() from anon, public;
revoke execute on function public.photo_at(uuid, integer) from anon, public;
grant execute on function public.add_my_photo(text, text) to authenticated;
grant execute on function public.remove_my_photo(integer) to authenticated;
grant execute on function public.move_my_photo(integer, integer) to authenticated;
grant execute on function public.my_photos() to authenticated;
grant execute on function public.photo_at(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 후보 목록 · 지나친 인연 — 끝에 `photo_count`
-- ---------------------------------------------------------------------------
--
-- 두 정의는 `20261025160000` 9절을 그대로 옮기고 사진 한 칸만 바꿨다 — `exists` 가 `count` 가 되고,
-- `has_photo` 는 그 수가 0 보다 큰가다. 점수 · 자격 · 순서는 한 글자도 안 바꾼다. 반환형이 바뀌므로
-- 지우고 다시 세우고, 권한은 앞과 같게(`anon` · PUBLIC 닫고 `authenticated` 만).
--
-- `restore_passed_connection` 은 두 문의 행을 `to_jsonb` 로 싣는다 — 새 칸이 거기에도 저절로 실린다.

drop function public.my_discovery_board();

create function public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text, photo_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary, p.opted_in_at
    into my_summary, my_need, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'v2-beta' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    public.activity_band_of(slot.candidate_user_id),
    case when photo.n > 0 then null
         else public.day_master_element_of(slot.candidate_user_id) end,
    photo.n
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = slot.candidate_user_id
  ) photo
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;

drop function public.my_passed_connections();

create function public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text, photo_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    photo.n > 0,
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(public.discovery_preview_score_v2(
      my_chart, my_summary, my_need, tp.current_chart, theirs.element_summary, theirs.need_summary))))::integer,
    case when photo.n > 0 then null
         else public.day_master_element_of(p.passed_user_id) end,
    photo.n
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.person tp on tp.id = who.self_person_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  cross join lateral (
    select count(*)::integer as n from public.profile_photo f where f.user_id = p.passed_user_id
  ) photo
  where p.user_id = actor
    and public.discovery_passed_kept(actor, p.passed_user_id)
    and public.discovery_pair_eligible(actor, p.passed_user_id)
  order by p.passed_at desc, p.passed_user_id desc
  limit 20;
end;
$function$;

revoke execute on function public.my_passed_connections() from anon, public;
grant execute on function public.my_passed_connections() to authenticated;
