-- 홈이 만드는 중인 풀이를 본다 · 소식이 풀이의 이름을 부른다 (`20261123090000`, ADR 0157)
--
-- 여기서 재는 것 여섯.
--
--   1. **도는 시도만 선다** — 내가 연 것, 대상 · 부를 이름 · 서버가 적은 진행과 함께
--   2. **끝난 시도는 안 선다** — 저장하면 사라진다
--   3. **만료 시각이 지난 시도는 안 선다** — `running` 인 채 남아도 「만드는 중」이 아니다
--   4. **남의 시도는 안 보인다** · 익명은 못 부른다
--   5. **목록에서 뺀 사람의 시도는 안 선다** — `my_readings` 와 같은 좁힘
--   6. **소식이 시도의 두 사람을 내가 부르는 이름으로 낸다** — 내 사주는 이름이 없다
--
-- 3 의 `created_at > now() - reading_run_timeout()` 을 지우면 3 이 붉다.
begin;
select plan(11);

/** 풀이권은 여기서 안 잰다 — 시도를 여는 것이 목적이다(59번과 같은 손잡이) */
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
select tests.signup('running-kim@example.com') as kim,
       tests.signup('running-lee@example.com') as lee;
grant select on folks to authenticated, anon, service_role;

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
grant select on kin to authenticated, anon, service_role;

create temporary table runs as
select
  (select run_id from public.start_reading_run('self', 'running-self-0001')) as solo,
  (select run_id from public.start_reading_run('person', 'running-mom-0001', (select mom from kin))) as mom,
  (select run_id from public.start_reading_run('person', 'running-dad-0001', (select dad from kin))) as dad;
grant select on runs to authenticated, anon, service_role;

-- ── 1. 도는 시도만 선다 ────────────────────────────────────────────────────

select set_eq(
  $$select kind, person_a, label_a, label_b, job_status, sections_begun, body_written
    from public.my_running_readings()$$,
  $$values ('self', (select self_person_id from public.app_user where id = (select kim from folks)),
            null::text, null::text, 'frozen', 0::smallint, false),
           ('person', (select mom from kin), '엄마', null, 'frozen', 0::smallint, false),
           ('person', (select dad from kin), '아빠', null, 'frozen', 0::smallint, false)$$,
  '도는 시도 셋이 대상 · 부를 이름 · 진행과 함께 선다 — 내 사주는 이름이 없다');

-- ── 2. 끝난 시도는 안 선다 ─────────────────────────────────────────────────

reset role;
select isnt(pg_temp.save((select solo from runs)), null, '내 사주풀이를 저장한다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_running_readings() where kind = 'self'),
  0,
  '저장한 시도는 만드는 중이 아니다');

-- ── 3. 만료 시각이 지난 시도는 안 선다 ─────────────────────────────────────

reset role;
update public.reading_run
set created_at = now() - public.reading_run_timeout() - interval '1 minute'
where id = (select dad from runs);

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select array_agg(label_a order by label_a) from public.my_running_readings()),
  array['엄마'],
  '만료 시각이 지난 시도는 running 이어도 서지 않는다');

-- ── 4. 남의 시도 · 익명 ────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_running_readings()),
  0,
  '남의 시도는 보이지 않는다');

set local role anon;
select throws_ok(
  $$select * from public.my_running_readings()$$,
  '42501', null, '익명은 부를 수 없다');

-- ── 5. 목록에서 뺀 사람 ────────────────────────────────────────────────────

reset role;
delete from public.user_person_access
where user_id = (select kim from folks) and person_id = (select mom from kin);

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_running_readings()),
  0,
  '엣지가 없는 사람의 시도는 서지 않는다');

-- ── 6. 소식이 이름을 부른다 ───────────────────────────────────────────────

/* 엄마를 다시 저장한다 — 이름이 다르면 소식이 지금 부르는 이름을 내는지 함께 본다 */
create temporary table aunt as
select public.create_managed_person(
  '이모', null, 'solar', '1965-01-02', '1965-01-02', '07:10', 'female', '부산', 'jo', 'localMean',
  tests.chart('丙'), 'chart-for-tests') as aunt;
grant select on aunt to authenticated, anon, service_role;

create temporary table aunt_run as
select (select run_id from public.start_reading_run('person', 'running-aunt-0001', (select aunt from aunt))) as run;
grant select on aunt_run to authenticated, anon, service_role;

reset role;
select ok(pg_temp.fail((select run from aunt_run)), '이모의 사주풀이가 실패로 닫힌다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select array[reading_kind, reading_label_a, coalesce(reading_label_b, '(없음)')]
   from public.my_notifications() where kind = 'reading_failed'),
  array['person', '이모', '(없음)'],
  '실패 소식이 그 사람을 내가 부르는 이름으로 낸다');

reset role;
update public.user_person_access set local_label = '막내이모'
where user_id = (select kim from folks) and person_id = (select aunt from aunt);
set local role authenticated;
select pg_temp.acting((select kim from folks));
select is(
  (select reading_label_a from public.my_notifications() where kind = 'reading_failed'),
  '막내이모',
  '이름을 고치면 지난 소식도 새 이름을 부른다');

select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_notifications() where reading_label_a is not null),
  0,
  '남의 소식 · 이름은 보이지 않는다');

select * from finish();
rollback;
