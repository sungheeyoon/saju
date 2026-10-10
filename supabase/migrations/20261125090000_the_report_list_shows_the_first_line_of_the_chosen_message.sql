-- 운영자 신고 목록이 **신고자가 고른 메시지의 첫 줄**을 한 줄 발췌로 낸다 (화면 점검 C17, G-24 · ADR 0103)
--
-- 2026-10-10 에 잰 값: 목록 문(`operator_reports`)은 줄마다 사유 · 두 계정 · 처리 상태 · 저장된 메시지 수까지만 냈다.
-- 운영자가 「무슨 말로 신고됐나」를 보려면 줄마다 상세를 열어야 했다 — 상세는 문 둘(`reports.detail` · `reports.snapshot`)을
-- 부르고 접속기록에 두 줄을 남긴다. 화면 점검 C17 이 목록에서 고른 메시지를 한 줄로 보이자고 했고, 지금 문으로는 그 값이
-- 없어 이 마이그레이션이 든다.
--
-- ## 무엇을 더하나 — 반환 칸 하나 `chosen_excerpt`
--
-- 인자는 그대로다(`p_reviewed` · `p_reason` · `p_has_snapshot` · `p_page` · `p_warning_ref`). 반환 칸만 끝에 하나 는다 —
-- 반환 칸이 느는 쪽은 옛 앱에 안전하다(옛 앱은 아는 칸만 집는다, `docs/ops/runbook/deploy.md` 규약 넷의 3). 반환형이 바뀌므로
-- `create or replace` 가 안 되고 지우고 다시 세운다 — 한 마이그레이션(한 트랜잭션) 안이라 문이 없는 창은 없다.
--
-- ## 어디서 읽나 — 신고 당시의 불변 사본
--
-- `chat_report_snapshot.messages` 에서 `chosen` 이 참인 원소를 `seq` 차례로 처음 것 하나(상세 화면의 `chosenOnce` 와 같은
-- 고름). 실제 대화방 · 지금의 메시지 표는 안 읽는다(ADR 0091 · 0103). 대화 근거가 없는 신고나 고른 표시가 없는 사본은 `null`.
--
-- ## 얼마나 내나 — 첫 줄, 60자
--
-- 본문 앞뒤의 공백 · 줄바꿈을 걷고 첫 줄만, 60자를 넘으면 59자에 `…` 를 붙여 60자다. 목록은 「무슨 말이었나」를 가리는
-- 자리이고 전문은 상세가 든다 — 목록이 본문 전체를 내리지 않게 길이를 DB 가 정한다. 폰의 한 줄 말줄임은 화면이 한다.
--
-- ## 접속기록 — 그대로 한 줄
--
-- 목록 문은 이미 읽을 때마다 `reports.list` 한 줄을 같은 트랜잭션에서 적는다(ADR 0105). 그 줄은 목록이 내는 개인정보
-- (닉네임과 계정의 짝)를 이미 덮었고, 발췌도 같은 읽기의 한 칸이라 같은 줄이 덮는다. 기록에는 발췌를 안 넣는다 — 기록에는
-- 이용자 자료의 원문을 안 넣는다(ADR 0105 결정 2). 거른 조건의 모양도 한 글자 안 바꿨다.
--
-- 나머지(운영자 판정 · 거르기 · 쪽 · 정렬 · 권한)는 `20261019090000` 의 것을 한 글자도 안 바꿨다.

drop function public.operator_reports(boolean, text, boolean, integer, text);

/** 고른 메시지의 첫 줄 — 60자를 넘으면 59자와 `…`. 앞뒤 공백 · 빈 줄은 걷는다 */
create function public.report_excerpt(p_body text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when line = '' then null
    when char_length(line) > 60 then left(line, 59) || '…'
    else line
  end
  from (
    select btrim(split_part(btrim(coalesce(p_body, ''), E' \t\r\n'), E'\n', 1), E' \t\r') as line
  ) first_line
$$;

revoke execute on function public.report_excerpt(text) from public, anon, authenticated, service_role;

/**
 * `20261019090000` 의 것에 한 칸(`chosen_excerpt`)을 더했다 — 신고자가 고른 메시지의 첫 줄, 사본에서.
 * 접속기록의 줄과 거른 조건은 한 글자도 안 바꿨다.
 */
create function public.operator_reports(
  p_reviewed boolean default null,
  p_reason text default null,
  p_has_snapshot boolean default null,
  p_page integer default 0,
  p_warning_ref text default null
)
returns table (
  report_id uuid,
  created_at timestamptz,
  reason text,
  reporter_user_id uuid,
  reporter_nickname text,
  reported_user_id uuid,
  reported_nickname text,
  reviewed_at timestamptz,
  review_outcome text,
  snapshot_messages integer,
  pages integer,
  is_open boolean,
  warning_ref text,
  chosen_excerpt text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 30;
  ref constant text := upper(btrim(p_warning_ref));
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  if p_page is null or p_page < 0 then
    raise exception 'operator: page must be zero or more' using errcode = '22023';
  end if;

  perform audit.note_app_access(
    'reports.list',
    null,
    format('review=%s reason=%s evidence=%s page=%s',
           coalesce(case p_reviewed when true then 'done' when false then 'open' end, 'all'),
           coalesce(p_reason, 'all'),
           coalesce(case p_has_snapshot when true then 'chat' when false then 'none' end, 'all'),
           p_page)
      || coalesce(' ref=' || ref, ''),
    'allowed');

  return query
  select
    r.id,
    r.created_at,
    r.reason,
    r.reporter_user_id,
    reporter.nickname,
    r.reported_user_id,
    reported.nickname,
    r.reviewed_at,
    r.review_outcome,
    case when s.report_id is null then null else jsonb_array_length(s.messages) end,
    ceil(count(*) over () / page_size::numeric)::integer,
    public.report_is_open(r.reviewed_at, r.review_outcome),
    r.warning_ref,
    (select public.report_excerpt(e ->> 'body')
     from jsonb_array_elements(s.messages) e
     where coalesce((e ->> 'chosen')::boolean, false)
     order by (e ->> 'seq')::bigint
     limit 1)
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  where (p_reviewed is null or public.report_is_open(r.reviewed_at, r.review_outcome) = not p_reviewed)
    and (p_reason is null or r.reason = p_reason)
    and (p_has_snapshot is null or (s.report_id is not null) = p_has_snapshot)
    and (ref is null or r.warning_ref = ref)
  order by r.created_at desc, r.id desc
  limit page_size
  offset p_page::bigint * page_size;
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer, text)
  from anon, public, service_role;
grant execute on function public.operator_reports(boolean, text, boolean, integer, text) to authenticated;
