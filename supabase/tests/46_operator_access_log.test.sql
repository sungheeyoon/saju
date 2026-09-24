-- 운영자 접속기록 — 읽을 때마다 남고, 아무도 못 고치고, 이어 붙여 반출된다 (G-23 ⑩, ADR 0105)
--
-- 여기서 재는 것 일곱.
--
--   1. **운영자 문 셋이 읽을 때마다 한 줄씩 적는다** — 목록은 거른 조건, 상세 · 스냅샷은 신고 id. 닉네임 ·
--      본문 · 이메일은 기록에 없다
--   2. **거절은 문 안에서 안 남고(되감긴다) 따로 부르는 문이 남긴다** — 운영자가 부르면 안 적고, 한 시간
--      서른 줄이 넘으면 조용히 멈춘다
--   3. **아무도 못 고친다** — 소유자 `postgres` 도 권한이 없고, 권한을 다시 줘도 트리거가 막는다. 비우기도
--   4. **운영자를 포함해 API 역할은 표를 못 읽는다** — 읽는 손은 반출 문(`service_role`) 과 운영 SQL 뿐
--   5. **CLI 는 목적과 해시만 적는다** — 이메일처럼 생긴 목적은 거절한다. API 역할은 그 함수를 못 부른다
--   6. **반출은 이어 붙인다** — 앞 반출에서 이어지지 않거나 줄 수가 틀리면 적히지 않는다. 방금 적힌 줄도 바로
--      나가고, 늦게 커밋된 줄을 건너뛰지 않게 **쓰기는 공유 · 반출은 배타로 같은 자물쇠를 쥔다**(`20261013090000`).
--      두 세션의 실제 경합은 `scripts/check-db-races.mjs` 가 재고, 여기서는 같은 자물쇠를 쥐는가를 잰다
--   7. **advisor 가 보는 모양** — 새 문은 전부 search_path 가 고정됐고, 로그인한 사람에게 열린 새 definer 는
--      거절을 적는 문 하나다(lint 0029 가 하나 는다 — runbook 「보안 advisor」)
begin;
select plan(42);

create temporary table folks as
select
  tests.signup('oal-reporter@example.com') as reporter,
  tests.signup('oal-reported@example.com') as reported,
  tests.signup('oal-stranger@example.com') as stranger,
  tests.signup('oal-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 접속기록');

create or replace function pg_temp.report(who uuid, whom uuid)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason, detail)
  values (who, whom, 'harassment', '비밀스러운 덧붙임') returning id
$$;

create temporary table cases as
select pg_temp.report(reporter, reported) as one from folks;
grant select on cases to authenticated, service_role, anon;

insert into public.chat_report_snapshot
  (report_id, match_id, message_id, context_before, context_after, messages, captured_at)
select c.one, gen_random_uuid(), gen_random_uuid(), 0, 0,
  jsonb_build_array(jsonb_build_object('message_id', gen_random_uuid(), 'seq', 1, 'sender_user_id', f.reported,
                                       'body', '기록에 들어가면 안 되는 본문', 'created_at', now(), 'chosen', true)),
  now()
from cases c, folks f;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 이 파일이 만든 사람의 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.lines(who uuid)
returns table (action text, target uuid, filter text, outcome text)
language sql security definer as $$
  select a.action, a.target_report_id, a.filter_summary, a.outcome
  from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated, service_role, anon;

-- ── 6. 반출 ─────────────────────────────────────────────────────────────────

create temporary table before_export as
select coalesce(max(last_id), 0) as after_id from audit.operator_access_export;

/**
 * 반출 한 번에 가져갈 줄 수 — 함수의 상한(50000)이다. 표는 전역이고 로컬 스택에는 e2e 가 남긴, 아직 반출 안 된
 * 줄이 쌓인다. 100 으로 부르면 그 줄이 100 을 넘는 날 이 파일이 만든 줄이 배치 밖으로 밀려 셋(2 · 5 · 11)이
 * 붉었다(#219, 공유 로컬 DB). 깨끗한 DB 에서는 같은 답이다 — 무엇을 재는지는 안 바뀐다.
 */
create or replace function pg_temp.export_limit() returns integer language sql as $$ select 50000 $$;

/** 이 세션이 쥔 advisory 자물쇠 — 열쇠와 모드 */
create or replace function pg_temp.holds(key bigint)
returns text language sql as $$
  select string_agg(l.mode, ',' order by l.mode) from pg_locks l
  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.granted and l.objsubid = 1
    and ((l.classid::bigint << 32) | l.objid::bigint) = key
$$;

insert into audit.operator_access (channel, actor_user_id, action, target_report_id, outcome)
select 'app', f.reporter, 'reports.detail', c.one, 'allowed' from folks f, cases c;

