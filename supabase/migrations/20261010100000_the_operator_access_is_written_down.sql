-- 운영자가 이용자 자료를 **읽는 순간부터** 누가 · 언제 · 무엇을 읽었는지가 남는다 (G-23 ⑩, ADR 0105)
--
-- 2026-09-24 에 잰 값(runbook 「운영자 접속기록」): 이용자 자료에 닿는 두 자리 — 앱의 `/ops` 화면과 CLI 로
-- 보내는 SQL — 은 누가 무엇을 읽었는지가 **0일** 남았다. Postgres 는 `log_statement = ddl` 이라 읽기를 안
-- 적고, Vercel 런타임 로그는 1시간이다. 사람이 정한 것(ADR 0105): 개인정보 열람은 `/ops/**` 화면으로만,
-- 그 화면의 문이 읽을 때마다 한 줄을 적고, CLI(`npm run db:remote`)는 SQL 원문 대신 **목적과 해시**만 적는다.
-- 기록은 매일 밖(S3, Object Lock)으로 반출돼 1년 넘게 선다.
--
-- ## 기록 표 — `audit.operator_access`
--
-- API 에 안 나가는 스키마 `audit` 에 둔다(`retention` 과 같은 결). 적히는 것은 운영자 id · 시각 · 동작 ·
-- 대상 신고 id(목록이면 거른 조건의 요약) · 성공/거절, CLI 면 실행자 이름 · 목적 · SQL 해시. **이용자의 닉네임 ·
-- 메시지 본문 · 이메일은 안 적는다** — 반출본은 Compliance 로 잠겨 지울 수 없으므로 개인정보 원문이 들어가면
-- 그것을 지울 길이 없다.
--
-- **추가만 된다.** 모든 역할(소유자 `postgres` 까지)에서 `update` · `delete` · `truncate` 를 걷고, 줄 트리거와
-- 문장 트리거가 한 번 더 막는다. 소유자는 트리거를 끄거나 권한을 다시 줄 수 있다 — DB 안의 기록은 그 이상
-- 못 지킨다. 그래서 하루 한 번 밖으로 나가고, 밖의 사본(Object Lock)이 지워지지 않는 기록이다.
--
-- ## 문이 읽을 때 적는다 — 그래서 셋이 `volatile` 이 된다
--
-- `operator_reports` · `operator_report` · `operator_report_snapshot` 이 `stable` 이면 쓰지 못한다. 셋을 다시
-- 짓는다(반환 칸이 느는 것은 옛 앱에 안전하다 — 옛 앱은 아는 칸만 집는다). 성공한 읽기는 **같은 트랜잭션에서**
-- 적힌다 — 문을 직접 두드려도(PostgREST) 빠지지 않는다.
--
-- ## 거절은 문 밖에서 적는다
--
-- 운영자가 아니면 문은 `42501` 을 던진다. 던지면 트랜잭션이 되감겨 **같은 자리에서 적은 줄도 사라진다.** 던지지
-- 않고 빈 결과를 내면 화면이 404 대신 빈 목록을 세운다(「여기 뭔가 있다」). 그래서 거절은 문이 거절을 받은
-- 뒤 **따로 부르는 문**(`note_operator_denial`)이 제 트랜잭션에서 적는다. 앱의 문(`app/ops/reports/read.ts`)이
-- 거절을 받으면 늘 부른다. 한계 — 운영자가 아닌 사람이 PostgREST 로 문을 직접 두드리고 이것을 안 부르면 거절은
-- 안 남는다. 그 사람이 얻은 것은 `42501` 뿐이다. 이 문은 운영자가 부르면 아무것도 안 적고(운영자는 거절당하지
-- 않는다), 한 사람이 한 시간에 서른 줄을 넘게 적지 못한다 — 로그인한 아무나 부를 수 있는 문이라 표를 채우는
-- 도구가 되지 않게.
--
-- ## 반출 — 번호로 이어 붙인다
--
-- 크론(`/api/cron/audit-export`)이 지난 반출의 마지막 번호 뒤를 읽어(`audit_export_batch`) 올리고, 올린 뒤
-- 범위를 적는다(`audit_export_done`). 적는 문은 **바로 앞 반출의 끝에서 이어지지 않으면 거절한다** — 빠짐도
-- 겹침도 없다. 올렸는데 적지 못했으면 다음 실행이 같은 범위를 같은 객체 키로 다시 올린다(버전이 하나 는다).
-- 번호(identity)는 되감긴 트랜잭션 때문에 비는 수가 있다 — 이어지는 것은 **범위**이고, 범위 안의 행 수를
-- 머리에 적어 견준다. 방금 적힌 줄은 10분 기다린다 — 번호를 먼저 받고 늦게 커밋된 줄을 건너뛰지 않게.

