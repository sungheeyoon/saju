-- 접속기록 반출은 한 번에 하나만 돌고, 돌 때마다 어떻게 끝났는지를 DB 에 남기며, CLI 질의는 끝난 결과까지 적힌다 (G-23 ⑩, ADR 0105)
--
-- 운영자 결정(2026-09-24): AWS 계정이 서기 전에 반출을 끝까지 다듬는다 — 코드와 시험과 runbook 까지. 앞
-- `20261013090000` 이 「늦게 커밋된 줄」을 닫았고, 여기서는 반출 **실행 하나**의 둘레를 닫는다.
--
-- ## A. 겹쳐 돌면 하나만 — 임대(lease) 한 줄
--
-- 반출 한 번은 트랜잭션 셋에 걸친다(읽기 → S3 → 범위 적기). 트랜잭션 자물쇠로는 그 전체를 못 묶는다. 그래서
-- 실행이 시작할 때 **시도 한 줄**(`audit.operator_access_export_attempt`)을 적고 5분 임대를 건다. 다음 시작은
-- 자물쇠 안에서 「결과가 아직 없고 임대가 살아 있는 시도」를 보면 **「이미 도는 중」(`busy`)으로 적고 끝난다.**
-- 크론 라우트의 최대 실행은 60초라 5분 임대는 넉넉하고, 죽은 실행의 임대는 5분 뒤 저절로 풀린다.
--
-- 범위를 적는 문(`audit_export_done`)은 **같은 범위를 두 번 받으면 조용히 받아들인다** — 올리고 적은 뒤 응답을
-- 잃은 실행이 다시 적어도 실패가 아니다. 범위가 같고 해시 · 객체 키 · 행 수까지 같을 때만이다. 다르면 전처럼 거절.
--
-- ## B. 실패는 DB 에 — 시도마다 결과 한 줄, 집계, 알림
--
-- 결과(`audit.operator_access_export_result`)는 시도마다 한 줄 — 성공 · 실패 · 설정 없음 · 설정 오류 · 도는 중,
-- 끝난 시각, 올린 행 수와 객체 수, 번호 범위, **오류 분류**(오류 문장이 아니다 — 열쇠 · 버킷 이름이 섞일 수
-- 있다). 둘 다 추가만 된다. 집계는 `audit.export_status()` 하나 — 마지막 성공 시각 · 연속 실패 수 · 밀린 행 수 ·
-- 마지막 시도. 운영자는 `public.operator_audit_export_status()`(읽으면 접속기록에 남는다)로, runbook 은
-- `npm run db:remote` 로 같은 함수를 읽는다.
--
-- 알림은 이미 있는 길(`notify_ops` → Vault 의 `ops_alert_url`, 하루 한 종류 한 번)을 탄다:
--   - 실패 · 설정 오류로 끝나면 그 자리에서 `audit-export-failed`(연속 실패 수와 분류를 싣는다)
--   - 매일 한 번 감시(`audit-export-watch`): 마지막 시도가 이틀 넘게 없으면 `audit-export-silent`(크론이
--     멈췄다), 설정이 켜졌는데 이틀 넘게 성공이 없으면 `audit-export-no-success`
--   설정이 없는 동안(`not_configured`)은 조용하다 — AWS 계정이 아직 없다. 시도가 한 번도 없으면(배포 전) 조용하다.
--
-- ## F. CLI 질의가 어떻게 끝났는지 — 새 줄로
--
-- `npm run db:remote` 는 SQL 을 보내기 전에 한 줄(`cli.query`)을 적는다. 이제 끝난 뒤 **새 줄 하나**
-- (`cli.result`)가 그 줄의 번호(`result_of`)와 성공/실패 · 오류 분류를 든다. 표는 추가만 되므로 앞 줄을 고치지
-- 않는다. 반출에도 함께 나간다 — 반출 문의 반환 칸이 셋 늘어 지우고 다시 짓는다(옛 앱은 아는 칸만 집는다).
-- 기존 줄의 새 칸 셋은 비어 있다(`null`) — 결과를 적기 전의 줄이라 결과가 없다는 뜻이 맞다. 칼럼은 기본값 없이
-- 더하므로 표를 다시 쓰지 않고 update 금지 트리거도 안 건드린다.

