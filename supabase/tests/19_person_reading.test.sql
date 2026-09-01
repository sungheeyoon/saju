-- 저장한 사람 하나의 풀이 — **`self` 는 계속 나만 뜻한다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **엣지가 자격이다.** 내가 관리하는 Person 이면 만들고 보고, 아니면 0행이다 —
--    없는 것과 못 보는 것을 가르지 않는다.
-- 2. **내 selfPerson 은 이 갈래가 아니다.** 안 막으면 같은 명식에 결과가 둘 생기고
--    같은 자료로 풀이권이 두 번 나간다.
-- 3. **사람마다 자기 결과다.** 둘이 같은 엄마를 관리해도 각자의 현재 결과가 하나씩이다.
-- 4. **한 사람짜리다.** 점수가 없고 두 번째 사람이 안 실린다.
begin;
select plan(26);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create or replace function pg_temp.save(
  run uuid, rev_a uuid, rev_b uuid, body text, score smallint)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev_a, rev_b, body, score,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
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

set local role authenticated;

create temporary table folks as
select pg_temp.joins('kim-solo@example.com') as kim,
       pg_temp.joins('lee-solo@example.com') as lee;
grant select on folks to authenticated, service_role;

select pg_temp.acting((select kim from folks));
create temporary table kin as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
) as mom;
grant select on kin to authenticated, service_role;

create temporary table mine as
select self_person_id as me from public.app_user where id = (select kim from folks);
grant select on mine to authenticated, service_role;

-- ── 내 엣지에 있는 사람 ─────────────────────────────────────────────────────

select is(
  (select count(*)::int from public.my_reading('person', (select mom from kin))),
  0,
  '아직 만들지 않았으면 결과가 없다');

create temporary table run_mom as
select run_id as id, revision_a as rev, person_a as who
from public.start_reading_run('person', 'solo-mom-0001', (select mom from kin));
grant select on run_mom to authenticated, service_role;

select isnt((select id from run_mom), null, '저장한 사람의 풀이 요청이 선다');

/** **한 사람만 실린다** — 두 번째 판본을 안 내주므로 궁합 자료를 못 만든다 */
select is(
  (select who from run_mom),
  (select mom from kin),
  '고른 그 사람의 판본으로 난다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 엄마의 풀이', null)$$,
    (select id from run_mom), (select rev from run_mom)),
  '저장한 사람의 풀이가 저장된다');

select is(
  (select output from public.my_reading('person', (select mom from kin))),
  '## 엄마의 풀이',
  '그 사람의 화면에서 읽힌다');

/** 궁합 점수를 억지로 붙이지 않는다 — 검사식이 그것을 강제한다 */
select is(
  (select score from public.my_reading('person', (select mom from kin))),
  null::smallint,
  '점수가 없다');

select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 점수 붙은 풀이', 70::smallint)$$,
    (select id from run_mom), (select rev from run_mom)),
  '23514', null, '점수를 붙여 저장할 수는 없다');

-- ── 내 selfPerson 은 `person` 이 아니다 ────────────────────────────────────

/**
 * **같은 명식에 결과가 둘 생기면 안 된다.**
 *
 * 내 selfPerson 도 내 엣지에 있으므로 안 막으면 `person` 으로도 물어진다. 그러면
 * `/me` 와 `/me/people/{내 id}` 에서 서로 다른 글이 서고, 같은 자료로 풀이권이 두 번
 * 나간다.
 *
 * 화면은 이미 그렇게 전제하고 있었다 — 목록이 selfPerson 을 걸러 내며 「나는 `/me` 에
 * 있다」고 적어 두었다. 그런데 그 판정이 앱에만 있어서 **주소로는 열렸다.**
 */
select throws_ok(
  format($$select * from public.start_reading_run('person', 'solo-me-0001', %L::uuid)$$,
    (select me from mine)),
  '23514', null, '내 selfPerson 으로는 저장한 사람 풀이를 시작할 수 없다');

select is(
  (select count(*)::int from public.my_reading('person', (select me from mine))),
  0,
  '내 selfPerson 은 저장한 사람으로 조회되지도 않는다');

/** 그래도 `self` 는 그대로 선다 — 닫힌 것은 한 갈래뿐이다 */
create temporary table run_self as
select run_id as id, revision_a as rev from public.start_reading_run('self', 'solo-self-0001');
grant select on run_self to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 나의 풀이', null)$$,
    (select id from run_self), (select rev from run_self)),
  '자기 풀이는 그대로 만들어진다');

