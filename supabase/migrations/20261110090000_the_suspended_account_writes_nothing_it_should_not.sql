-- 정지된 계정의 쓰기 문 — 넷을 정한다 (운영자 결정 2026-09-30)
--
-- `75_suspended_write_doors`(#376)가 로그인한 사람이 부를 수 있는 쓰기 문 전부를 정지된 계정으로 두드렸고, 정지 판정이
-- 없는 문 넷과 정지를 말하지 않는 문 둘이 드러났다(2026-09-30). 운영자가 정했다:
--
-- - **`acknowledge_warning` · `cancel_match_request` 는 열어 둔다** — 남에게 해가 없고 후속 피해를 줄인다(받은 경고를 읽었다고
--   적는다 · 내가 보낸 요청을 거둔다). 이 마이그레이션은 둘을 안 건드린다 — 시험이 「의도적으로 열림」으로 잰다.
-- - **`clear_my_photo` 는 걷는다** — 사진이 여섯 장이 되기 전의 옛 문(「전부 내리기」)이다. 2026-09-30 에 `rg` 로 잰 호출은
--   app · src · e2e · scripts 에 0 이고, pgTAP 셋(61 · 62 · 63)만 불렀다 — 그 줄도 이 PR 이 걷는다. 지금 앱은
--   `remove_my_photo(position, version)` 으로 한 장씩 내린다.
-- - **`set_person_listed` 는 막는다** — 「정지된 계정은 Person · 목록을 쓰지 못한다」(`08_suspended`, 대신 등록 ·
--   출생 정보 수정과 같은 줄). 사람이 부르는 자리는 없고 `create_pair_for_reading` 이 안에서 부르는데, 그 문은 이미 정지를
--   먼저 본다 — 그 길의 답은 그대로다.
-- - **`set_contact_consent` · `set_improvement_consent` 는 정지를 말한다** — 막혀 있었지만 「계정을 찾지 못했습니다.」였다.
--   확정 문장 「이용이 정지된 계정입니다.」(G-49, `42501`)로 맞춘다. **판정은 계정 상태(`status`)만 본다** —
--   `is_active_account()` 는 베타 종료도 묻는데, 종료 뒤에도 동의를 거둘 수 있는 지금 동작을 바꾸지 않는다.

-- ---------------------------------------------------------------------------
-- 1. 옛 문을 걷는다
-- ---------------------------------------------------------------------------

drop function public.clear_my_photo();

-- ---------------------------------------------------------------------------
-- 2. 목록에 세우기 · 빼기 — 정지되면 막는다 (서명 · 권한 그대로)
-- ---------------------------------------------------------------------------

/**
 * 저장한 사람을 목록에 세우거나 뺀다 — 내 엣지만 고친다. 한도는 트리거(`enforce_person_limit`)가 센다.
 *
 * `create_pair_for_reading` 이 안에서 부른다 — 그 문은 정지를 먼저 보므로 이 판정에 닿지 않는다.
 */
create or replace function public.set_person_listed(p_person uuid, p_listed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.user_person_access
  set listed = p_listed
  where person_id = p_person
    and user_id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. 동의 둘 — 정지를 말한다 (서명 · 권한 · 나머지 동작 그대로)
-- ---------------------------------------------------------------------------

create or replace function public.set_contact_consent(p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_consent is null then
    raise exception '동의 여부를 정해 주세요.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.app_user u where u.id = (select auth.uid()) and u.status <> 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user u
  set contact_consent = p_consent
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;
end;
$$;

create or replace function public.set_improvement_consent(p_consent boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_consent is null then
    raise exception '동의 여부를 정해 주세요.' using errcode = 'check_violation';
  end if;

  if exists (
    select 1 from public.app_user u where u.id = (select auth.uid()) and u.status <> 'active'
  ) then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  update public.app_user u
  set improvement_consent = p_consent
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_consent = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());

    /* 서비스 설문도 같은 열쇠 뒤에 있다 — 값만 꺼 두면 근거 없이 남는 답이 생긴다 */
    delete from public.service_survey s
    where s.user_id = (select auth.uid());
  end if;
end;
$$;
