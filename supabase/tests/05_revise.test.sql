-- 판본 수정 — 쌓이고, 현재가 옮겨가고, 옛것은 그대로 남는다.
begin;
select plan(11);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table target as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;
grant select on target to authenticated;

create temporary table first_revision as
select current_revision_id as id from public.person where id = (select person_id from target);
grant select on first_revision to authenticated;

-- ── 아무것도 안 바꾸면 쌓지 않는다 ──────────────────────────────────────────────
select is(
  public.add_person_revision((select person_id from target),
    'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'),
  (select id from first_revision),
  '같은 값으로 저장하면 판본을 쌓지 않고 지금 것을 돌려준다');

select is(
  (select count(*)::int from public.person_chart_revision
   where person_id = (select person_id from target)),
  1,
  '판본 이력은 저장 버튼을 몇 번 눌렀는지의 기록이 아니다');

-- ── 고치면 쌓인다 ─────────────────────────────────────────────────────────────
create temporary table second_revision as
select public.add_person_revision((select person_id from target),
  'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '부산', 'jo', 'localMean') as id;
grant select on second_revision to authenticated;

select isnt((select id from second_revision), (select id from first_revision),
  '값이 하나라도 다르면 새 판본이다');

select is(
  (select current_revision_id from public.person where id = (select person_id from target)),
  (select id from second_revision),
  '현재 판본이 새것으로 옮겨간다');

select is(
  (select count(*)::int from public.person_chart_revision
   where person_id = (select person_id from target)),
  2,
  '옛 판본은 지워지지 않고 남는다');

select is(
  (select city from public.person_chart_revision where id = (select id from first_revision)),
  '서울',
  '옛 판본의 값은 그대로다 — 덮어쓰지 않는다');

-- ── 자시 규칙 하나로도 갈린다 ─────────────────────────────────────────────────
select isnt(
  public.add_person_revision((select person_id from target),
    'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '부산', 'ya', 'localMean'),
  (select id from second_revision),
  '자시 규칙 하나만 달라도 새 판본이다 — 그 하나로 일주가 바뀐다');

select throws_ok(
  format($$select public.add_person_revision(%L,
    'lunar', '1990-04-21', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean')$$,
    (select person_id from target)),
  '0A000', null,
  '음력은 변환표를 대조하기 전에는 받지 않는다');

reset role;

-- ── 남은 못 고친다 — RPC 는 정책을 지나가므로 스스로 물어야 한다 ──────────────
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

select throws_ok(
  format($$select public.add_person_revision(%L,
    'solar', '1980-01-01', '1980-01-01', '01:00', 'male', '서울', 'jo', 'localMean')$$,
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
select is(public.may_add_revision((select person_id from target), (select lee from who)), false,
  '규칙 함수는 남에게 거짓을 낸다');
select is(public.may_add_revision((select person_id from target), (select kim from who)), true,
  '규칙 함수는 claim 한 사람에게 참을 낸다');

select * from finish();
rollback;
