-- 운영자의 거절된 쓰기도 접속기록에 남고, 경고의 12개월은 처음 경고한 날부터 세며, 탈퇴 대기 계정에는 무상 지급을 받지 않고,
-- 지급 장부의 합을 매일 잰다 (G-111 R-4 · R-6 · R-7 · R-8, ADR 0191)
--
-- #738 검수가 남긴 결정 거리(`docs/product/gaps/records/g-111.md` 「검수에서 남긴 결정 거리」)를 운영자가 2026-10-17 에 정했다.
-- 이 마이그레이션이 세우는 것:
--
-- 1. **거절된 쓰기 한 줄**(R-4) — 접속기록의 결과 칸이 `refused` 를 받는다. 운영자의 쓰기 문(처분 · 정지 · 해제 · 지급 · 회수 ·
--    환불 세 걸음)이 버전 충돌 · 상태 거절 · 모양 오류로 거절되면 그 트랜잭션의 기록은 되감기므로, 앱이 거절을 받은 뒤 제 트랜잭션에서
--    `note_operator_refusal` 로 한 줄을 적는다 — 거른 조건 칸에 대상 id 와 `refused=<SQLSTATE>` 만. 메모 · 판단 근거는 적지 않는다.
--    운영자가 아닌 사람의 거절(`42501`)은 지금처럼 `note_operator_denial` 의 `denied` 다. **반출 묶음의 칸은 그대로다** — 값 하나가
--    늘 뿐이라 머리의 `version` 은 3 그대로다(`docs/ops/runbook/security.md` 「반출」).
-- 2. **경고한 때**(R-6) — 신고 행에 `warned_at`. 결과가 경고로 **들어올 때**와 경고의 **대상이 바뀔 때** 지금으로 적고, 같은 사람의
--    경고를 다시 적거나 갈래만 고치면 그대로 둔다. 경고에서 나가면 비운다. 12개월 경고 셈 · 이용자 안내의 「경고한 날」이 이 칸을
--    읽는다 — 전에는 다시 적을 때마다 지금이 되는 `reviewed_at` 을 읽어 갈래만 고쳐도 셈에 1년이 더 남았다. 지금 있는 경고는 처분
--    이력에서 지금 결과로 이어진 경고 줄들 가운데 첫 줄의 시각으로 채운다.
-- 3. **탈퇴 대기에는 지급하지 않는다**(R-7) — 공통 함수(`book_reading_credit_grant`)가 새 지급을 `23514` 로 거절한다. 회수와 정지된
--    계정의 지급(보상)은 그대로 받는다. 같은 요청의 재시도는 지금처럼 첫 결과를 돌려준다.
-- 4. **지급 장부의 대조**(R-8) — 크론 `credit-grant-watch`(매일)가 계정마다 `Σ 장부 = reading_credit_grant.extra` 를 재서 어긋난
--    계정마다 `notify_ops` 한 줄(종류 `credit-grant-mismatch:<계정 id>`, 하루 한 번). 아무것도 고치지 않는다.
--
-- ## 바꾸지 않는 것
--
-- - `reviewed_at` 은 그대로 「운영자가 마지막으로 본 시각」이다 — 처리 필요 · 목록 · 상세가 읽는다.
-- - 처분 이력 · 대상 요약의 서명과 칸, 쓰는 순서(무료 → 운영 지급 → 먼저 산 묶음, R-9 는 코드 변경 없음).
-- - 상태 바뀜 트리거(R-3 은 문서만 — 직접 UPDATE 도 이미 이력 줄과 알림을 남긴다, `99_operator_report_review`).
--
-- 재는 자리는 `supabase/tests/99_operator_write_refusals.test.sql` · `99_warning_clock.test.sql` ·
-- `99_credit_grant_watch.test.sql`.

-- ---------------------------------------------------------------------------
-- 1. 거절된 쓰기 — 결과 칸의 셋째 값과 그것을 적는 문
-- ---------------------------------------------------------------------------

alter table audit.operator_access drop constraint operator_access_outcome_check;
alter table audit.operator_access add constraint operator_access_outcome_check
  check (outcome in ('allowed', 'denied', 'refused'));

