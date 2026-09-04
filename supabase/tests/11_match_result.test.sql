-- 공유 결과 — **동의한 그때의 판본으로 나고, 열쇠 하나만 그것을 읽는다.**
--
-- 여기서 재는 것은 두 문의 모양이다(ADR 0010).
--
-- 1. `my_match_scope` — 누가 볼 수 있는가. 당사자가 아니면 **없는 것과 같은 답**이고,
--    제재·차단이 걸리면 내려간다. 나가는 것은 별명과 **매인 판본 id 둘**뿐이다.
-- 2. `match_calculation_inputs` — 출생 원문이 나가는 문. `authenticated` 는 못 부르고,
--    열쇠로 불러도 **어떤 Match 가 매어 둔 판본**밖에 안 나온다.
--
-- 그리고 이 파일이 재는 가장 중요한 하나: **한쪽이 입력을 고쳐도 매인 판본은 움직이지
-- 않는다.** 결과가 조용히 다른 값이 되면 무엇에 동의한 것인지 알 수 없다.
begin;
select plan(30);

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

/** 참여자 하나 — 요약을 손으로 골라 넣어 누가 누구를 채우는지가 또렷하게 갈리게 한다 */
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

/** 그 사람인 척한다. `postgres` 로 재면 RLS 를 그냥 지나가므로 역할도 함께 바꾼다 */
create or replace function pg_temp.acting(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-res@example.com', '김결', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-res@example.com', '이결', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('choi-res@example.com', '최결', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated, service_role;

reset role;

/**
 * **다른 검사가 남긴 참여자는 이 시험의 관심 밖이다**(`10_match_request` 와 같은 이유).
 *
 * `my_discovery_board` 는 `security definer` 라 RLS 로 좁혀지지 않는다. 좁히지 않으면
 * 이 파일이 「DB 가 비어 있는가」를 잰다.
 */
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from folks union all select lee from folks
      union all select choi from folks) mine,
     public.discovery_profile p
where p.user_id not in (select uid from (
  select kim as uid from folks union all select lee from folks
  union all select choi from folks) ours);

/**
 * 지금 서 있는 판본 둘 — **수락이 매어 둘 값**이다.
 *
 * `postgres` 로 잡는다. 남의 `app_user` 는 정책이 자기 행만 내주므로 시험 안에서
 * 당사자 역할로는 이 표를 만들 수 없다.
 */
create temporary table pinned as
select
  kim_person.id as kim_person,
  lee_person.id as lee_person,
  kim_person.current_revision_id as kim_revision,
  lee_person.current_revision_id as lee_revision
from folks
join public.app_user kim_user on kim_user.id = folks.kim
join public.app_user lee_user on lee_user.id = folks.lee
join public.person kim_person on kim_person.id = kim_user.self_person_id
join public.person lee_person on lee_person.id = lee_user.self_person_id;
grant select on pinned to authenticated, service_role;

set local role authenticated;

-- ── 후보를 보고 청하고 수락한다 ──────────────────────────────────────────────
select pg_temp.acting((select kim from folks));
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

-- ── 읽는 길은 둘뿐이고, 하나는 열쇠만 연다 ───────────────────────────────────

/**
 * 좁힘을 든 함수는 **아무도 직접 못 부른다.** 목록과 결과 화면이 이것 하나 위에 서므로
 * 열어 두면 좁히기 전의 행을 그대로 읽는 길이 생긴다.
 */
select throws_ok(
  $$select 1 from public.visible_matches()$$,
  '42501', null, '내가 볼 수 있는 Match 를 고르는 함수는 직접 못 부른다');

/**
 * **계산 입력은 로그인한 사람이 못 부른다.**
 *
 * 이 문으로 나가는 것은 출생 원문이다. 열어 두면 「상대의 생년월일시는 열리지 않는다」가
 * 화면의 약속으로만 남고, RPC 를 그대로 두드리는 경로에서 무너진다.
 */
select throws_ok(
  format($$select 1 from public.match_calculation_inputs(%L::uuid)$$, (select match_id from matched)),
  '42501', null, '계산 입력은 로그인한 사람이 못 부른다');

-- ── 받은 쪽이 읽는 것 ────────────────────────────────────────────────────────
select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  1,
  '당사자에게는 한 줄이 나온다');

select is(
  (select partner_user_id from public.my_match_scope((select match_id from matched))),
  (select kim from folks),
  '상대의 식별자를 든다 — 차단하는 문이 하나이려면 필요하다');

select is(
  (select partner_nickname from public.my_match_scope((select match_id from matched))),
  '김결',
  '상대는 **공개용 별명**으로 불린다 — 부를 이름도 Person 입력도 아니다');

select is(
  (select my_revision_id from public.my_match_scope((select match_id from matched))),
  (select lee_revision from pinned),
  '내 쪽 판본은 동의한 그때의 것이다');

