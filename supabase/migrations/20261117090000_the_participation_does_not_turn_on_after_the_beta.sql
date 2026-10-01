-- 베타가 끝나면 매칭 참여를 켜지 못한다 — 끄는 것은 그대로 된다 (운영자 결정 2026-10-01, ADR 0024 추기)
--
-- 참여를 여는 문(`ensure_discovery_participation`, `20261106090000`)은 계정 상태와 함께 베타 종료(`beta_is_over()`)를 물어
-- 막는다 — ADR 0024 가 종료를 거는 자리로 정한 `is_active_account()` 의 두 조건 그대로다. 그런데 켜고 끄는 문
-- (`set_discovery_participation`)은 계정 상태만 물었다. 옛 판(`20261105090000`)도 그랬고 열쇠 판이 그대로 옮겼다. 그래서
-- 종료 뒤에도 이 문으로 켜면 풀에 다시 올랐다.
--
-- 운영자가 정했다(2026-10-01):
--
-- - **켜기(`p_on = true`)는 여는 문과 같은 조건으로 막는다** — 같은 거절(`42501`, 「이용이 정지된 계정입니다.」)이다. 여는 문과
--   같은 말을 내야 두 문이 같은 판정으로 읽힌다.
-- - **끄기(`p_on = false`)는 막지 않는다** — 종료 뒤에도 참여를 거두고 동의를 철회할 수 있어야 한다. 동의 문 둘이 종료 뒤에도
--   거둘 수 있게 계정 상태만 보는 것(`20261110090000`)과 같은 결이다.
-- - 종료일(G-62)은 건드리지 않는다.
--
-- 서명 · 반환 · 권한이 그대로다(`create or replace` — grant 도 그대로). 몸은 `20261106090000` 그대로이고, 계정을 잠근 뒤의
-- 판정에 켜기의 종료 조건 하나가 더해진다. 재는 자리는 `supabase/tests/79_participation_after_beta.test.sql`.

create or replace function public.set_discovery_participation(
  p_user_id uuid, p_on boolean, p_summary jsonb, p_need jsonb,
  p_input_version integer, p_chart_engine_version text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := p_user_id;
  self_id uuid;
  account public.app_user;
  mine public.person;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  /*
    **잠그는 차례는 Person → app_user 다** — 입력을 쓰는 문(`write_person_input`)과 같다. 반대로 잡으면 입력 저장과
    참여 켜기가 서로를 기다린다. 그래서 내 사람 id 를 잠그지 않고 먼저 읽고, 그 행을 잠근 뒤 계정을 잠근다.
    내 사람 id 는 한 번 서면 바뀌지 않는다(`create_self_person` 이 두 번째를 거절한다).
  */
  select self_person_id into self_id from public.app_user where id = actor;
  if self_id is not null then
    select * into mine from public.person where id = self_id for update;
  end if;

  select * into account from public.app_user where id = actor for update;

  /* 켜기는 여는 문(`ensure_discovery_participation`)과 같은 두 조건 — 끄기는 종료 뒤에도 된다 */
  if not found or account.status <> 'active' or (p_on and public.beta_is_over()) then
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
    return 'off';
  end if;

  if account.self_person_id is null then
    raise exception '먼저 내 사주를 등록해 주세요.' using errcode = '23502';
  end if;

  if account.nickname is null then
    raise exception '먼저 닉네임을 정해 주세요.' using errcode = '23502';
  end if;

  if mine.calendar is null then
    raise exception '저장된 출생정보를 찾지 못했습니다.' using errcode = '23502';
  end if;

  if not public.is_element_summary(p_summary)
     or (p_need is not null and not public.is_need_summary(p_need)) then
    raise exception '오행 요약의 모양이 맞지 않습니다.' using errcode = '22023';
  end if;

  if mine.input_version is distinct from p_input_version
     or mine.chart_engine_version is distinct from p_chart_engine_version then
    return 'stale';
  end if;

  insert into public.discovery_profile (
    user_id, opted_in_at, element_summary,
    element_input_version, element_chart_engine_version,
    need_summary, need_input_version, need_chart_engine_version)
  values (
    actor, now(), p_summary,
    p_input_version, p_chart_engine_version,
    p_need,
    case when p_need is null then null else p_input_version end,
    case when p_need is null then null else p_chart_engine_version end)
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

  return 'on';
end;
$function$;
