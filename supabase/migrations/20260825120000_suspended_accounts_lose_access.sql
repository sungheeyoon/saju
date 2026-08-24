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
 * 이 계정이 살아 있는가 — **`definer` 로 묻는다.**
 *
 * `app_user` 의 정책은 자기 행만 내주므로 평범한 질의로도 자기 상태는 읽힌다. 그래도
 * definer 로 두는 것은, 남의 id 로 물었을 때 「없다」와 「중지됐다」가 같은 거짓으로
 * 뭉개지지 않게 하려는 것이다(`claimed_by` 와 같은 이유).
 */
create or replace function public.is_active_account(actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_user u where u.id = actor and u.status = 'active');
$$;

grant execute on function public.is_active_account(uuid) to authenticated;

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
  public.is_active_account((select auth.uid()))
  and exists (
    select 1 from public.user_person_access a
    where a.person_id = person.id and a.user_id = (select auth.uid())
  )
);

drop policy "Person 이 보이면 그 판본도 보인다" on public.person_chart_revision;
create policy "Person 이 보이면 그 판본도 보인다"
on public.person_chart_revision for select to authenticated
using (
  public.is_active_account((select auth.uid()))
  and exists (
    select 1 from public.user_person_access a
    where a.person_id = person_chart_revision.person_id and a.user_id = (select auth.uid())
  )
);

drop policy "내 목록만 보인다" on public.user_person_access;
create policy "내 목록만 보인다"
on public.user_person_access for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));

drop policy "내 라벨만 고친다" on public.user_person_access;
create policy "내 라벨만 고친다"
on public.user_person_access for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())))
with check (user_id = (select auth.uid()));

drop policy "자기 자신은 목록에서 지울 수 없다" on public.user_person_access;
create policy "자기 자신은 목록에서 지울 수 없다"
on public.user_person_access for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_account((select auth.uid()))
  and person_id is distinct from (
    select u.self_person_id from public.app_user u where u.id = (select auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- discovery
-- ---------------------------------------------------------------------------
--
-- 후보 질의와 참여 RPC 는 이미 스스로 상태를 묻는다. 남은 것은 **직접 쓰는 길**이다 —
-- 중지된 계정이 프로필을 고치거나 감춘 목록을 손대는 자리.

drop policy "내 프로필만 보인다" on public.discovery_profile;
create policy "내 프로필만 보인다"
on public.discovery_profile for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));

drop policy "내 프로필만 만든다" on public.discovery_profile;
create policy "내 프로필만 만든다"
on public.discovery_profile for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));

drop policy "내 프로필만 고친다" on public.discovery_profile;
create policy "내 프로필만 고친다"
on public.discovery_profile for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())))
with check (user_id = (select auth.uid()));

drop policy "내가 감춘 사람만 보인다" on public.discovery_hidden;
create policy "내가 감춘 사람만 보인다"
on public.discovery_hidden for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));

drop policy "내 목록에만 감춘다" on public.discovery_hidden;
create policy "내 목록에만 감춘다"
on public.discovery_hidden for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));

drop policy "내가 감춘 것만 되돌린다" on public.discovery_hidden;
create policy "내가 감춘 것만 되돌린다"
on public.discovery_hidden for delete to authenticated
using (user_id = (select auth.uid()) and public.is_active_account((select auth.uid())));
