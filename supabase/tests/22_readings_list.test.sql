-- 만든 글이 **한 목록에** 선다 — 네 kind 를 한 문이 든다.
--
-- 여기서 재는 것 다섯.
--
-- 1. **네 kind 가 다 선다.** `self` · `person` · `private` · `match`. 하나라도 빠지면
--    그 글은 여전히 자기 화면에서만 닿을 수 있고, 이 목록이 있을 이유가 없어진다.
-- 2. **가는 길과 부를 이름이 함께 난다.** id 만 내주면 화면이 이름을 따로 물어야 하고,
--    짝짓는 자리가 둘이면 하나는 언젠가 어긋난다.
-- 3. **남의 글은 안 선다.** `security definer` 는 RLS 를 지나가므로, 좁힘이 함수 안에
--    없으면 이 함수가 곧 남의 기록을 세는 문이 된다.
-- 4. **중지된 계정에는 아무것도 안 선다.**
-- 5. **본문도 근거도 안 나간다.** 반환형이 곧 계약이다 — 목록은 결과로 가는 길이지
--    두 번째 결과 화면이 아니다(ADR 0008·0033).
begin;
select plan(25);

/**
 * 이 파일은 풀이권을 재지 않는다 — 대상 넷에 시도를 여는 것이 여기서 재려는 것이고,
 * 폐쇄 베타의 다섯으로는 다 못 밟는다(13번과 같은 손잡이). 트랜잭션이 되돌아가므로
 * 다른 파일에는 안 남는다.
 */
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');
  perform public.save_my_profile(who, null);
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** `save_reading` 은 `authenticated` 에게 닫혀 있다 — 서버가 열쇠로 부르는 자리를 흉내낸다 */
create or replace function pg_temp.save(
  run uuid, rev_a uuid, rev_b uuid, body text, score smallint)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, rev_a, rev_b, body, score,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-list@example.com', '김목', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-list@example.com', '이목', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on folks to authenticated, service_role;

select pg_temp.acting((select kim from folks));
create temporary table kin as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
) as mom;
grant select on kin to authenticated, service_role;

reset role;

/** 다른 시험이 남긴 참여자는 이 파일의 관심 밖이다(13번과 같은 이유) */
insert into public.discovery_hidden (user_id, hidden_user_id)
select ours.uid, p.user_id
from (select kim as uid from folks union all select lee from folks) ours,
     public.discovery_profile p
where p.user_id not in (select kim from folks union all select lee from folks);

create temporary table people as
select
  kim_person.id as kim_person,
  kim_person.current_revision_id as kim_revision,
  lee_person.current_revision_id as lee_revision,
  (select current_revision_id from public.person where id = (select mom from kin)) as mom_revision
from folks
join public.app_user kim_user on kim_user.id = folks.kim
join public.app_user lee_user on lee_user.id = folks.lee
join public.person kim_person on kim_person.id = kim_user.self_person_id
join public.person lee_person on lee_person.id = lee_user.self_person_id;
grant select on people to authenticated, service_role;

set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 아무것도 안 만들었으면 목록도 없다 ──────────────────────────────────────
--
-- **비어 있음이 답이다.** 화면은 이 값을 보고 아무것도 안 그린다(PRD §3.1).

select is(
  (select count(*)::int from public.my_readings()),
  0,
  '만든 글이 없으면 목록도 비어 있다');

-- ── 네 kind 를 하나씩 만든다 ────────────────────────────────────────────────

create temporary table runs as select
  (select run_id from public.start_reading_run('self', 'list-self-0001')) as self_run,
  (select run_id from public.start_reading_run('person', 'list-person-0001',
     (select mom from kin))) as person_run;
grant select on runs to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 내 풀이', null)$$,
    (select self_run from runs), (select kim_revision from people)),
  '내 사주 풀이가 저장된다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 엄마 풀이', null)$$,
    (select person_run from runs), (select mom_revision from people)),
  '저장한 사람의 풀이가 저장된다');

create temporary table pair_run as
select run_id as id, revision_a as rev_a, revision_b as rev_b
from public.start_reading_run(
  'private', 'list-private-0001',
  least((select mom from kin), (select kim_person from people)),
  greatest((select mom from kin), (select kim_person from people)));
grant select on pair_run to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 둘의 궁합', 71::smallint)$$,
    (select id from pair_run), (select rev_a from pair_run), (select rev_b from pair_run)),
  '두 사람의 궁합이 저장된다');

