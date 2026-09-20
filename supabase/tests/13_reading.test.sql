-- 현재 AI 결과 — **대상마다 하나, 성공한 요청만 교체, 이전 결과는 없다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **표는 한 줄도 안 보인다.** 근거와 프롬프트가 그 안에 있다.
-- 2. **kind 마다 접근 판정이 다르고 서로를 열지 않는다.** 내 엣지에 없는 사람으로
--    비공개 궁합을 만들 수 없고, Match 는 동의가 연 시도로만 난다.
-- 3. **교체는 통째로 일어난다.** 같은 대상에 두 번 저장해도 행은 하나이고 옛 값은
--    어디에도 남지 않는다.
-- 4. **되짚을 여덟 글자를 든다**(ADR 0071). 저장이 얼린 작업의 값을 글에 옮겨 적고,
--    「이전 명식으로 쓴 글」인지는 그 값으로만 판정한다 — 앱은 한 글자도 안 댄다.
-- 5. **열쇠가 부를 수 있는 문이 값으로 세어진다.** 판본을 내주던 문 둘이 여기서 빠진다.
begin;
select plan(73);

/**
 * **이 파일은 풀이권을 재지 않는다.**
 *
 * 한 사람이 대상 여럿에 시도를 여는 것이 여기서 재려는 것인데, 폐쇄 베타의 풀이권은
 * 다섯이라 파이프라인을 다 밟기 전에 걸린다. 그 거절은 이 파일이 재는 것이 아니고,
 * 16번이 따로 잰다.
 *
 * 값을 올려 두는 것으로 지나간다 — 트랜잭션이 되돌아가므로 다른 파일에는 남지 않는다.
 * 검사 자체를 끄지 않는 것이 중요하다. 끄면 이 파일의 어느 줄이 풀이권을 건드리는지도
 * 모르게 되고, 그때 16번은 이 파일이 이미 지나온 길을 처음부터 다시 봐야 한다.
 */
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $limit$ select 100 $limit$;

/** 다섯 오행 개수만 주면 요약 한 벌이 된다(11번 시험과 같은 손잡이) */
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

create or replace function pg_temp.participant(
  mail text, who text, summary jsonb, day_stem text default '丙')
returns uuid
language plpgsql
as $$
declare
  uid uuid := tests.signup(mail);
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
  /** 여덟 글자를 함께 넣는다(ADR 0071) — 없으면 아래 스냅샷 시험이 `null` 끼리 견준다 */
  perform public.create_self_person(
    '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart(day_stem), 'chart-for-tests');
  perform public.save_my_profile(who, null);
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
 * 결과 한 벌을 저장한다 — **열쇠인 척한다.**
 *
 * `save_reading` 은 `authenticated` 에게 닫혀 있다(ADR 0013). `security definer` 로
 * 감싸 소유자 권한으로 부르는 것은 서버가 열쇠로 부르는 것과 같은 자리다. 닫혀 있다는
 * 사실 자체는 아래에서 따로 잰다.
 *
 * 대상을 인자로 받지 않는다 — 시도 하나가 곧 대상이다.
 */
create or replace function pg_temp.save(
  run uuid, body text, score smallint)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, body, score, '두 사람이 같은 속도로 걷는 모양입니다.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-read@example.com', '김읽', pg_temp.summary(4, 4, 0, 0, 0), '丙') as kim,
  pg_temp.participant('lee-read@example.com', '이읽', pg_temp.summary(0, 0, 4, 4, 0), '戊') as lee,
  pg_temp.participant('choi-read@example.com', '최읽', pg_temp.summary(0, 0, 0, 0, 8), '庚') as choi;
grant select on folks to authenticated, service_role;

-- 김이 가족을 하나 등록한다 — 비공개 궁합의 대상이다.
select pg_temp.acting((select kim from folks));
create temporary table mine as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
,
  tests.chart(), 'chart-for-tests') as mom;
grant select on mine to authenticated, service_role;

reset role;

/** 다른 시험이 남긴 참여자는 이 파일의 관심 밖이다(10·11번과 같은 이유) */
update public.discovery_profile set opted_in_at = null, opted_out_at = now()
where user_id not in (select uid from (
  select kim as uid from folks union all select lee from folks
  union all select choi from folks) ours);

create temporary table people as
select
  kim_person.id as kim_person,
  lee_person.id as lee_person
from folks
join public.app_user kim_user on kim_user.id = folks.kim
join public.app_user lee_user on lee_user.id = folks.lee
join public.person kim_person on kim_person.id = kim_user.self_person_id
join public.person lee_person on lee_person.id = lee_user.self_person_id;
grant select on people to authenticated, service_role;

set local role authenticated;

-- ── 표도 좁힘도 직접 열리지 않는다 ──────────────────────────────────────────

select throws_ok(
  $$select 1 from public.reading$$,
  '42501', null, '결과 표는 한 줄도 직접 안 보인다');

select throws_ok(
  $$select 1 from public.reading_run$$,
  '42501', null, '시도 기록도 직접 안 보인다');

