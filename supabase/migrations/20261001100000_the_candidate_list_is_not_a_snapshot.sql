-- 후보 목록을 든 표가 용어집의 이름을 든다 (G-43, ADR 0088)
--
-- 「스냅샷」은 용어집이 **여덟 글자 스냅샷**에 남긴 말이다. 뽑아 둔 추천 목록은 「후보 목록」이라
-- 부르는데 표 이름이 아직 그 말을 들고 있었다(CONTEXT.md §10).
--
--   discovery_snapshot      → discovery_candidate
--   discovery_snapshot_slot → discovery_candidate_slot
--
-- **표 둘만 바꾼다**(2026-09-23 결정). 앱이 부르는 RPC 셋(`my_discovery_snapshot` ·
-- `refresh_discovery_snapshot` · `refresh_discovery_snapshot_for`)과 칸 `snapshot_id` 는 그대로 둔다 —
-- RPC 이름을 바꾸면 넓히고 좁히는 세 걸음이고 뜻은 안 갈린다. §10 이 까닭과 함께 든다.
--
-- ## 한 걸음으로 된다
--
-- 앱은 이 표를 **직접 읽지 않는다** — `.from('discovery_snapshot')` 0건, 부르는 것은 위 RPC 셋이다.
-- 표에 정책도 없다(RLS 는 켜져 있고 문은 전부 definer 함수다). 그래서 이름을 바꾸고 그 표를 부르는
-- 함수 여섯을 다시 적으면 떠 있는 옛 앱에도 안전하다.
--
-- 표 이름을 바꾸면 plpgsql 과 `begin atomic` 이 아닌 sql 함수는 **글자로 적힌 이름**을 부를 때
-- 찾으므로 깨진다. 그래서 여섯을 2026-09-23 의 살아 있는 정의(`pg_get_functiondef`)에서 떠 표
-- 이름만 갈았다. 서명 · 보안 · `search_path` · 문장 · 나머지 본문은 그대로이고 `create or replace`
-- 라 권한도 남는다. 제약 · 인덱스 · 시퀀스의 이름도 표를 따라 옮긴다(칸 이름이 든 것은 칸 그대로).

alter table public.discovery_snapshot rename to discovery_candidate;
alter table public.discovery_snapshot_slot rename to discovery_candidate_slot;

alter table public.discovery_candidate rename constraint discovery_snapshot_pkey to discovery_candidate_pkey;
alter table public.discovery_candidate rename constraint discovery_snapshot_user_id_fkey to discovery_candidate_user_id_fkey;
alter index public.discovery_snapshot_by_user rename to discovery_candidate_by_user;
alter sequence public.discovery_snapshot_seq_seq rename to discovery_candidate_seq_seq;

alter table public.discovery_candidate_slot rename constraint discovery_snapshot_slot_pkey to discovery_candidate_slot_pkey;
alter table public.discovery_candidate_slot rename constraint discovery_snapshot_slot_position_check to discovery_candidate_slot_position_check;
alter table public.discovery_candidate_slot rename constraint discovery_snapshot_slot_snapshot_id_candidate_user_id_key to discovery_candidate_slot_snapshot_id_candidate_user_id_key;
alter table public.discovery_candidate_slot rename constraint discovery_snapshot_slot_snapshot_id_fkey to discovery_candidate_slot_snapshot_id_fkey;
alter table public.discovery_candidate_slot rename constraint discovery_snapshot_slot_candidate_user_id_fkey to discovery_candidate_slot_candidate_user_id_fkey;

-- ── 표를 부르는 함수 여섯 — 살아 있는 정의에서 표 이름만 갈았다 ──────────────

