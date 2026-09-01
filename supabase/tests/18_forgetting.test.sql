-- 지우는 일 — **FK 가 순서를 정하고, 안 매인 것만 손으로 적는다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **삭제가 실제로 돈다.** 이 시험이 서기 전에는 `person_chart_revision.created_by`
--    가 삭제를 거절했다. 종료일을 약속하려면 그날 실행할 것이 실재해야 한다.
-- 2. **한 사람이 나가면 그 사람의 것만 사라진다.** 남이 관리하는 Person 의 판본을
--    데려가지 않는다.
-- 3. **주인 없는 출생정보가 안 남는다.** 아무도 관리하지 않게 된 Person 은 판본까지
--    함께 지워진다.
-- 4. **Match 는 양쪽에서 사라진다.** 상대 화면에도 그 결과가 안 남는다.
begin;
select plan(17);

create or replace function pg_temp.summary(w int, f int, e int, g int, s int)
returns jsonb language sql as $$
  select jsonb_build_object(
    'glyphCount', w + f + e + g + s,
    'counts', jsonb_build_object('木', w, '火', f, '土', e, '金', g, '水', s),
    'ratios', jsonb_build_object(
      '木', w / 8.0, '火', f / 8.0, '土', e / 8.0, '金', g / 8.0, '水', s / 8.0));
$$;

create or replace function pg_temp.participant(mail text, who text, summary jsonb)
returns uuid language plpgsql as $$
declare uid uuid := tests.signup(mail);
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
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-gone@example.com', '김감', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-gone@example.com', '이감', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on folks to authenticated, service_role;

reset role;
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from folks union all select lee from folks) mine,
     public.discovery_profile p
where p.user_id not in (select kim from folks union all select lee from folks);
set local role authenticated;

/**
 * **둘이 같은 Person 을 관리한다.**
 *
 * 김이 등록한 「엄마」를 이도 관리하게 만든다. 김이 나가도 이 Person 은 남아야 한다 —
 * 판본은 Person 의 것이지 그것을 적어 넣은 사람의 것이 아니다.
 */
select pg_temp.acting((select kim from folks));
create temporary table shared as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
) as mom,
public.create_managed_person(
  '삼촌', null, 'solar', '1958-09-30', '1958-09-30', '16:50', 'male', '대전', 'jo', 'localMean'
) as unc;
grant select on shared to authenticated, service_role;

reset role;
-- 이도 「엄마」를 본다. 이 엣지는 김이 나가도 남는다.
insert into public.user_person_access (user_id, person_id, local_label, role)
values ((select lee from folks), (select mom from shared), '이모', 'viewer');
set local role authenticated;