/**
 * 대상을 푸는 함수는 아무도 직접 못 부른다. 열어 두면 **남의 Person id 를 넣어 그
 * 사람이 실재하는지 묻는 문**이 된다.
 */
select throws_ok(
  $$select 1 from public.reading_scope('self')$$,
  '42501', null, '대상을 푸는 함수는 직접 못 부른다');

/**
 * **저장은 브라우저가 못 두드린다**(ADR 0013).
 *
 * 열려 있으면 로그인한 사람이 모델·redaction·출력 검사를 다 건너뛰고 임의의 글과
 * 점수를 저장할 수 있고, Match 에서는 그 글이 상대에게 간다 — 안전 운영이 검증되기
 * 전에는 열지 않기로 한 통로가 뒷문으로 생긴다.
 */
select throws_ok(
  $$select public.save_reading(
      '00000000-0000-0000-0000-000000000000'::uuid, 'x', null, null,
      '{}', 'p', 'v', 'm', '{}'::jsonb, now())$$,
  '42501', null, '결과를 저장하는 문은 로그인한 사람이 못 부른다');

select throws_ok(
  $$select * from public.reading_scope_for(null, 'self', null, null, null)$$,
  '42501', null, '사용자를 넣는 내부 좁힘도 직접 못 부른다');

-- ── 자기 풀이 ───────────────────────────────────────────────────────────────

select pg_temp.acting((select kim from folks));

select is(
  (select count(*)::int from public.my_reading('self')),
  0,
  '아직 만들지 않았으면 결과가 없다');

create temporary table run_self as
select run_id as id from public.start_reading_run('self', 'key-self-0001');
grant select on run_self to authenticated, service_role;

select isnt((select id from run_self), null, '자기 풀이 요청이 선다');

/**
 * **같은 열쇠로 두 번 시작하지 않는다.** 네트워크 재시도가 현재 결과를 두 번
 * 갈아치우면 「한 요청에 한 교체」가 거짓이 된다.
 */
select is(
  (select count(*)::int from public.start_reading_run('self', 'key-self-0001')),
  0,
  '같은 열쇠로 다시 시작하면 아무것도 시작되지 않는다');

/**
 * **같은 대상에 도는 시도는 하나다.**
 *
 * 두 번 누르면 모델이 두 번 불리고 현재 결과가 두 번 갈아치워진다 — 그러면 사용자가
 * 방금 읽던 글이 사라진다. 열쇠가 달라도 막혀야 한다: 서버가 누를 때마다 새 열쇠를
 * 짓기 때문에, 열쇠만으로는 아무것도 안 막힌다.
 */
select is(
  (select count(*)::int from public.start_reading_run('self', 'key-self-other-0001')),
  0,
  '앞의 시도가 도는 동안에는 다른 열쇠로도 시작되지 않는다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, '## 한 줄로', null)$$,
    (select id from run_self)),
  '자기 풀이가 저장된다');

select is(
  (select output from public.my_reading('self')),
  '## 한 줄로',
  '저장한 글이 그대로 선다');

select is(
  (select score from public.my_reading('self')),
  null::smallint,
  '자기 풀이에는 점수가 붙지 않는다');

select is(
  (select from_current_chart from public.my_reading('self')),
  true,
  '지금 명식으로 난 결과다');

/** 근거와 프롬프트는 **다른 문**으로만 나간다 */
select is(
  (select prompt_version from public.my_reading_artifacts('self')),
  'reading-prompt-v1',
  '근거와 프롬프트는 내부 문으로 나간다');

-- ── 교체는 통째로 일어나고 이전 결과는 남지 않는다 ──────────────────────────

create temporary table run_again as
select run_id as id from public.start_reading_run('self', 'key-self-0002');
grant select on run_again to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, '## 다시 썼다', null)$$,
    (select id from run_again)),
  '같은 대상을 다시 만들 수 있다');

select is(
  (select count(*)::int from public.my_reading('self')),
  1,
  '대상 하나에 결과도 하나다');

select is(
  (select output from public.my_reading('self')),
  '## 다시 썼다',
  '새 글이 옛 글을 덮는다');

