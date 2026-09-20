-- 얼린 입력과 영수증 — **수명이 다른 두 표.**
--
-- 만드는 일이 요청 수명을 떠나면(ADR 0020) 완료가 돌아왔을 때 검사·저장할 재료가
-- 있어야 하고, 같은 사건이 두 번 와도 한 번만 집어야 한다. 그 둘은 사는 기간이 다르다 —
-- 재료는 일이 도는 동안만, 영수증은 재전송이 끝날 때까지.
--
-- **입력이 얼는 자리가 옮겨 왔다**(ADR 0071 · #66). 앞서는 Node 가 응답 뒤에 얼렸고, 그
-- 틈에 입력을 고치면 동의한 것과 계산한 것이 갈렸다. 이제 **시도를 여는 그 트랜잭션이**
-- 얼린다.
--
-- 여기서 재는 것.
--
-- 1. **두 표 다 한 줄도 안 보인다.** 프롬프트와 근거가 그 안에 있다.
-- 2. **시도를 열면 얼린 입력이 함께 선다** — 판본 id 가 아니라 **값으로**.
-- 3. **상태와 여섯 열이 묶여 있다** — `frozen` 이면 비어 있고 아니면 차 있다.
-- 4. **집는 일이 원자적이다** — 두 번 부르면 두 번째는 0행이다.
-- 5. **준비 전 작업은 모델 탓으로 안 닫힌다** — 별도 기한, 별도 코드.
-- 6. **동결 뒤의 수정은 얼린 값을 안 건드린다** — 그리고 얼린 한 벌에는 그때의 여덟
--    글자가 함께 든다(ADR 0071).
-- 7. **시도가 끝나면 얼린 입력도 함께 간다** — 주인 없는 재료가 남으면 그것이 보존이다.
-- 8. **영수증은 `event_id` 로 멱등이고 본문을 들지 않는다.**
begin;
select plan(60);

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

/** 얼린 작업을 집는다 — `frozen` → `preparing` 원자적 전이 */
create or replace function pg_temp.take(run uuid)
returns jsonb
language sql
security definer
as $$ select to_jsonb(t) from public.take_reading_job(run) t $$;

/** 수락이 연 시도를 집는다 — 같은 전이를 요청 id 로 */
create or replace function pg_temp.awaiting(request uuid)
returns jsonb
language sql
security definer
as $$ select to_jsonb(t) from public.match_run_awaiting_send(request) t $$;

/** Node 가 지은 것을 적는다 — 계산 입력은 안 받는다 */
create or replace function pg_temp.prepare(run uuid)
returns boolean
language sql
security definer
as $$
  select public.prepare_reading_job(
    run, '# 역할', '{"charts":{}}', 'reading-prompt-v4',
    'gpt-5.6-luna', '{"store":false}'::jsonb, now());
$$;

/** 얼린 작업 한 줄 그대로 — 무엇이 얼었는지 값으로 본다 */
create or replace function pg_temp.job(run uuid)
returns jsonb
language sql
security definer
as $$ select to_jsonb(j) from public.reading_job j where j.run_id = run $$;

/** 복구기가 보는 한 줄 — 기한과 실패 코드가 함께 온다 */
create or replace function pg_temp.open_job(run uuid)
returns jsonb
language sql
security definer
as $$ select to_jsonb(o) from public.open_reading_jobs() o where o.run_id = run $$;

/** 작업을 늙힌다 — 기한을 재려고 시계를 기다리지 않는다 */
create or replace function pg_temp.age(run uuid, how interval)
returns void
language sql
security definer
as $$ update public.reading_job set created_at = created_at - how where run_id = run $$;

/** 얼린 행에 지은 것을 억지로 적는다 — 검사식이 무는지 보려고 */
create or replace function pg_temp.force_prompt(run uuid)
returns void
language sql
security definer
as $$ update public.reading_job set prompt = '# 몰래' where run_id = run $$;

/** 지은 것 없이 상태만 옮긴다 — 같은 검사식의 반대쪽 */
create or replace function pg_temp.force_status(run uuid, next text)
returns void
language sql
security definer
as $$ update public.reading_job set status = next where run_id = run $$;

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

create or replace function pg_temp.receipts()
returns int
language sql
security definer
as $$ select count(*)::int from public.reading_webhook_event $$;

create or replace function pg_temp.fail_job(run uuid, code text)
returns boolean
language sql
security definer
as $$ select public.fail_reading_job(run, code, '끊겼다') $$;

create or replace function pg_temp.run_status(run uuid)
returns text
language sql
security definer
as $$ select status from public.reading_run where id = run $$;

create or replace function pg_temp.notices(uid uuid)
returns int
language sql
security definer
as $$
  select count(*)::int from public.notification
  where user_id = uid and kind = 'reading_failed';
$$;

create or replace function pg_temp.mark_processed(ev text)
returns void
language sql
security definer
as $$ select public.mark_reading_webhook_processed(ev) $$;

create or replace function pg_temp.processed_at(ev text)
returns timestamptz
language sql
security definer
as $$ select processed_at from public.reading_webhook_event where event_id = ev $$;

create or replace function pg_temp.cron_schedule(name text)
returns text
language sql
security definer
as $$ select schedule from cron.job where jobname = name $$;

create or replace function pg_temp.cron_count(name text)
returns int
language sql
security definer
as $$ select count(*)::int from cron.job where jobname = name $$;

create or replace function pg_temp.wake()
returns void
language sql
security definer
as $$ select public.wake_reading_recovery() $$;

create or replace function pg_temp.record_event(ev text, resp text, kind text)
returns boolean
language sql
security definer
as $$ select public.record_reading_webhook_event(ev, resp, kind) $$;

/**
 * **집는 순간 소비된다.** 두 번 부르면 두 번째는 0행이므로, 한 번 불러 통째로 담아 두고
 * 거기서 여러 값을 잰다 — 값마다 다시 부르면 첫 번째만 참이 된다.
 */
create or replace function pg_temp.claim_once(resp text)
returns jsonb
language sql
security definer
as $$ select to_jsonb(j) from public.claim_reading_job(resp) j $$;

create or replace function pg_temp.set_response(run uuid, resp text)
returns void
language sql
security definer
as $$ update public.reading_job set response_id = resp, status = 'submitted' where run_id = run $$;

create or replace function pg_temp.job_status(run uuid)
returns text
language sql
security definer
as $$ select status from public.reading_job where run_id = run $$;

/** 다섯 오행 개수만 주면 요약 한 벌이 된다 — 인연 쪽 시험이 쓴다 */
create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

create temporary table folks as
select tests.signup('job-owner@example.com') as owner;
grant select on folks to authenticated, service_role;

/**
 * **이 시험이 만든 얼린 입력만 센다.**
 *
 * 표 전체를 세고 있었다. 흐름 검사가 같은 스택에 남긴 행이 있으면 「지워졌는가」가
 * 「DB 가 비어 있는가」가 되고, 그때 이 파일은 순서에 따라 붉어진다.
 */
create or replace function pg_temp.jobs()
returns int
language sql
security definer
as $$
  select count(*)::int
  from public.reading_job j
  join public.reading_run r on r.id = j.run_id
  where r.user_id in (select owner from folks)
$$;


-- **여기서 갈아입는다.** 안 갈아입으면 아래 「막힌다」를 한 번도 못 잰다.
set local role authenticated;

select pg_temp.acting((select owner from folks));
select public.create_self_person(
  '나', 'solar', '1991-03-03', '1991-03-03', '09:00', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');

create temporary table started as
select * from public.start_reading_run('self', 'job-key-0001');
grant select on started to authenticated, service_role;

select isnt((select run_id from started), null, '시도가 선다');

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
-- 2. 시도를 여는 그 트랜잭션이 얼린다 (ADR 0071 · #66)
-- ---------------------------------------------------------------------------

/**
 * **누가 부른 적이 없는데 행이 서 있다.**
 *
 * 이 한 건이 이 변경의 전부다. 앞서는 Node 가 응답 뒤에 넣었고 그 틈이 열려 있었다.
 */
select is(
  pg_temp.job_status((select run_id from started)),
  'frozen',
  '시도를 열면 얼린 입력이 함께 선다 — 아무도 안 넣었는데');

/**
 * **판본 id 가 아니라 값이다.**
 *
 * 판본을 지우면 id 는 아무것도 안 가리킨다. 근거에는 대운·신살이 들어가고 그것은
 * 경도·시간 기준·성별이 있어야 나므로, **작업에는 입력 전체가** 간다.
 */
select is(
  (select pg_temp.job((select run_id from started)) -> 'birth_a' ->> 'birth_time'),
  '09:00:00',
  '얼린 입력이 출생 시각을 값으로 든다');

select is(
  (select pg_temp.job((select run_id from started)) -> 'birth_a' ->> 'city'),
  '서울',
  '출생지도 값으로 든다 — 판본을 다시 읽지 않는다');

/**
 * **여덟 글자도 같은 한 벌에 언다**(ADR 0071).
 *
 * 저장하는 문이 이 값을 글에 옮겨 적는다 — 앱이 대지 않으므로 「그때 무엇을 보고
 * 썼나」가 DB 안에서만 정해진다.
 */
select is(
  (select pg_temp.job((select run_id from started)) -> 'chart_a'),
  tests.chart(),
  '얼린 한 벌이 그때의 여덟 글자를 든다');

select is(
  (select pg_temp.job((select run_id from started)) ->> 'chart_b'),
  null,
  '한 사람짜리에는 둘째 여덟 글자가 없다');

/**
 * 부르는 말도 함께 언다. 만드는 동안 이름표를 고친 사용자의 글이 두 이름을 섞어 쓰지
 * 않으려면 이 값도 생성 입력이다.
 */
select is(
  (select pg_temp.job((select run_id from started)) -> 'about' -> 'names' ->> 'a'),
  (select nickname from public.app_user where id = (select owner from folks)),
  '그때 그 사람을 부르던 말이 함께 언다 — 자기 사람은 계정 닉네임으로 불린다');

-- ---------------------------------------------------------------------------
-- 3. 상태와 여섯 열이 묶여 있다
-- ---------------------------------------------------------------------------

/**
 * **「반쯤 지어진 작업」이 실재할 수 없다.**
 *
 * 하나씩 `null` 을 허용하면 그 상태를 읽는 코드가 생긴다. 검사식 하나로 묶어 두면
 * 그 상태가 아예 없다 — 양쪽 방향을 다 문다.
 */
select is(
  (select pg_temp.job((select run_id from started)) ->> 'prompt'),
  null,
  '얼리기만 한 작업에는 프롬프트가 없다');

select throws_ok(
  format('select pg_temp.force_prompt(%L)', (select run_id from started)),
  '23514',
  null,
  '얼린 행에 프롬프트만 적을 수 없다');

select throws_ok(
  format($$select pg_temp.force_status(%L, 'submitting')$$, (select run_id from started)),
  '23514',
  null,
  '지은 것 없이 「보내는 중」으로 갈 수 없다');

-- ---------------------------------------------------------------------------
-- 4. 준비 전 작업은 **모델 탓으로 안 닫힌다**
-- ---------------------------------------------------------------------------

/**
 * **모델을 부른 적도 없이 `model-timeout` 으로 닫히던 자리다.**
 *
 * 얼리기만 한 작업은 제출이 나간 적이 없다는 것이 상태로 증명된다. 그때 닫는 코드가
 * 모델을 가리키면 그 기록은 거짓이고, 어디를 손봐야 하는지도 안 가리킨다.
 */
select is(
  (select pg_temp.open_job((select run_id from started)) ->> 'failure_code'),
  'prepare-timeout',
  '준비 전 작업은 모델이 아니라 준비가 늦은 것으로 닫힌다');

select is(
  (select (pg_temp.open_job((select run_id from started)) ->> 'overdue')::boolean),
  false,
  '방금 언 작업은 아직 기한이 안 지났다');

/** 모델 기한(8분)으로 쟀다면 3분에는 안 걸린다 — 시계가 갈렸는지를 이 한 건이 잰다 */
select pg_temp.age((select run_id from started), interval '3 minutes');

select is(
  (select (pg_temp.open_job((select run_id from started)) ->> 'overdue')::boolean),
  true,
  '준비 기한은 모델 기한보다 짧다 — 3분이면 이미 지났다');

select is(
  (select pg_temp.open_job((select run_id from started)) ->> 'response_id'),
  null,
  '이름표가 없으니 회수할 것도 없다 — 복구기는 닫기만 한다');

/** 늙힌 것을 되돌린다. 아래 시험들은 살아 있는 작업을 본다 */
select pg_temp.age((select run_id from started), interval '-3 minutes');

-- ---------------------------------------------------------------------------
-- 5. 집는 일은 **원자적 전이**다
-- ---------------------------------------------------------------------------

/**
 * **조회와 전이가 갈리면 두 번 제출된다.**
 *
 * 복구기와 응답 뒤 콜백이 겹치거나 같은 누름이 재전송되면 둘이 같은 작업을 들고
 * 나란히 모델을 부른다. 한 문장으로 옮기면 먼저 부른 쪽 하나만 행을 받는다.
 */
create temporary table taken as select pg_temp.take((select run_id from started)) as job;
grant select on taken to authenticated, service_role;

select is(
  (select job ->> 'run_id' from taken),
  (select run_id::text from started),
  '집으면 그 작업을 내준다');

select is(
  (select job -> 'birth_a' ->> 'city' from taken),
  '서울',
  '집으면서 얼린 입력을 함께 낸다 — 집은 쪽은 이 뒤로 다시 안 읽는다');

select is(
  pg_temp.job_status((select run_id from started)),
  'preparing',
  '집으면 표시한다');

select is(
  pg_temp.take((select run_id from started)),
  null,
  '두 번째 호출은 0행이다 — 같은 작업이 두 번 안 나간다');

-- ---------------------------------------------------------------------------
-- 6. Node 가 지은 것을 적는다
-- ---------------------------------------------------------------------------

select ok(
  pg_temp.prepare((select run_id from started)),
  '지은 것을 적는다');

select is(
  pg_temp.job_status((select run_id from started)),
  'submitting',
  '적고 나면 「보내는 중」이다');

select is(
  (select pg_temp.job((select run_id from started)) ->> 'prompt'),
  '# 역할',
  '적은 프롬프트가 그대로 앉는다');

/**
 * **계산 입력은 안 받는다.** 앱이 판본을 대는 자리가 하나 남아 있었는데, 그 값이
 * 무엇이든 DB 는 그것이 이 시도의 것인지 알 수 없었다(ADR 0013·0071).
 */
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'prepare_reading_job'
     and pg_get_function_arguments(p.oid) like '%revision%'),
  0,
  '적는 문은 판본을 인자로 안 받는다');

-- ---------------------------------------------------------------------------
-- 7. 얼린 값은 **그 뒤의 수정에 안 움직인다**
-- ---------------------------------------------------------------------------

/**
 * **고쳐 놓고 재야 이 시험이 무엇을 잰다.**
 *
 * 판본을 붙들던 시절에는 FK 가 그 일을 했다. 이제 붙들 행이 없고 **값이 얼어 있으므로**,
 * 재는 자리도 「그 값이 안 움직이는가」 하나다. 고치지 않고 물으면 언제나 참이다.
 */
select public.add_person_revision(
  (select self_person_id from public.app_user where id = (select owner from folks)),
  'solar', '1991-03-04', '1991-03-04', '10:00', 'male', '서울', 'jo', 'localMean',
  tests.chart('丁'), 'chart-for-tests');

/**
 * **동결 이후의 수정은 얼린 값을 안 건드린다**(ADR 0071).
 *
 * 방금 출생 시각을 10:00 으로 고쳤다. 얼린 입력이 09:00 그대로여야 「이미 시작된 생성은
 * 동결값으로 끝난다」가 참이다.
 */
select is(
  (select pg_temp.job((select run_id from started)) -> 'birth_a' ->> 'birth_time'),
  '09:00:00',
  '동결 뒤에 입력을 고쳐도 얼린 값은 안 움직인다');

/** 여덟 글자도 같다 — 지금 Person 은 丁 을 들지만 얼린 한 벌은 丙 그대로다 */
select is(
  (select pg_temp.job((select run_id from started)) -> 'chart_a'),
  tests.chart(),
  '얼린 여덟 글자도 그 자리에 그대로 있다');

-- ---------------------------------------------------------------------------
-- 8. 도착을 적는 문 — 두 번째는 `false` 다
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.record_reading_webhook_event('evt_x', 'resp_x', 'response.completed')$$,
  '42501',
  null,
  '도착을 적는 문도 브라우저에 안 열려 있다');

