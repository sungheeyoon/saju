-- 저장된 입력을 고치는 문이 용어집의 이름을 든다 — **넓히기** (G-43, ADR 0088)
--
-- 「판본」을 걷은 뒤(ADR 0071) 문 이름만 `revision` 으로 남아 있었다(CONTEXT.md §10). 용어집은
-- 이 일을 「저장된 입력을 고친다」라 부르고, 안쪽의 쓰는 문은 이미 `write_person_input` 이다.
--
--   add_person_revision → edit_person_input      (앱이 부르는 RPC)
--   may_add_revision    → may_edit_person_input  (관문 — 앱은 안 부른다)
--
-- 본문은 2026-09-23 의 **살아 있는 정의**(`pg_get_functiondef`, 20260929090000 이 마지막으로 적은
-- 것)에서 떴다. 서명 · 보안 · `search_path` · errcode · 문장은 그대로이고 부르는 이름만 바뀐다.
--
-- ## 두 벌로 선다 — 좁히기는 따로
--
-- `add_person_revision` 은 **앱이 부르는 문**이라 이 마이그레이션에서 지우면 떠 있는 앱이 없는
-- 함수를 부른다(runbook 「배포」 규약 3). 그래서 새 문을 부르는 **얇은 겉**으로 남긴다 — 관문과 쓰기는
-- 한 벌이고, 이름만 둘이다. 앱이 `edit_person_input` 으로 옮기고 프로덕션에서 옛 이름 호출이 0 인
-- 것을 본 뒤 좁히는 마이그레이션이 지운다.
--
-- `may_add_revision` 은 **앱이 안 부른다**(app · src · scripts 0건, 부르는 것은 DB 함수 둘). 그래서
-- 부르는 둘(`add_person_revision` → 이제 `edit_person_input`, `create_managed_person`)을 새 이름으로
-- 다시 적고 여기서 지운다. 권한은 옛것과 같다 — authenticated 만.

-- ── 관문 ─────────────────────────────────────────────────────────────────────
create function public.may_edit_person_input(target_person uuid, actor uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select coalesce(public.claimed_by(target_person), actor) = actor
     and exists (
       select 1 from public.user_person_access a
       where a.person_id = target_person
         and a.user_id = actor
         and a.role in ('owner', 'editor')
     );
$function$;

revoke execute on function public.may_edit_person_input(uuid, uuid) from anon, public;
grant execute on function public.may_edit_person_input(uuid, uuid) to authenticated;

-- ── 고치는 문 ────────────────────────────────────────────────────────────────
create function public.edit_person_input(p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  uuid, text, date, date, time, text, text, text, text, jsonb, text) from anon, public;
grant execute on function public.edit_person_input(
  uuid, text, date, date, time, text, text, text, text, jsonb, text) to authenticated;

-- ── 옛 이름 — 새 문을 부르는 겉. 좁히는 날 지운다 ─────────────────────────────
create or replace function public.add_person_revision(p_person_id uuid, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  /** 옛 이름(G-43). 앱이 `edit_person_input` 으로 옮기고 호출이 0 이 되면 지운다 */
  return public.edit_person_input(
    p_person_id, p_calendar, p_original_date, p_solar_date, p_birth_time,
    p_gender, p_city, p_late_night_rule, p_time_basis, p_chart, p_chart_engine_version);
end;
$function$;

-- ── 관문을 부르던 다른 하나 ───────────────────────────────────────────────────
create or replace function public.create_managed_person(p_local_label text, p_note text, p_calendar text, p_original_date date, p_solar_date date, p_birth_time time without time zone, p_gender text, p_city text, p_late_night_rule text, p_time_basis text, p_chart jsonb, p_chart_engine_version text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

  if not public.may_edit_person_input(new_person, actor) then
    raise exception '이 사람의 출생정보를 쌓을 수 없습니다.' using errcode = '42501';
  end if;

  return new_person;
end;
$function$;

-- ── 옛 관문은 부르는 것이 없어졌다 ───────────────────────────────────────────
drop function public.may_add_revision(uuid, uuid);
