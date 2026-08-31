-- 가족·친구 Person — 만들어지고, 스무 명에서 막히고, 남에게는 없는 것과 같다.
begin;
select plan(21);

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
  '07:20', 'female', '부산', 'jo', 'localMean', 'family'
) as person_id;
grant select on mom to authenticated;

select isnt((select person_id from mom), null, '관리 Person 이 만들어진다');

select is(
  (select count(*)::int from public.person
   where id = (select person_id from mom) and current_revision_id is not null),
  1,
  '만들어진 Person 은 현재 판본을 가리킨다');

select is(
  (select a.local_label || '/' || a.note || '/' || a.role || '/' || a.relation
   from public.user_person_access a where a.person_id = (select person_id from mom)),
  '엄마/음력 생일만 아신다/owner/family',
  '부를 이름·메모·역할·사이는 엣지가 든다');

/**
 * **사람이 아니라 나와 그 사람 사이에 붙는다.** 같은 사람이 누군가에겐 어머니고
 * 누군가에겐 친구다. `person` 에 붙이면 그 사람이 「가족」이라는 속성을 가진 것이
 * 되는데, 그것은 우리가 아는 사실이 아니다.
 */
select hasnt_column('public', 'person', 'relation', '관계는 Person 에 안 붙는다');

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

/**
 * **안 고른 것은 「모른다」다.** 그럴듯한 기본값을 두면 안 물어본 사람 전부가 그
 * 값으로 적히고, 궁합 풀이가 그것을 사실로 읽는다.
 */
select is(
  (select relation from public.user_person_access where person_id = (select person_id from dad)),
  null,
  '사이를 안 고르면 모른다로 남는다');

select throws_ok(
  $$update public.user_person_access set relation = 'coworker'
    where person_id = (select person_id from dad)$$,
  '23514', null,
  '모르는 갈래는 들어가지 않는다');

/** 잘못 고른 것을 못 고치면 사람을 지웠다 다시 등록하게 되고, 그러면 판본 이력이 사라진다 */
select lives_ok(
  $$update public.user_person_access set relation = 'friend'
    where person_id = (select person_id from dad)$$,
  '고른 사이를 고쳐 적을 수 있다');

/**
 * **관계를 안 받는 문이 남아 있지 않다.** 인자에 기본값을 붙였으므로 옛 서명을 안
 * 지우면 열 개짜리 호출이 어느 쪽으로 갈지 모호해지고, 더 나쁘게는 관계를 영영 못
 * 받는 문이 브라우저에 열린 채 남는다.
 */
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_managed_person'),
  1,
  '사람을 등록하는 문은 하나다');

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

reset role;
select * from finish();
rollback;
