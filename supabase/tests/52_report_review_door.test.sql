-- 신고 검토를 적는 문 하나와 처리 필요 (ADR 0107)
--
--   1. **처리 필요 = 안 봤거나 추가 확인 필요** — 목록 문이 그 정의로 거른다. 옛 검토(결과 없음)는 처리 완료다
--   2. **결과와 제재 대상이 맞물린다** — 조치 없음 · 추가 확인 필요에는 대상이 없고, 경고 · 이용 정지 결정에는 대상과
--      실행한 운영자가 있다
--   3. **검토한 사람은 운영자여야 한다** — 운영자 표에 없는 UUID 는 `42501`
--   4. **이용 정지 결정은 기록과 계정 정지가 한 트랜잭션이다** — 어느 쪽이 실패해도 둘 다 되감긴다
--   5. **해제해도 기록은 그대로다** — 영구 제약이 없다
--   6. **떠난 사람의 신고에도 같은 제약과 같은 문** — 옮겨질 때 줄은 제약을 지킨 채다
--   7. **앱 역할은 이 문을 못 부른다**
begin;
select plan(32);

create temporary table folks as
select
  tests.signup('rd-reporter@example.com') as reporter,
  tests.signup('rd-reported@example.com') as reported,
  tests.signup('rd-third@example.com') as third,
  tests.signup('rd-leaving@example.com') as leaving,
  tests.signup('rd-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 검토 문');

create or replace function pg_temp.report(who uuid, whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, reason) returning id
$$;

create temporary table cases as
select
  pg_temp.report(reporter, reported, 'harassment') as fresh,
  pg_temp.report(reporter, reported, 'inappropriate') as held,
  pg_temp.report(reporter, reported, 'other') as calm,
  pg_temp.report(reporter, reported, 'impersonation') as old,
  pg_temp.report(reporter, third, 'harassment') as warned,
  pg_temp.report(reporter, third, 'inappropriate') as suspended,
  pg_temp.report(reported, reporter, 'other') as failing,
  pg_temp.report(reporter, leaving, 'harassment') as gone
from folks;
grant select on cases to authenticated, service_role, anon;

create or replace function pg_temp.review(report uuid, outcome text, target uuid default null, note text default null)
returns text language sql as $$
  select public.review_report(report, (select operator from folks), outcome, note, target)
$$;

-- ── 3. 검토한 사람은 운영자다 ──────────────────────────────────────────────────

select throws_ok(
  format($$select public.review_report(%L, %L, 'no_action', null)$$, (select calm from cases), (select third from folks)),
  '42501', null, '운영자 표에 없는 UUID 는 검토한 사람이 못 된다');
select throws_ok(
  format($$select public.review_report(%L, null, 'no_action', null)$$, (select calm from cases)),
  '42501', null, '검토한 사람이 비어도 거절한다');
select throws_ok(
  format($$select public.review_report(%L, %L, null, null)$$, (select calm from cases), (select operator from folks)),
  '22023', null, '결과 없이 검토를 적지 않는다');
select throws_ok(
  format($$select public.review_report(gen_random_uuid(), %L, 'no_action', null)$$, (select operator from folks)),
  'P0002', null, '없는 신고는 거절한다');

-- ── 2. 결과와 제재 대상 ────────────────────────────────────────────────────────

select throws_ok(
  format($$select pg_temp.review(%L, 'no_action', %L)$$, (select calm from cases), (select reported from folks)),
  '23514', null, '조치 없음에는 제재 대상이 못 들어온다');
select throws_ok(
  format($$select pg_temp.review(%L, 'needs_more', %L)$$, (select held from cases), (select reported from folks)),
  '23514', null, '추가 확인 필요에도 제재 대상이 못 들어온다');
select throws_ok(
  format($$select pg_temp.review(%L, 'warning')$$, (select warned from cases)),
  '23514', null, '경고에는 제재 대상이 있어야 한다');
select throws_ok(
  format($$select pg_temp.review(%L, 'suspension')$$, (select suspended from cases)),
  '23514', null, '이용 정지 결정에도 제재 대상이 있어야 한다');
select throws_ok(
  format($$select pg_temp.review(%L, 'warning', %L)$$, (select warned from cases), (select operator from folks)),
  '23514', null, '제재 대상은 신고의 두 계정 중 하나다');
select throws_ok(
  format($$update public.report set reviewed_at = now(), reviewed_by = %1$L, review_outcome = 'warning',
             sanctioned_user_id = %2$L where id = %3$L$$,
         (select operator from folks), (select third from folks), (select warned from cases)),
  '23514', null, '표를 직접 고쳐도 경고에 실행한 운영자가 없으면 거절한다');
select throws_ok(
  format($$update public.report set sanctioned_user_id = %1$L, sanctioned_by = %2$L where id = %3$L$$,
         (select reported from folks), (select operator from folks), (select fresh from cases)),
  '23514', null, '결과 없이 제재 대상만 적지 못한다');

select is(pg_temp.review((select calm from cases), 'no_action', null, '반복 아님'), 'report', '조치 없음을 적는다');
select is(pg_temp.review((select held from cases), 'needs_more', null, '상대 쪽 이야기를 더 볼 것'), 'report',
  '추가 확인 필요를 적는다');
select is(pg_temp.review((select warned from cases), 'warning', (select third from folks)), 'report', '경고를 적는다');

