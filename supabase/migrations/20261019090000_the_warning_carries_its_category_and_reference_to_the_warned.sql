-- 경고가 **갈래 · 안내번호**를 들고 경고받은 사람에게 선다 (ADR 0108, G-57)
--
-- 2026-09-24 에 잰 값: 경고가 적히는 자리는 `review_outcome = 'warning'` 과 `sanctioned_user_id` 뿐이었다. 경고 자체의
-- 갈래 칸이 없어 이용자에게 무엇을 말할지 신고한 사람이 고른 사유(`reason`)밖에 없었고, 이용자가 제 경고를 읽는 문도
-- 확인했다는 기록도 없었다 — 경고는 운영자 기록일 뿐이었다. 이의 제기 메일을 받아도 계정을 찾는 길이 닉네임과 날짜로
-- 눈으로 찾는 것뿐이었다(보낸 주소로 찾는 것은 break-glass 다, ADR 0105). 같은 날 운영 DB 의 두 표는 0줄이었다.
--
-- ## 칸 다섯 — 두 표에 같이
--
--   warning_category         운영자가 경고에 붙인 갈래 — 신고 사유와 같은 넷. 고르지 않으면 신고 사유가 기본값이다.
--                            경고일 때만 있고 경고가 아니면 없다(`warning_category_follows_the_outcome`)
--   warning_ref              안내번호 `W-` + 네 글자. 헷갈리는 글자(0 · 1 · I · L · O · U)를 뺀 서른 글자에서 뽑는다.
--                            처음 경고로 적힐 때 한 번 붙고, 결과가 바뀌어도(이의 제기 인정) 남는다 — 운영자가 그 번호로
--                            나중에도 찾는다. 표마다 유일하고, 뽑을 때 두 표를 함께 본다
--   warning_acknowledged_at  이용자가 「확인했습니다」를 누른 때 — 이용자가 적는 칸은 이것 하나다
--   warning_emailed_at       이메일을 보낸(보내려 한) 때 — G-26 의 발송 잡이 적는다. **지금은 아무것도 안 보낸다**
--   warning_email_result     sent · failed — 위와 짝이다
--
-- 떠난 사람의 신고(`retention.report`)에도 같은 칸 · 같은 제약을 둔다 — 옮기는 트리거가 베끼고, 셈(runbook)과 안내번호
-- 찾기가 두 표를 함께 본다. 검토 문이 다시 적을 수 있게 불변 검사의 고칠 수 있는 칸에 다섯을 더한다.
--
-- ## 결과가 경고로 **들어올 때** 확인 · 발송이 비워진다
--
-- 경고가 아니던 줄이 경고가 되면(처음이든, 이의 제기 인정 뒤 다시든) 새 안내다 — 확인 시각과 발송 결과를 비운다. 경고를
-- 경고로 다시 적으면(갈래를 고치는 것) 둘 다 그대로 둔다. 경고에서 나가면(조치 없음 등) 갈래만 비우고 둘은 그때의 기록으로
-- 남는다 — 이용자 문은 결과가 경고인 줄만 보므로 안내는 그 자리에서 사라진다.
--
-- ## 이용자의 문 둘 — 안내번호 · 갈래 · 날짜뿐
--
-- `my_warning_notice()` 는 내가 제재 대상이고 결과가 경고이며 아직 확인하지 않은 줄 중 **가장 오래된 하나**를 낸다 —
-- 안내번호 · 갈래 · 경고한 날(한국 날짜). 판단 근거 · 신고한 사람 · 신고 id · 신고 시각 · 고른 메시지 · 경고 수는 내지
-- 않는다. 계정이 `active` 가 아니면(이용 정지 · 탈퇴 대기) 아무것도 안 낸다 — 정지된 계정은 제 상태만 본다(PRD 의 계정 상태).
-- **읽는 표는 `public.report` 하나다.** 신고한 사람이 떠나 `retention.report` 로 옮겨진 경고는 이용자에게 안 선다 — 그 스키마는
-- 떨어져 있는 보관이라 앱이 읽는 길을 내지 않는다(ADR 0098). 셈에는 그대로 든다.
--
-- `acknowledge_warning(p_ref)` 은 내 경고 · 결과가 경고 · 아직 확인 전인 줄에만 확인 시각을 적는다. 이미 확인했거나 남의
-- 번호면 아무것도 안 하고 `false` — 무엇이 없었는지 가르지 않는다(남의 번호가 있는지를 알려 주지 않는다).
--
-- ## 검토 문 — 갈래 인자
--
-- `review_report` 에 `p_warning_category` 를 더한다(기본 `null`). 경고가 아닌데 갈래를 주면 `22023`. 인자가 늘어 옛 판을
-- 걷고 다시 짓는다 — 옛 다섯 인자 호출은 그대로 된다. 부르는 것은 운영자 CLI 뿐이다(앱은 안 부른다).
--
-- ## 운영자 목록 · 상세
--
-- 목록 문에 안내번호로 찾는 인자(`p_warning_ref`, 기본 `null`)와 줄마다 안내번호를 더한다. 상세는 안내번호 · 갈래 · 이용자가
-- 확인한 때를 더 낸다. 반환 칸이 느는 것과 기본값이 있는 인자는 옛 앱에 안전하다 — 옛 앱은 이름 붙인 인자 넷으로 부른다.
-- 접속기록의 거른 조건은 안내번호로 찾을 때만 끝에 ` ref=…` 가 붙는다.