/** `refused` 는 앱의 운영자 쓰기에만 — 거른 조건 칸이 `refused=<코드>` 로 끝난다 */
alter table audit.operator_access add constraint refused_is_an_operator_write check (
  outcome <> 'refused'
  or (channel = 'app'
      and action in ('reports.review', 'members.suspend', 'members.unsuspend', 'credits.grant', 'credits.revoke',
                     'credits.refund_hold', 'credits.refund_book', 'credits.refund_release')
      and filter_summary ~ '(^| )refused=([0-9A-Z]{5}|other)$'));

/**
 * 운영자의 쓰기가 거절됐다고 한 줄 적는다 — 앱의 쓰기 액션이 거절을 받은 뒤 부른다. 거절한 트랜잭션의 기록은 되감기므로 따로다.
 *
 * 운영자가 아니면 아무것도 안 적는다(그 거절은 `note_operator_denial` 이 `denied` 로 적는다). 대상은 id 만 — 신고는 신고 id 칸,
 * 계정 · 주문은 거른 조건 칸(`user=<id>` · `order=<id>`)이고, 끝에 `refused=<SQLSTATE>`(모르는 코드면 `other`). 메모 · 판단 근거 ·
 * 오류 문장은 받지 않는다. 한 사람이 한 시간에 서른 줄을 넘게 적지 못한다 — 넘으면 조용히 끝난다(`note_operator_denial` 과 같은 까닭).
 *
 * @param p_code 거절의 SQLSTATE(`55000` · `23514` · `22023` · `P0002` …) 또는 `other`
 */
create function public.note_operator_refusal(
  p_action text,
  p_code text,
  p_report_id uuid default null,
  p_user_id uuid default null,
  p_order_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not public.is_operator() then
    return;
  end if;

  if p_action is null
     or p_action not in ('reports.review', 'members.suspend', 'members.unsuspend', 'credits.grant', 'credits.revoke',
                         'credits.refund_hold', 'credits.refund_book', 'credits.refund_release') then
    raise exception 'operator: unknown write' using errcode = '22023';
  end if;

  if p_code is null or p_code !~ '^([0-9A-Z]{5}|other)$' or p_code = '42501' then
    raise exception 'operator: a refusal code is a SQLSTATE other than 42501' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('audit:refusal:' || actor::text, 0));

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'refused'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    return;
  end if;

  perform audit.note_app_access(
    p_action, p_report_id,
    concat_ws(' ', 'user=' || p_user_id::text, 'order=' || p_order_id::text, 'refused=' || p_code),
    'refused');
end;
$$;

