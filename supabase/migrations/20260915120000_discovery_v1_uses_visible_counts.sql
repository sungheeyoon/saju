-- discovery-v1: 두 사람의 보이는 글자 수로 오행 첫인상을 계산한다.
-- 균형 70% + 연속적인 상호보완 30%. 이 값은 상세 궁합 점수가 아니다.

create or replace function public.discovery_count_balance_v1(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  with total as (
    select ((a ->> 'glyphCount')::numeric + (b ->> 'glyphCount')::numeric) as n
  )
  select greatest(0, least(100,
    (1 - sum(abs(
      ((a -> 'counts' ->> e)::numeric + (b -> 'counts' ->> e)::numeric) / total.n - 0.2
    )) / 1.6) * 100
  ))
  from unnest(array['木', '火', '土', '金', '水']) as e, total;
$$;

create or replace function public.discovery_deficit_complement_one_way_v1(mine jsonb, partner jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select sum(
    greatest(0, 0.2 - (mine -> 'counts' ->> e)::numeric / (mine ->> 'glyphCount')::numeric)
    * ((partner -> 'counts' ->> e)::numeric / (partner ->> 'glyphCount')::numeric)
  )
  from unnest(array['木', '火', '土', '金', '水']) as e;
$$;

create or replace function public.discovery_deficit_complement_v1(a jsonb, b jsonb)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(0, least(100, (
    public.discovery_deficit_complement_one_way_v1(a, b)
    + public.discovery_deficit_complement_one_way_v1(b, a)
  ) / 0.4 * 100));
$$;

create or replace function public.discovery_supplied_elements_v1(mine jsonb, partner jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(e order by ord), array[]::text[])
  from unnest(array['木', '火', '土', '金', '水']) with ordinality as t(e, ord)
  where (mine -> 'counts' ->> e)::numeric / (mine ->> 'glyphCount')::numeric < 0.2
    and (partner -> 'counts' ->> e)::numeric > 0;
$$;

revoke all on function public.discovery_count_balance_v1(jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.discovery_deficit_complement_one_way_v1(jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.discovery_deficit_complement_v1(jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.discovery_supplied_elements_v1(jsonb, jsonb) from anon, authenticated, public;

create or replace function public.refresh_discovery_snapshot_for(p_actor uuid, p_seed text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  my_summary jsonb;
  my_revision uuid;
  opted timestamptz;
  current_revision uuid;
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
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.element_revision_id, p.opted_in_at
    into my_summary, my_revision, opted
  from public.discovery_profile p where p.user_id = p_actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  select pe.current_revision_id into current_revision
  from public.app_user u
  join public.person pe on pe.id = u.self_person_id
  where u.id = p_actor;

  if my_revision is null or my_revision is distinct from current_revision then
    raise exception '내 오행 요약이 지금 판본의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id into previous
  from public.discovery_snapshot s
  where s.user_id = p_actor
  order by s.seq desc
  limit 1;

  insert into public.discovery_snapshot (user_id, policy_version, viewer_summary)
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
        select 1 from public.discovery_snapshot_slot s
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
    insert into public.discovery_snapshot_slot (
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

  delete from public.discovery_snapshot s
  where s.user_id = p_actor
    and s.id not in (
      select g.id from (
        select d.id, row_number() over (order by d.seq desc) as gen
        from public.discovery_snapshot d where d.user_id = p_actor
      ) g where g.gen <= 2
    );

  return made;
end;
$$;

drop function if exists public.my_discovery_board();

create or replace function public.my_discovery_board()
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  has_photo boolean,
  seat integer,
  exploration boolean,
  supplied_elements text[],
  balance_band text,
  preview_score integer
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
  snap_policy text;
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

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_snapshot s
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
    )))::integer
  from public.discovery_snapshot_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$$;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;
