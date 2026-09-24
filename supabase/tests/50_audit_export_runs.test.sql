-- 접속기록 반출 실행 — 한 번에 하나, 어떻게 끝났는지가 남고, 실패는 알리며, CLI 질의는 결과까지 적힌다 (G-23 ⑩, ADR 0105)
--
-- 여기서 재는 것 다섯. (`20261014090000`)
--
--   A. **한 번에 하나** — 임대가 살아 있는 동안 둘째 시작은 「도는 중」으로 적히고 끝난다. 끝났거나 임대가 지난
--      실행은 막지 않는다. 같은 범위를 두 번 적어도 조용하고, 다른 범위는 전처럼 거절한다.
--      두 세션이 나란히 시작하는 경우는 `scripts/check-db-races.mjs` 가 잰다
--   B. **결과 · 집계** — 시도마다 결과 한 줄, 마지막 성공 · 연속 실패 · 밀린 줄, 운영자만 읽고 읽으면 남는다
--   B'. **알림** — 실패하면 그 자리에서, 이틀 넘게 시도가 없거나 성공이 없으면 감시가. 설정이 없는 동안은 조용하다
--   F. **CLI 결과** — 새 줄 하나가 앞 줄을 가리키고, 한 번만(같은 결과면 그 줄의 번호, `20261015090000`), 반출에 함께 나간다
--   ·. **아무도 못 고친다** — 두 새 표도 추가만 된다
begin;
select plan(37);

create temporary table folks as
select tests.signup('aer-operator@example.com') as operator, tests.signup('aer-stranger@example.com') as stranger;
grant select on folks to authenticated;
insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 반출 상태');

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

-- ── A. 한 번에 하나 ────────────────────────────────────────────────────────────

set local role service_role;
create temporary table first_run as select * from public.audit_export_begin();
create temporary table second_run as select * from public.audit_export_begin();
reset role;

select is((select busy from first_run), false, '처음 시작은 돈다');
select is((select busy from second_run), true, '앞 실행의 임대가 살아 있으면 둘째는 「도는 중」이다');
select is(
  (select r.outcome from audit.operator_access_export_result r where r.attempt_id = (select attempt_id from second_run)),
  'busy',
  '「도는 중」도 결과 한 줄로 남는다');

set local role service_role;
select lives_ok(format($$select public.audit_export_finish(%s, 'not_configured')$$, (select attempt_id from first_run)),
  '앞 실행을 끝낸다');
select lives_ok(format($$select public.audit_export_finish(%s, 'succeeded', 9)$$, (select attempt_id from first_run)),
  '같은 실행을 두 번 끝내도 넘어지지 않는다');
select is((select busy from public.audit_export_begin()), false, '끝난 실행은 막지 않는다');
reset role;

select is(
  (select array[r.outcome, r.rows::text] from audit.operator_access_export_result r
   where r.attempt_id = (select attempt_id from first_run)),
  array['not_configured', '0'],
  '두 번째로 끝낸 것은 처음 결과를 덮지 않는다');

-- 임대가 지난 실행(죽은 실행)은 막지 않는다 — 앞 시도는 결과 없이 임대만 지난 채로 둔다
insert into audit.operator_access_export_attempt (started_at, lease_until)
values (clock_timestamp() - interval '10 minutes', clock_timestamp() - interval '5 minutes');
-- 방금 연 실행(끝난 것 아님)을 끝내 둔다
select public.audit_export_finish(max(t.id) - 1, 'not_configured') from audit.operator_access_export_attempt t;
set local role service_role;
select is((select busy from public.audit_export_begin()), false, '결과 없이 임대가 지난 실행은 죽은 것으로 본다');
reset role;
select public.audit_export_finish(max(t.id), 'not_configured') from audit.operator_access_export_attempt t;

-- 같은 범위를 두 번 적는다
create temporary table before_export as
select coalesce(max(last_id), 0) as after_id from audit.operator_access_export;
insert into audit.operator_access (channel, actor_user_id, action, outcome, at)
select 'app', f.operator, 'reports.list', 'allowed', now() - interval '1 hour' from folks f;
set local role service_role;
create temporary table batch as select * from public.audit_export_batch(50000);
reset role;
create temporary table range as
select (select after_id from before_export) as after_id, min(id) as first_id, max(id) as last_id, count(*)::integer as rows
from batch;
grant select on range to service_role;

