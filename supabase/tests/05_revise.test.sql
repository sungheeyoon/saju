-- 입력 수정 — **그 자리를 고친다.** 쌓지 않고, 되돌릴 길도 없다(ADR 0071).
begin;
select plan(15);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table target as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
,
  tests.chart(), 'chart-for-tests') as person_id;
grant select on target to authenticated;

create temporary table first_version as
select input_version as n from public.person where id = (select person_id from target);
grant select on first_version to authenticated;

-- ── 아무것도 안 바꾸면 판이 안 오른다 ────────────────────────────────────────
select is(
  public.edit_person_input((select person_id from target),
    'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests'),
  (select n from first_version),
  '같은 값으로 저장하면 판이 안 오르고 지금 판을 돌려준다');

-- ── 고치면 그 자리가 바뀐다 ──────────────────────────────────────────────────
create temporary table second_version as
select public.edit_person_input((select person_id from target),
  'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '부산', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests') as n;
grant select on second_version to authenticated;

select is((select n from second_version), (select n from first_version) + 1,
  '값이 하나라도 다르면 판이 하나 오른다');

/**
 * **옛 값은 안 남는다.** 앞서는 이 자리에서 「옛 판본의 값은 그대로다」를 쟀다 — 지금은
 * 되돌릴 길 자체가 없는 것이 약속이라(ADR 0071), 고친 값이 그 자리에 섰는지를 잰다.
 */
select is(
  (select city from public.person where id = (select person_id from target)),
  '부산',
  '고친 값이 그 자리에 선다 — 옛 값은 어디에도 안 남는다');

-- ── 자시 규칙 하나로도 갈린다 ─────────────────────────────────────────────────
select is(
  public.edit_person_input((select person_id from target),
    'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '부산', 'ya', 'localMean',
  tests.chart(), 'chart-for-tests'),
  (select n from second_version) + 1,
  '자시 규칙 하나만 달라도 판이 오른다 — 그 하나로 일주가 바뀐다');

-- ── 음력 판본 ────────────────────────────────────────────────────────────────
select lives_ok(
  format($$select public.edit_person_input(%L,
    'lunar', '1990-04-21', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
    (select person_id from target)),
  '음력 입력을 받는다 — 변환표를 KASI 자료와 대조했다');

-- 원본과 변환값을 **둘 다** 든다. 원본이 있어야 사용자가 자기 입력을 알아보고,
-- 변환값이 있어야 표가 바뀌었을 때 무엇이 달라졌는지 되짚을 수 있다(ADR 0002).
select is(
  (select p.calendar || ' ' || p.original_date::text || ' ' || p.solar_date::text
   from public.person p
   where p.id = (select person_id from target)),
  'lunar 1990-04-21 1990-05-15',
  '음력 입력은 원본과 변환값을 둘 다 든다');

reset role;

-- ── 남은 못 고친다 — RPC 는 정책을 지나가므로 스스로 물어야 한다 ──────────────
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

select throws_ok(
  format($$select public.edit_person_input(%L,
    'solar', '1980-01-01', '1980-01-01', '01:00', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests')$$,
    (select person_id from target)),
  '42501', null,
  'claim 된 Person 의 출생정보는 남이 못 고친다');

reset role;

/**
 * **`security definer` 는 RLS 를 지나간다.**
 *
 * 정책에만 규칙을 적어 두면 RPC 로 들어오는 길은 아무 검사 없이 열린다. 위 한 건이
 * 그 자리를 지키는 유일한 시험이라, 아래에서 그 규칙 함수를 직접 한 번 더 잰다 —
 * 정책과 RPC 가 같은 답을 보는지가 요점이므로.
 */
select is(public.may_edit_person_input((select person_id from target), (select lee from who)), false,
  '규칙 함수는 남에게 거짓을 낸다');
select is(public.may_edit_person_input((select person_id from target), (select kim from who)), true,
  '규칙 함수는 claim 한 사람에게 참을 낸다');

-- ── 달라진 것을 세는 수로 말한다 (ADR 0071 · #69) ───────────────────────────
--
-- **`input_version` 은 여덟 칸이 실제로 달라질 때만 오른다.** 지문을 안 남기는 까닭은
-- 열쇠 없는 해시가 원문의 다른 표기일 뿐이기 때문이다 — 세는 수는 입력을 안 담는다.

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table version_now as
select input_version as n from public.person where id = (select person_id from target);
grant select on version_now to authenticated;

/** 지금 서 있는 입력은 **음력 판본**이다 — 같은 값을 다시 보내려면 그 달력으로 보낸다 */
select public.edit_person_input((select person_id from target),
  'lunar', '1990-04-21', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');

select is(
  (select input_version from public.person where id = (select person_id from target)),
  (select n from version_now),
  '같은 값으로 저장하면 버전이 안 오른다 — pending 요청도 안 죽는다');

select public.edit_person_input((select person_id from target),
  'lunar', '1990-04-21', '1990-05-15', '16:00', 'male', '서울', 'jo', 'localMean',
  tests.chart(), 'chart-for-tests');

select is(
  (select input_version from public.person where id = (select person_id from target)),
  (select n from version_now) + 1,
  '한 칸이라도 달라지면 버전이 하나 오른다');

/** 입력은 **그 행에 있다** — 판본을 안 읽어도 지금 값을 말할 수 있다 */
select is(
  (select birth_time from public.person where id = (select person_id from target)),
  '16:00'::time,
  '고친 입력이 Person 행에 그대로 앉는다');

reset role;

-- ── 옛 이름은 **두 벌인 동안** 새 문을 부르는 겉이다 (G-43 넓히기) ──────────────
--
-- 앱이 `edit_person_input` 으로 옮기기 전까지 떠 있는 앱은 옛 이름을 부른다. 좁히는
-- 마이그레이션이 옛 이름을 지우는 날 아래 두 줄을 「없다」로 뒤집는다.

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  public.add_person_revision((select person_id from target),
    'lunar', '1990-04-21', '1990-05-15', '17:00', 'male', '서울', 'jo', 'localMean',
    tests.chart(), 'chart-for-tests'),
  (select n from version_now) + 2,
  '옛 이름으로 불러도 같은 문이 고친다 — 판이 하나 더 오른다');

reset role;

select has_function('public', 'add_person_revision',
  '옛 이름은 좁히기 전까지 남는다 — 떠 있는 앱이 부른다');

select hasnt_function('public', 'may_add_revision',
  '옛 관문은 부르는 것이 없어 이미 지웠다');

select * from finish();
rollback;
