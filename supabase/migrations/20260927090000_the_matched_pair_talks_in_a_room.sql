-- 매칭된 한 쌍이 앱 안의 대화방에서 말한다 (ADR 0091 · G-10 · #115)
--
-- 채팅 안전 베타의 DB 층이다. **앱은 아직 이 문들을 안 부른다** — 옛 앱에 안전한 넓히기라
-- 먼저 들고 `db push` 를 지난 뒤 앱 PR 이 든다(`docs/agents/delegation.md` 「예외」). 기존
-- 함수는 한 벌도 다시 적지 않는다. 방이 서고 닫히는 자리는 전부 **트리거**라, Match 를
-- 만드는 `respond_to_match_request` · 차단하는 `block_user` · 떠나는 `request_account_deletion`
-- · 운영자의 `update app_user set status` 가 그대로인 채로 방이 따라 움직인다.
--
-- ## 재어 본 것
--
-- - `match` 는 `user_low < user_high` 로 차례가 고정된 한 쌍이고(`20260825120000`), 판본 칸은
--   걷혔다(`20260925180000`). 방은 그 행에 1:1 로 매인다.
-- - `block` 은 `(user_id, blocked_user_id)` 가 기본키이고 `created_at` 을 든다. 푸는 문이 없다.
-- - `app_user.status` 는 `active · suspended · deletion_requested` 셋이고, **`suspended` 에는
--   시각 칸이 없다.** `deletion_requested_at` 은 상태와 검사식으로 묶여 있다(`20260826120000`).
--   그래서 방이 닫힌 시각의 출처가 이유마다 다르다 — 아래 「닫힘」.
-- - `visible_matches()` 는 차단된 쌍과 살아 있지 않은 상대를 **빼고** 낸다(`20260825150000`).
--   차단 뒤에도 방은 둘의 목록에 남아야 하므로(G-10) 이 파일의 읽는 문은 그것을 안 탄다.
-- - `is_active_account()` 는 종료일까지 본다(`20260906090000`). 열람 술어가 그것을 물으므로
--   베타가 끝나면 방도 함께 닫힌다.
-- - 거절을 문장으로 내는 `raise` 는 84종이고 전부 한국어다(`app/db-error.ts`). 여기서 새로
--   필요한 거절 중 **사람이 읽을 문장이 아직 정해지지 않은 것**은 한국어를 지어 넣지 않았다 —
--   값으로 돌려주거나(`sent · rate_limited · closed`), 영어 토막과 errcode 로 던진다. 앱이
--   가르는 것은 errcode 와 반환값이고, 문장은 정해지면 `create or replace` 로 넣는다.
--
-- ## 모양
--
--   chat_room            Match 에 1:1. 닫힘은 이유 · 닫은 사람 · 닫힌 시각 세 칸이 함께 선다
--   chat_message         방 · 보낸 사람 · 본문 · 시각 · 차례(seq)
--   chat_read            참여자마다 어디까지 읽었나 — 안 읽은 수의 근거
--   chat_rate_limit_hit  한도에 걸린 전송 한 건 한 줄 — 거절이 값으로 돌아오므로 남는다
--   chat_report_snapshot 신고 곁의 불변 사본 — 메시지에 FK 로 매지 않는다

-- ---------------------------------------------------------------------------
-- 1. 정책의 수 — **원본은 여기다**
-- ---------------------------------------------------------------------------

/**
 * 계정당 한 창(분) 안에 보낼 수 있는 건수. 도배를 막는 수이지 재어서 정한 값이 아니다
 * (G-10, 2026-09-23 에 정했다). `reading_rate_limit()` 과 같은 자리 · 같은 사정이다.
 */
create function public.chat_rate_limit()
returns integer
language sql
immutable
as $$ select 30 $$;

create function public.chat_rate_window()
returns interval
language sql
immutable
as $$ select interval '1 minute' $$;

/** 한 건의 글자 수 — 신고의 덧붙이는 말과 같은 수다(`report.detail`) */
create function public.chat_message_max_length()
returns integer
language sql
immutable
as $$ select 1000 $$;

/** 신고 스냅샷이 고른 메시지 앞뒤로 베끼는 건수 — 앞 5 · 뒤 5(#115 기본값) */
create function public.chat_snapshot_context()
returns integer
language sql
immutable
as $$ select 5 $$;

/** 닫힌 방의 메시지를 지우기까지의 기간. 지우는 손은 runbook 의 SQL 이다 — 크론이 아니다 */
create function public.chat_retention()
returns interval
language sql
immutable
as $$ select interval '90 days' $$;

/**
 * 앱이 같은 수를 들고 있는지 **물어볼 수 있게** 한 벌로 내준다.
 *
 * `src/lib/chat` 이 같은 값을 순수 함수로 들게 되는데(앱 PR), 둘이 갈리면 화면이 거짓말한다.
 * 원본은 위의 다섯이고 이 문은 그것을 옮겨 적을 뿐이다 — 흐름 검사가 이 문을 불러 lib 의
 * 값과 견준다. `definer` 인 것은 위의 다섯이 어느 역할에도 닫혀 있어서다(`tests.person_limit()`
 * 이 같은 까닭으로 한 겹 감싼다).
 */
create function public.chat_policy()
returns table (
  rate_limit integer,
  rate_window_seconds integer,
  max_length integer,
  snapshot_context integer,
  retention_days integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.chat_rate_limit(),
    extract(epoch from public.chat_rate_window())::integer,
    public.chat_message_max_length(),
    public.chat_snapshot_context(),
    extract(epoch from public.chat_retention())::integer / 86400;
$$;

revoke execute on function public.chat_rate_limit() from anon, public, authenticated;
revoke execute on function public.chat_rate_window() from anon, public, authenticated;
revoke execute on function public.chat_message_max_length() from anon, public, authenticated;
revoke execute on function public.chat_snapshot_context() from anon, public, authenticated;
revoke execute on function public.chat_retention() from anon, public, authenticated;
revoke execute on function public.chat_policy() from anon, public;
grant execute on function public.chat_policy() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 표
-- ---------------------------------------------------------------------------

/**
 * 대화방 — **Match 에 1:1** 이다.
 *
 * 두 사람 칸을 `match` 에서 베껴 든다. 열람 술어가 「내가 참여자인가」를 물을 때마다
 * `match` 를 조인하면, 그 표는 정책이 없어 `authenticated` 에게 닫혀 있으므로 술어가
 * `definer` 여야만 한다 — 어차피 그래야 하지만, 방 하나가 제 참여자를 스스로 말하는 편이
 * 읽기도 잠그기도 쉽다. `match` 와 어긋날 길은 없다 — 방은 트리거만 만든다.
 *
 * **닫힘은 상태다.** 세 칸이 함께 서거나 함께 빈다. 「닫힌 날부터 90일」을 세야 하므로
 * 시각을 저장하고, 그 출처는 이유마다 다르다.
 *
 *   block            `block.created_at` — 차단 트리거가 그 값을 그대로 옮긴다
 *   deletion_request `app_user.deletion_requested_at` — 상태 트리거가 그 값을 옮긴다
 *   suspension       **이 칸이 유일한 출처다.** 중지에는 시각 칸이 없어서(재어 봤다) 상태
 *                    트리거의 `now()` 가 「언제 중지됐나」를 처음으로 적는 자리가 된다
 *
 * `closed_by_user_id` 는 열람 규칙이 쓴다 — 중지 · 삭제 요청은 **그 사람이 아닌 쪽만** 본다.
 * 차단은 둘 다 보므로 그 값을 읽는 문이 밖으로 내지 않는다(차단당한 사실은 알리지 않는다,
 * 차단은 소식이 아니다, ADR 0009). 닫힘은 되돌리지 않는다 — 운영자가 중지를 풀어도 방은 닫힌 채다(ADR 0091).
 */
create table public.chat_room (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.match (id) on delete cascade,

  user_low uuid not null references public.app_user (id) on delete cascade,
  user_high uuid not null references public.app_user (id) on delete cascade,

  opened_at timestamptz not null default now(),

  closed_reason text check (closed_reason in ('block', 'suspension', 'deletion_request')),
  closed_by_user_id uuid references public.app_user (id) on delete cascade,
  closed_at timestamptz,

  constraint chat_pair_is_ordered check (user_low < user_high),
  constraint chat_closing_stands_together check (
    (closed_reason is null) = (closed_at is null)
    and (closed_reason is null) = (closed_by_user_id is null)),
  constraint chat_closer_is_a_participant check (
    closed_by_user_id is null or closed_by_user_id in (user_low, user_high))
);

comment on table public.chat_room is
  '매칭된 한 쌍의 대화방 — Match 에 1:1 이고 닫힘은 이유·닫은 사람·시각 세 칸의 상태다(ADR 0091)';

create index chat_room_by_user_low on public.chat_room (user_low);
create index chat_room_by_user_high on public.chat_room (user_high);
create index chat_room_closed on public.chat_room (closed_at) where closed_at is not null;

/**
 * 메시지.
 *
 * **`seq` 가 차례다.** `created_at` 은 같은 밀리초에 둘이 설 수 있고, 신고 스냅샷의
 * 「앞 5 · 뒤 5」는 차례가 흔들리면 다른 다섯을 베낀다. 전역 identity 라 방 안에서는
 * 당연히 단조롭다.
 *
 * 개별 메시지의 삭제 · 수정은 없다(2026-09-23 의 결정) — 그래서 `updated_at` 도 없고 고치는 문도 없다.
 * 지워지는 길은 방이 지워질 때(cascade)와 보존 기간이 지나 운영자가 지울 때뿐이다.
 */
create table public.chat_message (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_room (id) on delete cascade,
  sender_user_id uuid not null references public.app_user (id) on delete cascade,
  seq bigint generated always as identity,
  body text not null,
  created_at timestamptz not null default now(),

  constraint chat_body_has_a_length check (
    btrim(body) <> '' and length(body) <= public.chat_message_max_length())
);

create unique index chat_message_by_room_seq on public.chat_message (room_id, seq);
create index chat_message_by_sender_time on public.chat_message (sender_user_id, created_at desc);

/**
 * 어디까지 읽었나 — 참여자마다 한 줄. 방이 서는 트리거가 두 줄을 함께 세운다.
 *
 * 읽음은 사건이라 사용자가 값을 적지 않는다(`notification.read_at` 과 같은 결) —
 * `mark_chat_read` 가 그 순간의 마지막 차례를 적는다.
 */
create table public.chat_read (
  room_id uuid not null references public.chat_room (id) on delete cascade,
  user_id uuid not null references public.app_user (id) on delete cascade,
  last_read_seq bigint not null default 0,
  read_at timestamptz,

  primary key (room_id, user_id)
);

/**
 * 한도에 걸린 전송 — **한 건 한 줄.**
 *
 * 거절을 `raise` 로 내면 그 트랜잭션이 통째로 되돌아가 여기 적은 줄도 사라진다(ADR 0039 가
 * 운영자 알림에서 같은 벽을 만났다). 그래서 `send_chat_message` 는 한도 거절만은 값으로
 * 돌려주고(`rate_limited`), 그 자리에서 이 줄을 남긴다. runbook 의 「한도에 걸린 건수」가
 * 세는 표다.
 */
create table public.chat_rate_limit_hit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_user (id) on delete cascade,
  room_id uuid references public.chat_room (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index chat_rate_limit_hit_by_time on public.chat_rate_limit_hit (created_at desc);

/**
 * 신고 곁의 **불변 사본.**
 *
 * 신고 행(`report`)에 1:1 로 붙는다. 고른 메시지와 앞뒤 문맥을 **그때의 본문 그대로**
 * jsonb 한 칸에 베낀다 — 별표로 두면 메시지 표의 모양이 바뀔 때마다 두 표가 함께 움직여야
 * 하고, 사본은 움직이지 않아야 하는 것이다.
 *
 * **방과 메시지에 FK 로 매지 않는다.** 스냅샷은 메시지가 지워져도 남아야 한다(2026-09-23 의 결정).
 * `match_id` · `message_id` 는 되짚는 실마리일 뿐이고, 가리키는 행이 사라져도 이 줄은 선다.
 * 신고에는 cascade 로 매인다 — 신고가 사라지면(계정이 지워지면) 근거도 함께 간다.
 *
 * 앱 역할에는 아무 권한도 없다. 읽는 손은 runbook 의 SQL 이다(화면은 공개 출시, G-24).
 */
create table public.chat_report_snapshot (
  report_id uuid primary key references public.report (id) on delete cascade,
  match_id uuid not null,
  message_id uuid not null,
  context_before integer not null,
  context_after integer not null,
  messages jsonb not null,
  captured_at timestamptz not null default now(),

  constraint chat_snapshot_is_a_list check (jsonb_typeof(messages) = 'array')
);

/** 불변 — 어느 역할로도 고치지 못한다. 지우는 길은 신고를 따라가는 cascade 뿐이다 */
create function public.refuse_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'chat: the report snapshot is immutable' using errcode = '55000';
end;
$$;

revoke execute on function public.refuse_snapshot_update() from anon, public, authenticated;

create trigger chat_report_snapshot_is_immutable
before update on public.chat_report_snapshot
for each row execute function public.refuse_snapshot_update();

-- ---------------------------------------------------------------------------
-- 3. 열람 규칙 — 정책과 읽는 문이 **같은 함수**에 묻는다
-- ---------------------------------------------------------------------------

/**
 * 내가 이 방을 볼 수 있는가.
 *
 *   열린 방          참여자 둘 다
 *   차단으로 닫힘    둘 다 — 「둘 다 본다」(G-10)
 *   중지로 닫힘      중지되지 않은 쪽만
 *   삭제 요청으로 닫힘 요청하지 않은 쪽만
 *
 * 그리고 언제나 `is_active_account()` 다 — 중지된 계정과 삭제를 요청한 계정은 자기 상태 말고
 * 아무것도 못 읽는다(ADR 0006, pgTAP 08). 그래서 `closed_by_user_id <> 나` 는 오늘은 그 두 줄과
 * 겹치지만, 운영자가 중지를 푼 뒤에도 방이 닫힌 채 그 사람에게 안 보이게 하는 것은 이 절이다.
 *
 * `definer` 인 것은 정책 안에서 불리기 때문이다 — 정책이 `chat_room` 을 직접 읽으면 그 표의
 * 정책에 가려진다(`docs/notes/db-and-auth-decisions.md`). uuid 를 받지만 답하는 것은 **내가**
 * 볼 수 있는가뿐이라 남의 상태를 묻는 문이 되지 않는다. 규칙을 정책과 읽는 문 두 곳에 적지
 * 않는다 — 두 곳이면 한쪽이 안 고쳐지고, 열려 있는 쪽은 언제나 더 바깥이다(`may_add_revision`).
 */
create function public.chat_room_readable(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_account()
    and exists (
      select 1 from public.chat_room r
      where r.id = p_room_id
        and (select auth.uid()) in (r.user_low, r.user_high)
        and (r.closed_reason is null
             or r.closed_reason = 'block'
             or r.closed_by_user_id <> (select auth.uid()))
    );
$$;

revoke execute on function public.chat_room_readable(uuid) from anon, public;
grant execute on function public.chat_room_readable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 권한 — 열어 주는 것만 연다
-- ---------------------------------------------------------------------------

revoke all on public.chat_room, public.chat_message, public.chat_read,
  public.chat_rate_limit_hit, public.chat_report_snapshot
  from anon, authenticated;

alter table public.chat_room enable row level security;
alter table public.chat_message enable row level security;
alter table public.chat_read enable row level security;
alter table public.chat_rate_limit_hit enable row level security;
alter table public.chat_report_snapshot enable row level security;

/**
 * 방과 메시지는 **읽기만** 열린다. 쓰는 길은 RPC 하나씩이다 — 한도를 세고 닫힘을 묻는 자리가
 * 함수 안이라, 표에 직접 넣는 길이 있으면 그 자리를 지나간다.
 *
 * 나머지 셋(읽은 자리 · 한도 기록 · 스냅샷)은 한 줄도 직접 안 보인다. 정책이 없는 표는
 * `authenticated` 에게 닫혀 있다.
 */
grant select on public.chat_room, public.chat_message to authenticated;

create policy "닫힌 이유가 정한 쪽만 방을 본다"
on public.chat_room for select to authenticated
using (public.chat_room_readable(id));

create policy "방이 보이면 그 메시지도 보인다"
on public.chat_message for select to authenticated
using (public.chat_room_readable(room_id));

-- ---------------------------------------------------------------------------
-- 5. 방이 서고 닫히는 자리 — 전부 트리거다
-- ---------------------------------------------------------------------------

/** Match 가 서면 방이 선다 — 동의가 나면 열린다(G-10) */
create function public.open_chat_room_for_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  room uuid;
begin
  insert into public.chat_room (match_id, user_low, user_high, opened_at)
  values (new.id, new.user_low, new.user_high, new.created_at)
  returning id into room;

  insert into public.chat_read (room_id, user_id)
  values (room, new.user_low), (room, new.user_high);

  return new;
end;
$$;

revoke execute on function public.open_chat_room_for_match() from anon, public, authenticated;

create trigger match_opens_a_chat_room
after insert on public.match
for each row execute function public.open_chat_room_for_match();

/**
 * 차단이 방을 닫는다. 닫힌 시각은 차단 행의 것이다.
 *
 * 이미 닫힌 방은 그대로 둔다 — 중지로 닫힌 방을 나중에 차단해도 이유는 처음 것이 남는다.
 * `block_user` 의 `on conflict do nothing` 은 트리거를 안 깨우므로 두 번 차단해도 한 번이다.
 */
create function public.close_chat_room_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_room r
  set closed_reason = 'block',
      closed_by_user_id = new.user_id,
      closed_at = new.created_at
  where r.closed_at is null
    and r.user_low = least(new.user_id, new.blocked_user_id)
    and r.user_high = greatest(new.user_id, new.blocked_user_id);

  return new;
end;
$$;

revoke execute on function public.close_chat_room_on_block() from anon, public, authenticated;

create trigger block_closes_the_chat_room
after insert on public.block
for each row execute function public.close_chat_room_on_block();

/**
 * 계정이 살아 있지 않게 되면 그 사람의 열린 방이 전부 닫힌다.
 *
 * 중지는 운영자가 `update app_user set status` 로 거는 것뿐이라(runbook) 함수가 아니라
 * 트리거여야 그 길이 잡힌다. 삭제 요청(`request_account_deletion`)도 같은 칸을 옮기므로
 * 같은 트리거가 받는다 — 그 함수를 다시 적지 않는다.
 *
 * 되살아나도(`active` 로 돌아가도) 방은 안 열린다. 닫힘은 되돌리지 않는다(ADR 0091).
 * 모르는 상태가 오면 **소리 내어** 멈춘다 — 조용히 이유 없는 닫힘을 남기지 않는다.
 */
create function public.close_chat_rooms_on_account_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reason text;
begin
  if new.status = 'active' or new.status is not distinct from old.status then
    return new;
  end if;

  reason := case new.status
    when 'suspended' then 'suspension'
    when 'deletion_requested' then 'deletion_request'
  end;

  if reason is null then
    raise exception 'chat: no closing reason for account status %', new.status
      using errcode = '22023';
  end if;

  update public.chat_room r
  set closed_reason = reason,
      closed_by_user_id = new.id,
      closed_at = case when new.status = 'deletion_requested'
        then coalesce(new.deletion_requested_at, now()) else now() end
  where r.closed_at is null
    and new.id in (r.user_low, r.user_high);

  return new;
end;
$$;

revoke execute on function public.close_chat_rooms_on_account_status()
  from anon, public, authenticated;

create trigger account_status_closes_chat_rooms
after update of status on public.app_user
for each row execute function public.close_chat_rooms_on_account_status();

/**
 * 이미 성립한 Match 에도 방을 세운다 — 방은 Match 에 1:1 이고 빈자리를 두지 않는다.
 *
 * 그 사이에 차단 · 삭제 요청 · 중지가 있었으면 닫힌 채로 선다. 겹치면 시각이 있는 것을
 * 먼저 고른다 — 차단, 삭제 요청, 그다음 중지(중지는 시각이 없어 이 마이그레이션이 도는
 * 순간이 닫힌 시각이 된다). 메시지가 없는 닫힌 방을 목록에서 어떻게 보일지는 앱의 일이다.
 */
insert into public.chat_room (
  match_id, user_low, user_high, opened_at, closed_reason, closed_by_user_id, closed_at)
select
  m.id, m.user_low, m.user_high, m.created_at, closing.reason, closing.who, closing.at
from public.match m
left join lateral (
  select c.reason, c.who, c.at
  from (
    select 'block' as reason, b.user_id as who, b.created_at as at, 1 as rank
    from public.block b
    where (b.user_id = m.user_low and b.blocked_user_id = m.user_high)
       or (b.user_id = m.user_high and b.blocked_user_id = m.user_low)
    union all
    select 'deletion_request', u.id, u.deletion_requested_at, 2
    from public.app_user u
    where u.id in (m.user_low, m.user_high) and u.status = 'deletion_requested'
    union all
    select 'suspension', u.id, now(), 3
    from public.app_user u
    where u.id in (m.user_low, m.user_high) and u.status = 'suspended'
  ) c
  order by c.rank, c.at
  limit 1
) closing on true
where not exists (select 1 from public.chat_room r where r.match_id = m.id);

insert into public.chat_read (room_id, user_id)
select r.id, side.user_id
from public.chat_room r
cross join lateral (values (r.user_low), (r.user_high)) as side (user_id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 6. 보낸다 — 한도는 여기서 센다
-- ---------------------------------------------------------------------------

/**
 * 메시지를 보낸다. 인자는 방(Match 의 id)과 본문뿐이다.
 *
 * **한도는 함수 안에서 센다**(ADR 0039 의 규율). 앱이 세면 그 수는 손으로 적은 수이고, 이 RPC
 * 는 로그인한 사람이 브라우저에서 그대로 부를 수 있다. 계정 단위다 — 방 · 상대와 무관하게
 * 내가 한 창 안에 보낸 것을 센다. 세기 전에 **내 계정 행을 잠근다** — 안 잠그면 두 창에서
 * 29건째를 동시에 지나 31건이 선다.
 *
 * **거절은 둘로 갈라 말한다.**
 *
 *   값으로  `sent` · `rate_limited` · `closed` — 방의 상태와 내 흐름이라 화면이 사람에게
 *           말해야 하는 것. `rate_limited` 는 값이어야만 한도 기록이 남는다(위 표).
 *   던져서  누구인가(`28000` 로그인 · `42501` 중지 · `42501` 남의 방 = 없는 방)와 본문의
 *           모양(`22023` 빈 본문 · 너무 긴 본문). 앱이 먼저 막는 것들이다.
 *
 * 없는 방과 남의 방의 답이 **같다** — 갈라 말하면 이 문이 「저 둘 사이에 Match 가 있나」를
 * 묻는 문이 된다(`respond_to_match_request` 와 같은 규율).
 */
create function public.send_chat_message(p_match_id uuid, p_body text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  room public.chat_room;
  recent integer;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'chat: the body is blank' using errcode = '22023';
  end if;

  if length(p_body) > public.chat_message_max_length() then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 전송을 줄 세운다. 한도의 셈이 잠금 뒤에 있어야 두 창이 같은 29 를 못 본다.
  perform 1 from public.app_user u where u.id = actor for update;

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  if room.closed_at is not null then
    return 'closed';
  end if;

  select count(*) into recent
  from public.chat_message m
  where m.sender_user_id = actor
    and m.created_at > now() - public.chat_rate_window();

  if recent >= public.chat_rate_limit() then
    insert into public.chat_rate_limit_hit (user_id, room_id) values (actor, room.id);
    return 'rate_limited';
  end if;

  insert into public.chat_message (room_id, sender_user_id, body)
  values (room.id, actor, p_body);

  return 'sent';
end;
$$;

revoke execute on function public.send_chat_message(uuid, text) from anon, public;
grant execute on function public.send_chat_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. 메시지를 고른 신고 — 근거를 함께 남긴다
-- ---------------------------------------------------------------------------

/**
 * 메시지 하나를 골라 그 사람을 신고한다. `report_user` 는 그대로 두고 옆에 둔다.
 *
 * 신고당하는 사람은 **그 메시지를 보낸 사람**이다. 내 메시지는 고를 수 없다(자기 자신 신고).
 * 「마주친 적 있어야 한다」는 방의 참여자라는 것으로 이미 성립한다.
 *
 * 스냅샷은 고른 메시지와 앞뒤 `chat_snapshot_context()` 건을 **차례(seq)로** 베낀다.
 * 닫힌 방에서도 된다 — 내가 볼 수 있으면 신고할 수 있다. 신고는 방을 닫지 않는다(G-10).
 *
 * 거절의 문장은 `report_user` 의 것을 그대로 쓴다. 없는 메시지와 남의 방의 메시지는 같은
 * 답이다(`42501`).
 */
create function public.report_chat_message(
  p_message_id uuid,
  p_reason text,
  p_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
  chosen public.chat_message;
  room public.chat_room;
  context integer := public.chat_snapshot_context();
  new_report uuid;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '중지된 계정입니다.' using errcode = '42501';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  select m.* into chosen from public.chat_message m where m.id = p_message_id;

  if found then
    select r.* into room
    from public.chat_room r
    where r.id = chosen.room_id and public.chat_room_readable(r.id);
  end if;

  if chosen.id is null or room.id is null then
    raise exception 'chat: no such message' using errcode = '42501';
  end if;

  if chosen.sender_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (actor, chosen.sender_user_id, p_reason, trimmed)
  returning id into new_report;

  insert into public.chat_report_snapshot (
    report_id, match_id, message_id, context_before, context_after, messages)
  select
    new_report, room.match_id, chosen.id, context, context,
    coalesce(jsonb_agg(jsonb_build_object(
      'message_id', x.id,
      'seq', x.seq,
      'sender_user_id', x.sender_user_id,
      'body', x.body,
      'created_at', x.created_at,
      'chosen', x.id = chosen.id
    ) order by x.seq), '[]'::jsonb)
  from (
    (select b.* from public.chat_message b
     where b.room_id = room.id and b.seq < chosen.seq
     order by b.seq desc limit context)
    union all
    (select c.* from public.chat_message c where c.id = chosen.id)
    union all
    (select a.* from public.chat_message a
     where a.room_id = room.id and a.seq > chosen.seq
     order by a.seq asc limit context)
  ) x;

  return new_report;
end;
$$;

revoke execute on function public.report_chat_message(uuid, text, text) from anon, public;
grant execute on function public.report_chat_message(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. 읽는 문 — **이 함수들이 내주는 것이 곧 브라우저가 볼 수 있는 것이다**
-- ---------------------------------------------------------------------------

/**
 * 내 대화방 목록.
 *
 * 나가는 것은 상대의 **닉네임과 사진 유무**, 방의 상태, 마지막 메시지, 안 읽은 수다. 상대의
 * 출생 원문 · 이메일 · 계정 상태는 없다. 닫힌 이유는 나가되 **누가 닫았는지는 안 나간다** —
 * 중지 · 삭제 요청은 보는 쪽이 그 사람이 아니라는 것으로 답이 정해지고, 차단은 알리지 않는다.
 *
 * `visible_matches()` 를 안 탄다 — 그 문은 차단된 쌍을 뺀다. 여기서는 닫힌 방도 목록에 선다.
 * 정렬은 마지막 메시지, 없으면 방이 선 시각이다.
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
  unread_count integer
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
    coalesce(unread.n, 0)
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

/**
 * 방 안의 메시지 — 최신부터, `p_before_seq` 앞의 것을 `p_limit` 건.
 *
 * 없는 방 · 남의 방 · 내가 못 보는 방은 전부 **0행**이다. 읽는 문은 던지지 않는다 —
 * `my_match_scope` 가 그렇다.
 */
create function public.my_chat_messages(
  p_match_id uuid,
  p_before_seq bigint default null,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  seq bigint,
  sender_user_id uuid,
  mine boolean,
  body text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.seq, m.sender_user_id, m.sender_user_id = (select auth.uid()), m.body, m.created_at
  from public.chat_room r
  join public.chat_message m on m.room_id = r.id
  where r.match_id = p_match_id
    and public.chat_room_readable(r.id)
    and (p_before_seq is null or m.seq < p_before_seq)
  order by m.seq desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

revoke execute on function public.my_chat_messages(uuid, bigint, integer) from anon, public;
grant execute on function public.my_chat_messages(uuid, bigint, integer) to authenticated;

/**
 * 여기까지 읽었다 — 그 순간 방의 마지막 차례를 적는다.
 *
 * @returns 적힌 차례. 볼 수 없는 방이면 `42501` 로 던진다 — 쓰는 문이라 없는 것과 같은 답이다.
 */
create function public.mark_chat_read(p_match_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  room uuid;
  marked bigint;
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  select r.id into room
  from public.chat_room r
  where r.match_id = p_match_id and public.chat_room_readable(r.id);

  if room is null then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  update public.chat_read k
  set last_read_seq = coalesce(
        (select max(m.seq) from public.chat_message m where m.room_id = room), 0),
      read_at = now()
  where k.room_id = room and k.user_id = actor
  returning k.last_read_seq into marked;

  return marked;
end;
$$;

revoke execute on function public.mark_chat_read(uuid) from anon, public;
grant execute on function public.mark_chat_read(uuid) to authenticated;

/** 대화방 탭이 드는 수 — 볼 수 있는 방 전부의 안 읽은 메시지 합. 소식 일곱에 들지 않는다 */
create function public.unread_chat_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(rooms.unread_count), 0)::integer from public.my_chat_rooms() rooms;
$$;

revoke execute on function public.unread_chat_count() from anon, public;
grant execute on function public.unread_chat_count() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. 보존 — 닫힌 지 90일 지난 방의 메시지를 지운다. **손으로 돌린다**
-- ---------------------------------------------------------------------------

/**
 * runbook 「채팅」이 부르는 문이다. 크론이 아니다(2026-09-23 의 결정) — 어느 역할에도 열지 않고
 * 운영자가 SQL Editor 에서 `select public.purge_closed_chat_messages()` 로 돌린다.
 *
 * 지우는 것은 **메시지**뿐이다. 방 · 읽은 자리 · 신고 스냅샷은 남는다 — 스냅샷은 메시지와
 * 수명이 다르고(2026-09-23 의 결정), 방은 닫힌 이유를 계속 말해야 한다.
 *
 * @returns 지운 메시지 수
 */
create function public.purge_closed_chat_messages()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from public.chat_message m
    using public.chat_room r
    where r.id = m.room_id
      and r.closed_at is not null
      and r.closed_at < now() - public.chat_retention()
    returning 1
  )
  select count(*)::integer into gone from purged;

  return gone;
end;
$$;

revoke execute on function public.purge_closed_chat_messages() from anon, public, authenticated;
