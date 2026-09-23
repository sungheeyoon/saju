-- 신고 빗장을 고친다 — 판정 순서 · 중복 문구 · 받치는 인덱스 (G-23 ⑤)
--
-- `20261007090000` 을 운영에 올린 뒤 검토에서 나온 셋이다. 올린 마이그레이션은 고치지 않고 여기서 덮는다.
--
-- 1. **중복이 하루 수보다 먼저다.** 하루 스물을 채운 사람이 같은 신고를 다시 내면 「하루 한도」가 아니라
--    「이미 접수」를 읽어야 한다 — 그 사람에게 맞는 답은 뒤엣것이다. 자물쇠는 그대로 맨 앞에서 잡고, 사유 ·
--    대상 검사와 중복을 지난 뒤 insert 바로 앞에서 하루 수를 센다.
-- 2. **중복 문구** — 「검토가 끝날 때까지 기다려 주세요」는 검토가 끝나면 같은 일을 다시 내라는 말로 읽히고,
--    외부 알림(G-26) 전에는 검토 결과를 알릴 길도 없다. 사람이 고른 문장으로 바꾼다(2026-09-23).
-- 3. **인덱스** — 하루 수와 중복은 신고마다 `reporter_user_id` 로 찾는데 그 열의 인덱스가 없었다.
--
-- 두 신고 함수의 몸은 **운영의 살아 있는 정의에서 떠 왔다**(로컬과 같음을 대조했다).

create index report_by_reporter on public.report (reporter_user_id, created_at desc);

create index report_unreviewed_by_pair on public.report (reporter_user_id, reported_user_id, reason)
  where reviewed_at is null;

create index chat_report_snapshot_by_message on public.chat_report_snapshot (message_id);

CREATE OR REPLACE FUNCTION public.report_user(p_user_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  trimmed text := nullif(btrim(coalesce(p_detail, '')), '');
begin
  if actor is null then
    raise exception '로그인이 필요합니다.' using errcode = '28000';
  end if;

  if not public.is_active_account() then
    raise exception '이용이 정지된 계정입니다.' using errcode = '42501';
  end if;

  /** 가입이 끝난 계정만 — 공개 출시에서 가입은 본인인증을 품는다(ADR 0101) */
  if not exists (select 1 from public.app_user u where u.id = actor and u.signed_up_at is not null) then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  /** 이 사람의 신고를 줄 세운다 — 중복과 하루 수를 이 자물쇠 안에서 센다 */
  perform 1 from public.app_user u where u.id = actor for update;

  if p_user_id is null or p_user_id = actor then
    raise exception '자기 자신은 신고할 수 없습니다.' using errcode = '22023';
  end if;

  if p_reason is null or p_reason not in ('harassment', 'impersonation', 'inappropriate', 'other') then
    raise exception '신고 사유를 골라 주세요.' using errcode = '22023';
  end if;

  if trimmed is not null and length(trimmed) > 1000 then
    raise exception '적어 주신 내용이 너무 깁니다.' using errcode = '22023';
  end if;

  /**
   * **아무나 신고할 수는 없다.** 마주친 적 있는 사람만 신고할 수 있다 — 후보로 봤거나,
   * 요청을 주고받았거나, Match 가 성립한 사이다. 이 조건이 없으면 uuid 를 넣어 보는
   * 것만으로 남의 계정에 신고를 쌓을 수 있다.
   */
  if not exists (
    select 1 from public.discovery_impression i
    where i.viewer_user_id = actor and i.candidate_user_id = p_user_id
    union all
    select 1 from public.match_request r
    where (r.requester_user_id = actor and r.addressee_user_id = p_user_id)
       or (r.requester_user_id = p_user_id and r.addressee_user_id = actor)
    union all
    select 1 from public.match m
    where (m.user_low = actor and m.user_high = p_user_id)
       or (m.user_low = p_user_id and m.user_high = actor)
  ) then
    raise exception '마주친 적 없는 사람은 신고할 수 없습니다.' using errcode = '42501';
  end if;

  /** 같은 사람 · 같은 사유로 아직 검토되지 않은 신고가 있으면 또 쌓지 않는다 */
  if exists (
    select 1 from public.report r
    where r.reporter_user_id = actor and r.reported_user_id = p_user_id
      and r.reason = p_reason and r.reviewed_at is null
  ) then
    raise exception '같은 사유의 신고가 이미 접수되어 검토 중입니다.' using errcode = '23505';
  end if;

  /** 하루 수는 중복 뒤에 센다 — 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다 */
  perform public.hold_report_quota(actor);

  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  select actor, p_user_id, p_reason, trimmed
  where exists (select 1 from public.app_user u where u.id = p_user_id);

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.report_chat_message(p_message_id uuid, p_reason text, p_detail text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  /** 가입이 끝난 계정만 — 공개 출시에서 가입은 본인인증을 품는다(ADR 0101) */
  if not exists (select 1 from public.app_user u where u.id = actor and u.signed_up_at is not null) then
    raise exception '가입을 먼저 끝내 주세요.' using errcode = '42501';
  end if;

  /** 이 사람의 신고를 줄 세운다 — 중복과 하루 수를 이 자물쇠 안에서 센다 */
  perform 1 from public.app_user u where u.id = actor for update;

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

  /**
   * 같은 메시지 · 같은 사유로 아직 검토되지 않은 신고가 있으면 또 쌓지 않는다.
   * 같은 사람의 **다른** 메시지는 저마다 다른 근거라 막지 않는다 — 하루 한도가 그 수를 묶는다.
   */
  if exists (
    select 1 from public.report r
    join public.chat_report_snapshot s on s.report_id = r.id
    where r.reporter_user_id = actor and s.message_id = chosen.id
      and r.reason = p_reason and r.reviewed_at is null
  ) then
    raise exception '같은 사유의 신고가 이미 접수되어 검토 중입니다.' using errcode = '23505';
  end if;

  /** 하루 수는 중복 뒤에 센다 — 같은 신고를 다시 낸 사람에게는 「이미 접수」가 먼저 선다 */
  perform public.hold_report_quota(actor);

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
$function$;
