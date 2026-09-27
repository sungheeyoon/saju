-- 오늘의 인연은 여섯 자리이고, 한 명이 떠나면 풀에서 한 명이 바로 채운다 (ADR 0115)
--
-- 운영자 결정(2026-09-27): 추천은 하루 열 명 목록이 넘길수록 줄다 비고 새로고침(5분 쿨다운 · 24시간 자동)을
-- 기다리는 모양이 아니라 **늘 여섯이 서 있는 덱**이다. 넘기거나 요청해 한 명이 떠나면 후보 풀에서 한 명이 바로
-- 채운다. 풀에 더 올 사람이 없을 때만 여섯보다 줄고, 끝내 비면 빈 화면이 선다.
--
-- ## 무엇이 바뀌나
--
-- - **채우는 문 하나가 선다** — `fill_discovery_deck(actor, deck, seed)`. 떠난 자리(지금 자격이 없거나 카드가 말하는
--   요약이 이미 그 사람의 것이 아닌 자리)를 걷고, 여섯에 모자란 만큼 **지금 덱에 없는** 후보 풀에서 뽑아 **뒤에**
--   붙인다. 아무에게도 안 연다 — 씨앗을 받기 때문이다(ADR 0037 의 닫힌 문과 같은 까닭).
-- - **뽑는 규칙은 한 자리씩이다.** 점수 · 자격 · 상위 20% 컷은 그대로다. 옛 「컷에서 가중 무작위 8 + 아래에서
--   무작위 2」는 **자리마다 20% 확률로 아래에서**가 된다 — 채울 자리 수만큼 동전을 던져 아래에서 뽑을 수를 정하고,
--   나머지는 컷에서 가중 무작위다. 한 층이 모자라면 다른 층에서 가중 무작위로 채운다(옛 filler 와 같다).
--   스무 명이 안 되는 동안에는 컷이 전부라 탐색 자리가 안 선다 — 옛 규칙 그대로다.
-- - `my_discovery_board()` 는 **읽을 때 채운다.** 넘김(`discovery_passed` upsert) · 요청 뒤에 화면이 다시 읽는 길에
--   그대로 얹힌다. **24시간 재생성은 걷는다** — 덱은 떠나는 사람만큼만 바뀐다. 새 덱을 세우는 것은 덱이 없을 때 ·
--   내 요약이 바뀌었을 때 · 정책이 바뀌었을 때뿐이다.
-- - `refresh_discovery_snapshot_for(actor, seed)` 는 새 덱을 **여섯으로** 세운다(`fill_discovery_deck` 을 빈 덱에 부른다).
--   「직전 스냅샷에 있던 사람 제외」와 「모자라면 직전 사람으로 채우기」는 걷는다 — 덱이 이어지므로 「직전」이 없다.
--   덱은 **한 세대만** 남긴다(직전 제외가 두 세대를 남기던 까닭이었다).
--
-- ## 넓히기만 한다 (ADR 0071)
--
-- 운영에 떠 있는 옛 앱이 부르는 문(`my_discovery_board` · `my_discovery_snapshot` · `refresh_discovery_snapshot` ·
-- `restore_passed_connection`)은 **이름 · 서명 · 반환형이 그대로다.** 옛 앱의 새로고침 단추는 여전히 5분 쿨다운을
-- 지나 새 덱(여섯)을 세운다. 새 앱은 `my_discovery_snapshot` · `refresh_discovery_snapshot` 을 안 부른다 — 그 둘과
-- `discovery_refresh_cooldown` 을 걷는 좁히기는 새 앱이 운영에 선 뒤의 별도 걸음이다(`docs/product/gaps.md`).
--
-- 이미 선 덱(열 명)은 지우지 않는다 — 떠나는 사람만큼 줄다 여섯에서 채워지기 시작한다. 지우면 사람이 보던 얼굴이
-- 까닭 없이 사라진다.
--
-- 되돌리기(`restore_passed_connection`)는 그대로다 — 돌아온 사람은 덱 맨 앞에 서고 **덱이 잠시 일곱이어도 된다.**
-- 맨 뒤 한 명을 빼면 방금 붙은 사람이 말없이 사라진다. 채우기는 여섯까지만 채우고 넘친 것을 자르지 않는다.
--
-- 재는 자리는 `supabase/tests/09_discovery_board.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 자리 수
-- ---------------------------------------------------------------------------

/** 덱에 서는 자리 수 — 운영자 결정(2026-09-27). TS 의 `DISCOVERY_POLICY.pageSize` 가 같은 수를 적는다 */
create function public.discovery_deck_size()
returns integer
language sql
immutable
set search_path = ''
as $$ select 6 $$;

revoke execute on function public.discovery_deck_size() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 2. 채우는 문
-- ---------------------------------------------------------------------------

/**
 * 덱의 떠난 자리를 걷고 여섯에 모자란 만큼 뒤에 채운다. 새로 선 자리 수를 낸다.
 *
 * 부르는 쪽이 자격(로그인 · 정지 · 참여 · 지금 요약)을 먼저 묻는다 — 이 문은 묻지 않는다. 아무에게도 안 연다.
 */
create function public.fill_discovery_deck(p_actor uuid, p_deck uuid, p_seed text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  my_need jsonb;
  my_chart jsonb;
  live integer;
  next_at integer;
  wanted integer;
  written integer;
begin
  select p.element_summary, p.need_summary into my_summary, my_need
  from public.discovery_profile p where p.user_id = p_actor;

  select pe.current_chart into my_chart
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  /*
    **떠난 자리를 걷는다.** 넘긴 사람 · 요청이 오간 사람 · 참여를 끈 사람 · 차단 · 요약이 바뀐 사람. 걷지 않고 두면
    그 사람이 자격을 되찾는 날 옛 자리로 되살아나 덱이 여섯을 넘는다. 요약이 바뀐 사람은 풀에 남아 있으면 지금
    요약으로 다시 뽑힐 수 있다.
  */
  delete from public.discovery_candidate_slot s
  where s.snapshot_id = p_deck
    and not exists (
      select 1 from public.discovery_profile theirs
      where theirs.user_id = s.candidate_user_id
        and theirs.element_summary = s.candidate_summary
        and public.discovery_eligible(p_actor, s.candidate_user_id)
    );

  select count(*)::int, coalesce(max(s.position) + 1, 0)
    into live, next_at
  from public.discovery_candidate_slot s where s.snapshot_id = p_deck;

  wanted := greatest(0, public.discovery_deck_size() - live);
  if wanted = 0 then
    return 0;
  end if;

  with eligible as (
    select
      other.user_id,
      public.discovery_need_complement_v2(my_need, my_summary, other.need_summary, other.element_summary)
        as complement,
      public.discovery_count_balance_v1(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements_v1(my_summary, other.element_summary) as supplied,
      public.discovery_preview_score_v2(
        my_chart, my_summary, my_need, tp.current_chart, other.element_summary, other.need_summary) as score,
      other.element_summary as summary
    from public.discovery_profile other
    join public.app_user tu on tu.id = other.user_id
    join public.person tp on tp.id = tu.self_person_id
    where public.discovery_eligible(p_actor, other.user_id)
      -- 지금 덱에 선 사람은 다시 뽑지 않는다
      and not exists (
        select 1 from public.discovery_candidate_slot s
        where s.snapshot_id = p_deck and s.candidate_user_id = other.user_id
      )
  ),
  scored as (
    select e.*, public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
  ),
  sizes as (
    select count(*)::int as n from scored
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select s.*, row_number() over (order by s.score desc, s.user_id) as rnk from scored s
  ),
  /*
    **자리마다 동전 하나** — 20% 면 그 자리는 잘라 낸 아래에서 온다. 옛 「열에 둘」이 한 자리씩 뽑는 모양으로
    옮겨 온 것이다. 동전도 씨앗에서 나온다 — 같은 씨앗이면 같은 덱이다.
  */
  coins as (
    select count(*) filter (
      where (('x' || substr(md5(p_seed || ':seat:' || j), 1, 8))::bit(32)::bigint::double precision + 0.5)
            / 4294967296.0 < 0.2
    )::int as wander
    from generate_series(1, wanted) as j
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit (wanted - (select wander from coins))
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit (select wander from coins)
  ),
  picked as (
    select user_id, supplied, summary, complement, balance, score, u, exploration from tops
    union all
    select user_id, supplied, summary, complement, balance, score, u, exploration from explorers
  ),
  -- 한 층이 모자라면 다른 층에서 가중 무작위로 채운다 — 모자랄 때만 도는 뒷자리다
  filler as (
    select s.user_id, s.supplied, s.summary, s.complement, s.balance, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, wanted - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as total,
      count(*) filter (where exploration)::int as explorers
    from chosen
  ),
  sorted as (
    select c.*, row_number() over (
      order by power(c.u, 1.0 / greatest(c.score, 0.0001)) desc, c.user_id
    ) as ti
    from chosen c where not c.exploration
  ),
  wandering as (
    select c.*, row_number() over (order by c.u, c.user_id) as ei
    from chosen c where c.exploration
  ),
  -- 탐색 자리는 새로 채우는 자리들 사이에 고르게 선다 — 앞뒤에 몰리지 않게
  slots as (
    select i as ei,
      floor((i * counts.total)::numeric / (counts.explorers + 1))::int as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.total - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select next_at + seats.idx as position, seats.is_exploration,
      coalesce(w.user_id, t.user_id) as user_id,
      coalesce(w.supplied, t.supplied) as supplied,
      coalesce(w.summary, t.summary) as summary,
      coalesce(w.complement, t.complement) as complement,
      coalesce(w.balance, t.balance) as balance
    from seats
    left join wandering w on seats.is_exploration and w.ei = seats.ei
    left join sorted t on not seats.is_exploration and t.ti = seats.top_index
  ),
  kept as (
    insert into public.discovery_candidate_slot (
      snapshot_id, position, candidate_user_id, candidate_summary,
      exploration, supplied_elements, balance_band
    )
    select p_deck, placed.position, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  -- 노출 기록은 **덱에 실린 때** 난다 — 새로 붙은 사람만 적힌다(ADR 0037 의 뜻 그대로)
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'v2-beta', placed.position, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  return written;
end;
$$;

revoke execute on function public.fill_discovery_deck(uuid, uuid, text) from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 3. 새 덱을 세우는 문 — 여섯, 한 세대 (서명 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_summary jsonb;
  opted timestamptz;
  made uuid;
begin
  if p_actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(p_actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  insert into public.discovery_candidate (user_id, policy_version, viewer_summary)
  values (p_actor, 'v2-beta', my_summary)
  returning id into made;

  perform public.fill_discovery_deck(p_actor, made, p_seed);

  -- 덱은 이어지므로 「직전」이 없다 — 한 세대만 남긴다
  delete from public.discovery_candidate s
  where s.user_id = p_actor and s.id <> made;

  return made;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. 읽는 문 — 읽을 때 채운다 (반환형 그대로)
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
