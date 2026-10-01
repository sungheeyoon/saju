-- 운영자 설문 문 일곱도 읽을 때마다 접속기록에 남는다 (ADR 0105 추기 2026-10-01, 운영자 결정 2026-10-01)
--
-- `/ops/survey` 의 문(`app/ops/survey/read.ts`)이 부르는 운영자 문 일곱 — 풀이 설문 넷(`operator_survey_*`)과 서비스
-- 설문 셋(`operator_service_survey_*`) — 은 집계와 적어 주신 글을 내지만 누가 언제 읽었는지가 남지 않았다. 신고 문
-- 셋(`46_operator_access_log`)과 같은 원칙으로 잰다.
--
--   1. **운영자가 읽으면 문마다 한 줄** — 동작은 `survey.*`, 대상 · 거른 조건은 비어 있다. 설문 답 · 글 원문은 기록에 없다
--   2. **거절은 문 안에서 안 남고(되감긴다) 따로 부르는 문이 남긴다** — `note_operator_denial` 이 설문 동작을 받는다
--   3. **반출이 새 동작을 그대로 가져간다** — `audit_export_batch` 가 걸러 내지 않는다
--   4. **모양** — 일곱은 쓰므로 `volatile` 이고, 로그인한 사람에게만 열려 있다
begin;
select plan(17);

create temporary table folks as
select
  tests.signup('osl-respondent@example.com') as respondent,
  tests.signup('osl-stranger@example.com') as stranger,
  tests.signup('osl-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 설문 접속기록');

/** 제출한 서비스 설문 하나 — 운영자 문이 글을 내는지, 그 글이 기록에 안 들어가는지를 본다 */
insert into public.service_survey (user_id, schedule_id, survey_version, free_text, improve_text, submitted_at)
values ((select respondent from folks), 0, 'test', '기록에 들어가면 안 되는 설문 글', '고쳐 주면 좋을 점', now());

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

-- ── 1. 운영자가 읽으면 문마다 한 줄 ─────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select count(*) from public.operator_survey_overview();
select count(*) from public.operator_survey_by_version();
select count(*) from public.operator_survey_tags();
select count(*) from public.operator_survey_comments();
select count(*) from public.operator_service_survey_overview();
select count(*) from public.operator_service_survey_counts();

select is(
  (select count(*)::integer from public.operator_service_survey_texts() t
   where t.free_text = '기록에 들어가면 안 되는 설문 글'),
  1,
  '운영자는 적어 주신 글을 읽는다');

select results_eq(
  $$select action, target, filter, outcome from pg_temp.lines((select operator from folks))$$,
  $$values ('survey.overview', null::uuid, null::text, 'allowed'),
           ('survey.by_version', null, null, 'allowed'),
           ('survey.tags', null, null, 'allowed'),
           ('survey.comments', null, null, 'allowed'),
           ('survey.service_overview', null, null, 'allowed'),
           ('survey.service_counts', null, null, 'allowed'),
           ('survey.service_texts', null, null, 'allowed')$$,
  '설문 문 일곱이 읽을 때마다 제 동작으로 한 줄씩 적는다 — 대상 · 거른 조건 없이');

reset role;
select is(
  (select count(*)::integer from audit.operator_access a
   where to_jsonb(a)::text ~ '(기록에 들어가면|고쳐 주면|osl-|@example)'),
  0,
  '기록에 설문 글 · 이메일이 없다');

-- ── 2. 거절 ──────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok($$select * from public.operator_survey_overview()$$, '42501', null,
  '운영자가 아니면 풀이 설문 집계는 던진다');
select throws_ok($$select * from public.operator_survey_comments()$$, '42501', null,
  '풀이 설문 글도');
select throws_ok($$select * from public.operator_service_survey_texts()$$, '42501', null,
  '서비스 설문 글도');
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '던진 문 안에서는 아무것도 안 남는다 — 되감긴다');

select lives_ok($$select public.note_operator_denial('survey.overview')$$,
  '설문의 거절은 따로 부르는 문이 적는다');
select results_eq(
  $$select action, target, outcome from pg_temp.lines((select stranger from folks))$$,
  $$values ('survey.overview', null::uuid, 'denied')$$,
  '거절한 줄이 동작 · 거절로 남는다');

select lives_ok(
  $$select public.note_operator_denial(a)
    from unnest(array['survey.by_version', 'survey.tags', 'survey.comments', 'survey.service_overview',
                      'survey.service_counts', 'survey.service_texts']) a$$,
  '설문 동작 일곱을 다 받는다');
select throws_ok($$select public.note_operator_denial('survey.everything')$$, '22023', null,
  '모르는 설문 동작은 안 받는다');

select pg_temp.acting((select operator from folks));
select public.note_operator_denial('survey.overview');
select is((select count(*)::integer from pg_temp.lines((select operator from folks)) where outcome = 'denied'), 0,
  '운영자가 부르면 거절을 안 적는다');

-- ── 3. 반출 ─────────────────────────────────────────────────────────────────

set local role service_role;
select is(
  (select count(*)::integer from public.audit_export_batch(50000) b
   where b.actor_user_id = (select operator from folks) and b.action like 'survey.%'),
  7,
  '반출은 설문 동작의 줄을 그대로 가져간다');
select is(
  (select count(*)::integer from public.audit_export_batch(50000) b
   where b.actor_user_id = (select stranger from folks) and b.action like 'survey.%' and b.outcome = 'denied'),
  7,
  '설문의 거절도 함께 나간다');

-- ── 4. 모양 ─────────────────────────────────────────────────────────────────

reset role;
create temporary table survey_doors as
select p.oid, p.proname::text as name, p.provolatile
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('operator_survey_overview', 'operator_survey_by_version', 'operator_survey_tags',
                    'operator_survey_comments', 'operator_service_survey_overview',
                    'operator_service_survey_counts', 'operator_service_survey_texts');

select is((select count(*)::integer from survey_doors), 7, '설문 문은 일곱이다');
select is(
  (select coalesce(array_agg(name order by name), '{}') from survey_doors where provolatile <> 'v'),
  '{}'::text[],
  '일곱 다 volatile — stable 이면 적지 못한다');
select is(
  (select coalesce(array_agg(name order by name), '{}') from survey_doors
   where not has_function_privilege('authenticated', oid, 'EXECUTE')
      or has_function_privilege('anon', oid, 'EXECUTE')
      or has_function_privilege('service_role', oid, 'EXECUTE')),
  '{}'::text[],
  '일곱 다 로그인한 사람에게만 열려 있다 — 다시 지어도 권한은 그대로');

select * from finish();
rollback;