select ok(
  pg_temp.record_event('evt_a', 'resp_a', 'response.completed'),
  '처음 온 사건은 true 를 낸다');

/**
 * **두 번째는 예외가 아니라 `false` 다.** 재전송은 정상이고, 여기서 예외를 내면
 * provider 가 2xx 를 못 받아 72시간 동안 또 보낸다.
 */
select ok(
  not pg_temp.record_event('evt_a', 'resp_a', 'response.completed'),
  '같은 사건이 다시 오면 false — 예외가 아니다');

-- ---------------------------------------------------------------------------
-- 9. 일감을 집는 문 — 얼린 입력을 그대로 들고 온다
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select * from public.claim_reading_job('resp_x')$$,
  '42501',
  null,
  '일감을 집는 문도 브라우저에 안 열려 있다');

select pg_temp.set_response((select run_id from started), 'resp_job');

create temporary table claimed as select pg_temp.claim_once('resp_job') as job;
grant select on claimed to authenticated, service_role;

select is(
  (select job ->> 'run_id' from claimed),
  (select run_id::text from started),
  '이름표로 일감을 찾는다');

/**
 * **얼린 입력을 열에서 읽는다.** 전에는 `revision_birth` 로 판본을 그 자리에서 읽었다 —
 * 검사가 출생 원문을 알아야 유출을 재는데, 이제 그 값은 시도를 열 때 이미 얼었다.
 */
