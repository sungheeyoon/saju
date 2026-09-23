-- 사람 저장과 신고에 빗장을 건다 (G-23 ④ ⑤, ADR 0102)
--
-- 둘 다 **사고를 막는 빗장이지 제품 약속이 아니다** — 풀이의 시간당 · 하루 상한(ADR 0021 · 0039)과 같은
-- 성질이다. 수는 2026-09-23 에 사람이 정했다.
--
--   사람 저장  사용자당 시간 20명 · 하루 100명. 총량 제한은 이것과 따로다 — 자리 10명(`person_limit`)은
--             공개 출시에서 걷고(ADR 0102), 이 빗장은 그 뒤에도 남는다
--   신고       사용자당 하루 20건. 아직 검토되지 않은 같은 대상 · 같은 사유의 신고는 또 쌓지 않는다
--
-- ## 어디서 세나 — DB 에서, 사람 자물쇠 안에서
--
-- 앱 메모리에서 세면 서버 인스턴스마다 수가 갈린다. 세는 일은 문 안에서 하고, 나란히 들어온 둘이
-- 같은 수를 보고 둘 다 지나가지 않게 **그 사람의 `app_user` 행을 잠근 뒤** 센다 — `start_reading_run`
-- 이 한 사람의 시작을 줄 세우는 것과 같은 수다(ADR 0021 「도는 것도 자리를 잡는다」).
--
-- **시간은 지난 한 시간, 하루는 서울 자정부터다** — 풀이의 두 상한과 같은 경계다.
--
-- ## 사람 저장은 지금 남아 있는 행을 센다
--
-- `user_person_access` 에 들어가는 모든 행이 든다 — 목록에 선 사람도, 궁합만 보려고 만든 사람도(ADR 0053).
-- 막으려는 것이 **남의 출생정보를 쌓는 것**이라서다. 나 자신은 안 센다. 지웠다가 다시 넣는 길은
-- 세지 않는데, 지운 사람은 쌓이지 않으므로 이 빗장이 막으려는 일이 아니다.
--
-- ## 신고는 가입을 다시 묻는다
--
-- 지금까지 두 신고 문은 정지만 물었다. 가입이 안 끝난 계정은 마주친 사람이 없어 사실상 닫혀 있었지만
-- 문이 스스로 묻지 않았다. 이제 묻는다 — 공개 출시에서 가입은 본인인증을 품으므로(ADR 0101) 이 한 줄이
-- 「인증을 마친 계정만 신고한다」가 된다.
--
-- 두 신고 함수의 몸은 **살아 있는 DB 에서 떠 왔다**(`pg_get_functiondef`) — 옛 마이그레이션을 베끼면
-- 사이의 수정이 되감긴다(`20260926090000` 머리말).

create or replace function public.person_save_hourly_limit()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

create or replace function public.person_save_daily_limit()
returns integer language sql immutable set search_path = '' as $$ select 100 $$;

create or replace function public.report_daily_limit()
returns integer language sql immutable set search_path = '' as $$ select 20 $$;

revoke all on function public.person_save_hourly_limit() from public, anon, authenticated;
revoke all on function public.person_save_daily_limit() from public, anon, authenticated;
revoke all on function public.report_daily_limit() from public, anon, authenticated;

/** 들어오는 저장 한 행을 센다 — 그 사람을 잠근 뒤에 */
create or replace function public.enforce_person_save_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner public.app_user;
  last_hour integer;
  today integer;
begin
  select * into owner from public.app_user u where u.id = new.user_id for update;

  if owner.id is null or new.person_id is not distinct from owner.self_person_id then
    return new;
  end if;

  select
    count(*) filter (where a.created_at > now() - interval '1 hour'),
    count(*) filter (where a.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))
  into last_hour, today
  from public.user_person_access a
  where a.user_id = new.user_id
    and a.person_id is distinct from owner.self_person_id;

  if today >= public.person_save_daily_limit() then
    raise exception '사람은 하루에 %명까지 저장할 수 있습니다. 내일 다시 저장해 주세요.', public.person_save_daily_limit()
      using errcode = '53400';
  end if;

  if last_hour >= public.person_save_hourly_limit() then
    raise exception '사람은 한 시간에 %명까지 저장할 수 있습니다. 잠시 뒤에 다시 저장해 주세요.', public.person_save_hourly_limit()
      using errcode = '53400';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_person_save_rate() from public, anon, authenticated;

create trigger person_save_rate
  before insert on public.user_person_access
  for each row execute function public.enforce_person_save_rate();

/** 신고 한 건을 받기 전에 — 그 사람을 잠그고 오늘 낸 수를 센다 */
create or replace function public.hold_report_quota(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today integer;
begin
  perform 1 from public.app_user u where u.id = p_actor for update;

  select count(*) into today
  from public.report r
  where r.reporter_user_id = p_actor
    and r.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');

  if today >= public.report_daily_limit() then
    raise exception '신고는 하루에 %건까지 할 수 있습니다. 내일 다시 해 주세요.', public.report_daily_limit()
      using errcode = '53400';
  end if;
end;
$$;

revoke all on function public.hold_report_quota(uuid) from public, anon, authenticated;

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

  perform public.hold_report_quota(actor);

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
    raise exception '이미 같은 사유로 신고했습니다. 검토가 끝날 때까지 기다려 주세요.' using errcode = '23505';
  end if;

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

  perform public.hold_report_quota(actor);

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
    raise exception '이미 같은 사유로 신고했습니다. 검토가 끝날 때까지 기다려 주세요.' using errcode = '23505';
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
$function$;