set local role service_role;
select lives_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('c', 64), 'operator-access/twice.jsonl')$$,
         (select after_id from range), (select first_id from range), (select last_id from range), (select rows from range)),
  '범위를 적는다');
select lives_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('c', 64), 'operator-access/twice.jsonl')$$,
         (select after_id from range), (select first_id from range), (select last_id from range), (select rows from range)),
  '같은 범위를 그대로 두 번 적어도 조용히 받는다 — 적고 응답을 잃은 실행');
select throws_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('d', 64), 'operator-access/twice.jsonl')$$,
         (select after_id from range), (select first_id from range), (select last_id from range), (select rows from range)),
  '23514', null, '같은 범위라도 해시가 다르면 거절한다');
reset role;
select is(
  (select count(*)::integer from audit.operator_access_export e where e.first_id = (select first_id from range)),
  1,
  '범위는 한 줄로 남는다');

-- ── B. 결과 · 집계 ─────────────────────────────────────────────────────────────

set local role service_role;
create temporary table ok_run as select * from public.audit_export_begin();
select public.audit_export_finish((select attempt_id from ok_run), 'succeeded', 3, 1, 10, 12);
create temporary table bad_run as select * from public.audit_export_begin();
select public.audit_export_finish((select attempt_id from bad_run), 'failed', p_error_class => 's3:accessdenied');
create temporary table half_run as select * from public.audit_export_begin();
select public.audit_export_finish((select attempt_id from half_run), 'misconfigured',
                                  p_error_class => 'missing:audit_export_region');
select throws_ok($$select public.audit_export_finish(1, 'busy')$$, '22023', null, '「도는 중」은 시작 문만 적는다');
reset role;

select throws_ok(
  format($$select public.audit_export_finish(%s, 'failed')$$, (select attempt_id from ok_run) + 100000),
  '23503', null, '없는 실행의 결과는 못 적는다');

select is(
  (select array[s.last_outcome, s.last_error_class, s.consecutive_failures::text]
   from audit.export_status() s),
  array['misconfigured', 'missing:audit_export_region', '2'],
  '집계는 마지막 시도와 마지막 성공 뒤의 연속 실패를 낸다');
select ok(
  (select s.last_success_at = (select r.finished_at from audit.operator_access_export_result r
                               where r.attempt_id = (select attempt_id from ok_run))
   from audit.export_status() s),
  '마지막 성공 시각은 성공한 실행이 끝난 때다');
select is(
  (select s.pending_rows from audit.export_status() s),
  (select count(*) from audit.operator_access a
   where a.id > (select coalesce(max(e.last_id), 0) from audit.operator_access_export e)),
  '밀린 줄은 마지막 반출 뒤의 줄 수다');
select throws_ok(
  $$insert into audit.operator_access_export_result (attempt_id, outcome) values (1, 'failed')$$,
  '23514', null, '실패에는 분류가 있어야 한다');

-- ── B'. 알림 ──────────────────────────────────────────────────────────────────

select ok(
  exists (select 1 from public.ops_alert a
          where a.kind = 'audit-export-failed' and a.day = (now() at time zone 'Asia/Seoul')::date
            and a.detail like '%s3:accessdenied%'),
  '실패로 끝나면 그 자리에서 운영 알림이 선다 — 분류를 싣는다');
select is(audit.watch_export(), 0, '오늘 시도가 있고 방금 성공이 있으면 감시는 조용하다');
select is(audit.watch_export(now() + interval '3 days'), 2,
  '사흘 뒤에도 그대로면 「안 돈다」와 「성공 없음」 둘을 알린다');
select ok(
  (select count(*) = 2 from public.ops_alert a
   where a.kind in ('audit-export-silent', 'audit-export-no-success')),
  '두 알림의 종류가 적힌다');

set local role service_role;
create temporary table off_run as select * from public.audit_export_begin();
select public.audit_export_finish((select attempt_id from off_run), 'not_configured');
reset role;
delete from public.ops_alert where kind in ('audit-export-silent', 'audit-export-no-success');
select is(
  (select array_agg(a.kind order by a.kind) from public.ops_alert a
   where a.kind in ('audit-export-silent', 'audit-export-no-success')),
  null,
  '(알림 표를 비운다)');
