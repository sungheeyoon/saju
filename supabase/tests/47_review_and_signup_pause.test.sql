-- 신고의 검토 기록과 가입 닫기 (ADR 0105)
--
--   1. **검토 기록은 신고한 사람에게 안 보인다** — 원래 칸 일곱은 그대로 읽힌다
--   2. **검토 기록의 모양** — 결과에는 검토한 사람과 시각이, 이용 정지에는 받은 쪽이, 제재는 두 계정 중 하나에
--   3. **운영자 화면이 검토 기록을 읽는다** — 받은 쪽은 신고 안의 자리로
--   4. **떠나도 검토 기록이 함께 옮겨진다**(ADR 0098) — 옮긴 뒤에도 검토 칸은 적을 수 있다
--   5. **가입이 닫히면 새 사람은 코드가 살아 있어도 못 들어오고, 이미 가입한 사람은 안내를 다시 확인한다**
--   6. **닫힌 줄은 하나뿐이고 앱 역할은 그 표를 못 읽는다**
begin;
select plan(20);

create temporary table folks as
select
  tests.signup('rv-reporter@example.com') as reporter,
  tests.signup('rv-reported@example.com') as reported,
  tests.signup('rv-third@example.com') as third,
  tests.signup('rv-operator@example.com') as operator,
  tests.signup_raw('rv-newcomer@example.com') as newcomer,
  tests.signup_raw('rv-later@example.com') as later;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 검토');

create or replace function pg_temp.report(who uuid, whom uuid)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, 'harassment') returning id
$$;

create temporary table cases as
select pg_temp.report(reporter, reported) as judged, pg_temp.report(reported, reporter) as leaving from folks;
grant select on cases to authenticated, service_role, anon;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

-- ── 2. 모양 ──────────────────────────────────────────────────────────────────

select throws_ok(
  format($$update public.report set review_outcome = 'no_action' where id = %L$$, (select judged from cases)),
  '23514', null, '결과만 적고 검토한 사람 · 시각이 없으면 안 된다');

select throws_ok(
  format($$update public.report set reviewed_at = now(), reviewed_by = %L, review_outcome = 'suspension'
           where id = %L$$, (select operator from folks), (select judged from cases)),
  '23514', null, '이용 정지는 받은 쪽을 적어야 한다');

select throws_ok(
  format($$update public.report set reviewed_at = now(), reviewed_by = %1$L, review_outcome = 'warning',
             sanctioned_user_id = %2$L, sanctioned_by = %1$L where id = %3$L$$,
         (select operator from folks), (select third from folks), (select judged from cases)),
  '23514', null, '제재는 신고의 두 계정 중 하나에만 떨어진다');

select throws_ok(
  format($$update public.report set reviewed_at = now(), reviewed_by = %1$L, review_outcome = 'suspension',
             sanctioned_user_id = %2$L where id = %3$L$$,
         (select operator from folks), (select reported from folks), (select judged from cases)),
  '23514', null, '제재에는 실행한 사람이 붙는다');

select lives_ok(
  format($$update public.report set reviewed_at = now(), reviewed_by = %1$L, review_outcome = 'suspension',
             review_note = '같은 말을 반복해 보냄', sanctioned_user_id = %2$L, sanctioned_by = %1$L where id = %3$L$$,
         (select operator from folks), (select reported from folks), (select judged from cases)),
  '검토 SQL 의 모양 — 누가 · 언제 · 결과 · 근거 · 받은 쪽 · 실행한 사람');

update public.report set reviewed_at = now(), reviewed_by = (select operator from folks),
  review_outcome = 'needs_more', review_note = '상대 쪽 이야기를 더 볼 것'
where id = (select leaving from cases);

-- ── 1. 신고한 사람에게는 안 보인다 ───────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select reporter from folks));

select is(
  (select array[r.reason, (r.reviewed_at is not null)::text] from public.report r where r.id = (select judged from cases)),
  array['harassment', 'true'],
  '신고한 사람은 제 신고의 원래 칸(사유 · 검토 시각)을 그대로 읽는다');

