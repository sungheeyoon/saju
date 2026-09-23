-- 이용 정지 — **DB 가 던지는 거절 문장도 「이용이 정지된 계정입니다.」다** (G-49)
--
-- 2026-09-23 에 화면 문구는 「중지」에서 「이용 정지」로 옮겼는데(CONTEXT.md 「이용 정지」), 정지된
-- 계정을 거절하는 DB 함수는 옛 문장을 그대로 던졌다. `app/db-error.ts` 는 우리 한국어 문장을 그대로
-- 화면에 세우므로 그 옛말이 사람에게 닿을 수 있었다.
--
-- 이 마이그레이션은 **문장 하나만 바꾼다.** 2026-09-23 에 로컬과 운영의 `pg_proc.prosrc` 를 재어
-- 옛 문장을 던지는 함수 21개를 찾았고(두 곳의 본문 md5 가 같았다), 각 함수를 **살아 있는 정의**
-- (`pg_get_functiondef`)에서 떠서 문장만 갈았다. 서명 · 보안 · `search_path` · errcode · 나머지
-- 본문은 그대로다. `create or replace` 라 권한과 주석도 남는다.
--
--   - 20개는 `using errcode = '42501'` 로 던졌다.
--   - `share_my_reading` 하나는 마침표도 errcode 도 없이(`P0001`) 던졌다. 문장만 맞추고 errcode 는
--     안 건드린다 — 코드를 바꾸는 것은 이 틈의 일이 아니다.
--
-- 재는 자리는 `supabase/tests/36_suspended_sentence.test.sql` — 옛 문장을 던지는 함수가 0 인지와,
-- 이용이 정지된 계정으로 대표 함수들을 불러 새 문장이 서는지.

