-- 가족·친구 Person — 만들어지고, 스무 명에서 막히고, 남에게는 없는 것과 같다.
begin;
select plan(27);

create temporary table who as
select tests.signup('kim@example.com') as kim, tests.signup('lee@example.com') as lee;
grant select on who to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

create temporary table me as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;
grant select on me to authenticated;

-- ── 만들어진다 ────────────────────────────────────────────────────────────────
create temporary table mom as
select public.create_managed_person(
  '엄마', '음력 생일만 아신다', 'lunar', '1962-03-11', '1962-04-15',
  '07:20', 'female', '부산', 'jo', 'localMean'
) as person_id;
grant select on mom to authenticated;

select isnt((select person_id from mom), null, '관리 Person 이 만들어진다');

select is(
  (select count(*)::int from public.person
   where id = (select person_id from mom) and current_revision_id is not null),
  1,
  '만들어진 Person 은 현재 판본을 가리킨다');

select is(
  (select a.local_label || '/' || a.note || '/' || a.role
   from public.user_person_access a where a.person_id = (select person_id from mom)),
  '엄마/음력 생일만 아신다/owner',
  '부를 이름·메모·역할은 엣지가 든다');

/**
 * **무슨 사이인가는 사람에 안 붙는다.**
 *
 * 한 번 붙였다가 걷었다. 사람에 붙이면 「나와 그 사람」만 알게 되는데, 어머니와
 * 친구의 궁합에서는 그 값으로 답할 수 없다 — 어머니가 나의 가족인 것과 어머니가 그
 * 친구와 무슨 사이인지는 다른 물음이다. 묻는 자리도 사람 탭이 아니라 궁합 화면이다.
 */
select hasnt_column('public', 'person', 'relation', '관계는 Person 에 안 붙는다');
select hasnt_column('public', 'user_person_access', 'relation', '관계는 엣지에도 안 붙는다');

-- 판본은 원본과 변환값을 둘 다 든다(ADR 0002). 음력으로 등록해도 마찬가지다.
select is(
  (select r.calendar || ' ' || r.original_date::text || ' ' || r.solar_date::text
   from public.person p join public.person_chart_revision r on r.id = p.current_revision_id
   where p.id = (select person_id from mom)),
  'lunar 1962-03-11 1962-04-15',
  '음력으로 등록해도 원본과 변환값을 둘 다 든다');

/**
 * **claim 은 옮기지 않는다.**
 *
 * `create_self_person` 과 이 함수의 차이가 여기다. 대신 등록한 사람이 「나」가
 * 되어 버리면 온보딩이 끝난 계정에서 selfPerson 이 조용히 갈린다.
 */
select is(
  (select self_person_id from public.app_user where id = (select kim from who)),
  (select person_id from me),
  '가족을 등록해도 selfPerson 은 그대로다');

-- ── 메모는 있거나 없다 ────────────────────────────────────────────────────────
create temporary table dad as
select public.create_managed_person(
  '아빠', '   ', 'solar', '1960-01-20', '1960-01-20',
  null, 'male', '서울', 'jo', 'localMean'
) as person_id;
grant select on dad to authenticated;

select is(
  (select note from public.user_person_access where person_id = (select person_id from dad)),
  null,
  '공백뿐인 메모는 없음으로 들어간다 — 없음은 한 값이다');

-- ── 사이는 쌍에 붙는다 ───────────────────────────────────────────────────────

/**
 * **차례를 값이 정한다.** 안 정하면 (엄마,아빠)와 (아빠,엄마)가 다른 줄이 되고,
 * 그때 한 쌍에 답이 둘 남는다. 부르는 쪽이 기억하지 않게 문이 그것을 든다.
 */
select public.set_pair_relation(
  (select person_id from dad), (select person_id from mom), 'family');

select is(
  (select relation from public.pair_relation
   where person_low = least((select person_id from mom), (select person_id from dad))
     and person_high = greatest((select person_id from mom), (select person_id from dad))),
  'family',
  '쌍에 적어 둔 사이가 남는다');

select is(
  (select count(*)::int from public.pair_relation),
  1,
  '차례를 뒤집어 불러도 줄은 하나다');

select is(
  public.pair_relation_of((select person_id from mom), (select person_id from dad)),
  'family',
  '어느 차례로 물어도 같은 답이 나온다');

/**
 * **모른다는 행이 없는 것이다.** `null` 을 담는 줄을 두면 안 고른 것과 「모른다를
 * 골랐다」가 다른 값이 되고, 화면도 프롬프트도 두 가지를 물어야 한다.
 */
select public.set_pair_relation(
  (select person_id from mom), (select person_id from dad), null);

select is(
  (select count(*)::int from public.pair_relation),
  0,
  '되돌리면 줄이 사라진다 — 모른다는 없는 것이다');

