-- 사진은 주인이 고른 자리를 보인다 — 바이트는 그대로, 보일 자리(초점)만 장마다 둔다 (G-98, 조율자 지시 2026-10-11)
--
-- 사진은 어디서나 칸에 맞춰 가운데를 잘라 보였다(`object-cover`). 얼굴이 가장자리에 있는 장은 원하는 부분이 칸 밖으로
-- 나갔다. **사진을 다시 굽지 않는다** — 원본을 지키고 나중에 다시 맞출 수 있게, 장마다 「가로 · 세로 몇 % 자리를 보일까」
-- 두 수만 둔다. 화면은 그 두 수를 CSS `object-position` 으로 그린다 — 칸의 비율(대표 칸 · 카드 · 둥근 얼굴)이 달라도 같은
-- 수가 같은 쪽을 보인다. 확대는 없다(위치만).
--
-- ## 무엇이 바뀌나
--
-- 1. **표** — `profile_photo` 에 `focus_x` · `focus_y`(0..100, 기본 50). 있던 장은 50 · 50 — 가운데, 지금과 같다.
-- 2. **쓰는 문 하나** — `set_my_photo_focus(p_position, p_x, p_y, p_version)`. 정지 · 로그인 · 계정 잠금은 `lock_my_photos`.
--    `p_version` 을 주면 화면이 본 그 장이 그 자리에 있을 때만 바꾼다(옮기기 · 바꾸기와 같은 낡은 누름 거절). 올린 직후처럼
--    판본을 아직 모르면 `null`. **판본(`updated_at`)을 안 바꾼다** — 바이트가 그대로라 그림 주소의 `?v=` 캐시도 그대로다.
--    하루 올리기 한도(ADR 0125)를 안 센다.
-- 3. **바꾸기는 자리를 가운데로 돌린다** — `replace_my_photo` 의 본문만. 새 장에 옛 장의 자리를 입히지 않는다. 화면은
--    바꾼 뒤 고른 자리를 2 로 다시 적는다.
-- 4. **읽는 문 여섯이 초점을 함께 낸다** — 반환 칸만 끝에 는다(옛 앱은 아는 칸만 집는다, 규약 넷의 3). 모양은
--    `photo_focus_of(user)` 한 벌 — 그 사람의 장을 자리 순서로 `[x1, y1, x2, y2, …]`. 사진이 없으면 빈 배열.
--    - `my_photos` — `focus_x` · `focus_y`(내 장마다)
--    - `my_discovery_board` · `my_passed_connections` — `photo_focus`(카드가 장을 넘긴다)
--    - `my_matches` — `partner_photo_focus` · `my_chat_rooms` — `partner_photo_focus`
--    - `my_match_requests` — `counterpart_photo_focus`(사진 표시와 같이 답할 요청에만, 끝난 줄은 빈 배열)
--    `my_match_scope` 는 그대로다 — 결과 화면이 사진을 안 그린다.
--
-- 초점은 사진의 바이트가 아니다 — 볼 수 있는가(`may_see_photo`)는 바이트 문(`photo_at`)이 그대로 답한다. 읽는 문들이
-- `has_photo` 를 내던 자리에서 같이 낸다.
--
-- **배포 순서: 이 마이그레이션 → 앱.** 넓히기만이다 — 지금 운영 앱은 새 문을 안 부르고 새 칸을 안 읽는다.
--
-- 재는 자리는 `supabase/tests/91_photo_focus.test.sql` · `74_authenticated_doors` · `75_suspended_write_doors`.

-- ---------------------------------------------------------------------------
-- 1. 표
-- ---------------------------------------------------------------------------

alter table public.profile_photo
  add column focus_x smallint not null default 50
    constraint profile_photo_focus_x_check check (focus_x between 0 and 100),
  add column focus_y smallint not null default 50
    constraint profile_photo_focus_y_check check (focus_y between 0 and 100);

comment on column public.profile_photo.focus_x is
  '보일 자리의 가로 % — CSS object-position 의 첫 값. 50 이 가운데 (G-98, 20261203090000)';
comment on column public.profile_photo.focus_y is
  '보일 자리의 세로 % — CSS object-position 의 둘째 값. 50 이 가운데 (G-98, 20261203090000)';

-- ---------------------------------------------------------------------------
-- 2. 초점 한 벌 — 읽는 문들이 같은 모양으로 낸다
-- ---------------------------------------------------------------------------

/**
 * 한 사람의 초점 — 자리 순서로 `[x1, y1, x2, y2, …]`. 사진이 없으면 빈 배열.
 *
 * 아무에게도 안 연다 — 소유자 권한으로 도는 읽는 문들 안에서만 불린다(표에 정책이 없다).
 */