reset role;
select is(
  (select count(*)::int from public.reading where output = '## 한 줄로'),
  0,
  '덮인 글은 어디에도 남지 않는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 동결 뒤의 수정은 이미 시작된 생성을 안 건드린다 ─────────────────────────

create temporary table run_stale as
select run_id as id from public.start_reading_run('self', 'key-self-0003');
grant select on run_stale to authenticated, service_role;

select public.add_person_revision(
  (select kim_person from people),
  'solar', '1990-05-15', '1990-05-15', '15:30', 'female', '서울', 'jo', 'localMean',
  tests.chart('丁'), 'chart-for-tests');

/**
 * **문에서 재고 출구에서는 안 잰다** (ADR 0071).
 *
 * 앞서는 여기서 「만드는 동안 출생정보가 바뀌었습니다」로 거절했다. 그 검사를 걷는다 —
 * 정상적으로 동결된 최초 생성은 그 뒤 입력이 바뀌어도 완료·저장한다.
 *
 * 걷는 이유는 인연 궁합에서 분명하다. 동의가 나고 풀이권까지 예약된(ADR 0038) 자리에서
 * 완성된 글을 버리면, 그것이 바로 **「동의는 났는데 아무도 못 여는 Match」**다.
 *
 * 버리는 대신 **당시 입력으로 쓴 글이라고 적는다** — 그 말을 할 수 있으면 버릴 이유가 없다.
 */
select lives_ok(
  format($$select pg_temp.save(%L::uuid, '## 낡은 명식', null)$$,
    (select id from run_stale)),
  '동결 뒤에 입력을 고쳐도 이미 시작된 생성은 저장된다');

select is(
  (select output from public.my_reading('self')),
  '## 낡은 명식',
  '완성된 글을 버리지 않는다');

select is(
  (select from_current_chart from public.my_reading('self')),
  false,
  '대신 「이전 명식으로 쓴 글」이라고 적는다');

select is(
  (select status from public.my_last_reading_run('self')),
  'succeeded',
  '동결된 최초 생성은 끝까지 간다');

-- ── 되짚는 것은 입력이 아니라 **여덟 글자**다 (ADR 0071 · #68) ───────────────

/**
 * **글이 생성 당시 여덟 글자를 직접 든다.**
 *
 * 판본 id 를 가리키던 자리다. 판본을 지우면 그 id 는 아무것도 안 가리키므로, 되짚을
 * 값을 **값으로** 든다 — 그 값으로 하는 일은 둘뿐이다: 지금 명식과 견주는 것, 그리고
 * 동의로 열린 여덟 글자를 보여주는 것.
 */
reset role;
select is(
  (select r.chart_a from public.reading r
   where r.kind = 'self' and r.owner_user_id = (select kim from folks)),
  tests.chart('丙'),
  '저장이 얼린 작업의 여덟 글자를 글에 옮겨 적는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

/**
 * **입력 표현이 달라도 여덟 글자가 같으면 지금 명식이다.**
 *
 * 출생지를 서울에서 부산으로 고치면 입력 판은 오르지만 여덟 글자는 그대로일 수 있다.
 * 앞서는 그때 화면이 「이전 입력」이라 적었다 — **한쪽으로 거짓말하던 자리다.** 화면이
 * 하려는 말은 「이전 명식」이므로 여덟 글자로 견주는 쪽이 맞다.
 */
select public.add_person_revision(
  (select kim_person from people),
  'solar', '1990-05-15', '1990-05-15', '15:30', 'female', '부산', 'jo', 'localMean',
  tests.chart('丙'), 'chart-for-tests');

select is(
  (select from_current_chart from public.my_reading('self')),
  true,
  '입력을 고쳐도 여덟 글자가 같으면 지금 명식이다 — 거짓말하던 자리가 고쳐졌다');

-- ── 비공개 궁합 — 내 엣지에 있는 두 사람만 ──────────────────────────────────

create temporary table run_private as
select run_id as id from public.start_reading_run(
  'private', 'key-priv-0001', (select mom from mine), (select kim_person from people));
grant select on run_private to authenticated, service_role;

/**
 * **차례는 DB 가 정한다.** 부르는 쪽이 어느 쪽을 앞에 적든 같은 대상 하나여야 한다 —
 * 아니면 같은 두 사람에 결과가 둘 생긴다.
 */
/**
 * **여덟 글자도 사람 차례를 따라간다**(작은 Person id 가 앞). 저장하는 문이 얼린
 * 작업에서 그대로 읽으므로 부르는 쪽이 차례를 고를 자리가 없다.
 */
select lives_ok(
  format($$select pg_temp.save(%L::uuid, '## 둘 사이', 71::smallint)$$,
    (select id from run_private)),
  '비공개 궁합이 저장된다');

select is(
  (select score from public.my_reading(
    'private', (select kim_person from people), (select mom from mine))),
  71::smallint,
  '순서를 뒤집어 물어도 같은 결과 하나다');

/** 내 엣지에 없는 사람은 **없는 것과 같은 답**이다 */
select is(
  (select count(*)::int from public.my_reading(
    'private', (select kim_person from people), (select lee_person from people))),
  0,
  'Match 상대는 비공개 궁합의 대상이 아니다');

select throws_ok(
  format($$select * from public.start_reading_run('private', 'key-priv-0002', %L::uuid, %L::uuid)$$,
    (select kim_person from people), (select lee_person from people)),
  '23514', null, '못 보는 대상으로는 요청을 시작할 수 없다');

-- ── 공유 궁합 — 매인 판본으로만 나고 양쪽이 같은 것을 본다 ──────────────────

/**
 * 위에서 김이 입력을 고쳤으므로 내놓은 오행 요약이 낡았다 — 낡으면 후보가 아니다
 * (ADR 0003 「이행」). 요약을 지금 판본의 것으로 다시 내놓아야 청할 수 있다.
 */
select public.ensure_discovery_participation(
  (select kim_person from people), pg_temp.summary(4, 4, 0, 0, 0));

-- 요청은 **노출 기록에 매인다**(ADR 0009). 목록을 먼저 열어야 청할 수 있다.
select lives_ok($$select count(*) from public.my_discovery_board()$$, '김이 후보 목록을 연다');

create temporary table asked as
select public.request_match((select lee from folks)) as request_id;
grant select on asked to authenticated, service_role;

/**
 * **요청이 자리를 잡는다** (ADR 0038). 원장은 없다 — `pending` 인 내 요청을 세는 것이
 * 곧 예약이다. 이 자리는 아직 아무도 안 눌렀는데 잔액이 하나 줄어 있어야 한다.
 */
select is(
  (select requested from public.my_reading_credits()),
  1,
  '보낸 요청이 풀이권 한 자리를 잡는다');

select pg_temp.acting((select lee from folks));
select is(
  public.respond_to_match_request((select request_id from asked), true),
  'accepted',
  '수락하면 Match 가 선다');

create temporary table matched as select match_id from public.my_matches();
grant select on matched to authenticated, service_role;

/**
 * **수락이 시도를 이미 열었다** — 요청자 이름으로(ADR 0038).
 *
 * 여기서 `start_reading_run` 을 부르던 자리다. 이제는 부를 것이 없다: 같은 대상에 도는
 * 시도는 하나이므로 0행이 오고, 그 0행으로 저장하려 들면 「기록할 시도를 찾지
 * 못했습니다」가 난다. 동의가 예약을 쓰는 것이 이 ADR 의 전부다.
 *
 * `reading_run` 은 당사자에게도 안 열리므로 소유자로 읽는다 — 재려는 것은 열람이
 * 아니라 **누구 이름으로 섰는가**다.
 */
reset role;
create temporary table run_match as
select r.id, r.user_id
from public.reading_run r
where r.match_id = (select match_id from matched) and r.status = 'running';
grant select on run_match to authenticated, service_role;
set local role authenticated;
select pg_temp.acting((select lee from folks));

select is(
  (select count(*)::int from run_match),
  1,
  '수락이 시도를 연다 — 아무도 안 눌렀는데');

/**
 * **예약이 사용으로 옮겨 간다.** `pending` 이 `accepted` 가 되면서 셈에서 빠지고, 그
 * 자리를 새 `running` 시도가 이어받는다 — 합계는 그대로다. 빼고 더하는 일이 아니라
 * **같은 자리를 다른 이름으로 세는 일**이다.
 */
select pg_temp.acting((select kim from folks));
select is(
  (select array[reserved, requested] from public.my_reading_credits()),
  array[1, 0],
  '수락이 예약을 사용으로 옮긴다');
select pg_temp.acting((select lee from folks));

/**
 * **요청자 것이다.** 수락은 받은 쪽 세션에서 일어나므로 `auth.uid()` 로 actor 를 정하는
 * 문을 그대로 부르면 시도가 받은 쪽 것으로 서고, 풀이권도 그쪽에서 나간다.
 */
select is(
  (select user_id from run_match),
  (select kim from folks),
  '시도는 청한 사람 이름으로 선다');

/** 받은 쪽은 누를 것이 없다 — 같은 대상에 도는 시도가 이미 하나 있다 */
select is(
  (select count(*)::int from public.start_reading_run(
    'match', 'key-match-0001', null, null, (select match_id from matched))),
  0,
  '동의한 쪽이 눌러도 아무것도 새로 열리지 않는다');

/**
 * **앱이 계산 입력을 고르는 자리가 없어졌다** (ADR 0071).
 *
 * 앞서는 지금 판본을 적어 넣는 길이 있어서, 저장하는 문이 「매인 판본인가」를 출구에서
 * 다시 재야 했다. 이제 그 값은 시도를 여는 트랜잭션에서 얼었고 문은 얼린 작업에서
 * 읽는다 — 물음 자체가 없어졌으므로 **한 벌만 서 있는지**를 잰다. 두 벌이던 잠깐은
 * #70 이 좁히면서 끝났다.
 */
select is(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'save_reading'),
  1,
  '저장하는 문은 한 벌이고 판본을 인자로 안 받는다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, '## 공유 궁합', 64::smallint)$$,
    (select id from run_match)),
  '동의가 연 시도로 저장된다');

select is(
  (select output from public.my_reading('match', null, null, (select match_id from matched))),
  '## 공유 궁합',
  '수락한 쪽이 공유 결과를 읽는다');

select pg_temp.acting((select kim from folks));
select is(
  (select output from public.my_reading('match', null, null, (select match_id from matched))),
  '## 공유 궁합',
  '청한 쪽도 같은 글을 읽는다');

/**
 * **차례는 보는 사람마다 뒤집히지 않는다.** 「첫 번째 분」이 누구인지가 보는 사람에
 * 따라 달라지면 두 사람이 서로 다른 글을 읽는 것이 된다.
 */
create temporary table seen_by_kim as
select viewer_is_first from public.my_reading(
  'match', null, null, (select match_id from matched));
grant select on seen_by_kim to authenticated, service_role;

select pg_temp.acting((select lee from folks));
create temporary table seen_by_lee as
select viewer_is_first from public.my_reading(
  'match', null, null, (select match_id from matched));
grant select on seen_by_lee to authenticated, service_role;

select isnt(
  (select viewer_is_first from seen_by_kim),
  (select viewer_is_first from seen_by_lee),
  '누가 앞인지는 Match 가 정하고 보는 사람마다 뒤집히지 않는다');

-- ── 인연 궁합의 원문 근거는 운영자만 (ADR 0068) ──────────────────────────────

/**
 * **본문은 당사자가 읽고, 근거·프롬프트·생성 설정은 못 읽는다.** 저장된 근거에는 상대의
 * 명식이 들고 옛 컷은 상대의 억부 후보·성별까지 든다. 화면이 아니라 문에서 막는지를 잰다 —
 * 그래서 RPC 를 직접 부른다.
 */
select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_reading_artifacts('match', null, null, (select match_id from matched))),
  0,
  '인연 궁합 당사자(받은 쪽)는 근거·프롬프트를 못 읽는다');

