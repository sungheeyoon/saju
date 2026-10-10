-- 운영자 신고 목록이 **신고자가 고른 메시지의 첫 줄**을 한 줄 발췌로 내고, 접속기록이 발췌가 보인 신고 id 들을 든다
-- (화면 점검 C17, G-24 · ADR 0103 · ADR 0105 추기 2026-10-10)
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
-- ## 접속기록 — 한 줄에 발췌가 보인 신고 id 들 (운영자 결정 2026-10-10, ADR 0105 추기)
--
-- 목록 문은 읽을 때마다 `reports.list` 한 줄을 같은 트랜잭션에서 적는다(ADR 0105) — 그 줄은 거른 조건과 쪽만 들고 신고 id 가
-- 없다. 발췌는 메시지 본문이다. 지금까지 본문을 읽으면 늘 신고 id 가 붙은 `reports.snapshot` 줄이 남았는데, 발췌가 그 길을
-- 비켜 가지 않게 **그 줄에 이 쪽에서 발췌가 보인 신고 id 들을 함께 적는다** — 새 칸 `target_report_ids uuid[]`(쪽 차례).
-- 발췌가 하나도 안 보인 쪽이면 비운다(`null`). 줄은 여전히 한 줄이다 — 신고마다 줄을 적으면 목록 한 번이 서른 줄이 된다.
--
-- 그러려면 쪽을 다 읽은 **뒤에** 적어야 한다. 그래서 목록 문은 줄을 하나씩 내며 id 를 모으고 끝에서 적는다 — 같은
-- 트랜잭션이라 적지 못하면 읽은 것도 되감긴다(전과 같다). 기록에 발췌(본문)는 안 넣는다(ADR 0105 결정 2) — id 뿐이다.
--
-- 적는 손 `audit.note_app_access` 는 다섯째 인자(`p_report_ids`, 기본 `null`)를 받는다 — 네 인자로 부르던 자리(설문 문 일곱 ·
-- 상세 · 스냅샷 · 거절 · 반출 상태)는 한 글자도 안 바꿨다. 반출 문 `audit_export_batch` 는 이 칸을 함께 낸다 — 반출 파일은
-- `version` 3 이 된다(`app/api/cron/audit-export/bundle.ts`).
--
-- 나머지(운영자 판정 · 거르기 · 쪽 · 정렬 · 권한)는 `20261019090000` 의 것을 한 글자도 안 바꿨다.

-- ── 접속기록의 새 칸 ───────────────────────────────────────────────────────────

alter table audit.operator_access
  add column target_report_ids uuid[];

alter table audit.operator_access add constraint list_names_the_reports_it_showed check (
  target_report_ids is null
  or (action = 'reports.list' and cardinality(target_report_ids) between 1 and 30
      and array_position(target_report_ids, null) is null));

comment on column audit.operator_access.target_report_ids is
  'reports.list 이면 그 쪽에서 고른 메시지의 발췌가 보인 신고 id 들(쪽 차례). 발췌가 없던 쪽이면 null';

drop function audit.note_app_access(text, uuid, text, text);

