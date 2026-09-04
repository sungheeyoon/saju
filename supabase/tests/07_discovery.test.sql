-- discovery — 참여한 사람만 보고, 사주로는 아무도 지우지 않는다.
begin;
select plan(46);

create temporary table who as
select tests.signup('kim@example.com') as kim,
       tests.signup('lee@example.com') as lee,
       tests.signup('park@example.com') as park;
grant select on who to authenticated;

/**
 * 오행 요약 두 벌 — **`src/lib/matching/elementAxes.test.ts` 에 같은 것이 있다.**
 *
 * 두 축은 TypeScript 와 SQL 에 하나씩 적혀 있다(후보의 요약을 브라우저로 내려보내지
 * 않으려면 DB 안에서도 세야 한다). 두 자리가 갈릴 수 있으므로 같은 입력에 같은
 * 기대값을 양쪽에 적어 둔다.
 */
create temporary table summaries as
select
  '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":2,"水":0},
    "ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.25,"水":0}}'::jsonb as 고른네오행,
  '{"glyphCount":8,"counts":{"木":0,"火":0,"土":4,"金":4,"水":0},
    "ratios":{"木":0,"火":0,"土":0.5,"金":0.5,"水":0}}'::jsonb as 토금뿐,
  '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},
    "ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb as 다있다;
grant select on summaries to authenticated;

-- ── 두 축 ─────────────────────────────────────────────────────────────────────
select is(
  round(public.discovery_complement_one_way((select 토금뿐 from summaries), (select 고른네오행 from summaries)), 4),
  66.6667::numeric,
  '없는 오행 셋 중 둘을 채우면 66.6667 이다');

select is(
  public.discovery_complement_one_way((select 고른네오행 from summaries), (select 토금뿐 from summaries)),
  0::numeric,
  '채우는 것이 없으면 0 이다');

select is(
  public.discovery_complement_one_way((select 다있다 from summaries), (select 토금뿐 from summaries)),
  70::numeric,
  '빠진 오행이 없으면 중립값 70 이다');

select is(
  round(public.discovery_complement((select 고른네오행 from summaries), (select 토금뿐 from summaries)), 4),
  33.3333::numeric,
  '보완은 양방향 평균이다');

select is(
  public.discovery_complement((select 토금뿐 from summaries), (select 고른네오행 from summaries)),
  public.discovery_complement((select 고른네오행 from summaries), (select 토금뿐 from summaries)),
  '자리를 바꿔도 같다');

select is(
  round(public.discovery_combined_balance((select 고른네오행 from summaries), (select 토금뿐 from summaries)), 4),
  56.2500::numeric,
  '함께 놓은 균형은 56.25 다');

/**
 * **개수가 아니라 이름을 낸다.**
 *
 * 후보 카드는 「무엇을 채우는지」를 말해야 하는 맛보기다. 개수만 내면 그 말을 할 수
 * 없다. 여기서 나가는 것은 내게 없는 오행 중 상대가 가진 것뿐이고, 상대의 전체
 * 구성(개수표)은 여전히 안 나간다(ADR 0003 「이행」).
 */
select is(
  public.discovery_supplied_elements((select 토금뿐 from summaries), (select 고른네오행 from summaries)),
  array['木', '火'],
  '채우는 오행을 이름으로 낸다');

select is(
  public.discovery_supplied_elements((select 고른네오행 from summaries), (select 토금뿐 from summaries)),
  array[]::text[],
  '채우는 것이 없으면 빈 목록이다');

-- ── 요약의 모양 ───────────────────────────────────────────────────────────────
select is(public.is_element_summary((select 고른네오행 from summaries)), true,
  '제대로 된 요약은 통과한다');