create function public.photo_focus_of(p_user_id uuid)
returns integer[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(pair.v order by f.position, pair.k), '{}'::integer[])
  from public.profile_photo f
  cross join lateral (values (1, f.focus_x::integer), (2, f.focus_y::integer)) as pair(k, v)
  where f.user_id = p_user_id;
$$;

revoke execute on function public.photo_focus_of(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. 쓰는 문 — 보일 자리를 정한다
-- ---------------------------------------------------------------------------

create function public.set_my_photo_focus(p_position integer, p_x integer, p_y integer, p_version bigint default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
begin
  if p_x is null or p_y is null or p_x not between 0 and 100 or p_y not between 0 and 100 then
    raise exception '위치를 저장하지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;

  update public.profile_photo p
  set focus_x = p_x, focus_y = p_y
  where p.user_id = actor
    and p.position = p_position
    and (p_version is null or public.profile_photo_version(p.updated_at) = p_version);

  if not found then
    raise exception '위치를 저장하지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;
end;
$$;

comment on function public.set_my_photo_focus(integer, integer, integer, bigint) is
  '내 사진 한 장의 보일 자리(가로 · 세로 %). 바이트 · 판본 · 하루 한도는 그대로 (G-98, 20261203090000)';

revoke execute on function public.set_my_photo_focus(integer, integer, integer, bigint) from anon, public;
grant execute on function public.set_my_photo_focus(integer, integer, integer, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 바꾸기는 자리를 가운데로 — 본문만(서명 · 권한은 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.replace_my_photo(p_position integer, p_version bigint, p_content_type text, p_base64 text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.lock_my_photos();
  raw bytea := public.profile_photo_bytes(p_content_type, p_base64);
  stamped timestamptz;
begin
  if not exists (
    select 1 from public.profile_photo p
    where p.user_id = actor
      and p.position = p_position
      and public.profile_photo_version(p.updated_at) = p_version
  ) then
    raise exception '사진을 바꾸지 못했어요. 다시 시도해 주세요.' using errcode = '22023';
  end if;

  perform public.note_my_photo_upload(actor);

  update public.profile_photo p
  set content_type = p_content_type, bytes = raw, updated_at = clock_timestamp(), focus_x = 50, focus_y = 50
  where p.user_id = actor and p.position = p_position
  returning p.updated_at into stamped;

  return public.profile_photo_version(stamped);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. 읽는 문 — 반환 칸이 끝에 하나씩 는다(본문은 그 칸 말고 그대로)
-- ---------------------------------------------------------------------------

drop function public.my_photos();
create function public.my_photos()
returns table("position" integer, version bigint, focus_x integer, focus_y integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.position::integer, public.profile_photo_version(p.updated_at), p.focus_x::integer, p.focus_y::integer
  from public.profile_photo p
  where p.user_id = (select auth.uid())
  order by p.position;
$$;

revoke execute on function public.my_photos() from anon, public;
grant execute on function public.my_photos() to authenticated;

drop function public.my_chat_rooms();
create function public.my_chat_rooms()
returns table(match_id uuid, partner_user_id uuid, partner_nickname text, partner_has_photo boolean, opened_at timestamp with time zone, closed_reason text, closed_at timestamp with time zone, last_message_at timestamp with time zone, last_message_body text, unread_count integer, partner_activity text, partner_left boolean, partner_photo_focus integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.match_id,
    partner.id,
    partner.nickname,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    r.opened_at,
    r.closed_reason,
    r.closed_at,
    last.created_at,
    last.body,
    coalesce(unread.n, 0),
    case when r.closed_reason is null then public.activity_band_of(partner.id) end,
    partner.id is null,
    public.photo_focus_of(partner.id)
  from public.chat_room r
  left join public.app_user partner
    on partner.id = case
      when r.user_low = (select auth.uid()) then r.user_high else r.user_low end
  left join lateral (
    select m.created_at, m.body from public.chat_message m
    where m.room_id = r.id order by m.seq desc limit 1
  ) last on true
  left join lateral (
    select count(*)::integer as n
    from public.chat_message m
    join public.chat_read k on k.room_id = m.room_id and k.user_id = (select auth.uid())
    where m.room_id = r.id
      and m.sender_user_id is distinct from (select auth.uid())
      and m.seq > k.last_read_seq
  ) unread on true
  -- 내 방에서 출발한다 — 두 색인으로 내 방만 집고, 읽을 수 있는가는 그 함수가 묻는다(`20261107090000` 머리말 2)
  where (r.user_low = (select auth.uid()) or r.user_high = (select auth.uid()))
    and public.chat_room_readable(r.id)
  order by coalesce(last.created_at, r.opened_at) desc;
$$;

revoke execute on function public.my_chat_rooms() from anon, public;
grant execute on function public.my_chat_rooms() to authenticated;

drop function public.my_matches();
create function public.my_matches()
returns table(match_id uuid, partner_user_id uuid, partner_nickname text, partner_intro text, partner_has_photo boolean, supplied_to_me text[], balance_band text, created_at timestamp with time zone, partner_photo_focus integer[])
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
    m.created_at,
    public.photo_focus_of(partner.id)
  from public.visible_matches() m
  join public.match_request r on r.id = m.request_id
  join public.app_user partner
    on partner.id = case
      when m.user_low = (select auth.uid()) then m.user_high else m.user_low end
  order by m.created_at desc;
$$;

revoke execute on function public.my_matches() from anon, public;
grant execute on function public.my_matches() to authenticated;

drop function public.my_match_requests();
create function public.my_match_requests()
returns table(request_id uuid, direction text, counterpart_user_id uuid, counterpart_nickname text, counterpart_intro text, counterpart_has_photo boolean, status text, supplied_to_me text[], supplied_to_them text[], balance_band text, created_at timestamp with time zone, decided_at timestamp with time zone, counterpart_photo_focus integer[])
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
    -- 소개와 사진 표시는 **답할 요청에만** 싣는다. 끝난 줄은 닉네임과 상태만 그린다 — 차단이 끊은 줄과
    -- 그냥 거절된 줄이 같은 모양이어야 차단이 알려지지 않는다(ADR 0120)
    case when r.status = 'pending' then counterpart.intro end,
    r.status = 'pending'
      and exists (select 1 from public.profile_photo f where f.user_id = counterpart.id),
    r.status,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_requester else r.supplied_to_addressee end,
    case when r.requester_user_id = (select auth.uid())
      then r.supplied_to_addressee else r.supplied_to_requester end,
    r.balance_band,
    r.created_at,
    r.decided_at,
    -- 사진 표시와 같은 문턱 — 끝난 줄은 빈 배열이라 모양이 같다
    case when r.status = 'pending' then public.photo_focus_of(counterpart.id) else '{}'::integer[] end
  from public.match_request r
  -- **중지된 계정과의 요청은 서지 않는다.** 제재는 새 접근과 접촉을 함께 멈춘다(`prd-archive`).
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

revoke execute on function public.my_match_requests() from anon, public;
grant execute on function public.my_match_requests() to authenticated;

drop function public.my_discovery_board();
create function public.my_discovery_board()
returns table(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text, photo_count integer, photo_focus integer[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  opted timestamptz;
  snap uuid;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
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

  /*
    **사람 단위로 먼저 줄을 세운다**(ADR 0120). 아래 `for update` 는 덱이 있을 때만 잠글 행이 있다 — 덱이 없는
    첫 읽기 둘이 나란히 오면 둘 다 「덱 없음」을 보고 덱을 두 벌 세웠다. 뒤 읽기는 앞 트랜잭션이 끝날 때까지 여기서
    기다렸다가 앞이 세운 덱을 읽는다.
  */
  perform pg_advisory_xact_lock(hashtext('discovery:deck:' || actor::text));

  /*
    덱을 잠그고 읽는다 — 같은 사람의 두 읽기가 나란히 채우면 같은 자리에 두 사람을 앉히려다 한쪽이 부딪힌다.
  */
  select s.id, s.viewer_summary, s.policy_version
    into snap, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1
  for update;

  /*
    **새 덱은 덱이 없거나 · 내 요약이 바뀌었거나 · 정책이 바뀌었을 때만 선다.** 24시간 재생성은 없다 — 덱은
    떠나는 사람만큼만 바뀌고, 떠난 자리는 아래에서 바로 채운다.
  */
  if snap is null
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'v2-beta' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  else
    -- 씨앗은 **DB 가 짓는다** — 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다
    perform public.fill_discovery_deck(actor, snap, gen_random_uuid()::text);
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
    photo.n,
    public.photo_focus_of(slot.candidate_user_id)
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
$$;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;

drop function public.my_passed_connections();
create function public.my_passed_connections()
returns table(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text, photo_count integer, photo_focus integer[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
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
    photo.n,
    public.photo_focus_of(p.passed_user_id)
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
$$;

revoke execute on function public.my_passed_connections() from anon, public;
grant execute on function public.my_passed_connections() to authenticated;
