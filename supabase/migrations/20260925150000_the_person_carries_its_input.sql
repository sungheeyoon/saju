-- 현재 입력과 신선도 판정을 Person 으로 옮긴다 (ADR 0071 · #69)
--
-- **Person 은 현재 입력 한 벌만 든다.** 고치면 그 행을 고치고 이전 입력을 쌓지 않는다.
--
-- 판본이 답하던 물음은 여섯인데 표는 하나였다 — 현재 입력 · pending 감지 · 동의 고정 ·
-- 되짚기 · 도는 작업 · 후보 요약의 신선도. 앞의 둘이 여기서 `person` 으로 내려오고,
-- 가운데 둘은 이미 여덟 글자와 얼린 작업이 들었다(#66·#68).
--
-- ## 판본을 아직 **쓰기는** 한다
--
-- 이 단계가 끝나면 **아무도 판본을 읽지 않는다.** 그래도 계속 쌓는 것은 `match` ·
-- `reading` · `reading_job` 의 FK 가 아직 `not null` 이기 때문이다 — 그 열들을 떼는 것이
-- #70 이고, 쓰기를 멈추는 것도 그때다. 한 단계에서 읽기와 쓰기를 함께 끊으면 어느
-- 순서로 배포해도 창이 생긴다.
--
-- ## 세는 수 하나로 충분하다
--
-- `input_version` 은 **여덟 칸이 실제로 달라질 때만** 오른다. 세는 수라 입력을 안 담고,
-- 「그 사이에 입력이 바뀌었다」에 답하는 데는 그것으로 족하다 — 지문을 남기는 것은
-- **지운 값을 다시 계산할 수 있게 남겨 두는 일**이다(출생 입력은 후보 공간이 작아서
-- 열쇠 없는 해시는 원문의 다른 표기일 뿐이다).
--
-- ## 이름만 고치면 버전이 안 오른다
--
-- 안 그러면 남의 pending 요청이 무효가 된다. **입력이 같고 판만 다를 때도** 안 오른다 —
-- 엔진을 고친 일로 남의 요청이 죽으면 사용자가 한 적 없는 일로 벌을 주는 것이다.

-- ---------------------------------------------------------------------------
-- 1. Person 이 현재 입력을 든다
-- ---------------------------------------------------------------------------

alter table public.person
  add column calendar text,
  add column original_date date,
  add column solar_date date,
  add column birth_time time,
  add column gender text,
  add column city text,
  add column late_night_rule text,
  add column time_basis text,
  /**
   * 몇 번 달라졌나 — **세는 수이지 입력이 아니다.**
   *
   * 되돌릴 수 있는 값을 남기지 않는다. 답할 수 있어야 하는 물음은 「그 사이에 입력이
   * 바뀌었나」 하나이고, 세는 수가 그것에 답한다.
   */
  add column input_version integer not null default 0;

comment on column public.person.input_version is
  '입력이 실제로 달라진 횟수 — 이름·메모·엔진 판으로는 안 오른다(ADR 0071)';

/** 지금 판본에서 그대로 옮겨 온다 — 값을 옮기는 것이지 새로 세는 것이 아니다 */
update public.person p
set calendar = r.calendar,
    original_date = r.original_date,
    solar_date = r.solar_date,
    birth_time = r.birth_time,
    gender = r.gender,
    city = r.city,
    late_night_rule = r.late_night_rule,
    time_basis = r.time_basis
from public.person_chart_revision r
where r.id = p.current_revision_id;

/**
 * **여덟 칸은 함께 차거나 함께 빈다.**
 *
 * 반쯤 찬 입력은 명식을 못 낸다. 한쪽만 채워지는 상태를 만들어 두면 그 상태를 읽는
 * 코드가 생기고, 그 코드는 언제나 뒤늦게 발견된다.
 */
alter table public.person
  add constraint person_input_stands_together check (
    num_nonnulls(calendar, original_date, solar_date, gender, city,
                 late_night_rule, time_basis) in (0, 7));

alter table public.person
  add constraint person_input_is_known check (
    calendar is null or calendar in ('solar', 'lunar', 'lunar_leap'));

alter table public.person
  add constraint person_gender_is_known check (
    gender is null or gender in ('female', 'male'));

alter table public.person
  add constraint person_rules_are_known check (
    (late_night_rule is null or late_night_rule in ('jo', 'ya'))
    and (time_basis is null or time_basis in ('localMean', 'record', 'trueSolar')));

alter table public.person
  add constraint person_city_is_written check (
    city is null or length(city) between 1 and 20);

/** 양력으로 넣었으면 원본과 변환값이 같아야 한다 — 다르면 어딘가에서 흘렸다는 뜻이다 */
alter table public.person
  add constraint person_solar_input_needs_no_conversion check (
    calendar is null or calendar <> 'solar' or original_date = solar_date);

alter table public.person
  add constraint person_lunar_input_needs_conversion check (
    calendar is null or calendar = 'solar' or solar_date - original_date between 15 and 60);

/**
 * **시각을 아는지와 시주의 유무가 맞아야 한다 — 이제 표가 본다.**
 *
 * 문(`reject_bad_chart`)이 들고 있던 검사다. 입력이 `person` 으로 오면서 두 값이 한 행에
 * 앉았으므로, 문을 안 지나는 길로 들어와도 어긋날 수 없다(ADR 0071).
 *
 * 모르는 시각을 정오로 메우면 시주가 午시로 나와, **모르는 값이 아는 값의 얼굴을 하고**
 * 앉는다.
 */
alter table public.person
  add constraint person_hour_matches_birth_time check (
    current_chart is null
    or (jsonb_typeof(current_chart -> 'hour') = 'null') = (birth_time is null));

-- ---------------------------------------------------------------------------
-- 2. 입력을 쓰는 한 자리
-- ---------------------------------------------------------------------------

/**
 * 그 사람의 현재 입력 한 벌 — **판본이 아니라 행에서 읽는다.**
 *
 * 열 이름은 `revision_birth` 가 내주던 모양 그대로다. 받는 쪽(`StoredRevision`)이 그
 * 이름들을 알고 있고, 다른 이름으로 내면 옮겨 적는 자리가 생긴다.
 */
create or replace function public.person_birth(p_person_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_person_id is null then null else (
    select jsonb_build_object(
      'calendar', p.calendar,
      'original_date', p.original_date,
      'solar_date', p.solar_date,
      'birth_time', p.birth_time,
      'gender', p.gender,
      'city', p.city,
      'late_night_rule', p.late_night_rule,
      'time_basis', p.time_basis)
    from public.person p
    where p.id = p_person_id and p.calendar is not null
  ) end;
$$;

/** 안에서만 쓴다 — 입력 원문을 내주는 문을 밖에 열지 않는다(`revision_birth` 와 같다) */
revoke execute on function public.person_birth(uuid)
  from anon, public, authenticated, service_role;

/**
 * 입력을 쓴다 — **여기가 유일한 자리다.**
 *
 * 등록도 수정도 이 함수를 지난다. 「무엇이 달라지면 버전이 오르는가」를 두 자리에 적으면
 * 언젠가 한쪽만 고쳐지고, 그때 pending 요청이 죽는 규칙이 문마다 달라진다.
 *
 * @param p_chart `null` 이면 **여덟 글자를 안 건드린다** — 옛 서명으로 들어온 호출이다
 *   (#70 이 그 문을 지운다). 값이 있으면 문 앞에서 모양을 본다.
 * @returns 이 호출 뒤의 `input_version`.
 */
create or replace function public.write_person_input(
  p_person_id uuid,
  p_actor uuid,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text,
  p_chart jsonb,
  p_chart_engine_version text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_input public.person;
  same boolean;
  new_revision uuid;
begin
  if p_chart is not null then
    perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);
  end if;

  /**
   * **자격을 묻고 나서 쓰는 함수는 그 사이를 잠근다.** 지금 입력을 읽기 전에 잡는다 —
   * 잠그지 않으면 두 저장이 둘 다 「안 바뀌었네」를 보고 나란히 나아간다.
   *
   * 잠그는 차례는 Person → app_user 다(`invalidate_pending_requests` 가 뒤에서 계정을
   * 잠근다). 반대 차례로 두 자원을 잡는 길은 없다.
   */
  select * into now_input from public.person where id = p_person_id for update;

  if not found then
    raise exception '그 사람을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **여덟 칸을 그대로 견준다.** 지문을 안 쓴다 — 열쇠 없는 해시는 원문의 다른 표기일
   * 뿐이고, 여기서 하려는 일은 「달라졌나」 하나다.
   */
  same := now_input.calendar is not distinct from p_calendar
      and now_input.original_date is not distinct from p_original_date
      and now_input.solar_date is not distinct from p_solar_date
      and now_input.birth_time is not distinct from p_birth_time
      and now_input.gender is not distinct from p_gender
      and now_input.city is not distinct from p_city
      and now_input.late_night_rule is not distinct from p_late_night_rule
      and now_input.time_basis is not distinct from p_time_basis;

  if same then
    /**
     * 입력은 그대로다. 판이나 값이 다르면 **여덟 글자만** 갱신한다 — 사용자가 입력을
     * 바꾼 것이 아니므로 `input_version` 도 안 오르고 **pending 요청도 안 죽는다.**
     */
    if p_chart is not null then
      update public.person
      set current_chart = p_chart, chart_engine_version = p_chart_engine_version
      where id = p_person_id
        and (current_chart is distinct from p_chart
          or chart_engine_version is distinct from p_chart_engine_version);
    end if;

    return now_input.input_version;
  end if;

  /**
   * **판본은 아직 쌓는다** — `match`·`reading`·`reading_job` 의 FK 가 아직 `not null`
   * 이기 때문이다(#70 이 뗀다). 읽는 자리는 이미 다 여기로 옮겨 왔다.
   */
  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_actor
  )
  returning id into new_revision;

  update public.person
  set calendar = p_calendar,
      original_date = p_original_date,
      solar_date = p_solar_date,
      birth_time = p_birth_time,
      gender = p_gender,
      city = p_city,
      late_night_rule = p_late_night_rule,
      time_basis = p_time_basis,
      input_version = public.person.input_version + 1,
      current_revision_id = new_revision,
      current_chart = coalesce(p_chart, public.person.current_chart),
      chart_engine_version =
        case when p_chart is null then public.person.chart_engine_version
             else p_chart_engine_version end
  where id = p_person_id;

  /**
   * ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다. 같은 트랜잭션이라
   * 그 사이에 낀 수락이 없다. 범위는 `claimed_by` 가 정한다 — 가족·친구를 고치는 것은
   * 아무 요청과도 상관이 없다.
   */
  perform public.invalidate_pending_requests(public.claimed_by(p_person_id));

  -- ADR 0011 — 아무것도 가리키지 않게 된 이전 입력은 최근 둘까지만 남는다.
  perform public.retain_person_revisions(p_person_id);

  return now_input.input_version + 1;
end;
$$;

revoke execute on function public.write_person_input(
  uuid, uuid, text, date, date, time, text, text, text, text, jsonb, text)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 입력을 쓰는 네 문이 그 자리를 지난다
-- ---------------------------------------------------------------------------

create or replace function public.create_self_person(
  p_local_label text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text,
  p_chart jsonb,
  p_chart_engine_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
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

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  perform public.write_person_input(
    new_person, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

revoke execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

create or replace function public.create_managed_person(
  p_local_label text,
  p_note text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text,
  p_chart jsonb,
  p_chart_engine_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_add_revision(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  perform public.write_person_input(
    new_person, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  return new_person;
end;
$$;

revoke execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

/**
 * 출생 정보를 고친다 — **버전이 오르는 자리는 한 곳이다.**
 *
 * 바탕은 A1 의 정의이고, 달라진 것은 지문 대신 **여덟 칸을 그대로 견주는 것**과 그 판정이
 * `write_person_input` 안으로 들어간 것이다.
 */
create or replace function public.add_person_revision(
  p_person_id uuid,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text,
  p_chart jsonb,
  p_chart_engine_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);

  /** 부르는 쪽은 이 값을 안 본다 — #70 이 서명을 바꾸며 함께 걷는다 */
  return (select current_revision_id from public.person where id = p_person_id);
end;
$$;

revoke execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

/** 옛 서명 — **여덟 글자를 안 건드린다.** #70 이 지운다 */
create or replace function public.add_person_revision(
  p_person_id uuid,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
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

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, null, null);

  return (select current_revision_id from public.person where id = p_person_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. 요청은 **버전**을 잡는다
-- ---------------------------------------------------------------------------

alter table public.match_request
  add column requester_input_version integer,
  add column addressee_input_version integer;

comment on column public.match_request.requester_input_version is
  '청할 때의 입력 버전 — 세는 수라 입력을 안 담는다(ADR 0071)';

update public.match_request q
set requester_input_version = coalesce(
      (select p.input_version from public.app_user u
       join public.person p on p.id = u.self_person_id
       where u.id = q.requester_user_id), 0),
    addressee_input_version = coalesce(
      (select p.input_version from public.app_user u
       join public.person p on p.id = u.self_person_id
       where u.id = q.addressee_user_id), 0)
where q.requester_input_version is null;

-- ---------------------------------------------------------------------------
-- 5. 후보 요약의 신선도 — **엔진 판과 현재 값으로**
-- ---------------------------------------------------------------------------

alter table public.discovery_profile
  add column element_input_version integer,
  add column element_chart_engine_version text;

update public.discovery_profile d
set element_input_version = p.input_version,
    element_chart_engine_version = p.chart_engine_version
from public.app_user u
join public.person p on p.id = u.self_person_id
where u.id = d.user_id and d.element_revision_id is not null;

/**
 * **엔진을 올린 배포가 남의 요약을 조용히 죽이지 않게 한다.**
 *
 * 요약이 낡는 길은 둘이다 — 입력이 바뀌었거나, 엔진이 바뀌어 여덟 글자가 달라졌거나.
 * 뒤엣것은 **여덟 글자가 실제로 달라졌을 때만** 낡음이다. 판만 오르고 글자가 그대로면
 * 요약도 그대로이므로, 그 자리에서 판을 따라 올려 준다.
 *
 * 안 그러면 판을 올리는 배포마다 **모두가 후보에서 빠지고**, 각자 홈을 한 번 열어야
 * 돌아온다 — 사용자가 한 적 없는 일로 벌을 주는 것이다.
 */
create or replace function public.summary_follows_the_engine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_chart is not distinct from old.current_chart
     and new.chart_engine_version is distinct from old.chart_engine_version
  then
    update public.discovery_profile d
    set element_chart_engine_version = new.chart_engine_version
    from public.app_user u
    where u.id = d.user_id and u.self_person_id = new.id;
  end if;

  return null;
end;
$$;

revoke execute on function public.summary_follows_the_engine()
  from anon, public, authenticated, service_role;

create trigger summary_follows_the_engine
  after update of current_chart, chart_engine_version on public.person
  for each row execute function public.summary_follows_the_engine();

/**
 * 후보가 될 수 있는 쌍인가 — **판본을 안 읽는다.**
 *
 * 바탕은 `20260923100000` 의 정의다. 달라진 자리는 둘이다.
 *
 * 1. **신선도**를 `element_revision_id = current_revision_id` 대신 **입력 버전과 엔진
 *    판**으로 잰다(ADR 0071). 판본 id 로 재던 시절에는 엔진이 바뀌어도 「현재」라고
 *    답했다 — 그 물음 자체가 불가능했다.
 * 2. **성별**을 판본이 아니라 `person` 에서 읽는다. 같은 값이 옮겨 왔을 뿐이다.
 */
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
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         /**
          * 둘 다 요약이 **지금 입력과 지금 엔진**의 것이어야 한다. 낡은 값으로 줄
          * 세우지 않는다 — 카드가 말하는 오행이 이미 그 사람의 것이 아니기 때문이다.
          */
         and mine.element_input_version is not distinct from mp.input_version
         and theirs.element_input_version is not distinct from tp.input_version
         and mine.element_chart_engine_version is not distinct from mp.chart_engine_version
         and theirs.element_chart_engine_version is not distinct from tp.chart_engine_version
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다.
         and (mine.prefer_gender = 'any' or tp.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mp.gender = theirs.prefer_gender)
     );
$$;

revoke execute on function public.discovery_pair_eligible(uuid, uuid)
  from anon, public, authenticated;

/**
 * 요약을 풀에 올리는 세 자리가 **같은 값을 적는다.**
 *
 * 켜는 문 · 자동 참여 · 판본 수정이 따라가는 길. 셋이 저마다 적으면 하나가 빠지고,
 * 빠진 자리는 언제나 조용하다 — 사용자는 참여 중이라고 아는 채 아무에게도 안 보인다.
 */
create or replace function public.set_discovery_participation(p_on boolean, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if not p_on then
    insert into public.discovery_profile (user_id, opted_out_at)
    values (actor, now())
    on conflict (user_id) do update
      set opted_in_at = null,
          opted_out_at = now(),
          element_summary = null,
          element_revision_id = null,
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
    user_id, opted_in_at, element_summary, element_revision_id,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary, mine.current_revision_id,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_revision_id = excluded.element_revision_id,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
end;
$$;

revoke execute on function public.set_discovery_participation(boolean, jsonb) from anon, public;
grant execute on function public.set_discovery_participation(boolean, jsonb) to authenticated;

create or replace function public.ensure_discovery_participation(p_person_id uuid, p_summary jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception '중지된 계정입니다.' using errcode = '42501';
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
    user_id, opted_in_at, element_summary, element_revision_id,
    element_input_version, element_chart_engine_version)
  values (
    actor, now(), p_summary, mine.current_revision_id,
    mine.input_version, mine.chart_engine_version)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_revision_id = excluded.element_revision_id,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version;

  return true;
end;
$$;

revoke execute on function public.ensure_discovery_participation(uuid, jsonb) from anon, public;
grant execute on function public.ensure_discovery_participation(uuid, jsonb) to authenticated;

/**
 * 「내 요약이 지금 것인가」를 묻는 자리 — **한 술어로 모은다.**
 *
 * 목록을 여는 문과 뽑는 문과 청하는 문이 같은 것을 묻는다. 세 자리에 적으면 하나만
 * 고쳐지는 날이 오고, 그때 열려 있는 쪽이 언제나 더 바깥이다.
 */
create or replace function public.my_summary_is_current(p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.discovery_profile d
    join public.app_user u on u.id = d.user_id
    join public.person p on p.id = u.self_person_id
    where d.user_id = p_actor
      and d.element_summary is not null
      and d.element_input_version is not distinct from p.input_version
      and d.element_chart_engine_version is not distinct from p.chart_engine_version
  );
$$;

revoke execute on function public.my_summary_is_current(uuid)
  from anon, public, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 읽는 자리를 옮긴다 — **판본을 안 본다**
-- ---------------------------------------------------------------------------

/**
 * 대상 하나를 풀어 준다 — **입력이 `person` 에 있으므로 판본을 안 조인한다.**
 *
 * 바탕은 `20260826090000` 의 정의다. 달라진 자리는 둘이다.
 *
 * 1. 「입력이 있는가」를 `current_revision_id is not null` 대신 **`calendar is not null`**
 *    로 묻는다. 여덟 칸은 함께 차거나 함께 비므로 한 칸이 그 답을 든다.
 * 2. **`match` 의 두 Person 을 판본에서 안 꺼낸다.** 앞서는 매인 판본 행의 `person_id`
 *    로 찾았다 — Match 는 사람 id 를 안 들고 사용자 id 만 들기 때문이다. 이제 두 쪽의
 *    `self_person_id` 로 찾는다. 같은 값이고, 판본이 없어도 선다.
 *
 * 판본 id 둘은 그대로 내준다 — 얼린 작업의 FK 가 아직 `not null` 이다(#70 이 뗀다).
 */
create or replace function public.reading_scope_for(
  p_actor uuid,
  p_kind text,
  p_person_a uuid default null,
  p_person_b uuid default null,
  p_match_id uuid default null
)
returns table (
  kind text,
  owner_user_id uuid,
  person_a uuid,
  person_b uuid,
  match_id uuid,
  revision_a uuid,
  revision_b uuid,
  viewer_is_first boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  -- 자기 풀이 — 대상을 인자로 받지 않는다. 내 selfPerson 하나뿐이다.
  select
    'self', u.id, u.self_person_id, null::uuid, null::uuid,
    p.current_revision_id, null::uuid, true
  from public.app_user u
  join public.person p on p.id = u.self_person_id
  where p_kind = 'self'
    and u.id = p_actor
    and u.status = 'active'
    and p.calendar is not null

  union all

  /**
   * 저장한 사람 하나 — **내 엣지에 있는 Person 이면 된다.**
   *
   * **내 selfPerson 은 이 갈래가 아니다.** 안 막으면 같은 명식에 결과가 둘 생기고,
   * 같은 자료로 풀이권이 두 번 나간다. 자격은 화면이 아니라 여기서 정한다.
   */
  select
    'person', p_actor, p.id, null::uuid, null::uuid,
    p.current_revision_id, null::uuid, true
  from public.person p
  where p_kind = 'person'
    and p_person_a is not null
    and p.id = p_person_a
    and p.calendar is not null
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    -- definer 라 RLS 가 안 걸린다. 좁히는 조건을 손으로 적는다.
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = p.id
    )
    and not exists (
      select 1 from public.app_user me
      where me.id = p_actor and me.self_person_id = p.id
    )

  union all

  -- 비공개 궁합 — 두 사람 다 **내 엣지**에 있어야 한다. Match 상대는 엣지가 없다.
  select
    'private', p_actor,
    lo.id, hi.id, null::uuid,
    lo.current_revision_id, hi.current_revision_id, true
  from public.person lo
  join public.person hi on hi.id = greatest(p_person_a, p_person_b)
  where p_kind = 'private'
    and p_person_a is not null and p_person_b is not null and p_person_a <> p_person_b
    and lo.id = least(p_person_a, p_person_b)
    and exists (
      select 1 from public.app_user u where u.id = p_actor and u.status = 'active'
    )
    and lo.calendar is not null and hi.calendar is not null
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = lo.id
    )
    and exists (
      select 1 from public.user_person_access e
      where e.user_id = p_actor and e.person_id = hi.id
    )

  union all

  /**
   * 공유 궁합 — 차례는 Match 가 정한다.
   *
   * **두 Person 을 사용자에게서 찾는다.** 판본 행을 거치지 않으므로 판본이 없어져도
   * 이 갈래가 선다 — 동의 당시 여덟 글자는 `match` 가 이미 들고 있다(#68).
   */
  select
    'match', null::uuid, lo.self_person_id, hi.self_person_id, m.id,
    m.low_revision_id, m.high_revision_id,
    m.user_low = p_actor
  from public.match m
  join public.app_user lo on lo.id = m.user_low
  join public.app_user hi on hi.id = m.user_high
  where p_kind = 'match' and m.id = p_match_id
    and p_actor in (m.user_low, m.user_high)
    and lo.status = 'active' and hi.status = 'active'
    and lo.self_person_id is not null and hi.self_person_id is not null
    and not exists (
      select 1 from public.block b
      where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
         or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    );
$$;

revoke execute on function public.reading_scope_for(uuid, text, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;

/**
 * 얼릴 때 **입력도 `person` 에서 읽는다.**
 *
 * 바탕은 #68 의 정의이고, `revision_birth` 가 `person_birth` 로 바뀐 것 하나가 다르다.
 * 여덟 글자는 그대로 kind 로 갈린다 — `match` 는 동의 당시 값, 나머지는 지금 값.
 */
create or replace function public.freeze_reading_input(
  p_run_id uuid,
  p_actor uuid,
  p_kind text,
  p_person_a uuid,
  p_person_b uuid,
  p_match_id uuid,
  p_revision_a uuid,
  p_revision_b uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  glyphs_a jsonb;
  glyphs_b jsonb;
begin
  if p_kind = 'match' then
    select m.chart_low, m.chart_high into glyphs_a, glyphs_b
    from public.match m where m.id = p_match_id;
  else
    select p.current_chart into glyphs_a from public.person p where p.id = p_person_a;

    if p_person_b is not null then
      select p.current_chart into glyphs_b from public.person p where p.id = p_person_b;
    end if;
  end if;

  insert into public.reading_job (
    run_id, revision_a, revision_b, birth_a, birth_b, about, chart_a, chart_b, status)
  values (
    p_run_id, p_revision_a, p_revision_b,
    public.person_birth(p_person_a),
    public.person_birth(p_person_b),
    public.reading_about(p_actor, p_kind, p_person_a, p_person_b, p_match_id),
    glyphs_a, glyphs_b,
    'frozen');
end;
$$;

revoke execute on function public.freeze_reading_input(
  uuid, uuid, text, uuid, uuid, uuid, uuid, uuid)
  from anon, public, authenticated, service_role;

/**
 * 청한다 — **요청이 잡는 것은 입력 버전이다.**
 *
 * 바탕은 `20260907210000` 의 정의다. 달라진 자리는 셋이다.
 *
 * 1. 내 요약의 신선도를 `my_summary_is_current` 한 술어에 묻는다 — 목록을 여는 문과
 *    뽑는 문이 같은 것을 묻는다.
 * 2. 요청에 **입력 버전 둘**을 함께 적는다. 수락 순간 다시 보는 값이 그것이다.
 * 3. 판본 id 둘은 `person` 에서 읽어 그대로 적는다 — FK 가 아직 `not null` 이다.
 */
create or replace function public.request_match(p_candidate_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  my_revision uuid;
  my_version integer;
  their_summary jsonb;
  their_revision uuid;
  their_version integer;
  shown public.discovery_impression;
  counted record;
  new_request uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_candidate_user_id is null or p_candidate_user_id = actor then
    raise exception '지금은 이 사람에게 요청할 수 없습니다. 후보 목록을 새로 열어 확인해 주세요.'
      using errcode = '42501';
  end if;

  /** **묻기 전에 잠근다** — 자격 확인과 insert 사이에 낀 차단·입력 수정이 새 pending 을 놓친다. */
  perform public.lock_users(actor, p_candidate_user_id);

  /** **잠근 뒤에 나를 다시 본다** — 그 사이 커밋된 제재를 새 스냅숏이 본다. */
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
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

  select pe.current_revision_id, pe.input_version into my_revision, my_version
  from public.app_user u join public.person pe on pe.id = u.self_person_id
  where u.id = actor;

  select pe.current_revision_id, pe.input_version into their_revision, their_version
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
    requester_revision_id, addressee_revision_id,
    requester_input_version, addressee_input_version,
    impression_id, policy_version,
    supplied_to_requester, supplied_to_addressee, balance_band
  )
  values (
    actor, p_candidate_user_id,
    my_revision, their_revision,
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
$$;

revoke execute on function public.request_match(uuid) from anon, public;
grant execute on function public.request_match(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 옛 서명도 같은 자리를 지난다
-- ---------------------------------------------------------------------------
--
-- **옛 문이 살아 있는 동안에는 옛 문도 불변식을 지켜야 한다.**
--
-- 처음에는 새 서명 둘만 `write_person_input` 으로 옮겼다. 그랬더니 옛 문으로 만든
-- Person 은 `person` 의 입력 칸이 빈 채로 남았고, 그 뒤의 모든 판정이 그 사람을
-- 「입력이 없는 사람」으로 읽었다 — 재어 보고 알았다: pgTAP 이 866 에서 313 으로
-- 주저앉았다(같은 값으로 저장했는데 판본이 쌓이고, 참여가 안 켜지고, 궁합 대상이
-- 아니라고 거절당했다).
--
-- 한 표에 두 진실이 있으면 **둘 중 낡은 쪽이 이긴다.** 옛 문도 같은 자리를 지나게 한다.
-- 여덟 글자는 안 건드린다(`p_chart := null`) — 옛 문은 그 값을 애초에 안 받는다.

create or replace function public.create_self_person(
  p_local_label text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
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

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, role)
  values (actor, new_person, p_local_label, 'owner');

  perform public.write_person_input(
    new_person, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, null, null);

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

create or replace function public.create_managed_person(
  p_local_label text,
  p_note text,
  p_calendar text,
  p_original_date date,
  p_solar_date date,
  p_birth_time time,
  p_gender text,
  p_city text,
  p_late_night_rule text,
  p_time_basis text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  account public.app_user;
  new_person uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if account.signed_up_at is null then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  insert into public.person default values returning id into new_person;

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  if not public.may_add_revision(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  perform public.write_person_input(
    new_person, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, null, null);

  return new_person;
end;
$$;