select is(
  public.is_element_summary('{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":2},
    "ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.25,"水":0}}'::jsonb),
  false,
  '오행 하나가 빠진 요약은 거절된다');

select is(
  public.is_element_summary('{"glyphCount":8,"counts":{"木":8,"火":8,"土":8,"金":8,"水":8},
    "ratios":{"木":0.2,"火":0.2,"土":0.2,"金":0.2,"水":0.2}}'::jsonb),
  false,
  '개수 합이 글자 수와 다르면 거절된다 — 여덟 글자로 만들 수 없는 요약이다');

-- ── 참여 ──────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select throws_ok(
  format($$select public.set_discovery_participation(true, %L)$$, (select 고른네오행 from summaries)),
  '23502', null,
  '사주를 등록하기 전에는 참여할 수 없다');

create temporary table mine as
select public.create_self_person(
  '민수', 'solar', '1990-05-15', '1990-05-15', '14:30', 'male', '서울', 'jo', 'localMean'
) as person_id;
grant select on mine to authenticated;

/*
  **「별명이 없으면 참여 못 한다」를 여기서 안 잰다.** 이름이 계정으로 옮겨 가면서
  사주보다 앞에 섰고(`the_name_comes_before_the_chart`), 사주가 있는 사람은 이름도 있다.
  이름 없이 사주를 등록하는 길이 막혔는지는 `02_self_person` 이 잰다.
*/
select public.save_my_profile('민수', '조용한 편입니다');

select throws_ok(
  $$select public.set_discovery_participation(true, '{"counts":{}}'::jsonb)$$,
  '22023', null,
  '모양이 맞지 않는 요약으로는 참여할 수 없다');

/**
 * **자동 참여** — 켠 적 없어도 풀에 든다(PRD §4.1, ADR 0037).
 *
 * 요약은 DB 가 못 만든다. 그래서 참여가 열리는 자리는 언제나 **앱이 요약을 넣는
 * 자리**이고, 그 자리가 이 함수다 — 홈이 목록을 열 때 부른다. 여기서 참여가 안 열리면
 * 「저장한 사람은 자동으로 후보 풀에 든다」는 줄이 코드 어디에도 없게 된다.
 */
select is(
  public.ensure_discovery_participation(
    (select person_id from mine), (select 고른네오행 from summaries)),
  true,
  '켠 적 없어도 요약이 들어오면 참여가 열린다');

select is(
  (select (opted_in_at is not null) and opted_out_at is null and element_revision_id = (
     select current_revision_id from public.person where id = (select person_id from mine))
   from public.discovery_profile),
  true,
  '자동 참여도 요약을 지금 판본에 붙인다');

-- ── 끄는 것은 사건으로 남는다 ─────────────────────────────────────────────────
select is(public.set_discovery_participation(false, null), false, '참여를 끈다');

select is(
  (select opted_in_at is null and opted_out_at is not null
      and element_summary is null and element_revision_id is null
   from public.discovery_profile),
  true,
  '끄면 요약을 거두고 끈 시각이 남는다');

/**
 * **끈 사람은 홈을 열어도 다시 안 켜진다.**
 *
 * 참여가 기본으로 켜진 뒤로 `opted_in_at is null` 하나가 「안 켰다」와 「껐다」를 함께
 * 뜻하게 됐다. 그 둘을 안 가르면 끈 사람이 다음 방문에 되살아나고, 그것은 고장이 아니라
 * **사용자가 한 결정을 우리가 매번 되돌리는 일**이다. 여기서 재는 것이 그 경계다.
 */
select is(
  public.ensure_discovery_participation(
    (select person_id from mine), (select 고른네오행 from summaries)),
  false,
  '끈 사람은 자동으로 다시 켜지지 않는다');

select is(
  (select opted_in_at is null and element_summary is null from public.discovery_profile),
  true,
  '거짓을 낼 때는 아무것도 안 쓴다');

-- ── 다시 켜는 것은 끈 기록을 지운다 ───────────────────────────────────────────
select lives_ok(
  format($$select public.set_discovery_participation(true, %L)$$, (select 고른네오행 from summaries)),
  '쉬던 사람이 직접 다시 켠다');

select is(
  (select (opted_in_at is not null) and opted_out_at is null
      and element_revision_id = (
        select current_revision_id from public.person where id = (select person_id from mine))
   from public.discovery_profile),
  true,
  '다시 켜면 끈 기록이 지워지고 요약이 지금 판본에 붙는다');

/**
 * 참여 상태는 사용자가 직접 못 옮긴다.
 *
 * 켠 시각을 손으로 적을 수 있으면 그것은 사건의 기록이 아니다. **끈 시각도 마찬가지다**
 * — 그 칸을 지울 수 있으면 자동 참여가 다시 이 사람을 켠다. 이름과 소개가 계정으로
 * 옮겨 간 뒤로 이 표에서 열어 준 칸은 **선호 하나뿐**이다.
 */
select throws_ok(
  $$update public.discovery_profile set opted_in_at = now()$$,
  '42501', null,
  '참여 시각은 사용자가 못 건드린다');

select throws_ok(
  $$update public.discovery_profile set opted_out_at = null$$,
  '42501', null,
  '끈 시각도 사용자가 못 건드린다');

-- ── 후보 ──────────────────────────────────────────────────────────────────────
/**
 * **`my_discovery_board` 는 `security definer` 라 RLS 가 안 걸린다.**
 *
 * 그래서 이 시험이 세는 수는 스스로 좁혀지지 않는다 — 다른 검사가 남긴 참여자까지
 * 함께 세면 「DB 가 비어 있는가」를 재게 된다. 이 시험이 만든 사람으로 좁혀서 센다.
 */
create or replace function pg_temp.candidates_among(target uuid)
returns integer
language sql
as $$
  select count(*)::int from public.my_discovery_board() c where c.candidate_user_id = target;
$$;

select is(
  pg_temp.candidates_among((select lee from who)),
  0,
  '아직 상대가 참여하지 않았으면 후보가 없다 — 자기 자신도 후보가 아니다');

reset role;

-- 상대도 참여한다. 성별을 갈라 두 방향 조건을 잰다.
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);