CREATE OR REPLACE FUNCTION public.add_person_revision(p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  /** 관문이 값 검사보다 먼저다 — 남의 것을 두드린 사람은 그 사실부터 들어야 한다 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  return public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.block_user(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 차단할 수 없습니다.' using errcode = '22023';
  end if;

  -- 넣는 것과 거두는 것 사이에 요청 하나가 끼면 차단된 쌍에 pending 이 남는다.
  perform public.lock_users(actor, p_user_id);

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  insert into public.block (user_id, blocked_user_id)
  select actor, p_user_id
  where exists (select 1 from public.app_user u where u.id = p_user_id)
  on conflict do nothing;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and ((requester_user_id = actor and addressee_user_id = p_user_id)
        or (requester_user_id = p_user_id and addressee_user_id = actor))
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.complete_signup(p_code text, p_nickname text, p_version text, p_schedule_id bigint, p_improvement boolean, p_contact boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  now_row record;
  code_row public.signup_code;
  wanted text := upper(btrim(coalesce(p_code, '')));
  name text := btrim(coalesce(p_nickname, ''));
  taken integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내 판본을 알 수 없습니다.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select * into now_row from public.current_beta_schedule();

  if not found or now_row.operator_contact is null then
    raise exception '아직 테스트 기간이 정해지지 않았습니다.' using errcode = 'check_violation';
  end if;

  if p_schedule_id is distinct from now_row.schedule_id then
    raise exception '안내가 바뀌었습니다. 새로고침 후 다시 확인해 주세요.'
      using errcode = 'check_violation';
  end if;

  select * into account from public.app_user u where u.id = actor for update;

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **이름은 없을 때만 짓는다.** 있는 사람이 이 문으로 이름을 갈아 끼우게 두면 가입
    문이 곧 개명 문이 되고, 개명에는 이미 자기 자리가 있다(`save_my_profile`).
  */
  if account.nickname is null then
    if length(name) < 2 or length(name) > 8 then
      raise exception '닉네임은 2~8자입니다.' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.app_user u
      where u.id <> actor
        and u.nickname is not null
        and public.nickname_key(u.nickname) = public.nickname_key(name)
    ) then
      raise exception '이미 쓰고 있는 닉네임입니다.' using errcode = '23505';
    end if;
  else
    name := account.nickname;
  end if;

  /*
    **코드는 처음 들어올 때만 묻는다.**

    행을 잠그고 나서 센다. 안 잠그면 같은 코드로 동시에 눌린 둘이 각자 「아직 자리가
    있다」를 읽고 둘 다 들어온다 — 정원이 하나 넘치는 자리가 정확히 여기다.
  */
  if account.signed_up_at is null then
    if wanted = '' then
      raise exception '테스트 코드를 넣어 주세요.' using errcode = '22023';
    end if;

    select * into code_row from public.signup_code c where c.code = wanted for update;

    /*
      **없는 코드와 지난 코드를 한 문장으로 말한다.** 갈라 말하면 「그런 코드는 있는데
      어제 것」이 되고, 그것은 코드 하나를 맞혔다는 답이다.
    */
    if not found
       or public.signup_today() not between code_row.valid_on and code_row.valid_until then
      raise exception '지금 쓸 수 있는 코드가 아닙니다.' using errcode = '42501';
    end if;

    select count(*) into taken
    from public.app_user u where u.signup_code = code_row.code;

    if taken >= code_row.max_uses then
      raise exception '이 코드는 오늘 정원이 찼습니다.' using errcode = '42501';
    end if;
  end if;

  update public.app_user u
  set nickname = name,
      signup_code = coalesce(u.signup_code, code_row.code),
      signed_up_at = coalesce(u.signed_up_at, now()),
      notice_version = p_version,
      notice_schedule_id = now_row.schedule_id,
      notice_ends_on = now_row.ends_on,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = actor;

  /*
    개선 동의를 끄면서 가입하는 사람은 없다(처음 가입은 답이 없던 상태다). 그런데 안내가
    바뀌어 다시 지나는 사람은 켰던 것을 끌 수 있다 — `acknowledge_notice` 와 같은 자리다.
  */
  if p_improvement = false then
    delete from public.reading_feedback f where f.respondent_user_id = actor;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_managed_person(p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /** 관문이 값 검사보다 먼저다 — `create_self_person` 과 같은 자리, 같은 까닭 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_add_revision(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  return new_person;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_self_person(p_local_label text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  /**
   * **관문이 값 검사보다 먼저다.**
   *
   * 여덟 글자를 먼저 재면, 가입을 안 끝낸 사람이 빈 값으로 두드렸을 때 「여덟 글자를
   * 함께 보내야 합니다」(22004)가 난다 — 그 사람이 들어야 할 말은 「가입을 먼저
   * 끝내 주세요」다. 자격을 다 물은 **뒤에** 값을 본다.
   */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  new_person := public.new_person_with_input(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_discovery_participation(p_person_id uuid, p_summary jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /*
    **여기서는 행을 안 잠근다.** 이 함수는 홈을 열 때마다 도는 자리이고, 잠그면 한 사람의
    두 탭이 서로를 기다린다. 겹쳐 들어와도 마지막 쓰기가 같은 값을 쓴다.
  */
  select * into account from public.app_user where id = actor;

  -- 내 사주가 아니면 아무 일도 아니다. 가족·친구를 고쳤다고 내 노출이 바뀌지 않는다.
  if account.self_person_id is null or account.self_person_id is distinct from p_person_id then
    return false;
  end if;

  if account.nickname is null then
    return false;
  end if;

  select opted_out_at into opted_out from public.discovery_profile where user_id = actor;
  if opted_out is not null then
    return false;
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    return false;
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
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
    )))::integer,
    public.activity_band_of(slot.candidate_user_id)
  from public.discovery_snapshot_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.my_passed_connections()
 RETURNS TABLE(candidate_user_id uuid, nickname text, intro text, has_photo boolean, passed_at timestamp with time zone, supplied_elements text[], balance_band text, preview_score integer)
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
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if last_at is not null and last_at > now() - public.discovery_refresh_cooldown() then
    raise exception '방금 새로 받았습니다. 잠시 뒤에 다시 받아 주세요.' using errcode = '55000';
  end if;

  -- 씨앗은 **DB 가 짓는다.** 밖에서 받으면 씨앗을 바꿔 가며 다시 뽑을 수 있다.
  made := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);

  return (select s.generated_at from public.discovery_snapshot s where s.id = made);
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
$function$
;

