-- 걸린 검사를 시도마다 적고 날짜별 수로 본다 (`20261130090000`, ADR 0163)
--
-- 여기서 재는 것.
--
--   1. **문 둘은 열쇠에만, 표와 뷰는 아무에게도** — 익명 · 로그인한 사람은 문을 못 부르고, 열쇠도 표 · 뷰를 직접 못 읽는다
--   2. **기록은 짧은 설명만 받는다** — 배열 · 키 둘(`code` · `detail`) · 코드 꼴 · 설명 200자 · 서른둘 이하 · 분모 이름(`checked`) 금지
--   3. **닫힌 시도에 한 번만** — 도는 시도는 안 적고, 두 번째부터는 아무것도 안 는다
--   4. **내보냄 · 막음은 시도의 상태가 가른다** — 저장한 시도는 `shipped`, 실패로 닫은 시도는 `blocked`. 같은 코드는 한 시도에 하나
--   5. **맛보기도 같은 수에 든다** — 지금 시도 번호에만, 그 시도에 한 번
--   6. **뷰가 한 줄로 낸다** — 분모(`checked`)와 몫(`share`)
--   7. **맛보기의 근거 경로는 빈 목록도 받는다** — 앱이 꼴 · 개수로 걸러 보낸다. `null` · 일곱은 그대로 거절
--
-- 날짜별 수는 전역 줄이라 오늘 줄을 트랜잭션 안에서 지우고 잰다(롤백이 되돌린다).
begin;
select plan(35);

create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 오늘 그 종류 · 코드의 수 — `shipped` · `blocked` */
create function pg_temp.count_of(p_kind text, p_code text)
returns bigint[] language sql as $$
  select coalesce(
    (select array[c.shipped, c.blocked] from public.check_finding_daily_count c
     where c.day = (now() at time zone 'Asia/Seoul')::date and c.kind = p_kind and c.code = p_code),
    array[0, 0]::bigint[])
$$;

create function pg_temp.h(tag text)
returns text language sql immutable as $$ select encode(sha256(convert_to('check-test:' || tag, 'UTF8')), 'hex') $$;

delete from public.check_finding_daily_count where day = (now() at time zone 'Asia/Seoul')::date;

-- ── 1. 문은 열쇠에만, 표와 뷰는 아무에게도 ─────────────────────────────────

select ok(
  has_function_privilege('service_role', 'public.note_reading_checks(uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.note_taste_checks(uuid, integer, jsonb)', 'execute'),
  '열쇠는 문 둘을 부른다');

select ok(
  not has_function_privilege('anon', 'public.note_reading_checks(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.note_reading_checks(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.note_taste_checks(uuid, integer, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.note_taste_checks(uuid, integer, jsonb)', 'execute'),
  '익명 · 로그인한 사람은 문 둘을 못 부른다 — 기록을 지어 넣을 수 없다');

select ok(
  not has_function_privilege('service_role', 'public.tally_check_findings(text, jsonb, boolean)', 'execute')
  and not has_function_privilege('service_role', 'public.check_findings_valid(jsonb)', 'execute'),
  '안쪽 손잡이 둘은 열쇠도 못 부른다');

set local role authenticated;
select throws_ok($$select * from public.check_finding_daily_count$$, '42501', null, '로그인한 사람은 날짜별 수를 못 읽는다');
select throws_ok($$select * from public.reading_check_daily$$, '42501', null, '로그인한 사람은 운영자 뷰를 못 읽는다');
reset role;

set local role service_role;
select throws_ok($$select * from public.check_finding_daily_count$$, '42501', null, '열쇠도 날짜별 수를 직접 못 읽는다');
select throws_ok($$select * from public.reading_check_daily$$, '42501', null, '열쇠도 운영자 뷰를 못 읽는다 — 앱은 안 읽는다');
reset role;

select ok(
  not has_table_privilege('service_role', 'public.reading_run', 'update')
  and not has_table_privilege('service_role', 'public.taste_artifact', 'update')
  and not has_table_privilege('authenticated', 'public.reading_run', 'update'),
  '기록 칸을 직접 쓸 표 권한은 아무에게도 없다 — 모양 검사 함수의 실행 권한을 안 열어도 걸리는 역할이 없다(마이그레이션 머리말의 함정)');