select is(pg_temp.holds(audit.export_lock_key()), 'ShareLock',
  '쓰는 문장은 반출의 자물쇠를 공유로 쥔다 — 커밋까지');
select is(
  (select array_agg(b.at > now() - interval '1 minute') from public.audit_export_batch(pg_temp.export_limit()) b
   where b.actor_user_id = (select reporter from folks)),
  array[true],
  '방금 적힌 줄도 바로 나간다 — 10분을 기다리지 않는다');
select is(pg_temp.holds(audit.export_lock_key()), 'ExclusiveLock,ShareLock',
  '반출은 같은 자물쇠를 배타로 쥔 뒤에 읽는다 — 그 전에 번호를 받은 쓰기가 다 끝나야 한다');
select is(
  (select array[t.tgname::text, (t.tgtype & 1)::text, (t.tgtype & 2)::text, (t.tgtype & 4)::text]
   from pg_trigger t where t.tgrelid = 'audit.operator_access'::regclass
     and t.tgfoid = 'audit.hold_for_export()'::regprocedure),
  array['operator_access_waits_for_export', '0', '2', '4'],
  '자물쇠는 문장 트리거가 insert 앞에서 잡는다 — 줄 트리거면 번호를 받은 뒤라 늦다');

insert into audit.operator_access (channel, actor_user_id, action, target_report_id, outcome, at)
select 'app', f.operator, 'reports.detail', c.one, 'allowed', now() - make_interval(hours => n)
from folks f, cases c, generate_series(3, 1, -1) n;

create temporary table batch as
select * from public.audit_export_batch(pg_temp.export_limit());

select is(
  (select count(*)::integer from batch),
  (select count(*)::integer from audit.operator_access a where a.id > (select after_id from before_export)),
  '반출은 지난 반출 뒤의 오래된 줄을 전부 번호 차례로 가져간다');

select is(
  (select distinct after_id from batch),
  (select after_id from before_export),
  '가져간 줄은 어디서 이어지는지(after_id)를 함께 든다');

select throws_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('a', 64), 'k')$$,
         (select after_id from before_export) + 1, (select min(id) from batch), (select max(id) from batch),
         (select count(*) from batch)),
  '23514', null, '앞 반출의 끝에서 이어지지 않으면 적히지 않는다 — 빠짐');

select throws_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('a', 64), 'k')$$,
         (select after_id from before_export), (select min(id) from batch), (select max(id) from batch),
         (select count(*) - 1 from batch)),
  '23514', null, '범위 안의 줄 수가 틀리면 적히지 않는다');

select lives_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('a', 64), 'operator-access/x.jsonl')$$,
         (select after_id from before_export), (select min(id) from batch), (select max(id) from batch),
         (select count(*) from batch)),
  '맞는 범위는 적힌다');

select throws_ok(
  format($$select public.audit_export_done(%s, %s, %s, %s, repeat('a', 64), 'k')$$,
         (select after_id from before_export), (select min(id) from batch), (select max(id) from batch),
         (select count(*) from batch)),
  '23514', null, '같은 범위를 두 번 적지 못한다 — 겹침');

select is(
  (select count(*)::integer from public.audit_export_batch(pg_temp.export_limit())),
  0,
  '적은 뒤에는 다음 반출이 그 뒤에서 시작한다');

-- ── 1. 운영자가 읽으면 적힌다 ──────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select ok((select count(*) >= 1 from public.operator_reports(p_reviewed => false, p_reason => 'harassment')),
  '운영자는 목록을 읽는다');
select ok((select count(*) = 1 from public.operator_report((select one from cases))), '한 건을 읽는다');
select ok((select count(*) = 1 from public.operator_report_snapshot((select one from cases))), '스냅샷을 읽는다');

select results_eq(
  $$select action, target, filter, outcome from pg_temp.lines((select operator from folks))
    where action in ('reports.list', 'reports.snapshot')$$,
  $$values ('reports.list', null::uuid, 'review=open reason=harassment evidence=all page=0', 'allowed'),
           ('reports.snapshot', (select one from cases), null::text, 'allowed')$$,
  '목록은 거른 조건을, 스냅샷은 신고 id 를 적는다');

select is(
  (select count(*)::integer from pg_temp.lines((select operator from folks)) l
   where l.action = 'reports.detail' and l.outcome = 'allowed'),
  4,
  '상세도 한 줄 — 반출 시험의 셋과 합쳐 넷');

reset role;
select is(
  (select count(*)::integer from audit.operator_access a
   where to_jsonb(a)::text ~ '(비밀스러운|기록에 들어가면|oal-|@example)'),
  0,
  '기록에 덧붙인 말 · 메시지 본문 · 이메일이 없다');

