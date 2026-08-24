-- 접근 판정 — 정책이 든다
--
-- ADR 0004: 서비스 코드의 관례로 두지 않고 DB 불변식으로 건다. 앱에 조건을 적으면
-- 그 조건을 안 부르는 경로가 언젠가 하나 생기고, 그 경로는 조용히 열려 있다.

-- 기본 권한부터 좁힌다. Supabase 는 `public` 의 표에 넉넉한 기본 권한을 주므로,
-- 열어 줄 것만 다시 준다.
revoke all on public.app_user, public.person, public.person_chart_revision,
  public.user_person_access from anon, authenticated;

grant select on public.app_user, public.person, public.person_chart_revision to authenticated;
grant select, delete on public.user_person_access to authenticated;
-- 라벨과 메모만 고칠 수 있다. 역할과 대상은 스스로 올릴 수 없어야 한다.
grant update (local_label, note) on public.user_person_access to authenticated;

alter table public.app_user enable row level security;
alter table public.person enable row level security;
alter table public.person_chart_revision enable row level security;
alter table public.user_person_access enable row level security;

-- ---------------------------------------------------------------------------

create policy "자기 계정만 읽는다"
on public.app_user for select to authenticated
using (id = (select auth.uid()));

-- 쓰기 정책이 없다. `status` 도 `self_person_id` 도 사용자가 직접 못 옮긴다 —
-- 온보딩은 아래 RPC 가 한 트랜잭션으로 하고, 중지는 운영자가 한다.

create policy "내가 접근 근거를 가진 Person 만 보인다"
on public.person for select to authenticated
using (exists (
  select 1 from public.user_person_access a
  where a.person_id = person.id and a.user_id = (select auth.uid())
));

create policy "Person 이 보이면 그 판본도 보인다"
on public.person_chart_revision for select to authenticated
using (exists (
  select 1 from public.user_person_access a
  where a.person_id = person_chart_revision.person_id and a.user_id = (select auth.uid())
));

/**
 * 그 Person 을 자기 자신이라고 claim 한 User — 없으면 `null`.
 *
 * 정책 안에서 `app_user` 를 직접 읽으면 그 표의 정책(자기 행만)에 걸려 남의
 * claim 이 안 보인다. 안 보이면 「claim 되지 않았다」로 읽혀서 정확히 막으려던
 * 것이 통과한다. 그래서 이 질문만 `definer` 로 따로 세운다.
 */
create or replace function public.claimed_by(target_person uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public.app_user u where u.self_person_id = target_person;
$$;

grant execute on function public.claimed_by(uuid) to authenticated;

/**
 * 판본은 쌓기만 한다 — 고치지도 지우지도 않는다.
 *
 * claim 된 Person 의 출생정보는 그 User 만 쌓는다(ADR 0004). claim 되지 않은
 * Person 은 `editor` 이상이 쌓는다.
 */
create policy "claim 한 사람만, 아니면 편집 권한이 있는 사람만 판본을 쌓는다"
on public.person_chart_revision for insert to authenticated
with check (
  created_by = (select auth.uid())
  and coalesce(public.claimed_by(person_id), (select auth.uid())) = (select auth.uid())
  and exists (
    select 1 from public.user_person_access a
    where a.person_id = person_chart_revision.person_id
      and a.user_id = (select auth.uid())
      and a.role in ('owner', 'editor')
  )
);

create policy "내 목록만 보인다"
on public.user_person_access for select to authenticated
using (user_id = (select auth.uid()));

create policy "내 라벨만 고친다"
on public.user_person_access for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "자기 자신은 목록에서 지울 수 없다"
on public.user_person_access for delete to authenticated
using (
  user_id = (select auth.uid())
  and person_id is distinct from (
    select u.self_person_id from public.app_user u where u.id = (select auth.uid())
  )
);

/**
 * claim 이 편집권을 옮긴다 — 기존 관리자는 `viewer` 로 내려간다.
 *
 * 「이제부터 본인만 고칠 수 있다」를 앱이 기억하게 두지 않는다. claim 이 일어나는
 * 순간과 강등이 일어나는 순간이 같은 트랜잭션이어야, 그 사이에 낀 수정이 없다.
 */
create or replace function public.demote_others_on_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.self_person_id is not null
     and new.self_person_id is distinct from old.self_person_id
  then
    update public.user_person_access
    set role = 'viewer'
    where person_id = new.self_person_id
      and user_id <> new.id
      and role <> 'viewer';
  end if;
  return new;
end;
$$;

create trigger claim_moves_edit_right
after update of self_person_id on public.app_user
for each row execute function public.demote_others_on_claim();

-- ---------------------------------------------------------------------------
-- 온보딩 — Person·판본·엣지·claim 을 한 트랜잭션에 둔다
-- ---------------------------------------------------------------------------

/**
 * 네 개의 쓰기가 하나의 사건이다.
 *
 * 나눠서 부르면 중간에 끊긴 상태 — Person 은 있는데 판본이 없거나, 판본은 있는데
 * claim 이 안 된 — 가 실재하게 된다. 그런 상태를 화면이 다룰 줄 알아야 하는 것이
 * 아니라, 애초에 만들지 않는 것이 맞다.
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

  -- 온보딩을 마친 User 는 정확히 하나의 selfPerson 을 갖는다. 두 번째 요청은
  -- 조용히 덮어쓰는 것이 아니라 거절한다 — 첫 번째가 어디로 갔는지 모르게 된다.
  if account.self_person_id is not null then
    raise exception '이미 자신의 사주를 등록했습니다.' using errcode = '23505';
  end if;

  -- 음력은 변환표를 공식 자료와 대조하기 전에는 받지 않는다. 추정해서 넣으면
  -- 틀린 양력이 판본으로 굳고, 판본은 고치지 않는다.
  if p_calendar <> 'solar' then
    raise exception '음력 입력은 아직 지원하지 않습니다.' using errcode = '0A000';
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