create schema audit;

comment on schema audit is
  '운영자 접속기록 — 추가만 되고, 매일 밖으로 반출된다 (G-23 ⑩, ADR 0105). API 역할에 닫혀 있다.';

revoke all on schema audit from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema audit
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema audit
  revoke execute on functions from public, anon, authenticated, service_role;

create table audit.operator_access (
  /** 로그 번호 — 반출이 이 번호로 이어 붙인다 */
  id bigint generated always as identity primary key,
  at timestamptz not null default clock_timestamp(),
  /** app — `/ops` 화면의 문, cli — `npm run db:remote` */
  channel text not null check (channel in ('app', 'cli')),
  /** 앱이면 운영자의 계정 id. FK 가 아니다 — 계정이 지워져도 기록은 선다 */
  actor_user_id uuid,
  /** CLI 면 실행자 이름(git 의 user.name). 에이전트가 부른 것이면 그렇게 적힌다 */
  actor_name text check (actor_name is null or length(btrim(actor_name)) between 1 and 100),
  action text not null
    check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'cli.query')),
  target_report_id uuid,
  /** 목록이면 거른 조건 — 검토 여부 · 사유 · 대화 근거 · 쪽. 개인을 가리키는 값이 없다 */
  filter_summary text check (filter_summary is null or length(filter_summary) <= 200),
  /** CLI 의 목적 — 사람이 적는다. `@` 가 든 값(이메일)은 받지 않는다 */
  purpose text check (purpose is null or (length(btrim(purpose)) between 4 and 200 and purpose !~ '@')),
  /** CLI 로 보낸 SQL 의 sha256 — 원문은 적지 않는다(이용자 자료가 섞인다) */
  sql_sha256 text check (sql_sha256 is null or sql_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('allowed', 'denied')),

  constraint app_access_names_the_operator check (
    channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                         and sql_sha256 is null and action like 'reports.%')),
  constraint cli_access_names_purpose_and_hash check (
    channel <> 'cli' or (actor_name is not null and purpose is not null and sql_sha256 is not null
                         and action = 'cli.query' and outcome = 'allowed'))
);

comment on table audit.operator_access is
  '운영자 접속기록 — 추가만 된다. 이용자 개인정보 원문을 적지 않는다. 매일 S3 로 반출 (G-23 ⑩, ADR 0105)';

create index operator_access_by_actor on audit.operator_access (actor_user_id, at);
create index operator_access_by_time on audit.operator_access (at);

alter table audit.operator_access enable row level security;
revoke all on audit.operator_access from public, anon, authenticated, service_role;
revoke update, delete, truncate on audit.operator_access from postgres;

create function audit.refuse_rewrite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit: the access log is append-only' using errcode = '55000';
end;
$$;

create trigger operator_access_is_append_only
before update or delete on audit.operator_access
for each row execute function audit.refuse_rewrite();

create trigger operator_access_is_not_truncated
before truncate on audit.operator_access
for each statement execute function audit.refuse_rewrite();

/**
 * 반출한 범위 — 한 줄이 객체 하나다. 다음 반출은 여기 마지막 `last_id` 뒤에서 시작한다.
 * 이것도 추가만 된다 — 범위를 고치면 빠짐 · 겹침을 말할 수 없다.
 */
