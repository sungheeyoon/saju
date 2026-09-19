-- 공유 결과 — **동의한 그때의 여덟 글자로 나고, 상대의 입력은 어디로도 안 나간다.**
--
-- 여기서 재는 것은 한 문의 모양이다(ADR 0010 개정 · ADR 0071).
--
-- `my_match_scope` — 누가 볼 수 있는가. 당사자가 아니면 **없는 것과 같은 답**이고,
-- 제재·차단이 걸리면 내려간다. 나가는 것은 별명과 **동의 당시 여덟 글자 둘**뿐이다.
--
-- **계산 입력을 내주던 열쇠 문이 없어졌다**(#70). 그 문이 있던 까닭은 화면이 두 사람의
-- 명식을 서버에서 다시 계산했기 때문이고, 수락이 여덟 글자를 베껴 두면서 그 계산이
-- 통째로 사라졌다. 문이 없다는 것은 13번이 **열쇠의 허용 집합**으로 잰다.
--
-- 그리고 이 파일이 재는 가장 중요한 둘.
--
-- 1. **한쪽이 입력을 고쳐도 베껴 둔 여덟 글자는 움직이지 않는다.** 결과가 조용히 다른
--    값이 되면 무엇에 동의한 것인지 알 수 없다.
-- 2. **수락이 자동 생성 시도를 연다**(ADR 0038). 아무도 안 눌렀는데 청한 사람 이름으로
--    시도가 서 있고, 그 시도에 **얼린 한 벌**이 딸려 있다.
begin;
select plan(31);

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
create or replace function pg_temp.participant(
  mail text, who text, summary jsonb, day_stem text default '丙')
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  /**
   * **여덟 글자를 함께 넣는다**(ADR 0071). 안 넣으면 `person.current_chart` 가 빈 채로
   * 남고, 그러면 아래 「수락이 베꼈는가」가 `null = null` 로 언제나 통과한다 —
   * 아무것도 안 재는 시험이 된다.
   *
   * **사람마다 일간을 달리 준다.** 둘이 같은 여덟 글자를 들면 「누구 것을 베꼈나」를
   * 가릴 수 없다.
   */
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(day_stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
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
  pg_temp.participant('kim-res@example.com', '김결', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-res@example.com', '이결', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee,
  pg_temp.participant('choi-res@example.com', '최결', pg_temp.summary(0, 0, 0, 0, 8), '庚') as choi;
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
 * 지금 서 있는 여덟 글자 둘 — **수락이 베껴 둘 값**이다.
 *
 * `postgres` 로 잡는다. 남의 `app_user` 는 정책이 자기 행만 내주므로 시험 안에서
 * 당사자 역할로는 이 표를 만들 수 없다. 당사자 역할로는 상대의 `person` 도 못 읽는다 —
 * Match 는 엣지를 안 만들기 때문이다(US 46). 기대값을 그 자리에서 읽으려다 `null` 과
 * 견주는 시험이 될 뻔했다.
 */
create temporary table pinned as
select
  kim_person.id as kim_person,
  lee_person.id as lee_person,
  kim_person.current_chart as kim_chart,
  lee_person.current_chart as lee_chart
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

-- ── 수락이 **DB 안에서** 동의 당시 여덟 글자를 베낀다 (ADR 0071 · #68) ──────
--
-- 앱이 스냅샷을 수락에 넘기면 DB 는 그 값이 그 입력에서 나온 것인지 알 수 없다 —
-- ADR 0013 이 `save_reading` 에서 막아 둔 구멍을 다른 문에 다시 내는 일이다.
-- 그래서 값은 `person.current_chart` 에서 오고, 앱은 한 글자도 안 댄다.

reset role;

select is(
  (select m.chart_low = lo.current_chart and m.chart_high = hi.current_chart
   from public.match m
   join public.app_user low_user on low_user.id = m.user_low
   join public.person lo on lo.id = low_user.self_person_id
   join public.app_user high_user on high_user.id = m.user_high
   join public.person hi on hi.id = high_user.self_person_id
   where m.id = (select match_id from matched)),
  true,
  '수락 트랜잭션이 양쪽 여덟 글자를 person 에서 그대로 베꼈다');

/** 판 없는 스냅샷은 낡았는지 물을 수 없다 — 함께 적혀야 뜻이 있다 */
select is(
  (select chart_engine_low = 'chart-for-tests' and chart_engine_high = 'chart-for-tests'
   from public.match where id = (select match_id from matched)),
  true,
  '여덟 글자를 낸 엔진 판도 함께 적힌다');

/**
 * **상수를 베낀 것이 아니다.** 두 사람의 일간을 달리 주었으므로 두 칸이 달라야 한다 —
 * 같으면 「누구 것을 베꼈나」를 이 파일이 한 번도 안 재고 있는 것이다.
 */
select isnt(
  (select chart_low from public.match where id = (select match_id from matched)),
  (select chart_high from public.match where id = (select match_id from matched)),
  '두 사람의 여덟 글자가 서로 다르다');

/**
 * **앱이 댈 자리가 없다.** 인자는 요청 id 와 수락 여부 둘뿐이다 — 스냅샷을 받는 칸이
 * 생기는 순간 이 문은 「아무 여덟 글자나 매어 두는 문」이 된다.
 */
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'respond_to_match_request'
     and pg_get_function_arguments(p.oid) like '%chart%'),
  0,
  '수락 문은 여덟 글자를 인자로 안 받는다');

-- ── 수락이 **자동 생성 시도를 연다** (ADR 0038 · ADR 0071) ───────────────────
--
-- 동의가 예약된 풀이권을 쓴다. 이 자리가 조용히 안 돌면 Match 는 「동의는 났는데
-- 아무도 못 여는」 상태로 만료까지 남는다 — 누르는 화면이 없기 때문이다.

select is(
  (select count(*)::int from public.reading_run r
   where r.match_id = (select match_id from matched) and r.status = 'running'),
  1,
  '수락 트랜잭션이 시도를 연다 — 아무도 안 눌렀는데');

/** **청한 사람 이름으로 선다.** 받은 쪽 세션에서 일어나는 일이라 안 정해 주면 뒤집힌다 */
select is(
  (select r.user_id from public.reading_run r
   where r.match_id = (select match_id from matched) and r.status = 'running'),
  (select kim from folks),
  '시도는 청한 사람 이름으로 선다');

/**
 * **얼린 한 벌이 함께 선다**(ADR 0071). 제출하는 쪽이 읽을 재료가 여기 없으면 그
 * Match 는 빈 채로 남는다 — 그리고 그 값은 `person` 이 아니라 `match` 에서 온다.
 */
select is(
  (select j.status = 'frozen'
     and j.chart_a = m.chart_low and j.chart_b = m.chart_high
   from public.reading_job j
   join public.reading_run r on r.id = j.run_id
   join public.match m on m.id = r.match_id
   where r.match_id = (select match_id from matched)),
  true,
  '수락이 얼린 한 벌은 Match 의 여덟 글자를 그대로 든다');

set local role authenticated;
select pg_temp.acting((select lee from folks));

-- ── 읽는 길은 하나이고, 좁힘을 든 함수는 아무도 못 부른다 ───────────────────

/**
 * 좁힘을 든 함수는 **아무도 직접 못 부른다.** 목록과 결과 화면이 이것 하나 위에 서므로
 * 열어 두면 좁히기 전의 행을 그대로 읽는 길이 생긴다.
 */
select throws_ok(
  $$select 1 from public.visible_matches()$$,
  '42501', null, '내가 볼 수 있는 Match 를 고르는 함수는 직접 못 부른다');

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

/**
 * **보드에 설 값은 저장된 스냅샷이다**(ADR 0071). 앞서는 서버가 열쇠로 상대의 계산
 * 입력을 읽어 여덟 글자를 계산했다 — 이제 동의 때 베껴 둔 것을 그대로 낸다.
 */
select is(
  (select my_chart from public.my_match_scope((select match_id from matched))),
  (select lee_chart from pinned),
  '내 자리에는 내 여덟 글자가 나온다');

select is(
  (select partner_chart from public.my_match_scope((select match_id from matched))),
  (select kim_chart from pinned),
  '상대 자리에는 상대의 여덟 글자가 나온다');

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
  (select my_chart from public.my_match_scope((select match_id from matched))),
  (select kim_chart from pinned),
  '내 자리에는 언제나 내 여덟 글자가 선다 — 자리가 뒤집혀도 섞이지 않는다');

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

-- ── 입력을 고쳐도 베껴 둔 여덟 글자는 움직이지 않는다 ────────────────────────
select pg_temp.acting((select lee from folks));

/** 일간까지 갈리게 고친다 — 안 그러면 「안 움직인다」를 한 번도 안 재고 통과한다 */
select lives_ok(
  format($$select public.add_person_revision(%L::uuid,
    'solar', '1990-05-15', '1990-05-15', '15:45', 'female', '서울', 'jo', 'localMean',
  tests.chart('壬'), 'chart-for-tests')$$,
    (select lee_person from pinned)),
  '이결이 출생 시각을 고친다');

select isnt(
  (select current_chart from public.person where id = (select lee_person from pinned)),
  (select lee_chart from pinned),
  '지금 Person 의 여덟 글자는 실제로 달라졌다');

select is(
  (select my_chart from public.my_match_scope((select match_id from matched))),
  (select lee_chart from pinned),
  '**결과는 여전히 동의한 그때의 여덟 글자를 든다**');

select is(
  (select count(*)::int from public.my_matches()),
  1,
  '성립한 Match 는 입력 수정으로 사라지지 않는다 — 무효가 되는 것은 pending 뿐이다');

-- ── 제재는 결과보다 세다 ─────────────────────────────────────────────────────
reset role;
update public.app_user set status = 'suspended' where id = (select kim from folks);

set local role authenticated;
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_match_scope((select match_id from matched))),
  0,
  '중지된 계정과의 Match 는 내려간다');

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

reset role;
select * from finish();
rollback;
