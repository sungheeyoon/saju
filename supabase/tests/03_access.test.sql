-- 접근 판정 — 「막는다」를 잰다. 통과만 재면 한 번도 안 막혀도 다 통과한다.
begin;
select plan(8);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
-- 역할을 바꾼 뒤에도 읽어야 한다 — 임시 표는 만든 역할만 볼 수 있다.
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);
create temporary table target as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
,
  tests.chart(), 'chart-for-tests') as person_id;

select is((select count(*)::int from public.person), 1, '내 Person 은 보인다');
/** 출생 입력은 그 행에 있다 — 따로 볼 표가 없다(ADR 0071 · #70) */
select is(
  (select count(*)::int from public.person where calendar is not null), 1,
  '내 Person 은 자기 입력을 들고 보인다');

-- 계정 상태와 claim 은 사용자가 못 옮긴다. 온보딩은 RPC 한 곳으로만 들어온다.
select throws_ok(
  $$update public.app_user set status = 'active'$$, '42501', null,
  '계정 상태는 사용자가 못 건드린다');
select throws_ok(
  $$update public.app_user set self_person_id = null$$, '42501', null,
  'claim 을 사용자가 직접 못 옮긴다');

-- 자기 자신은 목록에서 지울 수 없다. 정책이 걸러 0행이 지워진다.
with removed as (
  delete from public.user_person_access
  where person_id = (select person_id from target) returning 1
)
select is((select count(*)::int from removed), 0, '자기 자신은 목록에서 못 지운다');

reset role;

-- 여기부터는 남이다.
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

select is((select count(*)::int from public.person), 0, '남의 Person 은 한 줄도 안 보인다');
select is((select count(*)::int from public.user_person_access), 0, '남의 목록도 안 보인다');

/**
 * **남의 입력은 못 고친다.** 앞서는 판본 표에 직접 넣어 보는 것으로 쟀는데, 이제 입력이
 * `person` 의 칸이라 그 자리를 RLS 가 막는다 — 쓰는 길은 문 하나뿐이다.
 */
select throws_ok(
  format($$update public.person set city = '부산' where id = %L$$,
    (select person_id from target)),
  '42501', null,
  'claim 된 Person 의 출생정보는 남이 직접 못 고친다');

reset role;
select * from finish();
rollback;
