-- 운영자가 신고 상세에서 처분하고, 처분마다 이력이 쌓이며, 계정 상태는 공통 함수로만 바뀐다 (`20261215090000`, G-111 ②, ADR 0188)
--
--   1. **버전** — 화면이 읽은 처리 버전이 지금과 같을 때만 적는다. 다르면 `55000`, 비었거나 음수면 `22023`
--   2. **같은 요청은 한 번** — 같은 요청 번호는 첫 결과를 돌려주고 줄을 더하지 않는다. 신고가 보관으로 옮겨진 뒤에도 같다.
--      같은 번호에 다른 처분이면 거절한다
--   3. **이력** — 처분을 바꾸면 앞 결과가 이력 줄로 남는다(덮어쓰지 않는다)
--   4. **정지** — 이용 정지 결정은 같은 트랜잭션에서 공통 함수로 정지하고, 상태 이력에 실행자 · 사유 · 관련 신고가 남는다. 다른
--      결과로 바꿔도 정지는 풀리지 않고 상세 문이 남은 정지를 알린다. 운영자 계정은 정지하지 않는다
--   5. **안전망** — 공통 함수 밖의 직접 UPDATE 는 실행자 · 사유가 빈 이력 줄과 알림 한 줄을 남긴다. 이용자 스스로의 탈퇴 신청은
--      제 갈래로 적고 알리지 않는다
--   6. **운영자만** — 처분 · 대상 요약 문은 운영자가 아니면 `42501` 이고 되감긴다
--   7. **런북의 검토 문은 그대로** — 인자 · 돌려주는 값이 같고, 버전을 견주지 않되 이력은 쌓는다
--   8. **목록** — 급한 순(괴롭힘 · 위협 → 기한 지남 → 오래된 순)과 머리의 두 수, **대상 요약** — 현재 신고 기준 경고 수와 이 신고의
--      경고가 그 수에 들었는가
--   9. **접속기록** — 처분 · 대상 요약마다 한 줄, 판단 근거는 안 적는다
begin;
select plan(44);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('rr-reporter@example.com') as reporter,
  tests.signup('rr-reported@example.com') as reported,
  tests.signup('rr-third@example.com') as third,
  tests.signup('rr-leaver@example.com') as leaver,
  tests.signup('rr-self@example.com') as self,
  tests.signup('rr-operator@example.com') as operator,
  tests.signup('rr-colleague@example.com') as colleague,
  tests.signup('rr-stranger@example.com') as stranger;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note)
values ((select operator from folks), '시험 — 신고 처분'), ((select colleague from folks), '시험 — 신고 처분');

create or replace function pg_temp.report(who uuid, whom uuid, reason text, at timestamptz default now())
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason, created_at) values (who, whom, reason, at) returning id
$$;

create temporary table cases as
select
  pg_temp.report(reporter, reported, 'other') as warned,
  pg_temp.report(reporter, reported, 'inappropriate') as suspended,
  pg_temp.report(reporter, colleague, 'other') as against_operator,
  pg_temp.report(leaver, third, 'harassment') as moving,
  pg_temp.report(reporter, third, 'other') as runbook
from folks;
grant select on cases to authenticated, service_role, anon;

create temporary table ids (label text primary key, id uuid);
insert into ids values
  ('first', gen_random_uuid()), ('stale', gen_random_uuid()), ('change', gen_random_uuid()),
  ('suspend', gen_random_uuid()), ('unsuspend_by_change', gen_random_uuid()), ('moving', gen_random_uuid()),
  ('operator', gen_random_uuid());
grant select on ids to authenticated, service_role, anon;

create or replace function pg_temp.id(label text) returns uuid language sql as $$ select id from ids where ids.label = $1 $$;

create or replace function pg_temp.review(
  report uuid, outcome text, target uuid, seen integer, request uuid, note text default '판단 근거')
returns text language sql as $$
  select r.review_version || ':' || r.replayed
  from public.operator_review_report(report, outcome, note, target, null, seen, request) r
$$;

