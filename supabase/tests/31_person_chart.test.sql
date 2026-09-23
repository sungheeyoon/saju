-- Person 이 드는 여덟 글자 — 모양·문 앞의 거절·조건부 운영 문 (ADR 0071)
begin;
select plan(25);

/** 모양만 맞으면 된다 — 이 값이 실제 그 입력의 답인지는 DB 가 못 본다(ADR 0071) */
create temporary table sample as
select '{"year":{"stem":"甲","branch":"子"},"month":{"stem":"乙","branch":"丑"},
         "day":{"stem":"丙","branch":"寅"},"hour":{"stem":"丁","branch":"卯"},
         "dayMaster":"丙"}'::jsonb as ok,
       '{"year":{"stem":"甲","branch":"子"},"month":{"stem":"乙","branch":"丑"},
         "day":{"stem":"丙","branch":"寅"},"hour":null,"dayMaster":"丙"}'::jsonb as hourless;
grant select on sample to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 모양을 보는 눈
-- ---------------------------------------------------------------------------

select ok(public.is_chart_snapshot((select ok from sample)), '여덟 글자 한 벌은 지나간다');
select ok(public.is_chart_snapshot((select hourless from sample)),
  '시간 미상은 시주가 null 인 채로 지나간다');

select ok(not public.is_chart_snapshot(
  '{"year":{"stem":"X","branch":"子"},"month":{"stem":"乙","branch":"丑"},
    "day":{"stem":"丙","branch":"寅"},"hour":null,"dayMaster":"丙"}'::jsonb),
  '천간이 아닌 글자는 막는다');

select ok(not public.is_chart_snapshot(
  '{"year":{"stem":"甲","branch":"甲"},"month":{"stem":"乙","branch":"丑"},
    "day":{"stem":"丙","branch":"寅"},"hour":null,"dayMaster":"丙"}'::jsonb),
  '지지 자리에 천간이 오면 막는다');

/** 앱이 일간과 일주를 따로 짓다 어긋나는 갈래 — DB 가 볼 수 있는 몇 안 되는 것 */
select ok(not public.is_chart_snapshot(
  '{"year":{"stem":"甲","branch":"子"},"month":{"stem":"乙","branch":"丑"},
    "day":{"stem":"丙","branch":"寅"},"hour":null,"dayMaster":"甲"}'::jsonb),
  '일간이 일주의 천간과 다르면 막는다');

/** `meta` 가 딸려 오면 출생 원문이 새는 길이 된다 */
select ok(not public.is_chart_snapshot(
  '{"year":{"stem":"甲","branch":"子"},"month":{"stem":"乙","branch":"丑"},
    "day":{"stem":"丙","branch":"寅"},"hour":null,"dayMaster":"丙",
    "meta":{"civilTime":"1990-05-15T14:30"}}'::jsonb),
  '칸이 더 붙으면 막는다');

select ok(not public.is_chart_pillar('{"stem":"甲","branch":"子","name":"甲子"}'::jsonb),
  '기둥에 파생값이 붙으면 막는다');

-- ---------------------------------------------------------------------------
-- 표 검사식
-- ---------------------------------------------------------------------------

create temporary table who as select tests.signup('kim@example.com') as kim;
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select lives_ok(
  $$select public.create_self_person('민수','solar','1990-05-15','1990-05-15','14:30',
      'male','서울','jo','localMean',
      (select ok from sample), 'engine-v1')$$,
  '새 서명은 여덟 글자를 함께 받는다');

select is(
  (select chart_engine_version from public.person
   where id = (select self_person_id from public.app_user where id = (select kim from who))),
  'engine-v1',
  '등록이 스냅샷과 판을 같은 트랜잭션에 쓴다');

select is(
  (select current_chart from public.person
   where id = (select self_person_id from public.app_user where id = (select kim from who))),
  (select ok from sample),
  '쓴 값이 넘긴 값 그대로다');

-- ---------------------------------------------------------------------------
-- 문 앞의 거절 — `not null` 보다 **앞에서** 말한다
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.create_managed_person('어머니',null,'solar','1965-03-02','1965-03-02','09:00',
      'female','서울','jo','localMean', null, 'engine-v1')$$,
  '22004', '여덟 글자를 함께 보내야 합니다.',
  '여덟 글자 없이 새 문으로 들어오면 막는다');

select throws_ok(
  $$select public.create_managed_person('어머니',null,'solar','1965-03-02','1965-03-02','09:00',
      'female','서울','jo','localMean', (select ok from sample), '  ')$$,
  '22004', '여덟 글자를 낸 엔진 판을 함께 보내야 합니다.',
  '판이 비어 있으면 막는다');

select throws_ok(
  $$select public.create_managed_person('어머니',null,'solar','1965-03-02','1965-03-02','09:00',
      'female','서울','jo','localMean', (select hourless from sample), 'engine-v1')$$,
  '22023', '시각을 아는지와 시주의 유무가 어긋납니다.',
  '시각을 아는데 시주가 없으면 막는다');

