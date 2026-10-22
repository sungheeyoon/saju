-- 집은 일감은 임대다 — 지금 쥔 작업자만 놓고 · 저장하고 · 실패로 닫는다 (ADR 0201, `20261226090000`)
--
-- 회수하던 함수가 죽으면 일감이 `retrieving` 에 갇혀 8분 기한까지 아무도 안 집었다. 이제 집은 시각과 임대 식별자가
-- 남고, 임대(150초)가 지나면 다른 작업자가 다시 집는다. 다시 집히면 식별자가 바뀌어 옛 작업자의 늦은 놓기 · 저장 · 실패는
-- 아무 일도 안 한다.
--
-- 재는 것.
--
-- 1. **회수 중 중단 → 임대 만료 뒤 재집기** — 임대 안에서는 다시 안 집히고 복구기도 안 낸다. 지나면 복구기가 내고 집힌다.
--    놓기가 실패한 일감도 같은 길로 풀린다(놓기 실패 = 쥔 채 죽은 것).
-- 2. **이전 작업자의 늦은 응답** — 다시 집힌 뒤의 옛 식별자로는 놓기 · 실패 · 저장이 다 선다.
-- 3. **저장은 됐는데 응답만 끊김** — 같은 식별자로 다시 저장 · 실패해도 풀이 한 벌 · 정산 한 번 · 소식 한 번이다.
-- 4. **8분 기한은 그대로** — 산 임대가 있어도 기한이 지나면 복구기가 `model-timeout` 으로 닫는다.
-- 5. **식별자 없는 옛 앱** — 식별자 없이 집힌 일감만 식별자 없이 놓고 저장한다. 새 앱이 쥔 일감은 못 건드린다.
-- 6. 임대 칸은 집힌 동안에만 산다 · 문은 열쇠에만 열린다(2 에서 함께 잰다).
begin;
select plan(41);

set local role authenticated;

create temporary table folks as
select tests.signup('lease-kim@example.com') as kim,
       tests.signup('lease-lee@example.com') as lee,
       tests.signup('lease-park@example.com') as park;
grant select on folks to authenticated, service_role;

select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
create temporary table kim_run as select run_id from public.start_reading_run('self', 'lease-kim-1');