create temporary table theirs as
select public.create_self_person(
  '지영', 'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '서울', 'jo', 'localMean'
) as person_id;
grant select on theirs to authenticated;

select public.save_my_profile('지영', null);
select public.set_discovery_participation(true, (select 토금뿐 from summaries));

reset role;

/**
 * **여기부터 후보를 보므로 다른 검사가 남긴 참여자를 먼저 뺀다.**
 *
 * `my_discovery_board` 는 `definer` 라 RLS 로 스스로 좁혀지지 않고, 자리도 열 개까지다.
 * 안 좁히면 「지영이 후보로 서는가」가 「지영이 남들보다 위인가」를 재게 되고, 남은
 * 참여자가 열을 넘는 순간 목표가 목록 밖으로 밀린다 — 재현했다(참여자 36 명에서
 * 이 단언이 무너졌다). 이 정리는 **수를 재는 대목보다 앞에** 있어야 한다.
 */
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from who union select lee from who union select park from who) mine,
     public.discovery_profile p
where p.user_id not in (select kim from who union select lee from who union select park from who);

/**
 * **목록은 이제 스냅샷이다** — 새 참여자는 다음 스냅샷부터 선다(ADR 0037).
 *
 * 김은 지영이 들어오기 전에 한 번 목록을 열었고, 그때 만들어진 스냅샷이 아직 신선하다.
 * 시험은 **씨앗을 고를 수 있는 닫힌 문**으로 다시 뽑는다 — 사람이 누르는 문은 5분
 * 쿨다운이 있고, 여기서 재려는 것은 쿨다운이 아니다.
 */
create temporary table kim_first as
select public.refresh_discovery_snapshot_for((select kim from who), 'seven') as id;

-- 참여하지 않은 사람은 후보도 못 본다 — 풀은 서로 내놓은 사람들의 자리다.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select park from who)), true);

