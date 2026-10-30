-- 제출 전에 멈춘 일감은 복구기가 다시 보낸다 (ADR 0210, `20270103090000`)
--
-- 재는 것.
--
-- 1. **`after` 가 안 돌았다** — 인내 안에서는 안 내고, 지나면 복구기가 집어 지금 쥔 작업자로 제출 직전 문을 지난다.
-- 2. **작업자가 `preparing` 에서 죽었다 · 늦게 돌아왔다** — 다시 집히면 옛 식별자의 제출 직전 문 · 실패 닫기는 선다.
-- 3. **제출 직전 문을 지났다(`submitting`)** — 이름표가 없어도 다시 안 낸다 · 안 집는다.
-- 4. **이어쓰기** — 이어진 세션의 스냅숏을 함께 낸다. 이어야 할 세션이 남았거나 스냅숏이 없으면 다시 안 보낸다.
-- 5. **기한** — 2분이 지나면 다시 안 보내고 `prepare-timeout` 으로 닫는다.
-- 6. **다시 보낸 시도도 풀이 한 벌 · 정산 한 번** — 저장을 되풀이해도 그대로다.
-- 7. 문은 열쇠에만 · 옛 앱(식별자 없음)은 지금처럼 지난다.
begin;
select plan(35);

set local role authenticated;

create temporary table folks as
select tests.signup('resend-a@example.com') as a,
       tests.signup('resend-b@example.com') as b,
       tests.signup('resend-c@example.com') as c,
       tests.signup('resend-d@example.com') as d,
       tests.signup('resend-e@example.com') as e,
       tests.signup('resend-f@example.com') as f;
grant select on folks to authenticated, service_role;

create function pg_temp.opened(who uuid, key text)
returns uuid
language plpgsql
as $$
declare
  opened_run uuid;
begin
  perform set_config('request.jwt.claims', tests.claims(who), true);
  perform tests.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests');
  select s.run_id into opened_run from public.start_reading_run('self', key) s;
  return opened_run;
end;
$$;

create temporary table runs as
select pg_temp.opened((select a from folks), 'resend-a') as a,
       pg_temp.opened((select b from folks), 'resend-b') as b,
       pg_temp.opened((select c from folks), 'resend-c') as c,
       pg_temp.opened((select d from folks), 'resend-d') as d,
       pg_temp.opened((select e from folks), 'resend-e') as e,
       pg_temp.opened((select f from folks), 'resend-f') as f;
grant select on runs to authenticated, service_role;

-- ── 7. 문은 열쇠에만 ─────────────────────────────────────────