select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_reading_artifacts('match', null, null, (select match_id from matched))),
  0,
  '청한 쪽도 못 읽는다');

select is(
  (select output from public.my_reading('match', null, null, (select match_id from matched))),
  '## 공유 궁합',
  '본문은 그대로 읽는다');

/** 다른 kind 는 그대로다 — 내가 넣은 자료의 근거는 내가 읽는다 */
select is(
  (select count(*)::int from public.my_reading_artifacts('self')),
  1,
  '자기 풀이 근거는 여전히 본인에게 열린다');

select is(
  (select count(*)::int from public.my_reading_artifacts(
    'private', (select kim_person from people), (select mom from mine))),
  1,
  '비공개 궁합 근거도 여전히 열린다');

select pg_temp.acting((select choi from folks));
select is(
  (select count(*)::int from public.my_reading_artifacts('match', null, null, (select match_id from matched))),
  0,
  '무관한 사용자는 못 읽는다');

/**
 * **운영자여도 범위는 그대로다.** 당사자가 아닌 운영자에게 모든 Match 의 근거를 여는 권한을
 * 새로 만들지 않았는지 — 운영자를 세운 뒤에 다시 묻는다.
 */
set local role postgres;
insert into public.operator (user_id, note)
values ((select choi from folks), '시험 — 당사자가 아닌 운영자'),
       ((select kim from folks), '시험 — 당사자인 운영자');