revoke execute on function public.note_operator_refusal(text, text, uuid, uuid, uuid) from anon, public, service_role;
grant execute on function public.note_operator_refusal(text, text, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 경고한 때 — 칸 · 옮김 · 채우기
-- ---------------------------------------------------------------------------

alter table public.report add column warned_at timestamptz;
alter table retention.report add column warned_at timestamptz;

comment on column public.report.warned_at is
  '이 경고가 지금 대상에게 처음 적힌 때 — 12개월 경고 셈의 기준. 같은 경고를 다시 적어도 안 바뀐다 (G-111 R-6, ADR 0191)';
comment on column retention.report.warned_at is
  '이 경고가 지금 대상에게 처음 적힌 때 — 12개월 경고 셈의 기준 (G-111 R-6, ADR 0191)';

create index report_warning_by_date on public.report (sanctioned_user_id, warned_at) where review_outcome = 'warning';

/** `20261019090000` 의 것에 경고한 때를 더했다 — 나머지는 한 글자도 안 바꿨다 */
create or replace function retention.refuse_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mutable constant text[] := array[
    'reviewed_at', 'reviewed_by', 'review_outcome', 'review_note', 'sanctioned_user_id', 'sanctioned_by',
    'warning_category', 'warning_ref', 'warning_acknowledged_at', 'warning_emailed_at', 'warning_email_result',
    'warned_at',
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

/** `20261019090000` 의 것에 경고한 때를 더해 베낀다 — 나머지는 한 글자도 안 바꿨다 */
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
    warning_category, warning_ref, warning_acknowledged_at, warning_emailed_at, warning_email_result,
    warned_at)
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
    r.warning_category, r.warning_ref, r.warning_acknowledged_at, r.warning_emailed_at, r.warning_email_result,
    r.warned_at
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

-- 채우기는 보관 표의 트리거가 새 칸을 받은 뒤다 — 앞이면 보관 표의 UPDATE 가 「고칠 수 없는 칸」으로 선다
-- 채우기 — 처분 이력에서 지금 결과로 이어진 경고 줄(같은 대상)의 첫 시각. 끊긴 자리(경고가 아니거나 대상이 다른 줄) 뒤부터 센다
with run as (
  select w.id as report_id, w.sanctioned_user_id from public.report w where w.review_outcome = 'warning'
),
first_warned as (
  select run.report_id,
         (select min(e.at) from public.report_review_entry e
          where e.report_id = run.report_id
            and e.version > coalesce((
              select max(b.version) from public.report_review_entry b
              where b.report_id = run.report_id
                and (b.outcome is distinct from 'warning' or b.sanctioned_user_id is distinct from run.sanctioned_user_id)), 0))
           as at
  from run
)
update public.report r
set warned_at = coalesce(f.at, r.reviewed_at)
from first_warned f
where f.report_id = r.id;

with run as (
  select k.report_id, k.sanctioned_user_id from retention.report k where k.review_outcome = 'warning'
),
first_warned as (
  select run.report_id,
         (select min(e.at) from public.report_review_entry e
          where e.report_id = run.report_id
            and e.version > coalesce((
              select max(b.version) from public.report_review_entry b
              where b.report_id = run.report_id
                and (b.outcome is distinct from 'warning' or b.sanctioned_user_id is distinct from run.sanctioned_user_id)), 0))
           as at
  from run
)
update retention.report k
set warned_at = coalesce(f.at, k.reviewed_at)
from first_warned f
where f.report_id = k.report_id;

alter table public.report add constraint warning_has_its_date
  check ((review_outcome is not distinct from 'warning') = (warned_at is not null));
alter table retention.report add constraint warning_has_its_date
  check ((review_outcome is not distinct from 'warning') = (warned_at is not null));


-- ---------------------------------------------------------------------------
-- 3. 처분의 공통 함수 — `20261215090000` 의 몸에 경고한 때 한 칸만 더했다
-- ---------------------------------------------------------------------------

/**
 * 처분 한 번을 적는다 — 화면의 문(`operator_review_report`)과 런북의 검토 문(`review_report`)이 이것 하나를 지난다.
 * `20261215090000` 의 것과 걸음 · 거절이 같고, **경고한 때**(`warned_at`)만 더했다(ADR 0191):
 *
 * - 결과가 경고로 들어오거나(앞 결과가 경고가 아님) 경고의 대상이 바뀌면 지금 — 옮긴 사람에게는 옮긴 날이 경고받은 날이다
 * - 같은 대상의 경고를 다시 적거나 갈래만 고치면 그대로
 * - 경고가 아닌 결과면 비운다 — 나중에 다시 경고로 적으면 그날이 새 경고다
 *
 * @param p_seen_version 화면이 읽은 처리 버전 — `null` 이면 견주지 않는다(런북의 검토 문만). 화면의 문은 `null` · 음수를 받지 않는다
 * @returns 적은 표(`report` · `retention`) · 새 버전 · 같은 요청의 재시도였는가
 */
create or replace function public.write_report_review(
  p_actor uuid,
  p_report_id uuid,
  p_outcome text,
  p_note text,
  p_sanctioned_user_id uuid,
  p_warning_category text,
  p_seen_version integer,
  p_request_id uuid,
  p_current_only boolean default false)
returns table (written text, review_version integer, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  warning constant boolean := p_outcome is not distinct from 'warning';
  earlier public.report_review_entry;
  current_version integer;
  account text;
  category text;
begin
  if p_actor is null or not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception 'review: the reviewer is not an operator' using errcode = '42501';
  end if;

  if p_outcome is null then
    raise exception 'review: an outcome is required' using errcode = '22023';
  end if;

  if p_warning_category is not null and not warning then
    raise exception 'review: a category goes with a warning only' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('report:review:' || p_report_id::text));

  -- 1. 같은 요청의 재시도 — 자물쇠 뒤, 신고 · 대상을 재기 전에
  if p_request_id is not null then
    select * into earlier from public.report_review_entry e where e.request_id = p_request_id;
    if found then
      if earlier.report_id <> p_report_id or earlier.outcome is distinct from p_outcome
         or earlier.sanctioned_user_id is distinct from p_sanctioned_user_id
         or (p_warning_category is not null and earlier.warning_category is distinct from p_warning_category)
         -- 재시도는 같은 사람의 것이다 — 남의 요청 번호를 들고 와 그 처분을 제 「성공」으로 받지 못한다
         or earlier.actor_user_id is distinct from p_actor then
        raise exception '이 요청 번호는 다른 처분에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
      end if;
      written := case when exists (select 1 from public.report r where r.id = p_report_id) then 'report' else 'retention' end;
      review_version := earlier.version;
      replayed := true;
      return next;
      return;
    end if;
  end if;

  -- 2. 새 처분 — 신고와 읽은 버전
  if p_current_only and not exists (select 1 from public.report r where r.id = p_report_id) then
    raise exception '신고를 찾지 못했습니다.' using errcode = 'P0002';
  end if;

  select count(*)::integer into current_version from public.report_review_entry e where e.report_id = p_report_id;

  if p_seen_version is not null and p_seen_version <> current_version then
    raise exception '다른 운영자가 먼저 처리했습니다.' using errcode = '55000';
  end if;

  -- 3. 지금 결과와 이력 한 줄
  update public.report r
  set reviewed_at = now(),
      reviewed_by = p_actor,
      review_outcome = p_outcome,
      review_note = p_note,
      sanctioned_user_id = p_sanctioned_user_id,
      sanctioned_by = case when p_sanctioned_user_id is not null then p_actor end,
      warning_category = case when warning then coalesce(p_warning_category, r.reason) end,
      warning_ref = case when warning then coalesce(r.warning_ref, public.new_warning_ref(r.id)) else r.warning_ref end,
      -- 경고한 때 — 경고로 들어오거나 대상이 바뀌면 지금, 같은 대상의 경고를 다시 적으면 그대로(R-6)
      warned_at = case when not warning then null
                       when r.review_outcome is distinct from 'warning'
                         or r.sanctioned_user_id is distinct from p_sanctioned_user_id then now()
                       else r.warned_at end,
      -- 경고로 **들어오거나** 경고의 대상 · 갈래가 바뀌면 새 안내다 — 확인과 발송을 비운다. 같은 경고를 다시 적거나 경고에서
      -- 나가면 그대로 둔다(옮긴 경고가 앞 사람의 「확인함」을 물려받지 않게)
      warning_acknowledged_at = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                     else r.warning_acknowledged_at end,
      warning_emailed_at = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                else r.warning_emailed_at end,
      warning_email_result = case when warning and (r.review_outcome is distinct from 'warning'
                                     or r.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or r.warning_category is distinct from coalesce(p_warning_category, r.reason)) then null
                                  else r.warning_email_result end
  where r.id = p_report_id
  returning r.warning_category into category;

  if found then
    written := 'report';
  else
    update retention.report k
    set reviewed_at = now(),
        reviewed_by = p_actor,
        review_outcome = p_outcome,
        review_note = p_note,
        sanctioned_user_id = p_sanctioned_user_id,
        sanctioned_by = case when p_sanctioned_user_id is not null then p_actor end,
        warning_category = case when warning then coalesce(p_warning_category, k.reason) end,
        warning_ref = case when warning then coalesce(k.warning_ref, public.new_warning_ref(k.report_id)) else k.warning_ref end,
        warned_at = case when not warning then null
                         when k.review_outcome is distinct from 'warning'
                           or k.sanctioned_user_id is distinct from p_sanctioned_user_id then now()
                         else k.warned_at end,
        warning_acknowledged_at = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                       else k.warning_acknowledged_at end,
        warning_emailed_at = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                  else k.warning_emailed_at end,
        warning_email_result = case when warning and (k.review_outcome is distinct from 'warning'
                                     or k.sanctioned_user_id is distinct from p_sanctioned_user_id
                                     or k.warning_category is distinct from coalesce(p_warning_category, k.reason)) then null
                                    else k.warning_email_result end
    where k.report_id = p_report_id
    returning k.warning_category into category;

    if not found then
      raise exception 'review: no such report' using errcode = 'P0002';
    end if;
    written := 'retention';
  end if;

  insert into public.report_review_entry (
    report_id, version, outcome, note, sanctioned_user_id, warning_category, actor_user_id, request_id)
  values (p_report_id, current_version + 1, p_outcome, p_note, p_sanctioned_user_id, category, p_actor, p_request_id);

  -- 4. 이용 정지 결정은 같은 트랜잭션에서 계정을 정지한다 — 여기서 실패하면 위의 기록도 되감긴다
  if p_outcome = 'suspension' then
    select a.status into account from public.app_user a where a.id = p_sanctioned_user_id for update;
    if not found then
      raise exception 'review: the sanctioned account is gone' using errcode = 'P0002';
    end if;
    if account <> 'suspended' then
      perform public.change_account_status(
        p_actor, p_sanctioned_user_id, 'suspended', 'report', null, p_report_id, p_request_id);
    end if;
  end if;

  review_version := current_version + 1;
  replayed := false;
  return next;

exception
  when unique_violation then
    -- 같은 요청 번호가 다른 신고에 나란히 왔다 — 자물쇠가 신고마다라 위의 재시도 찾기를 지났다
    if p_request_id is not null and exists (
         select 1 from public.report_review_entry e where e.request_id = p_request_id) then
      raise exception '이 요청 번호는 다른 처분에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    raise;
end;
$$;

revoke execute on function public.write_report_review(uuid, uuid, text, text, uuid, text, integer, uuid, boolean)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. 12개월 셈을 읽는 자리 — 경고한 때로. 서명 · 칸은 그대로(`create or replace`)
-- ---------------------------------------------------------------------------

/**
 * 한 회원의 경고 이력 — `20261212090000` 의 것에서 12개월 셈(`counted`)과 차례만 경고한 때로 바꿨다. 화면은 더는 안 부르지만
 * (ADR 0189) 지금 운영의 앱 · 런북이 부를 수 있어 남긴다. `reviewed_at` 칸은 이름 그대로 마지막으로 본 시각이다.
 */
create or replace function public.operator_member_warnings(p_user_id uuid)
returns table (
  report_id uuid,
  reviewed_at timestamptz,
  review_outcome text,
  warning_ref text,
  warning_category text,
  warning_acknowledged_at timestamptz,
  counted boolean
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

  perform audit.note_app_access('members.warnings', null, format('user=%s', p_user_id), 'allowed');

  return query
  select
    r.id,
    r.reviewed_at,
    r.review_outcome,
    r.warning_ref,
    r.warning_category,
    r.warning_acknowledged_at,
    r.review_outcome = 'warning' and r.warned_at > now() - interval '12 months'
  from public.report r
  where r.sanctioned_user_id = p_user_id
    and r.review_outcome in ('warning', 'suspension')
  order by coalesce(r.warned_at, r.reviewed_at) desc, r.id desc;
end;
$$;

/**
 * 한 회원의 처분 이력 — `20261218090000` 의 것에서 경고의 12개월 셈과 경고 줄의 시각만 경고한 때로 바꿨다. 이용 정지 결정 줄의
 * 시각은 그대로 검토 시각이다. 나머지 규칙(상태 이력 줄을 빼는 조건 · 200줄 · 닉네임)은 한 글자도 안 바꿨다.
 */
create or replace function public.operator_member_sanctions(p_user_id uuid)
returns table (
  status text,
  is_operator boolean,
  version integer,
  warnings_12m integer,
  lines jsonb
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

  perform audit.note_app_access('members.sanctions', null, format('user=%s', p_user_id), 'allowed');

  return query
  select
    a.status,
    exists (select 1 from public.operator o where o.user_id = a.id),
    (select count(*)::integer from public.account_status_change c where c.user_id = a.id),
    (select count(*)::integer from public.report w
     where w.sanctioned_user_id = a.id and w.review_outcome = 'warning'
       and w.warned_at > now() - interval '12 months'),
    coalesce((
      select jsonb_agg(to_jsonb(h) order by h.at desc, h.id desc)
      from (
        select x.*
        from (
          select
            r.id,
            'report'::text as source,
            case when r.review_outcome = 'warning' then r.warned_at else r.reviewed_at end as at,
            r.review_outcome as kind,
            null::text as from_status,
            r.warning_category as reason,
            null::text as note,
            r.id as report_id,
            r.warning_ref,
            r.warning_acknowledged_at as acknowledged_at,
            r.review_outcome = 'warning' and r.warned_at > now() - interval '12 months' as counted,
            true as recorded,
            (select n.nickname from public.app_user n where n.id = r.reviewed_by) as actor_nickname
          from public.report r
          where r.sanctioned_user_id = a.id and r.review_outcome in ('warning', 'suspension')
          union all
          select
            c.id,
            'status',
            c.at,
            c.to_status,
            c.from_status,
            c.reason,
            c.note,
            c.report_id,
            null,
            null,
            false,
            c.reason is not null,
            (select n.nickname from public.app_user n where n.id = c.actor_user_id)
          from public.account_status_change c
          where c.user_id = a.id and c.to_status in ('suspended', 'active')
            -- 신고 줄이 이 정지를 말할 때만 뺀다 — 결과를 바꾼 뒤에도 정지는 계정에 남아 있다
            and (c.reason is distinct from 'report'
                 or not exists (select 1 from public.report s
                                where s.id = c.report_id and s.sanctioned_user_id = c.user_id
                                  and s.review_outcome = 'suspension'))
        ) x
        order by x.at desc, x.id desc
        limit 200
      ) h), '[]'::jsonb)
  from public.app_user a
  where a.id = p_user_id;
end;
$$;

/**
 * 신고의 두 계정 — `20261218090000` 의 것에서 경고의 12개월 셈 · 이 신고의 경고가 그 수에 들었는가(`warned_here`) · 최근 셋의 경고
 * 줄 시각만 경고한 때로 바꿨다. 나머지는 한 글자도 안 바꿨다.
 */
create or replace function public.operator_report_target(p_report_id uuid)
returns table (
  side text,
  user_id uuid,
  nickname text,
  status text,
  is_operator boolean,
  warnings_12m integer,
  warned_here boolean,
  recent jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  found_report public.report;
begin
  if not public.is_operator() then
    raise exception '운영자만 읽는 자리입니다.' using errcode = '42501';
  end if;

  select * into found_report from public.report r where r.id = p_report_id;

  perform audit.note_app_access(
    'reports.target', p_report_id,
    case when found_report.id is null then 'user=none'
         else format('reported=%s reporter=%s', found_report.reported_user_id, found_report.reporter_user_id) end,
    'allowed');

  if found_report.id is null then
    return;
  end if;

  return query
  select
    p.side,
    a.id,
    a.nickname,
    a.status,
    exists (select 1 from public.operator o where o.user_id = a.id),
    (select count(*)::integer from public.report w
     where w.sanctioned_user_id = a.id and w.review_outcome = 'warning'
       and w.warned_at > now() - interval '12 months'),
    found_report.review_outcome is not distinct from 'warning'
      and found_report.sanctioned_user_id is not distinct from a.id
      and found_report.warned_at > now() - interval '12 months',
    coalesce((
      select jsonb_agg(jsonb_build_object('at', h.at, 'kind', h.kind, 'reason', h.reason, 'report_id', h.report_id)
                       order by h.at desc)
      from (
        select x.at, x.kind, x.reason, x.report_id
        from (
          select case when w.review_outcome = 'warning' then w.warned_at else w.reviewed_at end as at,
                 w.review_outcome as kind, w.warning_category as reason, w.id as report_id
          from public.report w
          where w.sanctioned_user_id = a.id and w.review_outcome in ('warning', 'suspension')
          union all
          select c.at, c.to_status, c.reason, c.report_id
          from public.account_status_change c
          where c.user_id = a.id and c.to_status in ('suspended', 'active')
            -- 신고의 이용 정지 결정이 건 정지는 그 결정이 지금도 서 있을 때만 위 신고 줄이 말한다 — 한 번의 정지가 두 칸을 먹지
            -- 않게, 그리고 결과를 바꾼 뒤에도 정지가 사라지지 않게
            and (c.reason is distinct from 'report'
                 or not exists (select 1 from public.report s
                                where s.id = c.report_id and s.sanctioned_user_id = c.user_id
                                  and s.review_outcome = 'suspension'))
        ) x
        order by x.at desc
        limit 3
      ) h), '[]'::jsonb)
  from (values ('reported', found_report.reported_user_id), ('reporter', found_report.reporter_user_id)) p(side, id)
  join public.app_user a on a.id = p.id;
end;
$$;

/**
 * 내가 아직 확인하지 않은 경고 하나 — `20261019090000` 의 것에서 「경고한 날」과 차례만 경고한 때로 바꿨다. 갈래를 고쳐 안내가 다시
 * 서도 날짜는 처음 경고한 날이다.
 */
create or replace function public.my_warning_notice()
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
  select r.warning_ref, r.warning_category, (r.warned_at at time zone 'Asia/Seoul')::date
  from public.report r
  join public.app_user a on a.id = r.sanctioned_user_id
  where r.sanctioned_user_id = auth.uid()
    and a.status = 'active'
    and r.review_outcome = 'warning'
    and r.warning_acknowledged_at is null
  order by r.warned_at, r.id
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- 5. 무상 지급의 공통 함수 — 탈퇴 대기 계정에는 새 지급을 받지 않는다. 몸은 `20261215090000` 그대로이고 검사 하나만 더했다
-- ---------------------------------------------------------------------------

create or replace function public.book_reading_credit_grant(
  p_actor uuid,
  p_user_id uuid,
  p_kind text,
  p_credits integer,
  p_reason text,
  p_note text,
  p_request_id uuid,
  p_report_id uuid default null,
  p_seen_version integer default null)
returns table (entry_id uuid, replayed boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  memo constant text := btrim(coalesce(p_note, ''));
  earlier public.reading_credit_grant_entry;
  left_now integer;
  made uuid;
begin
  if p_actor is null then
    raise exception '실행한 운영자가 없습니다.' using errcode = '22023';
  end if;
  -- 실행자는 운영자다 — 처분 · 상태의 공통 함수와 같은 검사(런북에서 UUID 를 잘못 넣어도 아무나 실행자로 남지 않게)
  if not exists (select 1 from public.operator o where o.user_id = p_actor) then
    raise exception '운영자만 지급 · 회수합니다.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception '요청 번호가 없습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
  end if;

  if p_kind is null or p_kind not in ('grant', 'revoke') then
    raise exception 'credit grant: kind is grant or revoke' using errcode = '22023';
  end if;

  if (p_kind = 'grant' and (p_reason is null or p_reason not in ('outage', 'operator')))
     or (p_kind = 'revoke' and (p_reason is null or p_reason not in ('mistake', 'duplicate', 'other'))) then
    raise exception '사유를 골라 주세요.' using errcode = '22023';
  end if;

  if p_credits is null or p_credits < 1 or (p_kind = 'grant' and p_credits > 10) then
    raise exception '%', case p_kind when 'grant' then '한 번에 1장에서 10장까지 지급합니다.'
                                     else '회수할 수량을 1장 이상 골라 주세요.' end
      using errcode = '22023';
  end if;

  if length(memo) not between 1 and 200 then
    raise exception '메모를 200자 안으로 적어 주세요.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.app_user a where a.id = p_user_id) then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'no_data_found';
  end if;

  if p_report_id is not null and p_kind <> 'grant' then
    raise exception '관련 신고는 지급에만 답니다.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('reading:user:' || p_user_id::text));

  -- 같은 요청의 재시도 — 자물쇠 뒤에 찾는다(나란히 온 재시도는 첫째의 커밋 뒤에 본다). 같은 줄을 돌려준다
  select * into earlier from public.reading_credit_grant_entry e where e.request_id = p_request_id;
  if found then
    if earlier.user_id <> p_user_id or earlier.kind <> p_kind or earlier.credits <> p_credits
       or earlier.reason <> p_reason or earlier.actor_user_id is distinct from p_actor then
      raise exception '이 요청 번호는 다른 지급 · 회수에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
    end if;
    entry_id := earlier.id;
    replayed := true;
    return next;
    return;
  end if;

  -- 탈퇴 대기 계정에는 새 지급을 받지 않는다(R-7) — 하루 뒤 처분으로 함께 지워질 몫이다. 계정 행을 공유로 잡아 탈퇴 신청과 나란히
  -- 와도 한쪽 뒤에 본다. 회수 · 정지된 계정의 지급(보상)은 그대로 받는다
  if p_kind = 'grant'
     and (select a.status from public.app_user a where a.id = p_user_id for share) = 'deletion_requested' then
    raise exception '탈퇴 대기 계정이라 지급할 수 없습니다.' using errcode = '23514';
  end if;

  -- 관련 신고는 **새 지급일 때만** 잰다 — 첫 지급 뒤 신고가 보관으로 옮겨져도(신고한 사람이 떠남) 같은 요청의 재시도는 위에서
  -- 첫 결과를 돌려받는다
  if p_report_id is not null and not exists (
       select 1 from public.report r
       where r.id = p_report_id and p_user_id in (r.reporter_user_id, r.reported_user_id)) then
    raise exception '관련 신고가 이 회원의 신고가 아닙니다.' using errcode = '22023';
  end if;

  if p_seen_version is not null
     and p_seen_version <> (select count(*) from public.reading_credit_grant_entry e where e.user_id = p_user_id) then
    raise exception '그 사이 이 회원의 무상 풀이권이 바뀌었습니다. 새로 읽고 다시 확인해 주세요.' using errcode = '55000';
  end if;

  if p_kind = 'revoke' then
    perform public.settle_reading_credit_uses(p_user_id);
    left_now := public.reading_credit_grant_left(p_user_id);
    if p_credits > left_now then
      raise exception '회수할 수 있는 지급분보다 많습니다 — 지금 %장입니다.', left_now using errcode = '22023';
    end if;
  end if;

  insert into public.reading_credit_grant_entry (
    user_id, kind, credits, reason, note, report_id, request_id, actor_user_id)
  values (p_user_id, p_kind, p_credits, p_reason, memo, p_report_id, p_request_id, p_actor)
  returning id into made;

  perform public.sync_reading_credit_grant(p_user_id);

  insert into public.notification (user_id, kind, credit_entry_id)
  values (p_user_id, case p_kind when 'grant' then 'credits_granted' else 'credits_revoked' end, made);

  -- 지급마다 한 줄 — 종류에 장부 줄 id 를 붙여 하루 한 줄(`ops_alert` 의 유일 제약)에 묻히지 않는다. 계정 id · 수량 · 갈래만
  if p_kind = 'grant' then
    perform public.notify_ops(
      'credit-grant:' || made::text,
      format('무상 풀이권 %s장을 지급했다 — 계정 %s · %s',
             p_credits, p_user_id, case p_reason when 'outage' then '장애 보상' else '운영 지급' end));
  end if;

  entry_id := made;
  replayed := false;
  return next;

exception
  when unique_violation then
    -- 같은 요청 번호가 다른 계정에 나란히 왔다 — 자물쇠가 계정마다라 위의 재시도 찾기를 지났다
    raise exception '이 요청 번호는 다른 지급 · 회수에 쓰였습니다. 화면을 새로 열어 주세요.' using errcode = '22023';
end;
$$;

revoke execute on function public.book_reading_credit_grant(uuid, uuid, text, integer, text, text, uuid, uuid, integer)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. 지급 장부의 대조 — 매일, 알리기만 한다
-- ---------------------------------------------------------------------------

/**
 * 계정마다 지급 장부의 합(지급 − 회수)이 예외 몫(`reading_credit_grant.extra`, 행이 없으면 0)과 같은가 — 다른 계정마다 장애 알림
 * 한 줄(`credit-grant-mismatch:<계정 id>`, 하루 한 번). **아무것도 고치지 않는다** — 어느 쪽이 맞는지는 사람이 장부를 보고 정한다
 * (`docs/ops/runbook/credits.md` 「무상 지급」). 알림에는 계정 id 와 두 수만 간다.
 *
 * 크론 `credit-grant-watch` 만 부른다. 누구에게도 열지 않는다.
 *
 * @returns 어긋난 계정 수(이번에 새로 알렸든 오늘 이미 알렸든)
 */
create function public.watch_reading_credit_grants()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  off record;
  counted integer := 0;
begin
  for off in
    select coalesce(g.user_id, e.user_id) as user_id, coalesce(g.extra, 0) as extra, coalesce(e.total, 0) as total
    from public.reading_credit_grant g
    full join (
      select x.user_id, sum(case x.kind when 'grant' then x.credits else -x.credits end)::integer as total
      from public.reading_credit_grant_entry x
      group by x.user_id
    ) e on e.user_id = g.user_id
    where coalesce(g.extra, 0) <> coalesce(e.total, 0)
    order by 1
  loop
    counted := counted + 1;
    perform public.notify_ops(
      'credit-grant-mismatch:' || off.user_id::text,
      format('무상 지급 장부 합 %s장과 예외 몫 %s장이 다르다 — 계정 %s. 고치지 않았다', off.total, off.extra, off.user_id));
  end loop;

  return counted;
end;
$$;

revoke execute on function public.watch_reading_credit_grants() from public, anon, authenticated, service_role;

/** 매일 05:41 UTC — 다른 매일 잡(04:37 · 04:43 · 04:53 · 06:29)과 매시 잡(7 · 23 · 47분)과 안 겹친다 */
select cron.unschedule('credit-grant-watch')
where exists (select 1 from cron.job where jobname = 'credit-grant-watch');

select cron.schedule('credit-grant-watch', '41 5 * * *', 'select public.watch_reading_credit_grants()');
