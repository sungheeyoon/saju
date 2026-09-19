-- Person 이 자기 여덟 글자를 든다 — **넓히기만 한다**(ADR 0071 · A1)
--
-- 이 마이그레이션은 아무 동작도 안 바꾼다. 열 둘을 `null` 로 열어 두고, 네 문의 **새 서명**을
-- 옛 서명 **옆에** 세운다. 옛 앱은 그대로 돌고 새 앱은 스냅샷을 채운다.
--
-- **기본값을 안 붙인다.** Postgres 는 인자를 더하면 새 함수를 세우므로, 기본값을 붙이면
-- 아홉 인자 호출이 두 함수 사이에서 모호해져 깨진다. arity 를 갈라 두면 옛 호출은 옛 문으로,
-- 새 호출은 새 문으로 간다 — 어느 배포 순서에서도 창이 안 생긴다(`create_pair_for_reading`
-- 주석이 같은 값을 이미 치렀다).
--
-- 좁히는 일(`not null` · 옛 서명 삭제)은 A4 가 한다.

-- ---------------------------------------------------------------------------
-- 모양을 보는 눈 — `is_element_summary` 와 같은 꼴
-- ---------------------------------------------------------------------------

/**
 * 기둥 하나 — 천간과 지지 **둘뿐**이다.
 *
 * `name`·`ko`·`index` 는 안 싣는다. 전부 이 둘에서 나오는 파생값이고(`name` 은 글자를
 * 이어 붙인 것이다), 파생값을 함께 저장하면 그것이 어긋날 자리가 생긴다.
 */