set local role authenticated;

select pg_temp.acting((select choi from folks));
select is(
  (select count(*)::int from public.my_reading_artifacts('match', null, null, (select match_id from matched))),
  0,
  '당사자가 아닌 운영자는 여전히 못 읽는다');

select pg_temp.acting((select kim from folks));
select is(
  (select prompt_version from public.my_reading_artifacts('match', null, null, (select match_id from matched))),
  'reading-prompt-v1',
  '당사자인 운영자는 읽는다');

/** 바깥문 — 익명에게는 함수 자체가 닫혀 있다. 대상 id 는 임시 표에서 읽으므로 그 표만 연다 */
grant select on matched to anon;
set local role anon;
select throws_ok(
  format($$select * from public.my_reading_artifacts('match', null, null, %L::uuid)$$,
    (select match_id from matched)),
  '42501', null, '익명은 근거 문을 부를 수 없다');
set local role authenticated;

-- ── 인연 궁합의 근거 절도 본문 조회로 안 나간다 (ADR 0069) ──────────────────

/**
 * ADR 0068 이 「남은 길」로 적어 둔 자리다. 근거 **자료**는 막았는데 `my_reading.output` 에
 * 붙은 `### 근거 (검사용)` 절은 그대로 나갔다 — 그 절은 모델이 받은 경로를 인용하므로
 * 옛 컷에서는 상대의 억부 후보가 적힐 수 있다.
 *
 * 저장된 원문은 그대로 두고 **내주는 자리에서만** 자른다. 그래서 여기서 원문을 근거 절이
 * 붙은 모양으로 바꿔 놓고, 당사자가 무엇을 받는지 잰다.
 */
reset role;
update public.reading
set output = E'## 공유 궁합\n\n### 근거 (검사용)\n\n첫 절 — 결론 「서로 끌린다」 | 자료: compatibility.eokbuMatch [후보]'
where match_id = (select match_id from matched);
set local role authenticated;

/** 이는 운영자가 아니다 — 위에서 운영자로 세운 것은 김(당사자)과 최(당사자 아님)뿐이다 */
select pg_temp.acting((select lee from folks));
select is(
  (select position('### 근거' in output) > 0
   from public.my_reading('match', null, null, (select match_id from matched))),
  false,
  '인연 궁합 당사자에게는 근거 절이 안 나간다');

select is(
  (select output from public.my_reading('match', null, null, (select match_id from matched))),
  '## 공유 궁합',
  '본문은 그대로 읽는다 — 자르는 것은 근거 절뿐이다');