select throws_ok(
  $$select * from public.my_discovery_board()$$,
  '42501', null,
  '참여하지 않으면 후보를 볼 수 없다');

select is(
  (select count(*)::int from public.discovery_profile),
  0,
  '남의 프로필은 한 줄도 안 보인다');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select results_eq(
  format($$select nickname, supplied_elements, balance_band from public.my_discovery_board()
           where candidate_user_id = %L$$, (select lee from who)),
  -- 함께 놓은 균형 56.25 → 가운데 칸. 숫자는 안 나가고 이 이름만 나간다.
  $$values ('지영'::text, array[]::text[], 'mixed'::text)$$,
  '참여한 상대가 후보로 선다 — 채우는 오행과 균형 칸과 함께');

/**
 * **부르는 쪽이 넣을 인자가 하나도 없다.**
 *
 * 자리·탐색 여부·상한·후보 목록을 손으로 적을 수 있으면 그것이 곧 위조할 자리다.
 * 인자가 없으면 그런 자리 자체가 없다.
 */
select is(
  (select count(*)::int from pg_catalog.pg_proc
   where proname = 'my_discovery_board' and pronamespace = 'public'::regnamespace and pronargs = 0),
  1,
  '후보 목록 함수는 인자를 받지 않는다');

select hasnt_function('public', 'discovery_candidates',
  '후보를 고르기만 하는 함수는 따로 없다 — 고르는 일과 남기는 일이 한 자리다');

select hasnt_function('public', 'log_discovery_impressions',
  '노출 기록을 손으로 적는 함수도 없다');

/**
 * **두 축과 점수는 반환형에 없다.**
 *
 * 82점과 79점은 절대적인 궁합 차이로 읽힌다. 「순서는 좋고 나쁨이 아니다」라고 적어
 * 놓고 숫자를 함께 내보내면 그 말은 아무도 안 믿는다.
 */
select is(
  (select count(*)::int from unnest(
     (select proargnames from pg_catalog.pg_proc
      where proname = 'my_discovery_board' and pronamespace = 'public'::regnamespace)) as name
   where name in ('complement', 'combined_balance', 'score')),
  0,
  '반환형에 두 축의 값도 점수도 없다');

/**
 * 두 축을 세는 함수는 **아무도 직접 못 부른다.**
 *
 * 반환형에서 뺀 것이 뜻을 가지려면, 같은 값을 다른 문으로 받아 갈 수 없어야 한다.
 */
select function_privs_are('public', 'discovery_complement', array['jsonb', 'jsonb'],
  'authenticated', array[]::text[],
  '두 축을 로그인한 사람이 직접 부를 수 없다');

select function_privs_are('public', 'discovery_supplied_elements', array['jsonb', 'jsonb'],
  'authenticated', array[]::text[],
  '추천 이유를 세는 함수도 직접 부를 수 없다');

-- ── 하드 제외 ─────────────────────────────────────────────────────────────────
insert into public.discovery_hidden (hidden_user_id) values ((select lee from who));

select is(
  pg_temp.candidates_among((select lee from who)),
  0,
  '다시 보지 않기로 한 사람은 후보에서 빠진다');

delete from public.discovery_hidden where hidden_user_id = (select lee from who);

-- 사주와 무관한 명시적 조건 — **양쪽 것을 다 본다.**
update public.discovery_profile set prefer_gender = 'male';

select is(
  pg_temp.candidates_among((select lee from who)),
  0,
  '내가 설정한 성별 조건 밖의 후보는 오지 않는다');

update public.discovery_profile set prefer_gender = 'any';
reset role;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);
update public.discovery_profile set prefer_gender = 'female';
reset role;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  pg_temp.candidates_among((select lee from who)),
  0,
  '나를 조건 밖에 둔 사람에게도 나는 후보가 아니다 — 같은 규칙의 두 얼굴이다');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);