-- ── 칸 ──────────────────────────────────────────────────────────────────────

alter table public.report
  add column warning_category text
    check (warning_category in ('harassment', 'impersonation', 'inappropriate', 'other')),
  add column warning_ref text
    constraint warning_ref_shape check (warning_ref ~ '^W-[2-9A-HJKMNP-TV-Z]{4}$'),
  add column warning_acknowledged_at timestamptz,
  add column warning_emailed_at timestamptz,
  add column warning_email_result text check (warning_email_result in ('sent', 'failed')),
  add constraint warning_ref_is_unique unique (warning_ref),
  add constraint warning_category_follows_the_outcome
    check ((review_outcome is not distinct from 'warning') = (warning_category is not null)),
  add constraint warning_has_a_ref
    check (review_outcome is distinct from 'warning' or warning_ref is not null),
  add constraint warning_notice_needs_a_ref
    check (warning_ref is not null or (warning_acknowledged_at is null and warning_emailed_at is null)),
  add constraint warning_email_has_a_result
    check ((warning_emailed_at is null) = (warning_email_result is null));

comment on column public.report.warning_category is
  '경고의 갈래 — 운영자가 붙인 값, 기본은 신고 사유. 경고일 때만 있다. 이용자에게 이것만 간다 (ADR 0108)';
comment on column public.report.warning_ref is
  '안내번호 W-XXXX — 안내와 이메일에 싣고 운영자가 이것으로 찾는다. 처음 경고일 때 붙고 남는다 (ADR 0108)';
comment on column public.report.warning_acknowledged_at is
  '이용자가 경고 안내를 확인한 때 — acknowledge_warning 만 적는다 (ADR 0108)';
comment on column public.report.warning_emailed_at is
  '경고 이메일을 보낸(보내려 한) 때 — G-26 의 발송 잡이 적는다. 그 전에는 비어 있다 (ADR 0108)';

alter table retention.report
  add column warning_category text
    check (warning_category in ('harassment', 'impersonation', 'inappropriate', 'other')),
  add column warning_ref text
    constraint warning_ref_shape check (warning_ref ~ '^W-[2-9A-HJKMNP-TV-Z]{4}$'),
  add column warning_acknowledged_at timestamptz,
  add column warning_emailed_at timestamptz,
  add column warning_email_result text check (warning_email_result in ('sent', 'failed')),
  add constraint warning_ref_is_unique unique (warning_ref),
  add constraint warning_category_follows_the_outcome
    check ((review_outcome is not distinct from 'warning') = (warning_category is not null)),
  add constraint warning_has_a_ref
    check (review_outcome is distinct from 'warning' or warning_ref is not null),
  add constraint warning_notice_needs_a_ref
    check (warning_ref is not null or (warning_acknowledged_at is null and warning_emailed_at is null)),
  add constraint warning_email_has_a_result
    check ((warning_emailed_at is null) = (warning_email_result is null));

/** 내 안 읽은 경고를 찾는 자리 — 경고받은 사람 · 확인 전만 */
create index report_unacknowledged_warning on public.report (sanctioned_user_id, reviewed_at)
  where review_outcome = 'warning' and warning_acknowledged_at is null;