-- 요청은 노출 기록에 매인다(ADR 0009) — 목록을 먼저 열어야 청할 수 있다.
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 Match 가 선다');

create temporary table matched as select match_id from public.my_matches();
grant select on matched to authenticated, service_role;

-- 매인 판본은 `match` 행에 있고 그 표는 당사자에게도 안 열린다 — 여기서만 소유자로 읽는다.
reset role;
create temporary table pinned as
select m.low_revision_id as low_rev, m.high_revision_id as high_rev
from public.match m where m.id = (select match_id from matched);
grant select on pinned to authenticated, service_role;
set local role authenticated;
select pg_temp.acting((select kim from folks));

/**
 * **아무도 안 누른다 — 동의가 시도를 열었다**(ADR 0038). 시도는 청한 쪽(김) 이름으로
 * 이미 서 있으므로 여는 것이 아니라 찾는다. `reading_run` 은 당사자에게도 안 열린다.
 */
reset role;
create temporary table match_run as
select r.id from public.reading_run r
where r.match_id = (select match_id from matched) and r.status = 'running';
grant select on match_run to authenticated, service_role;
set local role authenticated;
select pg_temp.acting((select kim from folks));

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 함께 보는 궁합', 64::smallint)$$,
    (select id from match_run), (select low_rev from pinned), (select high_rev from pinned)),
  '함께 보는 궁합이 저장된다');

-- ── 넷이 한 목록에 선다 ─────────────────────────────────────────────────────

select set_eq(
  $$select kind from public.my_readings()$$,
  $$values ('self'), ('person'), ('private'), ('match')$$,
  '네 kind 가 한 목록에 다 선다');

/**
 * **차례는 DB 가 정한다.** 화면에서 다시 정렬하면 판정하는 자리가 둘이 되고, 둘이
 * 갈리는 날 목록이 DB 와 다른 순서를 보인다.
 *
 * 넷을 한 트랜잭션에서 만들었으므로 `now()` 가 다 같다 — 그대로 재면 무엇을 넣어도
 * 통과하는 검사가 된다. 시각을 벌려 놓고 잰다.
 */
reset role;
update public.reading set created_at = timestamptz '2026-09-01 00:00+00' + case kind
  when 'self' then interval '0 hour'
  when 'person' then interval '1 hour'
  when 'private' then interval '2 hour'
  else interval '3 hour' end;
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select array_agg(kind) from public.my_readings()),
  array['match', 'private', 'person', 'self'],
  '최근 것이 앞이다');

-- ── 부를 이름과 가는 길 ─────────────────────────────────────────────────────

/**
 * `self` 는 이름을 안 낸다. 대상이 나이므로 부를 이름이 없고, 화면이 그 줄을
 * 「내 사주」로 적는다 — 내 엣지의 `local_label` 을 실어 보내면 목록에서 「민수 사주」로
 * 서서 남의 사주처럼 읽힌다.
 */
select is(
  (select label_a from public.my_readings() where kind = 'self'),
  null,
  '내 사주는 부를 이름을 안 낸다');

select is(
  (select label_a from public.my_readings() where kind = 'person'),
  '엄마',
  '저장한 사람은 내가 부르는 이름으로 선다');

select is(
  (select label_a || '·' || label_b from public.my_readings() where kind = 'private'),
  (select
     (select local_label from public.user_person_access
      where user_id = (select kim from folks)
        and person_id = least((select mom from kin), (select kim_person from people)))
     || '·' ||
     (select local_label from public.user_person_access
      where user_id = (select kim from folks)
        and person_id = greatest((select mom from kin), (select kim_person from people)))),
  '두 사람 궁합은 둘의 이름을 함께 낸다');

/**
 * **`match` 의 이름은 상대의 공개 별명이다.** `local_label` 은 내가 그 사람을 부르는
 * 말이라 매칭 상대에게는 없다 — 이름이 나오는 표가 kind 마다 다르다는 것이 이 함수가
 * 있어야 하는 이유 중 하나다.
 */
select is(
  (select label_a from public.my_readings() where kind = 'match'),
  '이목',
  '함께 보는 궁합은 상대의 별명으로 선다');

