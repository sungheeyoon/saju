-- 앱은 계정마다 비공개 채널 하나로 「바뀌었다」를 듣는다 — 넓히기 (ADR 0155)
--
-- 채팅 안전 베타의 「실시간이 아니다」(2026-09-23)를 운영자가 바꿨다(2026-10-08). 이 마이그레이션은 DB 쪽 셋이다.
--
--   1. **누가 듣나** — `realtime.messages` 에 `authenticated` 의 `select` 정책 하나. 주제는 `user:<auth.uid()>` 뿐이다.
--      `insert` 정책은 만들지 않는다 — 브라우저는 듣기만 하고, 보내는 것은 아래 트리거뿐이다.
--   2. **누가 보내나** — 트리거가 `realtime.send(…, 'changed', 'user:<uid>', true)` 를 부른다. 실은 것은
--      `{ area, match_id, seq }` 셋(과 `realtime.send` 가 붙이는 메시지 `id`)뿐이다. 본문 · 닉네임 · 상대 id · 닫힌 까닭은
--      싣지 않는다 — 받은 쪽이 그 갈래의 읽는 문을 다시 부른다.
--   3. **읽음은 본 것까지만** — `mark_chat_read(p_match_id, p_up_to_seq)`. 옛 한 칸 서명은 걷는다.
--
-- ## 재어 본 것 (2026-10-08, 로컬 `20261119090000` 까지 · Supabase CLI 2.115)
--
-- - `realtime.send(payload jsonb, event text, topic text, private boolean default true)` 는 이미 안에서 예외를 삼켜
--   `WARNING` 으로 바꾼다. 그래도 이 파일의 `tell_changed` 가 한 겹 더 감싼다 — `realtime` 스키마나 함수가 없는 DB
--   (realtime 을 뺀 스택)에서도 원래 쓰기가 서야 한다.
-- - `realtime.messages` 는 날마다 파티션이다. **파티션은 WebSocket 으로 붙는 클라이언트가 만든다 — `realtime.send` 는
--   안 만든다**(공식 문서 Broadcast 「Message Retention」). 한동안 아무도 안 붙었으면 그날 보낸 것은 `WARNING` 으로 사라진다
--   — 그때는 들을 사람도 없다. 72시간 지난 파티션은 Realtime 이 걷는다.
-- - **문장 단위로 묶는다.** 크론 `expire_match_requests` 는 한 문장으로 여러 요청을 접고, 탈퇴의 `set null` 은 한 문장으로
--   방 여럿을 비운다. 행 트리거면 같은 사람에게 같은 이벤트가 행 수만큼 간다. 그래서 트리거는 전이 표(transition table)를
--   든 `for each statement` 이고, (사람 · 갈래 · match_id) 하나에 한 번만 보낸다. 전이 표는 사건 하나 · 열 목록 없는 트리거
--   에만 붙으므로 insert · update · delete 를 따로 건다.
-- - 요청의 **만료는 쓰기다** — 크론 `match-request-expiry`(매시 7분)가 `expire_match_requests()` 로 `status = 'expired'` 를
--   적고, 수락 · 거절하려는 순간 문이 먼저 접기도 한다. 그래서 만료도 아래 `match_request` 트리거가 알린다. 다만 그 크론이
--   한 시간에 한 번이라 `expires_at` 이 지나고 최대 한 시간 동안은 아무 이벤트도 없다 — 화면이 그 사이를 맞게 그리려면
--   `my_match_requests` 가 내는 `expires_at` 으로 스스로 접어 보인다.
-- - 수락은 `respond_to_match_request` 안에서 **요청을 먼저 고치고 Match 를 나중에 넣는다.** 요청의 트리거가 도는 때(그 문장의
--   끝)에는 Match 가 아직 없다. 그래서 Match 가 서는 순간에도 둘에게 `requests` 를 match_id 와 함께 한 번 더 보낸다.
--
-- 재는 자리는 `supabase/tests/82_live_channel.test.sql` · `scripts/check-live-channel.mjs`(실제 소켓).

-- ---------------------------------------------------------------------------
-- 1. 누가 듣나 — 제 주제만, 듣기만
-- ---------------------------------------------------------------------------

/**
 * 비공개 채널에 들어올 때(그리고 토큰을 새로 낼 때) Realtime 이 이 정책으로 묻는다 — 「이 사람이 이 주제의 broadcast 를
 * 읽어도 되나」. 주제는 계정마다 하나(`user:<uid>`)다. 남의 주제로 들어오면 채널이 거절된다.
 *
 * `(select auth.uid())` · `(select realtime.topic())` 로 감싼다 — 줄마다 다시 부르지 않는다(advisor 의 `auth_rls_initplan`).
 */