select is(audit.watch_export(now() + interval '1 day'), 0,
  '설정이 없는 동안은 성공이 없어도 조용하다 — AWS 계정이 아직 없다');
select is(audit.watch_export(now() + interval '3 days'), 1,
  '설정이 없어도 이틀 넘게 시도가 없으면 「안 돈다」는 알린다');

-- 운영자만 읽고, 읽으면 남는다
set local role authenticated;
select pg_temp.acting((select stranger from folks));
select throws_ok($$select * from public.operator_audit_export_status()$$, '42501', null,
  '운영자가 아니면 반출 상태를 못 읽는다');
select pg_temp.acting((select operator from folks));
select is((select last_outcome from public.operator_audit_export_status()), 'not_configured', '운영자는 읽는다');
reset role;
select is(
  (select array_agg(a.action || ':' || a.outcome) from audit.operator_access a
   where a.actor_user_id = (select operator from folks) and a.action = 'audit.export_status'),
  array['audit.export_status:allowed'],
  '읽은 것이 접속기록에 남는다');

-- ── F. CLI 결과 ───────────────────────────────────────────────────────────────

create temporary table cli as
select audit.note_cli_query('sungheeyoon', '반출 상태 확인', repeat('e', 64)) as query_id;
grant select on cli to service_role;

select ok(audit.note_cli_result((select query_id from cli), 'failed', 'sql') > (select query_id from cli),
  '끝난 뒤 결과가 새 줄로 적힌다');
select is(
  (select array[a.action, a.result, a.error_class, a.actor_name, a.purpose, a.sql_sha256]
   from audit.operator_access a where a.result_of = (select query_id from cli)),
  array['cli.result', 'failed', 'sql', 'sungheeyoon', '반출 상태 확인', repeat('e', 64)],
  '결과 줄은 앞 줄의 실행자 · 목적 · 해시를 옮겨 든다');
select throws_ok(format($$select audit.note_cli_result(%s, 'succeeded')$$, (select query_id from cli)),
  '23505', null, '같은 질의의 결과는 한 번만 — 다른 결과는 거절한다');
select is(
  audit.note_cli_result((select query_id from cli), 'failed', 'sql'),
  (select a.id from audit.operator_access a where a.result_of = (select query_id from cli)),
  '같은 결과를 다시 적으면 이미 적힌 줄의 번호가 돌아온다 — 줄은 하나 (`20261015090000`)');
select ok(
  (select i.indisunique and pg_get_expr(i.indpred, i.indrelid) = '(result_of IS NOT NULL)'
   from pg_index i where i.indexrelid = 'audit.operator_access_result_of'::regclass),
  '결과 한 줄은 부분 유일 인덱스가 든다 — 나란히 적는 두 세션은 `scripts/check-db-races.mjs` 5');
select throws_ok(
  $$insert into audit.operator_access (channel, actor_name, action, purpose, sql_sha256, outcome, result_of, result)
    values ('cli', 'x', 'cli.result', '목적 넷자', repeat('e', 64), 'allowed', 1, 'failed')$$,
  '23514', null, '실패한 결과에는 분류가 있어야 한다');

set local role service_role;
select is(
  (select array[b.action, b.result, b.error_class, b.result_of::text]
   from public.audit_export_batch(50000) b where b.result_of = (select query_id from cli)),
  array['cli.result', 'failed', 'sql', (select query_id from cli)::text],
  'CLI 결과는 반출에 함께 나간다');
reset role;

-- ── ·. 아무도 못 고친다 ────────────────────────────────────────────────────────

select throws_ok($$update audit.operator_access_export_result set outcome = 'succeeded'$$, '42501', null,
  '소유자도 결과를 고칠 권한이 없다');
grant update on audit.operator_access_export_attempt to postgres;
select throws_ok($$update audit.operator_access_export_attempt set lease_until = now()$$, '55000', null,
  '권한을 되돌려도 트리거가 시도를 고치지 못하게 한다');

select * from finish();
rollback;