select is(
  (select count(*)::int from public.match_reading_source((select match_id from matched))),
  0,
  '운영자가 아닌 당사자는 원문을 못 읽는다');

/** **둘 다 본다** — 운영자이면서 그 Match 의 당사자일 때만 열린다 */
select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.match_reading_source((select match_id from matched))),
  1,
  '당사자인 운영자는 원문을 읽는다');

select is(
  (select position('### 근거' in output) > 0
   from public.match_reading_source((select match_id from matched))),
  true,
  '그 원문에는 근거 절이 그대로 있다');

select is(
  (select position('### 근거' in output) > 0
   from public.my_reading('match', null, null, (select match_id from matched))),
  false,
  '운영자라도 본문 조회로는 근거 절이 안 온다 — 문이 다르다');

select pg_temp.acting((select choi from folks));
select is(
  (select count(*)::int from public.match_reading_source((select match_id from matched))),
  0,
  '당사자가 아닌 운영자는 원문을 못 읽는다');

set local role anon;
select throws_ok(
  format($$select * from public.match_reading_source(%L::uuid)$$, (select match_id from matched)),
  '42501', null, '익명은 원문 문을 부를 수 없다');
set local role authenticated;

/**
 * 자르는 규칙은 앱의 `readingBody` 와 **같은 정규식**이다. 그 규칙 자체를 여기서도 재 둔다 —
 * 두 자리에서 따로 자르면 갈리고, 갈리면 열려 있는 쪽이 사용자 쪽이다.
 */
reset role;
select is(
  public.reading_user_body(E'## 본문만 있다\n\n두 줄째'),
  E'## 본문만 있다\n\n두 줄째',
  '근거 절이 없으면 원문 그대로다');

select is(
  public.reading_user_body(E'## 본문\n\n한 줄\n\n### 근거\n\n- 무엇 [사실]'),
  E'## 본문\n\n한 줄',
  '「### 근거」도 「### 근거 (검사용)」과 같은 자리에서 자른다');
set local role authenticated;

/**
 * 알림은 **시도를 연 사람의 상대에게만** 선다.
 *
 * 「누른 사람은 그 자리에서 본다」가 이 규칙의 이유였는데, 이제 공유 궁합에서는 아무도
 * 안 누른다 — 동의가 연다(ADR 0038). 시도는 **청한 사람(김)** 것으로 서므로 준비 완료는
 * **이**에게 간다. 방향이 뒤집힌 것이 아니라, 여는 사람이 바뀐 것이다.
 */
select pg_temp.acting((select kim from folks));
select is(
  (select count(*)::int from public.my_notifications() n where n.kind = 'reading_ready'),
  0,
  '시도를 연 쪽에는 알림이 서지 않는다');

select pg_temp.acting((select lee from folks));
select is(
  (select count(*)::int from public.my_notifications() n where n.kind = 'reading_ready'),
  1,
  '상대에게 준비 완료가 한 번 선다');

/**
 * **이름을 Match 로 찾는다.** 이 사건은 요청을 들지 않으므로 예전 길로는 별명이 안
 * 나오고, 알림함이 사람을 못 부르는 문장으로 선다.
 */
select is(
  (select counterpart_nickname from public.my_notifications() n where n.kind = 'reading_ready'),
  '김읽',
  '준비 완료 알림이 상대 별명을 든다');

/**
 * **그날이 왔다.** 만드는 일이 누름에서 떨어져 나온 뒤로(ADR 0016) 생성은 요청과 같은
 * 왕복에서 끝나지 않는다. 탭을 닫으면 실패를 말할 화면이 없으므로 알림함이 그 자리를
 * 멘다.
 */
reset role;
select is(
  (select count(*)::int from pg_constraint
   where conname = 'notification_kind_check'
     and pg_get_constraintdef(oid) like '%reading_failed%'),
  1,
  '실패는 이제 일어나는 사건이라 검사식에 있다');
set local role authenticated;

-- ── 실패는 누른 사람에게 선다 ──────────────────────────────────────────────

/**
 * 김에게는 이미 실패 알림이 하나 있다 — 위에서 「만드는 동안 입력이 바뀌어」 거절당한
 * 시도를 닫았고, 그것도 실패다. **여기서 세는 것은 늘어나는가와 안 늘어나는가**이지
 * 절대 개수가 아니다.
 */
select pg_temp.acting((select kim from folks));

create temporary table failed_before as
select count(*)::int as n from public.my_notifications() where kind = 'reading_failed';
grant select on failed_before to authenticated, service_role;

create temporary table run_told as
select run_id as id from public.start_reading_run('self', 'key-self-fail-0001');
grant select on run_told to authenticated, service_role;

select public.fail_reading_run((select id from run_told), 'model-call-failed', '모델이 안 왔다');

select is(
  (select count(*)::int from public.my_notifications() where kind = 'reading_failed'),
  (select n + 1 from failed_before),
  '실패하면 누른 사람 알림함에 한 줄이 선다');

