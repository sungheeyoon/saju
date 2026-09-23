-- 신고를 **누가 · 어떻게 판단했는지**가 신고 곁에 남는다 (ADR 0105, G-24)
--
-- 지금까지 신고에 남는 것은 「봤다」 한 칸(`reviewed_at`)이었다. 처음 표를 만들 때(`20260826120000`) 처분을
-- 여기 안 적은 까닭은 「제재는 `app_user.status` 가 들고, 결론까지 적으면 같은 사실이 두 자리에 있게 된다」였다.
-- 그 판단의 절반은 그대로다 — **지금** 이용 정지인가는 여전히 `status` 하나가 답한다. 달라진 것은 물음이다.
-- 운영자가 「이 신고를 보고 무엇을 했나 · 왜 그랬나 · 누가 했나」는 `status` 가 못 답한다 — `status` 는 지금 값
-- 하나라 해제되면 흔적이 없다. 2026-09-24 에 사람이 정했다: 검토 기록은 신고 곁에 남기고, 채우는 손은
-- runbook 의 검토 SQL 이다(화면에 쓰는 누름은 안 넣는다, ADR 0103).
--
-- ## 칸 다섯
--
--   reviewed_by         검토한 운영자(`public.operator` 의 user_id). FK 가 없다 — 운영자가 떠나도 기록은 선다
--   review_outcome      no_action(조치 없음) · warning(경고) · suspension(이용 정지) · needs_more(추가 확인)
--   review_note         짧은 판단 근거 — 500자까지. **이메일 · 실명 · 연락처를 적지 않는다**(runbook)
--   sanctioned_user_id  실제로 제재를 받은 쪽 — 신고의 두 계정 중 하나
--   sanctioned_by       그 제재를 실행한 운영자
--
-- ## 신고한 사람은 이 칸을 못 읽는다
--
-- `report` 는 신고한 사람이 제 줄을 읽는 표다(「이미 신고했습니다」를 말하려고, `20260826120000`). 표 전체에
-- `select` 를 준 채로 칸을 더하면 신고한 사람이 **상대가 정지됐는지와 운영자의 판단 근거**를 읽는다. 그래서
-- 표 단위 권한을 걷고, 원래 있던 칸 일곱에만 `select` 를 다시 준다. 새 칸은 누구에게도 안 열린다.
--
-- ## 떠난 뒤에도 같은 칸이 옮겨진다 — ADR 0098
--
-- `retention.report` 에 같은 칸을 더하고, 옮기는 트리거가 함께 베낀다. 떠난 뒤에도 검토는 이어지므로(runbook
-- 「떠난 사람의 신고 기록」) 불변 검사가 고칠 수 있게 두는 칸에 검토 다섯을 더한다.

alter table public.report
  add column reviewed_by uuid,
  add column review_outcome text
    check (review_outcome in ('no_action', 'warning', 'suspension', 'needs_more')),
  add column review_note text
    check (review_note is null or length(btrim(review_note)) between 1 and 500),
  add column sanctioned_user_id uuid,
  add column sanctioned_by uuid,
  add constraint review_has_a_reviewer
    check (review_outcome is null or (reviewed_at is not null and reviewed_by is not null)),
  add constraint review_note_needs_an_outcome
    check (review_note is null or review_outcome is not null),
  add constraint sanction_falls_on_a_party
    check (sanctioned_user_id is null or sanctioned_user_id in (reporter_user_id, reported_user_id)),
  add constraint sanction_has_an_actor
    check ((sanctioned_user_id is null) = (sanctioned_by is null)),
  add constraint suspension_names_who
    check (review_outcome is distinct from 'suspension' or sanctioned_user_id is not null);

comment on column public.report.reviewed_at is
  '운영자가 본 시각. 무엇을 했는지는 review_outcome, 지금 정지인가는 app_user.status (ADR 0105)';
comment on column public.report.review_outcome is
  '검토 결과 — no_action · warning · suspension · needs_more. runbook 「신고와 차단」의 검토 SQL 이 채운다 (ADR 0105)';
comment on column public.report.review_note is
  '짧은 판단 근거. 이메일 · 실명 · 연락처를 적지 않는다 (ADR 0105)';

/** 신고한 사람은 원래 칸 일곱만 읽는다 — 새 칸(판단 · 제재)은 안 열린다 */
revoke select on public.report from authenticated;
grant select (id, reporter_user_id, reported_user_id, reason, detail, created_at, reviewed_at)
  on public.report to authenticated;

-- ── 떠난 사람의 신고에도 같은 칸 ────────────────────────────────────────────────

alter table retention.report
  add column reviewed_by uuid,
  add column review_outcome text
    check (review_outcome in ('no_action', 'warning', 'suspension', 'needs_more')),
  add column review_note text
    check (review_note is null or length(btrim(review_note)) between 1 and 500),
  add column sanctioned_user_id uuid,
  add column sanctioned_by uuid;

/**
 * 옮겨 온 증거는 고치지 못한다 — 고칠 수 있는 것은 검토 여섯(시각 · 누가 · 결과 · 근거 · 제재 둘), 남은 쪽의
 * 탈퇴일(비어 있을 때 한 번), 보류 두 칸뿐이다. 나머지는 소유자에게도 `55000` 이다.
 */
create or replace function retention.refuse_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mutable constant text[] := array[
    'reviewed_at', 'reviewed_by', 'review_outcome', 'review_note', 'sanctioned_user_id', 'sanctioned_by',
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

/** `20261006090000` 의 것에 검토 다섯을 더해 베낀다 — 나머지는 한 글자도 안 바꿨다 */
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
    reviewed_by, review_outcome, review_note, sanctioned_user_id, sanctioned_by)
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
    r.reviewed_by, r.review_outcome, r.review_note, r.sanctioned_user_id, r.sanctioned_by
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