select is(
  (select partner_revision_id from public.my_match_scope((select match_id from matched))),
  (select kim_revision from pinned),
  '상대 쪽 판본도 동의한 그때의 것이다');

select is(
  (select supplied_to_me from public.my_match_scope((select match_id from matched))),
  array['木', '火'],
  '두 축의 말은 **내 자리 기준**으로 뒤집혀 나온다');

select is(
  (select supplied_to_them from public.my_match_scope((select match_id from matched))),
  array['土', '金'],
  '내가 상대에게 채우는 쪽도 함께 나온다 — 동의는 양방향이다');

select isnt(
  (select balance_band from public.my_match_scope((select match_id from matched))),
  null,
  '함께 놓은 균형은 요청이 잡아 둔 그때의 구간이다');

-- ── 보낸 쪽도 자기 자리에서 읽는다 ───────────────────────────────────────────
select pg_temp.acting((select kim from folks));

select is(
  (select partner_user_id from public.my_match_scope((select match_id from matched))),
  (select lee from folks),
  '보낸 쪽에서 상대는 이결이다');

select is(
  (select my_revision_id from public.my_match_scope((select match_id from matched))),
  (select kim_revision from pinned),
  '내 쪽 판본은 언제나 나의 것이다 — 자리가 뒤집혀도 섞이지 않는다');

-- ── 남의 Match 와 없는 Match 는 **같은 답**이다 ──────────────────────────────
select pg_temp.acting((select choi from folks));

select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  0,
  '당사자가 아니면 한 줄도 안 나온다');

select is(
  (select count(*)::int from public.my_match_scope('00000000-0000-0000-0000-000000000000'::uuid)),
  0,
  '없는 Match 도 같은 답이다 — 갈라서 말하면 실재를 묻는 문이 된다');

-- ── 입력을 고쳐도 매인 판본은 움직이지 않는다 ────────────────────────────────
select pg_temp.acting((select lee from folks));

select lives_ok(
  format($$select public.add_person_revision(%L::uuid,
    'solar', '1990-05-15', '1990-05-15', '15:45', 'female', '서울', 'jo', 'localMean')$$,
    (select lee_person from pinned)),
  '이결이 출생 시각을 고친다');

select isnt(
  (select current_revision_id from public.person where id = (select lee_person from pinned)),
  (select lee_revision from pinned),
  '새 판본이 실제로 쌓였다');

select is(
  (select my_revision_id from public.my_match_scope((select match_id from matched))),
  (select lee_revision from pinned),
  '**결과는 여전히 동의한 그때의 판본을 가리킨다**');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  '성립한 Match 는 입력 수정으로 사라지지 않는다 — 무효가 되는 것은 pending 뿐이다');

-- ── 열쇠가 여는 것 ───────────────────────────────────────────────────────────
set local role service_role;

select is(
  (select count(*)::int from public.match_calculation_inputs((select match_id from matched))),
  2,
  '열쇠로는 매인 판본 둘이 나온다');

select bag_eq(
  format($$select revision_id from public.match_calculation_inputs(%L::uuid)$$,
    (select match_id from matched)),
  $$select lee_revision from pinned union all select kim_revision from pinned$$,
  '나오는 것은 **매인 둘**이다 — 새로 쌓인 판본은 이 문으로 안 나온다');

select is(
  (select count(*)::int
   from public.match_calculation_inputs('00000000-0000-0000-0000-000000000000'::uuid)),
  0,
  '어떤 Match 도 매지 않은 것은 열쇠로도 안 나온다');

-- ── 제재는 열쇠보다 세다 ─────────────────────────────────────────────────────
reset role;
update public.app_user set status = 'suspended' where id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  0,
  '중지된 계정과의 Match 는 내려간다');

set local role service_role;
select is(
  (select count(*)::int from public.match_calculation_inputs((select match_id from matched))),
  0,
  '중지 중에는 열쇠로도 계산 입력이 안 나온다 — 자격을 묻는 자리와 읽는 자리가 갈려 있으므로 여기서 한 번 더 묻는다');

reset role;
update public.app_user set status = 'active' where id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  1,
  '제재가 풀리면 다시 선다 — 행을 지운 것이 아니라 접근을 멈춘 것이다');

-- ── 차단은 되돌리지 않는다 ───────────────────────────────────────────────────
select lives_ok(
  format($$select public.block_user(%L::uuid)$$, (select kim from folks)),
  '이결이 김결을 차단한다');

select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  0,
  '차단한 쪽에서 결과가 내려간다');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  0,
  '차단당한 쪽에서도 내려간다 — 제재는 한쪽에만 거는 규칙이 아니다');

set local role service_role;
select is(
  (select count(*)::int from public.match_calculation_inputs((select match_id from matched))),
  0,
  '차단이 걸린 Match 는 **열쇠로도 안 열린다**');

reset role;
select * from finish();
rollback;