CREATE OR REPLACE FUNCTION public.report_chat_message(p_message_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
  chosen public.chat_message;
  room public.chat_room;
  context integer := public.chat_snapshot_context();
  new_report uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  select m.* into chosen from public.chat_message m where m.id = p_message_id;

  if found then
    select r.* into room
    from public.chat_room r
    where r.id = chosen.room_id and public.chat_room_readable(r.id);
  end if;

  if chosen.id is null or room.id is null then
    raise exception 'chat: no such message' using errcode = '42501';
  end if;

  if chosen.sender_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (actor, chosen.sender_user_id, p_reason, trimmed)
  returning id into new_report;

  insert into public.chat_report_snapshot (
    report_id, match_id, message_id, context_before, context_after, messages)
  select
    new_report, room.match_id, chosen.id, context, context,
    coalesce(jsonb_agg(jsonb_build_object(
      'message_id', x.id,
      'seq', x.seq,
      'sender_user_id', x.sender_user_id,
      'body', x.body,
      'created_at', x.created_at,
      'chosen', x.id = chosen.id
    ) order by x.seq), '[]'::jsonb)
  from (
    (select b.* from public.chat_message b
     where b.room_id = room.id and b.seq < chosen.seq
     order by b.seq desc limit context)
    union all
    (select c.* from public.chat_message c where c.id = chosen.id)
    union all
    (select a.* from public.chat_message a
     where a.room_id = room.id and a.seq > chosen.seq
     order by a.seq asc limit context)
  ) x;

  return new_report;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.report_user(p_user_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  /**
   * **아무나 신고할 수는 없다.** 마주친 적 있는 사람만 신고할 수 있다 — 후보로 봤거나,
   * 요청을 주고받았거나, Match 가 성립한 사이다. 이 조건이 없으면 uuid 를 넣어 보는
   * 것만으로 남의 계정에 신고를 쌓을 수 있다.
   */
  if not exists (
    select 1 from public.discovery_impression i
    where i.viewer_user_id = actor and i.candidate_user_id = p_user_id
    union all
    select 1 from public.match_request r
    where (r.requester_user_id = actor and r.addressee_user_id = p_user_id)
       or (r.requester_user_id = p_user_id and r.addressee_user_id = actor)
    union all
    select 1 from public.match m
    where (m.user_low = actor and m.user_high = p_user_id)
       or (m.user_low = p_user_id and m.user_high = actor)
  ) then
    raise exception '마주친 적 없는 사람은 신고할 수 없습니다.' using errcode = '42501';
  end if;

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  select actor, p_user_id, p_reason, trimmed
  where exists (select 1 from public.app_user u where u.id = p_user_id);

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_account_deletion()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status = 'deletion_requested' then
    -- 두 번 눌러도 처음 요청한 시각을 밀어내지 않는다.
    return true;
  end if;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user
  set status = 'deletion_requested', deletion_requested_at = now()
  where id = actor;

  update public.discovery_profile
  set opted_in_at = null,
      element_summary = null,
      element_input_version = null,
      element_chart_engine_version = null
  where user_id = actor;

  with ended as (
    update public.match_request
    set status = case when requester_user_id = actor then 'cancelled' else 'rejected' end,
        decided_at = now()
    where status = 'pending'
      and (requester_user_id = actor or addressee_user_id = actor)
    returning id, requester_user_id, status
  )
  insert into public.notification (user_id, kind, request_id)
  select ended.requester_user_id, 'request_rejected', ended.id
  from ended
  where ended.status = 'rejected';

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.request_match(p_candidate_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_version integer;
  their_summary jsonb;
  their_version integer;
  shown public.discovery_impression;
  counted record;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 쪽 자격은 갈라서 말한다. 내가 고칠 수 있는 것이고, 이유를 모르면 못 고친다.
  select p.element_summary into my_summary
  from public.discovery_profile p
  where p.user_id = actor and p.opted_in_at is not null;

  if my_summary is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select * into counted from public.reading_credits_used(actor);

  if counted.used + counted.reserved + counted.requested >= public.reading_credit_limit_for(actor) then
    raise exception '풀이권이 없어 요청할 수 없습니다. 요청 한 건이 풀이권 한 번을 잡고, 동의가 나면 그 한 번으로 궁합 풀이가 만들어집니다.'
      using errcode = 'check_violation';
  end if;

  /** 상대 쪽은 **한 문장으로만** 거절하고, 자격은 후보 목록과 **같은 함수**에 묻는다. */
  if not public.discovery_eligible(actor, p_candidate_user_id) then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  select p.element_summary into their_summary
  from public.discovery_profile p
  where p.user_id = p_candidate_user_id;

  select pe.input_version into my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.input_version into their_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = p_candidate_user_id;

  /** **내가 본 그 카드**를 찾는다 — 요약 두 벌이 지금과 같은 기록만 고른다(ADR 0009). */
  select i.* into shown
  from public.discovery_impression i
  where i.viewer_user_id = actor
    and i.candidate_user_id = p_candidate_user_id
    and i.viewer_summary = my_summary
    and i.candidate_summary = their_summary
  order by i.shown_at desc
  limit 1;

  if their_summary is null or shown.id is null then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  insert into public.match_request (
    requester_user_id, addressee_user_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_version, their_version,
    shown.id, shown.policy_version,
    shown.supplied_elements,
    public.discovery_supplied_elements_v1(shown.candidate_summary, shown.viewer_summary),
    public.discovery_balance_band(shown.combined_balance)
  )
  returning id into new_request;

  insert into public.notification (user_id, kind, request_id)
  values (p_candidate_user_id, 'request_received', new_request);

  return new_request;

exception
  when unique_violation then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.respond_to_match_request(p_request_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  req public.match_request;
  requester_now integer;
  addressee_now integer;
  new_match uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  /** **`null` 은 답이 아니다** — 명시적 동의 경계에서 「모름」이 「예」로 읽히면 안 된다. */
  if p_accept is null then
    raise exception '수락인지 거절인지 정해 주세요.' using errcode = '22004';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** **읽고 → 잠그고 → 다시 읽는다.** 계정을 먼저, 요청을 나중에 — `block_user` 와 같은 차례다. */
  select * into req from public.match_request where id = p_request_id;

  -- 없는 요청과 남의 요청의 답이 **같다.**
  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  perform public.lock_users(req.requester_user_id, actor);

  select * into req from public.match_request where id = p_request_id for update;

  if not found or req.addressee_user_id <> actor then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  if req.status <> 'pending' then
    return req.status;
  end if;

  /**
   * **기한이 지난 요청은 답이 아니라 만료다.**
   *
   * 미는 일은 cron 이 하지만 그것이 늦을 수 있다. 늦은 사이에 수락되면 이미 풀린
   * 풀이권으로 Match 가 서고, 그러면 예약이 지키던 약속이 깨진다.
   */
  if req.expires_at <= now() then
    update public.match_request
    set status = 'expired', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_expired', req.id);

    return 'expired';
  end if;

  /** **양쪽 계정이 살아 있어야 한다.** 상대가 중지됐다는 것은 알리지 않는다. */
  if exists (
    select 1 from public.app_user u
    where u.id in (req.requester_user_id, req.addressee_user_id) and u.status <> 'active'
  ) then
    raise exception '요청을 찾지 못했습니다.' using errcode = '42501';
  end if;

  /**
   * **그 사이에 입력이 바뀌었나** — 세는 수로 묻는다(ADR 0071).
   *
   * 앞서는 판본 id 를 견줬다. 같은 물음이고, 답이 달라지는 자리가 하나 있다: 출생지만
   * 고쳐 여덟 글자가 그대로여도 **입력은 바뀐 것이다.** 요청은 그때 동의하려던 입력에
   * 매여 있으므로 무효가 맞다.
   */
  select pe.input_version into requester_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.requester_user_id;

  select pe.input_version into addressee_now
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = req.addressee_user_id;

  if requester_now is distinct from req.requester_input_version
     or addressee_now is distinct from req.addressee_input_version
  then
    update public.match_request
    set status = 'invalidated', decided_at = now()
    where id = req.id;

    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_invalidated', req.id),
           (req.addressee_user_id, 'request_invalidated', req.id);

    return 'invalidated';
  end if;

  if p_accept is not true then
    update public.match_request
    set status = 'rejected', decided_at = now()
    where id = req.id;

    -- 거절은 요청한 쪽에만 알린다. 내가 거절했다는 것은 내가 안다.
    insert into public.notification (user_id, kind, request_id)
    values (req.requester_user_id, 'request_rejected', req.id);

    return 'rejected';
  end if;

  update public.match_request
  set status = 'accepted', decided_at = now()
  where id = req.id;

  /**
   * **동의 당시 여덟 글자를 베낀다** (#68). 값은 `person.current_chart` 에서 오고 앱은
   * 한 글자도 안 댄다 — 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없다.
   */
  insert into public.match (
    request_id, user_low, user_high,
    chart_low, chart_high, chart_engine_low, chart_engine_high
  )
  select
    req.id,
    least(req.requester_user_id, req.addressee_user_id),
    greatest(req.requester_user_id, req.addressee_user_id),
    lo.current_chart,
    hi.current_chart,
    lo.chart_engine_version,
    hi.chart_engine_version
  from public.app_user low_user
  join public.person lo on lo.id = low_user.self_person_id
  join public.app_user high_user
    on high_user.id = greatest(req.requester_user_id, req.addressee_user_id)
  join public.person hi on hi.id = high_user.self_person_id
  where low_user.id = least(req.requester_user_id, req.addressee_user_id)
  returning id into new_match;

  -- 성립은 **양쪽 다** 알아야 하는 사건이다.
  insert into public.notification (user_id, kind, request_id, match_id)
  values (req.requester_user_id, 'request_accepted', req.id, new_match),
         (req.addressee_user_id, 'request_accepted', req.id, new_match);

  /**
   * **동의가 예약을 쓴다** — 시도는 **요청자 이름으로** 선다.
   *
   * 여기서 던지면 **수락 전체가 되돌아간다.** 시도를 못 여는 이유는 여럿이고 그중 어느
   * 것도 「동의하지 말라」는 뜻이 아니다. 동의는 두 사람이 정한 사실이므로 그 사실을 못
   * 여는 시도가 취소하게 두지 않는다.
   */
  begin
    perform public.start_reading_run_for(
      req.requester_user_id, 'match', 'match-accept:' || req.id::text,
      null, null, new_match);
  exception
    when others then null;
  end;

  return 'accepted';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_my_profile(p_nickname text, p_intro text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  name text := btrim(p_nickname);
  about text := nullif(btrim(coalesce(p_intro, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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
$function$
;

CREATE OR REPLACE FUNCTION public.save_service_survey(p_liked text[], p_unknown text[], p_improve text[], p_improve_text text, p_wants text[], p_wants_new text[], p_price_solo text, p_price_pair text, p_price_factors text[], p_free_text text, p_price_options text[], p_submit boolean DEFAULT false)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  ctx record;
  solo text := nullif(btrim(p_price_solo), '');
  pair text := nullif(btrim(p_price_pair), '');
  factors text[] := coalesce(p_price_factors, array[]::text[]);
  said text := nullif(btrim(p_improve_text), '');
  more text := nullif(btrim(p_free_text), '');
  asked text[];
  anything boolean;
  when_submitted timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /* 끝난 서비스가 새 자료를 받지 않는다 — 풀이 설문과 같은 규율이다 */
  if public.beta_is_over() then
    raise exception '비공개 테스트가 끝났습니다.' using errcode = 'check_violation';
  end if;

  select * into ctx from public.service_survey_context();

  if not ctx.consented then
    raise exception '설문은 풀이 개선에 활용하는 데 동의하신 뒤에 받을 수 있습니다.'
      using errcode = 'check_violation';
  end if;

  if ctx.schedule_id is null then
    raise exception '아직 시작하지 않았습니다.' using errcode = 'check_violation';
  end if;

  if public.survey_sole_conflict(p_liked, array['none', 'not_enough'])
     or public.survey_sole_conflict(p_unknown, array['all_known', 'not_sure'])
     or public.survey_sole_conflict(p_improve, array['none', 'unsure'])
     or public.survey_sole_conflict(p_wants, array['unsure', 'none_again'])
     or public.survey_sole_conflict(p_wants_new, array['none']) then
    raise exception '함께 고를 수 없는 답이 섞여 있습니다.' using errcode = 'check_violation';
  end if;

  if not ctx.read_solo then solo := null; end if;
  if not ctx.read_pair then pair := null; end if;
  if not (ctx.read_solo or ctx.read_pair) then factors := array[]::text[]; end if;

  asked := array(select s from unnest(array['solo', 'pair']) s
                 where (s = 'solo' and ctx.read_solo) or (s = 'pair' and ctx.read_pair));

  anything := coalesce(cardinality(p_liked), 0) > 0
           or coalesce(cardinality(p_unknown), 0) > 0
           or coalesce(cardinality(p_improve), 0) > 0
           or said is not null
           or coalesce(cardinality(p_wants), 0) > 0
           or coalesce(cardinality(p_wants_new), 0) > 0
           or solo is not null
           or pair is not null
           or cardinality(factors) > 0
           or more is not null;

  if p_submit and not anything then
    raise exception '답을 하나도 고르지 않으셨습니다.' using errcode = 'check_violation';
  end if;

  insert into public.service_survey as s (
    user_id, schedule_id, survey_version,
    liked, unknown_features, improve, improve_text,
    wants, wants_new,
    price_solo, price_pair, price_options, price_asked, price_factors, free_text,
    credits_left, usage, saved_at, submitted_at
  )
  values (
    actor, ctx.schedule_id, 'service-survey-v1',
    coalesce(p_liked, array[]::text[]),
    coalesce(p_unknown, array[]::text[]),
    coalesce(p_improve, array[]::text[]),
    said,
    coalesce(p_wants, array[]::text[]),
    coalesce(p_wants_new, array[]::text[]),
    solo, pair, coalesce(p_price_options, array[]::text[]), asked, factors, more,
    ctx.credits_left,
    jsonb_build_object(
      'readSolo', ctx.read_solo,
      'readPair', ctx.read_pair,
      'creditsLeft', ctx.credits_left,
      'readings', (select count(*) from public.reading r
                   where r.owner_user_id = actor
                      or (r.kind = 'match' and r.match_id in (
                            select m.id from public.match m
                            where m.user_low = actor or m.user_high = actor))),
      'matches', (select count(*) from public.match m
                  where m.user_low = actor or m.user_high = actor),
      'discovery', exists (select 1 from public.discovery_profile p
                           where p.user_id = actor and p.opted_in_at is not null)),
    now(),
    case when p_submit then now() end
  )
  on conflict (user_id) do update
  set liked = excluded.liked,
      unknown_features = excluded.unknown_features,
      improve = excluded.improve,
      improve_text = excluded.improve_text,
      wants = excluded.wants,
      wants_new = excluded.wants_new,
      price_solo = excluded.price_solo,
      price_pair = excluded.price_pair,
      price_options = excluded.price_options,
      price_asked = excluded.price_asked,
      price_factors = excluded.price_factors,
      free_text = excluded.free_text,
      credits_left = excluded.credits_left,
      usage = excluded.usage,
      survey_version = excluded.survey_version,
      saved_at = now(),
      submitted_at = coalesce(s.submitted_at, excluded.submitted_at),
      updated_at = case
        when p_submit and s.submitted_at is not null then now()
        else s.updated_at
      end
  returning s.submitted_at into when_submitted;

  return when_submitted;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.send_chat_message(p_match_id uuid, p_body text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  room public.chat_room;
  recent integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'chat: the body is blank' using errcode = '22023';
  end if;

  if length(p_body) > public.chat_message_max_length() then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 전송을 줄 세운다. 한도의 셈이 잠금 뒤에 있어야 두 창이 같은 29 를 못 본다.
  perform 1 from public.app_user u where u.id = actor for update;

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  if room.closed_at is not null then
    return 'closed';
  end if;

  select count(*) into recent
  from public.chat_message m
  where m.sender_user_id = actor
    and m.created_at > now() - public.chat_rate_window();

  if recent >= public.chat_rate_limit() then
    insert into public.chat_rate_limit_hit (user_id, room_id) values (actor, room.id);
    return 'rate_limited';
  end if;

  insert into public.chat_message (room_id, sender_user_id, body)
  values (room.id, actor, p_body);

  return 'sent';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_discovery_participation(p_on boolean, p_summary jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_input_version = null,
          element_chart_engine_version = null;
    return false;
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_my_photo(p_content_type text, p_base64 text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  raw bytea;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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
$function$
;

CREATE OR REPLACE FUNCTION public.share_my_reading(p_body text, p_metaphor text, p_kind text, p_person_a uuid, p_person_b uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  scope record;
  mine public.reading;
  key text;
  made text;
  said text := btrim(coalesce(p_body, ''));
  called_a text;
  called_b text;
begin
  if me is null then
    raise exception '로그인이 필요합니다';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.';
  end if;

  if p_kind not in ('self', 'person', 'private') then
    raise exception '이 갈래는 공유 링크를 만들 수 없습니다';
  end if;

  /*
    **볼 수 있는가를 여기서 안 묻는다.** `reading_scope` 가 그 답을 들고 있고,
    못 보는 대상이면 0행이라 아래 조인이 아무것도 안 집는다.
  */
  select * into scope
  from public.reading_scope(p_kind, p_person_a, p_person_b, null);

  if not found then
    raise exception '공유할 풀이가 없습니다';
  end if;

  select r.* into mine
  from public.reading r
  where r.kind = scope.kind
    and r.owner_user_id is not distinct from scope.owner_user_id
    and r.person_a = scope.person_a
    and r.person_b is not distinct from scope.person_b
    and r.match_id is not distinct from scope.match_id;

  if not found then
    raise exception '공유할 풀이가 없습니다';
  end if;

  if said = '' then
    raise exception '공유할 내용이 비어 있습니다';
  end if;

  /* 저장된 원문 안의 글인가 — 지어낸 글이 이 문을 지나가지 못하게 하는 자리 */
  if strpos(mine.output, said) = 0 then
    raise exception '공유할 내용이 저장된 풀이와 다릅니다';
  end if;

  if p_metaphor is distinct from mine.metaphor then
    raise exception '공유할 한 줄 요약이 저장된 풀이와 다릅니다';
  end if;

  /**
   * **부르는 말은 kind 마다 다른 표에서 온다** — `line.ts` 가 목록에서 그러는 것과
   * 같은 자리다. 자기 풀이는 닉네임(앱 안에서 나는 닉네임이다), 나머지는 내가 그
   * 사람에게 붙인 이름표다.
   *
   * 차례를 여기서 다시 정하지 않는다. `reading_scope` 가 두 사람을 Person id 로 줄
   * 세워 내주고 본문의 이름도 그 차례를 따라 붙었으므로, 같은 차례로 적으면 머리와
   * 본문이 같은 사람을 같은 이름으로 부른다.
   */
  if p_kind = 'self' then
    select u.nickname into called_a from public.app_user u where u.id = me;
  else
    select e.local_label into called_a
    from public.user_person_access e
    where e.user_id = me and e.person_id = scope.person_a;
  end if;

  if p_kind = 'private' then
    select e.local_label into called_b
    from public.user_person_access e
    where e.user_id = me and e.person_id = scope.person_b;
  end if;

  key := case
    when mine.source_run_id is not null then 'run:' || mine.source_run_id::text
    else 'reading:' || mine.id::text || '@'
         || to_char(mine.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  end;

  insert into public.reading_share
    (token, shared_by, version_key, kind, metaphor, score, body, name_a, name_b)
  values (
    replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    me, key, p_kind, mine.metaphor, mine.score, said, called_a, called_b)
  on conflict (shared_by, version_key) do nothing
  returning token into made;

  if made is null then
    select s.token into made
    from public.reading_share s
    where s.shared_by = me and s.version_key = key;
  end if;

  return made;
end;
$function$
;