-- ── F. CLI 결과 칸 ─────────────────────────────────────────────────────────────

alter table audit.operator_access
  add column result_of bigint,
  add column result text check (result is null or result in ('succeeded', 'failed')),
  add column error_class text check (error_class is null or error_class ~ '^[a-z0-9_.:-]{1,60}$');

comment on column audit.operator_access.result_of is 'cli.result 이면 그 결과가 가리키는 cli.query 줄의 번호';

alter table audit.operator_access drop constraint operator_access_action_check;
alter table audit.operator_access add constraint operator_access_action_check
  check (action in ('reports.list', 'reports.detail', 'reports.snapshot', 'credits.refund_basis',
                    'audit.export_status', 'cli.query', 'cli.result'));

alter table audit.operator_access drop constraint app_access_names_the_operator;
alter table audit.operator_access add constraint app_access_names_the_operator check (
  channel <> 'app' or (actor_user_id is not null and actor_name is null and purpose is null
                       and sql_sha256 is null and result_of is null and result is null and error_class is null
                       and (action like 'reports.%' or action like 'credits.%' or action like 'audit.%')));

alter table audit.operator_access drop constraint cli_access_names_purpose_and_hash;
alter table audit.operator_access add constraint cli_access_names_purpose_and_hash check (
  channel <> 'cli' or (actor_name is not null and purpose is not null and sql_sha256 is not null
                       and outcome = 'allowed'
                       and ((action = 'cli.query' and result_of is null and result is null and error_class is null)
                         or (action = 'cli.result' and result_of is not null and result is not null
                             and (result = 'failed') = (error_class is not null)))));

create index operator_access_result_of on audit.operator_access (result_of) where result_of is not null;

/**
 * CLI 가 SQL 을 보낸 **뒤에** 결과 한 줄을 더한다 — `scripts/db-remote.mjs` 가 같은 잠금 안에서 부른다.
 * 앞 줄의 실행자 · 목적 · 해시를 그대로 옮겨 적는다 — 결과 줄만 보고도 무엇의 결과인지 안다. 같은 줄의 결과는
 * 한 번만.
 *
 * @returns 적은 줄의 번호
 */
create function audit.note_cli_result(p_query_id bigint, p_result text, p_error_class text default null)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  q audit.operator_access;
  written bigint;
begin
  select * into q from audit.operator_access a where a.id = p_query_id and a.action = 'cli.query';
  if not found then
    raise exception 'audit: no such cli query %', p_query_id using errcode = 'no_data_found';
  end if;

  if exists (select 1 from audit.operator_access a where a.result_of = p_query_id) then
    raise exception 'audit: the result of % is already written', p_query_id using errcode = '23505';
  end if;

  insert into audit.operator_access
    (channel, actor_name, action, purpose, sql_sha256, outcome, result_of, result, error_class)
  values ('cli', q.actor_name, 'cli.result', q.purpose, q.sql_sha256, 'allowed', q.id, p_result,
          case when p_result = 'failed' then coalesce(p_error_class, 'unknown') end)
  returning id into written;

  return written;
end;
$$;

revoke execute on function audit.note_cli_result(bigint, text, text) from public, anon, authenticated, service_role;

-- 반출 문 — 칸 셋이 는다. 본문은 `20261013090000` 의 살아 있는 정의 그대로(자물쇠 · 격리 확인)
drop function public.audit_export_batch(integer);