select set_config('request.jwt.claims', tests.claims((select lee from folks)), true);
select tests.create_self_person(
  '나', 'solar', '1991-03-03', '1991-03-03', '09:00', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
create temporary table lee_run as select run_id from public.start_reading_run('self', 'lease-lee-1');

select set_config('request.jwt.claims', tests.claims((select park from folks)), true);
select tests.create_self_person(
  '나', 'solar', '1988-08-08', '1988-08-08', '08:00', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
create temporary table park_run as select run_id from public.start_reading_run('self', 'lease-park-1');

-- ── 문은 열쇠에만 ─────────────────────────────────────────────────────────────

select throws_ok(
  $$select * from public.claim_reading_job('resp-lease-kim', gen_random_uuid())$$,
  '42501', null, '로그인한 사람은 일감을 못 집는다');
select throws_ok(
  $$select public.release_reading_job(gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, '로그인한 사람은 일감을 못 놓는다');

reset role;

select ok(
  has_function_privilege('service_role', 'public.claim_reading_job(text, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.release_reading_job(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.fail_reading_job(uuid, text, text, jsonb, uuid)', 'execute')
  and has_function_privilege('service_role',
    'public.save_reading(uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz, uuid)', 'execute'),
  '열쇠는 집고 · 놓고 · 닫고 · 저장한다');
select ok(
  not has_function_privilege('authenticated', 'public.fail_reading_job(uuid, text, text, jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated',
    'public.save_reading(uuid, text, smallint, text, text, text, text, text, jsonb, timestamptz, uuid)', 'execute'),
  '로그인한 사람은 닫지도 저장하지도 못한다');
select is(public.reading_job_lease(), interval '150 seconds', '임대는 150초다 — 처리 상한 110초 < 150초 < 8분 기한(ADR 0201)');

/** 제출까지 — 얼린 작업에 지은 것을 적고 이름표를 붙인다(앱의 `prepare_reading_job` → `adopt_reading_job` 차례) */
create or replace function pg_temp.submitted(run uuid, resp text)
returns void
language plpgsql
as $$
begin
  perform public.prepare_reading_job(run, '# 프롬프트', '근거', 'reading-prompt-v1', 'openai/gpt-5.6-luna', '{}'::jsonb, now());
  perform public.adopt_reading_job(run, resp);
end;
$$;

create or replace function pg_temp.claim(resp text, lease uuid)
returns uuid
language sql
as $$ select c.run_id from public.claim_reading_job(resp, lease) c $$;

create or replace function pg_temp.save(run uuid, lease uuid)
returns uuid
language sql
as $$
  select public.save_reading(run, '## 한 줄로\n글', null, '비유', '근거', '# 프롬프트', 'reading-prompt-v1',
    'gpt-test', '{}'::jsonb, now(), lease);
$$;

create or replace function pg_temp.job_of(run uuid)
returns public.reading_job
language sql
as $$ select * from public.reading_job where run_id = run $$;

create or replace function pg_temp.listed(run uuid)
returns jsonb
language sql
as $$ select to_jsonb(o) from public.open_reading_jobs() o where o.run_id = run $$;

/** 임대를 늙힌다 — 150초를 기다리지 않는다 */
create or replace function pg_temp.lease_ages(run uuid)
returns void
language sql
as $$ update public.reading_job set claimed_at = claimed_at - public.reading_job_lease() - interval '1 second' where run_id = run $$;

create temporary table leases as
select gen_random_uuid() as a, gen_random_uuid() as b, gen_random_uuid() as c;

select pg_temp.submitted((select run_id from kim_run), 'resp-lease-kim');

-- ── 1. 회수 중 중단 → 임대 만료 뒤 재집기 ────────────────────────────────────

select is(pg_temp.claim('resp-lease-kim', (select a from leases)), (select run_id from kim_run), '작업자 A 가 집는다');
select is((pg_temp.job_of((select run_id from kim_run))).lease_id, (select a from leases), '집은 일감에 A 의 임대 식별자가 선다');
select isnt((pg_temp.job_of((select run_id from kim_run))).claimed_at, null, '집은 시각이 선다');

/* A 가 여기서 죽는다 — 놓기도 못 했다(놓기 실패와 같은 자리) */
select is(pg_temp.claim('resp-lease-kim', (select b from leases)), null, '임대 안에서는 다른 작업자가 못 집는다');
select is(pg_temp.listed((select run_id from kim_run)), null, '임대 안에서는 복구기도 그 일감을 안 낸다');

select pg_temp.lease_ages((select run_id from kim_run));

select is(
  pg_temp.listed((select run_id from kim_run)) ->> 'overdue', 'false',
  '임대가 지나면 복구기가 그 일감을 낸다 — 기한 전이라 닫지 않고 회수로 보낸다');
select is(pg_temp.claim('resp-lease-kim', (select b from leases)), (select run_id from kim_run),
  '임대가 지나면 작업자 B 가 다시 집는다 — 8분 기한까지 갇히지 않는다');
select is((pg_temp.job_of((select run_id from kim_run))).lease_id, (select b from leases), '다시 집으면 식별자가 B 로 바뀐다');

-- ── 2. 이전 작업자의 늦은 응답 ───────────────────────────────────────────────

select ok(not public.release_reading_job((select run_id from kim_run), (select a from leases)),
  'A 의 늦은 놓기는 아무것도 안 놓는다');
select is((pg_temp.job_of((select run_id from kim_run))).status, 'retrieving', 'B 가 쥔 표시는 그대로다');
select ok(
  not public.fail_reading_job((select run_id from kim_run), 'model-failed', '늦었다', null, (select a from leases)),
  'A 의 늦은 실패는 시도를 안 닫는다');
select is((select status from public.reading_run where id = (select run_id from kim_run)), 'running', '시도는 아직 돈다');
select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid)$$, (select run_id from kim_run), (select a from leases)),
  '23514', '이 일감을 지금 쥔 작업자가 아니라 저장하지 않았습니다.',
  'A 의 늦은 저장은 선다');
select throws_ok(
  format($$select pg_temp.save(%L::uuid, null)$$, (select run_id from kim_run)),
  '23514', '이 일감을 지금 쥔 작업자가 아니라 저장하지 않았습니다.',
  '식별자 없는 저장(옛 앱)도 새 앱이 쥔 일감에는 선다');

/* B 는 일시 장애를 만나 놓는다 — 다음 바퀴가 바로 다시 집는다 */
select ok(public.release_reading_job((select run_id from kim_run), (select b from leases)), 'B 는 제 일감을 놓는다');
select ok(
  (pg_temp.job_of((select run_id from kim_run))).status = 'submitted'
  and (pg_temp.job_of((select run_id from kim_run))).lease_id is null
  and (pg_temp.job_of((select run_id from kim_run))).claimed_at is null,
  '놓으면 보낸 상태로 돌아가고 임대 칸이 빈다');
select throws_ok(
  format($$update public.reading_job set lease_id = gen_random_uuid() where run_id = %L::uuid$$, (select run_id from kim_run)),
  '23514', null,
  '집히지 않은 일감에는 임대 식별자가 못 선다');