select is(
  (select job -> 'birth_a' ->> 'birth_time' from claimed),
  '09:00:00',
  '얼린 출생 원문이 함께 온다 — 그 사이 입력을 고쳤어도 동결값이다');

select is(
  (select job ->> 'prompt' from claimed),
  '# 역할',
  '얼린 프롬프트도 그대로 온다 — 그 사이 배포가 나도 보낸 것으로 검사한다');

select is(
  pg_temp.job_status((select run_id from started)),
  'retrieving',
  '집으면 표시한다 — 복구기가 같은 일감을 두 번 집지 않게');

select is(
  pg_temp.claim_once('resp_job'),
  null,
  '이미 집힌 일감은 다시 안 나온다');

-- ---------------------------------------------------------------------------
-- 10. 열쇠가 실패로 닫는다 — 사용자 JWT 없이
-- ---------------------------------------------------------------------------

/**
 * **사용자 쪽 문으로는 못 닫는다.** `fail_reading_run` 은 `auth.uid()` 를 걸어서
 * provider 가 두드릴 수 없다. 그 사실이 이 함수가 있는 이유이므로 함께 잰다.
 */
select throws_ok(
  format($$select public.fail_reading_job(%L::uuid, 'model-timeout', null)$$,
    (select run_id from started)),
  '42501',
  null,
  '실패로 닫는 문은 브라우저에 안 열려 있다');

