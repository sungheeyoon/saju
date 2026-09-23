-- 떠난 사람의 신고 기록은 **처분일부터 6개월, 다른 자료와 떨어져 남는다** (G-52, ADR 0098)
--
-- 지금까지는 신고한 쪽이든 당한 쪽이든 떠나면 신고(`report`)와 스냅샷(`chat_report_snapshot`)이
-- `on delete cascade` 로 따라 사라졌다(ADR 0023 「잃는 것」, ADR 0094 표). 떠나는 것으로 제재의 근거를
-- 지울 수 있었다. 사람의 결정(2026-09-23)과 그 법령 근거(ADR 0098)대로 바꾼다. 처리방침 `notice-v6`
-- 의 절 「신고 기록은 따로 둡니다」가 먼저 배포됐다 — **알리기 전에 남기지 않는다.**
--
-- ## 무엇을 남기나 — ADR 0098 「정한 것」의 목록을 넘지 않는다
--
--   신고 사유와 상세 · 신고 시각과 검토 상태 · 불변 스냅샷 · 두 계정의 UUID · 당시 로그인 이메일 ·
--   가입일 · 탈퇴일(처분일)
--
-- 가입일은 `auth.users.created_at`(계정이 생긴 때)이고 탈퇴일은 그 사람의 행이 지워진 때다 — 둘 다 이미
-- 가진 값이라 새 수집이 아니다. IP · 실명 · 전화번호는 받은 적이 없고 여기서도 안 받는다. 출생정보 ·
-- 풀이 · 스냅샷 밖의 대화는 옮기지 않는다.
--
-- ## 떨어진 자리 — 스키마 하나
--
-- `retention` 스키마는 API 가 내놓는 스키마(`public` · `graphql_public`)가 아니고, `anon` ·
-- `authenticated` · `service_role` 어느 것도 그 스키마를 쓸 수 없다(`usage` 가 없다). 읽는 손은 운영자의
-- SQL(`postgres`)뿐이다 — 앱 서버의 비밀 열쇠로도 못 읽는다. 일반 표에 섞어 두면 탈퇴가 무엇을
-- 지웠는지 말할 수 없다(개인정보 보호법 제21조③ 의 분리, ADR 0098 「넷에 대한 답」 1).
--
-- ## 언제 옮기나 — 지우기 **전에**, 열쇠 곁에서
--
-- `auth.users` 의 `before delete` 트리거가 옮긴다. `forget_user` 는 한 줄도 안 고쳤다 — 지우는 규칙은
-- 함수가 아니라 열쇠 곁에 적는다(ADR 0023). 그래서 크론의 처분(`dispose_requested_accounts`)이든
-- 운영자의 `forget_user` 든 누가 `auth.users` 를 직접 지우든 같은 답이 나온다. `app_user` 곁이 아닌 것은
-- 이메일 때문이다 — `app_user` 의 행이 cascade 로 지워질 때는 `auth.users` 의 행이 이미 없다.
--
-- `report` 의 FK 는 **그대로 `cascade` 다.** 옮긴 뒤에는 일반 표에 떠난 사람의 신고가 남지 않아야
-- 하므로, 옮기는 걸음 다음에 cascade 가 지우는 것이 맞는 순서다. 제약에 그 뜻을 적어 둔다.
--
-- ## 6개월은 처분일부터 — 먼저 떠난 쪽의 처분일
--
-- 옮기는 순간(`retained_at`)이 처분일이다. 남은 쪽이 나중에 떠나면 그 사람의 탈퇴일만 채우고 시계는
-- 안 옮긴다 — 한 신고의 보관이 두 번째 탈퇴로 늘어나지 않는다(ADR 0098 추기, 2026-09-23 #174).
--
-- ## 지나면 지운다 — 보류가 걸린 줄만 미룬다
--
-- 크론 `report-retention-purge`(매시 47분)가 6개월이 지난 줄을 지운다. 수사기관의 적법한 보존 요청이
-- 걸린 줄(`hold_reason`)만 남기고, 보류를 풀면 다음 실행이 지운다. 실패는 `cron-watch` 가 알린다 —
-- 등록된 잡 전부를 보므로 여기서 새 알림을 짓지 않는다.
--
-- ## 흔적 검사와의 관계
--
-- `account_residue` 는 `auth.users` · `app_user` 를 가리키는 **FK** 를 센다. `retention.report` 는 떠난
-- 사람의 UUID 를 들지만 FK 가 아니다 — 가리키는 행이 사라진 뒤에도 서야 하는 기록이라서다. 그러니
-- 처분의 흔적으로 세지 않는 것이 맞고, 그것이 「분리 보관」의 뜻이다.

create schema retention;

comment on schema retention is
  '떠난 사람의 신고 기록 — 처분일부터 6개월, 운영자만 읽는다 (G-52, ADR 0098). API 역할에 닫혀 있다.';

revoke all on schema retention from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema retention
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema retention
  revoke execute on functions from public, anon, authenticated, service_role;

/** 얼마나 두나 — 처리방침이 말하는 수. 처분일부터 */
create function retention.report_period()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '6 months' $$;

/**
 * 떠난 사람이 든 신고 한 건 — **옮겨 온 그대로.**
 *
 * `report` · `chat_report_snapshot` 두 표의 한 줄씩을 한 줄로 합친다. 스냅샷은 jsonb 한 칸이다 — 원래
 * 표도 본문을 jsonb 로 베꼈고(ADR 0091), 여기서 다시 칸으로 펴면 두 표가 함께 움직여야 한다.
 * 어느 계정에도 FK 로 매지 않는다 — 가리키는 사람이 떠난 뒤에 서는 기록이다.
 */
create table retention.report (
  /** 원래 신고의 id — 되짚는 실마리 */
  report_id uuid primary key,
  reason text not null,
  detail text,
  /** 신고 시각 */
  reported_at timestamptz not null,
  /** 검토 상태 — 운영자가 본 시각. 옮긴 뒤에도 운영자가 적을 수 있다 */
  reviewed_at timestamptz,
  /** 불변 스냅샷 — 메시지를 고른 신고에만 있다 */
  snapshot jsonb,

  reporter_user_id uuid not null,
  reported_user_id uuid not null,
  /** 당시 로그인 이메일 — 옮긴 순간의 값 */
  reporter_email text,
  reported_email text,
  /** 가입일 — `auth.users.created_at` */
  reporter_joined_at timestamptz,
  reported_joined_at timestamptz,
  /** 탈퇴일 — 그 사람의 행이 지워진 때. 아직 있으면 비어 있다 */
  reporter_left_at timestamptz,
  reported_left_at timestamptz,

  /** 처분일 — 옮긴 때. 6개월을 여기서 센다 */
  retained_at timestamptz not null default now(),

  /**
   * 보존 보류 — 수사기관의 적법한 보존 요청이 걸렸다. 요청서의 기관 · 문서 번호 · 받은 날을 적는다.
   * 걸려 있는 동안 파기하지 않는다. 사유가 끝나면 비운다(runbook 「떠난 사람의 신고 기록」)
   */
  hold_reason text check (hold_reason is null or length(btrim(hold_reason)) between 1 and 500),
  held_at timestamptz,

  constraint someone_left check (reporter_left_at is not null or reported_left_at is not null),
  constraint hold_has_a_time check ((hold_reason is null) = (held_at is null)),
  constraint retained_snapshot_is_an_object check (snapshot is null or jsonb_typeof(snapshot) = 'object')
);

comment on table retention.report is
  '떠난 사람이 든 신고 — 처분일(retained_at)부터 6개월 뒤 크론이 지운다. 보류(hold_reason)가 걸린 줄만 미룬다 (ADR 0098).';

create index retention_report_expiry on retention.report (retained_at) where hold_reason is null;
create index retention_report_by_reporter on retention.report (reporter_user_id);
create index retention_report_by_reported on retention.report (reported_user_id);

alter table retention.report enable row level security;
revoke all on retention.report from public, anon, authenticated, service_role;

/**
 * **옮겨 온 증거는 고치지 못한다.** 고칠 수 있는 것은 넷뿐이다 — 검토 상태, 남은 쪽의 탈퇴일(비어
 * 있을 때 한 번), 보류 두 칸. 나머지가 바뀌면 소유자에게도 막힌다(스냅샷과 같은 `55000`).
 */
create function retention.refuse_evidence_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  mutable constant text[] := array['reviewed_at', 'reporter_left_at', 'reported_left_at', 'hold_reason', 'held_at'];
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

create trigger retained_report_is_immutable
before update on retention.report
for each row execute function retention.refuse_evidence_update();

/**
 * 떠나기 **전에** 그 사람이 든 신고를 옮긴다 — `auth.users` 의 `before delete`.
 *
 * 한 문장이 두 사람을 함께 지우면 첫째의 트리거가 옮기고(그때는 둘 다 있다), 둘째의 트리거는 이미
 * 옮긴 줄에 탈퇴일만 채운다 — cascade 는 문장 끝에 돈다.
 */
create function retention.keep_reports_of_leaver()
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
    reporter_left_at, reported_left_at)
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
    case when r.reported_user_id = old.id then now() end
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