-- ── 2. 거절 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok($$select * from public.operator_reports()$$, '42501', null, '운영자가 아니면 목록 문은 던진다');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '던진 문 안에서는 아무것도 안 남는다 — 되감긴다');

select lives_ok($$select public.note_operator_denial('reports.list')$$, '거절은 따로 부르는 문이 적는다');
select lives_ok(format($$select public.note_operator_denial('reports.detail', %L)$$, (select one from cases)),
  '상세의 거절은 신고 id 와 함께');
select results_eq(
  $$select action, target, outcome from pg_temp.lines((select stranger from folks))$$,
  $$values ('reports.list', null::uuid, 'denied'), ('reports.detail', (select one from cases), 'denied')$$,
  '거절한 줄이 동작 · 대상 · 거절로 남는다');

select throws_ok($$select public.note_operator_denial('cli.query')$$, '22023', null, '모르는 동작은 안 받는다');

select lives_ok($$select public.note_operator_denial('reports.list') from generate_series(1, 40)$$,
  '마흔 번 불러도 넘어지지 않는다');
select is(pg_temp.holds(hashtextextended('audit:denial:' || (select stranger from folks)::text, 0)), 'ExclusiveLock',
  '거절을 세기 전에 그 사람의 자물쇠를 쥔다 — 나란히 온 둘이 같은 수를 보지 않는다');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 30,
  '한 사람의 거절은 한 시간에 서른 줄에서 멈춘다 — 표를 채우는 도구가 되지 않는다');

select pg_temp.acting((select operator from folks));
select public.note_operator_denial('reports.list');
select is((select count(*)::integer from pg_temp.lines((select operator from folks)) where outcome = 'denied'), 0,
  '운영자가 부르면 거절을 안 적는다');

-- ── 4. 누가 읽나 ────────────────────────────────────────────────────────────

select throws_ok($$select 1 from audit.operator_access$$, '42501', null, '운영자도 표를 직접 못 읽는다');
set local role anon;
select throws_ok($$select 1 from audit.operator_access$$, '42501', null, '로그인 안 한 쪽도');
select throws_ok($$select * from public.audit_export_batch()$$, '42501', null, '반출 문은 로그인 안 한 쪽에 없다');
set local role service_role;
select throws_ok($$select 1 from audit.operator_access$$, '42501', null, 'service_role 도 표는 직접 못 읽는다');
select lives_ok($$select * from public.audit_export_batch(1)$$, 'service_role 은 반출 문으로만 읽는다');
set local role authenticated;
select throws_ok($$select * from public.audit_export_batch()$$, '42501', null, '로그인한 사람에게는 반출 문이 없다');

-- ── 3. 아무도 못 고친다 ──────────────────────────────────────────────────────

reset role;
select throws_ok($$update audit.operator_access set outcome = 'denied'$$, '42501', null,
  '소유자도 고칠 권한이 없다');
select throws_ok($$delete from audit.operator_access$$, '42501', null, '소유자도 지울 권한이 없다');
select throws_ok($$truncate audit.operator_access$$, '42501', null, '소유자도 비울 권한이 없다');

grant update, delete, truncate on audit.operator_access to postgres;
select throws_ok($$update audit.operator_access set outcome = 'denied'$$, '55000', null,
  '권한을 되돌려도 트리거가 고치기를 막는다');
select throws_ok($$delete from audit.operator_access$$, '55000', null, '지우기도');
select throws_ok($$truncate audit.operator_access$$, '55000', null, '비우기도');

-- ── 5. CLI ──────────────────────────────────────────────────────────────────

select ok(audit.note_cli_query('sungheeyoon', '미검토 신고 건수 확인', repeat('b', 64)) > 0,
  'CLI 는 목적과 해시로 한 줄 적는다');
select throws_ok($$select audit.note_cli_query('x', 'someone@example.com 조회', repeat('b', 64))$$, '23514', null,
  '이메일처럼 생긴 목적은 안 받는다');

-- ── 7. advisor 가 보는 모양 ─────────────────────────────────────────────────

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by p.proname collate "C"), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.proname in ('note_operator_denial', 'audit_export_batch', 'audit_export_done', 'note_app_access',
                       'note_cli_query', 'refuse_rewrite', 'operator_reports', 'operator_report',
                       'operator_report_snapshot')
     and n.nspname in ('public', 'audit')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.prosecdef),
  array['public.note_operator_denial', 'public.operator_report', 'public.operator_report_snapshot',
        'public.operator_reports'],
  '로그인한 사람에게 열린 이 PR 의 definer 는 운영자 문 셋과 거절을 적는 문 하나다 (lint 0029)');

select * from finish();
rollback;