select ok(
  pg_temp.fail_job((select run_id from started), 'model-timeout'),
  '열쇠는 시도를 실패로 닫는다');

select is(
  pg_temp.run_status((select run_id from started)),
  'failed',
  '시도가 닫혔다');

select is(
  pg_temp.notices((select owner from folks)),
  1,
  '닫는 일과 알리는 일이 한 문장 안에 있다');

/**
 * **끝난 것을 다시 닫으라고 해도 예외를 내지 않는다.**
 *
 * 우리 deadline 이 먼저 닫은 뒤에 webhook 이 도착하는 것은 정상이다. 거기서 예외를 내면
 * provider 가 2xx 를 못 받아 72시간 동안 같은 사건을 다시 보낸다.
 */
select ok(
  not pg_temp.fail_job((select run_id from started), 'model-timeout'),
  '이미 끝난 시도는 「닫을 것이 없었다」를 값으로 낸다 — 예외가 아니다');

select is(
  pg_temp.notices((select owner from folks)),
  1,
  '두 번째 호출은 알림을 더 넣지 않는다');

/**
 * **끝나면 얼린 입력이 간다 — 어느 길로 끝나든.** 지우는 일을 부르는 쪽에 맡기면
 * 자리가 넷이 되고 하나는 안 고쳐진다. 상태 전이에 매달아서 여기서도 그냥 지나간다.
 */
