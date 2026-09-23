-- 탈퇴의 처분 — **떠난 사람의 것은 지우고, 대화는 남는 쪽에 남는다** (ADR 0094, G-27)
--
-- 지금까지 처분(`forget_user`)은 `auth.users` 한 줄을 지우고 나머지를 FK 에 맡겼다(ADR 0023).
-- 그 FK 가 전부 `cascade` 라 **Match 와 대화방이 떠난 사람을 따라 사라졌다** — 남는 쪽의 채팅
-- 목록에서 방이 통째로 없어지고, PRD §7.1 이 정한 「상대의 탈퇴 — 남는 쪽이 본다」와 넷째 안내
-- 줄(`탈퇴한 사용자입니다. 더 이상 대화할 수 없습니다.`)은 설 자리가 없었다.
--
-- 이 마이그레이션이 가르는 것은 셋이다.
--
--   1. **떠난 사람 혼자의 것은 지금처럼 지운다** — 계정 · 프로필 · 사진 · Person 과 입력 · 풀이 ·
--      설문 · 요청 · 알림 · 차단 · 신고. FK 가 이미 그렇게 적혀 있고 여기서 안 건드린다.
--   2. **대화방과 메시지는 남기고 떠난 쪽의 자리만 비운다** — 참여자 칸 · 닫은 사람 칸 · 보낸
--      사람 칸이 `on delete set null` 이 된다. 방을 매단 Match 행도 그래서 남는다(방의 열쇠가
--      Match 의 id 다, ADR 0091). 남는 쪽은 닫힌 날부터 90일까지 대화를 본다(보존 규칙 그대로).
--   3. **함께 보던 궁합은 남기지 않는다.** Match 행은 방의 닻으로만 남고, 떠난 쪽의 여덟 글자와
--      그 Match 위의 궁합풀이는 처분 때 지워진다. 신청 때부터 상대 화면에서 이미 내려가 있었고
--      (`visible_matches()` 가 상대가 `active` 인지 묻는다), 모두가 확인한 처리방침이 「그 관계와
--      결과는 상대 화면에서도 함께 사라집니다」라고 약속했다. 그 약속을 지킨다(ADR 0094).
--
-- **`forget_user` 는 안 고친다.** 지우는 규칙은 표 이름이 아니라 FK 와 그 곁의 트리거에 적는다
-- (ADR 0023) — 누가 `auth.users` 를 직접 지워도 같은 답이 나온다.
--
-- 앞선 `20260929090000`(G-49)이 정지의 문장을 바꿨다. 여기서 다시 세우는 `report_chat_message`
-- 는 그 새 문장(「이용이 정지된 계정입니다.」)을 그대로 든다.
--
-- 재는 자리는 `supabase/tests/37_withdrawal.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. Match — 방의 닻으로 남고, 떠난 쪽의 여덟 글자는 그 사람을 따라간다
-- ---------------------------------------------------------------------------

/**
 * 참여자 칸 둘과 요청 칸이 비워질 수 있어야 행이 남는다.
 *
 * 요청 칸도 풀어야 한다 — `match_request` 는 요청한 사람과 받은 사람 **둘 다**에 `cascade` 로
 * 매여 있어, 떠난 사람의 요청이 지워지면 `match.request_id` 의 `cascade` 가 Match 까지 데려간다.
 * 참여자 칸만 풀면 Match 는 요청 쪽 길로 여전히 사라진다(일부러 요청 칸을 그대로 두고 37 을
 * 돌려 확인했다).
 *
 * 여덟 글자 칸의 `not null`(`20260925180000` 14절)도 푼다. 떠난 쪽의 것을 지울 자리가 있어야
 * 한다 — 백필이 끝났는지를 지키던 좁힘이었고, 그 일은 끝났다.
 */
alter table public.match
  alter column user_low drop not null,
  alter column user_high drop not null,
  alter column request_id drop not null,
  alter column chart_low drop not null,
  alter column chart_high drop not null,
  alter column chart_engine_low drop not null,
  alter column chart_engine_high drop not null;

alter table public.match
  drop constraint match_user_low_fkey,
  drop constraint match_user_high_fkey,
  drop constraint match_request_id_fkey;

alter table public.match
  add constraint match_user_low_fkey
    foreign key (user_low) references public.app_user (id) on delete set null,
  add constraint match_user_high_fkey
    foreign key (user_high) references public.app_user (id) on delete set null,
  add constraint match_request_id_fkey
    foreign key (request_id) references public.match_request (id) on delete set null;

/**
 * **떠난 쪽의 여덟 글자는 그 사람을 따라간다.**
 *
 * 참여자 칸이 비는 순간(FK 의 `set null` 도 행 트리거를 부른다) 그 자리의 여덟 글자와 엔진 판을
 * 함께 비운다. 동의 당시 여덟 글자는 **그 동의를 한 두 사람에게** 보이려고 베낀 것이고
 * (ADR 0071), 한쪽이 없어지면 보일 사람이 없다 — 남은 쪽의 화면에서도 이미 내려가 있다.
 */
create function public.match_forgets_the_leavers_chart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_low is not null and new.user_low is null then
    new.chart_low := null;
    new.chart_engine_low := null;
  end if;

  if old.user_high is not null and new.user_high is null then
    new.chart_high := null;
    new.chart_engine_high := null;
  end if;

  return new;
end;
$$;

create trigger match_forgets_the_leavers_chart
  before update of user_low, user_high on public.match
  for each row execute function public.match_forgets_the_leavers_chart();

/**
 * **그 Match 위의 궁합풀이도 함께 지운다. 둘 다 떠났으면 Match 째 지운다.**
 *
 * 궁합풀이는 두 사람의 명식으로 쓴 글이고 새 풀이는 두 닉네임을 본문에 든다(`reading_about`).
 * 보통은 떠난 사람의 selfPerson 이 지워지면서 `reading.person_*` 의 `cascade` 로 따라가지만,
 * 그 Person 을 다른 사람도 관리하고 있으면 Person 이 남고 글도 남는다. 그래서 Person 이 아니라
 * **Match 에서 한 사람이 빠지는 순간**에 건다. 시도(`reading_run`)도 같다 — 도는 중이던 생성이
 * 떠난 사람의 이름으로 글을 저장하지 않게 한다.
 *
 * 남은 사람이 없는 Match 는 누구의 방도 아니다 — 방 · 메시지까지 `cascade` 로 함께 간다.
 */
create function public.match_without_its_pair_is_cleared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.user_low is not null and new.user_low is null)
     or (old.user_high is not null and new.user_high is null) then
    delete from public.reading r where r.match_id = new.id;
    delete from public.reading_run r where r.match_id = new.id;
  end if;

  if new.user_low is null and new.user_high is null then
    delete from public.match m where m.id = new.id;
  end if;

  return null;
end;
$$;

create trigger match_without_its_pair_is_cleared
  after update of user_low, user_high on public.match
  for each row execute function public.match_without_its_pair_is_cleared();

revoke execute on function public.match_forgets_the_leavers_chart()
  from anon, public, authenticated;
revoke execute on function public.match_without_its_pair_is_cleared()
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 2. 대화방 — 떠난 쪽의 자리만 비고, 방은 닫힌 채 남는다
-- ---------------------------------------------------------------------------

alter table public.chat_room
  alter column user_low drop not null,
  alter column user_high drop not null;

alter table public.chat_room
  drop constraint chat_room_user_low_fkey,
  drop constraint chat_room_user_high_fkey,
  drop constraint chat_room_closed_by_user_id_fkey;

/**
 * 닫은 사람 칸도 `cascade` 였다 — 탈퇴를 신청한 사람이 닫은 방은 그 사람이 지워지면 **닫은
 * 사람 칸을 따라** 사라졌다. 참여자 칸만 풀면 방은 이 길로 여전히 사라진다.
 */
alter table public.chat_room
  add constraint chat_room_user_low_fkey
    foreign key (user_low) references public.app_user (id) on delete set null,
  add constraint chat_room_user_high_fkey
    foreign key (user_high) references public.app_user (id) on delete set null,
  add constraint chat_room_closed_by_user_id_fkey
    foreign key (closed_by_user_id) references public.app_user (id) on delete set null;

/**
 * 「세 칸이 함께 서거나 함께 빈다」가 「닫은 사람은 떠났을 수 있다」로 넓어진다.
 *
 * 이유와 시각은 여전히 함께 선다. 닫은 사람 칸만 **닫힌 방에서** 빌 수 있다 — 열린 방에 닫은
 * 사람이 서는 일은 여전히 없다. 「떠난 사람이 있을 때만」으로 좁히지 않은 것은 FK 의 `set null`
 * 이 칸마다 따로 도는 문장이라, 닫은 사람 칸이 먼저 비고 참여자 칸이 나중에 비는 순간이 있기
 * 때문이다 — 그 사이의 행도 검사식을 지나야 한다.
 */
alter table public.chat_room drop constraint chat_closing_stands_together;

alter table public.chat_room
  add constraint chat_closing_stands_together check (
    (closed_reason is null) = (closed_at is null)
    and (closed_by_user_id is null or closed_reason is not null));

/**
 * **열린 채로 한쪽이 떠나면 그 순간 닫는다.**
 *
 * 탈퇴 대기를 거친 사람의 방은 신청 때 이미 닫혀 있다(`close_chat_rooms_on_account_status`).
 * 그런데 처분은 신청을 안 거친 계정에도 돈다 — 운영자가 요청을 받아 한 사람을 지우거나(runbook
 * 「지우기」), 베타가 끝나 전부 지울 때. 그때 열린 방이 남으면 떠난 사람에게 계속 보낼 수 있는
 * 방이 된다. 이유는 `deletion_request` 다 — 떠나는 길은 그것 하나고, 닫힌 시각이 보존 90일의
 * 시작이다(PRD §7.1). 닫은 사람은 없다 — 그 사람이 지금 지워지는 중이다.
 */
create function public.chat_room_closes_when_one_leaves()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.user_low is null or new.user_high is null) and new.closed_reason is null then
    new.closed_reason := 'deletion_request';
    new.closed_at := now();
    new.closed_by_user_id := null;
  end if;

  return new;
end;
$$;

create trigger chat_room_closes_when_one_leaves
  before update of user_low, user_high on public.chat_room
  for each row execute function public.chat_room_closes_when_one_leaves();

revoke execute on function public.chat_room_closes_when_one_leaves()
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 3. 메시지 — 보낸 사람 칸만 빈다
-- ---------------------------------------------------------------------------

alter table public.chat_message alter column sender_user_id drop not null;

alter table public.chat_message drop constraint chat_message_sender_user_id_fkey;

alter table public.chat_message
  add constraint chat_message_sender_user_id_fkey
    foreign key (sender_user_id) references public.app_user (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. 읽는 문 — 빈 자리를 「없는 사람」이 아니라 「떠난 사람」으로 읽는다
-- ---------------------------------------------------------------------------

/**
 * 열람 술어. **바뀐 것은 한 절이다** — `closed_by_user_id <> 나` 가 `is distinct from` 이 된다.
 *
 * 닫은 사람이 떠나 칸이 비면 `<>` 는 `null` 을 내고 술어가 거짓이 된다 — 탈퇴를 신청한 사람이
 * 닫은 방이 처분 뒤에 **남는 쪽에게서** 사라진다. 옛 절을 되살려 37 을 돌리면 그 줄이 빨개진다.
 */
create or replace function public.chat_room_readable(p_room_id uuid)
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
             or r.closed_by_user_id is distinct from (select auth.uid()))
    );
$$;

/**
 * 방 목록 — 상대가 떠났으면 **`partner_left` 가 참이고** 상대의 칸(id · 닉네임 · 사진 · 접속)은
 * 빈다. 화면은 그 칸 하나로 닉네임 대신 「탈퇴한 사용자」를, 닫힌 까닭 대신 넷째 줄을 세운다.
 *
 * 상대를 `left join` 으로 붙인다. `join` 이면 상대가 없는 방은 목록에서 빠진다 — 그것이 이
 * 마이그레이션 전의 모양이었다(방이 이미 없었으므로 드러나지 않았다).
 *
 * 안 읽은 수의 `<>` 도 `is distinct from` 이 된다 — 떠난 사람이 보낸 메시지는 보낸 사람 칸이
 * 비고, `<>` 는 그 줄을 세지 않는다.
 *
 * 반환형이 칸 하나 늘어 `drop` 뒤 다시 세운다. **`drop` 은 ACL 을 기본값으로 되돌린다** —
 * revoke · grant 를 다시 적는다(33-1 · 33-2 가 잰다). 본문은 살아 있는 정의(`20260928090000`)에서
 * 떴고 바뀐 것은 위의 셋뿐이다.
 */
drop function public.my_chat_rooms();

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
  partner_activity text,
  partner_left boolean
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
    case when r.closed_reason is null then public.activity_band_of(partner.id) end,
    partner.id is null
  from public.chat_room r
  left join public.app_user partner
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
      and m.sender_user_id is distinct from (select auth.uid())
      and m.seq > k.last_read_seq
  ) unread on true
  where public.chat_room_readable(r.id)
  order by coalesce(last.created_at, r.opened_at) desc;
$$;

revoke execute on function public.my_chat_rooms() from anon, public;
grant execute on function public.my_chat_rooms() to authenticated;

/**
 * 메시지 — `mine` 이 `null` 이 되지 않게 한다. 떠난 사람이 보낸 줄은 보낸 사람 칸이 비고,
 * `= 나` 는 `null` 을 낸다. 화면은 `mine === true` 로 읽으니 지금도 「상대」로 서지만, 값이
 * 셋이 되는 칸을 둘로 되돌린다. 서명과 반환형은 그대로다.
 */
create or replace function public.my_chat_messages(
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
  select m.id, m.seq, m.sender_user_id,
         coalesce(m.sender_user_id = (select auth.uid()), false),
         m.body, m.created_at
  from public.chat_room r
  join public.chat_message m on m.room_id = r.id
  where r.match_id = p_match_id
    and public.chat_room_readable(r.id)
    and (p_before_seq is null or m.seq < p_before_seq)
  order by m.seq desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

/**
 * 신고 — **떠난 사람의 메시지는 신고할 수 없다.** 신고당할 계정이 없고(`report.reported_user_id`
 * 는 `not null`), 제재할 사람도 없다. 화면은 그 줄에 신고 버튼을 안 세운다. 문이 받는 답은 없는
 * 메시지와 같다(`42501`) — 새 한글을 짓지 않는다(ADR 0091 「거절을 말하는 법」).
 *
 * 나머지는 살아 있는 정의(`20260929090000`) 그대로다 — 정지의 문장도 그 새 문장이다.
 */
create or replace function public.report_chat_message(
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
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
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

  if chosen.id is null or room.id is null or chosen.sender_user_id is null then
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