create or replace function public.is_chart_pillar(pillar jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(pillar) = 'object'
     and (select count(*) from jsonb_object_keys(pillar)) = 2
     and pillar ? 'stem' and pillar ? 'branch'
     and pillar ->> 'stem' = any (array['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'])
     and pillar ->> 'branch' = any (
           array['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']);
$$;

/**
 * 여덟 글자 스냅샷의 모양.
 *
 * **「이 여덟 글자가 저 입력에서 나왔나」는 못 본다** — 절기·자시·경도가 TypeScript 엔진에
 * 있기 때문이다. 볼 수 있는 것만 본다.
 *
 * - 낱자가 천간 열 · 지지 열둘 안인가
 * - **일간이 일주의 천간인가** — 앱이 둘을 따로 짓다 어긋나는 갈래를 여기서 잡는다
 * - 칸이 다섯뿐인가 — `meta` 가 딸려 들어오면 출생 원문이 새는 길이 된다
 *
 * 시주의 유무가 입력과 맞는지는 여기서 못 본다(입력이 이 값 옆에 없다). 그것은 문이
 * 본다(`reject_bad_chart`). A 가 끝나고 입력이 `person` 으로 오면 표 검사식으로 내린다.
 */
create or replace function public.is_chart_snapshot(chart jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select chart is not null
     and jsonb_typeof(chart) = 'object'
     and (select count(*) from jsonb_object_keys(chart)) = 5
     and chart ? 'year' and chart ? 'month' and chart ? 'day'
     and chart ? 'hour' and chart ? 'dayMaster'
     and public.is_chart_pillar(chart -> 'year')
     and public.is_chart_pillar(chart -> 'month')
     and public.is_chart_pillar(chart -> 'day')
     -- 시간 미상은 `null` 이다. 정오로 메운 시주가 아니라 **없음**이어야 한다.
     and (jsonb_typeof(chart -> 'hour') = 'null' or public.is_chart_pillar(chart -> 'hour'))
     and chart ->> 'dayMaster' = chart -> 'day' ->> 'stem';
$$;

/**
 * **기본값이 닫아 준다고 믿지 않는다.**
 *
 * 이 둘을 grant 만 하고 올렸더니 `service_role` 이 PUBLIC 을 물려받아 열쇠의 허용 집합이
 * 둘 늘었고, 그것을 세던 시험(`13_reading`)이 바로 걸렸다. 같은 파일의 `reject_bad_chart`
 * 는 revoke 를 붙였고 그 집합에 없다 — 대비가 곧 증거다.
 */
revoke execute on function public.is_chart_pillar(jsonb) from anon, public;
revoke execute on function public.is_chart_snapshot(jsonb) from anon, public;
grant execute on function public.is_chart_pillar(jsonb) to authenticated;
grant execute on function public.is_chart_snapshot(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Person 이 드는 두 칸
-- ---------------------------------------------------------------------------

alter table public.person
  add column current_chart jsonb,
  add column chart_engine_version text;

comment on column public.person.current_chart is
  '지금 입력이 내는 여덟 글자. 앱이 써 넣고 DB 는 모양만 본다(ADR 0071)';
comment on column public.person.chart_engine_version is
  '그 여덟 글자를 낸 엔진 판 — 낡음을 막지는 못하고 알아보게 한다';

alter table public.person
  add constraint current_chart_has_shape
  check (current_chart is null or public.is_chart_snapshot(current_chart));

/**
 * **둘은 함께 차거나 함께 빈다.**
 *
 * 판 없는 스냅샷은 낡았는지 물을 수 없고, 스냅샷 없는 판은 아무것도 안 가리킨다.
 * 한쪽만 채워지는 상태를 만들어 두면 그 상태를 읽는 코드가 생긴다.
 */
alter table public.person
  add constraint chart_and_engine_version_stand_together
  check ((current_chart is null) = (chart_engine_version is null));

alter table public.person
  add constraint chart_engine_version_is_written
  check (chart_engine_version is null or btrim(chart_engine_version) <> '');

-- ---------------------------------------------------------------------------
-- 문이 거절하는 것 — **A4 의 `not null` 을 기다리지 않는다**
-- ---------------------------------------------------------------------------

/**
 * 새 서명으로 들어온 여덟 글자를 문 앞에서 본다.
 *
 * 열을 `not null` 로 좁히는 것은 A4 인데, **거절은 지금부터** 한다. 새 문으로 들어오는
 * 것이 하나라도 어긋나 있으면 그 행은 A3 의 백필도 못 고친다 — 백필은 비어 있거나 판이
 * 다른 행만 보기 때문이다. 틀린 값이 조용히 앉는 창을 안 만든다.
 */
create or replace function public.reject_bad_chart(
  p_chart jsonb,
  p_chart_engine_version text,
  p_birth_time time
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_chart is null then
    raise exception '여덟 글자를 함께 보내야 합니다.' using errcode = '22004';
  end if;

  if p_chart_engine_version is null or btrim(p_chart_engine_version) = '' then
    raise exception '여덟 글자를 낸 엔진 판을 함께 보내야 합니다.' using errcode = '22004';
  end if;

  if not public.is_chart_snapshot(p_chart) then
    raise exception '여덟 글자의 모양이 아닙니다.' using errcode = '22023';
  end if;

  /**
   * **시각을 아는지와 시주의 유무가 맞아야 한다.**
   *
   * 모르는 시각을 정오로 메우면 시주가 午시로 나와, 모르는 값이 아는 값의 얼굴을 하고
   * 앉는다. 판본이 그것을 `birth_time is null` 로 말하고 있으므로 여기서 대조한다.
   */
  if (jsonb_typeof(p_chart -> 'hour') = 'null') <> (p_birth_time is null) then
    raise exception '시각을 아는지와 시주의 유무가 어긋납니다.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.reject_bad_chart(jsonb, text, time) from anon, public;
grant execute on function public.reject_bad_chart(jsonb, text, time) to authenticated;

-- ---------------------------------------------------------------------------
-- 입력을 쓰는 네 문의 **새 서명** — 옛 서명은 그대로 둔다(A4 가 지운다)
-- ---------------------------------------------------------------------------

/**
 * 내 사주를 처음 등록한다 — 여덟 글자를 함께 받는다.
 *
 * 바탕은 `20260911090000` 의 정의이고 더한 것은 둘이다: 문 앞의 거절과, `person` 을
 * 세우는 `update` 에 칸 둘. **같은 트랜잭션이라** 입력과 스냅샷이 갈릴 자리가 없다.
 */
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
  new_revision uuid;
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

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person
  set current_revision_id = new_revision,
      current_chart = p_chart,
      chart_engine_version = p_chart_engine_version
  where id = new_person;

  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

revoke execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

/** 저장한 사람 — 바탕은 같은 날 정의이고 더한 것도 같다 */
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
  new_revision uuid;
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

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    new_person, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person
  set current_revision_id = new_revision,
      current_chart = p_chart,
      chart_engine_version = p_chart_engine_version
  where id = new_person;

  return new_person;
end;
$$;

revoke execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

/**
 * 출생 정보를 고친다 — **판만 다르면 판본을 안 쌓는다**(ADR 0071).
 *
 * 바탕은 `20260825200000` 의 정의다. 달라진 자리는 지문이 같을 때의 갈래 하나다.
 *
 * 입력이 그대로인데 엔진 판이 바뀐 호출은 **사용자가 입력을 바꾼 것이 아니다.** 판본도
 * 안 쌓고 pending 요청도 안 죽인다 — 엔진을 고친 일로 남의 요청이 무효가 되면 사용자가
 * 한 적 없는 일로 벌을 주는 것이다. 갱신되는 것은 스냅샷과 판 둘뿐이다.
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
  current_fingerprint text;
  next_fingerprint text;
  new_revision uuid;
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

  perform 1 from public.person where id = p_person_id for update;

  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  if current_fingerprint = next_fingerprint then
    /* 입력은 그대로다. 판이나 값이 다르면 **스냅샷만** 갱신한다 */
    update public.person
    set current_chart = p_chart, chart_engine_version = p_chart_engine_version
    where id = p_person_id
      and (current_chart is distinct from p_chart
        or chart_engine_version is distinct from p_chart_engine_version);

    return (select current_revision_id from public.person where id = p_person_id);
  end if;

  insert into public.person_chart_revision (
    person_id, calendar, original_date, solar_date, birth_time,
    gender, city, late_night_rule, time_basis, created_by
  )
  values (
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, actor
  )
  returning id into new_revision;

  update public.person
  set current_revision_id = new_revision,
      current_chart = p_chart,
      chart_engine_version = p_chart_engine_version
  where id = p_person_id;

  -- ADR 0004 — Evidence 를 바꾸는 수정이 pending 요청을 무효화한다.
  perform public.invalidate_pending_requests(public.claimed_by(p_person_id));

  -- ADR 0011 — 아무것도 가리키지 않게 된 이전 입력은 최근 둘까지만 남는다.
  perform public.retain_person_revisions(p_person_id);

  return new_revision;
end;
$$;

revoke execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

/** 쌍의 한 칸 — 새로 만들면 여덟 글자를 함께 넘긴다 */
create or replace function public.person_for_pair(
  p_person uuid,
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
security invoker
set search_path = ''
as $$
begin
  if p_person is null then
    return public.create_managed_person(
      p_local_label, p_note, p_calendar, p_original_date, p_solar_date,
      p_birth_time, p_gender, p_city, p_late_night_rule, p_time_basis,
      p_chart, p_chart_engine_version);
  end if;

  -- 없는 사람과 못 보는 사람을 가르지 않는다. 정책이 이미 자기 줄만 내준다.
  if not exists (select 1 from public.user_person_access a where a.person_id = p_person) then
    raise exception '저장한 사람 목록에 없는 사람입니다.' using errcode = '42501';
  end if;

  return p_person;
end;
$$;

revoke execute on function public.person_for_pair(
  uuid, text, text, text, date, date, time, text, text, text, text, jsonb, text
) from anon, public, service_role;
grant execute on function public.person_for_pair(
  uuid, text, text, text, date, date, time, text, text, text, text, jsonb, text
) to authenticated;

/**
 * 쌍을 연다 — 네 칸이 더 붙는다.
 *
 * **`p_listed` 에 기본값을 안 준다.** 옛 서명이 23·24 인자로 불릴 수 있으므로, 새 서명이
 * 기본값을 들면 그 사이 어딘가에서 모호해진다. 새 문은 스물여덟을 다 받는다.
 */
create or replace function public.create_pair_for_reading(
  p_a_local_label text,
  p_a_note text,
  p_a_calendar text,
  p_a_original_date date,
  p_a_solar_date date,
  p_a_birth_time time,
  p_a_gender text,
  p_a_city text,
  p_a_late_night_rule text,
  p_a_time_basis text,
  p_b_local_label text,
  p_b_note text,
  p_b_calendar text,
  p_b_original_date date,
  p_b_solar_date date,
  p_b_birth_time time,
  p_b_gender text,
  p_b_city text,
  p_b_late_night_rule text,
  p_b_time_basis text,
  p_relation text,
  p_a_person uuid,
  p_b_person uuid,
  p_listed boolean,
  p_a_chart jsonb,
  p_a_chart_engine_version text,
  p_b_chart jsonb,
  p_b_chart_engine_version text
)
returns table (person_a uuid, person_b uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  first_person uuid;
  second_person uuid;
begin
  if p_a_person is not null and p_b_person is not null and p_a_person = p_b_person then
    raise exception '같은 사람 둘로는 궁합을 볼 수 없습니다.' using errcode = '22023';
  end if;

  first_person := public.person_for_pair(
    p_a_person, p_a_local_label, p_a_note, p_a_calendar, p_a_original_date, p_a_solar_date,
    p_a_birth_time, p_a_gender, p_a_city, p_a_late_night_rule, p_a_time_basis,
    p_a_chart, p_a_chart_engine_version
  );

  second_person := public.person_for_pair(
    p_b_person, p_b_local_label, p_b_note, p_b_calendar, p_b_original_date, p_b_solar_date,
    p_b_birth_time, p_b_gender, p_b_city, p_b_late_night_rule, p_b_time_basis,
    p_b_chart, p_b_chart_engine_version
  );

  /* 새로 만든 쪽만 숨긴다 — 있던 사람의 엣지는 사용자 것이다 */
  if not p_listed then
    if p_a_person is null then perform public.set_person_listed(first_person, false); end if;
    if p_b_person is null then perform public.set_person_listed(second_person, false); end if;
  end if;

  if p_relation is not null then
    perform public.set_pair_relation(first_person, second_person, p_relation);
  end if;

  return query select first_person, second_person;
end;
$$;

revoke execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text,
  text, uuid, uuid, boolean, jsonb, text, jsonb, text) from anon, public, service_role;
grant execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text,
  text, uuid, uuid, boolean, jsonb, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 운영 문 — **조건부로만 쓴다**
-- ---------------------------------------------------------------------------

/**
 * 엔진 판이 바뀐 뒤 남의 Person 까지 다시 채우는 문(ADR 0071).
 *
 * RLS 가 앱 세션에 남의 입력을 안 열어 주므로 이 일은 열쇠로만 된다. 그래서 이 문은
 * **영구히 남는다** — 임시 장치가 아니다.
 *
 * **읽었던 판본을 함께 받는다.** 스크립트가 입력을 읽고 여덟 글자를 세는 사이에 사용자가
 * 입력을 고칠 수 있다. 조건 없이 쓰면 **옛 입력으로 센 여덟 글자가 새 입력 위에 얹힌다** —
 * 이 문이 열어 줄 수 있는 유일한 사고가 그것이고, 조건 하나로 닫힌다.
 *
 * @returns 썼으면 `true`. **못 썼으면 `false` 이고 그것은 오류가 아니다** — 그 사이에
 *   입력이 바뀌었다는 사실이다. 부르는 쪽이 새 입력을 다시 읽어 다시 센다.
 */
create or replace function public.set_person_chart(
  p_person_id uuid,
  p_expected_current_revision_id uuid,
  p_chart jsonb,
  p_chart_engine_version text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  stored_birth_time time;
  written integer;
begin
  select r.birth_time into stored_birth_time
  from public.person p
  join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id
    and p.current_revision_id = p_expected_current_revision_id;

  /* 그 사이에 입력이 바뀌었거나 없는 사람이다. 둘을 가르지 않는다 */
  if not found then
    return false;
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, stored_birth_time);

  update public.person
  set current_chart = p_chart, chart_engine_version = p_chart_engine_version
  where id = p_person_id
    and current_revision_id = p_expected_current_revision_id;

  get diagnostics written = row_count;
  return written = 1;
end;
$$;

revoke execute on function public.set_person_chart(uuid, uuid, jsonb, text)
  from anon, public, authenticated;
grant execute on function public.set_person_chart(uuid, uuid, jsonb, text) to service_role;