select throws_ok(
  format($$update public.reading_job set claimed_at = now() where run_id = %L::uuid$$, (select run_id from kim_run)),
  '23514', null,
  '집히지 않은 일감에는 집은 시각이 못 선다');
select is(pg_temp.claim('resp-lease-kim', (select c from leases)), (select run_id from kim_run),
  '놓은 일감은 임대를 안 기다리고 곧바로 다시 집힌다');

-- ── 3. 저장은 됐는데 응답만 끊김 — 중복 저장 · 중복 정산 없음 ─────────────────

select isnt(pg_temp.save((select run_id from kim_run), (select c from leases)), null, 'C 가 저장한다');

/* 응답이 끊겨 C 는 저장이 됐는지 모른다 — 일시 장애로 보고 놓고, 복구기 · 재전송이 다시 와도 */
select ok(not public.release_reading_job((select run_id from kim_run), (select c from leases)),
  '저장된 뒤의 놓기는 아무것도 안 놓는다 — 일감은 이미 갔다');
select is(pg_temp.claim('resp-lease-kim', gen_random_uuid()), null, '저장된 시도의 일감은 다시 안 집힌다');
select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid)$$, (select run_id from kim_run), (select c from leases)),
  '23514', '이미 끝난 시도입니다.',
  '같은 식별자로 다시 저장해도 두 번째는 선다');
select ok(
  not public.fail_reading_job((select run_id from kim_run), 'save-rejected', '끊겼다', null, (select c from leases)),
  '저장된 시도는 실패로 덮이지 않는다');
select is(
  (select count(*)::int from public.reading where source_run_id = (select run_id from kim_run)), 1,
  '풀이는 한 벌이다');
select is(
  (select array_agg(u.state) from public.reading_credit_use u where u.run_id = (select run_id from kim_run)),
  array['confirmed'],
  '풀이권은 한 번 확정된다 — 풀리지도 두 번 쓰이지도 않는다');
select is(
  (select array_agg(n.kind order by n.kind) from public.notification n
   where n.run_id = (select run_id from kim_run)),
  array['reading_ready'],
  '소식은 완성 하나다 — 실패 소식이 안 선다');

-- ── 4. 8분 기한은 그대로 ─────────────────────────────────────────────────────

select pg_temp.submitted((select run_id from lee_run), 'resp-lease-lee');
select is(pg_temp.claim('resp-lease-lee', (select a from leases)), (select run_id from lee_run), '이씨의 일감을 A 가 집는다');

update public.reading_job set created_at = created_at - public.reading_job_deadline() - interval '1 second'
where run_id = (select run_id from lee_run);

select is(
  pg_temp.listed((select run_id from lee_run)) - 'run_id' - 'response_id',
  '{"overdue": true, "failure_code": "model-timeout"}'::jsonb,
  '임대가 살아 있어도 8분 기한이 지나면 복구기가 낸다 — 닫는 코드는 그대로 model-timeout');
select ok(
  public.fail_reading_job((select run_id from lee_run), 'model-timeout', '만드는 데 너무 오래 걸렸습니다'),
  '기한이 닫는 길은 식별자 없이 닫는다 — 기한이 임대보다 앞선다');
select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid)$$, (select run_id from lee_run), (select a from leases)),
  '23514', '이미 끝난 시도입니다.',
  '기한에 닫힌 뒤 A 의 늦은 저장은 선다');
select is(
  (select array_agg(u.state) from public.reading_credit_use u where u.run_id = (select run_id from lee_run)),
  array['released'],
  '기한에 닫힌 시도의 풀이권은 한 번 풀린다');

-- ── 5. 식별자 없는 옛 앱 ─────────────────────────────────────────────────────

select pg_temp.submitted((select run_id from park_run), 'resp-lease-park');
select is(pg_temp.claim('resp-lease-park', null), (select run_id from park_run), '옛 앱은 식별자 없이 집는다');
select ok(
  (pg_temp.job_of((select run_id from park_run))).lease_id is null
  and (pg_temp.job_of((select run_id from park_run))).claimed_at is not null,
  '식별자는 비어도 집은 시각은 선다 — 옛 앱이 죽어도 임대가 지나면 풀린다');
select ok(not public.release_reading_job((select run_id from park_run), gen_random_uuid()),
  '식별자 없이 집힌 일감을 남의 식별자로는 못 놓는다');
select isnt(pg_temp.save((select run_id from park_run), null), null, '옛 앱은 식별자 없이 저장한다 — 지금과 같다');

select * from finish();
rollback;