update public.discovery_profile set prefer_gender = 'any';

-- 출생정보를 고치면 요약이 낡는다. 낡은 요약은 후보가 아니다.
select public.add_person_revision((select person_id from theirs),
  'solar', '1992-03-03', '1992-03-03', '09:00', 'female', '부산', 'jo', 'localMean');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  pg_temp.candidates_among((select lee from who)),
  0,
  '요약이 지금 판본의 것이 아니면 후보가 아니다 — 낡은 값으로 줄 세우지 않는다');

-- ── 노출 기록 ─────────────────────────────────────────────────────────────────
--
-- 바로 위에서 상대의 요약을 낡게 했으므로 되살려 놓고 잰다. 낡은 사람은 후보가
-- 아니고, 후보가 아니면 기록도 안 남는 것이 이 함수의 규칙이기 때문이다.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select lee from who)), true);
select public.set_discovery_participation(true, (select 토금뿐 from summaries));
reset role;

/**
 * 여기서부터는 **수**를 재므로 노출 기록을 비운다. 앞선 시험들이 목록을 여러 번 열었다.
 *
 * 남이 목록에 서지 않게 하는 정리는 위에서 이미 했다 — 두 번 하지 않는다. 그 정리가
 * 여기 있었을 때는 첫 후보 단언이 아직 안 좁혀진 목록을 보고 있었다.
 */
delete from public.discovery_impression where viewer_user_id = (select kim from who);

/* 기록은 **스냅샷을 만들 때** 난다. 읽기는 아무것도 안 적으므로 여기서 다시 뽑는다. */
create temporary table kim_again as
select public.refresh_discovery_snapshot_for((select kim from who), 'seven-again') as id;

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from who)), true);

select is(
  (select count(*)::int from public.my_discovery_board()),
  1,
  '목록을 연다');

select throws_ok(
  $$select count(*) from public.discovery_impression$$,
  '42501', null,
  '연 사람도 그 표를 읽지는 못한다 — 후보의 오행 요약이 거기 있다');

reset role;

/**
 * 요약도 추천 이유도 두 축도 **DB 가 그 자리에서 계산한다.**
 *
 * 앱이 실어 보내면 기록이 「그때 무엇이었나」가 아니라 「앱이 무엇이라고 했나」가 된다.
 * 이제 앱은 아무것도 실어 보내지 않는다 — 부를 때 넣을 인자가 없다.
 */
select is(
  (select viewer_summary -> 'counts' ->> '木' from public.discovery_impression
   where viewer_user_id = (select kim from who)),
  '2',
  '노출 기록의 오행 요약은 DB 가 채운다');

select is(
  (select supplied_elements from public.discovery_impression
   where viewer_user_id = (select kim from who)),
  array[]::text[],
  '추천 이유도 DB 가 계산한다');

select isnt(
  (select complement from public.discovery_impression
   where viewer_user_id = (select kim from who)),
  null,
  '두 축의 값은 기록에만 남는다 — 밖으로는 안 나간다');

-- ── 계정 상태를 묻는 함수 ─────────────────────────────────────────────────────
--
-- 인자를 받으면 **남의 상태를 묻는 문**이 된다. `definer` 라 RLS 를 지나가므로 그 답이
-- 그대로 나간다.

select has_function('public', 'is_active_account', array[]::text[],
  '계정 상태는 인자 없이 묻는다');

select hasnt_function('public', 'is_active_account', array['uuid'],
  '남의 uuid 를 넣어 묻는 길은 없다');

select function_privs_are('public', 'is_active_account', array[]::text[],
  'anon', array[]::text[],
  '로그인하지 않은 쪽은 계정 상태를 물을 수 없다');

select function_privs_are('public', 'is_active_account', array[]::text[],
  'authenticated', array['EXECUTE'],
  '로그인한 사람은 자기 상태만 묻는다');

select * from finish();
rollback;
