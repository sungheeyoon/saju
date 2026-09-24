-- 풀이 목록의 **표지 두 일간** — 누구의 것이 어느 자리에 서는가 (G-59)
--
-- `my_readings()` 가 끝에 `day_master_a` · `day_master_b` 를 낸다. 여기서 잠그는 것 넷.
--
--   1. 내가 주인인 셋은 **그 풀이를 만들 때의** 일간이다 — 뒤에 출생 정보를 고쳐도 안 바뀐다(2026-09-25)
--   2. `private` 은 행의 `person_a` · `person_b` 와 같은 차례다
--   3. `match` 는 **앞자리가 보는 사람, 뒷자리가 상대**다 — 두 사람이 같은 줄을 서로 반대로 본다
--   4. `match` 의 상대 일간은 **동의 당시 사본**이다 — 상대가 뒤에 입력을 고쳐도 안 바뀐다.
--      상대의 지금 명식이 새면 동의한 대상 밖의 값이 이 목록으로 나간다
--
-- 사람마다 일간을 다르게 준다(`tests.chart(day_stem)`). 모두 같은 일간이면 「누구의 것인가」를 못 가른다.
begin;
select plan(13);

/** 풀이권은 여기서 안 잰다 — 대상 넷에 시도를 여는 것이 목적이다(22번과 같은 손잡이) */
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

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

create or replace function pg_temp.participant(mail text, who text, stem text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(run uuid, score smallint)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, '## 풀이', score, '한 줄.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-cover@example.com', '김표지', '甲', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-cover@example.com', '이표지', '庚', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on folks to authenticated, service_role;

select pg_temp.acting((select kim from folks));
create temporary table kin as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean',
  tests.chart('壬'), 'chart-for-tests') as mom;
grant select on kin to authenticated, service_role;

reset role;

update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select kim from folks union all select lee from folks);

create temporary table people as
select k.self_person_id as kim_person, l.self_person_id as lee_person
from folks
join public.app_user k on k.id = folks.kim
join public.app_user l on l.id = folks.lee;
grant select on people to authenticated, service_role;

set local role authenticated;
select pg_temp.acting((select kim from folks));

select pg_temp.save(run_id, null) from public.start_reading_run('self', 'cover-self-0001');
select pg_temp.save(run_id, null) from public.start_reading_run('person', 'cover-person-0001', (select mom from kin));
select pg_temp.save(run_id, 70::smallint) from public.start_reading_run(
  'private', 'cover-private-0001',
  least((select mom from kin), (select kim_person from people)),
  greatest((select mom from kin), (select kim_person from people)));

select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');
create temporary table asked as select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 Match 가 선다');

reset role;
select pg_temp.save(r.id, 64::smallint)
from public.reading_run r
join public.match m on m.id = r.match_id
where m.user_low in (select kim from folks union all select lee from folks)
  and r.status = 'running';
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 1. 내가 주인인 셋 ───────────────────────────────────────────────────────

select is(
  (select array[day_master_a, day_master_b] from public.my_readings() where kind = 'self'),
  array['甲', null],
  '내 사주는 앞자리에 내 일간 하나다');

select is(
  (select array[day_master_a, day_master_b] from public.my_readings() where kind = 'person'),
  array['壬', null],
  '저장한 사람의 풀이는 그 사람의 일간 하나다');

-- ── 2. 두 사람 궁합은 행의 차례 그대로 ─────────────────────────────────────

select is(
  (select array[day_master_a, day_master_b] from public.my_readings() where kind = 'private'),
  (select case when (select mom from kin) < (select kim_person from people)
            then array['壬', '甲'] else array['甲', '壬'] end),
  '두 사람 궁합의 두 일간은 person_a · person_b 의 차례다');

-- ── 3. 인연 궁합 — 앞자리가 보는 사람 ─────────────────────────────────────

select is(
  (select array[day_master_a, day_master_b] from public.my_readings() where kind = 'match'),
  array['甲', '庚'],
  '김이 보면 인연 궁합은 김 · 이의 차례다');

select pg_temp.acting((select lee from folks));
select is(
  (select array[day_master_a, day_master_b] from public.my_readings() where kind = 'match'),
  array['庚', '甲'],
  '이가 보면 같은 줄이 이 · 김의 차례다');

-- ── 4. 동의 뒤에 고친 입력은 안 샌다 ───────────────────────────────────────

select is(
  public.edit_person_input((select lee_person from people),
    'solar', '1990-05-16', '1990-05-16', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart('癸'), 'chart-for-tests'),
  2,
  '이가 제 출생 정보를 고친다');

select pg_temp.acting((select kim from folks));
select is(
  (select day_master_b from public.my_readings() where kind = 'match'),
  '庚',
  '인연 궁합의 상대 일간은 동의 당시 사본이다 — 뒤에 고친 입력은 안 나간다');

select pg_temp.acting((select kim from folks));
select is(
  public.edit_person_input((select mom from kin),
    'solar', '1962-03-03', '1962-03-03', '07:10', 'female', '부산', 'jo', 'localMean',
    tests.chart('丁'), 'chart-for-tests'),
  2,
  '엄마의 출생 정보를 고친다');

select is(
  (select array[day_master_a, from_current_chart::text] from public.my_readings() where kind = 'person'),
  array['壬', 'false'],
  '고쳐도 표지는 그때의 일간이다 — 「수정 전」 글이 고친 뒤의 색을 입지 않는다');

select is(
  (select array[day_master_a, day_master_b] from public.my_reading('person', (select mom from kin))),
  array['壬', null],
  '글 화면의 표지도 그때의 일간이다 — 책장과 같은 색');

-- ── 칸에는 천간 한 글자뿐이다 ─────────────────────────────────────────────

select is(
  (select count(*)::int from public.my_readings() r, unnest(array[r.day_master_a, r.day_master_b]) d(stem)
   where stem is not null and stem <> all (array['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'])),
  0,
  '일간 칸은 천간 한 글자이거나 비어 있다');

select * from finish();
rollback;