select is(
  (select array_agg(a.attname::text order by a.attnum)
   from pg_attribute a
   where a.attrelid = 'public.check_finding_daily_count'::regclass and a.attnum > 0 and not a.attisdropped),
  array['day', 'kind', 'code', 'shipped', 'blocked'],
  '날짜별 수에는 날짜 · 종류 · 코드 · 수 둘뿐이다 — 개인을 가리키는 칸이 없다');

-- ── 시도 셋 — 도는 것 · 저장할 것 · 실패로 닫을 것 ────────────────────────

set local role authenticated;
create temporary table folks as select tests.signup('check-kim@example.com') as kim;
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
  (select run_id from public.start_reading_run('self', 'check-self-0001')) as shipped,
  (select run_id from public.start_reading_run('person', 'check-mom-0001', (select mom from kin))) as blocked,
  (select run_id from public.start_reading_run('person', 'check-dad-0001', (select dad from kin))) as running;
grant select on runs to authenticated, anon, service_role;
reset role;

-- ── 2. 기록은 짧은 설명만 받는다 ────────────────────────────────────────────

select throws_ok(
  format($$select public.note_reading_checks(%L, '{"code":"x","detail":"y"}')$$, (select shipped from runs)),
  '22023', null, '배열이 아니면 던진다');
select throws_ok(
  format($$select public.note_reading_checks(%L, '[{"code":"x","detail":"y","markdown":"원문"}]')$$, (select shipped from runs)),
  '22023', null, '키가 둘이 아니면 던진다 — 원문을 실을 칸이 없다');
select throws_ok(
  format($$select public.note_reading_checks(%L, %L)$$, (select shipped from runs),
    jsonb_build_array(jsonb_build_object('code', 'length-out-of-contract', 'detail', repeat('가', 201)))),
  '22023', null, '설명이 200자를 넘으면 던진다');
select throws_ok(
  format($$select public.note_reading_checks(%L, '[{"code":"Length Out","detail":"y"}]')$$, (select shipped from runs)),
  '22023', null, '코드 꼴이 아니면 던진다');
select throws_ok(
  format($$select public.note_reading_checks(%L, '[{"code":"checked","detail":"y"}]')$$, (select shipped from runs)),
  '22023', null, '분모 이름(`checked`)은 코드로 못 쓴다');
select throws_ok(
  format($$select public.note_reading_checks(%L, %L)$$, (select shipped from runs),
    (select jsonb_agg(jsonb_build_object('code', 'markup', 'detail', 'y')) from generate_series(1, 33))),
  '22023', null, '서른셋 이상이면 던진다');
select throws_ok(
  $$select public.note_reading_checks(gen_random_uuid(), '[]')$$,
  'P0002', null, '없는 시도는 던진다');

-- ── 3 · 4. 닫힌 시도에 한 번, 내보냄 · 막음은 상태가 가른다 ─────────────────

select is(
  public.note_reading_checks((select running from runs), '[{"code":"markup","detail":"y"}]'),
  false, '도는 시도는 안 적는다');
select is(pg_temp.count_of('person', 'checked'), array[0, 0]::bigint[], '도는 시도는 수에 안 든다');

select public.save_reading(
  (select shipped from runs), '## 풀이', null, null,
  '{"charts":{}}', '# 역할', 'reading-prompt-v16', 'openai/gpt-5.6-luna', '{}'::jsonb, now());

select is(
  public.note_reading_checks((select shipped from runs),
    '[{"code":"length-out-of-contract","detail":"너무 짧다(5자)"},{"code":"length-out-of-contract","detail":"또"},{"code":"evidence-path-stripped","detail":"괄호째 걷음: charts"}]'),
  true, '저장한 시도를 적는다');
select is(
  (select r.check_findings -> 0 ->> 'detail' from public.reading_run r where r.id = (select shipped from runs)),
  '너무 짧다(5자)', '시도에 기록이 그대로 앉는다');
select is(
  array[pg_temp.count_of('self', 'checked'), pg_temp.count_of('self', 'length-out-of-contract'), pg_temp.count_of('self', 'evidence-path-stripped')],
  array[array[1, 0], array[1, 0], array[1, 0]]::bigint[],
  '저장한 시도는 내보냄으로 센다 — 분모 하나, 코드마다 하나(같은 코드 둘은 하나)');

select is(
  public.note_reading_checks((select shipped from runs), '[{"code":"markup","detail":"y"}]'),
  false, '같은 시도를 두 번 적지 않는다');
