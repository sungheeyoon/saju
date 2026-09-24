-- 같은 신고를 거듭 막는 판단도 처리 필요 정의 하나를 쓴다 (ADR 0107 정정, G-23 ⑤)
--
-- `20261016090000` 이 처리 필요 = 안 봤거나(`reviewed_at is null`) 추가 확인 필요(`needs_more`)로 정의하고 목록 문 · runbook
-- 질의 · 월 점검을 `public.report_is_open` 하나로 모았다. 두 신고 문(`report_user` · `report_chat_message`)의 중복 판단만
-- `reviewed_at is null` 그대로였다 — 2026-09-24 에 로컬에서 잰 값(pgTAP `53_report_duplicate_is_open`, 고치기 전 12 중 6 붉음):
-- 추가 확인 필요로 보류한 동안 같은 사람 · 같은 사유(또는 같은 메시지 · 같은 사유)의 신고가 또 쌓였다. 운영자 목록에는 같은
-- 건이 처리 필요로 둘 서고, 신고한 사람은 「검토 중」인 것을 다시 낸 셈이 된다.
--
-- 고치는 것은 두 문의 판단 한 줄씩이다 — `r.reviewed_at is null` → `public.report_is_open(r.reviewed_at, r.review_outcome)`.
-- 조치 없음 · 경고 · 이용 정지 결정으로 끝났거나 옛 검토(시각만 있고 결과 없음)면 전처럼 다시 낼 수 있다. 문구 · 판정 순서 ·
-- 하루 수는 그대로다. 두 함수의 몸은 `20261008090000` 의 것이고(그 뒤로 다시 정의한 마이그레이션이 없다) 그 한 줄과 주석만 바꿨다.
--
-- ## 받치는 인덱스
--
-- `report_unreviewed_by_pair` 는 `where reviewed_at is null` 부분 인덱스라 새 판단(보류한 줄까지)을 못 받친다. 술어를
-- `report_is_open(...)` 으로 바꾼 부분 인덱스는 로컬 EXPLAIN 에서 쓰였지만(`set search_path` 를 단 함수라 펼쳐지지 않고 식째로
-- 맞춰진다), 그 함수를 `create or replace` 로 고치면 인덱스는 옛 정의로 남은 채 조용히 틀린 답을 낸다 — 정의가 한 곳이라는 것이
-- 이 정정의 뜻인데 인덱스가 둘째 사본이 된다. 그래서 **술어 없는 인덱스**로 바꾼다. 같은 두 사람 · 같은 사유의 줄은 중복이 막아
-- 몇 줄뿐이고, 판단은 그 몇 줄을 걸러 읽는다. 운영의 `public.report` 는 2026-09-24 에 0줄이었다.

drop index public.report_unreviewed_by_pair;

create index report_by_pair on public.report (reporter_user_id, reported_user_id, reason);

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

  /**
   * 같은 사람 · 같은 사유로 처리 필요인 신고가 있으면 또 쌓지 않는다 — 안 봤거나 추가 확인 필요로 보류한 것.
   * 정의는 운영자 목록과 같은 `report_is_open` 하나다(ADR 0107).
   */
  if exists (
    select 1 from public.report r
    where r.reporter_user_id = actor and r.reported_user_id = p_user_id
      and r.reason = p_reason and public.report_is_open(r.reviewed_at, r.review_outcome)
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
   * 같은 메시지 · 같은 사유로 처리 필요인 신고가 있으면 또 쌓지 않는다 — 안 봤거나 추가 확인 필요로 보류한 것.
   * 정의는 운영자 목록과 같은 `report_is_open` 하나다(ADR 0107).
   * 같은 사람의 **다른** 메시지는 저마다 다른 근거라 막지 않는다 — 하루 한도가 그 수를 묶는다.
   */
  if exists (
    select 1 from public.report r
    join public.chat_report_snapshot s on s.report_id = r.id
    where r.reporter_user_id = actor and s.message_id = chosen.id
      and r.reason = p_reason and public.report_is_open(r.reviewed_at, r.review_outcome)
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
