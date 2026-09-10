-- 후보 카드에도 정렬에 쓰던 두 축의 합을 `첫인상 궁합`으로 보여 준다.
-- 상세 궁합 Reading의 AI 점수와는 다른 값이다: 오행 보완 54%와 두 사람의
-- 오행 균형 46%만 반영한다. 출생 원문이나 상대의 전체 오행표는 여전히 내주지 않는다.

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
    slot.balance_band,
    least(100, greatest(0, round(
      public.discovery_complement(my_summary, slot.candidate_summary) * 0.54
      + public.discovery_combined_balance(my_summary, slot.candidate_summary) * 0.46
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