-- ── Match 하나 ──────────────────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));
select lives_ok($$select count(*) from public.discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 Match 가 선다');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  '이의 화면에 Match 가 하나 선다');

-- ── 지운다 ──────────────────────────────────────────────────────────────────

reset role;

/**
 * **이 줄이 서기 전에는 여기서 죽었다.**
 *
 *   ERROR: violates foreign key constraint "person_chart_revision_created_by_fkey"
 *
 * 화면이 없는 것이 아니라 스키마가 거절하고 있었다.
 */
create temporary table forgotten as
select * from public.forget_user((select kim from folks));
grant select on forgotten to authenticated, service_role;

select is(
  (select count(*)::int from auth.users where id = (select kim from folks)),
  0,
  '계정이 사라진다');

select is(
  (select count(*)::int from public.app_user where id = (select kim from folks)),
  0,
  '앱 계정도 함께 사라진다');

/** 열여덟 갈래가 FK 로 따라간다 — 이 시험은 표 이름을 세 개만 짚어 본다 */
select is(
  (select count(*)::int from public.discovery_profile where user_id = (select kim from folks)),
  0,
  '공개 프로필이 따라간다');

select is(
  (select count(*)::int from public.user_person_access where user_id = (select kim from folks)),
  0,
  '관리하던 엣지가 따라간다');

select is(
  (select count(*)::int from public.match_request where requester_user_id = (select kim from folks)),
  0,
  '보낸 요청이 따라간다');

-- ── 무엇이 남고 무엇이 안 남는가 ────────────────────────────────────────────

/**
 * **주인 없는 출생정보가 안 남는다.**
 *
 * 김의 selfPerson 과 김만 관리하던 「삼촌」은 아무도 볼 수 없게 됐다. 남아 있으면
 * 그것은 지운 적 없는 출생정보다.
 */
select is(
  (select count(*)::int from public.person where id = (select unc from shared)),
  0,
  '아무도 관리하지 않게 된 Person 이 사라진다');

select is(
  (select count(*)::int from public.person_chart_revision
   where person_id = (select unc from shared)),
  0,
  '그 Person 의 판본도 함께 사라진다');

/**
 * **답하는 수는 「이 사람 때문에 사라진 것」이다.**
 *
 * 처음에는 `forget_orphan_people()` 을 그대로 불러 DB 전체의 고아를 쓸었다. 그러면 한
 * 사람을 지우는 일이 남과 무관한 행까지 데려가고, 답한 숫자도 이 사람의 것이 아니다.
 * 그때 그 숫자를 근거로 「무엇이 지워졌나」를 말하게 된다.
 *
 * 이 시험도 처음에는 그 전역 수를 기대해서, 검사 DB 에 남이 남긴 고아가 있으면 빨개졌다 —
 * **전역 개수를 세는 시험은 「DB 가 비어 있는가」를 잰다.**
 */
select is(
  (select people_forgotten from forgotten),
  2,
  '몇을 잊었는지 답한다 — 자기 명식과 혼자 관리하던 한 사람');

/**
 * **남이 관리하는 Person 은 남는다.**
 *
 * `cascade` 로 두었다면 김이 나가면서 이가 보던 「엄마」의 명식까지 데려갔을 것이다.
 * 판본은 Person 의 것이지 그것을 적어 넣은 사람의 것이 아니다.
 */
select is(
  (select count(*)::int from public.person where id = (select mom from shared)),
  1,
  '남이 관리하는 Person 은 남는다');

select isnt(
  (select current_revision_id from public.person where id = (select mom from shared)),
  null,
  '그 Person 의 명식도 그대로다');

/** 「누가 만들었나」만 잊는다 — 떠난 사람을 계속 가리키는 것이 오히려 남기는 일이다 */
select is(
  (select created_by from public.person_chart_revision
   where person_id = (select mom from shared)),
  null,
  '만든 사람 자리는 비워진다');

-- ── Match 는 양쪽에서 사라진다 ──────────────────────────────────────────────

/**
 * 고를 수 있는 다른 답이 없다. 공유 결과는 서버가 **두 판본**을 읽어 자르는 것이라
 * (ADR 0010) 한쪽 판본이 사라지면 그 화면은 설 수 없다.
 */
set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_matches()),
  0,
  '남은 사람의 화면에서도 Match 가 사라진다');

-- ── 한 사람을 지우는 일이 남의 것을 데려가지 않는다 ─────────────────────────

/** 남이 놓고 간 고아는 이 삭제가 데려가지 않는다 — 전체 쓸기는 종료 파기의 일이다 */
reset role;
insert into public.person (id) values ('00000000-0000-0000-0000-0000000000aa');
set local role authenticated;
reset role;
create temporary table stranded as
select * from public.forget_user((select lee from folks));
grant select on stranded to authenticated, service_role;

select is(
  (select count(*)::int from public.person
   where id = '00000000-0000-0000-0000-0000000000aa'),
  1,
  '남이 놓고 간 고아는 그대로 남는다');

select is(
  (select public.forget_orphan_people()),
  1,
  '전체 쓸기는 그것까지 데려간다');

select * from finish();
rollback;