select throws_ok(
  format($$select review_outcome from public.report where id = %L$$, (select judged from cases)),
  '42501', null, '검토 결과는 못 읽는다 — 상대가 정지됐는지가 새지 않는다');
select throws_ok(
  format($$select review_note, sanctioned_user_id from public.report where id = %L$$, (select judged from cases)),
  '42501', null, '판단 근거와 제재 칸도 못 읽는다');
select throws_ok($$select * from public.report$$, '42501', null, '통째로 읽는 것도 막힌다');

-- ── 3. 운영자 화면 ──────────────────────────────────────────────────────────

select pg_temp.acting((select operator from folks));

select is(
  (select array[o.review_outcome, o.review_note, o.sanctioned_side, (o.reviewer_nickname is not null)::text]
   from public.operator_report((select judged from cases)) o),
  array['suspension', '같은 말을 반복해 보냄', 'reported', 'true'],
  '상세는 결과 · 근거 · 받은 쪽(신고 안의 자리) · 검토한 운영자를 낸다');

select is(
  (select l.review_outcome from public.operator_reports() l where l.report_id = (select judged from cases)),
  'suspension',
  '목록에도 결과가 선다');

-- ── 4. 떠나도 함께 옮겨진다 ─────────────────────────────────────────────────

reset role;
select public.forget_user((select reported from folks));

select is(
  (select array[k.review_outcome, k.review_note, (k.reviewed_by = f.operator)::text]
   from retention.report k, folks f where k.report_id = (select leaving from cases)),
  array['needs_more', '상대 쪽 이야기를 더 볼 것', 'true'],
  '떠난 사람의 신고에 검토 기록이 함께 옮겨진다');

select is(
  (select array[k.review_outcome, (k.sanctioned_user_id = f.reported)::text, (k.sanctioned_by = f.operator)::text]
   from retention.report k, folks f where k.report_id = (select judged from cases)),
  array['suspension', 'true', 'true'],
  '제재한 쪽 · 받은 쪽도 옮겨진다');

select lives_ok(
  format($$update retention.report set review_outcome = 'no_action', review_note = '더 볼 것 없음' where report_id = %L$$,
         (select leaving from cases)),
  '옮긴 뒤에도 검토 칸은 적을 수 있다');

select throws_ok(
  format($$update retention.report set reason = 'other' where report_id = %L$$, (select leaving from cases)),
  '55000', null, '증거 칸은 여전히 못 고친다');

-- ── 5 · 6. 가입 닫기 ────────────────────────────────────────────────────────

insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
select '2026-10-31', '시험', '운영자', '담당', 'ops@example.com'
where not exists (select 1 from public.beta_schedule);

insert into public.signup_code (code, note, valid_on, max_uses) values ('PAUSE1', '닫기 시험', public.signup_today(), 10);
insert into public.signup_pause (reason) values ('운영자 부재 시험');

create or replace function pg_temp.schedule_id()
returns bigint language sql stable as $$ select s.schedule_id from public.current_beta_schedule() s $$;

select throws_ok($$insert into public.signup_pause (reason) values ('둘째')$$, '23505', null,
  '닫힌 줄은 하나뿐이다');

set local role authenticated;
select pg_temp.acting((select newcomer from folks));

select throws_ok(
  $$select public.complete_signup('PAUSE1', '새사람', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '42501', '지금 쓸 수 있는 코드가 아닙니다.', '닫혀 있으면 살아 있는 코드로도 새 사람은 못 들어온다 — 기존 문장으로');

select pg_temp.acting((select reporter from folks));
select lives_ok(
  $$select public.complete_signup(null, null, 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '이미 가입한 사람은 닫힌 동안에도 바뀐 안내를 다시 확인한다');

select throws_ok($$select 1 from public.signup_pause$$, '42501', null, '앱 역할은 닫힌 기간 표를 못 읽는다');

reset role;
update public.signup_pause set resumed_at = now() where resumed_at is null;

set local role authenticated;
select pg_temp.acting((select later from folks));
select lives_ok(
  $$select public.complete_signup('PAUSE1', '나중사람', 'notice-v9', pg_temp.schedule_id(), false, false)$$,
  '열면 다시 들어온다');

select * from finish();
rollback;
