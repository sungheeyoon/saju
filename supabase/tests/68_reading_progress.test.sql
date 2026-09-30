-- 만드는 동안 몇 번째 절까지 썼는가 (`20261103090000`, 흐름 시안 g)
--
-- 여기서 재는 것 다섯.
--
-- 1. **적는 문은 열쇠만 부른다** — 로그인한 사람도 익명도 못 부른다(부르면 제 화면의 진행을 꾸밀 수 있다)
-- 2. **제출 전 작업에는 안 적힌다** — 아직 쓰기 시작하지 않은 것이다
-- 3. **값은 올라가기만 한다** — 늦게 온 작은 값 · 거짓이 되돌리지 못하고, 큰 값은 60 에서 멈춘다
-- 4. **시도를 보던 사람이 진행을 본다** — `my_last_reading_run` 의 세 칸. 남의 시도는 여전히 안 보인다
-- 5. **끝난 시도에는 진행이 없다** — 작업이 함께 지워지고, 끝난 뒤에는 적는 문도 `false` 다
--
-- 옛 정의(`sections_begun` 을 그대로 덮어쓰는 문)를 되살리면 3 이 붉다.
begin;
select plan(18);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 열쇠인 척하는 손잡이 — 역할을 갈아입기 전에 만든다(`security definer` 라 만든 사람의 권한으로 돈다) */
create or replace function pg_temp.note(run uuid, begun integer, written boolean)
returns boolean
language sql
security definer
as $$ select public.note_reading_progress(run, begun, written) $$;

create or replace function pg_temp.prepare(run uuid)
returns boolean
language sql
security definer
as $$
  select public.prepare_reading_job(
    run, '# 역할', '{"charts":{}}', 'reading-prompt-v4',
    'gpt-5.6-luna', '{"store":false}'::jsonb, now());
$$;

create or replace function pg_temp.adopt(run uuid, resp text)
returns boolean
language sql
security definer
as $$ select public.adopt_reading_job(run, resp) $$;

create or replace function pg_temp.take(run uuid)
returns void
language sql
security definer
as $$ select from public.take_reading_job(run) $$;

create or replace function pg_temp.fail(run uuid)
returns boolean
language sql
security definer
as $$ select public.fail_reading_job(run, 'model-failed', '끊겼다') $$;

create temporary table folks as
select tests.signup('progress-owner@example.com') as owner,
       tests.signup('progress-other@example.com') as other;
grant select on folks to authenticated, anon;

set local role authenticated;

select pg_temp.acting((select owner from folks));
select tests.create_self_person(
  '나', 'solar', '1991-03-03', '1991-03-03', '09:00', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');

create temporary table started as
select * from public.start_reading_run('self', 'progress-key-0001');
grant select on started to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 1. 적는 문은 열쇠만
-- ---------------------------------------------------------------------------

select throws_ok(
  format($$select public.note_reading_progress(%L::uuid, 3, false)$$, (select run_id from started)),
  '42501',
  null,
  '로그인한 사람은 제 시도의 진행도 못 적는다');

set local role anon;
select throws_ok(
  format($$select public.note_reading_progress(%L::uuid, 3, false)$$, (select run_id from started)),
  '42501',
  null,
  '익명도 못 적는다');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. 제출 전에는 안 적힌다 — 그리고 보는 사람은 「얼었다」를 본다
-- ---------------------------------------------------------------------------

select is(
  pg_temp.note((select run_id from started), 2, false),
  false,
  '얼린 채인 작업에는 진행이 안 적힌다');

select is(
  (select row(job_status, sections_begun, body_written)::text from public.my_last_reading_run('self')),
  row('frozen', 0::smallint, false)::text,
  '막 연 시도는 얼린 작업 · 0절 · 본문 전이다');

select pg_temp.take((select run_id from started));
select pg_temp.prepare((select run_id from started));
select is(
  pg_temp.adopt((select run_id from started), 'resp-progress-1'),
  true,
  '제출된 작업이 된다');

-- ---------------------------------------------------------------------------
-- 3. 올라가기만 한다
-- ---------------------------------------------------------------------------

select is(pg_temp.note((select run_id from started), 3, false), true, '제출된 작업에는 적힌다');

select is(
  (select row(job_status, sections_begun, body_written)::text from public.my_last_reading_run('self')),
  row('submitted', 3::smallint, false)::text,
  '보는 사람은 세 번째 절을 쓰는 중인 것을 본다');

select pg_temp.note((select run_id from started), 1, false);
select is(
  (select sections_begun from public.my_last_reading_run('self')),
  3::smallint,
  '늦게 온 작은 값은 되돌리지 못한다');

select pg_temp.note((select run_id from started), 9, true);
select pg_temp.note((select run_id from started), 9, false);
select is(
  (select body_written from public.my_last_reading_run('self')),
  true,
  '본문을 다 쓴 뒤의 거짓은 그것을 되돌리지 못한다');

select pg_temp.note((select run_id from started), 500, true);
select is(
  (select sections_begun from public.my_last_reading_run('self')),
  60::smallint,
  '큰 값은 60 에서 멈춘다 — 거절하지 않는다');

select pg_temp.note((select run_id from started), -4, false);
select is(
  (select sections_begun from public.my_last_reading_run('self')),
  60::smallint,
  '음수는 아무것도 안 바꾼다');

select is(
  (select status from public.my_last_reading_run('self')),
  'running',
  '앞의 칸은 그대로다 — 옛 앱이 읽는 네 칸');

-- ---------------------------------------------------------------------------
-- 4. 남은 못 본다
-- ---------------------------------------------------------------------------

select pg_temp.acting((select other from folks));
select is(
  (select count(*)::int from public.my_last_reading_run('self')),
  0,
  '다른 사람에게는 이 시도도 그 진행도 안 보인다');

select throws_ok(
  $$select sections_begun from public.reading_job$$,
  '42501',
  null,
  '진행이 든 표는 여전히 한 줄도 안 보인다');

-- ---------------------------------------------------------------------------
-- 5. 끝나면 진행도 없다
-- ---------------------------------------------------------------------------

select pg_temp.acting((select owner from folks));
select is(pg_temp.fail((select run_id from started)), true, '시도가 닫힌다');

select is(
  (select row(status, job_status, sections_begun, body_written)::text from public.my_last_reading_run('self')),
  row('failed', null::text, null::smallint, null::boolean)::text,
  '끝난 시도에는 작업의 세 칸이 비어 있다');

select is(
  pg_temp.note((select run_id from started), 5, false),
  false,
  '끝난 뒤에 온 진행은 아무 데도 안 적힌다');

select is(
  (select has_function_privilege('service_role', 'public.note_reading_progress(uuid, integer, boolean)', 'execute')),
  true,
  '열쇠는 부를 수 있다');

select * from finish();
rollback;