select is(pg_temp.jobs(), 0, '실패로 닫혀도 얼린 입력은 함께 지워진다');

/** 끝난 시도는 집을 것도 없다 — 집는 문이 run 의 상태를 함께 본다 */
select is(
  pg_temp.take((select run_id from started)),
  null,
  '끝난 시도의 작업은 집히지 않는다');

-- ---------------------------------------------------------------------------
-- 11. 영수증 — `event_id` 가 멱등의 축
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
-- 12. 시도가 지워지면 얼린 입력도 간다
-- ---------------------------------------------------------------------------

select pg_temp.drop_run((select run_id from started));

select is(pg_temp.jobs(), 0, '시도가 지워져도 남는 얼린 입력은 없다 (cascade)');

select is(pg_temp.receipts(), 3, '영수증은 시도와 함께 지워지지 않는다 — 수명이 다르다');

-- ---------------------------------------------------------------------------
-- 13. 영수증에 「집었다」를 적는다
-- ---------------------------------------------------------------------------

/**
 * **열을 만든 것과 채우는 것은 다른 일이다.**
 *
 * `processed_at` 을 만들고 인덱스까지 걸어 놓고 채우는 자리를 안 썼다. 첫 실호출에서
 * 드러났다 — webhook 이 도착하고 결과도 1초 만에 저장됐는데 영수증은 `null` 로 남았다.
 */
