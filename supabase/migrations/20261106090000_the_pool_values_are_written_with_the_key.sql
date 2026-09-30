-- 풀에 오르는 요약과 여덟 글자를 **열쇠(`service_role`)로만 쓰는 문 넷을 세운다** (G-64 길 ①, ADR 0136 — 넓히기)
--
-- 매칭 풀에 오르는 오행 요약(`element_summary`) · 필요한 기운 요약(`need_summary`)과 내 사람의 여덟 글자
-- (`person.current_chart`)는 앱이 엔진으로 짓고 DB 는 **모양만** 본다(`is_element_summary` · `is_need_summary` ·
-- `reject_bad_chart`). 그 문 넷이 `authenticated` 에 열려 있어, 로그인한 사람이 PostgREST 로 직접 부르면
-- 제 저장된 입력과 다른 — 모양만 맞는 — 요약과 여덟 글자를 풀에 올릴 수 있었다(2026-09-28 보안 감사).
--
-- 운영자가 길 ① 을 골랐다(2026-09-30): **이 문들은 열쇠로만 부르고, 부르는 자리는 서버 모듈 하나다**
-- (`app/me/keyed-chart-writes.ts`). 그 모듈이 세션에서 사람 id 를 얻고, 그 사람의 저장된 입력에서 값을 지어 넘긴다.
--
-- ## 무엇이 생기나
--
-- 같은 이름의 문 넷에 **첫 인자 `p_user_id`** 가 붙은 판 — 몸은 옛 판과 같고 `auth.uid()` 자리만 그 인자다.
--
-- | 문 | 무엇을 쓰나 |
-- | --- | --- |
-- | `create_self_person(p_user_id, …)` | 내 사람과 그 여덟 글자 |
-- | `edit_person_input(p_user_id, …)` | 고친 입력과 그 여덟 글자 — 내 사람이면 풀에 닿는다 |
-- | `set_discovery_participation(p_user_id, …)` | 참여를 켜고 끄고, 켤 때 요약 둘 |
-- | `ensure_discovery_participation(p_user_id, …)` | 참여를 열며 요약 둘을 갱신 |
--
-- 넷 다 `service_role` 에만 연다 — `anon` · `authenticated` · `PUBLIC` 은 못 부른다. 정지 · 베타 종료 · 가입 전 ·
-- 이름 없음 · 남의 사람의 판정은 옛 판 그대로 DB 가 한다 — 열쇠가 부른다고 판정을 건너뛰지 않는다.
--
-- `create_managed_person` 은 여기 없다 — 가족 · 친구의 여덟 글자는 그 사람을 등록한 계정에게만 보이고 풀에도
-- 남의 화면에도 안 간다(ADR 0136 「안 옮긴 것」).
--
-- ## 넓히기다
--
-- 옛 판(인자에 사람 id 가 없는 넷)은 그대로 `authenticated` 에 열려 있다 — 이 마이그레이션만 먼저 올라가도 운영의
-- 옛 앱은 그대로 선다. 앱이 새 판으로 옮겨 배포된 **뒤에** 좁히기(`20261106100000`)가 옛 판을 걷는다(ADR 0071).
--
-- 재는 자리는 `supabase/tests/70_pool_values_keyed.test.sql`(좁히기와 함께) 과 기존 시험들 — 시험은 사람 id 를
-- 세션에서 읽어 이 문을 부르는 손잡이(`tests.create_self_person` 등, `supabase/tests/00_helpers.sql`)로 옮겼다.

-- ---------------------------------------------------------------------------
-- 1. 내 사람을 처음 등록한다
-- ---------------------------------------------------------------------------

create function public.create_self_person(
  p_user_id uuid,
  p_local_label text, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text,
  p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  account public.app_user;
  new_person uuid;
begin
  /** 관문이 값 검사보다 먼저다 — 옛 판(`20260929090000`)과 같은 차례 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if not found or account.status <> 'active' then
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
$function$;

revoke execute on function public.create_self_person(
  uuid, text, text, date, date, time without time zone, text, text, text, text, jsonb, text)
  from anon, authenticated, public;
grant execute on function public.create_self_person(
  uuid, text, text, date, date, time without time zone, text, text, text, text, jsonb, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2. 저장된 입력을 고친다
-- ---------------------------------------------------------------------------

create function public.edit_person_input(
  p_user_id uuid,
  p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date,
  p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text,
  p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
begin
  /** 관문이 값 검사보다 먼저다 — 남의 것을 두드린 사람은 그 사실부터 들어야 한다 */
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) is distinct from 'active' then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  if not public.may_edit_person_input(p_person_id, actor) then
    raise exception '이 사람의 출생정보를 고칠 수 없습니다.' using errcode = '42501';
  end if;

  perform public.reject_bad_chart(p_chart, p_chart_engine_version, p_birth_time);

  return public.write_person_input(
    p_person_id, actor, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$function$;

revoke execute on function public.edit_person_input(
  uuid, uuid, text, date, date, time without time zone, text, text, text, text, jsonb, text)
  from anon, authenticated, public;
grant execute on function public.edit_person_input(
  uuid, uuid, text, date, date, time without time zone, text, text, text, text, jsonb, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. 참여를 여는 문 — 홈 · 매칭 · 입력을 고친 뒤
-- ---------------------------------------------------------------------------

create function public.ensure_discovery_participation(
  p_user_id uuid, p_person_id uuid, p_summary jsonb, p_need jsonb default null)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  account public.app_user;
  mine public.person;
  opted_out timestamptz;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor;

  /* 옛 판의 `is_active_account()` 는 `auth.uid()` 를 본다 — 같은 두 조건을 이 사람에게 묻는다 */
  if not found or account.status <> 'active' or public.beta_is_over() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

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

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  select * into mine from public.person where id = account.self_person_id;

  if mine.calendar is null then
    return false;
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$;

revoke execute on function public.ensure_discovery_participation(uuid, uuid, jsonb, jsonb)
  from anon, authenticated, public;
grant execute on function public.ensure_discovery_participation(uuid, uuid, jsonb, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 4. 참여를 켜고 끈다
-- ---------------------------------------------------------------------------

create function public.set_discovery_participation(
  p_user_id uuid, p_on boolean, p_summary jsonb, p_need jsonb default null)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select * into account from public.app_user where id = actor for update;

  if not found or account.status <> 'active' then
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
          element_chart_engine_version = null,
          need_summary = null,
          need_input_version = null,
          need_chart_engine_version = null;
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

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    mine.input_version, mine.chart_engine_version,
    p_need,
    case when p_need is null then null else mine.input_version end,
    case when p_need is null then null else mine.chart_engine_version end)
  on conflict (user_id) do update
    set opted_in_at = coalesce(public.discovery_profile.opted_in_at, now()),
        opted_out_at = null,
        element_summary = excluded.element_summary,
        element_input_version = excluded.element_input_version,
        element_chart_engine_version = excluded.element_chart_engine_version,
        need_summary = coalesce(excluded.need_summary, public.discovery_profile.need_summary),
        need_input_version = case when excluded.need_summary is null
          then public.discovery_profile.need_input_version else excluded.need_input_version end,
        need_chart_engine_version = case when excluded.need_summary is null
          then public.discovery_profile.need_chart_engine_version else excluded.need_chart_engine_version end;

  return true;
end;
$function$;

revoke execute on function public.set_discovery_participation(uuid, boolean, jsonb, jsonb)
  from anon, authenticated, public;
grant execute on function public.set_discovery_participation(uuid, boolean, jsonb, jsonb) to service_role;
