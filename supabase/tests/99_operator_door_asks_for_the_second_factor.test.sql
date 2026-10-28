-- 운영자 판정이 세션의 2단계 인증(aal2)도 묻는다 (`20270102090000`, ADR 0209 「DB 층」, G-65)
--
--   1. **판정** — 운영자 표에 있고 이용 중이어도 JWT 의 `aal` 이 `aal2` 가 아니면(aal1 · 없음 · JWT 없음) 운영자가 아니다
--   2. **문** — `authenticated` 에 열린 운영자 문 스물여덟이 aal1 운영자에게 전부 `42501` 이다. aal2 면 지금처럼 열린다
--   3. **거절 기록** — aal1 운영자의 거절은 `note_operator_denial` 이 `denied` 로 적고, `note_operator_refusal` 은 안 적는다
--   4. **회원 문은 aal 을 안 묻는다** — aal1 회원도 제 것을 그대로 읽는다
--
-- 세션 문장은 `tests.claims`(aal2) 와 `tests.claims_aal1` 둘이다(`00_helpers.sql`).
begin;
select plan(43);

create temporary table folks as
select
  tests.signup('mfa-operator@example.com') as operator,
  tests.signup('mfa-member@example.com') as member,
  gen_random_uuid() as some_id;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 2단계 인증');

