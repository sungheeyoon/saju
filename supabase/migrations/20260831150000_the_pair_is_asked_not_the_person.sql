-- ---------------------------------------------------------------------------
-- 무슨 사이인가는 **사람의 속성이 아니라 그 쌍의 것**이다
-- ---------------------------------------------------------------------------

/**
 * 앞 파일이 관계를 `user_person_access` 에 붙였다. 그것이 「나와 그 사람」이므로 사람
 * 목록에서 묻게 됐고, 두 가지가 어긋났다.
 *
 * **하나 — 묻는 자리가 틀렸다.** 사람 탭은 그 사람의 사주를 보는 자리다. 내 사주를
 * 보는 화면에 「나와 나는 무슨 사이인가」가 없는 것처럼, 거기서 관계를 물을 이유가 없다.
 * 관계가 글을 바꾸는 것은 **궁합을 볼 때**이고, 그러면 물을 자리도 거기다.
 *
 * **둘 — 값이 답할 수 있는 물음이 좁았다.** 「나와 그 사람」만 알면 어머니와 친구의
 * 궁합에서는 답이 없다. 어머니가 나의 가족인 것과 어머니가 그 친구와 무슨 사이인지는
 * 다른 물음이라, 앞 파일의 값으로는 그 쌍을 영영 모른다.
 *
 * 쌍에 붙이면 둘 다 풀린다. 궁합 화면이 지금 보고 있는 두 사람에 대해 묻고, 그 답이
 * 그 쌍에 남는다.
 */

create table public.pair_relation (
  user_id uuid not null references public.app_user (id) on delete cascade,

  /**
   * **차례를 값이 정한다.** `reading` 의 `private` 이 `person_a < person_b` 를 요구하는
   * 것과 같은 이유다 — 안 정하면 (엄마,아빠)와 (아빠,엄마)가 다른 줄이 되고, 그때
   * 한 쌍에 답이 둘 남는다.
   */
  person_low uuid not null references public.person (id) on delete cascade,
  person_high uuid not null references public.person (id) on delete cascade,

  relation text not null check (relation in ('family', 'friend', 'partner', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, person_low, person_high),
  constraint pair_is_ordered check (person_low < person_high)
);

/**
 * **모른다는 행이 없는 것이다.**
 *
 * `null` 을 담는 행을 두지 않는다. 안 고른 것과 「모른다를 골랐다」가 다른 값이 되면
 * 화면도 프롬프트도 두 가지를 물어야 하고, 그러다 한쪽을 잊는다. 되돌리는 길은
 * 지우는 것 하나다.
 */

alter table public.pair_relation enable row level security;
revoke all on public.pair_relation from anon, authenticated;
grant select, insert, update, delete on public.pair_relation to authenticated;

/**
 * 내 것만 보고 내 것만 쓴다. **두 Person 이 정말 내가 볼 수 있는 사람인지도 묻는다** —
 * 안 물으면 아무 uuid 쌍에나 줄을 남길 수 있고, 그 줄은 남의 Person id 를 내 표에
 * 적어 두는 일이 된다.
 */
create policy "내 쌍만 읽는다" on public.pair_relation
  for select using (user_id = (select auth.uid()));

create policy "내가 볼 수 있는 두 사람에만 적는다" on public.pair_relation
  for insert with check (
    user_id = (select auth.uid())
    and public.is_active_account()
    and exists (
      select 1 from public.user_person_access a
      where a.user_id = (select auth.uid()) and a.person_id = person_low)
    and exists (
      select 1 from public.user_person_access a
      where a.user_id = (select auth.uid()) and a.person_id = person_high)
  );

create policy "내 쌍만 고친다" on public.pair_relation
  for update using (user_id = (select auth.uid()) and public.is_active_account())
  with check (user_id = (select auth.uid()));

create policy "내 쌍만 지운다" on public.pair_relation
  for delete using (user_id = (select auth.uid()) and public.is_active_account());

-- ---------------------------------------------------------------------------
-- 사람에 붙였던 값을 거둔다
-- ---------------------------------------------------------------------------

/**
 * **옮기지 않고 지운다.**
 *
 * 「나와 그 사람」을 「나와 그 사람의 쌍」으로 옮길 수는 있다. 실제로 내 selfPerson 이
 * 낀 쌍에서는 같은 답이다. 그런데 그렇게 옮기면 **사용자가 그 쌍에 대해 답한 적 없는
 * 값**이 그 쌍의 답으로 앉는다.
 *
 * 이 값은 하루도 안 됐고 프로덕션에서 고른 사람이 없다. 옮겨서 얻을 것보다 「누가
 * 언제 무엇에 답했는가」가 흐려지는 값이 크다.
 */
alter table public.user_person_access drop column relation;

drop function if exists public.create_managed_person(
  text, text, text, date, date, time, text, text, text, text, text);

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

  insert into public.user_person_access (user_id, person_id, local_label, note, role)
  values (actor, new_person, p_local_label, nullif(btrim(p_note), ''), 'owner');

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

-- ---------------------------------------------------------------------------
-- 쌍의 관계를 적는 문 하나
-- ---------------------------------------------------------------------------

/**
 * 두 사람의 차례를 **부르는 쪽이 기억하지 않는다.**
 *
 * `least`·`greatest` 를 화면에서 지으면 그 규칙이 두 자리에 있게 되고, 둘이 갈리는
 * 날 같은 쌍이 두 줄로 남는다. 지우는 것도 같은 문으로 한다 — 「모른다」는 행이
 * 없는 것이라, 되돌리는 길이 따로 있으면 두 가지 없음이 생긴다.
 */
create or replace function public.set_pair_relation(
  p_person_a uuid,
  p_person_b uuid,
  p_relation text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  low uuid := least(p_person_a, p_person_b);
  high uuid := greatest(p_person_a, p_person_b);
begin
  if low = high then
    raise exception '같은 사람 둘로는 사이를 적을 수 없습니다.' using errcode = '22023';
  end if;

  if p_relation is null then
    delete from public.pair_relation r
    where r.user_id = (select auth.uid()) and r.person_low = low and r.person_high = high;
    return;
  end if;

  insert into public.pair_relation (user_id, person_low, person_high, relation)
  values ((select auth.uid()), low, high, p_relation)
  on conflict (user_id, person_low, person_high)
  do update set relation = excluded.relation, updated_at = now();
end;
$$;

revoke execute on function public.set_pair_relation(uuid, uuid, text) from anon, public;
grant execute on function public.set_pair_relation(uuid, uuid, text) to authenticated;

/**
 * 이 쌍에 적어 둔 사이 — **없으면 0행**이다.
 *
 * `security invoker` 라 정책이 그대로 묻는다. 남의 줄은 애초에 안 보인다.
 */
create or replace function public.pair_relation_of(p_person_a uuid, p_person_b uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select r.relation
  from public.pair_relation r
  where r.user_id = (select auth.uid())
    and r.person_low = least(p_person_a, p_person_b)
    and r.person_high = greatest(p_person_a, p_person_b);
$$;

revoke execute on function public.pair_relation_of(uuid, uuid) from anon, public;
grant execute on function public.pair_relation_of(uuid, uuid) to authenticated;
