-- 사용자는 시도를 닫지 못하고, 차단은 사진을 닫고, 종료일은 서울로 세고, 첫 덱은 하나만 선다 (ADR 0120)
--
-- 2026-09-28 밤샘 감사가 찾은 넷을 한 번에 고친다. 넷 다 **인자도 반환형도 안 바뀐다** — 문 하나를 걷고(1),
-- 셋의 몸만 다시 적는다(2 · 3 · 4). 그래서 넓히기 · 좁히기가 없다. 옛 앱이 떠 있는 동안 이것이 먼저 올라가도
-- 되는 까닭은 1 에 적었다.
--
--   1. **`fail_reading_run` 을 걷는다.** `authenticated` 에게 열려 있어 사용자가 자기 `running` 시도를 곧바로
--      실패로 닫을 수 있었다. 실패한 시도는 풀이권은 안 쓰지만 서비스 전체의 하루 상한(`reading_daily_budget()`,
--      500)과 사람마다의 한 시간 한도에는 센다(`start_reading_run` 의 두 `count(*)`) — 계정 몇으로 열고 닫기를
--      되풀이하면 **모든 이용자**가 그날 풀이를 못 받는다. `p_usage` 에는 브라우저가 보낸 JSON 이 그대로 적혔다.
--      앱에서 이 문을 부르던 자리는 하나였다 — `app/me/reading/pipeline.ts` 의 `failAsUser`, **열쇠가 없는
--      배포**에서만 도는 길이다. 운영에는 열쇠가 있어 그 길을 안 밟는다. 옛 앱이 떠 있는 동안 그 길을 밟으면
--      `PGRST202` 가 기록에 남고 시도는 10분 만료가 닫는다 — 고치기 전에도 그 자리는 실패를 기록에만 남겼다.
--      닫는 문은 열쇠의 `fail_reading_job` 하나로 남는다(`service_role` 만).
--   2. **요청 갈래의 사진은 기다리는 · 수락된 요청에만, 차단이 없을 때만 열린다**(`may_see_photo`). 앞서는
--      `status <> 'cancelled'` 만 봐서, 받는 쪽이 차단해 요청이 `rejected` 로 거둬져도 보낸 쪽은 사진을 계속 봤다.
--      끝난 요청(거절 · 만료 · 무효)까지 닫는 까닭 — 차단만 닫으면 「그냥 거절」은 사진이 열리고 「차단」은 닫혀
--      둘이 갈리고, 그 차이가 차단을 알린다(PRD 「차단은 소식이 아니다」). 끝난 요청의 줄은 화면에서 닉네임과
--      상태만 그린다(`app/me/requests/page.tsx` 의 「끝난 요청」) — 사진이 설 자리가 없었다.
--      같은 까닭으로 `my_match_requests` 는 **소개와 사진 표시를 기다리는 요청에만** 싣는다. 줄은 그대로 선다 —
--      「차단이 끊은 요청은 요청자에게 거절로 선다」(PRD).
--   3. **종료일은 서울 날짜로 판정한다**(`beta_is_over`). `current_date` 는 세션 시간대(운영은 UTC)의 오늘이라,
--      종료 다음 날 서울 00:00~09:00 동안 화면의 관문(`src/lib/consent/gate.ts`, 서울 23:59:59)은 닫혔는데
--      `is_active_account()` 는 참이었다 — RPC 를 곧바로 부르면 쓰기가 지나갔다. 모양은 저장소의 다른 서울
--      날짜와 같다(`(now() at time zone 'Asia/Seoul')::date`).
--   4. **첫 덱을 세우기 전에 사람 단위 자물쇠를 쥔다**(`my_discovery_board`). 덱이 있으면 그 행을 `for update` 로
--      잠갔지만, 덱이 없으면 잠글 행이 없어 나란히 온 두 읽기가 덱을 두 벌 세웠다 — 2026-09-28 로컬에서 psql 둘로
--      일으켜 **덱 2 · 노출 기록 2**(후보 하나)를 쟀다. 자물쇠는 `reading:user:` 와 같은 모양
--      (`pg_advisory_xact_lock(hashtext('discovery:deck:' || actor))`)이고 `scripts/check-db-races.mjs` 의 7 이 든다.
--
-- 시험: `supabase/tests/64_audit_doors.test.sql`(1 · 2 · 3), `scripts/check-db-races.mjs` 7(4).

-- ---------------------------------------------------------------------------
-- 1. 사용자 권한으로 시도를 닫는 문을 걷는다
-- ---------------------------------------------------------------------------

drop function public.fail_reading_run(uuid, text, text, jsonb);

-- ---------------------------------------------------------------------------
-- 2. 차단 뒤의 사진 — 요청 갈래는 기다리는 · 수락된 요청에만, 차단이 없을 때만
-- ---------------------------------------------------------------------------

create or replace function public.may_see_photo(p_user_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
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
            from public.discovery_candidate s
            join public.discovery_candidate_slot slot on slot.snapshot_id = s.id
            where s.user_id = (select auth.uid())
              and s.seq = (
                select max(s2.seq) from public.discovery_candidate s2
                where s2.user_id = (select auth.uid())
              )
              and slot.candidate_user_id = p_user_id
              and public.discovery_eligible((select auth.uid()), p_user_id)
          )
          or (
            public.discovery_passed_kept((select auth.uid()), p_user_id)
            and public.discovery_pair_eligible((select auth.uid()), p_user_id)
          )
          or exists (
            select 1 from public.match_request r
            -- 끝난 요청은 안 연다 — 거절과 차단이 같은 답이어야 차단이 알려지지 않는다
            where r.status in ('pending', 'accepted')
              and (
                (r.requester_user_id = (select auth.uid()) and r.addressee_user_id = p_user_id)
                or (r.addressee_user_id = (select auth.uid()) and r.requester_user_id = p_user_id)
              )
              and not exists (
                select 1 from public.block b
                where (b.user_id = (select auth.uid()) and b.blocked_user_id = p_user_id)
                   or (b.user_id = p_user_id and b.blocked_user_id = (select auth.uid()))
              )
          )
          or exists (
            select 1 from public.visible_matches() m
            where m.user_low = p_user_id or m.user_high = p_user_id
          )
        )
      )
    );
$function$;

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
    r.decided_at
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

-- ---------------------------------------------------------------------------
-- 3. 종료일은 서울의 그날 끝까지다
-- ---------------------------------------------------------------------------

/**
 * 베타가 끝났는가 — **서울 날짜로** 판정한다.
 *
 * 일정이 없으면 끝난 것이 아니다(`20260906090000`). 앞서는 `current_date` 로 견줘 세션 시간대(UTC)의 오늘을
 * 봤고, 종료 다음 날 서울 아침 아홉 시까지 문이 열려 있었다. 화면의 관문은 서울 23:59:59 에 닫는다 — 두 자리가
 * 같은 시각에 닫혀야 화면이 닫힌 뒤 RPC 로 쓰는 창이 없다.
 */
create or replace function public.beta_is_over()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (now() at time zone 'Asia/Seoul')::date > s.ends_on from public.current_beta_schedule() s),
    false);
$$;

-- ---------------------------------------------------------------------------
-- 4. 첫 덱은 하나만 선다 — 사람 단위 자물쇠 (몸은 20261028090000 그대로, 자물쇠 한 줄만 더한다)
-- ---------------------------------------------------------------------------

create or replace function public.my_discovery_board()
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