select throws_ok(
  $$select public.create_managed_person('어머니',null,'solar','1965-03-02','1965-03-02',null,
      'female','서울','jo','localMean', (select ok from sample), 'engine-v1')$$,
  '22023', '시각을 아는지와 시주의 유무가 어긋납니다.',
  '시각을 모르는데 시주가 서면 막는다');

-- ---------------------------------------------------------------------------
-- 옛 서명은 **여기서 사라진다** (#70)
--
-- A1 은 옛 서명과 새 서명을 나란히 세워 배포 창을 막았다. 앱이 다 옮겨 왔으므로 좁힌다 —
-- 여덟 글자를 안 싣던 문이 하나라도 남으면 스냅샷이 빈 Person 이 다시 태어난다.
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_self_person', 'create_managed_person', 'edit_person_input')
     and pg_get_function_arguments(p.oid) not like '%jsonb%'),
  0,
  '여덟 글자를 안 싣던 옛 서명이 하나도 안 남았다');

/** 그래서 빈 채로 태어나는 길이 없다 — 스키마가 그것을 든다 */
select col_not_null('public', 'person', 'current_chart',
  '여덟 글자가 빈 Person 은 실재할 수 없다');

select col_not_null('public', 'person', 'chart_engine_version',
  '판 없는 스냅샷도 실재할 수 없다 — 낡았는지 물을 수 없으므로');

-- ---------------------------------------------------------------------------
-- 판만 다르면 **입력 판이 안 오른다**
--
-- 사용자가 입력을 바꾼 것이 아니므로 `input_version` 도 안 오르고 pending 요청도 안
-- 죽는다. 엔진을 고친 일로 남의 요청이 무효가 되면, 사용자가 한 적 없는 일로 벌을 준다.
-- ---------------------------------------------------------------------------

create temporary table mine as
select self_person_id as person_id,
       (select p.input_version from public.person p where p.id = u.self_person_id) as version
from public.app_user u where u.id = (select kim from who);
-- 역할을 service_role 로 바꾼 뒤에도 읽는다 — 임시 표는 만든 역할만 본다
grant select on mine to authenticated, service_role;

select is(
  public.edit_person_input((select person_id from mine),
    'solar','1990-05-15','1990-05-15','14:30','male','서울','jo','localMean',
    (select ok from sample), 'engine-v2'),
  (select version from mine),
  '같은 입력에 판만 바뀌면 고치는 문이 같은 입력 판을 낸다');

select is(
  (select input_version from public.person where id = (select person_id from mine)),
  (select version from mine),
  '입력 판이 안 올랐다');

select is(
  (select chart_engine_version from public.person where id = (select person_id from mine)),
  'engine-v2',
  '스냅샷의 판만 갱신됐다');

-- ---------------------------------------------------------------------------
-- 운영 문 — 조건이 안 맞으면 안 쓰고 그렇게 답한다
-- ---------------------------------------------------------------------------

/**
 * **읽었던 입력 판은 역할을 바꾸기 전에 떠 둔다.**
 *
 * 열쇠에게는 표를 안 연다 — `service_role` 로 `public.person` 을 읽으면 거절당한다.
 * 실제 백필 스크립트도 같은 처지라 입력을 읽는 일과 쓰는 일이 갈려 있고, 그 갈림이
 * 곧 이 문이 **읽었던 것**을 인자로 받는 까닭이다. 판본을 지운 뒤로 그 값은
 * `input_version` 이다(ADR 0071).
 */
reset role;
create temporary table now_version as
select input_version as v from public.person where id = (select person_id from mine);
grant select on now_version to authenticated, service_role;

set local role service_role;

select is(
  public.set_person_chart((select person_id from mine),
    (select v + 1 from now_version),
    (select ok from sample), 'engine-v3'),
  false,
  '읽었던 입력 판이 지금 것과 다르면 안 쓴다');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  (select chart_engine_version from public.person where id = (select person_id from mine)),
  'engine-v2',
  '못 쓴 자리는 옛 값 그대로다 — 새 입력 위에 옛 여덟 글자가 안 얹힌다');

reset role;
set local role service_role;

select is(
  public.set_person_chart((select person_id from mine), (select v from now_version),
    (select ok from sample), 'engine-v3'),
  true,
  '입력 판이 맞으면 쓰고 썼다고 답한다');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  (select chart_engine_version from public.person where id = (select person_id from mine)),
  'engine-v3',
  '조건이 맞으면 새 판이 앉는다');

select throws_ok(
  $$select public.set_person_chart('00000000-0000-0000-0000-000000000000'::uuid,
      1, '{}'::jsonb, 'x')$$,
  '42501',
  null,
  '운영 문은 로그인한 사람에게 안 열린다');

select * from finish();
rollback;
