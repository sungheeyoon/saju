-- 하루 공용 상한은 모델에 닿았을 수 있는 시도를 센다 — 제출 전에 끝난 예약은 자리를 돌려준다 (ADR 0198)
--
-- `reading_spend_today()` 는 오늘 연 `reading_run` 을 상태와 상관없이 셌다(`20260909090000`). 시도를 여는 문
-- (`start_reading_run`)은 로그인한 사람에게 열려 있고 모델에 보내는 걸음(`prepare_reading_job` → 제출)은 앱의 열쇠가
-- 따로 밟는다 — 그래서 문만 바로 부르면 모델에 한 번도 안 가는 예약이 쌓이고, 그것이 만료(`prepare-timeout` ·
-- `expired`)로 끝나도 상한의 자리를 그대로 차지했다. 계정 하나는 시간당 20(`reading_rate_limit`)에 막혀 하루 500 을 못
-- 채우지만 계정 여럿이면 채운다 — 그날 모든 사람의 풀이가 「오늘 만들 수 있는 풀이를 모두 썼습니다」로 선다.
--
-- 재는 것 넷.
--
-- 1. **재현** — 모델에 안 간 채 끝난 예약이 상한을 채워도 다음 누름은 열린다.
-- 2. **아직 도는 예약은 센다** — 곧 제출될 수 있다.
-- 3. **모델에 간 뒤 실패한 시도는 센다** — 비용을 썼을 수 있다. 실패를 통째로 빼지 않는다.
-- 4. **표시는 제출 직전 문이 단다** — 열쇠에만 열린 `prepare_reading_job` 이 `prepared_at` 을 적는다.
begin;
select plan(11);

set local role authenticated;

create temporary table folks as
select tests.signup('spend-kim@example.com') as kim,
       tests.signup('spend-filler@example.com') as filler;
grant select on folks to authenticated, service_role;

select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);
select tests.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');

/** 하루 상한은 전역이다 — 이 스택에 오늘 남은 시도를 비우고 잰다(트랜잭션 안이라 되돌아간다) */
reset role;
delete from public.reading_run
where created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
delete from public.ops_alert;

-- ── 1. 재현 — 모델에 안 간 채 끝난 예약이 상한을 채운다 ───────────────────────

/** 문만 부르고 제출하지 않은 예약 — 복구기가 `prepare-timeout` 으로, 같은 대상의 다음 누름이 `expired` 로 닫는다 */
insert into public.reading_run (user_id, kind, status, failure_code, idempotency_key, finished_at)
select (select filler from folks), 'self', 'failed',
  case when g % 2 = 0 then 'prepare-timeout' else 'expired' end,
  'never-sent-' || g, now()
from generate_series(1, public.reading_daily_budget()) g;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

select lives_ok(
  $$select * from public.start_reading_run('self', 'after-never-sent')$$,
  '모델에 안 간 채 끝난 예약이 상한만큼 쌓여도 다음 누름은 열린다');

-- ── 2. 아직 도는 예약은 센다 ─────────────────────────────────────────────────

reset role;

create temporary table opened as
select r.id from public.reading_run r
where r.user_id = (select kim from folks) and r.idempotency_key = 'after-never-sent';
grant select on opened to authenticated, service_role;

select is(
  public.reading_spend_today(),
  1,
  '센 것은 방금 연 예약 하나뿐이다 — 제출 전에 끝난 예약은 안 센다');

select is(
  (select prepared_at from public.reading_run where id = (select id from opened)),
  null,
  '열기만 한 시도에는 제출 직전 표시가 없다');

/** 도는 시간(`reading_run_timeout`)을 넘긴 채 안 닫힌 예약은 풀이권처럼 자리를 놓는다 */
update public.reading_run set created_at = now() - public.reading_run_timeout() - interval '1 minute'
where id = (select id from opened);

select is(
  public.reading_spend_today(),
  0,
  '도는 시간을 넘긴 미제출 예약은 안 센다');

update public.reading_run set created_at = now() where id = (select id from opened);

-- ── 4. 표시는 제출 직전 문이 단다 ────────────────────────────────────────────

select ok(
  public.prepare_reading_job(
    (select id from opened), '# 프롬프트', '근거', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{}'::jsonb, now()),
  '제출 직전 문을 지난다');

select isnt(
  (select prepared_at from public.reading_run where id = (select id from opened)),
  null,
  '제출 직전 문이 표시를 단다');

select ok(
  not public.prepare_reading_job(
    (select id from opened), '# 다시', '근거', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{}'::jsonb, now()),
  '이미 지난 작업은 다시 안 지난다 — 표시도 그대로다');

-- ── 3. 모델에 간 뒤 실패한 시도는 센다 ───────────────────────────────────────

select public.fail_reading_job((select id from opened), 'model-timeout', '시간 안에 못 받았습니다');

select is(
  public.reading_spend_today(),
  1,
  '모델에 간 뒤 실패한 시도는 그대로 센다 — 비용을 썼을 수 있다');

select is(
  (select array[sum(v.attempts)::int, sum(v.budget_counted)::int] from public.reading_spend_daily v
   where v.day = (now() at time zone 'Asia/Seoul')::date),
  array[public.reading_daily_budget() + 1, public.reading_spend_today()],
  '지출 표는 연 시도 전부와 상한이 센 수를 함께 낸다 — 오늘 줄의 센 수가 상한이 보는 수다');

/** 모델에 간 시도로 상한을 채우면 다음 누름은 막힌다 — 벽 자체는 그대로다 */
insert into public.reading_run (user_id, kind, status, failure_code, idempotency_key, finished_at, prepared_at)
select (select filler from folks), 'self', 'failed', 'model-timeout', 'sent-to-model-' || g, now(), now()
from generate_series(1, public.reading_daily_budget() - 1) g;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

select throws_ok(
  $$select * from public.start_reading_run('self', 'after-sent')$$,
  '53400',
  '오늘 만들 수 있는 풀이를 모두 썼습니다. 내일 다시 열립니다.',
  '모델에 간 시도로 상한이 차면 다음 누름은 막힌다');

-- ── 문 ────────────────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.prepare_reading_job(gen_random_uuid(), 'p', 'e', 'v', 'm', '{}'::jsonb, now())$$,
  '42501', null,
  '제출 직전 문은 로그인한 사람이 못 부른다 — 표시를 스스로 달 수 없다');

reset role;
select * from finish();
rollback;
