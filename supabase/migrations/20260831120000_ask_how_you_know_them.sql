-- ---------------------------------------------------------------------------
-- 무슨 사이인지 묻는다 — **글이 달라지는데 자료에 없던 값**
-- ---------------------------------------------------------------------------

/**
 * 궁합 풀이가 **두 사람이 무슨 사이인지 모른 채** 쓰이고 있었다.
 *
 * 그래서 어머니와의 궁합에 「처음에 끌리는 지점」과 「가까워질수록」이 나갔다. 모델이
 * 지어낸 것이 아니다 — 자료에 없어서 관계의 일반적 가능성으로 읽은 것이고, 모델이
 * 스스로 「자료에는 두 사람이 연인인지 동료인지 가족인지가 없습니다」라고 적었다.
 *
 * 정말로 없었다. `person` 에도 `person_chart_revision` 에도 관계 열이 없고,
 * `user_person_access` 가 든 것은 부를 이름과 메모뿐이다. **제품이 한 번도 안 물었다.**
 *
 * ## 사람이 아니라 **나와 그 사람 사이**에 붙는다
 *
 * `local_label` 과 같은 자리다. 같은 사람이 누군가에겐 어머니고 누군가에겐 친구다.
 * `person` 에 붙이면 그 사람이 「가족」이라는 속성을 가진 것이 되는데, 그것은 우리가
 * 아는 사실이 아니다.
 *
 * ## 모른다를 값으로 든다
 *
 * `null` 을 허용한다. 이 값이 없던 시절에 등록한 사람이 계속 있고, **두 관리 Person
 * 끼리의 궁합은 애초에 알 수가 없다** — 저장한 것은 「나와 그 사람」이지 「그 둘」이
 * 아니기 때문이다. 모를 때 아는 척 채우면 그 순간부터 틀린 장면이 확신을 얻는다.
 *
 * ## 판정에는 안 쓴다
 *
 * 이 값은 글의 장면과 조언을 고르는 값이지 점수를 움직이는 값이 아니다. 넣기
 * 시작하면 「가족이라 78점」 같은 것이 나오고, 그것은 근거가 아니라 우리가 지어낸
 * 규칙이다. 그래서 `discovery` 도 `match` 도 이 열을 안 읽는다.
 */
alter table public.user_person_access
  add column relation text
  check (relation is null or relation in ('family', 'friend', 'partner', 'other'));

/**
 * 고치는 것도 연다.
 *
 * `local_label` · `note` 와 같은 문이다(`20260824090200_access_policies.sql` 이
 * 그 둘에만 `update` 를 열어 두었다). 관계를 잘못 골랐을 때 사람을 지웠다 다시
 * 등록하게 두면, 그 사람의 판본 이력이 그 실수 때문에 사라진다.
 */
grant update (relation) on public.user_person_access to authenticated;

-- ---------------------------------------------------------------------------
-- 등록할 때 함께 받는다
-- ---------------------------------------------------------------------------

/**
 * `create_managed_person` 에 관계가 는다.
 *
 * **기본값을 두지 않는다.** 부르는 쪽이 안 넘기면 `null` 이고 그것은 「모른다」다 —
 * 「가족」 같은 그럴듯한 기본값을 두면, 안 물어본 사람 전부가 가족이라고 적힌다.
 *
 * 검사식은 열에 붙어 있으므로 여기서 다시 묻지 않는다. 값을 재는 자리가 둘이면
 * 언젠가 한쪽만 고쳐진다.
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
  p_time_basis text,
  p_relation text default null
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

  insert into public.user_person_access (user_id, person_id, local_label, note, role, relation)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner', p_relation);

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

/**
 * **옛 서명을 지운다.**
 *
 * `default null` 을 붙였으므로 인자 열 개짜리 호출도 이 함수로 온다. 그런데 옛 함수를
 * 그대로 두면 열 개짜리 호출이 **어느 쪽으로 갈지 모호해지고**, 더 나쁘게는 관계를
 * 영영 안 받는 문이 하나 열린 채 남는다 — 브라우저가 부를 수 있는 문이다.
 */
drop function if exists public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text);

revoke execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, text) from anon, public;
grant execute on function public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, text) to authenticated;
