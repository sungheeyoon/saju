-- 판본 보존 — **개수보다 참조가 먼저다**(ADR 0011).
--
-- 여기서 재는 것은 셋이다.
--
-- 1. 아무것도 가리키지 않는 이전 입력은 최근 두 개까지만 남는다. 전체 표에 세 행만
--    허용하는 규칙이 아니다 — Match 가 붙들고 있으면 넷도 남는다.
-- 2. 성립하지 않은 요청은 판본을 **놓고** 지문만 남긴다. 성립한 요청은 놓지 않는다.
-- 3. 참조가 사라진 **그 순간에** 정리가 돈다. 다음 수정을 기다리지 않는다.
--
-- 그리고 이 파일이 재는 가장 중요한 하나: **매인 판본은 절대 orphan 이 되지 않는다.**
-- 되돌릴 수 없는 삭제라 「지워졌는가」보다 「지워지지 않았는가」를 먼저 잰다.
begin;
select plan(26);

/** 다섯 오행 개수만 주면 요약 한 벌이 된다 */
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

/** 참여자 하나 */
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
  insert into public.discovery_profile (nickname, prefer_gender) values (who, 'any');
  perform public.set_discovery_participation(true, summary);
  return uid;
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * 한 번 고친다 — **출생지 하나만 바꾼다.**
 *
 * 무엇을 바꾸든 지문이 달라지면 새 판본이라, 여기서는 도시 이름을 세는 자리로 쓴다.
 */
