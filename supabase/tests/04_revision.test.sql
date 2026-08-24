-- 판본 — 쌓기만 하고, 같은 입력은 같은 지문을 낸다.
begin;
select plan(7);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
-- 역할을 바꾼 뒤에도 읽어야 한다 — 임시 표는 만든 역할만 볼 수 있다.
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);
create temporary table target as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;
reset role;

-- 지문은 호출부가 적지 않는다. 트리거가 든다.
select matches(
  (select fingerprint from public.person_chart_revision where person_id = (select person_id from target)),
  '^[0-9a-f]{64}$',
  '지문이 자동으로 붙는다');

insert into public.person_chart_revision
  (person_id, calendar, original_date, solar_date, birth_time,
   gender, city, late_night_rule, time_basis, created_by)
values
  ((select person_id from target),'solar','1990-05-15','1990-05-15','14:30','male','서울','jo','localMean',(select kim from who)),
  ((select person_id from target),'solar','1990-05-15','1990-05-15','14:30','male','서울','ya','localMean',(select kim from who));

select is(
  (select count(distinct fingerprint)::int from public.person_chart_revision
   where person_id = (select person_id from target) and late_night_rule = 'jo'),
  1,
  '같은 입력은 같은 지문이다');

select is(
  (select count(distinct fingerprint)::int from public.person_chart_revision
   where person_id = (select person_id from target)),
  2,
  '자시 규칙 하나만 달라도 다른 판본이다 — 그 하나로 일주가 바뀐다');

-- 양력으로 넣었으면 원본과 변환값이 같아야 한다.
select throws_ok(
  format($$insert into public.person_chart_revision
             (person_id, calendar, original_date, solar_date, birth_time,
              gender, city, late_night_rule, time_basis, created_by)
           values (%L,'solar','1990-04-21','1990-05-15','14:30','male','서울','jo','localMean',%L)$$,
    (select person_id from target), (select kim from who)),
  '23514', null,
  '양력 입력인데 원본과 변환값이 다르면 거절한다');

-- 사용자에게는 수정·삭제 권한 자체가 없다.
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);
select throws_ok(
  $$update public.person_chart_revision set city = '부산'$$, '42501', null,
  '판본은 고치지 않는다');
select throws_ok(
  $$delete from public.person_chart_revision$$, '42501', null,
  '판본은 지우지 않는다');
reset role;

/**
 * claim 이 편집권을 옮긴다 — 기존 관리자는 viewer 로 내려간다.
 *
 * 아직 아무도 자기 자신이라고 하지 않은 Person 을 kim 이 대신 관리하고 있다가,
 * 본인(lee)이 나타나 claim 하는 상황이다. 이 강등을 앱이 기억하게 두면 잊는 순간
 * 남이 남의 출생정보를 계속 고칠 수 있다.
 */
with fresh as (insert into public.person default values returning id)
select id as person_id into temporary table unclaimed from fresh;

insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select kim from who), (select person_id from unclaimed), '아는 사람', 'editor'),
       ((select lee from who), (select person_id from unclaimed), '나', 'owner');

update public.app_user set self_person_id = (select person_id from unclaimed)
where id = (select lee from who);

select is(
  (select role from public.user_person_access
   where user_id = (select kim from who) and person_id = (select person_id from unclaimed)),
  'viewer',
  'claim 이 일어나면 기존 편집자는 viewer 로 내려간다');

select * from finish();
rollback;
