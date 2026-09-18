-- 지나친 인연: 보관 순위·현재 공개 자격·사진·복원을 같은 기준으로 맞춘다.
-- 기존 배포 마이그레이션과 영구 숨김 자료는 변경하지 않는다.

create or replace function public.discovery_pair_eligible(viewer uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null
     and other is not null
     and viewer <> other
     and not public.discovery_unavailable(viewer, other)
     and exists (
       select 1
       from public.discovery_profile mine
       join public.app_user mu on mu.id = mine.user_id
       join public.person mp on mp.id = mu.self_person_id
       join public.person_chart_revision mr on mr.id = mine.element_revision_id
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       join public.person_chart_revision tr on tr.id = theirs.element_revision_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         -- 둘 다 요약이 지금 판본의 것이어야 한다. 낡은 값으로 줄 세우지 않는다.
         and mine.element_revision_id = mp.current_revision_id
         and theirs.element_revision_id = tp.current_revision_id
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다. 내 조건 밖의 사람을 안 보는 것과
         -- 나를 조건 밖으로 둔 사람에게 안 보이는 것은 같은 규칙의 두 얼굴이다.
         and (mine.prefer_gender = 'any' or tr.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mr.gender = theirs.prefer_gender)
     );
$$;

revoke execute on function public.discovery_pair_eligible(uuid, uuid) from anon, public, authenticated;

create or replace function public.discovery_passed_kept(viewer uuid, other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from (
      select p.passed_user_id from public.discovery_passed p
      where p.user_id = viewer
      order by p.passed_at desc, p.passed_user_id desc limit 20
    ) recent where recent.passed_user_id = other
  );
$$;
revoke all on function public.discovery_passed_kept(uuid, uuid) from public, anon, authenticated;

create or replace function public.discovery_passed_active(viewer uuid, other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.discovery_passed p where p.user_id = viewer
      and p.passed_user_id = other
      and (p.passed_at > now() - interval '24 hours' or public.discovery_passed_kept(viewer, other))
  );
$$;

create or replace function public.discovery_eligible(viewer uuid, other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.discovery_pair_eligible(viewer, other)
     and not public.discovery_passed_active(viewer, other);
$$;
create or replace function public.my_passed_connections()
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  has_photo boolean,
  passed_at timestamptz,
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
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
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
    exists (select 1 from public.profile_photo f where f.user_id = p.passed_user_id),
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, theirs.element_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, theirs.element_summary) * 0.7
    )))::integer
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  where p.user_id = actor
    and public.discovery_passed_kept(actor, p.passed_user_id)
    and public.discovery_pair_eligible(actor, p.passed_user_id)
  order by p.passed_at desc, p.passed_user_id desc
  limit 20;
end;
$$;

revoke execute on function public.my_passed_connections() from anon, public;
grant execute on function public.my_passed_connections() to authenticated;
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
$$;


-- 복원은 자격 검사·보관 해제·스냅샷 앞자리·현재 노출 근거를 한 트랜잭션에서 바꾼다.
-- 클라이언트는 상대 ID만 넘긴다. 사진과 점수는 현재의 공개 자료로 다시 읽는다.
create or replace function public.restore_passed_connection(p_candidate_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
  select s.id into snap from public.discovery_snapshot s
    where s.user_id = actor order by s.seq desc limit 1 for update;
  select p.element_summary into mine from public.discovery_profile p where p.user_id = actor;
  select p.element_summary into theirs from public.discovery_profile p where p.user_id = p_candidate_user_id;
  supplied := public.discovery_supplied_elements_v1(mine, theirs);

  delete from public.discovery_snapshot_slot s
    where s.snapshot_id = snap and s.candidate_user_id = p_candidate_user_id;
  -- 높은 자리부터 옮겨 즉시 검사되는 복합 기본키와 충돌하지 않는다.
  for slot in select s.position from public.discovery_snapshot_slot s
              where s.snapshot_id = snap order by s.position desc loop
    update public.discovery_snapshot_slot set position = slot.position + 1
      where snapshot_id = snap and position = slot.position;
  end loop;
  insert into public.discovery_snapshot_slot
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
$$;
revoke all on function public.restore_passed_connection(uuid) from public, anon;
grant execute on function public.restore_passed_connection(uuid) to authenticated;
notify pgrst, 'reload schema';
