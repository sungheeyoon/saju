-- 접속 상태 — **활동은 표 하나에 적히고, 구간은 DB 가 내며, 시각은 나가지 않는다** (ADR 0092)
--
-- PRD §7.2 의 결정을 DB 층에 세운다(#121 의 PR A). 앱은 아직 이 문을 안 부른다 — 넓히는
-- 마이그레이션이 먼저 들고 `db push` 를 지난 뒤 앱 PR 이 든다(ADR 0090 의 예외).
--
--   - 활동은 **로그인된 요청이 서버에 온 것**이다. 적는 손은 `touch_activity()` 하나이고 앱의
--     `proxy.ts` 가 요청마다 부른다 — 다만 **1분 안에 두 번 적지 않는다**(쓰기 억제).
--   - 상대에게 나가는 것은 **구간 셋**뿐이다 — `now`(5분 안) · `day`(24시간 안) · `earlier`.
--     시각은 어느 반환 칸에도 안 싣는다. 구간을 계산하는 함수는 `authenticated` 가 못 부른다 —
--     읽는 문 둘(`my_chat_rooms` · `my_discovery_board`) 안에서만 돈다.
--   - `app_user` 에 칸을 더하지 않는다. 전송 한도가 그 행을 `for update` 로 잠그고(ADR 0091),
--     자기 행을 읽는 정책이 그 칸을 브라우저로 내준다.
--   - 수의 원본은 DB 다 — `presence_policy()` 가 한 벌로 내주고 `src/lib/presence` 가 사본을
--     든다(ADR 0091 의 규율). 흐름 검사가 둘을 견준다.
--
-- 재는 자리는 `supabase/tests/35_presence.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 정책의 수 — 「지금」 창 · 쓰기 억제 창 · 하루
-- ---------------------------------------------------------------------------

/** 마지막 활동이 이 안이면 「지금 활동 중」 — 2026-09-23 에 사람이 정했다(#121) */
create function public.presence_now_window()
returns interval
language sql
immutable
as $$ select interval '5 minutes' $$;

/** 이 안에서는 다시 안 적는다 — 요청마다 한 줄 쓰지 않는다. 「지금」 창보다 짧아야 한다 */
create function public.presence_write_window()
returns interval
language sql
immutable
as $$ select interval '1 minute' $$;

/** 이 안이면 「최근 24시간 내 활동」, 그 밖은 「24시간 이전 활동」(PRD §7.2) */
create function public.presence_day_window()
returns interval
language sql
immutable
as $$ select interval '24 hours' $$;

/**
 * 앱이 같은 수를 들고 있는지 물어볼 수 있게 한 벌로 내준다 — `chat_policy()` 와 같은 모양.
 * 원본은 위의 셋이고 이 문은 옮겨 적을 뿐이다.
 */
create function public.presence_policy()
returns table (
  now_window_seconds integer,
  write_window_seconds integer,
  day_window_seconds integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    extract(epoch from public.presence_now_window())::integer,
    extract(epoch from public.presence_write_window())::integer,
    extract(epoch from public.presence_day_window())::integer;
$$;

revoke execute on function public.presence_now_window() from anon, public, authenticated;
revoke execute on function public.presence_write_window() from anon, public, authenticated;
revoke execute on function public.presence_day_window() from anon, public, authenticated;
revoke execute on function public.presence_policy() from anon, public;
grant execute on function public.presence_policy() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 표 — 계정당 한 줄, 마지막 활동 시각
-- ---------------------------------------------------------------------------

/**
 * 어느 역할에도 안 열린다. 적는 손은 `touch_activity()`, 읽는 손은 `activity_band_of()` 뿐이고
 * 둘 다 `definer` 다. 계정을 따라 사라진다.
 */
create table public.user_activity (
  user_id uuid primary key references public.app_user (id) on delete cascade,
  last_active_at timestamptz not null default now()
);

revoke all on public.user_activity from anon, authenticated;
alter table public.user_activity enable row level security;

-- ---------------------------------------------------------------------------
-- 3. 적는 문 — 로그인된 요청마다, 다만 1분에 한 번
-- ---------------------------------------------------------------------------

/**
 * `true` 면 적었고 `false` 면 억제 창 안이거나 정지 · 탈퇴 대기 계정이라 안 적었다.
 * 정지 · 탈퇴 대기는 던지지 않는다 — 부속 정보라 화면이 이 답으로 하는 일이 없고(ADR 0078),
 * `proxy.ts` 는 실패를 삼킨다. 로그인 안 함만 다른 문과 같은 문장으로 던진다.
 */
create function public.touch_activity()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  written integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    return false;
  end if;

  insert into public.user_activity (user_id, last_active_at)
  values (actor, now())
  on conflict (user_id) do update
    set last_active_at = excluded.last_active_at
    where public.user_activity.last_active_at < excluded.last_active_at - public.presence_write_window();

  get diagnostics written = row_count;
  return written > 0;
end;
$$;

revoke execute on function public.touch_activity() from anon, public;
grant execute on function public.touch_activity() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 구간 — 시각을 구간 하나로 접는다. 브라우저로 나가는 것은 이것뿐이다
-- ---------------------------------------------------------------------------

/**
 * `now` · `day` · `earlier`. 기록이 없으면 `earlier` — 이 마이그레이션 전의 계정이 그렇다.
 * 경계는 왼쪽 닫힘이다: 5분 **미만**이 `now`, 24시간 **미만**이 `day`.
 *
 * `authenticated` 에 안 연다 — 아무 계정의 구간이나 물어볼 수 있으면 그것이 새는 자리다.
 * 읽는 문 둘이 **자기가 이미 내주는 사람**(대화방 상대 · 후보)에 대해서만 부른다.
 */
create function public.activity_band_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when a.last_active_at is null then 'earlier'
    when a.last_active_at > now() - public.presence_now_window() then 'now'
    when a.last_active_at > now() - public.presence_day_window() then 'day'
    else 'earlier'
  end
  from (select 1) one
  left join public.user_activity a on a.user_id = p_user_id;
$$;

revoke execute on function public.activity_band_of(uuid) from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 5. 읽는 문 둘에 칸 하나씩 — 반환형이 바뀌므로 지우고 다시 세운다
-- ---------------------------------------------------------------------------
--
-- `create or replace` 는 반환형을 못 바꾼다. `drop` 하면 ACL 이 기본값으로 되살아나므로
-- (pgTAP 33-1 의 머리말) revoke · grant 를 다시 적는다. 본문은 `20260927090000`(방 목록) 과
-- `20260925180000` 930줄(후보 목록)의 살아 있는 정의에서 떴고, 더한 것은 마지막 칸 하나뿐이다.

drop function public.my_chat_rooms();

/**
 * 내 대화방 목록 — 마지막 칸 `partner_activity` 가 늘었다. **열린 방에만** 선다 — 닫힌 방은
 * `null` 이다. 대화할 수 없는 상대의 활동은 쓸 데가 없고 새는 정보만 하나 는다(#121 기본값).
 * 나머지는 ADR 0091 그대로다 — 상대의 출생 원문 · 이메일 · 계정 상태 · 누가 닫았는지는 없다.
 */
create function public.my_chat_rooms()
returns table (
  match_id uuid,
  partner_user_id uuid,
  partner_nickname text,
  partner_has_photo boolean,
  opened_at timestamptz,
  closed_reason text,
  closed_at timestamptz,
  last_message_at timestamptz,
  last_message_body text,
  unread_count integer,
  partner_activity text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.match_id,
    partner.id,
    partner.nickname,
    exists (select 1 from public.profile_photo f where f.user_id = partner.id),
    r.opened_at,
    r.closed_reason,
    r.closed_at,
    last.created_at,
    last.body,
    coalesce(unread.n, 0),
    case when r.closed_reason is null then public.activity_band_of(partner.id) end
  from public.chat_room r
  join public.app_user partner
    on partner.id = case
      when r.user_low = (select auth.uid()) then r.user_high else r.user_low end
  left join lateral (
    select m.created_at, m.body from public.chat_message m
    where m.room_id = r.id order by m.seq desc limit 1
  ) last on true
  left join lateral (
    select count(*)::integer as n
    from public.chat_message m
    join public.chat_read k on k.room_id = m.room_id and k.user_id = (select auth.uid())
    where m.room_id = r.id
      and m.sender_user_id <> (select auth.uid())
      and m.seq > k.last_read_seq
  ) unread on true
  where public.chat_room_readable(r.id)
  order by coalesce(last.created_at, r.opened_at) desc;
$$;

revoke execute on function public.my_chat_rooms() from anon, public;
grant execute on function public.my_chat_rooms() to authenticated;

drop function public.my_discovery_board();

/**
 * 내 후보 목록 — 마지막 칸 `activity` 가 늘었다. 거르는 데는 쓰지 않는다(PRD §7.2) — 정렬도
 * 자격도 그대로이고, 카드에 한 줄이 설 뿐이다. 나머지는 `20260925180000` 그대로다.
 */
create function public.my_discovery_board()
returns table(
  candidate_user_id uuid, nickname text, intro text, has_photo boolean, seat integer,
  exploration boolean, supplied_elements text[], balance_band text, preview_score integer,
  activity text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  my_summary jsonb;
  opted timestamptz;
  snap uuid;
  made_at timestamptz;
  snap_summary jsonb;
  snap_policy text;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select p.element_summary, p.opted_in_at
    into my_summary, opted
  from public.discovery_profile p where p.user_id = actor;

  if opted is null then
    raise exception '매칭 참여를 먼저 켜 주세요.' using errcode = '42501';
  end if;

  if not public.my_summary_is_current(actor) then
    raise exception '내 오행 요약이 지금 입력의 것이 아닙니다.' using errcode = '55000';
  end if;

  select s.id, s.generated_at, s.viewer_summary, s.policy_version
    into snap, made_at, snap_summary, snap_policy
  from public.discovery_snapshot s
  where s.user_id = actor
  order by s.seq desc
  limit 1;

  if snap is null
     or made_at < now() - interval '24 hours'
     or snap_summary is distinct from my_summary
     or snap_policy is distinct from 'discovery-v1' then
    snap := public.refresh_discovery_snapshot_for(actor, gen_random_uuid()::text);
  end if;

  return query
  select
    slot.candidate_user_id,
    who.nickname,
    who.intro,
    exists (select 1 from public.profile_photo f where f.user_id = slot.candidate_user_id),
    slot.position,
    slot.exploration,
    slot.supplied_elements,
    slot.balance_band,
    least(100, greatest(0, round(
      public.discovery_deficit_complement_v1(my_summary, slot.candidate_summary) * 0.3
      + public.discovery_count_balance_v1(my_summary, slot.candidate_summary) * 0.7
    )))::integer,
    public.activity_band_of(slot.candidate_user_id)
  from public.discovery_snapshot_slot slot
  join public.app_user who on who.id = slot.candidate_user_id
  join public.discovery_profile theirs on theirs.user_id = slot.candidate_user_id
  where slot.snapshot_id = snap
    and public.discovery_eligible(actor, slot.candidate_user_id)
    and theirs.element_summary = slot.candidate_summary
  order by slot.position;
end;
$$;

revoke execute on function public.my_discovery_board() from anon, public;
grant execute on function public.my_discovery_board() to authenticated;