create or replace function pg_temp.revise(person uuid, city text)
returns uuid
language sql
as $$
  select public.add_person_revision(
    person, 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', city, 'jo', 'localMean');
$$;

create or replace function pg_temp.revisions(person uuid)
returns integer
language sql
as $$
  select count(*)::int from public.person_chart_revision where person_id = person;
$$;

create or replace function pg_temp.alive(revision uuid)
returns boolean
language sql
as $$
  select exists (select 1 from public.person_chart_revision where id = revision);
$$;

/**
 * 쌓은 차례를 **문장 단위로** 적어 둔다.
 *
 * 한 `select` 의 여러 자리에 나란히 부르면 무엇이 먼저 도는지는 정해져 있지 않다.
 * 차례가 뜻을 가지는 시험에서 그렇게 하면 「가장 오래된 것이 지워졌는가」가
 * 실행마다 다른 것을 잰다.
 */
create temporary table revisions (owner text not null, label text not null, id uuid not null);
grant select, insert on revisions to authenticated, service_role;

create or replace function pg_temp.rev(who text, which text)
returns uuid
language sql
as $$ select id from revisions where owner = who and label = which; $$;

set local role authenticated;

-- ── 아무 사건도 가리키지 않는 이전 입력 ──────────────────────────────────────
create temporary table solo as select tests.signup('solo-ret@example.com') as uid;
grant select on solo to authenticated, service_role;

select pg_temp.acting((select uid from solo));

create temporary table solo_person as
select public.create_self_person(
  '홀로', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean'
) as id;
grant select on solo_person to authenticated, service_role;

insert into revisions values ('solo', 'r1',
  (select current_revision_id from public.person where id = (select id from solo_person)));
insert into revisions values ('solo', 'r2',
  pg_temp.revise((select id from solo_person), '부산'));
insert into revisions values ('solo', 'r3',
  pg_temp.revise((select id from solo_person), '대구'));

select is(pg_temp.revisions((select id from solo_person)), 3,
  '현재 하나와 미참조 이전 둘까지는 그대로 쌓인다');

insert into revisions values ('solo', 'r4',
  pg_temp.revise((select id from solo_person), '광주'));

select is(pg_temp.revisions((select id from solo_person)), 3,
  '세 번째 미참조 이전 판본이 생기면 가장 오래된 것이 정리된다');

select is(pg_temp.alive(pg_temp.rev('solo', 'r1')), false,
  '가장 오래된 미참조 입력은 남지 않는다');

select is(pg_temp.alive(pg_temp.rev('solo', 'r2')), true,
  '최근 두 개의 미참조 이전 입력은 남는다');

select is(
  (select current_revision_id from public.person where id = (select id from solo_person)),
  pg_temp.rev('solo', 'r4'),
  '현재 판본은 언제나 방금 쌓은 것이다');

-- **조회는 판본을 만들지 않는다.** 같은 값으로 다시 저장해도 이력이 움직이지 않는다.
select is(
  pg_temp.revise((select id from solo_person), '광주'),
  pg_temp.rev('solo', 'r4'),
  '같은 입력을 다시 저장하는 것은 판본을 만들지도 지우지도 않는다');
select is(pg_temp.revisions((select id from solo_person)), 3,
  '아무것도 달라지지 않은 저장은 이력을 움직이지 않는다');

-- ── 두 사람이 동의한다 ───────────────────────────────────────────────────────
reset role;
set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-ret@example.com', '김보', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-ret@example.com', '이보', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('choi-ret@example.com', '최보', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated, service_role;

reset role;

/** 다른 검사가 남긴 참여자는 이 시험의 관심 밖이다(`11_match_result` 와 같은 이유) */
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from folks union all select lee from folks
      union all select choi from folks) mine,
     public.discovery_profile p
where p.user_id not in (select uid from (
  select kim as uid from folks union all select lee from folks
  union all select choi from folks) ours);

create temporary table people as
select
  kim_person.id as kim_person,
  choi_person.id as choi_person,
  kim_person.current_revision_id as kim_first,
  lee_person.current_revision_id as lee_first
from folks
join public.app_user kim_user on kim_user.id = folks.kim
join public.app_user lee_user on lee_user.id = folks.lee
join public.app_user choi_user on choi_user.id = folks.choi
join public.person kim_person on kim_person.id = kim_user.self_person_id
join public.person lee_person on lee_person.id = lee_user.self_person_id
join public.person choi_person on choi_person.id = choi_user.self_person_id;
grant select on people to authenticated, service_role;

set local role authenticated;

select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked_lee as
select public.request_match((select lee from folks)) as request_id;
grant select on asked_lee to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select is(public.respond_to_match_request((select request_id from asked_lee), true), 'accepted',
  '이가 수락해 Match 가 선다');

reset role;
select is(
  (select requester_revision_id is not null and addressee_revision_id is not null
   from public.match_request where id = (select request_id from asked_lee)),
  true,
  '성립한 요청은 잡아 둔 판본을 계속 든다 — Match 가 같은 두 행을 이어받는다');

/** Match 의 id 는 당사자에게만 보인다. `postgres` 로 한 번 잡아 둔다 */
create temporary table matched as
select id as match_id from public.match where request_id = (select request_id from asked_lee);
grant select on matched to authenticated, service_role;
set local role authenticated;

-- ── 성립하지 않은 요청은 판본을 놓고 지문을 남긴다 ───────────────────────────
select pg_temp.acting((select kim from folks));

create temporary table asked_choi as
select public.request_match((select choi from folks)) as request_id;
grant select on asked_choi to authenticated, service_role;

reset role;
create temporary table asked_choi_before as
select r.requester_fingerprint, r.addressee_fingerprint,
       r.requester_revision_id, r.addressee_revision_id
from public.match_request r where r.id = (select request_id from asked_choi);
grant select on asked_choi_before to authenticated, service_role;

select is(
  (select requester_fingerprint from asked_choi_before),
  (select v.fingerprint from public.person_chart_revision v
   where v.id = (select requester_revision_id from asked_choi_before)),
  '요청의 지문은 그 요청이 잡은 판본의 것이다 — 손으로 적지 않는다');
set local role authenticated;

select pg_temp.acting((select choi from folks));
select is(public.respond_to_match_request((select request_id from asked_choi), false), 'rejected',
  '최가 거절한다');

reset role;
select is(
  (select requester_revision_id is null and addressee_revision_id is null
   from public.match_request where id = (select request_id from asked_choi)),
  true,
  '거절된 요청은 두 판본을 다 놓는다 — 그 요청 하나 때문에 과거 출생 입력을 붙들지 않는다');

select is(
  (select requester_fingerprint from public.match_request
   where id = (select request_id from asked_choi)),
  (select requester_fingerprint from asked_choi_before),
  '판본을 놓아도 무엇에 대한 요청이었는지는 지문으로 남는다');

/**
 * 놓은 요청을 되살릴 수 없다. 판본 없이 `pending` 으로 돌아가면 「수락 순간 다시
 * 본다」가 무엇과 비교하는지 없어진다.
 */
select throws_ok(
  format($$update public.match_request set status = 'pending', decided_at = null
           where id = %L$$, (select request_id from asked_choi)),
  '23514', null,
  '판본을 놓은 요청은 다시 기다리는 자리로 못 돌아간다');

-- 다시 들려고 해도 놓는다. terminal 이면 무엇을 적어 넣든 결과는 같다.
update public.match_request
set requester_revision_id = pg_temp.rev('solo', 'r4'),
    addressee_revision_id = pg_temp.rev('solo', 'r4')
where id = (select request_id from asked_choi);

select is(
  (select requester_revision_id is null and addressee_revision_id is null
   from public.match_request where id = (select request_id from asked_choi)),
  true,
  '성립하지 않은 요청에 판본을 다시 적어 넣어도 놓는다 — 호출부가 기억하지 않는다');
set local role authenticated;

-- ── 참조된 판본은 개수 제한 밖에 선다 ────────────────────────────────────────
select pg_temp.acting((select kim from folks));

insert into revisions values ('kim', 'r2',
  pg_temp.revise((select kim_person from people), '부산'));
insert into revisions values ('kim', 'r3',
  pg_temp.revise((select kim_person from people), '대구'));
insert into revisions values ('kim', 'r4',
  pg_temp.revise((select kim_person from people), '광주'));
insert into revisions values ('kim', 'r5',
  pg_temp.revise((select kim_person from people), '대전'));

select is(pg_temp.alive((select kim_first from people)), true,
  'Match 가 매어 둔 판본은 네 번을 고쳐도 남는다');

select is(pg_temp.revisions((select kim_person from people)), 4,
  '참조된 판본은 개수 제한에서 빠진다 — 전체 표에 셋만 허용하는 규칙이 아니다');

select is(pg_temp.alive(pg_temp.rev('kim', 'r2')), false,
  '참조되지 않은 이전 입력은 그 사이에서도 최근 둘까지다');

-- **매인 판본이 orphan 이 되지 않았다** — 열쇠가 여전히 두 벌을 읽는다.
reset role;
set local role service_role;
select is(
  (select count(*)::int from public.match_calculation_inputs((select match_id from matched))),
  2,
  '고친 뒤에도 공유 결과는 동의한 그때의 두 판본을 읽는다');
reset role;
set local role authenticated;

-- ── 참조가 사라진 그 순간에 정리가 돈다 ──────────────────────────────────────
/**
 * 참여를 끄면 풀에 올렸던 요약이 내려가고, 그 요약이 매여 있던 판본은 그때 미참조가
 * 된다. **다음 수정을 기다리지 않는다** — 기다리면 「지웠다」고 말한 뒤에도 입력이
 * 남아 있는 기간이 생긴다.
 */
select pg_temp.acting((select choi from folks));

insert into revisions values ('choi', 'r1',
  (select current_revision_id from public.person where id = (select choi_person from people)));
insert into revisions values ('choi', 'r2',
  pg_temp.revise((select choi_person from people), '부산'));
insert into revisions values ('choi', 'r3',
  pg_temp.revise((select choi_person from people), '대구'));
insert into revisions values ('choi', 'r4',
  pg_temp.revise((select choi_person from people), '광주'));

select is(pg_temp.revisions((select choi_person from people)), 4,
  '풀에 올린 요약이 매여 있는 판본도 개수 제한에서 빠진다');

select lives_ok(
  format($$select public.set_discovery_participation(false, %L::jsonb)$$, '{}'),
  '최가 참여를 끈다');

select is(pg_temp.alive(pg_temp.rev('choi', 'r1')), false,
  '요약이 내려간 판본은 그 자리에서 미참조가 되고 그때 정리된다');

select is(pg_temp.revisions((select choi_person from people)), 3,
  '참조가 사라지면 상한도 함께 돌아온다');

-- ── 정리 함수는 클라이언트가 부르는 문이 아니다 ──────────────────────────────
select throws_ok(
  format($$select public.retain_person_revisions(%L)$$, (select choi_person from people)),
  '42501', null,
  '정리는 브라우저가 부를 수 있는 문이 아니다');

select throws_ok(
  $$select * from public.revisions_in_use()$$,
  '42501', null,
  '무엇이 참조되고 있는지도 브라우저가 묻지 않는다');

select * from finish();
rollback;