/**
 * 지난 반출 뒤의 줄을 번호 차례로 — **배타 자물쇠를 잡은 뒤에** 읽는다(`20261013090000`). CLI 결과 칸 셋을 함께 낸다.
 * `service_role` 만 부른다(크론 라우트의 열쇠).
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
  after_id bigint
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
         a.filter_summary, a.purpose, a.sql_sha256, a.outcome, a.result_of, a.result, a.error_class, l.after_id
  from audit.operator_access a, last_export l
  where a.id > l.after_id
  order by a.id
  limit least(greatest(coalesce(p_limit, 5000), 1), 50000);
end;
$$;

revoke execute on function public.audit_export_batch(integer) from public, anon, authenticated, service_role;
grant execute on function public.audit_export_batch(integer) to service_role;

-- ── A. 한 번에 하나 ────────────────────────────────────────────────────────────

/** 반출 실행 하나 — 시작할 때 적힌다. 임대가 살아 있고 결과가 없으면 「도는 중」이다 */
create table audit.operator_access_export_attempt (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default clock_timestamp(),
  lease_until timestamptz not null
);

/**
 * 실행 하나의 결과 — 한 줄. 오류는 문장이 아니라 분류만. 시도 표에 외래키를 걸지 않는다 — 외래키 검사는
 * 소유자가 시도 줄을 `for key share` 로 잠그는데 그것은 update 권한을 요구하고, 소유자는 그 권한을 걷었다.
 * 없는 시도의 결과는 `audit_export_finish` 가 막는다.
 */
create table audit.operator_access_export_result (
  attempt_id bigint primary key,
  finished_at timestamptz not null default clock_timestamp(),
  outcome text not null check (outcome in ('succeeded', 'failed', 'not_configured', 'misconfigured', 'busy')),
  rows integer not null default 0 check (rows >= 0),
  objects integer not null default 0 check (objects >= 0),
  first_id bigint,
  last_id bigint,
  error_class text check (error_class is null or error_class ~ '^[a-z0-9_.:-]{1,60}$'),
  constraint failure_has_a_class check ((outcome in ('failed', 'misconfigured')) = (error_class is not null)),
  constraint range_is_whole check ((first_id is null) = (last_id is null) and (first_id is null or first_id <= last_id))
);

comment on table audit.operator_access_export_attempt is
  '접속기록 반출 실행 — 시작할 때 한 줄, 5분 임대. 추가만 된다 (G-23 ⑩, ADR 0105)';
comment on table audit.operator_access_export_result is
  '접속기록 반출 실행의 결과 — 실행마다 한 줄, 오류는 분류만. 추가만 된다 (G-23 ⑩, ADR 0105)';

alter table audit.operator_access_export_attempt enable row level security;
alter table audit.operator_access_export_result enable row level security;
revoke all on audit.operator_access_export_attempt, audit.operator_access_export_result
  from public, anon, authenticated, service_role;
revoke update, delete, truncate on audit.operator_access_export_attempt, audit.operator_access_export_result
  from postgres;

create trigger export_attempt_is_append_only
before update or delete on audit.operator_access_export_attempt
for each row execute function audit.refuse_rewrite();
create trigger export_attempt_is_not_truncated
before truncate on audit.operator_access_export_attempt
for each statement execute function audit.refuse_rewrite();
create trigger export_result_is_append_only
before update or delete on audit.operator_access_export_result
for each row execute function audit.refuse_rewrite();
create trigger export_result_is_not_truncated
before truncate on audit.operator_access_export_result
for each statement execute function audit.refuse_rewrite();

/**
 * 반출 실행을 시작한다 — 살아 있는 다른 실행이 있으면 **「도는 중」으로 적고 그 사실을 돌려준다.** 시작끼리는
 * 자물쇠 하나로 줄 선다 — 나란히 둘이 와도 뒤는 앞의 시도 줄을 본다.
 *
 * @returns 이 실행의 시도 번호와 「이미 도는 중」인지
 */