/**
 * **실패는 사람이 아니라 대상으로 알아본다.** 자기 풀이에는 부를 상대가 없으므로,
 * 어느 것이 실패했는지는 시도가 든 대상에서만 나온다. 하나라도 그것을 못 들면
 * 그 줄은 「무언가 안 됐다」로 끝나 어디를 다시 눌러야 할지 말하지 못한다.
 */
select is(
  (select count(*)::int from public.my_notifications() n
   where n.kind = 'reading_failed' and n.reading_kind is distinct from 'self'),
  0,
  '실패 알림이 저마다 무엇을 만들다 실패했는지 든다');

/**
 * **만료로 닫히는 것은 알리지 않는다.**
 *
 * 끝나지 못한 시도는 다음 누름이 여는 자리에서 쓸려 닫힌다(`expired`). 그 자리에
 * 알림을 세우면 **지금 막 누른 사람에게 옛 실패를 알리는 줄**이 남는다 — 그 사람은
 * 이미 그 화면에 서 있다.
 */
create temporary table run_abandoned as
select run_id as id from public.start_reading_run('self', 'key-self-stale-0001');
grant select on run_abandoned to authenticated, service_role;

-- 만료 너머로 밀어 둔다. 서버가 죽어 아무도 못 닫은 시도와 같은 모양이다.
reset role;
update public.reading_run set created_at = created_at - interval '11 minutes'
where id = (select id from run_abandoned);
set local role authenticated;
select pg_temp.acting((select kim from folks));

create temporary table run_after as
select run_id as id from public.start_reading_run('self', 'key-self-newer-0001');
grant select on run_after to authenticated, service_role;

select is(
  (select count(*)::int from public.my_notifications() where kind = 'reading_failed'),
  (select n + 1 from failed_before),
  '만료로 쓸려 닫힌 시도는 알리지 않는다');

/**
 * **늦게 돌아온 호출은 이 문에 못 들어온다.** 그 시도는 이미 만료로 닫혔으므로
 * 0행을 만난다 — 그래서 「더 나중 시도가 있나」를 여기서 다시 묻지 않는다.
 */
select throws_ok(
  format($$select public.fail_reading_run(%L::uuid, 'closed')$$,
    (select id from run_abandoned)),
  'P0002', null, '이미 닫힌 시도는 다시 닫히지 않는다');

-- 도는 것을 남기지 않는다. 다음 시험이 같은 대상으로 시도를 연다.
select public.fail_reading_run((select id from run_after), 'model-no-output', '모양이 아니다');

-- ── 늦게 돌아온 호출은 새 결과를 덮지 않는다 ────────────────────────────────

/**
 * **뒤늦은 저장을 거절한다.**
 *
 * 첫 호출이 오래 걸리는 동안 새 시도가 열려 성공하면, 늦게 돌아온 첫 호출이 그 글을
 * 옛 글로 되돌릴 수 있었다. 시도를 여는 차례가 곧 우선순위다.
 */
select pg_temp.acting((select kim from folks));

create temporary table run_first as
select run_id as id from public.start_reading_run('self', 'key-self-late-0001');
grant select on run_first to authenticated, service_role;

-- 첫 시도를 닫아 두어야 둘째가 열린다(같은 대상에 도는 시도는 하나다).
reset role;
update public.reading_run set status = 'failed', failure_code = 'expired'
where id = (select id from run_first);
set local role authenticated;
select pg_temp.acting((select kim from folks));

create temporary table run_second as
select run_id as id from public.start_reading_run('self', 'key-self-late-0002');
grant select on run_second to authenticated, service_role;

reset role;
-- 첫 시도를 다시 도는 것으로 되돌린다 — 늦게 돌아온 호출을 흉내 낸다.
update public.reading_run set status = 'running', failure_code = null
where id = (select id from run_first);
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  format($$select pg_temp.save(%L::uuid, '## 늦게 돌아왔다', null)$$,
    (select id from run_first)),
  '23514', null, '그 사이에 새 시도가 열렸으면 늦은 저장을 거절한다');

select is(
  (select output from public.my_reading('self')),
  '## 낡은 명식',
  '거절당한 저장이 현재 결과를 건드리지 않는다');

-- ── 시작 뒤 자격이 사라지면 저장도 멈춘다 ────────────────────────────────────

/**
 * 시도 행은 대상의 증표이지 **십 분짜리 자격 임대권이 아니다.** 모델이 도는 동안 상대가
 * 차단했으면 새 공유 결과와 알림을 그 뒤에 만들 수 없어야 한다.
 */
create temporary table run_blocked_match as
select run_id as id from public.start_reading_run(
  'match', 'key-match-blocked-0001', null, null, (select match_id from matched));
grant select on run_blocked_match to authenticated, service_role;

reset role;
insert into public.block (user_id, blocked_user_id)
values ((select lee from folks), (select kim from folks));
set local role authenticated;
select pg_temp.acting((select kim from folks));

select throws_ok(
  format($$select pg_temp.save(%L::uuid, '## 차단 뒤 결과', 63::smallint)$$,
    (select id from run_blocked_match)),
  'P0002', null, '만드는 동안 차단되면 공유 결과를 저장하지 않는다');

