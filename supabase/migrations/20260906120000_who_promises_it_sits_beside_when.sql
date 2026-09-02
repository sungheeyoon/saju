-- **누가 약속하는가**가 언제 끝나는가 옆에 앉는다
--
-- 처리방침에 처리자와 연락처가 없으면 열람·정정·삭제·처리정지는 적혀만 있는 권리가 된다.
-- 사용자는 누구에게 무엇을 요구해야 하는지 모른다.
--
-- 코드 상수로 두었다가 옮긴다. 날짜와 **같은 성격의 값**이기 때문이다 — 운영자가 정하고,
-- 없으면 안내가 만들어지지 않고, 언제든 바뀔 수 있다. 두 값이 같은 것을 막는데 하나는
-- 배포로 바꾸고 하나는 SQL 로 바꾸면 그 둘을 함께 다루는 절차를 쓸 수가 없다.
--
-- 한 표에 둔 것은 둘이 **같은 문서의 내용**이기 때문이다. 어느 쪽이 바뀌든 사용자가
-- 읽은 것이 바뀌므로 새 줄이 되고, 다시 알린다.

alter table public.beta_schedule
  add column operator_name text,
  add column operator_officer text,
  add column operator_contact text;

/**
 * 셋은 함께 있거나 함께 없다.
 *
 * 이름만 있고 연락처가 없으면 「누구인지는 알겠는데 어디로 말하나」가 된다 — 반쪽으로는
 * 권리를 행사할 수 없으므로 반쪽을 실을 바에 안 싣는다.
 */
alter table public.beta_schedule add constraint operator_is_whole check (
  (operator_name is null) = (operator_officer is null)
  and (operator_name is null) = (operator_contact is null)
);

/**
 * 지금 안내 — 날짜 둘과 **누가 약속하는가**.
 *
 * `anon` 도 읽는다. 처리방침은 초대 메일에 실리므로 로그인 없이 열려야 하고, 여기
 * 실리는 것은 그 방침이 이미 공개하는 값뿐이다.
 */
drop function if exists public.current_beta_schedule();

create or replace function public.current_beta_schedule()
returns table (
  ends_on date,
  purge_by date,
  purge_within_days integer,
  operator_name text,
  operator_officer text,
  operator_contact text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.ends_on, s.ends_on + s.purge_within_days, s.purge_within_days,
    s.operator_name, s.operator_officer, s.operator_contact
  from public.beta_schedule s
  order by s.id desc
  limit 1;
$$;

revoke execute on function public.current_beta_schedule() from public;
grant execute on function public.current_beta_schedule() to anon, authenticated;
