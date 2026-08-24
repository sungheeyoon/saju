-- 중지된 계정은 **읽지도 못한다**
--
-- 「접근 회수는 초대 목록에서 지우는 것이 아니라 계정 상태로 한다」(ADR 0006)고 정해
-- 놓고, 정작 그 상태가 막는 것은 **쓰기뿐**이었다. RPC 넷이 `status <> 'active'` 를
-- 물었고 읽기 정책은 아무도 묻지 않았다 — 중지된 계정으로도 자기 Person·판본·목록이
-- 그대로 보였고, 라벨·메모를 고치고 프로필을 만들 수 있었다.
--
-- 화면은 「중지된 계정입니다」라고 말하고 있었으므로 **판정이 앱에만 있었다**(ADR 0004
-- 가 막으려던 자리다). 그 조건을 정책으로 내린다.

/**
 * **내 계정이** 살아 있는가 — 물을 수 있는 것은 자기 자신뿐이다.
 *
 * 인자를 받지 않는다. `definer` 로 도는 함수에 uuid 를 받으면 **남의 상태를 묻는 문**이
 * 되고, RLS 를 지나가므로 그 답이 그대로 나간다. 「그 계정이 중지됐는가」는 남이 알 일이
 * 아니다. 안에서 `auth.uid()` 만 본다.
 *
 * `definer` 인 것은 정책 안에서 불리기 때문이다. 정책이 `app_user` 를 직접 읽으면 그
 * 표의 정책에 걸리고, 그때 「안 보인다」가 「중지됐다」로 읽힌다(`claimed_by` 와 같은 이유).
 */
create or replace function public.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_user u
    where u.id = (select auth.uid()) and u.status = 'active'
  );
$$;

revoke execute on function public.is_active_account() from anon, public;
grant execute on function public.is_active_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Person · 판본 · 목록
-- ---------------------------------------------------------------------------
--
-- `app_user` 는 그대로 둔다. 자기 상태를 못 읽으면 화면이 「중지된 계정입니다」라고
-- 말할 근거를 잃고, 로그인은 됐는데 아무 설명도 없는 화면이 남는다.

drop policy "내가 접근 근거를 가진 Person 만 보인다" on public.person;
create policy "내가 접근 근거를 가진 Person 만 보인다"
on public.person for select to authenticated
using (
  public.is_active_account()
  and exists (
    select 1 from public.user_person_access a
    where a.person_id = person.id and a.user_id = (select auth.uid())
  )
);

drop policy "Person 이 보이면 그 판본도 보인다" on public.person_chart_revision;
create policy "Person 이 보이면 그 판본도 보인다"
on public.person_chart_revision for select to authenticated
using (
  public.is_active_account()
  and exists (
    select 1 from public.user_person_access a
    where a.person_id = person_chart_revision.person_id and a.user_id = (select auth.uid())
  )
);

drop policy "내 목록만 보인다" on public.user_person_access;
create policy "내 목록만 보인다"
on public.user_person_access for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

drop policy "내 라벨만 고친다" on public.user_person_access;
create policy "내 라벨만 고친다"
on public.user_person_access for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account())
with check (user_id = (select auth.uid()));

drop policy "자기 자신은 목록에서 지울 수 없다" on public.user_person_access;
create policy "자기 자신은 목록에서 지울 수 없다"
on public.user_person_access for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_account()
  and person_id is distinct from (
    select u.self_person_id from public.app_user u where u.id = (select auth.uid())
  )
);

-- discovery 쪽 표는 아직 없다. 그 표의 정책은 처음부터 이 조건을 들고 선다
-- (`20260825090000_discovery.sql`) — 나중에 고쳐 다는 것보다 처음부터 다는 편이,
-- 「열어 준 것이 곧 열린 것의 전부」라는 말을 한 파일에서 읽게 한다.
