-- ---------------------------------------------------------------------------
-- 음력 입력을 받는다 — 변환표를 공식 자료와 대조했다
-- ---------------------------------------------------------------------------

/**
 * 두 쓰기 경로가 `calendar <> 'solar'` 를 `0A000` 으로 거절하고 있었다. 거절의
 * 이유는 「변환표를 공식 자료와 대조하기 전에는 추정해서 넣지 않는다」였고,
 * 그 대조가 끝났으므로 거절을 걷는다.
 *
 * 표는 한국천문연구원 음력 운용지침대로 뽑아 커밋했고(1912~2100), 검증은 KASI 가
 * 낸 표로 한다 — 윤달 배치 69해, 한국과 중국이 갈린 61개 달의 초하루, ΔT 때문에
 * 날짜가 갈릴 수 있는 사례. `docs/adr/0002-lunar-calendar-as-a-committed-table.md`
 * 와 `src/lib/saju/lunar/` 참조.
 *
 * **변환 자체는 여전히 앱이 한다.** 표를 Postgres 에 두 벌로 두면 어긋날 자리가
 * 생기고, 어긋났을 때 어느 쪽이 참인지 아무도 말하지 못한다. 대신 DB 는 앱이
 * 변환을 **아예 잊은 경우**를 잡는다 — 아래 검사식.
 *
 * `person_chart_revision.calendar` 컬럼의 주석은 첫 마이그레이션에 「아직 받지
 * 않는다」로 적혀 있다. 지난 판을 고치지 않으므로 여기에 다시 적는다: 이제 받는다.
 */

/**
 * 음력으로 넣었으면 변환값이 원본보다 **뒤**에 있어야 한다.
 *
 * 양력 쪽은 `solar_input_needs_no_conversion` 이 「원본과 변환값이 같아야 한다」를
 * 들고 있었지만, 음력 쪽은 앱이 변환을 잊고 원본을 두 칸에 그대로 넣어도 아무도
 * 막지 못했다. 음력 날짜의 양력 변환은 늘 19~56일 뒤이므로(1912~2100 전수),
 * 넉넉히 잡아 그 바깥을 거절한다. 표를 검사하는 것이 아니라 **변환을 건너뛴 쓰기**를
 * 잡는 것이라 경계는 느슨해도 된다.
 */
alter table public.person_chart_revision
  add constraint lunar_input_needs_conversion
  check (calendar = 'solar' or solar_date - original_date between 15 and 60);

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
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if account.status <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 온보딩을 마친 User 는 정확히 하나의 selfPerson 을 갖는다. 두 번째 요청은
  -- 조용히 덮어쓰는 것이 아니라 거절한다 — 첫 번째가 어디로 갔는지 모르게 된다.
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

  update public.person set current_revision_id = new_revision where id = new_person;
  update public.app_user set self_person_id = new_person where id = actor;

  return new_person;
end;
$$;

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
  current_fingerprint text;
  next_fingerprint text;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 정책이 묻는 것과 **같은 함수**에 묻는다.
  if not public.may_add_revision(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  next_fingerprint := public.revision_fingerprint(
    p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis);

  select r.fingerprint into current_fingerprint
  from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
  where p.id = p_person_id;

  if current_fingerprint = next_fingerprint then
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

  update public.person set current_revision_id = new_revision where id = p_person_id;

  /**
   * ADR 0004 는 「Evidence 를 바꾸는 수정이 pending 요청을 무효화한다」고 정했다.
   * 아직 MatchRequest 가 없어서 무효화할 것이 없다. 그 표가 생기는 마이그레이션이
   * 이 자리에 그 한 줄을 더한다 — 같은 트랜잭션 안이어야 그 사이에 낀 수락이 없다.
   */

  return new_revision;
end;
$$;

revoke execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) to authenticated;

revoke execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text) to authenticated;