/** 이 파일의 신고 · 사람의 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.entries(report uuid)
returns table (version integer, outcome text, actor uuid)
language sql security definer as $$
  select e.version, e.outcome, e.actor_user_id from public.report_review_entry e where e.report_id = report order by e.version
$$;
create or replace function pg_temp.changes(who uuid)
returns table (to_status text, reason text, actor uuid, report uuid)
language sql security definer as $$
  select c.to_status, c.reason, c.actor_user_id, c.report_id from public.account_status_change c where c.user_id = who order by c.at, c.id
$$;
create or replace function pg_temp.lines(who uuid)
returns table (action text, target uuid, filter text)
language sql security definer as $$
  select a.action, a.target_report_id, a.filter_summary from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
create or replace function pg_temp.outcome(report uuid) returns text language sql security definer as $$
  select r.review_outcome from public.report r where r.id = report
$$;
create or replace function pg_temp.status(who uuid) returns text language sql security definer as $$
  select a.status from public.app_user a where a.id = who
$$;
create or replace function pg_temp.open_total() returns integer language sql security definer as $$
  select count(*)::integer from public.report r where public.report_is_open(r.reviewed_at, r.review_outcome)
$$;
grant execute on function pg_temp.open_total() to authenticated;
grant execute on function pg_temp.entries(uuid), pg_temp.changes(uuid), pg_temp.lines(uuid), pg_temp.outcome(uuid),
  pg_temp.status(uuid) to authenticated;

-- ── 6. 운영자만 ─────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 0, %L)$$, (select warned from cases), gen_random_uuid()),
  '42501', null, '운영자가 아니면 처분하지 못한다');
select throws_ok(
  format($$select * from public.operator_report_target(%L)$$, (select warned from cases)),
  '42501', null, '운영자가 아니면 대상 요약을 못 읽는다');

-- ── 1. 버전 · 모양 ─────────────────────────────────────────────────────────────

select pg_temp.acting((select operator from folks));

select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, null, %L)$$, (select warned from cases), gen_random_uuid()),
  '22023', '읽은 버전이 없습니다. 화면을 새로 열어 주세요.', '읽은 버전이 비면 거절한다 — 버전 검사를 건너뛰는 길이 아니다');
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, -1, %L)$$, (select warned from cases), gen_random_uuid()),
  '22023', '읽은 버전이 없습니다. 화면을 새로 열어 주세요.', '음수 버전도 거절한다');
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 0, %L, '   ')$$, (select warned from cases), gen_random_uuid()),
  '22023', '판단 근거를 적어 주세요.', '판단 근거는 넷 모두 필수다 — 조치 없음에도');
select throws_ok(
  format($$select pg_temp.review(%L, 'warning', null, 0, %L)$$, (select warned from cases), gen_random_uuid()),
  '22023', '제재 대상을 골라 주세요.', '경고에는 제재 대상이 있어야 한다');
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 0, null)$$, (select warned from cases)),
  '22023', '요청 번호가 없습니다. 화면을 새로 열어 주세요.', '요청 번호가 없으면 거절한다');

select is(pg_temp.review((select warned from cases), 'warning', (select reported from folks), 0, pg_temp.id('first')),
  '1:false', '읽은 버전 0 에 경고를 적으면 버전 1 이다');
select is(pg_temp.review((select warned from cases), 'warning', (select reported from folks), 0, pg_temp.id('first')),
  '1:true', '같은 요청 번호로 다시 내면 첫 결과를 돌려준다');
select is((select count(*)::integer from pg_temp.entries((select warned from cases))), 1,
  '같은 요청은 이력 한 줄이다');
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 0, %L)$$, (select warned from cases), pg_temp.id('first')),
  '22023', '이 요청 번호는 다른 처분에 쓰였습니다. 화면을 새로 열어 주세요.', '같은 요청 번호에 다른 처분은 거절한다');

select pg_temp.acting((select colleague from folks));
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 0, %L)$$, (select warned from cases), pg_temp.id('stale')),
  '55000', '다른 운영자가 먼저 처리했습니다.', '읽은 버전이 지금과 다르면 거절한다 — 다른 운영자가 먼저 적었다');
select is(pg_temp.outcome((select warned from cases)), 'warning',
  '거절된 처분은 결과를 덮지 않는다');

-- ── 3. 처분 바꾸기 — 앞 결과는 이력 줄로 ─────────────────────────────────────────

select is(pg_temp.review((select warned from cases), 'no_action', null, 1, pg_temp.id('change'), '이의 제기 인정'),
  '2:false', '지금 버전으로 처분을 바꾸면 버전 2 다');
select is(
  (select array_agg(e.outcome || '@' || e.version order by e.version) from pg_temp.entries((select warned from cases)) e),
  array['warning@1', 'no_action@2'],
  '바꾸기 전 결과가 이력 줄로 남는다 — 덮어쓰지 않는다');
select is(
  (select array_agg((e.actor = f.operator)::text || '/' || (e.actor = f.colleague)::text order by e.version)
   from pg_temp.entries((select warned from cases)) e, folks f),
  array['true/false', 'false/true'],
  '줄마다 그 처분을 한 운영자가 남는다');
select is((select o.review_version from public.operator_report((select warned from cases)) o), 2,
  '상세 문은 처리 버전을 이력 줄 수로 낸다');

-- ── 4. 정지 ────────────────────────────────────────────────────────────────────

select pg_temp.acting((select operator from folks));
select is(pg_temp.review((select suspended from cases), 'suspension', (select reported from folks), 0, pg_temp.id('suspend')),
  '1:false', '이용 정지 결정을 적는다');
select is(pg_temp.status((select reported from folks)), 'suspended',
  '같은 자리에서 계정이 정지된다');
select is(
  (select array[c.to_status, c.reason, (c.actor = f.operator)::text, (c.report = cs.suspended)::text]
   from pg_temp.changes((select reported from folks)) c, folks f, cases cs),
  array['suspended', 'report', 'true', 'true'],
  '상태 이력에 실행자 · 사유 갈래 · 관련 신고가 남는다');

select is(pg_temp.review((select suspended from cases), 'no_action', null, 1, pg_temp.id('unsuspend_by_change'), '다시 봄'),
  '2:false', '이용 정지 결정을 조치 없음으로 바꾼다');
select is(pg_temp.status((select reported from folks)), 'suspended',
  '처분을 바꿔도 정지는 풀리지 않는다');
select is((select o.held_suspension_side from public.operator_report((select suspended from cases)) o), 'reported',
  '상세 문이 남은 정지를 알린다 — 해제는 회원 화면에서');
select is((select count(*)::integer from pg_temp.changes((select reported from folks))), 1,
  '처분을 바꾼 것은 계정 상태 이력에 줄을 더하지 않는다');

select throws_ok(
  format($$select pg_temp.review(%L, 'suspension', %L, 0, %L)$$,
         (select against_operator from cases), (select colleague from folks), pg_temp.id('operator')),
  '55000', '운영자 계정은 정지할 수 없습니다.', '운영자 계정은 정지하지 않는다');
select is((select count(*)::integer from pg_temp.entries((select against_operator from cases))), 0,
  '정지가 거절되면 처분 기록도 되감긴다');

-- ── 2. 재시도는 신고가 보관으로 옮겨진 뒤에도 첫 결과 ─────────────────────────────────

select is(pg_temp.review((select moving from cases), 'warning', (select third from folks), 0, pg_temp.id('moving')),
  '1:false', '떠나기 전 신고에 경고를 적는다');

reset role;
select public.forget_user((select leaver from folks));
set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(pg_temp.review((select moving from cases), 'warning', (select third from folks), 0, pg_temp.id('moving')),
  '1:true', '신고가 보관으로 옮겨진 뒤의 재시도도 첫 결과를 돌려받는다');
select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', null, 1, %L)$$, (select moving from cases), gen_random_uuid()),
  'P0002', '신고를 찾지 못했습니다.', '화면의 새 처분은 지금 계정의 신고에만 — 옮겨진 신고는 런북이다');

-- ── 8. 대상 요약 ─────────────────────────────────────────────────────────────

select is(
  (select array[t.warnings_12m::text, t.warned_here::text] from public.operator_report_target((select moving from cases)) t
   where t.side = 'reported'),
  null::text[],
  '옮겨진 신고에는 대상 요약이 없다');

reset role;
select public.review_report((select runbook from cases), (select operator from folks), 'warning', null, (select third from folks));
set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(
  (select array[t.status, t.warnings_12m::text, t.warned_here::text, t.is_operator::text]
   from public.operator_report_target((select runbook from cases)) t where t.side = 'reported'),
  array['active', '1', 'true', 'false'],
  '현재 신고 기준 경고 수와 이 신고의 경고가 그 수에 들었는가 — 옮겨진 신고의 경고는 세지 않는다');

reset role;
create temporary table queue as
select
  pg_temp.report(reporter, third, 'other', now() - interval '20 days') as overdue_other,
  pg_temp.report(reporter, third, 'harassment', now()) as fresh_harassment,
  pg_temp.report(reporter, third, 'other', now() - interval '1 hour') as fresh_other
from folks;
grant select on queue to authenticated;
set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(
  (select array_agg(l.report_id order by l.at)
   from (select l.report_id, row_number() over () as at
         from public.operator_reports(p_reviewed => false, p_order => 'urgent') l) l, queue q
   where l.report_id in (q.overdue_other, q.fresh_harassment, q.fresh_other)),
  (select array[q.fresh_harassment, q.overdue_other, q.fresh_other] from queue q),
  '급한 순 — 괴롭힘 · 위협이 먼저, 그다음 기한 지남, 그다음 접수가 오래된 것');
select is(
  (select array_agg(l.overdue order by l.created_at) from public.operator_reports(p_reviewed => false) l, queue q
   where l.report_id in (q.overdue_other, q.fresh_other)),
  array[true, false],
  '처리 필요이고 3영업일을 넘긴 신고만 기한 지남이다');
select is(
  (select l.open_count from public.operator_reports() l limit 1),
  pg_temp.open_total(),
  '머리의 처리 필요 수는 거르기와 무관한 전체다');

-- ── 9. 접속기록 ───────────────────────────────────────────────────────────────

select is(
  (select array_agg(l.filter order by l.filter) from pg_temp.lines((select operator from folks)) l
   where l.action = 'reports.review' and l.target = (select warned from cases)),
  array['version=1', 'version=1 replayed'],
  '처분마다 신고 id 와 버전 한 줄 — 판단 근거는 안 적는다');
select ok(
  exists (select 1 from pg_temp.lines((select operator from folks)) l
          where l.action = 'reports.target' and l.target = (select runbook from cases)
            and l.filter = format('reported=%s reporter=%s', (select third from folks), (select reporter from folks))),
  '대상 요약을 읽으면 신고 id 와 두 계정 id 한 줄');

reset role;

-- ── 7. 런북의 검토 문 ─────────────────────────────────────────────────────────

select is(
  (select array_agg(e.outcome || '@' || e.version || '@' || (e.actor = f.operator)::text order by e.version)
   from pg_temp.entries((select runbook from cases)) e, folks f),
  array['warning@1@true'],
  '런북의 검토 문도 이력 한 줄을 쌓는다');
select is(public.review_report((select runbook from cases), (select operator from folks), 'no_action', '이의 제기 인정'), 'report',
  '런북의 검토 문은 버전 없이 덮어쓰고 적은 표를 돌려준다');
select is((select count(*)::integer from pg_temp.entries((select runbook from cases))), 2,
  '덮어쓴 앞 결과는 이력에 남는다');

-- ── 5. 안전망 ─────────────────────────────────────────────────────────────────

update public.app_user set status = 'suspended' where id = (select third from folks);
select is(
  (select array[c.to_status, coalesce(c.reason, '없음'), coalesce(c.actor::text, '없음')]
   from pg_temp.changes((select third from folks)) c),
  array['suspended', '없음', '없음'],
  '직접 UPDATE 는 실행자 · 사유가 빈 이력 줄을 남긴다');
select ok(
  exists (select 1 from public.ops_alert a
          where a.kind like 'account-status:%' and a.detail like '%' || (select third from folks)::text || '%'),
  '직접 UPDATE 는 장애 알림 길로 한 줄을 보낸다');

set local role authenticated;
select pg_temp.acting((select self from folks));
select public.request_account_deletion();
reset role;
select is(
  (select array[c.to_status, c.reason, (c.actor = f.self)::text] from pg_temp.changes((select self from folks)) c, folks f),
  array['deletion_requested', 'deletion_request', 'true'],
  '이용자 스스로의 탈퇴 신청은 제 갈래로 적는다');
select ok(
  not exists (select 1 from public.ops_alert a where a.detail like '%' || (select self from folks)::text || '%'),
  '탈퇴 신청은 알리지 않는다');

create temporary table lifted as
select public.change_account_status(f.operator, f.third, 'active', 'mistake', '잘못 정지') as id from folks f;
select is(
  (select array[c.to_status, c.reason, (c.actor_user_id = f.operator)::text]
   from public.account_status_change c, folks f
   where c.id = (select id from lifted)),
  array['active', 'mistake', 'true'],
  '공통 함수로 푼 해제는 실행자 · 사유 갈래를 남긴다');

select * from finish();
rollback;