select is(
  (select array[(sanctioned_user_id = f.third)::text, (sanctioned_by = f.operator)::text, (reviewed_by = f.operator)::text]
   from public.report, folks f where id = (select warned from cases)),
  array['true', 'true', 'true'],
  '경고는 제재 대상과 실행한 운영자(= 검토한 운영자)를 함께 적는다');
select is((select status from public.app_user where id = (select third from folks)), 'active',
  '경고는 계정을 정지하지 않는다');

-- ── 4. 이용 정지 결정은 한 트랜잭션 ────────────────────────────────────────────

select is(pg_temp.review((select suspended from cases), 'suspension', (select third from folks), '같은 말 반복'),
  'report', '이용 정지 결정을 적는다');
select is(
  (select array[r.review_outcome, a.status] from public.report r, public.app_user a
   where r.id = (select suspended from cases) and a.id = (select third from folks)),
  array['suspension', 'suspended'],
  '이용 정지 결정을 적으면 같은 자리에서 계정이 정지된다');

-- 신고한 쪽이 탈퇴를 신청한 상태 — 계정 검사식(`status` 와 `deletion_requested_at`)이 정지를 거절한다
update public.app_user set status = 'deletion_requested', deletion_requested_at = now()
where id = (select reported from folks);

select throws_ok(
  format($$select pg_temp.review(%L, 'suspension', %L)$$, (select failing from cases), (select reported from folks)),
  '23514', null, '계정을 정지하지 못하면 거절한다');
select is(
  (select array[(reviewed_at is null)::text, coalesce(review_outcome, '없음')] from public.report
   where id = (select failing from cases)),
  array['true', '없음'],
  '정지가 실패하면 먼저 적은 검토 기록도 되감긴다');

-- 기록이 실패하면 정지도 안 남는다 — 판단 근거가 500자를 넘는다
select throws_ok(
  format($$select pg_temp.review(%L, 'suspension', %L, repeat('가', 501))$$,
         (select fresh from cases), (select reporter from folks)),
  '23514', null, '판단 근거가 길면 거절한다');
select is((select status from public.app_user where id = (select reporter from folks)), 'active',
  '기록이 실패하면 계정도 정지되지 않는다');

-- ── 5. 해제해도 기록은 그대로 ─────────────────────────────────────────────────

update public.app_user set status = 'active' where id = (select third from folks);
select is(
  (select array[review_outcome, (sanctioned_user_id = f.third)::text] from public.report, folks f
   where id = (select suspended from cases)),
  array['suspension', 'true'],
  '해제해도 이용 정지 결정 기록은 그때의 판단으로 남는다');

-- ── 1. 처리 필요 ──────────────────────────────────────────────────────────────

update public.report set reviewed_at = now() where id = (select old from cases);

create or replace function pg_temp.listed(done boolean)
returns uuid[] language sql as $$
  select array_agg(l.report_id order by l.report_id)
  from public.operator_reports(p_reviewed => done) l, cases c
  where l.report_id in (c.fresh, c.held, c.calm, c.old, c.warned, c.suspended, c.failing)
$$;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select operator from folks)), true);

select is(pg_temp.listed(false),
  (select array_agg(id order by id) from cases, unnest(array[fresh, held, failing]) id),
  '처리 필요는 안 본 신고와 추가 확인 필요다');
select is(pg_temp.listed(true),
  (select array_agg(id order by id) from cases, unnest(array[calm, old, warned, suspended]) id),
  '처리 완료는 조치 없음 · 경고 · 이용 정지 결정과 결과 없는 옛 검토다');

select is((select l.is_open from public.operator_reports() l where l.report_id = (select held from cases)), true,
  '목록은 줄마다 처리 필요인가를 같은 정의로 낸다 — 추가 확인 필요는 처리 필요');
select is((select o.is_open from public.operator_report((select old from cases)) o), false,
  '상세도 같은 정의로 낸다 — 결과 없는 옛 검토는 처리 완료');

select throws_ok(
  format($$select public.review_report(%L, %L, 'no_action', null)$$, (select fresh from cases), (select operator from folks)),
  '42501', null, '앱 역할은 검토 문을 못 부른다 — 운영자라도');

reset role;

-- ── 6. 떠난 사람의 신고 ───────────────────────────────────────────────────────

select pg_temp.review((select gone from cases), 'warning', (select leaving from folks), '떠나기 전 경고');
select public.forget_user((select leaving from folks));

select is(
  (select array[k.review_outcome, (k.sanctioned_by = f.operator)::text] from retention.report k, folks f
   where k.report_id = (select gone from cases)),
  array['warning', 'true'],
  '옮겨진 줄은 경고의 제재 대상 · 실행한 운영자를 든 채 제약을 지킨다');

select throws_ok(
  format($$update retention.report set review_outcome = 'no_action' where report_id = %L$$, (select gone from cases)),
  '23514', null, '떠난 사람의 신고에도 조치 없음에는 제재 대상이 못 남는다');

select throws_ok(
  format($$select pg_temp.review(%L, 'suspension', %L)$$, (select gone from cases), (select leaving from folks)),
  'P0002', null, '떠난 계정에 이용 정지 결정을 적지 못한다 — 정지할 계정이 없다');

select is(pg_temp.review((select gone from cases), 'no_action', null, '다시 봄'), 'retention',
  '떠난 사람의 신고도 같은 문이 적는다');

select * from finish();
rollback;