create trigger reports_outlive_the_leaver
before delete on auth.users
for each row execute function retention.keep_reports_of_leaver();

comment on constraint report_reporter_user_id_fkey on public.report is
  '떠나면 지운다 — 그 전에 auth.users 의 트리거(reports_outlive_the_leaver)가 retention.report 로 옮겼다 (ADR 0098)';
comment on constraint report_reported_user_id_fkey on public.report is
  '떠나면 지운다 — 그 전에 auth.users 의 트리거(reports_outlive_the_leaver)가 retention.report 로 옮겼다 (ADR 0098)';

/**
 * 처분일부터 6개월이 지난 줄을 지운다 — 보류가 걸린 줄은 남긴다.
 *
 * 여러 번 돌아도 안전하다. 실패는 `cron-watch` 가 `cron-failed:report-retention-purge` 로 알린다.
 *
 * @returns 이번에 지운 수
 */
create function retention.purge_expired_reports()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  gone integer;
begin
  with purged as (
    delete from retention.report k
    where k.retained_at <= now() - retention.report_period()
      and k.hold_reason is null
    returning 1
  )
  select count(*)::integer into gone from purged;
  return gone;
end;
$$;

revoke execute on all functions in schema retention from public, anon, authenticated, service_role;

/** 이름으로 지우고 다시 건다 — 두 번 돌려도 일정이 하나다. 매시 47분 — 다른 잡(매분 · 7 · 23 · 10분마다)과 안 겹친다 */
select cron.unschedule('report-retention-purge')
where exists (select 1 from cron.job where jobname = 'report-retention-purge');

select cron.schedule('report-retention-purge', '47 * * * *', 'select retention.purge_expired_reports()');