create function public.audit_export_begin()
returns table (attempt_id bigint, busy boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  started bigint;
  running boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('audit:operator_access:export-run', 0));

  running := exists (
    select 1 from audit.operator_access_export_attempt t
    where t.lease_until > clock_timestamp()
      and not exists (select 1 from audit.operator_access_export_result r where r.attempt_id = t.id));

  insert into audit.operator_access_export_attempt (lease_until)
  values (case when running then clock_timestamp() else clock_timestamp() + interval '5 minutes' end)
  returning id into started;

  if running then
    insert into audit.operator_access_export_result (attempt_id, outcome) values (started, 'busy');
  end if;

  return query select started, running;
end;
$$;

-- ── B. 결과 · 집계 · 알림 ──────────────────────────────────────────────────────

/**
 * 반출의 지금 — 마지막 성공 시각 · 연속 실패 수(도는 중은 건너뛴다) · 밀린 행 수 · 마지막 시도. 개인을 가리키는
 * 값이 없다 — CLI(`npm run db:remote`)로 읽어도 된다. `p_now` 는 시험이 「사흘 뒤」를 재는 손잡이다.
 */
create function audit.export_status(p_now timestamptz default now())
returns table (
  last_attempt_at timestamptz,
  last_outcome text,
  last_error_class text,
  last_success_at timestamptz,
  consecutive_failures integer,
  pending_rows bigint,
  last_exported_id bigint,
  attempts_7d integer,
  failures_7d integer
)
language sql
stable
set search_path = ''
as $$
  with finished as (
    select t.started_at, r.finished_at, r.outcome, r.error_class
    from audit.operator_access_export_attempt t
    join audit.operator_access_export_result r on r.attempt_id = t.id
    where r.outcome <> 'busy'
  ),
  last_success as (
    select max(f.finished_at) as at from finished f where f.outcome = 'succeeded'
  ),
  last_one as (
    select f.* from finished f order by f.started_at desc limit 1
  ),
  exported as (
    select coalesce(max(e.last_id), 0) as last_id from audit.operator_access_export e
  )
  select
    (select l.started_at from last_one l),
    (select l.outcome from last_one l),
    (select l.error_class from last_one l),
    (select s.at from last_success s),
    (select count(*)::integer from finished f, last_success s
     where f.outcome in ('failed', 'misconfigured') and (s.at is null or f.finished_at > s.at)),
    (select count(*) from audit.operator_access a, exported x where a.id > x.last_id),
    (select x.last_id from exported x),
    (select count(*)::integer from finished f where f.started_at > p_now - interval '7 days'),
    (select count(*)::integer from finished f
     where f.started_at > p_now - interval '7 days' and f.outcome in ('failed', 'misconfigured'))
$$;

/**
 * 반출 실행을 끝낸다 — 결과 한 줄. 실패 · 설정 오류면 그 자리에서 알린다(`notify_ops`, 하루 한 번).
 * 같은 시도를 두 번 끝내면 뒤는 조용히 지나간다.
 */