select is(
  (select output from public.my_reading('self')),
  '## 나의 풀이',
  '자기 풀이는 자기 자리에 선다');

-- ── 엣지가 없으면 ───────────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from public.my_reading('person', (select mom from kin))),
  0,
  '내 엣지에 없는 사람의 결과는 없는 것과 같다');

select throws_ok(
  format($$select * from public.start_reading_run('person', 'solo-steal-0001', %L::uuid)$$,
    (select mom from kin)),
  '23514', null, '내 엣지에 없는 사람으로는 요청을 시작할 수 없다');

-- ── 사람마다 자기 결과 ──────────────────────────────────────────────────────

reset role;
insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select lee from folks), (select mom from kin), '이모', 'viewer');
set local role authenticated;
select pg_temp.acting((select lee from folks));

/** 엣지가 생기면 보이지만 **내 결과는 아직 없다** — 결과는 사람마다다 */
select is(
  (select count(*)::int from public.my_reading('person', (select mom from kin))),
  0,
  '엣지가 생겨도 남의 결과를 물려받지 않는다');

create temporary table run_aunt as
select run_id as id, revision_a as rev
from public.start_reading_run('person', 'solo-aunt-0001', (select mom from kin));
grant select on run_aunt to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 이모가 본 풀이', null)$$,
    (select id from run_aunt), (select rev from run_aunt)),
  '같은 사람에 대해 자기 결과를 따로 만든다');

select is(
  (select output from public.my_reading('person', (select mom from kin))),
  '## 이모가 본 풀이',
  '내 화면에는 내 결과가 선다');

select pg_temp.acting((select kim from folks));
select is(
  (select output from public.my_reading('person', (select mom from kin))),
  '## 엄마의 풀이',
  '남이 만들어도 내 결과는 안 갈린다');

-- ── 교체 · 낡음 · 풀이권 · 설문 ─────────────────────────────────────────────

/** 다시 만들면 **통째로 갈린다** — 대상마다 결과 하나다(ADR 0013) */
create temporary table run_again as
select run_id as id, revision_a as rev
from public.start_reading_run('person', 'solo-mom-0002', (select mom from kin));
grant select on run_again to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 다시 쓴 엄마 풀이', null)$$,
    (select id from run_again), (select rev from run_again)),
  '같은 사람에 다시 만들면 저장된다');

select is(
  (select output from public.my_reading('person', (select mom from kin))),
  '## 다시 쓴 엄마 풀이',
  '앞의 글을 대신한다');

reset role;
select is(
  (select count(*)::int from public.reading
   where kind = 'person' and person_a = (select mom from kin)
     and owner_user_id = (select kim from folks)),
  1,
  '행이 늘지 않는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

/**
 * **출생정보를 고치면 이전 입력으로 쓴 글이 된다.**
 *
 * 고장이 아니라 그렇게 하기로 한 것이다. 화면이 그 사실을 말할 수 있어야 사용자가
 * 「왜 새로 안 났지」를 안 묻는다.
 */
select is(
  (select from_current_revision from public.my_reading('person', (select mom from kin))),
  true,
  '고치기 전에는 지금 판본으로 쓴 글이다');

select public.add_person_revision(
  (select mom from kin),
  'solar', '1962-03-02', '1962-03-02', '08:10', 'female', '부산', 'jo', 'localMean');

select is(
  (select from_current_revision from public.my_reading('person', (select mom from kin))),
  false,
  '고치고 나면 이전 입력으로 쓴 글이라고 말한다');

select isnt(
  (select output from public.my_reading('person', (select mom from kin))),
  null,
  '그래도 글은 그대로 서 있다');

/** 풀이권은 kind 를 안 묻는다 — 전역 다섯에서 함께 센다 */
select is(
  (select used from public.my_reading_credits()),
  3,
  '저장한 사람의 풀이도 같은 풀이권에서 나간다');

/** 설문은 그 시도에 매인다 — kind 가 늘어도 붙는 자리는 그대로다 */
reset role;
update public.app_user set improvement_consent = true where id = (select kim from folks);
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 3::smallint, 'right')$$,
    (select id from run_again)),
  '저장한 사람의 풀이에도 답을 남긴다');

select is(
  (select my_feedback -> 'usefulness' from public.my_reading('person', (select mom from kin))),
  to_jsonb(4),
  '그 답이 그 결과와 함께 온다');

select * from finish();
rollback;
