-- 안내는 첫 입력보다 먼저다 — 그리고 **묻고 나면 「안 물었다」가 아니다**
--
-- 처리 안내와 선택 동의를 받는 자리를 만든다. 값이 셋이고, 셋의 뜻이 서로 다르다.
--
--   notice_ack_at        안내를 읽었다 — **동의가 아니라 확인이다.** 서비스 제공에
--                        필요한 처리는 계약 이행 근거로 하고, 무엇을 어떤 목적으로
--                        얼마나 보관하는지는 처리방침이 알린다. 여기 남는 것은 그것을
--                        **언제 보여 주었는가**다.
--   improvement_consent  선택 — 설문과 이용 기록을 풀이 개선에 쓴다(ADR 0022)
--   contact_consent      선택 — 다음 테스트 초대와 인터뷰 연락에 이메일을 쓴다
--
-- ## `null` 이 남을 수 있는 자리와 없는 자리
--
-- 안내 화면을 지난 사람에게 선택 동의가 `null` 로 남으면 안 된다. `null` 은 「아직 안
-- 물었다」인데 우리는 물었기 때문이다 — 거절한 사람과 안 물어본 사람이 같은 값이 되면
-- 다시 물어야 할 사람을 못 고른다. 그래서 확인과 두 답을 **한 함수가 함께** 받는다.
--
-- ## 판본을 든다
--
-- 문구가 바뀌면 다시 보여 줘야 한다. 「보여 준 적 있다」가 아니라 「무엇을 보여
-- 주었는가」가 남아야 그 판단을 할 수 있다.

alter table public.app_user
  add column notice_version text,
  add column notice_ack_at timestamptz;

/**
 * 판본과 시각은 **함께 있거나 함께 없다.**
 *
 * 한쪽만 남으면 「무엇을 언제 보여 주었나」에 반쪽만 답하게 되고, 그 반쪽으로는 다시
 * 보여 줄지를 정할 수 없다.
 */
alter table public.app_user add constraint notice_is_a_version_and_a_time check (
  (notice_version is null) = (notice_ack_at is null)
);

alter table public.app_user add column contact_consent boolean;

/**
 * 안내를 확인하고 선택 답을 함께 남긴다 — **한 번의 왕복이다.**
 *
 * 갈라 두면 확인만 하고 선택은 `null` 로 남는 사람이 생긴다. 그 사람은 「물었는데 답을
 * 안 한」 것인데 값은 「안 물어본」 것과 같아진다. 화면이 두 번 부르는 것을 기억해야
 * 맞는 설계는 언젠가 한 번을 잊는다 — 부르는 쪽에 손으로 적을 자리를 남기지 않는다.
 *
 * 선택 답은 `boolean` 이고 `null` 을 안 받는다. 안 고른 채로 지나가는 길을 열면 그
 * 화면이 무엇을 물었는지가 값에서 사라진다.
 *
 * **거절해도 서비스는 그대로다.** 이 함수는 두 값을 적을 뿐이고, 사주·궁합·풀이 어느
 * 것도 이 값을 묻지 않는다. 묻는 것은 설문 하나뿐이다(ADR 0022).
 */
create or replace function public.acknowledge_notice(
  p_version text,
  p_improvement boolean,
  p_contact boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_version is null or length(btrim(p_version)) = 0 then
    raise exception '안내 판본을 알 수 없습니다.' using errcode = 'check_violation';
  end if;

  if p_improvement is null or p_contact is null then
    raise exception '선택 항목에 답해 주세요.' using errcode = 'check_violation';
  end if;

  update public.app_user u
  set notice_version = p_version,
      notice_ack_at = now(),
      improvement_consent = p_improvement,
      contact_consent = p_contact
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  /**
   * **거절이 곧 지움이다**(ADR 0022). 안내 화면에서 거절한 사람에게도 같은 규칙이
   * 적용된다 — 판본이 올라 다시 물었을 때 마음을 바꾼 경우가 그 자리다.
   */
  if p_improvement = false then
    delete from public.reading_feedback f
    where f.respondent_user_id = (select auth.uid());
  end if;
end;
$$;

revoke execute on function public.acknowledge_notice(text, boolean, boolean)
  from anon, public;
grant execute on function public.acknowledge_notice(text, boolean, boolean) to authenticated;

/**
 * 후속 연락 동의만 따로 바꾼다 — 설정 화면의 자리다.
 *
 * `set_improvement_consent` 와 갈라 둔다. 하나로 합치면 한쪽만 바꾸려는 화면이 다른
 * 쪽 값을 **다시 적어 넣어야** 하고, 그때 그 값을 어디서 읽어 왔는지가 또 한 자리가 된다.
 */
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

  update public.app_user u
  set contact_consent = p_consent
  where u.id = (select auth.uid()) and u.status = 'active';

  if not found then
    raise exception '계정을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.set_contact_consent(boolean) from anon, public;
grant execute on function public.set_contact_consent(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 첫 입력 앞의 관문
-- ---------------------------------------------------------------------------

/**
 * `create_or_replace` 로 되쓰는 바탕은 음력 입력을 받게 한 24일자 정의다. 바뀐 것은
 * 검사 한 덩어리뿐이다.
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

  /**
   * **안내를 읽기 전에는 첫 입력을 받지 않는다.**
   *
   * 여기가 출생정보가 처음 이 서비스에 들어오는 자리다. 그 앞에 무엇을 어떤 목적으로
   * 얼마나 보관하는지 알리지 않으면, 알린 적 없는 처리가 시작된다.
   *
   * 화면에도 관문이 있다(`/me` 아래 전체). 그래도 여기 두는 것은 **되돌릴 수 없는
   * 첫 쓰기**이기 때문이다 — 화면만 막으면 주소나 RPC 로 지나간다. 이 저장소가 방금
   * 그 자리를 하나 고쳤다.
   */
  if account.notice_ack_at is null then
    raise exception '먼저 처리 안내를 확인해 주세요.' using errcode = '42501';
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

revoke execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.create_self_person(
  text, text, date, date, time, text, text, text, text) to authenticated;
