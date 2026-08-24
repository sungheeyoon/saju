-- 가족·친구 Person — 내가 등록해서 관리하는 사람
--
-- 표는 처음부터 서 있었다: `user_person_access`, 20명 한도 트리거(`person_limit`),
-- 목록·수정·삭제 정책. **없던 것은 쓰는 문 하나**다. `authenticated` 에는
-- `person`·`person_chart_revision`·`user_person_access` 의 `insert` 권한이 없으므로
-- (「이 파일이 여는 것이 곧 열린 것의 전부」 — `20260824090200_access_policies.sql`),
-- Person 을 만드는 길은 `security definer` RPC 하나뿐이다.

-- ---------------------------------------------------------------------------
-- 메모 — 있거나 없다. 빈 문자열은 없다.
-- ---------------------------------------------------------------------------

/**
 * `note` 에만 상한이 없었다.
 *
 * 부를 이름은 12자로 묶여 있다(`local_label`). 메모는 처음부터 아무 길이나
 * 받았는데, 그 칸을 실제로 쓰는 화면이 이제 생기므로 여기서 묶는다. 길이를
 * 화면에만 적으면 화면을 거치지 않는 길이 언젠가 하나 생긴다.
 *
 * **빈 문자열을 막는 것이 길이보다 중요하다.** `null` 과 `''` 이 둘 다
 * 「메모 없음」이면 화면이 두 값을 같은 뜻으로 다뤄야 하고, 그러다 한쪽을
 * 잊는다. 없음은 `null` 하나다.
 */
alter table public.user_person_access
  add constraint note_is_absent_or_written
  check (note is null or length(btrim(note)) between 1 and 200);

-- ---------------------------------------------------------------------------
-- 관리 Person 을 만든다 — Person·엣지·판본을 한 트랜잭션에
-- ---------------------------------------------------------------------------

/**
 * 가족·친구 한 사람을 등록한다.
 *
 * `create_self_person` 과 같은 모양이고 **다른 것은 셋**이다.
 *
 * - claim 하지 않는다. 이 사람은 내가 대신 등록한 사람이지 내가 아니다
 *   (`app_user.self_person_id` 는 건드리지 않는다).
 * - 몇 명이든 만들 수 있다. 대신 20명 한도가 걸린다 — 그 판정은 여기가 아니라
 *   `enforce_person_limit()` 트리거가 한다. 세는 규칙을 두 곳에 적으면 언젠가
 *   한쪽만 고쳐지고, selfPerson 을 세느냐 마느냐가 그때 갈린다.
 * - 메모를 함께 받는다. 여덟 글자를 바꾸지 않으므로 판본이 아니라 엣지가 든다.
 *
 * 네 개의 쓰기가 하나의 사건인 이유는 `create_self_person` 에 적은 그대로다 —
 * 나눠 부르면 「Person 은 있는데 판본이 없는」 상태가 실재하게 된다.
 */
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
  new_person uuid;
  new_revision uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if (select status from public.app_user where id = actor) <> 'active' then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  insert into public.person default values returning id into new_person;

  /**
   * 등록한 사람이 `owner` 다.
   *
   * 나중에 이 Person 이 claim 되면 `demote_others_on_claim` 이 이 행을 `viewer` 로
   * 내린다 — 그때부터 출생정보는 본인만 고친다(ADR 0004). 여기서 미리 걱정할 것은
   * 없고, 걱정하지 않아도 되게 만들어 둔 것이 그 트리거다.
   */
  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

  /**
   * **정책이 묻는 것과 같은 함수에 묻는다.**
   *
   * `security definer` 는 RLS 를 지나가므로 판본 insert 정책이 여기서는 안 걸린다.
   * 방금 만든 엣지 때문에 답은 참일 수밖에 없지만, 그 「없을 수밖에 없다」가
   * 무너지는 날 — 엣지의 역할이 바뀌거나 순서가 뒤집히는 날 — 조용히 열리지
   * 않게 하려고 묻는다(`may_add_revision` · `20260824170000_revise_chart.sql`).
   */
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

  update public.person set current_revision_id = new_revision where id = new_person;

  return new_person;
end;
$$;

revoke execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text) from anon, public;
grant execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text) to authenticated;
