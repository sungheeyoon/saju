-- 궁합풀이가 **그 점수를 잰 눈금**을 든다 (ADR 0113, `20261025150000`)
--
-- 여기서 잠그는 것 다섯.
--
--   1. `prepare_reading_job` 이 적은 기준점 · 판 · 사이가 저장하는 문을 지나 풀이에 그대로 옮겨진다
--   2. `my_reading` 이 끝의 세 칸으로 그것을 내준다
--   3. 눈금 없이 얼린 작업(옛 앱)의 풀이는 세 칸이 비고 — 그것이 옛 판 `discovery-v1` 이다
--   4. 모르는 판 · 모르는 사이 · 범위 밖 기준점은 막힌다
--   5. 한 사람 풀이에는 눈금이 없다
begin;
select plan(9);

/** 풀이권은 여기서 안 잰다 — 시도를 여는 것이 목적이다(58번과 같은 손잡이) */
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.prepare(run uuid, baseline smallint, version text, relation text)
returns boolean
language sql
security definer
as $$
  select public.prepare_reading_job(
    run, '# 역할', '{"charts":{}}', 'reading-prompt-v16', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now(), baseline, version, relation);
$$;

create or replace function pg_temp.save(run uuid, score smallint)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, '## 풀이', score, '한 줄.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v16', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as select tests.signup('kim-scale@example.com') as kim;
grant select on folks to authenticated, service_role;

select pg_temp.acting((select kim from folks));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
  tests.chart('甲'), 'chart-for-tests');

create temporary table kin as
select
  public.create_managed_person(
    '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean',
    tests.chart('壬'), 'chart-for-tests') as mom,
  public.create_managed_person(
    '아빠', null, 'solar', '1960-08-11', '1960-08-11', '09:20', 'male', '부산', 'jo', 'localMean',
    tests.chart('庚'), 'chart-for-tests') as dad;
grant select on kin to authenticated, service_role;

create temporary table runs as
select
  (select run_id from public.start_reading_run(
     'private', 'scale-new-0001',
     least((select mom from kin), (select dad from kin)),
     greatest((select mom from kin), (select dad from kin)))) as fresh,
  (select run_id from public.start_reading_run('self', 'scale-self-0001')) as solo;
grant select on runs to authenticated, service_role;

-- ── 1 · 2. 얼린 눈금이 풀이로, 풀이에서 읽는 문으로 ─────────────────────────

reset role;
select ok(pg_temp.prepare((select fresh from runs), 58::smallint, 'v2-beta', 'family'),
  '프롬프트와 같은 걸음에 눈금을 얼린다');
select isnt(pg_temp.save((select fresh from runs), 61::smallint), null, '궁합풀이를 저장한다');

select is(
  (select array[score_baseline::text, score_version, score_relation] from public.reading
   where source_run_id = (select fresh from runs)),
  array['58', 'v2-beta', 'family'],
  '풀이 행이 얼린 기준점 · 판 · 사이를 그대로 든다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select array[score::text, score_baseline::text, score_version, score_relation]
   from public.my_reading('private',
     least((select mom from kin), (select dad from kin)),
     greatest((select mom from kin), (select dad from kin)))),
  array['61', '58', 'v2-beta', 'family'],
  '읽는 문이 점수 옆에 그 점수를 잰 눈금을 낸다');

-- ── 3. 눈금 없이 얼린 작업 — 옛 앱 ─────────────────────────────────────────

select pg_temp.acting((select kim from folks));
create temporary table legacy as
select (select run_id from public.start_reading_run(
  'private', 'scale-old-0001',
  least((select mom from kin), (select dad from kin)),
  greatest((select mom from kin), (select dad from kin)))) as run;
grant select on legacy to authenticated, service_role;

reset role;
select pg_temp.save((select run from legacy), 66::smallint);
select is(
  (select array[score_baseline::text, score_version, score_relation] from public.reading
   where source_run_id = (select run from legacy)),
  array[null, null, null]::text[],
  '옛 앱이 연 풀이는 세 칸이 빈다 — 다시 받은 풀이도 그때의 눈금으로 덮인다');

-- ── 4. 모르는 값은 막힌다 ─────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select kim from folks));
create temporary table odd as
select (select run_id from public.start_reading_run(
  'private', 'scale-odd-0001',
  least((select mom from kin), (select dad from kin)),
  greatest((select mom from kin), (select dad from kin)))) as run;
grant select on odd to authenticated, service_role;
reset role;

select throws_ok(
  $$select pg_temp.prepare((select run from odd), 58::smallint, 'v3', null)$$,
  '23514', null, '모르는 판은 얼리지 못한다');
select throws_ok(
  $$select pg_temp.prepare((select run from odd), 101::smallint, 'v2-beta', null)$$,
  '23514', null, '기준점은 0~100 이다');
select throws_ok(
  $$select pg_temp.prepare((select run from odd), 58::smallint, 'v2-beta', 'lover')$$,
  '23514', null, '모르는 사이는 얼리지 못한다');

-- ── 5. 한 사람 풀이에는 눈금이 없다 ───────────────────────────────────────

select pg_temp.save((select solo from runs), null);
select throws_ok(
  $$update public.reading set score_version = 'v2-beta'
    where source_run_id = (select solo from runs)$$,
  '23514', null, '한 사람 풀이에 눈금을 적을 수 없다');

select * from finish();
rollback;
