-- 보낸 말은 보낸 사람이 지은 id 로 한 번만 남는다 — 응답을 잃고 다시 보내도 두 번 서지 않는다 (ADR 0155 덧)
--
-- 방은 누르는 순간 말풍선을 세우고, 못 보냈으면 그 자리에 「다시 보내기」를 둔다(카톡의 방식, 운영자 2026-10-11). 서버는
-- 받았는데 응답만 잃은 전송(네트워크 끊김 · 시한)도 화면에는 실패로 서므로, 다시 보내면 같은 말이 두 번 남았다 — 옛 문
-- `send_chat_message(p_match_id, p_body)` 에는 같은 전송을 알아볼 열쇠가 없었다. 화면은 보낸 말과 읽혀 온 말을 본문으로
-- 짝지어, 같은 말을 연달아 보내면 어느 것이 어느 것인지 가를 수 없었다.
--
-- 1. `chat_message.client_id` — 보낸 사람이 전송마다 지은 uuid. 보낸 사람마다 한 번이다(부분 유일 색인). 옛 줄은 비어 있다.
-- 2. `send_chat_message(p_match_id, p_body, p_client_id)` — 새 서명(넓히기, `docs/ops/runbook/deploy.md` 규약 넷의 3). 같은 사람이
--    같은 방에 같은 id 로 이미 남긴 말이 있으면 아무것도 안 쓰고 `sent` 다 — 한도도 안 센다(새 전송이 아니다). 계정 행을
--    잠근 뒤에 보므로 같은 id 의 두 전송이 나란히 와도 하나만 쓴다. 옛 두 칸 서명은 떠 있는 옛 앱을 위해 남긴다 — 좁히기는
--    G-96(간극 대장).
-- 3. `my_chat_messages` 가 `client_id` 를 낸다 — **내 말에만**. 상대의 id 는 화면이 쓸 데가 없다. 반환 칸이 느는 것이라
--    지우고 다시 세운다(옛 앱은 아는 칸만 집는다).

alter table public.chat_message add column client_id uuid;

create unique index chat_message_once_per_sender
  on public.chat_message (sender_user_id, client_id)
  where client_id is not null;

create function public.send_chat_message(p_match_id uuid, p_body text, p_client_id uuid)
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
    raise exception '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.' using errcode = '28000';
  end if;

  if p_client_id is null then
    raise exception 'chat: the client id is missing' using errcode = '22023';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'chat: the body is blank' using errcode = '22023';
  end if;

  if length(p_body) > public.chat_message_max_length() then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  -- 내 전송을 줄 세운다. 한도의 셈과 같은 id 의 물음이 잠금 뒤에 있어야 두 창이 같은 29 · 같은 「아직 없음」을 못 본다.
  perform 1 from public.app_user u where u.id = actor for update;

  -- 잠그기 전에 물은 것은 그 사이에 커밋된 제재를 못 본다(`request_match` 와 같은 이유).
  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  select r.* into room
  from public.chat_room r
  where r.match_id = p_match_id and actor in (r.user_low, r.user_high);

  if not found then
    raise exception 'chat: no such room' using errcode = '42501';
  end if;

  -- 이미 받은 전송이다 — 응답만 잃었다. 그 사이 방이 닫혔어도 그 말은 남아 있으므로 `sent` 가 참이다.
  if exists (
    select 1 from public.chat_message m
    where m.sender_user_id = actor and m.client_id = p_client_id and m.room_id = room.id
  ) then
    return 'sent';
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

  insert into public.chat_message (room_id, sender_user_id, body, client_id)
  values (room.id, actor, p_body, p_client_id);

  return 'sent';
end;
$$;

revoke execute on function public.send_chat_message(uuid, text, uuid) from anon, public;
grant execute on function public.send_chat_message(uuid, text, uuid) to authenticated;

drop function public.my_chat_messages(uuid, bigint, integer);

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
  created_at timestamptz,
  client_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.seq, m.sender_user_id,
         coalesce(m.sender_user_id = (select auth.uid()), false),
         m.body, m.created_at,
         case when m.sender_user_id = (select auth.uid()) then m.client_id end
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