create function public.audit_export_finish(
  p_attempt_id bigint, p_outcome text, p_rows integer default 0, p_objects integer default 0,
  p_first_id bigint default null, p_last_id bigint default null, p_error_class text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  failures integer;
begin
  if p_outcome = 'busy' then
    raise exception 'audit: busy is written by begin' using errcode = '22023';
  end if;

  if not exists (select 1 from audit.operator_access_export_attempt t where t.id = p_attempt_id) then
    raise exception 'audit: no such export attempt %', p_attempt_id using errcode = '23503';
  end if;

  insert into audit.operator_access_export_result
    (attempt_id, outcome, rows, objects, first_id, last_id, error_class)
  values (p_attempt_id, p_outcome, coalesce(p_rows, 0), coalesce(p_objects, 0), p_first_id, p_last_id,
          case when p_outcome in ('failed', 'misconfigured') then coalesce(p_error_class, 'unknown') end)
  on conflict (attempt_id) do nothing;

  if found and p_outcome in ('failed', 'misconfigured') then
    select s.consecutive_failures into failures from audit.export_status() s;
    perform public.notify_ops(
      'audit-export-failed',
      format('접속기록 반출이 %s 로 끝났다(분류 %s) — 연속 %s번. runbook 「반출」의 상태 질의로 본다',
             p_outcome, coalesce(p_error_class, 'unknown'), failures));
  end if;
end;
$$;

/**
 * 하루 한 번 — 크론이 멈췄는가(이틀 넘게 시도 없음), 켜졌는데 이틀 넘게 성공이 없는가. 시도가 한 번도 없거나
 * 설정이 없는 동안은 조용하다.
 *
 * @returns 이번에 새로 알린 수
 */
create function audit.watch_export(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  told integer := 0;
begin
  select * into s from audit.export_status(p_now);

  if s.last_attempt_at is null then
    return 0;
  end if;

  if s.last_attempt_at < p_now - interval '2 days'
     and public.notify_ops('audit-export-silent',
           format('접속기록 반출이 %s 뒤로 한 번도 안 돌았다 — Vercel Cron 을 본다', s.last_attempt_at)) then
    told := told + 1;
  end if;

  if s.last_outcome <> 'not_configured'
     and (s.last_success_at is null or s.last_success_at < p_now - interval '2 days')
     and public.notify_ops('audit-export-no-success',
           format('접속기록 반출이 이틀 넘게 성공하지 못했다 — 마지막 성공 %s, 연속 실패 %s, 밀린 줄 %s',
                  coalesce(s.last_success_at::text, '없음'), s.consecutive_failures, s.pending_rows)) then
    told := told + 1;
  end if;

  return told;
end;
$$;

/** 운영자가 반출의 지금을 읽는다 — 읽으면 접속기록에 한 줄 */
create function public.operator_audit_export_status()
returns table (
  last_attempt_at timestamptz,
  last_outcome text,
  last_error_class text,
  last_success_at timestamptz,
  consecutive_failures integer,
  pending_rows bigint,
  last_exported_id bigint,
  attempts_7d integer,
  failures_7d integer
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

  perform audit.note_app_access('audit.export_status', null, null, 'allowed');

  return query select * from audit.export_status();
end;
$$;

-- ── A. 같은 범위는 한 번만 — 두 번째는 조용히 ──────────────────────────────────

create or replace function public.audit_export_done(
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
  -- 이미 적힌 그 범위 그대로면 받아들인다 — 적고 응답을 잃은 실행이 다시 적는 자리
  if exists (select 1 from audit.operator_access_export e
             where e.first_id = p_first_id and e.last_id = p_last_id and e.rows = p_rows
               and e.sha256 = p_sha256 and e.object_key = p_object_key) then
    return;
  end if;

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

-- ── 권한 ──────────────────────────────────────────────────────────────────────

revoke execute on function
  audit.export_status(timestamptz),
  audit.watch_export(timestamptz)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.audit_export_begin(),
  public.audit_export_finish(bigint, text, integer, integer, bigint, bigint, text),
  public.operator_audit_export_status()
  from public, anon, authenticated, service_role;

grant execute on function public.audit_export_begin() to service_role;
grant execute on function public.audit_export_finish(bigint, text, integer, integer, bigint, bigint, text)
  to service_role;
grant execute on function public.operator_audit_export_status() to authenticated;

/** 매일 06:29 UTC — 반출 크론(18:37 UTC ±59분)과 다른 잡(매분 · 7 · 23 · 10분마다 · 47 · 04:53)과 안 겹친다 */
select cron.unschedule('audit-export-watch')
where exists (select 1 from cron.job where jobname = 'audit-export-watch');

select cron.schedule('audit-export-watch', '29 6 * * *', 'select audit.watch_export()');
