-- 지나친 인연은 영구 숨김과 다른 상태다
--
-- X 는 「앞으로 안 받겠다」가 아니라 **「지금은 지나칠게」**다. 그런데 지금 그 누름은
-- `discovery_hidden` 에 쓴다 — 「다시 보지 않기」의 표다. 그래서 설정의 「숨긴 인연」이
-- 지나친 사람까지 세고, 「모두 되돌리기」 한 번에 둘이 같이 풀린다. **라벨과 저장이
-- 어긋나 있다.**
--
-- 표를 가른다. 둘은 수명이 다르다:
--
-- - `discovery_hidden` — 직접 풀기 전까지 영원하다. **이 표는 한 줄도 안 옮긴다.**
--   과거 영구 숨김과 최근 X 가 섞여 있어 가를 근거가 없다
-- - `discovery_passed` — 최근 스물은 시간과 무관하게 보관하고, 그 밖으로 밀려나면
--   **마지막 넘김에서 24시간**까지만 제외한다
--
-- 스물과 24시간은 **다른 것을 재는 두 자**다. 스물은 사용자가 다시 꺼내 볼 수 있는
-- 목록의 길이이고, 24시간은 목록 밖으로 밀려난 사람이 다시 후보가 되기까지의 대기다.
-- 그래서 **행을 지우면서 스물을 맞추지 않는다** — 지우면 3분 전에 지나친 사람이 그
-- 자리에서 다시 후보가 된다. 목록은 읽을 때 스물로 자르고, 정리는 시간이 한다.
--
-- 스냅샷의 24시간과는 **다른 정책**이다. 우연히 값이 같을 뿐, 재는 것도 기준 시점도
-- 다르다 — 재추천할 때가 됐다고 새 스냅샷을 만들지 않고, 만든다고 반드시 세우지도 않는다.

create table public.discovery_passed (
  user_id uuid not null default auth.uid() references public.app_user (id) on delete cascade,
  passed_user_id uuid not null references public.app_user (id) on delete cascade,
  /** 같은 사람을 다시 넘기면 이 값이 올라간다 — 겹쳐 쌓지 않고 맨 위로 옮긴다 */
  passed_at timestamptz not null default now(),

  primary key (user_id, passed_user_id),
  constraint cannot_pass_self check (user_id <> passed_user_id)
);

/** 최근 순으로 읽고 스물로 자르는 질의가 타는 자리 */
create index discovery_passed_recent on public.discovery_passed (user_id, passed_at desc);

-- ---------------------------------------------------------------------------
-- 권한 — 열어 주는 것만 연다
-- ---------------------------------------------------------------------------

revoke all on public.discovery_passed from anon, authenticated;

/**
 * 넣고·옮기고·빼는 것까지 사용자가 한다.
 *
 * `update` 를 여는 것은 **같은 사람을 다시 넘길 때 맨 위로 옮기기 위해서**다
 * (`on conflict do update set passed_at = now()`). 그 값이 사건의 기록이 아니라
 * 「가장 최근에 지나친 때」라 사용자의 누름이 곧 그 시각이다.
 */
grant select, insert, update, delete on public.discovery_passed to authenticated;

alter table public.discovery_passed enable row level security;

create policy "내가 지나친 사람만 보인다"
on public.discovery_passed for select to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

create policy "내 목록에만 쌓는다"
on public.discovery_passed for insert to authenticated
with check (user_id = (select auth.uid()) and public.is_active_account());

create policy "내가 쌓은 것만 맨 위로 옮긴다"
on public.discovery_passed for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account())
with check (user_id = (select auth.uid()));

create policy "내가 쌓은 것만 꺼낸다"
on public.discovery_passed for delete to authenticated
using (user_id = (select auth.uid()) and public.is_active_account());

-- ---------------------------------------------------------------------------
-- 판정 — **한 자리에서만 한다**
-- ---------------------------------------------------------------------------

/**
 * 지금 이 사람이 「지나친 인연」으로 묶여 있는가.
 *
 * 두 조건 중 하나면 참이다:
 *
 * - **최근 스물 안에 있다** — 나보다 최근에 지나친 사람이 스물 미만이다. 시간과 무관하게
 *   보관하고 추천에서 뺀다. 사용자가 꺼내 볼 수 있는 자리이기 때문이다
 * - **마지막 넘김에서 24시간이 안 지났다** — 스물 밖으로 밀려났어도 그동안은 안 세운다.
 *   이 조건이 없으면 스물한 번째를 넘기는 순간 가장 오래된 사람이 바로 다음 카드로 설 수 있다
 *
 * 둘 다 아니면 **기록이 남아 있어도 후보로 돌아온다.** 그 행은 그때 지워도 되는 값이다.
 *
 * `stable` 이다 — `now()` 는 트랜잭션 안에서 안 움직이고, 한 질의 안에서 사람마다
 * 다른 시각으로 판정되면 그게 더 이상하다.
 */
create or replace function public.discovery_passed_active(viewer uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.discovery_passed p
    where p.user_id = viewer
      and p.passed_user_id = other
      and (
        p.passed_at > now() - interval '24 hours'
        or (
          select count(*)
          from public.discovery_passed q
          where q.user_id = viewer and q.passed_at > p.passed_at
        ) < 20
      )
  );
