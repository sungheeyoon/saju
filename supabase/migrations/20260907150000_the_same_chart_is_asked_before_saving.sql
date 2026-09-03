-- ---------------------------------------------------------------------------
-- 이미 저장된 사람이면 **그 사람을 쓴다** (ADR 0034)
-- ---------------------------------------------------------------------------

/**
 * 같은 사람을 두 번 저장하면 대상이 둘이 되고, 대상이 둘이면 **풀이권도 둘**이다
 * (ADR 0013·0021 — 시도도 잠금도 현재 결과도 대상에 건다). 다섯 개짜리 지갑에서 그것은
 * 20% 다. 어머니를 「엄마」로 한 번, 나중에 「어머니」로 또 한 번 저장하면 일어난다.
 *
 * **막는 자리는 저장이다.** `target_key` 를 명식 기준으로 바꾸는 길도 있었지만 안 간다 —
 * 명식이 같아도 「엄마」와 「친구」는 다른 대상이고(사이가 다르고 부를 이름이 다르다),
 * 그 키는 사용자가 출생지를 고치는 것만으로 갈라진다. 잠금과 풀이권이 걸린 키가 입력에
 * 따라 갈라지면 안 된다.
 *
 * ## 여기는 「같은가」를 판정하지 않는다
 *
 * **DB 는 명식을 계산할 수 없다** — 절기·자시·경도 판정이 TypeScript 엔진에 있다.
 * 그래서 「이미 있나」를 묻고 사용자에게 확인받는 일은 앱이 하고(저장된 판본을 읽어 같은
 * 엔진으로 계산해 견준다), 여기는 그 답을 받아 **한 사람만 만드는 길**을 연다.
 *
 * 지문을 열로 저장하는 길도 있었다. 안 간다 — 엔진이 바뀌면 그 지문은 조용히 낡고,
 * 낡은 지문은 「다른 사람」이라고 조용히 답한다. 그때마다 다시 세는 일을 우리가 기억해야
 * 한다. 저장할 때 계산하면 언제나 지금 엔진의 답이다.
 */

/**
 * 둘 중 **한쪽이 이미 저장돼 있을 수 있다.**
 *
 * 옛 서명은 두 사람을 늘 새로 만들었다. 사용자가 「저장된 어머니와 같은 사람입니다」라고
 * 답하면 그 사람은 만들지 않고 **있는 것을 쓴다.** 그래야 한 누름이 그대로 유지된다 —
 * 갈라서 「하나는 만들고 하나는 쓰고」를 앱이 순서대로 하면, 한도에 걸렸을 때 되돌리는
 * 일을 다시 호출부가 기억하게 된다.
 *
 * **주는 id 가 내 것인지 여기서 묻는다.** `security invoker` 라 `user_person_access` 의
 * 정책이 이미 자기 줄만 내주므로 `user_id` 를 손으로 적지 않는다 — 없으면 없는 것이다.
 * 이 확인이 없으면 남의 person id 를 넣어 내 `pair_relation` 에 줄을 만들 수 있다.
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
  /** 이미 저장돼 있다고 사용자가 답한 사람 — `null` 이면 새로 만든다 */
  p_a_person uuid,
  p_b_person uuid
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
    p_a_birth_time, p_a_gender, p_a_city, p_a_late_night_rule, p_a_time_basis
  );

  second_person := public.person_for_pair(
    p_b_person, p_b_local_label, p_b_note, p_b_calendar, p_b_original_date, p_b_solar_date,
    p_b_birth_time, p_b_gender, p_b_city, p_b_late_night_rule, p_b_time_basis
  );

  if p_relation is not null then
    perform public.set_pair_relation(first_person, second_person, p_relation);
  end if;

  return query select first_person, second_person;
end;
$$;

/**
 * 한쪽을 정한다 — **있으면 확인하고 쓰고, 없으면 만든다.**
 *
 * 갈래를 `create_pair_for_reading` 안에 두 번 적으면 한쪽에만 확인이 붙는 날이 온다.
 * `security invoker` 라 정책이 좁힘을 든다.
 */
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
  p_time_basis text
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
      p_birth_time, p_gender, p_city, p_late_night_rule, p_time_basis);
  end if;

  -- 없는 사람과 못 보는 사람을 가르지 않는다. 정책이 이미 자기 줄만 내준다.
  if not exists (select 1 from public.user_person_access a where a.person_id = p_person) then
    raise exception '저장한 사람 목록에 없는 사람입니다.' using errcode = '42501';
  end if;

  return p_person;
end;
$$;

/**
 * **`authenticated` 에게 연다.** `create_pair_for_reading` 이 `invoker` 라, 닫아 두면
 * 부르는 사람이 안쪽에서 걸린다.
 *
 * 여는 것이 없어서 열 수 있다. 이 함수가 `invoker` 로 하는 일은 둘뿐이다 — 이미 열려
 * 있는 `create_managed_person` 을 부르거나, 부른 사람이 **이미 들고 있는 id** 가 자기
 * 목록에 있는지 정책에 묻는 것. 뒤의 것은 `user_person_access` 를 직접 select 하는 것과
 * 같은 답을 내고, 그 표는 이미 자기 줄이 보인다. 새로 새는 사실이 하나도 없다.
 */
revoke execute on function public.person_for_pair(
  uuid, text, text, text, date, date, time, text, text, text, text
) from anon, public, service_role;

grant execute on function public.person_for_pair(
  uuid, text, text, text, date, date, time, text, text, text, text
) to authenticated;

/**
 * **옛 서명을 지운다.**
 *
 * 새 인자를 기본값으로 붙이면 옛 서명이 그대로 살아 있고, 그러면 **확인을 지나가는 문**이
 * 브라우저에 열린 채 남는다(ADR 0018 이 `create_managed_person` 에서 겪은 자리다).
 */
drop function if exists public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text
);

revoke execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text, uuid, uuid
) from anon, public;

grant execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text, uuid, uuid
) to authenticated;