create policy "제 주제의 broadcast 만 듣는다"
on realtime.messages for select to authenticated
using (
  (select realtime.topic()) = 'user:' || (select auth.uid())::text
  and realtime.messages.extension = 'broadcast'
);

-- ---------------------------------------------------------------------------
-- 2. 보내는 손 — 한 사람에게 「바뀌었다」 한 번
-- ---------------------------------------------------------------------------

/**
 * `user:<p_user_id>` 에 `changed` 하나를 보낸다.
 *
 * **실패는 삼킨다** — 채널은 부속이다(ADR 0078 의 결). 보내기가 실패해도 메시지 · 요청 · 읽음은 저장돼야 하고, 놓친
 * 변경은 브라우저의 다시 대조(ADR 0155 「다시 대조」)가 메운다. 사람이 없으면(떠난 자리) 아무것도 안 한다.
 *
 * 아무 역할에도 열지 않는다 — 트리거만 부른다. 열어 두면 남의 주제에 이벤트를 꽂는 문이 된다.
 */
create function public.tell_changed(
  p_user_id uuid,
  p_area text,
  p_match_id uuid default null,
  p_seq bigint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  perform realtime.send(
    jsonb_build_object('area', p_area, 'match_id', p_match_id, 'seq', p_seq),
    'changed',
    'user:' || p_user_id::text,
    true);
exception when others then
  raise warning 'tell_changed: % %', sqlstate, sqlerrm;
end;
$$;

revoke execute on function public.tell_changed(uuid, text, uuid, bigint)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. 채팅 — 메시지 · 읽음 · 방
-- ---------------------------------------------------------------------------

/**
 * 메시지가 섰다 → 방의 두 참여자 모두(보낸 사람의 다른 탭도 받아야 한다). 방마다 그 문장의 가장 큰 `seq` 하나.
 */
create function public.tell_chat_message_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select side.user_id, r.match_id, max(a.seq) as seq
    from added a
    join public.chat_room r on r.id = a.room_id
    cross join lateral (values (r.user_low), (r.user_high)) as side (user_id)
    where side.user_id is not null
    group by side.user_id, r.match_id
  loop
    perform public.tell_changed(t.user_id, 'chat', t.match_id, t.seq);
  end loop;

  return null;
end;
$$;

create trigger chat_message_tells_the_room
after insert on public.chat_message
referencing new table as added
for each statement execute function public.tell_chat_message_added();

/** 읽은 자리가 움직였다 → 읽은 사람 자신(다른 탭 · 기기의 딱지) */
create function public.tell_chat_read_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct n.user_id, r.match_id
    from after_rows n
    join before_rows o on o.room_id = n.room_id and o.user_id = n.user_id
    join public.chat_room r on r.id = n.room_id
    where n.last_read_seq is distinct from o.last_read_seq
  loop
    perform public.tell_changed(t.user_id, 'chat', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger chat_read_tells_the_reader
after update on public.chat_read
referencing old table as before_rows new table as after_rows
for each statement execute function public.tell_chat_read_moved();

/** 방이 섰다 → 두 참여자 */
create function public.tell_chat_room_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, a.match_id
    from added a
    cross join lateral (values (a.user_low), (a.user_high)) as side (user_id)
    where side.user_id is not null
  loop
    perform public.tell_changed(t.user_id, 'chat', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger chat_room_opened_tells_the_pair
after insert on public.chat_room
referencing new table as added
for each statement execute function public.tell_chat_room_opened();

/**
 * 방이 닫혔다 · 참여자가 비었다 → **남은** 참여자. 떠난 자리(`null`)에는 보내지 않는다.
 *
 * 닫은 까닭은 싣지 않는다 — 받은 쪽이 `my_chat_rooms` 를 다시 읽고, 차단 비공개는 그 문이 계속 든다.
 */
create function public.tell_chat_room_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, n.match_id
    from after_rows n
    join before_rows o on o.id = n.id
    cross join lateral (values (n.user_low), (n.user_high)) as side (user_id)
    where side.user_id is not null
      and (n.closed_at is distinct from o.closed_at
           or n.closed_reason is distinct from o.closed_reason
           or n.user_low is distinct from o.user_low
           or n.user_high is distinct from o.user_high)
  loop
    perform public.tell_changed(t.user_id, 'chat', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger chat_room_moved_tells_who_stays
after update on public.chat_room
referencing old table as before_rows new table as after_rows
for each statement execute function public.tell_chat_room_moved();

-- ---------------------------------------------------------------------------
-- 4. 요청 — 생겼다 · 상태가 바뀌었다, 그리고 Match 가 섰다
-- ---------------------------------------------------------------------------

/**
 * 요청이 생겼다 · 상태가 바뀌었다 → 보낸 사람과 받은 사람. 만료(크론) · 무효(차단 · 탈퇴 · 정지) · 취소 · 수락 · 거절이
 * 다 이 길이다. match_id 는 그 요청에서 선 Match 가 **이미 있으면** 싣는다 — 수락의 순간에는 아직 없다(머리말).
 */
create function public.tell_match_request_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id
    from added a
    cross join lateral (values (a.requester_user_id), (a.addressee_user_id)) as side (user_id)
  loop
    perform public.tell_changed(t.user_id, 'requests', null, null);
  end loop;

  return null;
end;
$$;

create trigger match_request_added_tells_the_two
after insert on public.match_request
referencing new table as added
for each statement execute function public.tell_match_request_added();

create function public.tell_match_request_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, m.id as match_id
    from after_rows n
    join before_rows o on o.id = n.id
    left join public.match m on m.request_id = n.id
    cross join lateral (values (n.requester_user_id), (n.addressee_user_id)) as side (user_id)
    where n.status is distinct from o.status
  loop
    perform public.tell_changed(t.user_id, 'requests', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger match_request_moved_tells_the_two
after update on public.match_request
referencing old table as before_rows new table as after_rows
for each statement execute function public.tell_match_request_moved();

/** Match 가 섰다 → 두 사람에게 `requests` 를 match_id 와 함께(수락의 순간 요청 트리거는 Match 를 못 본다) */
create function public.tell_match_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, a.id as match_id
    from added a
    cross join lateral (values (a.user_low), (a.user_high)) as side (user_id)
    where side.user_id is not null
  loop
    perform public.tell_changed(t.user_id, 'requests', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger match_added_tells_the_pair
after insert on public.match
referencing new table as added
for each statement execute function public.tell_match_added();

-- ---------------------------------------------------------------------------
-- 5. 소식 — 생겼다 · 읽음이 바뀌었다 · 지워졌다
-- ---------------------------------------------------------------------------

/**
 * 소식의 주인에게 `notifications`. 지워짐(Match · 요청 · 시도의 cascade)도 안 읽은 수를 움직이므로 함께 알린다.
 * 세 사건이 같은 몸을 쓴다 — 전이 표의 이름을 사건마다 `changed_rows` 하나로 맞췄다.
 */
create function public.tell_notification_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in select distinct c.user_id from changed_rows c loop
    perform public.tell_changed(t.user_id, 'notifications', null, null);
  end loop;

  return null;
end;
$$;

create trigger notification_added_tells_its_owner
after insert on public.notification
referencing new table as changed_rows
for each statement execute function public.tell_notification_moved();

create trigger notification_read_tells_its_owner
after update on public.notification
referencing new table as changed_rows
for each statement execute function public.tell_notification_moved();

create trigger notification_gone_tells_its_owner
after delete on public.notification
referencing old table as changed_rows
for each statement execute function public.tell_notification_moved();

-- ---------------------------------------------------------------------------
-- 6. 풀이권 — 잔액을 움직이는 표 셋(부여 · 묶음 · 사용)
-- ---------------------------------------------------------------------------

/**
 * 잔액은 저장하지 않고 센다(`20260903090000` 「센다, 들지 않는다」) — 그 셈이 읽는 표 셋 중 어느 것이 움직여도 그 계정에
 * `credits`. 부여(`reading_credit_grant`) · 산 묶음과 환급(`reading_bundle`) · 예약 · 확정 · 되돌림(`reading_credit_use`).
 */
create function public.tell_credits_moved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in select distinct c.user_id from changed_rows c loop
    perform public.tell_changed(t.user_id, 'credits', null, null);
  end loop;

  return null;
end;
$$;

create trigger reading_credit_use_added_tells_the_owner
after insert on public.reading_credit_use
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_credit_use_moved_tells_the_owner
after update on public.reading_credit_use
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_credit_use_gone_tells_the_owner
after delete on public.reading_credit_use
referencing old table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_credit_grant_added_tells_the_owner
after insert on public.reading_credit_grant
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_credit_grant_moved_tells_the_owner
after update on public.reading_credit_grant
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_credit_grant_gone_tells_the_owner
after delete on public.reading_credit_grant
referencing old table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_bundle_added_tells_the_owner
after insert on public.reading_bundle
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_bundle_moved_tells_the_owner
after update on public.reading_bundle
referencing new table as changed_rows
for each statement execute function public.tell_credits_moved();

create trigger reading_bundle_gone_tells_the_owner
after delete on public.reading_bundle
referencing old table as changed_rows
for each statement execute function public.tell_credits_moved();

-- ---------------------------------------------------------------------------
-- 7. 인연 궁합 — 끝났다 · 실패했다
-- ---------------------------------------------------------------------------

/**
 * 매칭 풀이의 시도가 `running` 에서 벗어났다 → 그 Match 의 두 사람에게 `requests` · match_id. 누른 사람만이 아니다 —
 * 상대의 인연 탭에도 궁합이 선다. 떠난 자리에는 안 보낸다.
 */
create function public.tell_match_reading_settled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  for t in
    select distinct side.user_id, m.id as match_id
    from after_rows n
    join before_rows o on o.id = n.id
    join public.match m on m.id = n.match_id
    cross join lateral (values (m.user_low), (m.user_high)) as side (user_id)
    where n.kind = 'match'
      and o.status = 'running' and n.status <> 'running'
      and side.user_id is not null
  loop
    perform public.tell_changed(t.user_id, 'requests', t.match_id, null);
  end loop;

  return null;
end;
$$;

create trigger match_reading_settled_tells_the_pair
after update on public.reading_run
referencing old table as before_rows new table as after_rows
for each statement execute function public.tell_match_reading_settled();

revoke execute on function public.tell_chat_message_added() from public, anon, authenticated, service_role;
revoke execute on function public.tell_chat_read_moved() from public, anon, authenticated, service_role;
revoke execute on function public.tell_chat_room_opened() from public, anon, authenticated, service_role;
revoke execute on function public.tell_chat_room_moved() from public, anon, authenticated, service_role;
revoke execute on function public.tell_match_request_added() from public, anon, authenticated, service_role;
revoke execute on function public.tell_match_request_moved() from public, anon, authenticated, service_role;
revoke execute on function public.tell_match_added() from public, anon, authenticated, service_role;
revoke execute on function public.tell_notification_moved() from public, anon, authenticated, service_role;
revoke execute on function public.tell_credits_moved() from public, anon, authenticated, service_role;
revoke execute on function public.tell_match_reading_settled() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. 읽음은 본 것까지만 — `mark_chat_read(p_match_id, p_up_to_seq)`
-- ---------------------------------------------------------------------------

/**
 * 옛 한 칸 서명은 「그 순간 방의 마지막 차례」를 적었다 — 숨겨진 탭 · 화면 밖의 메시지도 읽음이 됐다. 같은 PR 의 앱이 새
 * 서명을 부르므로 옛 것을 걷는다(묶음 배포에서 이 마이그레이션이 앱보다 먼저 가면 옛 앱의 읽음 표시는 그 사이 실패한다 —
 * 읽음은 부속이라 화면은 선다, `app/me/chat/actions.ts`).
 */
drop function public.mark_chat_read(uuid);

/**
 * 여기까지 봤다 — **그 방에 실제로 있는 차례까지만, 앞으로만** 움직인다.
 *
 * `p_up_to_seq` 이하에서 그 방에 있는 가장 큰 `seq` 를 찾아 `greatest(지금, 그것)` 으로 적는다. 그래서 없는 큰 수를
 * 주어도 방의 끝을 넘지 않고, 늦게 도착한 작은 수가 읽은 자리를 뒤로 물리지 않는다. 움직이지 않으면 아무것도 안 쓴다
 * (다른 탭에 이벤트도 안 간다).
 *
 * @returns 남은 `last_read_seq`. 볼 수 없는 방이면 `42501` — 쓰는 문이라 없는 방과 같은 답이다.
 */
create function public.mark_chat_read(p_match_id uuid, p_up_to_seq bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  room uuid;
  seen bigint;
  marked bigint;
begin
  if actor is null then
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_up_to_seq is null then
    raise exception 'chat: up_to_seq is required' using errcode = '22023';
  end if;

  select r.id into room
  from public.chat_room r
  where r.match_id = p_match_id and public.chat_room_readable(r.id);

  if room is null then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  select max(m.seq) into seen
  from public.chat_message m
  where m.room_id = room and m.seq <= p_up_to_seq;

  update public.chat_read k
  set last_read_seq = seen,
      read_at = now()
  where k.room_id = room and k.user_id = actor
    and seen is not null
    and k.last_read_seq < seen;

  select k.last_read_seq into marked
  from public.chat_read k
  where k.room_id = room and k.user_id = actor;

  return marked;
end;
$$;

revoke execute on function public.mark_chat_read(uuid, bigint) from anon, public;
grant execute on function public.mark_chat_read(uuid, bigint) to authenticated;
