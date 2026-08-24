-- discovery — 참여한 사람만 보고, 사주로는 아무도 지우지 않는다.
begin;
select plan(27);

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

select is(
  public.discovery_supplied_count((select 토금뿐 from summaries), (select 고른네오행 from summaries)),
  2,
  '채우는 개수는 따로 센다');

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

select throws_ok(
  format($$select public.set_discovery_participation(true, %L)$$, (select 고른네오행 from summaries)),
  '23502', null,
  '공개용 별명이 없으면 참여할 수 없다');

insert into public.discovery_profile (nickname, intro, prefer_gender)
values ('민수', '조용한 편입니다', 'any');

select throws_ok(
  $$select public.set_discovery_participation(true, '{"counts":{}}'::jsonb)$$,
  '22023', null,
  '모양이 맞지 않는 요약으로는 참여할 수 없다');

select lives_ok(
  format($$select public.set_discovery_participation(true, %L)$$, (select 고른네오행 from summaries)),
  '별명과 사주가 있으면 참여한다');

select is(
  (select (opted_in_at is not null) and element_revision_id = (
     select current_revision_id from public.person where id = (select person_id from mine))
   from public.discovery_profile),
  true,
  '참여를 켜면 요약이 지금 판본에 붙는다');

/**
 * 참여 상태는 사용자가 직접 못 옮긴다.
 *
 * 켠 시각을 손으로 적을 수 있으면 그것은 사건의 기록이 아니다. 열어 준 칸은 별명·소개·
 * 선호 셋뿐이다.
 */
select throws_ok(
  $$update public.discovery_profile set opted_in_at = now()$$,
  '42501', null,
  '참여 시각은 사용자가 못 건드린다');

-- ── 후보 ──────────────────────────────────────────────────────────────────────
/**
 * **`discovery_candidates` 는 `security definer` 라 RLS 가 안 걸린다.**
 *
 * 그래서 이 시험이 세는 수는 스스로 좁혀지지 않는다 — 다른 검사가 남긴 참여자까지
 * 함께 세면 「DB 가 비어 있는가」를 재게 된다. 이 시험이 만든 사람으로 좁혀서 센다.
 */
create or replace function pg_temp.candidates_among(target uuid)
returns integer
language sql
as $$
  select count(*)::int from public.discovery_candidates() c where c.candidate_user_id = target;
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

insert into public.discovery_profile (nickname, prefer_gender) values ('지영', 'any');
select public.set_discovery_participation(true, (select 토금뿐 from summaries));

-- 참여하지 않은 사람은 후보도 못 본다 — 풀은 서로 내놓은 사람들의 자리다.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select park from who)), true);

select throws_ok(
  $$select * from public.discovery_candidates()$$,
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
  format($$select nickname, supplied_for_viewer from public.discovery_candidates()
           where candidate_user_id = %L$$, (select lee from who)),
  $$values ('지영'::text, 0)$$,
  '참여한 상대가 후보로 선다 — 두 축의 값과 함께');

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
select is(
  public.log_discovery_impressions(
    format('[{"candidateUserId":"%s","position":0,"exploration":false,"reason":"검사"}]',
      (select lee from who))::jsonb),
  1,
  '노출을 기록한다');

select throws_ok(
  $$select count(*) from public.discovery_impression$$,
  '42501', null,
  '기록한 사람도 그 표를 읽지는 못한다 — 후보의 오행 요약이 거기 있다');

reset role;

/**
 * 요약 두 벌은 **DB 가 채운다.** 앱이 실어 보내면 노출 기록이 「그때 무엇이었나」가
 * 아니라 「앱이 무엇이라고 했나」의 기록이 된다.
 */
select is(
  (select viewer_summary -> 'counts' ->> '木' from public.discovery_impression
   where viewer_user_id = (select kim from who)),
  '2',
  '노출 기록의 오행 요약은 앱이 아니라 DB 가 채운다');

select * from finish();
rollback;
