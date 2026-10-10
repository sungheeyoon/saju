-- 결과 화면을 열면 그 풀이의 완성 소식이 읽음이 된다 (`20261126090000`, ADR 0157 「2026-10-10 덧」)
--
-- 여기서 재는 것 넷 — 내가 주인인 풀이(내 사주 · 저장한 사람 · 궁합풀이)로 잰다. 인연 궁합은 `13_reading` 이 잰다.
--
--   1. **그 풀이의 완성 소식만 읽음이 된다** — 다른 풀이의 완성 소식 · 실패 소식은 안 읽은 채다
--   2. **여러 번 열어도 한 번이다** — 두 번째는 0 이고 읽은 시각이 그대로다
--   3. **남의 소식은 못 바꾼다** — 남의 풀이 id 로 불러도 내 소식은 그대로, 내 풀이 id 를 남이 불러도 내 소식은 그대로
--   4. **안 읽은 수가 따라 준다** — 종(`unread_notifications`)이 하나 준다
--
-- 문의 대상 조건을 지우면(모든 완성 소식을 바꾸면) 1 이, `read_at is null` 을 지우면 2 가, `visible_notifications()` 대신 표를
-- 그대로 읽으면 3 이 붉다.
begin;
select plan(11);

create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(run uuid)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, '## 풀이', null, '한 줄.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v16', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

create or replace function pg_temp.fail(run uuid)
returns boolean
language sql
security definer
as $$ select public.fail_reading_job(run, 'model-failed', '끊겼다') $$;

set local role authenticated;

create temporary table folks as
select tests.signup('opened-kim@example.com') as kim,
       tests.signup('opened-lee@example.com') as lee;
grant select on folks to authenticated, service_role;

select pg_temp.acting((select kim from folks));
select tests.create_self_person(
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
  (select run_id from public.start_reading_run('self', 'opened-self-0001')) as solo,
  (select run_id from public.start_reading_run('person', 'opened-mom-0001', (select mom from kin))) as mom,
  (select run_id from public.start_reading_run(
     'private', 'opened-pair-0001',
     least((select mom from kin), (select dad from kin)),
     greatest((select mom from kin), (select dad from kin)))) as pair,
  (select run_id from public.start_reading_run('person', 'opened-dad-0001', (select dad from kin))) as dad;
grant select on runs to authenticated, service_role;

/* 이도 제 사주를 받는다 — 남의 풀이 id 로 부르는 자리를 재려고 */
select pg_temp.acting((select lee from folks));
select tests.create_self_person(
  '나', 'solar', '1992-03-03', '1992-03-03', '09:00', 'male', '부산', 'jo', 'localMean',
  tests.chart('丙'), 'chart-for-tests');
create temporary table lee_runs as
select (select run_id from public.start_reading_run('self', 'opened-lee-self-0001')) as solo;
grant select on lee_runs to authenticated, service_role;

reset role;
create temporary table readings as
select
  pg_temp.save((select solo from runs)) as solo,
  pg_temp.save((select mom from runs)) as mom,
  pg_temp.save((select pair from runs)) as pair,
  pg_temp.save((select solo from lee_runs)) as lee_solo;
grant select on readings to authenticated, service_role;
select ok(pg_temp.fail((select dad from runs)), '아빠의 사주풀이는 실패로 닫힌다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select public.unread_notifications()),
  4,
  '김에게 안 읽은 소식이 넷이다 — 완성 셋과 실패 하나');

-- ── 1. 그 풀이의 완성 소식만 ───────────────────────────────────────────────

select is(
  public.mark_reading_ready_read((select mom from readings)),
  1,
  '엄마 사주풀이를 열면 그 완성 소식 하나가 읽음이 된다');

select set_eq(
  $$select coalesce(reading_kind, '') || ':' || kind from public.my_notifications() where read_at is null$$,
  $$values ('self:reading_ready'), ('private:reading_ready'), ('person:reading_failed')$$,
  '다른 풀이의 완성 소식과 실패 소식은 안 읽은 채다');

-- ── 4. 종이 따라 준다 ──────────────────────────────────────────────────────

select is(
  (select public.unread_notifications()),
  3,
  '안 읽은 수가 하나 준다');

-- ── 2. 여러 번 열어도 한 번 ───────────────────────────────────────────────

reset role;
create temporary table first_read as
select n.read_at from public.notification n
join public.reading_run r on r.id = n.run_id
where n.kind = 'reading_ready' and r.id = (select mom from runs);
grant select on first_read to authenticated, service_role;
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  public.mark_reading_ready_read((select mom from readings)),
  0,
  '같은 풀이를 다시 열면 바꿀 것이 없다');

reset role;
select is(
  (select n.read_at from public.notification n
   join public.reading_run r on r.id = n.run_id
   where n.kind = 'reading_ready' and r.id = (select mom from runs)),
  (select read_at from first_read),
  '다시 열어도 읽은 시각이 그대로다');
set local role authenticated;

/* 궁합풀이도 두 사람이 같은 차례로 맞는다 */
select pg_temp.acting((select kim from folks));
select is(
  public.mark_reading_ready_read((select pair from readings)),
  1,
  '궁합풀이를 열면 그 완성 소식 하나가 읽음이 된다');

-- ── 3. 남의 소식은 못 바꾼다 ───────────────────────────────────────────────

select is(
  public.mark_reading_ready_read((select lee_solo from readings)),
  0,
  '남의 풀이 id 로 불러도 내 소식은 그대로다');

select pg_temp.acting((select lee from folks));
select is(
  public.mark_reading_ready_read((select solo from readings)),
  0,
  '남이 내 풀이 id 로 불러도 바꿀 것이 없다');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_notifications() where reading_kind = 'self' and read_at is null),
  1,
  '내 사주풀이의 완성 소식은 안 읽은 채다');

select * from finish();
rollback;