$$;

revoke execute on function public.discovery_passed_active(uuid, uuid) from anon, public, authenticated;

/**
 * 추천될 수 있는 사람인가 — **지나친 인연을 여기서 뺀다.**
 *
 * 뽑는 자리(`refresh_discovery_snapshot_for`)와 읽는 자리(`my_discovery_board`)와
 * 요청(`request_match`)이 모두 이 함수를 부른다. 제외를 세 곳에 나눠 적으면 언젠가
 * 한 곳만 고쳐지고, **갈리면 열려 있는 쪽이 사용자 쪽**이다.
 *
 * 따라오는 것 하나 — **보관 중인 사람에게는 요청도 안 나간다.** 덱에 없는 사람에게
 * 요청이 나가는 길을 두지 않는다. 「다시 만나보기」로 꺼내면 그 자리에서 다시 열린다.
 *
 * 나머지 조건은 한 글자도 안 바뀐다.
 */
create or replace function public.discovery_eligible(viewer uuid, other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer is not null
     and other is not null
     and viewer <> other
     and not public.discovery_unavailable(viewer, other)
     and not public.discovery_passed_active(viewer, other)
     and exists (
       select 1
       from public.discovery_profile mine
       join public.app_user mu on mu.id = mine.user_id
       join public.person mp on mp.id = mu.self_person_id
       join public.person_chart_revision mr on mr.id = mine.element_revision_id
       join public.discovery_profile theirs on theirs.user_id = other
       join public.app_user tu on tu.id = theirs.user_id
       join public.person tp on tp.id = tu.self_person_id
       join public.person_chart_revision tr on tr.id = theirs.element_revision_id
       where mine.user_id = viewer
         -- 둘 다 참여 중이어야 한다. 내놓지 않고 보기만 하는 길은 없다.
         and mine.opted_in_at is not null
         and theirs.opted_in_at is not null
         -- 둘 다 살아 있는 계정이어야 한다.
         and mu.status = 'active'
         and tu.status = 'active'
         -- 둘 다 요약이 지금 판본의 것이어야 한다. 낡은 값으로 줄 세우지 않는다.
         and mine.element_revision_id = mp.current_revision_id
         and theirs.element_revision_id = tp.current_revision_id
         -- 양쪽이 직접 설정한 조건을 **둘 다** 본다. 내 조건 밖의 사람을 안 보는 것과
         -- 나를 조건 밖으로 둔 사람에게 안 보이는 것은 같은 규칙의 두 얼굴이다.
         and (mine.prefer_gender = 'any' or tr.gender = mine.prefer_gender)
         and (theirs.prefer_gender = 'any' or mr.gender = theirs.prefer_gender)
     );
$$;

revoke execute on function public.discovery_eligible(uuid, uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 보관함을 읽는다 — **최근 스물**
-- ---------------------------------------------------------------------------

/**
 * 내가 지나친 사람들 — 최근 순으로 스물까지.
 *
 * 카드에 서는 것과 **같은 칸만** 낸다(`my_discovery_board` 와 한 벌이다). 두 축의 원값도
 * 상대의 전체 오행표도 없다.
 *
 * **점수는 지금 값으로 다시 센다.** 지나칠 때의 값을 붙들고 있지 않다 — 스냅샷이 아니라
 * 사람을 보는 자리이고, 그 사이 상대의 요약이 바뀌었으면 바뀐 것이 맞다.
 *
 * 자격을 잃은 사람은 빠진다(참여를 껐거나, 차단했거나, 요약이 낡았거나). 다시 만나볼 수
 * 없는 사람을 목록에 세워 두면 눌렀을 때 거절만 받는다.
 */
create or replace function public.my_passed_connections()
returns table (
  candidate_user_id uuid,
  nickname text,
  intro text,
  has_photo boolean,
  passed_at timestamptz,
  supplied_elements text[],
  balance_band text,
  preview_score integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary into my_summary
  from public.discovery_profile p where p.user_id = actor;

  if my_summary is null then
    return;
  end if;

  return query
  select
    p.passed_user_id,
    who.nickname,
    who.intro,
    exists (select 1 from public.profile_photo f where f.user_id = p.passed_user_id),
    p.passed_at,
    public.discovery_supplied_elements_v1(my_summary, theirs.element_summary),
    public.discovery_balance_band(
      public.discovery_count_balance_v1(my_summary, theirs.element_summary)
    ),
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, theirs.element_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, theirs.element_summary) * 0.7
    )))::integer
  from public.discovery_passed p
  join public.app_user who on who.id = p.passed_user_id
  join public.discovery_profile theirs on theirs.user_id = p.passed_user_id
  where p.user_id = actor
    and who.status = 'active'
    and theirs.opted_in_at is not null
    and not public.discovery_unavailable(actor, p.passed_user_id)
  order by p.passed_at desc
  limit 20;
end;
$$;

revoke execute on function public.my_passed_connections() from anon, public;
grant execute on function public.my_passed_connections() to authenticated;
