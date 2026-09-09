-- ---------------------------------------------------------------------------
-- 궁합은 **저장하지 않고도** 읽힌다 — 그때 두 사람은 목록에 안 선다
-- ---------------------------------------------------------------------------

/**
 * 직접 입력한 두 사람에게는 AI 풀이가 없었다. 시도도 잠금도 풀이권도 **대상**에
 * 거는데(ADR 0013) 저장하지 않는 화면에는 걸 대상이 없다. 그래서 그 화면에서 풀이로
 * 가는 유일한 길이 「두 사람을 저장하기」였다 — 궁합 한 번 보려고 사람 목록에 둘이
 * 남았고, 그 둘을 지우는 일은 사용자 몫이었다.
 *
 * **대상은 만들되 목록에는 안 세운다.** 판본·잠금·풀이권·잊기가 이미 사람에 걸려
 * 있으므로 그 길을 그대로 탄다. 달라지는 것은 한 가지 — 이 엣지는 **사람 목록에
 * 안 선다**(`listed`). 궁합을 본 사실은 풀이 목록에 남고, 거기서 다시 열린다.
 *
 * ## 왜 열 하나인가
 *
 * 「숨은 사람」을 따로 만들지 않는다. 다른 표에 두면 판본을 읽는 자리, 지우는 자리,
 * 잊는 자리가 두 벌이 되고 그중 하나는 안 고쳐진다. 여기서 늘어나는 것은 **목록에
 * 세울지**를 묻는 값 하나다.
 *
 * ## 자리 수에는 안 든다
 *
 * 열 명 한도는 「내가 관리하는 사람」의 수다. 목록에 안 서는 사람이 그 자리를 먹으면,
 * 사용자는 자기가 저장한 적 없는 것 때문에 저장을 못 하게 된다 — 그러고도 무엇이
 * 자리를 먹었는지 볼 수 없다.
 */
alter table public.user_person_access
  add column if not exists listed boolean not null default true;

comment on column public.user_person_access.listed is
  '사람 목록에 서는가. false 면 궁합을 읽으려고 만든 사람이라 목록·자리 수에 안 든다.';

/**
 * 한도는 **목록에 서는 사람만** 센다.
 *
 * 세는 규칙이 하나 늘었다. `selfPerson` 을 안 세는 것과 같은 자리에서 판정한다 —
 * 세는 곳이 둘이 되면 어느 날 한쪽만 고쳐진다.
 *
 * **update 에도 건다.** 숨은 사람을 목록에 올리는 길이 열리면(`set_person_listed`)
 * 그 누름은 자리를 하나 쓴다. insert 에만 걸어 두면 한도를 지나가는 문이 된다.
 */
create or replace function public.enforce_person_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  managed integer;
begin
  select count(*) into managed
  from public.user_person_access a
  join public.app_user u on u.id = a.user_id
  where a.user_id = new.user_id
    and a.listed
    and a.person_id is distinct from u.self_person_id;

  if managed > public.person_limit() then
    raise exception '등록할 수 있는 사람은 %명까지입니다.', public.person_limit()
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists person_limit on public.user_person_access;

create constraint trigger person_limit
after insert or update of listed on public.user_person_access
deferrable initially deferred
for each row execute function public.enforce_person_limit();

/**
 * 남은 자리도 같은 규칙으로 센다 — 트리거가 거절하는 수와 화면이 적는 수가 갈리면,
 * 화면은 자리가 있다고 말하는데 저장은 거절되는 날이 온다.
 */
create or replace function public.my_person_slots()
returns table (person_limit integer, used integer, remaining integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.person_limit(),
    counted.used,
    greatest(0, public.person_limit() - counted.used)
  from (
    select count(*)::integer as used
    from public.user_person_access a
    join public.app_user u on u.id = a.user_id
    where a.user_id = (select auth.uid())
      and a.listed
      and a.person_id is distinct from u.self_person_id
  ) counted;
$$;

/**
 * 목록에 세울지를 바꾸는 문 — **내 엣지 하나만.**
 *
 * `definer` 인 까닭은 정책이 이 열을 안 열어 두기 때문이다. 엣지의 update 정책이
 * 여는 칸은 부르는 이름과 메모뿐이고(`local_label`·`note`), 그 목록에 이 열을 더하면
 * **모든 update 경로에** 열린다. 여기서만 여는 대신 `user_id` 를 손으로 좁힌다.
 *
 * 한도는 이 문이 안 센다 — 트리거가 센다. 여기서 또 세면 세는 자리가 둘이 된다.
 */
create or replace function public.set_person_listed(p_person uuid, p_listed boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_person_access
  set listed = p_listed
  where person_id = p_person
    and user_id = (select auth.uid());
$$;

revoke execute on function public.set_person_listed(uuid, boolean) from anon, public;
grant execute on function public.set_person_listed(uuid, boolean) to authenticated;

/**
 * 쌍을 여는 문이 **목록에 세울지도 받는다.**
 *
 * 기본값은 `true` 다. 앞서 이 함수에 인자를 더할 때는 기본값을 안 붙였다 — 그때 더한
 * 것이 「이미 있는 사람을 쓴다」는 확인이라, 기본값을 두면 그 확인을 지나가는 옛 문이
 * 열린 채 남기 때문이었다. 이번에 더하는 값은 반대다: 빠뜨렸을 때 서는 쪽이
 * **목록에 보이는 사람**이라, 기본값이 여는 것이 없다.
 *
 * **이미 있는 사람은 안 숨긴다.** 사용자가 「저장된 어머니와 같은 사람입니다」라고
 * 답해서 그 사람을 쓰는 경우, 그 엣지는 사용자가 만든 것이다 — 궁합 한 번 보는 일이
 * 남의 목록에서 사람을 지울 수는 없다.
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
  p_a_person uuid,
  p_b_person uuid,
  /** 만든 사람을 목록에 세울까 — 궁합만 보려는 누름은 `false` 로 부른다 */
  p_listed boolean default true
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

  /* 새로 만든 쪽만 숨긴다 — 있던 사람의 엣지는 사용자 것이다 */
  if not p_listed then
    if p_a_person is null then perform public.set_person_listed(first_person, false); end if;
    if p_b_person is null then perform public.set_person_listed(second_person, false); end if;
  end if;

  if p_relation is not null then
    perform public.set_pair_relation(first_person, second_person, p_relation);
  end if;

  return query select first_person, second_person;
end;
$$;

/**
 * **옛 서명을 지운다.** 두 벌이 서 있으면 인자 이름으로 고르는 쪽(PostgREST)이 둘 다
 * 맞다고 볼 수 있고, 그때 어느 쪽이 불렸는지는 호출을 봐도 알 수 없다.
 */
drop function if exists public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text, uuid, uuid
);

revoke execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text, uuid, uuid, boolean
) from anon, public;

grant execute on function public.create_pair_for_reading(
  text, text, text, date, date, time, text, text, text, text,
  text, text, text, date, date, time, text, text, text, text, text, uuid, uuid, boolean
) to authenticated;
