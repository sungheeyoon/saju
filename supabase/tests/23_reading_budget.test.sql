-- 하루 전체 상한 — **빗장이 사람당이 아니라 서비스에도 걸린다** (ADR 0039)
--
-- 여기서 재는 것 다섯.
--
-- 1. **실패한 시도도 시간당 상한에 든다.** 안 들면 실패를 반복하는 자리가 상한 없이
--    돈다 — 실패는 풀이권을 안 쓰기 때문이다. 이 파일이 가장 먼저 재는 것이 그것이다.
-- 2. **하루 상한은 남의 시도까지 센다.** 사람당 값들과 달리 이 수는 서비스 전체의 것이다.
-- 3. **막힐 때 풀이권은 안 나간다.** 시도 행 자체가 안 생긴다.
-- 4. **운영자는 사용자보다 먼저 안다.** 경고는 80% 에서, 도달은 상한을 채운 그 시도에서
--    난다 — 둘 다 아직 아무도 벽을 만나기 전이다. 같은 날 두 번은 안 난다.
-- 5. **쓴 토큰은 실패한 시도에도 남는다.** 성공만 세면 지출이 언제나 실제보다 작다.
begin;
select plan(19);

/** 저장 문은 열쇠에만 열려 있다 — 시험은 소유자 권한으로 감싸 부른다(16번과 같은 손잡이) */
create or replace function pg_temp.save(run uuid, rev uuid, spent jsonb)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, rev, null, '## 글', null::smallint,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    jsonb_build_object('provider', 'openai-responses-api', 'usage', spent), now());
$$;

/** 오늘 이미 쓴 것처럼 시도 행을 직접 쌓는다 — 백 번을 실제로 부르지 않으려고 */
create or replace function pg_temp.spend(who uuid, how_many integer)
returns void
language sql
security definer
as $$
  insert into public.reading_run (user_id, kind, status, failure_code, idempotency_key)
  -- 열쇠는 사람마다 유일하다. 이 손잡이를 두 번 부르므로 부를 때마다 새 값을 짓는다.
  select who, 'self', 'failed', 'model-timeout', 'filler-' || gen_random_uuid()::text
  from generate_series(1, how_many) as i;
$$;

set local role authenticated;

create temporary table folks as
select
  tests.signup('budget-kim@example.com') as kim,
  tests.signup('budget-lee@example.com') as lee,
  tests.signup('budget-park@example.com') as park,
  tests.signup('budget-filler@example.com') as filler;
grant select on folks to authenticated, service_role;

create or replace function pg_temp.becomes(who uuid)
returns void
language sql
as $$ select set_config('request.jwt.claims', tests.claims(who), true); select null::void; $$;

select pg_temp.becomes((select kim from folks));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');