-- ── 안내번호 ────────────────────────────────────────────────────────────────

/**
 * 새 안내번호 — `W-` + 네 글자(30⁴ = 81만). 헷갈리는 0 · 1 · I · L · O · U 를 뺐다. 두 표에 없는 것이 나올 때까지 뽑고,
 * 스무 번 안에 못 찾으면 던진다. 동시에 같은 번호를 뽑는 드문 경합은 표의 유일 제약이 `23505` 로 막는다.
 */
create function public.new_warning_ref()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  letters constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  ref text;
begin
  for attempt in 1..20 loop
    ref := 'W-' || (
      select string_agg(substr(letters, 1 + floor(random() * length(letters))::integer, 1), '')
      from generate_series(1, 4));
    if not exists (select 1 from public.report r where r.warning_ref = ref)
       and not exists (select 1 from retention.report k where k.warning_ref = ref) then
      return ref;
    end if;
  end loop;
  raise exception 'warning: no free reference' using errcode = '23505';
end;
$$;

revoke execute on function public.new_warning_ref() from public, anon, authenticated, service_role;

-- ── 옮길 때 · 고칠 수 있는 칸 ──────────────────────────────────────────────────

/** `20261010090000` 의 것에 경고의 칸 다섯을 더했다 — 나머지는 한 글자도 안 바꿨다 */
create or replace function retention.refuse_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mutable constant text[] := array[
    'reviewed_at', 'reviewed_by', 'review_outcome', 'review_note', 'sanctioned_user_id', 'sanctioned_by',
    'warning_category', 'warning_ref', 'warning_acknowledged_at', 'warning_emailed_at', 'warning_email_result',
    'reporter_left_at', 'reported_left_at', 'hold_reason', 'held_at'];
begin
  if (to_jsonb(new) - mutable) is distinct from (to_jsonb(old) - mutable)
     or (old.reporter_left_at is not null and new.reporter_left_at is distinct from old.reporter_left_at)
     or (old.reported_left_at is not null and new.reported_left_at is distinct from old.reported_left_at)
  then
    raise exception 'retention: the retained report is immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

/** `20261010090000` 의 것에 경고의 칸 다섯을 더해 베낀다 — 나머지는 한 글자도 안 바꿨다 */
create or replace function retention.keep_reports_of_leaver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into retention.report (
    report_id, reason, detail, reported_at, reviewed_at, snapshot,
    reporter_user_id, reported_user_id,
    reporter_email, reported_email,
    reporter_joined_at, reported_joined_at,
    reporter_left_at, reported_left_at,
    reviewed_by, review_outcome, review_note, sanctioned_user_id, sanctioned_by,
    warning_category, warning_ref, warning_acknowledged_at, warning_emailed_at, warning_email_result)
  select
    r.id, r.reason, r.detail, r.created_at, r.reviewed_at,
    case when s.report_id is not null then jsonb_build_object(
      'match_id', s.match_id,
      'message_id', s.message_id,
      'context_before', s.context_before,
      'context_after', s.context_after,
      'messages', s.messages,
      'captured_at', s.captured_at) end,
    r.reporter_user_id, r.reported_user_id,
    reporter.email, reported.email,
    reporter.created_at, reported.created_at,
    case when r.reporter_user_id = old.id then now() end,
    case when r.reported_user_id = old.id then now() end,
    r.reviewed_by, r.review_outcome, r.review_note, r.sanctioned_user_id, r.sanctioned_by,
    r.warning_category, r.warning_ref, r.warning_acknowledged_at, r.warning_emailed_at, r.warning_email_result
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join auth.users reporter on reporter.id = r.reporter_user_id
  left join auth.users reported on reported.id = r.reported_user_id
  where old.id in (r.reporter_user_id, r.reported_user_id)
  on conflict (report_id) do nothing;

  -- 이미 옮겨 둔 신고의 남은 쪽이 이제 떠난다 — 탈퇴일만 채우고 시계는 안 옮긴다
  update retention.report k set reporter_left_at = now()
  where k.reporter_user_id = old.id and k.reporter_left_at is null;

  update retention.report k set reported_left_at = now()
  where k.reported_user_id = old.id and k.reported_left_at is null;

  return old;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

