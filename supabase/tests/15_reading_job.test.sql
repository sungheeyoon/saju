-- 얼린 입력과 영수증 — **수명이 다른 두 표.**
--
-- 만드는 일이 요청 수명을 떠나면(ADR 0020) 완료가 돌아왔을 때 검사·저장할 재료가
-- 있어야 하고, 같은 사건이 두 번 와도 한 번만 집어야 한다. 그 둘은 사는 기간이 다르다 —
-- 재료는 일이 도는 동안만, 영수증은 재전송이 끝날 때까지.
--
-- 여기서 재는 것 다섯.
--
-- 1. **두 표 다 한 줄도 안 보인다.** 프롬프트와 근거가 그 안에 있다.
-- 2. **판본을 붙든다.** FK 라서 `revisions_in_use()` 가 자동으로 본다(ADR 0011).
-- 3. **도는 작업이 가리키는 판본은 못 지운다.**
-- 4. **시도가 지워지면 얼린 입력도 함께 지워진다** — 주인 없는 재료가 판본을 붙들면 보존이다.
-- 5. **영수증은 `event_id` 로 멱등이고 본문을 들지 않는다.**
begin;
select plan(15);

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * 열쇠인 척하는 손잡이들 — **역할을 갈아입기 전에 만든다.**
 *
 * `authenticated` 로 선 뒤에는 함수를 만들 수 없고, 무엇보다 `security definer` 는
 * 만든 사람의 권한으로 돌아야 서버가 열쇠로 부르는 것과 같은 자리가 된다.
 */
create or replace function pg_temp.freeze(run uuid, rev_a uuid)
returns void
language sql
security definer
as $$
  insert into public.reading_job (
    run_id, revision_a, prompt, evidence, prompt_version,
    requested_model, generation, viewed_at)
  values (
    run, rev_a, '# 역할', '{"charts":{}}', 'reading-prompt-v4',
    'gpt-5.6-luna', '{"store":false}'::jsonb, now());
$$;

create or replace function pg_temp.in_use(rev uuid)
returns boolean
language sql
security definer
-- **후보를 넘겨 묻는다.** 전체를 훑지 않는다(`revisions_in_use(uuid[])`).
as $$ select exists (select 1 from public.revisions_in_use(array[rev]) u where u = rev) $$;

create or replace function pg_temp.drop_revision(rev uuid)
returns void
language sql
security definer
as $$ delete from public.person_chart_revision where id = rev $$;

create or replace function pg_temp.receipt(ev text, resp text)
returns void
language sql
security definer
as $$
  insert into public.reading_webhook_event (event_id, response_id, event_type)
  values (ev, resp, 'response.completed');
$$;

create or replace function pg_temp.drop_run(run uuid)
returns void
language sql
security definer
as $$ delete from public.reading_run where id = run $$;

create or replace function pg_temp.jobs()
returns int
language sql
security definer
as $$ select count(*)::int from public.reading_job $$;

create or replace function pg_temp.receipts()
returns int
language sql
security definer
as $$ select count(*)::int from public.reading_webhook_event $$;

create temporary table folks as
select tests.signup('job-owner@example.com') as owner;
grant select on folks to authenticated, service_role;

-- **여기서 갈아입는다.** 안 갈아입으면 아래 「막힌다」를 한 번도 못 잰다.
set local role authenticated;

select pg_temp.acting((select owner from folks));
select public.create_self_person(
  '나', 'solar', '1991-03-03', '1991-03-03', '09:00', 'male', '서울', 'jo', 'localMean');

create temporary table started as
select * from public.start_reading_run('self', 'job-key-0001');
grant select on started to authenticated, service_role;

select isnt((select run_id from started), null, '시도가 선다');
select isnt((select revision_a from started), null, '시작하면서 판본도 함께 나온다');

-- ---------------------------------------------------------------------------
-- 1. 두 표는 안 보인다
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from public.reading_job$$,
  '42501',
  null,
  '얼린 입력은 브라우저에 한 줄도 안 보인다');