select is(
  pg_temp.processed_at('evt_a'),
  null,
  '적기 전에는 비어 있다');

select pg_temp.mark_processed('evt_a');

select isnt(
  pg_temp.processed_at('evt_a'),
  null,
  '집고 나면 시각이 적힌다');

/** 두 번 적어도 처음 시각이 남는다 — 재전송이 「방금 집었다」로 보이면 안 된다 */
select lives_ok(
  $$select pg_temp.mark_processed('evt_a')$$,
  '이미 적힌 것을 다시 적어도 조용하다');

-- ---------------------------------------------------------------------------
-- 14. 수락이 연 시도도 **한 번만** 나간다
-- ---------------------------------------------------------------------------

/**
 * 수락은 시도를 열고 입력을 얼리기만 한다(ADR 0038). 그것을 집어 가는 문이
 * `match_run_awaiting_send` 이고, **집는 일이 원자적이어야** 같은 시도가 두 번 안 나간다.
 *
 * 앞서는 이 문이 「job 행이 없는 run」을 골랐다. 얼리는 일이 수락 트랜잭션으로 들어오면서
 * 그 조건은 **아무것도 안 고르게** 됐다 — 이 절이 그 자리를 붙든다.
 */
reset role;
set local role authenticated;

create temporary table pair as
select
  pg_temp.participant('job-kim@example.com', '김일', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('job-lee@example.com', '이일', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on pair to authenticated, service_role;

reset role;

/** 다른 검사가 남긴 참여자는 이 시험의 관심 밖이다(11·13번과 같은 이유) */
update public.discovery_profile set opted_in_at = null
where user_id not in (select kim from pair union all select lee from pair);

set local role authenticated;

select pg_temp.acting((select kim from pair));
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from pair)) as request_id;
grant select on asked to authenticated, service_role;

select pg_temp.acting((select lee from pair));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '이가 수락해 Match 가 선다');

/**
 * **수락 트랜잭션이 얼렸다.** 청한 사람 이름으로 선 시도에 얼린 입력이 딸려 있어야
 * 한다 — 없으면 제출하는 쪽이 읽을 것이 없고, 그 Match 는 만료까지 빈 채로 남는다.
 */
create temporary table first_take as
select pg_temp.awaiting((select request_id from asked)) as job;
grant select on first_take to authenticated, service_role;

select isnt(
  (select job from first_take),
  null,
  '수락이 연 시도를 열쇠가 집는다');

select is(
  (select job -> 'birth_a' ->> 'city' from first_take),
  '서울',
  '수락 트랜잭션이 양쪽 입력을 값으로 얼렸다');

select isnt(
  (select job -> 'birth_b' from first_take),
  null,
  '두 번째 사람의 입력도 함께 언다');

/**
 * **수락이 얼리는 여덟 글자는 Match 가 베껴 둔 그것이다**(ADR 0071).
 *
 * `person.current_chart` 를 다시 읽지 않는다 — 수락과 제출 사이에 한쪽이 입력을 고치면
 * 동의한 것과 계산한 것이 갈리기 때문이다.
 */
reset role;
select is(
  (select j.chart_a = m.chart_low and j.chart_b = m.chart_high
   from public.reading_job j
   join public.reading_run r on r.id = j.run_id
   join public.match m on m.id = r.match_id
   join public.match_request q on q.id = m.request_id
   where q.id = (select request_id from asked)),
  true,
  '수락이 얼린 한 벌은 Match 의 여덟 글자를 그대로 든다');
set local role authenticated;

/**
 * **두 번째는 0행이다.**
 *
 * 조회와 전이가 갈리면 두 프로세스가 같은 시도를 들고 두 번 제출한다 — 돈이 두 번
 * 나가고 결과 하나는 미아가 된다.
 */
select is(
  pg_temp.awaiting((select request_id from asked)),
  null,
  '같은 요청을 두 번 집으면 두 번째는 0행이다');

select * from finish();
rollback;