-- ── 검토 문 — 갈래 인자 ──────────────────────────────────────────────────────

drop function public.review_report(uuid, uuid, text, text, uuid);

/**
 * 신고 한 건의 검토를 적는다 — `20261016090000` 의 것에 경고의 갈래와 안내번호를 더했다(ADR 0108). 나머지 걸음(운영자인가 ·
 * 결과 · 두 표 · 이용 정지 결정의 한 트랜잭션)은 그대로다.
 *
 * 경고면 갈래는 인자 · 없으면 신고 사유이고, 안내번호는 없을 때만 새로 뽑는다. 경고가 아닌데 갈래를 주면 `22023`.
 *
 * @returns 적은 표 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고)
 */
create function public.review_report(
  p_report_id uuid,
  p_reviewer uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid default null,
  p_warning_category text default null
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  written text;
  warning constant boolean := p_outcome is not distinct from 'warning';
begin
  if p_reviewer is null or not exists (select 1 from public.operator o where o.user_id = p_reviewer) then
    raise exception 'review: the reviewer is not an operator' using errcode = '42501';
  end if;

  if p_outcome is null then
    raise exception 'review: an outcome is required' using errcode = '22023';
  end if;

  if p_warning_category is not null and not warning then
    raise exception 'review: a category goes with a warning only' using errcode = '22023';
  end if;

  update public.report r
  set reviewed_at = now(),
      reviewed_by = p_reviewer,
      review_outcome = p_outcome,
      review_note = p_note,
      sanctioned_user_id = p_sanctioned_user_id,
      sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end,
      warning_category = case when warning then coalesce(p_warning_category, r.reason) end,
      warning_ref = case when warning then coalesce(r.warning_ref, public.new_warning_ref()) else r.warning_ref end,
      -- 경고로 **들어오면** 새 안내다 — 확인과 발송을 비운다. 경고를 경고로 다시 적거나 경고에서 나가면 그대로 둔다
      warning_acknowledged_at = case when warning and r.review_outcome is distinct from 'warning' then null
                                     else r.warning_acknowledged_at end,
      warning_emailed_at = case when warning and r.review_outcome is distinct from 'warning' then null
                                else r.warning_emailed_at end,
      warning_email_result = case when warning and r.review_outcome is distinct from 'warning' then null
                                  else r.warning_email_result end
  where r.id = p_report_id;

  if found then
    written := 'report';
  else
    update retention.report k
    set reviewed_at = now(),
        reviewed_by = p_reviewer,
        review_outcome = p_outcome,
        review_note = p_note,
        sanctioned_user_id = p_sanctioned_user_id,
        sanctioned_by = case when p_sanctioned_user_id is not null then p_reviewer end,
        warning_category = case when warning then coalesce(p_warning_category, k.reason) end,
        warning_ref = case when warning then coalesce(k.warning_ref, public.new_warning_ref()) else k.warning_ref end,
        warning_acknowledged_at = case when warning and k.review_outcome is distinct from 'warning' then null
                                       else k.warning_acknowledged_at end,
        warning_emailed_at = case when warning and k.review_outcome is distinct from 'warning' then null
                                  else k.warning_emailed_at end,
        warning_email_result = case when warning and k.review_outcome is distinct from 'warning' then null
                                    else k.warning_email_result end
    where k.report_id = p_report_id;

    if not found then
      raise exception 'review: no such report' using errcode = 'P0002';
    end if;
    written := 'retention';
  end if;

  -- 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 — 여기서 실패하면 위의 기록도 되감긴다
  if p_outcome = 'suspension' then
    update public.app_user a set status = 'suspended' where a.id = p_sanctioned_user_id;
    if not found then
      raise exception 'review: the sanctioned account is gone' using errcode = 'P0002';
    end if;
  end if;

  return written;
end;
$$;

comment on function public.review_report(uuid, uuid, text, text, uuid, text) is
  '신고 검토를 적는 문 하나 — 운영자 CLI 만. 경고면 갈래(기본 신고 사유)와 안내번호가 붙는다 (ADR 0107 · 0108)';

revoke execute on function public.review_report(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated, service_role;

-- ── 이용자의 문 둘 ───────────────────────────────────────────────────────────

/**
 * 내가 아직 확인하지 않은 경고 하나 — 가장 오래된 것부터. 안내번호 · 갈래 · 경고한 날(한국 날짜)만 낸다.
 * 계정이 `active` 가 아니면 비어 있다. 떠난 사람의 신고로 옮겨진 경고는 안 읽는다(머리말).
 */
create function public.my_warning_notice()
returns table (
  warning_ref text,
  category text,
  warned_on date
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.warning_ref, r.warning_category, (r.reviewed_at at time zone 'Asia/Seoul')::date
  from public.report r
  join public.app_user a on a.id = r.sanctioned_user_id
  where r.sanctioned_user_id = auth.uid()
    and a.status = 'active'
    and r.review_outcome = 'warning'
    and r.warning_acknowledged_at is null
  order by r.reviewed_at, r.id
  limit 1
$$;

/**
 * 경고 안내를 확인했다고 적는다 — 내 경고 · 결과가 경고 · 확인 전인 줄만.
 *
 * @returns 이번에 적었는가. 이미 확인했거나 내 번호가 아니면 `false` — 둘을 가르지 않는다
 */
create function public.acknowledge_warning(p_ref text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'warning: sign in first' using errcode = '42501';
  end if;

  update public.report r
  set warning_acknowledged_at = now()
  where r.warning_ref = p_ref
    and r.sanctioned_user_id = auth.uid()
    and r.review_outcome = 'warning'
    and r.warning_acknowledged_at is null;

  return found;
end;
$$;

revoke execute on function public.my_warning_notice() from public, anon, service_role;
revoke execute on function public.acknowledge_warning(text) from public, anon, service_role;
grant execute on function public.my_warning_notice() to authenticated;
grant execute on function public.acknowledge_warning(text) to authenticated;

-- ── 운영자 문 둘 — 안내번호 ──────────────────────────────────────────────────

drop function public.operator_reports(boolean, text, boolean, integer);
drop function public.operator_report(uuid);

/**
 * `20261016090000` 의 것에 두 자리를 더했다 — 안내번호로 찾는 인자(`p_warning_ref`, 대문자로 견준다)와 줄마다 안내번호.
 * 접속기록의 거른 조건은 안내번호로 찾을 때만 ` ref=…` 가 붙는다 — 나머지는 한 글자도 안 바꿨다.
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
  warning_ref text
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
    r.warning_ref
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

/** `20261016090000` 의 것에 경고의 세 칸(안내번호 · 갈래 · 이용자가 확인한 때)을 더했다 — 나머지는 한 글자도 안 바꿨다 */
create function public.operator_report(p_report_id uuid)
returns table (
  report_id uuid,
  created_at timestamptz,
  reason text,
  detail text,
  reporter_user_id uuid,
  reporter_nickname text,
  reporter_status text,
  reported_user_id uuid,
  reported_nickname text,
  reported_status text,
  reviewed_at timestamptz,
  reviewer_nickname text,
  review_outcome text,
  review_note text,
  sanctioned_side text,
  captured_at timestamptz,
  context_before integer,
  context_after integer,
  is_open boolean,
  warning_ref text,
  warning_category text,
  warning_acknowledged_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  perform audit.note_app_access('reports.detail', p_report_id, null, 'allowed');

  return query
  select
    r.id,
    r.created_at,
    r.reason,
    r.detail,
    r.reporter_user_id,
    reporter.nickname,
    reporter.status,
    r.reported_user_id,
    reported.nickname,
    reported.status,
    r.reviewed_at,
    reviewer.nickname,
    r.review_outcome,
    r.review_note,
    case r.sanctioned_user_id
      when r.reporter_user_id then 'reporter'
      when r.reported_user_id then 'reported'
    end,
    s.captured_at,
    s.context_before,
    s.context_after,
    public.report_is_open(r.reviewed_at, r.review_outcome),
    r.warning_ref,
    r.warning_category,
    r.warning_acknowledged_at
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  left join public.app_user reviewer on reviewer.id = r.reviewed_by
  where r.id = p_report_id;
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer, text)
  from anon, public, service_role;
revoke execute on function public.operator_report(uuid) from anon, public, service_role;

grant execute on function public.operator_reports(boolean, text, boolean, integer, text) to authenticated;
grant execute on function public.operator_report(uuid) to authenticated;