select is(
  public.pair_relation_of((select person_id from mom), (select person_id from dad)),
  null,
  '적어 둔 것이 없으면 모른다');

select throws_ok(
  format($$select public.set_pair_relation(%L::uuid, %L::uuid, 'coworker')$$,
    (select person_id from mom), (select person_id from dad)),
  '23514', null,
  '모르는 갈래는 들어가지 않는다');

select throws_ok(
  format($$select public.set_pair_relation(%L::uuid, %L::uuid, 'family')$$,
    (select person_id from mom), (select person_id from mom)),
  '22023', null,
  '같은 사람 둘로는 사이를 적을 수 없다');

select throws_ok(
  $$select public.create_managed_person(
      '친구', repeat('가', 201), 'solar', '1991-02-03', '1991-02-03',
      '09:00', 'female', '서울', 'jo', 'localMean')$$,
  '23514', null,
  '메모에도 상한이 있다');

-- ── 관리 Person 의 출생정보는 내가 고친다 — 아직 아무도 claim 하지 않았다 ─────
select is(
  public.may_add_revision((select person_id from mom), (select kim from who)), true,
  'claim 되지 않은 관리 Person 은 등록한 사람이 고친다');

select is(
  public.may_add_revision((select person_id from mom), (select lee from who)), false,
  '엣지가 없는 사람에게는 거짓이다');

-- ── 라벨과 메모만 고칠 수 있다 ────────────────────────────────────────────────
update public.user_person_access
set local_label = '어머니', note = null
where person_id = (select person_id from mom);

select is(
  (select local_label || '/' || coalesce(note, '(없음)')
   from public.user_person_access where person_id = (select person_id from mom)),
  '어머니/(없음)',
  '부를 이름과 메모는 고칠 수 있다');

select throws_ok(
  format($$update public.user_person_access set role = 'editor' where person_id = %L$$,
    (select person_id from mom)),
  '42501', null,
  '역할은 스스로 못 올린다 — 열어 준 칸이 둘뿐이다');

-- ── 목록에서 뺀다 ─────────────────────────────────────────────────────────────
with removed as (
  delete from public.user_person_access
  where person_id = (select person_id from mom) returning 1
)
select is((select count(*)::int from removed), 1, '관리 Person 은 목록에서 뺄 수 있다');

select is(
  (select count(*)::int from public.person where id = (select person_id from mom)),
  0,
  '목록에서 빠지면 그 Person 은 더 이상 보이지 않는다');

-- ── 스무 명에서 막힌다 ────────────────────────────────────────────────────────
--
-- 지금 관리 Person 은 아빠 하나다(엄마는 뺐다). 열아홉을 더 만들면 스물이다.
do $$
begin
  for i in 2..20 loop
    perform public.create_managed_person(
      '가족' || i, null, 'solar', '1990-05-15', '1990-05-15',
      '14:30', 'female', '서울', 'jo', 'localMean');
  end loop;
end;
$$;

/**
 * 한도 트리거는 `deferrable initially deferred` 라 커밋에 선다.
 *
 * 이 시험은 `rollback` 으로 끝나므로 그대로 두면 **한 번도 안 선다** — 스물한
 * 번째가 통과한 것처럼 보인 채로 끝난다. 여기서 즉시로 바꿔 그 자리를 앞당긴다.
 */
set constraints all immediate;

select is(
  (select count(*)::int from public.user_person_access a
   join public.app_user u on u.id = a.user_id
   where a.person_id is distinct from u.self_person_id),
  20,
  '스무 명까지는 들어간다');

select throws_ok(
  $$select public.create_managed_person(
      '스물하나', null, 'solar', '1990-05-15', '1990-05-15',
      '14:30', 'female', '서울', 'jo', 'localMean')$$,
  '23514', '등록할 수 있는 사람은 20명까지입니다.',
  '스물한 번째는 거절된다');

reset role;

-- ── 남에게는 없는 것과 같다 ───────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

select is(
  (select count(*)::int from public.person), 0,
  '남이 등록한 가족은 한 줄도 안 보인다');

/**
 * **남의 두 사람에 사이를 적을 수 없다.**
 *
 * 정책이 두 Person 이 정말 내가 볼 수 있는 사람인지 묻는다. 안 물으면 아무 uuid
 * 쌍에나 줄을 남길 수 있고, 그 줄은 **남의 Person id 를 내 표에 적어 두는 일**이 된다.
 */
select throws_ok(
  format($$select public.set_pair_relation(%L::uuid, %L::uuid, 'family')$$,
    (select person_id from mom), (select person_id from dad)),
  '42501', null,
  '남의 두 사람에는 사이를 못 적는다');

select is(
  (select count(*)::int from public.pair_relation), 0,
  '남이 적어 둔 사이도 한 줄도 안 보인다');

reset role;
select * from finish();
rollback;