CREATE OR REPLACE FUNCTION public.my_discovery_snapshot()
 RETURNS TABLE(generated_at timestamp with time zone, wait_seconds integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    s.generated_at,
    greatest(0, ceil(extract(epoch from
      (s.generated_at + public.discovery_refresh_cooldown()) - now())))::integer
  from public.discovery_candidate s
  where s.user_id = (select auth.uid())
  order by s.seq desc
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_discovery_snapshot()
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  last_at timestamptz;
  made uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select s.generated_at into last_at
  from public.discovery_candidate s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if last_at is not null and last_at > now() - public.discovery_refresh_cooldown() then
    raise exception '방금 새로 받았습니다. 잠시 뒤에 다시 받아 주세요.' using errcode = '55000';
  end if;

  -- 씨앗은 **DB 가 짓는다.** 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다.
  made := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);

  return (select s.generated_at from public.discovery_candidate s where s.id = made);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  my_summary jsonb;
  opted timestamptz;
  previous uuid;
  made uuid;
  written integer;
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

  select s.id into previous
  from public.discovery_candidate s
  where s.user_id = p_actor
  order by s.seq desc
  limit 1;

  insert into public.discovery_candidate (user_id, policy_version, viewer_summary)
  values (p_actor, 'discovery-v1', my_summary)
  returning id into made;

  with eligible as (
    select
      other.user_id,
      public.discovery_deficit_complement_v1(my_summary, other.element_summary) as complement,
      public.discovery_count_balance_v1(my_summary, other.element_summary) as balance,
      public.discovery_supplied_elements_v1(my_summary, other.element_summary) as supplied,
      other.element_summary as summary,
      exists (
        select 1 from public.discovery_candidate_slot s
        where s.snapshot_id = previous and s.candidate_user_id = other.user_id
      ) as shown_before
    from public.discovery_profile other
    where public.discovery_eligible(p_actor, other.user_id)
  ),
  scored as (
    select e.*, e.complement * 0.3 + e.balance * 0.7 as score,
      public.discovery_seeded_unit(p_seed, e.user_id) as u
    from eligible e
  ),
  fresh as (
    select s.* from scored s where not s.shown_before
  ),
  sizes as (
    select count(*)::int as n from fresh
  ),
  keep as (
    select case when sizes.n < 20 then sizes.n else ceil(sizes.n * 0.2)::int end as k
    from sizes
  ),
  ranked as (
    select f.*, row_number() over (order by f.score desc, f.user_id) as rnk from fresh f
  ),
  tops as (
    select r.*, false as exploration
    from ranked r, keep
    where r.rnk <= keep.k
    order by power(r.u, 1.0 / greatest(r.score, 0.0001)) desc, r.user_id
    limit 8
  ),
  explorers as (
    select r.*, true as exploration
    from ranked r, keep
    where r.rnk > keep.k
    order by r.u, r.user_id
    limit 2
  ),
  picked as (
    select user_id, supplied, summary, complement, balance, score, u, exploration from tops
    union all
    select user_id, supplied, summary, complement, balance, score, u, exploration from explorers
  ),
  filler as (
    select s.user_id, s.supplied, s.summary, s.complement, s.balance, s.score, s.u,
      false as exploration
    from scored s
    where not exists (select 1 from picked p where p.user_id = s.user_id)
    order by s.shown_before, power(s.u, 1.0 / greatest(s.score, 0.0001)) desc, s.user_id
    limit (select greatest(0, 10 - (select count(*)::int from picked)))
  ),
  chosen as (
    select * from picked
    union all
    select * from filler
  ),
  counts as (
    select count(*)::int as wanted,
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
  slots as (
    select i as ei,
      (floor((i * counts.wanted)::numeric / (counts.explorers + 1))::int - 1) as at
    from counts, generate_series(1, counts.explorers) as i
  ),
  seats as (
    select s.idx, slots.ei, (slots.ei is not null) as is_exploration,
      sum(case when slots.ei is null then 1 else 0 end)
        over (order by s.idx rows between unbounded preceding and current row) as top_index
    from counts, generate_series(0, counts.wanted - 1) as s(idx)
    left join slots on slots.at = s.idx
  ),
  placed as (
    select seats.idx, seats.is_exploration,
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
    select made, placed.idx, placed.user_id, placed.summary, placed.is_exploration,
      placed.supplied, public.discovery_balance_band(placed.balance)
    from placed
    returning 1
  ),
  logged as (
    insert into public.discovery_impression (
      viewer_user_id, candidate_user_id, policy_version, position, exploration,
      viewer_summary, candidate_summary, supplied_elements, complement, combined_balance
    )
    select p_actor, placed.user_id, 'discovery-v1', placed.idx, placed.is_exploration,
      my_summary, placed.summary, placed.supplied, placed.complement, placed.balance
    from placed
    returning 1
  )
  select count(*) into written from kept;

  delete from public.discovery_candidate s
  where s.user_id = p_actor
    and s.id not in (
      select g.id from (
        select d.id, row_number() over (order by d.seq desc) as gen
        from public.discovery_candidate d where d.user_id = p_actor
      ) g where g.gen <= 2
    );

  return made;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.may_see_photo(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.restore_passed_connection(p_candidate_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  snap uuid;
  mine jsonb;
  theirs jsonb;
  supplied text[];
  slot record;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;
  -- 같은 계정의 복원들을 직렬화한다.
  perform 1 from public.app_user where id = actor for update;
  if not public.discovery_pair_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 인연을 다시 만나볼 수 없습니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.discovery_passed p
                 where p.user_id = actor and p.passed_user_id = p_candidate_user_id) then
    raise exception '이미 복원되었거나 보관 중인 인연이 아닙니다. 목록을 새로 열어 주세요.' using errcode = '42501';
  end if;

  -- 지나침을 해제하기 전에 현재 스냅샷을 준비한다. 자동 추천으로 먼저 끼어들지 않는다.
  perform 1 from public.my_discovery_board();
  select s.id into snap from public.discovery_candidate s
    where s.user_id = actor order by s.seq desc limit 1 for update;
  select p.element_summary into mine from public.discovery_profile p where p.user_id = actor;
  select p.element_summary into theirs from public.discovery_profile p where p.user_id = p_candidate_user_id;
  supplied := public.discovery_supplied_elements_v1(mine, theirs);

  delete from public.discovery_candidate_slot s
    where s.snapshot_id = snap and s.candidate_user_id = p_candidate_user_id;
  -- 높은 자리부터 옮겨 즉시 검사되는 복합 기본키와 충돌하지 않는다.
  for slot in select s.position from public.discovery_candidate_slot s
              where s.snapshot_id = snap order by s.position desc loop
    update public.discovery_candidate_slot set position = slot.position + 1
      where snapshot_id = snap and position = slot.position;
  end loop;
  insert into public.discovery_candidate_slot
    (snapshot_id, position, candidate_user_id, candidate_summary, exploration, supplied_elements, balance_band)
  values (snap, 0, p_candidate_user_id, theirs, false, supplied,
          public.discovery_balance_band(public.discovery_count_balance_v1(mine, theirs)));
  insert into public.discovery_impression
    (viewer_user_id, candidate_user_id, policy_version, position, exploration,
     viewer_summary, candidate_summary, supplied_elements, complement, combined_balance)
  values (actor, p_candidate_user_id, 'discovery-v1', 0, false, mine, theirs, supplied,
          public.discovery_deficit_complement_v1(mine, theirs), public.discovery_count_balance_v1(mine, theirs));
  delete from public.discovery_passed p
    where p.user_id = actor and p.passed_user_id = p_candidate_user_id;
  return jsonb_build_object(
    'card', (select to_jsonb(c) from public.my_discovery_board() c where c.candidate_user_id = p_candidate_user_id),
    'passed', (select coalesce(jsonb_agg(p), '[]'::jsonb) from public.my_passed_connections() p)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_discovery_board()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer, exploration boolean, supplied_elements text[], balance_band text, preview_score integer, activity text)
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
    exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id),
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, slot.candidate_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, slot.candidate_summary) * 0.7
    )))::integer,
    public.activity_band_of(slot.candidate_user_id)
  from public.discovery_candidate_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$
;

