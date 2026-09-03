-- 직접 입력한 두 사람을 **한 누름에 저장한다.**
--
-- 여기서 재는 것 셋.
--
-- 1. **둘과 사이가 한 문으로 들어간다** — 저장하고 나면 목록에 둘이 있고 쌍에 사이가 있다.
-- 2. **한도에 걸리면 아무도 안 남는다.** 등록을 두 번 부르던 길에서는 첫 사람만 남고
--    되돌리는 일을 호출부가 기억해야 했다.
-- 3. **문은 로그인한 사람에게만 열린다.**
--
-- ## 한도 트리거는 **미룬 제약**이다
--
-- `person_limit` 은 `deferrable initially deferred` 라 커밋에서 선다. 시험은 한
-- 트랜잭션 안에서 돌고 롤백으로 끝나므로, 그대로 두면 **이 시험은 한도를 한 번도 안
-- 재고 통과한다.** 그래서 부르기 전에 즉시로 바꾼다 — 재려는 것이 실제로 서게.
begin;
select plan(14);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.joins(mail text)
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  return uid;
end;
$$;

/** 두 사람을 저장하는 한 문 — 이름 말고는 다 같은 입력이라 시험이 짧아진다 */
create or replace function pg_temp.save_pair(first text, second text, rel text)
returns table (person_a uuid, person_b uuid) language sql as $$
  select * from public.create_pair_for_reading(
    first,  null, 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    second, null, 'solar', '1992-08-20', '1992-08-20', '09:00', 'male',   '부산', 'jo', 'localMean',
    rel);
$$;

/** 목록에 든 사람 수 — selfPerson 은 한도가 안 세므로 여기서도 뺀다 */
create or replace function pg_temp.managed(uid uuid)
returns bigint language sql as $$
  select count(*)
  from public.user_person_access a
  join public.app_user u on u.id = a.user_id
  where a.user_id = uid and a.person_id is distinct from u.self_person_id;
$$;

set local role authenticated;

create temporary table folks as
select pg_temp.joins('kim-pair@example.com') as kim,
       pg_temp.joins('lee-pair@example.com') as lee;
grant select on folks to authenticated, service_role;

-- ── 한 문으로 둘과 사이가 들어간다 ─────────────────────────────────────────

select pg_temp.acting((select kim from folks));

create temporary table saved as
select * from pg_temp.save_pair('민수', '지영', 'family');
grant select on saved to authenticated, service_role;

select isnt((select person_a from saved), null, '첫 사람의 id 가 나온다');
select isnt((select person_b from saved), null, '두 번째 사람의 id 가 나온다');
select is(pg_temp.managed((select kim from folks)), 2::bigint, '목록에 둘이 들어갔다');

select is(
  (select public.pair_relation_of((select person_a from saved), (select person_b from saved))),
  'family',
  '사이도 같은 누름에 적힌다');

/** 판본이 없으면 궁합을 계산할 수 없다 — 등록과 같은 사건에 들어간다 */
select is(
  (select count(*) from public.person p
    where p.id in (select person_a from saved union select person_b from saved)
      and p.current_revision_id is not null),
  2::bigint,
  '두 사람 다 현재 판본을 들고 있다');

/** 「모른다」는 행이 없는 것이다 — 방금 만든 쌍에 지우는 문을 부를 이유가 없다 */
create temporary table unknown_pair as
select * from pg_temp.save_pair('영호', '수진', null);
grant select on unknown_pair to authenticated, service_role;

select is(
  (select public.pair_relation_of(
    (select person_a from unknown_pair), (select person_b from unknown_pair))),
  null,
  '사이를 안 고르면 쌍에 아무 줄도 안 남는다');

-- ── 한도에 걸리면 아무도 안 남는다 ────────────────────────────────────────

/**
 * 열아홉까지 채운다. 다음 한 쌍이 스물과 스물하나가 되므로 **첫 사람은 통과하고
 * 둘째에서 막힌다** — 갈라 부르던 길이 첫 사람만 남기던 바로 그 자리다.
 */
select pg_temp.acting((select lee from folks));
do $$
declare at integer;
begin
  for at in 1..19 loop
    perform public.create_managed_person(
      'ㅅ' || at, null, 'solar', '1990-05-15', '1990-05-15', '14:30',
      'female', '서울', 'jo', 'localMean');
  end loop;
end;
$$;

-- 미룬 제약을 즉시로 — 안 바꾸면 이 시험은 한도를 한 번도 안 재고 통과한다.
set constraints public.person_limit immediate;

select throws_ok(
  $$select * from pg_temp.save_pair('스물', '스물하나', 'friend')$$,
  '등록할 수 있는 사람은 20명까지입니다.',
  '한도를 넘기는 쌍은 거절된다');

select is(
  pg_temp.managed((select lee from folks)),
  19::bigint,
  '거절되면 첫 사람도 안 남는다 — 한 문이라 함께 되돌아간다');

set constraints public.person_limit deferred;

-- ── 남은 자리는 묻는 것이지 화면이 세는 것이 아니다 ──────────────────────

/**
 * 저장하는 입구가 셋이라(사람 탭 · 사주 결과 아래 · 궁합 결과 아래) 각자 세면 그중
 * 하나는 **selfPerson 을 안 빼는 것**을 잊는다. 그래서 DB 가 센다.
 */
/**
 * 앞의 거절이 통째로 되돌아갔으므로 이 사람은 여전히 열아홉이다. 그래서 남은 자리가
 * 하나 — **궁합 입구가 막아야 하는 바로 그 자리**다(둘이 필요한데 하나 남았다).
 */
select is(
  (select remaining from public.my_person_slots()),
  1,
  '열아홉 명이면 한 자리가 남는다');

select is(
  (select used from public.my_person_slots()),
  19,
  'selfPerson 은 안 센다 — 스무 명이 묶여 있어도 열아홉이다');

select is(
  (select person_limit from public.my_person_slots()),
  20,
  '한도 수도 함께 낸다 — 화면이 손으로 베끼지 않게');

/** 자리를 비우면 그만큼 돌아온다 — 화면이 「지우면 된다」고 말한 것이 참이어야 한다 */
delete from public.user_person_access
where person_id in (
  select a.person_id from public.user_person_access a
  join public.app_user u on u.id = a.user_id
  where a.user_id = (select lee from folks) and a.person_id is distinct from u.self_person_id
  limit 2);

select is(
  (select remaining from public.my_person_slots()),
  3,
  '두 명을 빼면 두 자리가 돌아온다');

-- ── 문은 로그인한 사람에게만 ──────────────────────────────────────────────

reset role;
set local role anon;

/**
 * 안쪽의 등록도 「로그인이 필요합니다」로 막지만, 여기서 재는 것은 **바깥문**이다.
 * `grant` 를 `authenticated` 에게만 준 것이 그 문이고, 안쪽 판정에 기대면 그 문이
 * 열려도 시험은 계속 초록이다.
 */
select throws_ok(
  $$select * from pg_temp.save_pair('아무', '누구', null)$$,
  '42501',
  'permission denied for function create_pair_for_reading',
  '로그인하지 않은 자리에는 문이 안 열린다');

/** 남의 목록 크기를 묻는 문이 되지 않게 — uuid 를 안 받고 문도 닫혀 있다 */
select throws_ok(
  $$select * from public.my_person_slots()$$,
  '42501',
  'permission denied for function my_person_slots',
  '남은 자리도 로그인한 사람만 묻는다');

select * from finish();
rollback;
