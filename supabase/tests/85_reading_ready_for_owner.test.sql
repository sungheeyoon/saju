-- 다 만든 풀이는 연 사람에게 소식으로 선다 (`20261124090000`, ADR 0157)
--
-- 여기서 재는 것 넷.
--
--   1. **내 사주 · 저장한 사람 · 궁합풀이가 다 되면 연 사람에게 `reading_ready` 가 한 번 선다** — 시도를 가리켜 대상을 함께 낸다
--   2. **실패하면 `reading_ready` 는 안 서고 `reading_failed` 만 선다**
--   3. **남에게는 안 선다**
--   4. **소식이 서면 안 읽은 소식이다** — 머리글의 종이 센다(`bellCount` 는 `request_received` 만 뺀다)
--
-- 인연 궁합은 두 사람 다에게 선다 — `13_reading` 이 잰다. 결과 화면이 읽음으로 바꾸는 것은 `86_reading_ready_read_on_open`. 저장하는 문의 `else` 갈래를 지우면 1 이 붉다.
begin;
select plan(7);

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
select tests.signup('ready-kim@example.com') as kim,
       tests.signup('ready-lee@example.com') as lee;
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
  (select run_id from public.start_reading_run('self', 'ready-self-0001')) as solo,
  (select run_id from public.start_reading_run('person', 'ready-mom-0001', (select mom from kin))) as mom,
  (select run_id from public.start_reading_run(
     'private', 'ready-pair-0001',
     least((select mom from kin), (select dad from kin)),
     greatest((select mom from kin), (select dad from kin)))) as pair,
  (select run_id from public.start_reading_run('person', 'ready-dad-0001', (select dad from kin))) as dad;
grant select on runs to authenticated, service_role;

-- ── 1. 다 되면 연 사람에게 ──────────────────────────────────────────────────

reset role;
select pg_temp.save((select solo from runs));
select pg_temp.save((select mom from runs));
select pg_temp.save((select pair from runs));
select ok(pg_temp.fail((select dad from runs)), '아빠의 사주풀이는 실패로 닫힌다');

set local role authenticated;
select pg_temp.acting((select kim from folks));
select set_eq(
  $$select reading_kind, reading_label_a from public.my_notifications()
    where kind = 'reading_ready' and reading_kind <> 'private'$$,
  $$values ('self', null::text), ('person', '엄마')$$,
  '내 사주 · 저장한 사람의 풀이가 다 되면 저마다 한 번, 대상과 함께 선다');

/* 두 사람의 차례는 uuid 의 차례다 — 어느 이름이 앞인지가 아니라 둘이 함께 서는가를 본다 */
select is(
  (select array[least(reading_label_a, reading_label_b), greatest(reading_label_a, reading_label_b)]
   from public.my_notifications() where kind = 'reading_ready' and reading_kind = 'private'),
  array['아빠', '엄마'],
  '궁합풀이가 다 되면 두 사람의 이름과 함께 한 번 선다');

-- ── 2. 실패는 실패 소식만 ──────────────────────────────────────────────────

select is(
  (select array_agg(kind) from public.my_notifications() n
   where n.reading_kind = 'person' and n.reading_person_a = (select dad from kin)),
  array['reading_failed'],
  '실패한 시도에는 완성 소식이 서지 않는다');

-- ── 3. 남에게는 안 선다 ───────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_notifications()),
  0,
  '시도를 열지 않은 사람에게는 아무 소식도 없다');

-- ── 4. 안 읽은 소식이다 ───────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_notifications() where kind = 'reading_ready' and read_at is null),
  3,
  '완성 소식은 안 읽은 채로 선다 — 종이 센다');

reset role;
select is(
  (select count(*)::int from public.notification n
   where n.kind = 'reading_ready' and n.run_id is null and n.user_id = (select kim from folks)),
  0,
  '연 사람의 완성 소식은 언제나 시도를 가리킨다');

select * from finish();
rollback;