select pg_temp.becomes((select lee from folks));
select public.create_self_person(
  '나', 'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '부산', 'jo', 'localMean');

select pg_temp.becomes((select park from folks));
select public.create_self_person(
  '나', 'solar', '1988-11-20', '1988-11-20', '05:40', 'male', '대구', 'jo', 'localMean');

-- ── 쓴 토큰 — 실패에도 남는다 ─────────────────────────────────────────────────

select pg_temp.becomes((select kim from folks));

create temporary table failed_run as
select run_id from public.start_reading_run('self', 'budget-fail-1');

select public.fail_reading_run(
  (select run_id from failed_run), 'model-incomplete', '상한에 걸렸습니다',
  '{"inputTokens": 900, "outputTokens": 100, "totalTokens": 1000}'::jsonb);

-- 시도 행은 사용자에게 안 보인다. 무엇이 적혔는지는 운영자 자리에서 본다.
reset role;
select is(
  (select (r.usage ->> 'totalTokens')::int from public.reading_run r
   where r.id = (select run_id from failed_run)),
  1000,
  '실패한 시도도 쓴 토큰을 들고 닫힌다');

set local role authenticated;
select pg_temp.becomes((select kim from folks));

/** 못 받았으면 안 적는다 — 0 으로 채우면 「안 썼다」와 「못 셌다」가 같은 값이 된다 */
create temporary table unknown_run as
select run_id from public.start_reading_run('self', 'budget-fail-2');

select public.fail_reading_run(
  (select run_id from unknown_run), 'model-submit-failed', '제출이 안 됐습니다');

reset role;
select is(
  (select r.usage from public.reading_run r where r.id = (select run_id from unknown_run)),
  null,
  '못 센 시도의 토큰은 null 이다 — 0 이 아니다');

set local role authenticated;
select pg_temp.becomes((select kim from folks));

-- ── 성공한 시도의 토큰은 글에서 시도 행으로 옮겨진다 ──────────────────────────

create temporary table good_run as
select run_id from public.start_reading_run('self', 'budget-ok-1');

reset role;
select pg_temp.save(
  (select run_id from good_run),
  (select p.current_revision_id from public.person p
   join public.app_user u on u.self_person_id = p.id where u.id = (select kim from folks)),
  '{"totalTokens": 2500}'::jsonb);

select is(
  (select (r.usage ->> 'totalTokens')::int from public.reading_run r
   where r.id = (select run_id from good_run)),
  2500,
  '성공한 시도의 토큰이 시도 행으로 따라온다');

-- ── 지출 표 ───────────────────────────────────────────────────────────────────

select is(
  (select sum(v.total_tokens)::int from public.reading_spend_daily v
   where v.day = (now() at time zone 'Asia/Seoul')::date and v.kind = 'self'),
  3500,
  '오늘 쓴 토큰을 날짜별로 센다');

select cmp_ok(
  (select sum(v.usage_unknown)::int from public.reading_spend_daily v
   where v.day = (now() at time zone 'Asia/Seoul')::date),
  '>=',
  1,
  '토큰을 못 센 시도를 따로 센다 — 그 수가 크면 합이 실제보다 작다는 뜻이다');

select table_privs_are('public', 'reading_spend_daily', 'authenticated', array[]::text[],
  '지출 표는 로그인한 사람에게 닫혀 있다');

select function_privs_are('public', 'reading_daily_budget', array[]::text[],
  'authenticated', array[]::text[],
  '하루 상한은 직접 물어볼 수 없다');

-- ── 실패한 시도도 시간당 상한에 든다 ─────────────────────────────────────────
--
-- 박에게 실패한 시도 스물을 쌓고 스물한 번째를 연다. 실패가 안 세이면 이 시도는 열린다.

reset role;
select pg_temp.spend((select park from folks), public.reading_rate_limit());

set local role authenticated;
select pg_temp.becomes((select park from folks));

select throws_ok(
  $$select * from public.start_reading_run('self', 'park-over-hour')$$,
  '23514',
  '한 시간에 만들 수 있는 결과 수를 넘었습니다. 잠시 뒤에 다시 시도해 주세요.',
  '실패한 시도도 시간당 상한에 든다 — 실패는 풀이권을 안 쓰므로 여기서 안 세면 상한이 없다');

-- ── 하루 전체 상한 ───────────────────────────────────────────────────────────

reset role;
delete from public.ops_alert;

/** 오늘 전체를 「경고 문턱 하나 앞」까지 채운다 */
select pg_temp.spend(
  (select filler from folks),
  public.reading_budget_warning() - 1 - public.reading_spend_today());

select is(
  public.reading_spend_today(),
  public.reading_budget_warning() - 1,
  '오늘 쓴 수는 경고 문턱 하나 앞이다');

set local role authenticated;
select pg_temp.becomes((select kim from folks));

create temporary table warning_run as
select run_id from public.start_reading_run('self', 'budget-warn');

select isnt((select run_id from warning_run), null, '문턱을 넘는 그 시도는 아직 열린다');

reset role;
select is(
  (select count(*)::int from public.ops_alert a where a.kind = 'reading-budget-warning'),
  1,
  '80% 를 넘으면 운영자에게 한 줄이 간다 — **아직 아무도 막히지 않았다**');

/** 이제 상한 하나 앞까지 채운다 */
select pg_temp.spend(
  (select filler from folks),
  public.reading_daily_budget() - 1 - public.reading_spend_today());

set local role authenticated;
select pg_temp.becomes((select lee from folks));

create temporary table last_run as
select run_id from public.start_reading_run('self', 'budget-last');

select isnt((select run_id from last_run), null, '상한을 채우는 그 시도까지는 열린다');

reset role;
select is(
  (select count(*)::int from public.ops_alert a where a.kind = 'reading-budget-reached'),
  1,
  '상한을 채운 그 시도에서 운영자에게 알린다 — 다음 사람이 막히기 전이다');

select is(
  public.notify_ops('reading-budget-reached', '두 번째'),
  false,
  '같은 날 같은 알림은 두 번 안 간다');

-- ── 그다음 사람이 막힌다 ──────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.becomes((select park from folks));

/**
 * **박은 시간당 상한에도 걸려 있다.** 그 벽이 먼저 서면 이 검사가 재려는 것을 못 잰다 —
 * 사람 자격을 다 본 뒤에 하루 상한이 서기 때문이다. 그래서 박의 시도를 한 시간 뒤로
 * 밀어 그 벽을 치운다. 하루 상한은 **오늘 안**이므로 그대로 남는다.
 */
reset role;
update public.reading_run set created_at = now() - interval '2 hours'
where user_id = (select park from folks);

set local role authenticated;
select pg_temp.becomes((select park from folks));

select throws_ok(
  $$select * from public.start_reading_run('self', 'park-over-day')$$,
  '53400',
  '오늘 만들 수 있는 풀이를 모두 썼습니다. 내일 다시 열립니다.',
  '하루 상한에 닿으면 남의 시도까지 센 값으로 막는다');

reset role;
select is(
  (select count(*)::int from public.reading_run r
   where r.user_id = (select park from folks) and r.idempotency_key = 'park-over-day'),
  0,
  '막힌 누름은 시도 행을 안 남긴다 — 그래서 풀이권도 안 나간다');

select is(
  public.reading_spend_today(),
  public.reading_daily_budget(),
  '오늘 쓴 수는 상한에서 멈춘다');

-- ── 문 ────────────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.becomes((select kim from folks));

select throws_ok(
  $$select public.notify_ops('anything', 'anything')$$,
  '42501', null,
  '운영자 알림은 로그인한 사람이 못 부른다 — 부르는 것만으로 밖으로 요청을 만들 수 있다');

select throws_ok(
  $$select * from public.ops_alert$$,
  '42501', null,
  '운영자 알림 표도 안 보인다');

reset role;
select * from finish();
rollback;