/** `20261010100000` 의 것에 다섯째 인자(`p_report_ids`)를 더했다 — 네 인자로 부르는 자리는 그대로다 */
create function audit.note_app_access(
  p_action text,
  p_report_id uuid,
  p_filter text,
  p_outcome text,
  p_report_ids uuid[] default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into audit.operator_access
    (channel, actor_user_id, action, target_report_id, filter_summary, outcome, target_report_ids)
  values ('app', (select auth.uid()), p_action, p_report_id, p_filter, p_outcome, p_report_ids)
$$;

revoke execute on function audit.note_app_access(text, uuid, text, text, uuid[])
  from public, anon, authenticated, service_role;

-- 반출 문 — 칸 하나가 는다. 본문은 `20261014090000` 의 살아 있는 정의 그대로(자물쇠 · 격리 확인)
drop function public.audit_export_batch(integer);

/**
 * 지난 반출 뒤의 줄을 번호 차례로 — **배타 자물쇠를 잡은 뒤에** 읽는다(`20261013090000`). `20261014090000` 의 칸에
 * 목록이 보인 신고 id 들(`target_report_ids`)을 더했다. `service_role` 만 부른다(크론 라우트의 열쇠).
 */
create function public.audit_export_batch(p_limit integer default 5000)
returns table (
  id bigint,
  at timestamptz,
  channel text,
  actor_user_id uuid,
  actor_name text,
  action text,
  target_report_id uuid,
  filter_summary text,
  purpose text,
  sql_sha256 text,
  outcome text,
  result_of bigint,
  result text,
  error_class text,
  after_id bigint,
  target_report_ids uuid[]
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'audit: export reads under read committed only' using errcode = '55000';
  end if;

  perform pg_advisory_xact_lock(audit.export_lock_key());

  return query
  with last_export as (
    select coalesce(max(e.last_id), 0) as after_id from audit.operator_access_export e
  )
  select a.id, a.at, a.channel, a.actor_user_id, a.actor_name, a.action, a.target_report_id,
         a.filter_summary, a.purpose, a.sql_sha256, a.outcome, a.result_of, a.result, a.error_class, l.after_id,
         a.target_report_ids
  from audit.operator_access a, last_export l
  where a.id > l.after_id
  order by a.id
  limit least(greatest(coalesce(p_limit, 5000), 1), 50000);
end;
$$;

revoke execute on function public.audit_export_batch(integer) from public, anon, authenticated, service_role;
grant execute on function public.audit_export_batch(integer) to service_role;

-- ── 목록 문 ───────────────────────────────────────────────────────────────────

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
 * 접속기록은 여전히 한 줄이고 거른 조건의 모양도 같다. 다만 쪽을 다 읽은 **뒤에** 적고, 발췌가 보인 신고 id 들을 함께 적는다.
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
  line record;
  shown uuid[] := '{}';
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  if p_page is null or p_page < 0 then
    raise exception 'operator: page must be zero or more' using errcode = '22023';
  end if;

  for line in
    select
      r.id,
      r.created_at,
      r.reason,
      r.reporter_user_id,
      reporter.nickname as reporter_nickname,
      r.reported_user_id,
      reported.nickname as reported_nickname,
      r.reviewed_at,
      r.review_outcome,
      case when s.report_id is null then null else jsonb_array_length(s.messages) end as snapshot_messages,
      ceil(count(*) over () / page_size::numeric)::integer as pages,
      public.report_is_open(r.reviewed_at, r.review_outcome) as is_open,
      r.warning_ref,
      (select public.report_excerpt(e ->> 'body')
       from jsonb_array_elements(s.messages) e
       where coalesce((e ->> 'chosen')::boolean, false)
       order by (e ->> 'seq')::bigint
       limit 1) as chosen_excerpt
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
    offset p_page::bigint * page_size
  loop
    report_id := line.id;
    created_at := line.created_at;
    reason := line.reason;
    reporter_user_id := line.reporter_user_id;
    reporter_nickname := line.reporter_nickname;
    reported_user_id := line.reported_user_id;
    reported_nickname := line.reported_nickname;
    reviewed_at := line.reviewed_at;
    review_outcome := line.review_outcome;
    snapshot_messages := line.snapshot_messages;
    pages := line.pages;
    is_open := line.is_open;
    warning_ref := line.warning_ref;
    chosen_excerpt := line.chosen_excerpt;
    if line.chosen_excerpt is not null then
      shown := shown || line.id;
    end if;
    return next;
  end loop;

  /** 쪽을 다 읽은 뒤에 한 줄 — 발췌가 보인 신고 id 들과 함께. 같은 트랜잭션이라 못 적으면 읽은 것도 되감긴다 */
  perform audit.note_app_access(
    'reports.list',
    null,
    format('review=%s reason=%s evidence=%s page=%s',
           coalesce(case p_reviewed when true then 'done' when false then 'open' end, 'all'),
           coalesce(p_reason, 'all'),
           coalesce(case p_has_snapshot when true then 'chat' when false then 'none' end, 'all'),
           p_page)
      || coalesce(' ref=' || ref, ''),
    'allowed',
    nullif(shown, '{}'));
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer, text)
  from anon, public, service_role;
grant execute on function public.operator_reports(boolean, text, boolean, integer, text) to authenticated;