/** 이 파일의 운영자 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.lines(who uuid)
returns table (action text, outcome text)
language sql security definer as $$
  select a.action, a.outcome from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated;

-- ── 1. 판정 ──────────────────────────────────────────────────────────────────
-- `is_operator()` 는 모든 역할에 닫혀 있다 — 판정 자체는 소유자로 재고, 문은 아래에서 `authenticated` 로 잰다

select set_config('request.jwt.claims', tests.claims((select operator from folks)), true);
select is(public.is_operator(), true, 'aal2 운영자는 운영자다');

select set_config('request.jwt.claims', tests.claims_aal1((select operator from folks)), true);
select is(public.is_operator(), false, 'aal1 운영자는 운영자가 아니다 — 구글 로그인만 마친 세션');

select set_config('request.jwt.claims', json_build_object('sub', (select operator from folks), 'role', 'authenticated')::text, true);
select is(public.is_operator(), false, 'aal 클레임이 없으면 운영자가 아니다');

select set_config('request.jwt.claims', tests.claims((select member from folks)), true);
select is(public.is_operator(), false, 'aal2 여도 운영자 표에 없으면 운영자가 아니다');

select set_config('request.jwt.claims', null, true);
select is(public.is_operator(), false, 'JWT 가 없는 자리(CLI · 크론)는 운영자가 아니다');

-- ── 2. 문 — aal1 운영자 ───────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims_aal1((select operator from folks)), true);

select throws_ok($$select * from public.operator_today_figures()$$, '42501', null, 'aal1 — 오늘의 숫자');
select throws_ok($$select * from public.operator_reports(null, null, null, 1, null, 'urgent')$$, '42501', null, 'aal1 — 신고 목록');
select throws_ok(format($$select * from public.operator_report(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 신고 상세');
select throws_ok(format($$select * from public.operator_report_snapshot(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 신고 스냅샷');
select throws_ok(format($$select * from public.operator_report_target(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 신고 대상 요약');
select throws_ok(
  format($$select * from public.operator_review_report(%L, 'no_action', '시험', null, null, 0, gen_random_uuid())$$, (select some_id from folks)),
  '42501', null, 'aal1 — 신고 처분');
select throws_ok($$select * from public.operator_survey_overview()$$, '42501', null, 'aal1 — 설문 요약');
select throws_ok($$select * from public.operator_survey_by_version()$$, '42501', null, 'aal1 — 설문 판본별');
select throws_ok($$select * from public.operator_survey_tags()$$, '42501', null, 'aal1 — 설문 태그');
select throws_ok($$select * from public.operator_survey_comments()$$, '42501', null, 'aal1 — 설문 글');
select throws_ok($$select * from public.operator_service_survey_overview()$$, '42501', null, 'aal1 — 서비스 설문 요약');
select throws_ok($$select * from public.operator_service_survey_counts()$$, '42501', null, 'aal1 — 서비스 설문 수');
select throws_ok($$select * from public.operator_service_survey_texts()$$, '42501', null, 'aal1 — 서비스 설문 글');
select throws_ok($$select * from public.operator_audit_export_status()$$, '42501', null, 'aal1 — 접속기록 반출 상태');
select throws_ok($$select * from public.operator_member('mfa')$$, '42501', null, 'aal1 — 회원 찾기');
select throws_ok(format($$select * from public.operator_member_warnings(%L)$$, (select member from folks)), '42501', null, 'aal1 — 경고 이력');
select throws_ok(format($$select * from public.operator_member_grant_ledger(%L)$$, (select member from folks)), '42501', null, 'aal1 — 지급 장부');
select throws_ok(
  format($$select * from public.operator_member_credit_history(%L, 'all', 30, null, null)$$, (select member from folks)),
  '42501', null, 'aal1 — 풀이권 이력');
select throws_ok(format($$select * from public.operator_member_sanctions(%L)$$, (select member from folks)), '42501', null, 'aal1 — 처분 이력');
select throws_ok(
  format($$select * from public.operator_grant_reading_credits(%L, 1, 'outage', '시험', null, 0, gen_random_uuid())$$, (select member from folks)),
  '42501', null, 'aal1 — 무상 지급');
select throws_ok(
  format($$select * from public.operator_revoke_reading_credits(%L, 1, 'mistake', '시험', 0, gen_random_uuid())$$, (select member from folks)),
  '42501', null, 'aal1 — 회수');
select throws_ok(
  format($$select * from public.operator_suspend_member(%L, 'other', '시험', 0, gen_random_uuid())$$, (select member from folks)),
  '42501', null, 'aal1 — 이용 정지');
select throws_ok(
  format($$select * from public.operator_unsuspend_member(%L, 'other', '시험', 0, gen_random_uuid())$$, (select member from folks)),
  '42501', null, 'aal1 — 정지 해제');
select throws_ok(format($$select * from public.operator_reading_refund_basis(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 환불 셈');
select throws_ok(format($$select * from public.operator_reading_refund_hold(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 진행 중인 환불');
select throws_ok(
  format($$select * from public.operator_hold_reading_refund(%L, 1, 'other', 0, gen_random_uuid())$$, (select some_id from folks)),
  '42501', null, 'aal1 — 환불 확보');
select throws_ok(format($$select * from public.operator_book_reading_refund(%L, 'pg-1')$$, (select some_id from folks)), '42501', null, 'aal1 — 환불 확정');
select throws_ok(format($$select * from public.operator_release_reading_refund(%L)$$, (select some_id from folks)), '42501', null, 'aal1 — 준비 취소');

-- ── 3. 거절 기록 — aal1 운영자 ────────────────────────────────────────────────

select public.note_operator_denial('reports.list');
select public.note_operator_refusal('members.suspend', '55000', null, (select member from folks));

select results_eq(
  format($$select action, outcome from pg_temp.lines(%L)$$, (select operator from folks)),
  $$values ('reports.list', 'denied')$$,
  'aal1 운영자의 거절은 denied 한 줄 — refused 는 안 적는다(운영자가 아니므로)');

-- ── 2 · 3. aal2 운영자 — 지금처럼 열린다 ──────────────────────────────────────

select set_config('request.jwt.claims', tests.claims((select operator from folks)), true);

select lives_ok($$select * from public.operator_today_figures()$$, 'aal2 — 오늘의 숫자가 열린다');
select lives_ok($$select * from public.operator_reports(null, null, null, 1, null, 'urgent')$$, 'aal2 — 신고 목록이 열린다');
select lives_ok($$select * from public.operator_survey_overview()$$, 'aal2 — 설문 요약이 열린다');
select lives_ok($$select * from public.operator_member('mfa')$$, 'aal2 — 회원 찾기가 열린다');

select public.note_operator_denial('reports.list');
select public.note_operator_refusal('members.suspend', '55000', null, (select member from folks));

select results_eq(
  format($$select action, outcome from pg_temp.lines(%L) where outcome = 'denied' or outcome = 'refused'$$, (select operator from folks)),
  $$values ('reports.list', 'denied'), ('members.suspend', 'refused')$$,
  'aal2 운영자의 거절은 refused 만 — denied 는 앞의 aal1 한 줄 그대로');

select ok(
  (select count(*) from pg_temp.lines((select operator from folks)) where outcome = 'allowed') >= 4,
  'aal2 운영자의 읽기는 접속기록에 남는다');

-- ── 4. 회원 문은 aal 을 안 묻는다 ─────────────────────────────────────────────

select set_config('request.jwt.claims', tests.claims_aal1((select member from folks)), true);
select lives_ok($$select * from public.my_reading_credits()$$, 'aal1 회원도 제 풀이권을 읽는다');

select set_config('request.jwt.claims', tests.claims_aal1((select operator from folks)), true);
select lives_ok($$select * from public.my_reading_credits()$$, 'aal1 운영자도 회원 문은 그대로다');

reset role;

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc ilike '%is_operator()%'
     and has_function_privilege('authenticated', p.oid, 'execute')),
  32,
  '판정을 묻는 열린 문은 서른둘 — 운영자 문 스물여덟 · 거절 기록 둘 · 인연 궁합 원문 둘(늘면 위 목록에 더한다)');

select * from finish();
rollback;
