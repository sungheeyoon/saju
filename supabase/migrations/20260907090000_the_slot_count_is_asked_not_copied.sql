-- ---------------------------------------------------------------------------
-- 남은 자리는 **묻는 것이지 화면이 세는 것이 아니다**
-- ---------------------------------------------------------------------------

/**
 * 저장하는 입구가 늘었다. 사람 탭에 하나, 궁합 결과 아래에 하나(ADR 0030), 그리고 사주
 * 결과 아래에 하나. **자리가 없을 때 버튼을 그냥 눌리게 두면 눌러도 아무 일이 안
 * 일어난다** — 한 문으로 저장하므로 통째로 되돌아가고, 사용자에게 그것은 고장이다.
 *
 * 그래서 입구마다 「몇 자리 남았나」를 알아야 하는데, 그 셈이 화면으로 가면 자리가
 * 셋이 된다. 스무 명을 세는 규칙은 이미 미묘하다 — **selfPerson 은 안 센다.** 세 화면이
 * 각자 세면 그중 하나는 그것을 잊고, 그날 어느 화면은 열아홉을 스물이라고 말한다.
 *
 * ## 수도 한 자리에 둔다
 *
 * `20` 이 트리거 안에 박혀 있었고 화면이 그 수를 **손으로 베껴** 들고 있었다. 한도를
 * 옮기는 날 트리거만 고치면 화면은 계속 스물이라고 말한다. `reading_credit_limit()` 이
 * 이미 같은 모양이다 — 상수 하나를 함수로 세우고 세는 쪽이 그것을 읽는다.
 */
create or replace function public.person_limit()
returns integer
language sql
immutable
as $$ select 20 $$;

-- 상수를 내주는 함수라도 닫는다. 기본값이 닫아 줄 거라 믿지 않는다.
revoke execute on function public.person_limit()
  from anon, public, authenticated, service_role;

/**
 * 한도를 거는 자리 — **수만 함수에서 읽도록 고친다.**
 *
 * 세는 규칙(`selfPerson` 은 빼고 센다)은 그대로다. 바뀐 것이 둘이다.
 *
 * **하나 — `20` 이 여기 안 박혀 있다.** `person_limit()` 이 든다.
 *
 * **둘 — `definer` 다.** 트리거 함수는 넣은 사람의 자격으로 도는데, 그 사람에게는
 * `person_limit()` 이 닫혀 있다(상수를 내주는 함수라도 닫는다는 규율). 여는 대신
 * **한도를 거는 쪽을 definer 로 올린다** — 한도는 사용자가 묻는 값이 아니라 우리가
 * 거는 것이고, 남은 자리를 묻는 문은 따로 있다(`my_person_slots`).
 *
 * 이것이 여는 것은 없다. 이 함수는 세고 거절할 뿐 아무것도 내주지 않는다. 오히려
 * 세는 것이 **정책에 가려지지 않게** 된다 — invoker 로 돌 때 이 셈은 부른 사람이 볼 수
 * 있는 행만 셌다.
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
    and a.person_id is distinct from u.self_person_id;

  if managed > public.person_limit() then
    raise exception '등록할 수 있는 사람은 %명까지입니다.', public.person_limit()
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

/**
 * 내 저장 자리 — **화면이 빼기를 하지 않는다.**
 *
 * `my_reading_credits()` 와 같은 규율이다. `remaining` 을 여기서 내는 것은, 화면에
 * 한도와 쓴 수만 주면 빼는 일이 화면으로 가고 **그중 하나가 selfPerson 을 잊기**
 * 때문이다.
 *
 * **uuid 를 받지 않는다.** 받으면 남의 목록 크기를 묻는 문이 된다 — definer 는 정책을
 * 지나가므로, 이 함수가 답할 수 있는 사람은 부른 사람 하나여야 한다.
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
      and a.person_id is distinct from u.self_person_id
  ) counted;
$$;

revoke execute on function public.my_person_slots() from anon, public;
grant execute on function public.my_person_slots() to authenticated;