create table audit.operator_access_export (
  first_id bigint not null,
  last_id bigint not null,
  rows integer not null check (rows > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  object_key text not null check (length(object_key) between 1 and 300),
  exported_at timestamptz not null default now(),
  primary key (first_id),
  constraint export_range_is_forward check (first_id <= last_id)
);

alter table audit.operator_access_export enable row level security;
revoke all on audit.operator_access_export from public, anon, authenticated, service_role;
revoke update, delete, truncate on audit.operator_access_export from postgres;

create trigger operator_access_export_is_append_only
before update or delete on audit.operator_access_export
for each row execute function audit.refuse_rewrite();

create trigger operator_access_export_is_not_truncated
before truncate on audit.operator_access_export
for each statement execute function audit.refuse_rewrite();

/** 앱의 문이 한 줄 적는다 — 운영자 문 셋 안에서만 불린다 */
create function audit.note_app_access(p_action text, p_report_id uuid, p_filter text, p_outcome text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into audit.operator_access (channel, actor_user_id, action, target_report_id, filter_summary, outcome)
  values ('app', (select auth.uid()), p_action, p_report_id, p_filter, p_outcome)
$$;

/**
 * CLI 가 SQL 을 보내기 **전에** 한 줄 적는다 — `scripts/db-remote.mjs` 가 같은 잠금 안에서 먼저 부른다.
 * `postgres` 로만 부른다(`db query --linked`). 적지 못하면 그 SQL 은 안 나간다.
 *
 * @returns 적은 줄의 번호
 */
create function audit.note_cli_query(p_actor text, p_purpose text, p_sql_sha256 text)
returns bigint
language sql
set search_path = ''
as $$
  insert into audit.operator_access (channel, actor_name, action, purpose, sql_sha256, outcome)
  values ('cli', p_actor, 'cli.query', p_purpose, p_sql_sha256, 'allowed')
  returning id
$$;

revoke execute on all functions in schema audit from public, anon, authenticated, service_role;

-- ── 운영자 문 셋 — 읽을 때마다 적는다 ──────────────────────────────────────────

drop function public.operator_reports(boolean, text, boolean, integer);
drop function public.operator_report(uuid);
drop function public.operator_report_snapshot(uuid);

/**
 * 신고 목록 — 최신부터 **30건씩.** 한 쪽의 수(30)는 이 함수만 안다(ADR 0103). 읽을 때마다 거른 조건을
 * 한 줄 적는다. 목록의 닉네임은 기록에 안 들어간다 — 무엇을 거르고 어느 쪽을 봤는지만.
 */
create function public.operator_reports(
  p_reviewed boolean default null,
  p_reason text default null,
  p_has_snapshot boolean default null,
  p_page integer default 0
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
  pages integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  page_size constant integer := 30;
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
           coalesce(case p_reviewed when true then 'reviewed' when false then 'unreviewed' end, 'all'),
           coalesce(p_reason, 'all'),
           coalesce(case p_has_snapshot when true then 'chat' when false then 'none' end, 'all'),
           p_page),
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
    ceil(count(*) over () / page_size::numeric)::integer
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  where (p_reviewed is null or (r.reviewed_at is not null) = p_reviewed)
    and (p_reason is null or r.reason = p_reason)
    and (p_has_snapshot is null or (s.report_id is not null) = p_has_snapshot)
  order by r.created_at desc, r.id desc
  limit page_size
  offset p_page::bigint * page_size;
end;
$$;

/**
 * 신고 한 건 — 두 계정의 **지금** 상태와 검토 기록까지(ADR 0105). 제재를 받은 쪽은 신고 안의 자리
 * (`reporter` · `reported`)로 낸다 — UUID 를 한 번 더 내지 않는다. 검토한 운영자는 닉네임으로.
 */
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
  context_after integer
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
    s.context_after
  from public.report r
  left join public.chat_report_snapshot s on s.report_id = r.id
  left join public.app_user reporter on reporter.id = r.reporter_user_id
  left join public.app_user reported on reported.id = r.reported_user_id
  left join public.app_user reviewer on reviewer.id = r.reviewed_by
  where r.id = p_report_id;
end;
$$;

/** 한 신고의 스냅샷 — 사본만 읽는다(ADR 0091 · 0103). 본문은 기록에 안 들어간다 — 어느 신고를 폈는지만 */
create function public.operator_report_snapshot(p_report_id uuid)
returns table (
  seq bigint,
  sent_at timestamptz,
  side text,
  body text,
  chosen boolean
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

  perform audit.note_app_access('reports.snapshot', p_report_id, null, 'allowed');

  return query
  select
    (e ->> 'seq')::bigint,
    (e ->> 'created_at')::timestamptz,
    case (e ->> 'sender_user_id')::uuid
      when r.reporter_user_id then 'reporter'
      when r.reported_user_id then 'reported'
    end,
    e ->> 'body',
    coalesce((e ->> 'chosen')::boolean, false)
  from public.chat_report_snapshot s
  join public.report r on r.id = s.report_id
  cross join lateral jsonb_array_elements(s.messages) e
  where s.report_id = p_report_id
  order by (e ->> 'seq')::bigint;
end;
$$;

/**
 * 거절을 적는다 — 운영자 문이 `42501` 을 던진 **뒤에** 앱의 문이 따로 부른다(머리말 「거절은 문 밖에서」).
 *
 * 운영자가 부르면 아무것도 안 적는다. 한 사람이 한 시간에 서른 줄을 넘게 적지 못한다 — 넘으면 조용히 끝난다
 * (거절을 적는 문이 다시 거절을 말하면 그것이 또 적을 거리가 된다).
 */
create function public.note_operator_denial(p_action text, p_report_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or public.is_operator() then
    return;
  end if;

  if p_action is null or p_action not in ('reports.list', 'reports.detail', 'reports.snapshot') then
    raise exception 'operator: unknown action' using errcode = '22023';
  end if;

  if (select count(*) from audit.operator_access a
      where a.actor_user_id = actor and a.outcome = 'denied'
        and a.at > clock_timestamp() - interval '1 hour') >= 30 then
    return;
  end if;

  perform audit.note_app_access(p_action, p_report_id, null, 'denied');
end;
$$;

-- ── 반출 — 크론만 부른다 ──────────────────────────────────────────────────────

/**
 * 지난 반출 뒤의 줄을 번호 차례로 — 방금(10분 안) 적힌 줄은 다음 번으로 미룬다.
 * `service_role` 만 부른다(크론 라우트의 열쇠). 이용자 개인정보가 없는 표라 그 열쇠에 연다.
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
  after_id bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_export as (
    select coalesce(max(e.last_id), 0) as after_id from audit.operator_access_export e
  )
  select a.id, a.at, a.channel, a.actor_user_id, a.actor_name, a.action, a.target_report_id,
         a.filter_summary, a.purpose, a.sql_sha256, a.outcome, l.after_id
  from audit.operator_access a, last_export l
  where a.id > l.after_id
    -- 방금 적힌 첫 줄 앞에서 멈춘다 — 그 뒤의 오래된 줄만 골라 가면 범위에 구멍이 난다
    and a.id < coalesce(
      (select min(b.id) from audit.operator_access b
       where b.id > l.after_id and b.at >= now() - interval '10 minutes'),
      9223372036854775807)
  order by a.id
  limit least(greatest(coalesce(p_limit, 5000), 1), 50000)
$$;

/**
 * 올린 범위를 적는다 — **바로 앞 반출의 끝 뒤에서 시작하고, 그 사이의 줄 수가 맞아야** 적힌다.
 * 어긋나면 `23514` 다 — 크론이 실패로 끝나 `cron` 알림이 아니라 Vercel 로그와 다음 실행이 본다.
 */
create function public.audit_export_done(
  p_after_id bigint, p_first_id bigint, p_last_id bigint, p_rows integer, p_sha256 text, p_object_key text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  previous bigint := (select coalesce(max(e.last_id), 0) from audit.operator_access_export e);
  counted integer;
begin
  if p_after_id is distinct from previous then
    raise exception 'audit: export must continue from %', previous using errcode = '23514';
  end if;

  select count(*)::integer into counted
  from audit.operator_access a where a.id > previous and a.id <= p_last_id;

  if counted is distinct from p_rows
     or p_first_id is distinct from (select min(a.id) from audit.operator_access a where a.id > previous) then
    raise exception 'audit: export range does not match the log' using errcode = '23514';
  end if;

  insert into audit.operator_access_export (first_id, last_id, rows, sha256, object_key)
  values (p_first_id, p_last_id, p_rows, p_sha256, p_object_key);
end;
$$;

revoke execute on function public.operator_reports(boolean, text, boolean, integer)
  from anon, public, service_role;
revoke execute on function public.operator_report(uuid) from anon, public, service_role;
revoke execute on function public.operator_report_snapshot(uuid) from anon, public, service_role;
revoke execute on function public.note_operator_denial(text, uuid) from anon, public, service_role;
revoke execute on function public.audit_export_batch(integer) from anon, public, authenticated;
revoke execute on function public.audit_export_done(bigint, bigint, bigint, integer, text, text)
  from anon, public, authenticated;

grant execute on function public.operator_reports(boolean, text, boolean, integer) to authenticated;
grant execute on function public.operator_report(uuid) to authenticated;
grant execute on function public.operator_report_snapshot(uuid) to authenticated;
grant execute on function public.note_operator_denial(text, uuid) to authenticated;
grant execute on function public.audit_export_batch(integer) to service_role;
grant execute on function public.audit_export_done(bigint, bigint, bigint, integer, text, text) to service_role;