select throws_ok(
  $$select * from public.reading_webhook_event$$,
  '42501',
  null,
  '영수증도 안 보인다');

select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public' and tablename in ('reading_job', 'reading_webhook_event')),
  0,
  '정책이 하나도 없다 — 닿는 길은 열쇠가 부르는 함수뿐이다');

-- ---------------------------------------------------------------------------
-- 얼린 입력 한 줄. 열쇠인 척한다
-- ---------------------------------------------------------------------------


select lives_ok(
  format('select pg_temp.freeze(%L, %L)',
    (select run_id from started), (select revision_a from started)),
  '열쇠는 얼린 입력을 놓을 수 있다');

-- ---------------------------------------------------------------------------
-- 2·3. 판본을 붙든다 — 그리고 그것을 재려면 **판본을 밀어내야 한다**
-- ---------------------------------------------------------------------------

/**
 * **밀어내지 않으면 이 시험은 헛돈다.**
 *
 * 처음에는 시작하자마자 「쓰이는 중인가」를 물었다. 언제나 참이었다 — Person 이 그 판본을
 * 현재로 가리키고 있으니 얼린 입력이 있든 없든 쓰이는 중이다. 그래서 붙드는지 아닌지를
 * 한 번도 안 재고 있었다.
 *
 * 출생정보를 고쳐 현재를 다음 판본으로 옮긴다. 그러면 옛 판본을 붙드는 것은 **얼린 입력
 * 하나뿐**이고, 거기서부터 붙듦이 값을 갖는다.
 */
select public.add_person_revision(
  (select person_id from public.person_chart_revision r
   where r.id = (select revision_a from started)),
  'solar', '1991-03-04', '1991-03-04', '10:00', 'male', '서울', 'jo', 'localMean');

select ok(
  pg_temp.in_use((select revision_a from started)),
  '밀려난 판본도 얼린 입력이 들고 있으면 쓰이는 중이다 — FK 가 그렇게 말한다');

select throws_ok(
  format('select pg_temp.drop_revision(%L)', (select revision_a from started)),
  '23503',
  null,
  '도는 작업이 붙든 판본은 지워지지 않는다');

-- ---------------------------------------------------------------------------
-- 5. 영수증 — `event_id` 가 멱등의 축
-- ---------------------------------------------------------------------------

select lives_ok(
  $$select pg_temp.receipt('evt_1', 'resp_1')$$,
  '사건 하나를 받아 적는다');

select throws_ok(
  $$select pg_temp.receipt('evt_1', 'resp_1')$$,
  '23505',
  null,
  '같은 사건이 두 번 오면 두 번째는 서지 않는다 — 멱등을 DB 가 든다');

select lives_ok(
  $$select pg_temp.receipt('evt_2', 'resp_1')$$,
  '같은 응답에 대한 다른 사건은 따로 선다');

/**
 * **영수증에 자료를 넣지 않는다.**
 *
 * 얼린 입력은 terminal 에 지워지고 영수증은 72시간 넘게 남는다. 한 표에 섞으면 긴 쪽이
 * 이겨서, 지웠어야 할 프롬프트와 근거가 사흘 더 산다.
 */
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and table_name = 'reading_webhook_event'
     and column_name in ('prompt', 'evidence', 'output', 'run_id')),
  0,
  '영수증에는 본문도 prompt 도 evidence 도 run_id 도 없다');

-- ---------------------------------------------------------------------------
-- 4. 시도가 지워지면 얼린 입력도 간다
-- ---------------------------------------------------------------------------

select pg_temp.drop_run((select run_id from started));

select is(pg_temp.jobs(), 0, '시도가 지워지면 얼린 입력도 함께 지워진다');

select ok(
  not pg_temp.in_use((select revision_a from started)),
  '붙들던 것이 사라지면 판본도 풀린다');

select is(pg_temp.receipts(), 2, '영수증은 시도와 함께 지워지지 않는다 — 수명이 다르다');

select * from finish();
rollback;
