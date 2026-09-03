-- ---------------------------------------------------------------------------
-- 직접 입력한 **두 사람은 한 누름에 저장된다**
-- ---------------------------------------------------------------------------

/**
 * 「두 사람 직접 입력」 화면에는 AI 풀이가 없었다. 저장하지 않는 화면이라 넘길 대상이
 * 없고, 대상이 없으면 시도도 잠금도 풀이권도 걸 자리가 없다. 그래서 그 화면에서 AI
 * 풀이로 가는 유일한 길은 **두 사람을 저장하는 것**이다.
 *
 * 앱에서 `create_managed_person` 을 두 번 부르면 그 길이 열리기는 한다. 다만 **둘이
 * 한 사건이 아니게 된다.**
 *
 * 스무 명 한도가 그것을 바로 드러낸다. 열아홉 명이 저장된 사람이 둘을 저장하면 첫
 * 사람은 들어가고 둘째에서 트리거가 막는다. 그러면 사용자는 **고르지도 않은 한 명**이
 * 목록에 남은 채 거절 문장을 읽고, 되돌리는 일은 호출부가 기억해야 한다 — 기억하는
 * 자리가 하나 늘면 그중 하나는 안 고쳐진다.
 *
 * 한 문으로 묶는다. `raise` 가 같은 트랜잭션의 앞 insert 를 되돌리므로, 한도에 걸리면
 * **아무도 저장되지 않는다.**
 *
 * ## 새 규칙을 여기 적지 않는다
 *
 * 안에서 하는 일은 이미 있는 문 셋을 차례로 부르는 것뿐이다 — 등록 둘과 사이 하나.
 * 자격·한도·판본을 여기서 다시 판정하면 판정하는 자리가 둘이 되고, 그 둘은 언젠가
 * 어긋난다. 여기가 더하는 것은 **한 트랜잭션**이라는 사실 하나다.
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
  p_relation text
)
returns table (person_a uuid, person_b uuid)
language plpgsql
/**
 * **`invoker` 다.** 안에서 부르는 셋이 각자 자기 자격을 묻고, 그중 둘은 이미 definer 라
 * 필요한 만큼만 연다. 여기를 definer 로 두면 이 함수가 그 셋의 판정을 **지나가는 문**이
 * 되고, 그때 무엇이 열렸는지는 이 파일이 아니라 저 셋을 다 읽어야 알 수 있다.
 */
security invoker
set search_path = ''
as $$
declare
  first_person uuid;
  second_person uuid;
begin
  first_person := public.create_managed_person(
    p_a_local_label, p_a_note, p_a_calendar, p_a_original_date, p_a_solar_date,
    p_a_birth_time, p_a_gender, p_a_city, p_a_late_night_rule, p_a_time_basis
  );

  second_person := public.create_managed_person(
    p_b_local_label, p_b_note, p_b_calendar, p_b_original_date, p_b_solar_date,
    p_b_birth_time, p_b_gender, p_b_city, p_b_late_night_rule, p_b_time_basis
  );

  /**
   * 사이는 **고른 사람만** 적는다. `null` 은 「모른다」이고 그것은 행이 없는 것이므로,
   * 방금 만든 쌍에 대고 지우는 문을 부를 이유가 없다(ADR 0019).
   */
  if p_relation is not null then
    perform public.set_pair_relation(first_person, second_person, p_relation);
  end if;

  return query select first_person, second_person;
end;
$$;

revoke execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text
) from anon, public;

grant execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text
) to authenticated;