select throws_ok(
  $$select * from public.retake_stalled_reading_job(gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, '로그인한 사람은 일감을 다시 못 집는다');

reset role;

select ok(
  has_function_privilege('service_role', 'public.retake_stalled_reading_job(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.take_reading_job(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.match_run_awaiting_send(uuid, uuid)', 'execute'),
  '열쇠는 집고 다시 집는다');
select is(public.reading_job_send_patience(), interval '30 seconds', '제출 전 일감은 30초 기다린다');

create function pg_temp.job_of(run uuid)
returns public.reading_job language sql as $$ select * from public.reading_job where run_id = run $$;

create function pg_temp.resendable(run uuid)
returns boolean language sql as $$ select o.resendable from public.open_reading_jobs() o where o.run_id = run $$;

create function pg_temp.retake(run uuid, lease uuid)
returns uuid language sql as $$ select r.run_id from public.retake_stalled_reading_job(run, lease) r $$;

create function pg_temp.prepare(run uuid, lease uuid)
returns boolean language sql as $$
  select public.prepare_reading_job(run, '# 프롬프트', '근거', 'reading-prompt-v1', 'openai/gpt-5.6-luna', '{}'::jsonb, now(),
    null, null, null, lease)
$$;

/** 시도를 연 지 이만큼 지난 것으로 민다 */
create function pg_temp.opened_ago(run uuid, how interval)
returns void language sql as $$ update public.reading_job set created_at = created_at - how where run_id = run $$;

create function pg_temp.taken_ago(run uuid, how interval)
returns void language sql as $$ update public.reading_job set claimed_at = claimed_at - how where run_id = run $$;

/** 귀속된 맛보기 세션 — 스냅숏 있음(`snapshot`)과 이어진 시도(`run`)를 고른다 */
create function pg_temp.claimed_session(who uuid, run uuid, snapshot boolean)
returns void language sql as $$
  insert into public.taste_session (
    browser_hmac, evidence_fingerprint, prompt_version, model_config_version, status,
    preview_markdown, topic, distinctive_pattern, continuation_question, answer_direction, supporting_claims, snapshot_at,
    claimed_by, claimed_at, reading_run_id)
  values (
    encode(sha256(convert_to('resend-h:' || who, 'UTF8')), 'hex'), encode(sha256(convert_to('resend-f:' || who, 'UTF8')), 'hex'), 'taste-v1', 'luna-none-v1', 'claimed',
    case when snapshot then '본 문단' end, case when snapshot then '주제' end, case when snapshot then '무늬' end,
    case when snapshot then '이어 묻는 말' end, case when snapshot then '답의 방향' end,
    case when snapshot then array['pillars.day'] end, case when snapshot then now() end,
    who, now(), run)
$$;

create temporary table leases as
select gen_random_uuid() as lease_a, gen_random_uuid() as lease_b;

-- ── 1. `after` 가 안 돌았다 ──────────────────────────────────

select is(pg_temp.resendable((select a from runs)), false, '갓 연 시도는 다시 안 보낸다 — 첫 작업자가 곧 온다');
select is(pg_temp.retake((select a from runs), (select lease_b from leases)), null, '인내 안에서는 복구기가 못 집는다');

select pg_temp.opened_ago((select a from runs), interval '31 seconds');

select is(pg_temp.resendable((select a from runs)), true, '30초가 지나면 복구기가 다시 보낼 일감으로 낸다');
select is(pg_temp.retake((select a from runs), (select lease_b from leases)), (select a from runs), '복구기가 집는다');
select ok(
  (pg_temp.job_of((select a from runs))).status = 'preparing'
  and (pg_temp.job_of((select a from runs))).lease_id = (select lease_b from leases)
  and (pg_temp.job_of((select a from runs))).claimed_at is not null,
  '집으면 식별자와 시각이 선다');
select is(pg_temp.retake((select a from runs), (select lease_a from leases)), null, '집힌 일감은 인내 안에서 또 안 집힌다');
select is(
  (select count(*)::int from public.take_reading_job((select a from runs), (select lease_a from leases))), 0,
  '뒤늦게 돈 `after` 는 0행이다 — 이미 집혔다');
select ok(pg_temp.prepare((select a from runs), (select lease_b from leases)), '쥔 작업자는 제출 직전 문을 지난다');
select ok(
  (pg_temp.job_of((select a from runs))).status = 'submitting'
  and (pg_temp.job_of((select a from runs))).lease_id is null
  and (pg_temp.job_of((select a from runs))).claimed_at is null,
  '문을 지나면 임대 칸이 빈다');

-- ── 3. 제출 직전 문을 지났다 ─────────────────────────────────

select pg_temp.opened_ago((select a from runs), interval '1 minute');
select is(pg_temp.resendable((select a from runs)), false, '`submitting` 은 이름표가 없어도 다시 안 보낸다');
select is(pg_temp.retake((select a from runs), (select lease_a from leases)), null, '`submitting` 은 복구기가 못 집는다');
select ok(not pg_temp.prepare((select a from runs), null), '제출 직전 문은 두 번 안 열린다');

-- ── 2. 작업자가 죽었다 · 늦게 돌아왔다 ───────────────────────

select is(
  (select count(*)::int from public.take_reading_job((select b from runs), (select lease_a from leases))), 1,
  '작업자 A 가 집는다');
select is(pg_temp.retake((select b from runs), (select lease_b from leases)), null, '산 임대는 복구기가 못 집는다');
select pg_temp.taken_ago((select b from runs), interval '31 seconds');
select is(pg_temp.retake((select b from runs), (select lease_b from leases)), (select b from runs), '30초가 지나면 복구기 B 가 다시 집는다');
select ok(not pg_temp.prepare((select b from runs), (select lease_a from leases)), '돌아온 A 는 제출 직전 문을 못 지난다 — 모델을 안 부른다');
select ok(not pg_temp.prepare((select b from runs), null), '식별자 없는 옛 작업자도 못 지난다');
select ok(
  not public.fail_reading_job((select b from runs), 'unexpected', '늦었다', null, (select lease_a from leases)),
  'A 의 늦은 실패는 B 의 시도를 안 닫는다');
select ok(pg_temp.prepare((select b from runs), (select lease_b from leases)), 'B 는 지난다');

-- ── 4. 이어쓰기 ─────────────────────────────────────────────

select pg_temp.claimed_session((select c from folks), (select c from runs), true);
select pg_temp.opened_ago((select c from runs), interval '31 seconds');
select is(
  (select r.preview_markdown from public.retake_stalled_reading_job((select c from runs), (select lease_b from leases)) r),
  '본 문단',
  '복구기의 집기가 이어진 맛보기를 함께 낸다 — 첫 작업자의 메모리가 없어도 이어 쓴다');

select pg_temp.claimed_session((select d from folks), null, true);
select pg_temp.opened_ago((select d from runs), interval '31 seconds');
select is(pg_temp.resendable((select d from runs)), false, '이어야 할 세션이 남았으면 다시 안 보낸다 — 이어쓰기 없는 글이 조용히 안 선다');
select is(pg_temp.retake((select d from runs), (select lease_b from leases)), null, '그 일감은 집히지도 않는다');

select pg_temp.claimed_session((select e from folks), (select e from runs), false);
select pg_temp.opened_ago((select e from runs), interval '31 seconds');
select is(pg_temp.resendable((select e from runs)), false, '이어진 세션에 스냅숏이 없으면 다시 안 보낸다');

-- ── 5. 기한 ─────────────────────────────────────────────────

select pg_temp.opened_ago((select e from runs), public.reading_job_prepare_deadline());
select is(
  (select to_jsonb(o) - 'run_id' - 'response_id' from public.open_reading_jobs() o where o.run_id = (select e from runs)),
  '{"overdue": true, "failure_code": "prepare-timeout", "resendable": false}'::jsonb,
  '2분이 지나면 다시 안 보내고 닫는다');

-- ── 6. 다시 보낸 시도도 풀이 한 벌 · 정산 한 번 ──────────────

select pg_temp.opened_ago((select f from runs), interval '31 seconds');
select is(pg_temp.retake((select f from runs), (select lease_b from leases)), (select f from runs), '다시 집는다');
select ok(pg_temp.prepare((select f from runs), (select lease_b from leases)), '문을 지난다');
select public.adopt_reading_job((select f from runs), 'resp-resend-f');
select is(
  (select c.run_id from public.claim_reading_job('resp-resend-f', (select lease_a from leases)) c), (select f from runs),
  '회수가 집는다');
create function pg_temp.save(run uuid, lease uuid)
returns uuid language sql as $$
  select public.save_reading(run, '## 한 줄로\n글', null, '비유', '근거', '# 프롬프트', 'reading-prompt-v1',
    'gpt-test', '{}'::jsonb, now(), lease)
$$;
select isnt(pg_temp.save((select f from runs), (select lease_a from leases)), null, '저장한다');
select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid)$$, (select f from runs), (select lease_a from leases)),
  '23514', '이미 끝난 시도입니다.',
  '저장을 되풀이해도 두 번째는 선다');
select is(
  (select c.run_id from public.claim_reading_job('resp-resend-f', gen_random_uuid()) c), null,
  '중복 webhook 은 집을 일감이 없다');
select is(
  (select count(*)::int from public.reading where source_run_id = (select f from runs)), 1,
  '풀이는 한 벌이다');
select is(
  (select array_agg(u.state) from public.reading_credit_use u where u.run_id = (select f from runs)),
  array['confirmed'],
  '풀이권은 한 번 확정된다');

select * from finish();
rollback;