select is(
  array[pg_temp.count_of('self', 'checked'), pg_temp.count_of('self', 'markup')],
  array[array[1, 0], array[0, 0]]::bigint[],
  '두 번째 부름은 아무것도 안 늘린다');

select public.fail_reading_job((select blocked from runs), 'birth-input-leaked', '1건 · 너무 짧다');
select is(
  public.note_reading_checks((select blocked from runs),
    '[{"code":"birth-input-leaked","detail":"1건"},{"code":"length-out-of-contract","detail":"너무 짧다(5자)"}]'),
  true, '실패로 닫은 시도도 적는다');
select is(
  array[pg_temp.count_of('person', 'checked'), pg_temp.count_of('person', 'birth-input-leaked'), pg_temp.count_of('person', 'length-out-of-contract')],
  array[array[0, 1], array[0, 1], array[0, 1]]::bigint[],
  '실패로 닫은 시도는 막음으로 센다');

-- ── 5. 맛보기 ───────────────────────────────────────────────────────────────

create temporary table taste as
select * from public.reserve_taste(pg_temp.h('fp'), 'taste-v1', 'luna-none-v1', pg_temp.h('browser'), pg_temp.h('ip'));

select is(
  public.note_taste_checks((select artifact_id from taste), 1, '[]'),
  false, '도는 맛보기 시도는 안 적는다');

select public.finish_taste((select artifact_id from taste), 1, null,
  '첫 문단이에요.

멈출까요?', '겉과 속의 차이', '겉으로는 빠르다', '왜 그럴까요?', '방향', array['analysis.structure']);

select is(
  public.note_taste_checks((select artifact_id from taste), 2, '[]'),
  false, '지금 시도 번호가 아니면 안 적는다');
select is(
  public.note_taste_checks((select artifact_id from taste), 1, '[{"code":"length-out-of-contract","detail":"너무 짧다(16자)"}]'),
  true, '성공으로 적은 맛보기 시도를 적는다');
select is(
  public.note_taste_checks((select artifact_id from taste), 1, '[]'),
  false, '그 시도를 두 번 적지 않는다');
select is(
  array[pg_temp.count_of('taste', 'checked'), pg_temp.count_of('taste', 'length-out-of-contract')],
  array[array[1, 0], array[1, 0]]::bigint[],
  '맛보기도 같은 수에 내보냄으로 든다');

-- ── 맛보기의 근거 경로는 비어도 성공으로 적힌다(앱이 걸러 보낸다) ──────────

create temporary table bare as
select * from public.reserve_taste(pg_temp.h('fp-bare'), 'taste-v1', 'luna-none-v1', pg_temp.h('browser'), pg_temp.h('ip'));

select throws_ok(
  format($$select public.finish_taste(%L, 1, null, '첫 문단이에요.', '겉과 속의 차이', '빠르다', '왜일까요?', '방향', null)$$,
    (select artifact_id from bare)),
  '22023', null, '근거 경로 칸이 없으면(`null`) 여전히 성공이 아니다');
select throws_ok(
  format($$select public.finish_taste(%L, 1, null, '첫 문단이에요.', '겉과 속의 차이', '빠르다', '왜일까요?', '방향', %L::text[])$$,
    (select artifact_id from bare), array['a', 'b', 'c', 'd', 'e', 'f', 'g']),
  '22023', null, '근거 경로가 일곱이면 여전히 거절한다');
select is(
  public.finish_taste((select artifact_id from bare), 1, null, '첫 문단이에요.', '겉과 속의 차이', '빠르다', '왜일까요?', '방향', array[]::text[]),
  'recorded', '근거 경로가 하나도 안 남아도 성공으로 적힌다');

-- ── 6. 뷰 ───────────────────────────────────────────────────────────────────

select is(
  (select array[v.total::numeric, v.checked::numeric, v.share]
   from public.reading_check_daily v
   where v.day = (now() at time zone 'Asia/Seoul')::date and v.kind = 'self' and v.code = 'length-out-of-contract'),
  array[1, 1, 100.0]::numeric[],
  '뷰가 한 줄로 낸다 — 걸린 수 · 분모 · 몫');
select is(
  (select count(*)::int from public.reading_check_daily v
   where v.day = (now() at time zone 'Asia/Seoul')::date and v.code = 'checked'),
  0, '분모 줄은 뷰에 따로 서지 않는다 — 칸(`checked`)으로 선다');

select * from finish();
rollback;