/**
 * **`match` 는 Person id 를 안 낸다.** 가는 길이 `match_id` 하나면 되고, 상대의
 * Person 은 이 사용자에게 열려 있지 않다(Match 는 엣지를 만들지 않는다 — US 46).
 */
select is(
  (select person_a is null and person_b is null and match_id is not null
   from public.my_readings() where kind = 'match'),
  true,
  '함께 보는 궁합은 Match id 만 낸다');

select is(
  (select match_id is null and person_a is not null and person_b is not null
   from public.my_readings() where kind = 'private'),
  true,
  '두 사람 궁합은 그 둘의 id 로 되돌아간다');

-- ── 점수 ────────────────────────────────────────────────────────────────────
--
-- 궁합 줄에는 점수가 함께 선다(PRD §3.1). 사용자가 결과 화면에서 이미 본 값이라
-- 목록에서 가리면 같은 값이 두 화면에서 다른 사실이 된다.

select is(
  (select array_agg(score order by kind) from public.my_readings()
   where kind in ('match', 'private')),
  array[64, 71]::smallint[],
  '궁합 줄에는 점수가 선다');

select is(
  (select bool_and(score is null) from public.my_readings() where kind in ('self', 'person')),
  true,
  '한 사람짜리 풀이에는 점수가 없다');

-- ── 「이전 입력」 ─────────────────────────────────────────────────────────────

select is(
  (select bool_and(from_current_revision) from public.my_readings()),
  true,
  '방금 만든 글은 다 지금 판본의 것이다');

/**
 * 출생 정보를 고치면 그 사람이 낀 줄이 낡는다. 목록에서도 그것을 말해야 열어 봐야
 * 아는 일이 안 생긴다.
 */
select isnt(
  public.add_person_revision((select mom from kin),
    'solar', '1962-03-03', '1962-03-03', '07:10', 'female', '부산', 'jo', 'localMean'),
  null,
  '엄마의 출생 정보를 고치면 새 판본이 선다');

select is(
  (select bool_and(from_current_revision) from public.my_readings()
   where kind in ('person', 'private')),
  false,
  '입력을 고치면 그 사람이 낀 줄이 낡는다');

/**
 * **`match` 는 언제나 지금 것이다.** 공유 결과는 매인 판본으로 나고 그 판본이 곧
 * 동의한 대상이라(ADR 0010), 「그 뒤에 고친 입력으로 다시 봐야 한다」가 성립하지 않는다.
 */
select is(
  (select from_current_revision from public.my_readings() where kind = 'match'),
  true,
  '함께 보는 궁합에는 이전 입력이 없다');

-- ── 목록에서 뺀 사람은 그 줄도 데려간다 ─────────────────────────────────────
--
-- 이름이 붙는 근거가 곧 좁힘이다. 접근이 끊긴 사람의 이름이 옛 결과를 통해 계속
-- 보이면, 목록에서 뺀다는 말이 절반만 참이 된다.

delete from public.user_person_access where person_id = (select mom from kin);

select is(
  (select count(*)::int from public.my_readings() where kind in ('person', 'private')),
  0,
  '목록에서 뺀 사람의 줄은 함께 내려간다');

-- ── 남의 글과 중지된 계정 ───────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

/** 이는 자기 풀이를 안 만들었다. 서는 것은 **함께 본 궁합 하나**여야 한다 */
select set_eq(
  $$select kind from public.my_readings()$$,
  $$values ('match')$$,
  '남이 만든 자기 풀이는 내 목록에 안 선다');

reset role;
update public.app_user set status = 'suspended' where id = (select lee from folks);
set local role authenticated;
select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from public.my_readings()),
  0,
  '중지된 계정에는 한 줄도 안 선다');

-- ── 반환형이 곧 계약이다 ────────────────────────────────────────────────────

/**
 * 글도 근거도 프롬프트도 안 나간다. `security definer` 가 내주는 것이 곧 브라우저가
 * 볼 수 있는 것이라, 열이 하나 늘면 그날 이 목록이 두 번째 결과 화면이 된다.
 */
select bag_eq(
  $$select unnest(array[
      'kind','person_a','person_b','match_id','label_a','label_b',
      'score','created_at','from_current_revision'])$$,
  $$select p.name from unnest((
      select proargnames from pg_proc
      where oid = 'public.my_readings()'::regprocedure)) as p(name)$$,
  '목록은 본문도 근거도 내주지 않는다');

select * from finish();
rollback;
