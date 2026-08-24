-- 온보딩 — Person·판본·엣지·claim 이 한 사건으로 일어난다.
begin;
select plan(10);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
-- 역할을 바꾼 뒤에도 읽어야 한다 — 임시 표는 만든 역할만 볼 수 있다.
grant select on who to authenticated;

/**
 * **우리가 만든 두 사람만 센다.**
 *
 * 전역 개수를 세면 이 DB 에 다른 행이 하나라도 있는 순간 무너진다 — 시험이 잰 것이
 * 「트리거가 도는가」가 아니라 「DB 가 비어 있는가」가 돼 버린다. 실제로 흐름 검사
 * (`npm run test:flow`)를 한 번 돌린 뒤에 이 시험이 깨져서 알았다.
 */
select is(
  (select count(*)::int from public.app_user where id in (select kim from who union all select lee from who)),
  2,
  '가입하면 계정 행이 따라 생긴다 — 앱이 만들지 않는다');

select is((select self_person_id from public.app_user where id = (select kim from who)), null,
  '온보딩 전에는 selfPerson 이 비어 있다');

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table target as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;

select isnt((select self_person_id from public.app_user where id = (select kim from who)), null,
  'selfPerson 이 지정된다');

select is((select role from public.user_person_access where user_id = (select kim from who)), 'owner',
  '만든 사람은 owner 로 들어간다');

select is((select local_label from public.user_person_access where user_id = (select kim from who)), '민수',
  '부를 이름은 Person 이 아니라 엣지가 든다');

select isnt((select current_revision_id from public.person where id = (select person_id from target)), null,
  'Person 이 현재 판본을 가리킨다');

select is(
  (select count(*)::int from public.person_chart_revision
   where person_id = (select self_person_id from public.app_user where id = (select kim from who))),
  1,
  '판본이 정확히 하나 쌓인다');

select throws_ok(
  $$select public.create_self_person('민수2','solar','1991-01-01','1991-01-01','09:00','male','서울','jo','localMean')$$,
  '23505', null,
  '두 번째 selfPerson 은 조용히 덮어쓰지 않고 거절한다');

reset role;

-- 여기부터는 아직 등록하지 않은 사람이다. 음력 관문은 계정 상태와 무관하게
-- 재야 하므로 등록을 마친 사람으로 재면 앞의 관문에 먼저 걸린다.
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

-- 음력 자체는 이제 받는다(`20260824210000_accept_lunar_input.sql`). 변환은 앱이
-- 하므로 DB 가 잡을 수 있는 것은 **변환을 아예 건너뛴 쓰기**다 — 원본을 두 칸에
-- 그대로 넣으면 음력 날짜가 양력인 척 판본으로 굳는다.
select throws_ok(
  $$select public.create_self_person('지영','lunar','1992-02-28','1992-02-28','09:00','female','부산','jo','localMean')$$,
  '23514', null,
  '음력인데 변환값이 원본과 같으면 거절한다 — 변환을 건너뛴 쓰기다');

-- 시각 미상은 정오로 메우지 않는다 — 빈 칸으로 남는다.
select public.create_self_person(
  '지영', 'solar', '1992-03-02', '1992-03-02', null, 'female', '부산', 'ya', 'record');
select is((select birth_time from public.person_chart_revision r
           join public.app_user u on u.self_person_id = r.person_id
           where u.id = (select lee from who)), null,
  '시각을 모르면 빈 칸으로 남는다');
reset role;

select * from finish();
rollback;