/** 계정 제재도 같은 자격 질문을 지난다. */
select pg_temp.acting((select choi from folks));
create temporary table run_suspended_self as
select run_id as id from public.start_reading_run('self', 'key-self-suspended-0001');
grant select on run_suspended_self to authenticated, service_role;

reset role;
update public.app_user set status = 'suspended' where id = (select choi from folks);
set local role authenticated;
select pg_temp.acting((select choi from folks));

select throws_ok(
  format($$select pg_temp.save(%L::uuid, '## 제재 뒤 결과', null)$$,
    (select id from run_suspended_self)),
  'P0002', null, '만드는 동안 계정이 중지되면 자기 풀이도 저장하지 않는다');

-- 열쇠의 허용 집합은 설명이 아니라 실제 ACL 로 센다.
-- 만드는 일이 요청을 떠나면서 넷이 늘었고(ADR 0020) — 실패를 닫는 문, 도착을 적는 문,
-- 일감을 집는 문, 집었다 놓는 문 — 엔진 판을 따라가는 운영 문이 하나 더 늘었다
-- (ADR 0071). 그 수를 여기서 세지 않으면 다음에 문이 늘어도 아무도 모른다.
--
-- **여기서 셋이 빠졌다**(#70). 상대의 계산 입력을 내주던 `match_calculation_inputs`,
-- 응답 뒤에 입력을 얼리던 옛 `freeze_reading_job`, 그리고 두 벌이던 `save_reading` 중
-- 판본을 받던 한 벌. 열여섯이 열셋이 된 것이 **이 결정이 줄인 문의 수**다.
--
-- 새로 세운 문을 PUBLIC 에 열어 두지 않았는지도 이 목록이 든다 — `grant` 는 PUBLIC 의
-- 몫을 안 걷으므로, revoke 를 빠뜨리면 여기에 이름이 우르르 늘어난다.
reset role;
select is(
  (select array_agg(p.proname::text order by p.proname::text)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  array[
    'adopt_reading_job',
    'claim_reading_job',
    'fail_reading_job',
    'mark_reading_webhook_processed',
    /** 동의가 연 시도를 서버가 찾아 제출한다 — 부르는 사람은 요청자가 아니다(ADR 0038) */
    'match_run_awaiting_send',
    'open_reading_jobs',
    /** Node 가 지은 것을 적는 문 — 계산 입력은 안 받는다(ADR 0071 · #66) */
    'prepare_reading_job',
    'reading_recovery_configured',
    'record_reading_webhook_event',
    'release_reading_job',
    /*
      **한 벌로 돌아왔다.** 비유를 받는 인자가 늘 때도, 판본 인자 둘이 빠질 때도 잠시
      두 벌이 서 있었다 — 넓히고(expand) 배포가 자리 잡은 뒤 좁힌다(contract).

      그동안 이 줄이 두 벌인 것을 값으로 들고 있었고, 좁히는 날 한 줄이 빠졌다.
      **지금 상태를 감추지 않고 값으로 드는 것이 그 표를 잣대로 만든다.**
    */
    'save_reading',
    /**
     * 엔진 판이 바뀐 뒤 **남의** Person 의 여덟 글자를 다시 채우는 운영 문(ADR 0071).
     * RLS 가 앱 세션에 남의 입력을 안 열어 주므로 이 일은 열쇠로만 된다 — 임시 장치가
     * 아니라 영구히 남으므로 이 목록에 이름이 선다. 대신 **조건부로만 쓴다**: 읽었던
     * **입력 판**을 함께 받아, 그 사이 입력이 바뀌었으면 쓰지 않고 `false` 로 답한다.
     */
    'set_person_chart',
    /** 얼린 작업을 집는 문 — 조회가 아니라 `frozen` → `preparing` 전이다(ADR 0071 · #66) */
    'take_reading_job'
  ]::text[],
  'service_role 이 부를 수 있는 public 함수는 이 열세 줄뿐이다');

/**
 * **기본값이 닫아 준다는 약속이 안 지켜지고 있었다.**
 *
 * 26일자 마이그레이션이 「앞으로 생길 함수도 닫힌 채로 시작한다」며 기본 권한을 바꿔
 * 두었는데, 그 뒤에 revoke 없이 만든 함수 하나가 `proacl` 이 빈 채로 서서 anon·
 * authenticated·service_role 모두에게 열렸다.
 *
 * 위 시험은 열쇠에게 열린 것만 센다. 그것만으로는 **anon 에게 열린 문**을 못 잡는다.
 * `proacl` 이 비었다는 것은 「아무도 손대지 않았다」이고, 이 저장소에서 그것은 곧
 * 「기본값대로 PUBLIC 에 열려 있다」다.
 */
select is(
  (select array_agg(p.proname::text order by p.proname::text)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proacl is null),
  null,
  'public 함수 중 권한을 손대지 않은 것이 하나도 없다');

select * from finish();
rollback;
