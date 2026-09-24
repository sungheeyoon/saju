-- 사진이 없는 후보의 기본 아바타는 **그 사람 일간의 오행 색**을 입는다 (운영자 2026-09-24, ADR 0109)
--
-- 전에는 기본 아바타(이니셜) 뒤의 색이 카드와 같은 **채워 주는 기운**에서 왔다. 후보가 내 모자란
-- 기운으로 골라지므로 한 화면의 아바타가 거의 다 같은 색이었다(목이 모자란 사람에게는 전부 초록).
-- 운영자의 결정은 둘이다 — 아바타만 그 사람 일간의 오행을 입고, **색에만 쓰고 글자로 말하지 않는다.**
--
-- 그래서 두 문(`my_discovery_board` · `my_passed_connections`)이 칸 하나를 끝에 더한다:
--
--   - `avatar_element` — 木 · 火 · 土 · 金 · 水 중 하나, 또는 `null`.
--   - **천간 글자는 안 나간다.** 여덟 글자는 동의 뒤에 열린다. 색 하나를 칠하는 데 필요한
--     것은 오행 다섯 중 하나뿐이라 매핑을 DB 안에서 끝내고 오행만 낸다.
--   - **사진이 있으면 `null`** — 그 값을 쓸 자리가 없다. 쓰지 않을 값을 내보내지 않는다.
--   - 명식이 없거나 일간을 못 읽으면 `null` — 화면은 회색 한 벌(`tone-none`)이다.
--
-- 다른 판정(자격 · 차단 · 정지 · 순서 · 점수)은 한 글자도 안 바꾼다. 두 정의는 `20261001100000`
-- (`my_discovery_board`) · `20260929090000`(`my_passed_connections`) 를 그대로 옮기고 마지막 칸만 더했다.
-- 반환형이 바뀌므로 지우고 다시 세운다 — 권한은 앞과 같게(`anon` · PUBLIC 닫고 `authenticated` 만).
--
-- `restore_passed_connection` 은 두 문의 행을 `to_jsonb` 로 싣는다 — 새 칸이 거기에도 저절로 실린다.
-- plpgsql 본문은 이름으로 부르므로 지웠다 세워도 그 함수는 그대로 돈다.
--
-- **배포 순서는 어느 쪽이든 된다.** 칸을 끝에 더하기만 하므로 옛 앱은 모르는 칸을 흘려보내고,
-- 새 앱은 옛 DB 에서 칸이 없으면 `null`(회색)로 읽는다(`app/me/candidates.ts`).
--
-- 재는 자리는 `supabase/tests/57_avatar_element.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 그 사람 일간의 오행 — 두 문 안에서만 돈다
-- ---------------------------------------------------------------------------

/**
 * 사용자 하나의 **지금 내 명식** 일간 → 오행.
 *
 * 누구의 것이든 물을 수 있는 함수라 `authenticated` 에게 열지 않는다 — 열면 후보 목록 밖의
 * 아무 id 로도 일간의 갈래를 캐낼 수 있다. 부르는 자리는 소유자 권한으로 도는 두 문뿐이다.
 */
create function public.day_master_element_of(p_user_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case p.current_chart ->> 'dayMaster'
           when '甲' then '木' when '乙' then '木'
           when '丙' then '火' when '丁' then '火'
           when '戊' then '土' when '己' then '土'
           when '庚' then '金' when '辛' then '金'
           when '壬' then '水' when '癸' then '水'
         end
  from public.app_user u
  join public.person p on p.id = u.self_person_id
  where u.id = p_user_id;
$$;

revoke execute on function public.day_master_element_of(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. 후보 목록 — 끝에 `avatar_element`
-- ---------------------------------------------------------------------------

drop function public.my_discovery_board();

create function public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text, avatar_element text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
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

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'discovery-v1' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    photo.present,
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, slot.candidate_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, slot.candidate_summary) * 0.7
    )))::integer,
    public.activity_band_of(slot.candidate_user_id),
    case when photo.present then null
         else public.day_master_element_of(slot.candidate_user_id) end
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  cross join lateral (
    select exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id) as present
  ) photo
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 지나친 인연 — 끝에 `avatar_element`
-- ---------------------------------------------------------------------------

drop function public.my_passed_connections();

create function public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer, avatar_element text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary into my_summary
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    photo.present,
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, theirs.element_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, theirs.element_summary) * 0.7
    )))::integer,
    case when photo.present then null
         else public.day_master_element_of(p.passed_user_id) end
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  cross join lateral (
    select exists (select 1 from public.profile_photo f where f.user_id = p.passed_user_id) as present
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
