-- 운영자가 읽는 설문 — **문은 하나고, 그 문이 사람을 안 내준다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **운영자가 아니면 아무것도 안 나온다.** 네 함수와 표, 그리고 「나는 운영자인가」를
--    묻는 자리까지 다 닫혀 있다. 하나라도 열려 있으면 그것이 곧 남의 답을 읽는 문이다.
-- 2. **운영자에게는 모두의 답이 보인다.** 자기 답만 보이면 이 화면을 둘 까닭이 없다.
-- 3. **판본이 답을 가른다.** 답은 그 글을 만든 시도에 매여 있으므로(ADR 0022) 판본을
--    바꾼 뒤의 답과 그 전의 답이 섞이지 않는다.
-- 4. **누가 썼는지는 안 실린다.** 반환형에 사람이 들어오는 순간 이 화면은 「누가 뭐라고
--    했나」가 되고, 답한 사람은 그런 자리에 동의한 적이 없다.
begin;
select plan(20);

create or replace function pg_temp.save(run uuid, rev uuid, version text)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev, null, '## 풀이', null, '한 사람을 한마디로.',
    '{"charts":{}}', '# 역할', version, 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 자기 명식 하나를 끝까지 밀고 답까지 남긴다 — 한 사람이 한 판본에 남기는 한 바퀴 */
create or replace function pg_temp.answer(
  key text, version text, use_score int, fit int, felt text, tags text[], said text)
returns void language plpgsql as $$
declare started uuid; rev uuid;
begin
  select run_id, revision_a into started, rev
  from public.start_reading_run('self', key);

  perform pg_temp.save(started, rev, version);
  perform public.leave_reading_feedback(
    started, use_score::smallint, fit::smallint, felt, tags, said);
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/**
 * **재기 전에 남의 자료를 치운다.**
 *
 * 운영자 함수는 표 전체를 센다 — 그것이 이 화면의 일이다. 그래서 앞선 검사나 브라우저
 * 검사가 남긴 줄이 있으면 절대 수를 잴 수 없다. 이 트랜잭션은 되돌려지므로 지운 것은
 * 이 파일 안에서만 없다.
 */
set local role postgres;
delete from public.reading_feedback;

/**
 * 동의 분포와 완성된 풀이는 **지울 수 없다** — 남의 계정과 남의 기록이다. 그래서 그 둘은
 * 절대 수가 아니라 **늘어난 만큼**으로 잰다.
 */
create temporary table before as
select
  (select count(*) from public.reading_run r where r.status = 'succeeded')::integer as succeeded,
  (select count(*) from public.app_user u where u.improvement_consent is true)::integer as consented,
  (select count(*) from public.app_user u where u.improvement_consent is false)::integer as declined,
  (select count(*) from public.app_user u where u.improvement_consent is null)::integer as unasked;
grant select on before to authenticated, service_role;

set local role authenticated;

create temporary table folks as
select tests.signup('kim-ops@example.com') as kim,
       tests.signup('lee-ops@example.com') as lee,
       /** 거절한 사람 — `tests.signup` 이 선택 동의를 꺼 둔다 */
       tests.signup('park-ops@example.com') as park,
       /** 아직 안 물어본 사람 — 구글 로그인만 하고 가입을 안 끝냈다 */
       tests.signup_raw('choi-ops@example.com') as choi;
grant select on folks to authenticated, service_role;

/** 설문 전체가 개선 활용 동의 뒤에 있다 — 답을 남길 둘만 켠다 */
set local role postgres;
update public.app_user set improvement_consent = true
where id in (select kim from folks union all select lee from folks);
set local role authenticated;

select pg_temp.acting((select kim from folks));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');

-- ── 운영자가 아니면 아무것도 안 나온다 ──────────────────────────────────────

select throws_ok(
  $$select * from public.operator_survey_overview()$$,
  '42501', null, '운영자가 아니면 개요를 못 읽는다');

select throws_ok(
  $$select * from public.operator_survey_by_version()$$,
  '42501', null, '운영자가 아니면 판본별 집계를 못 읽는다');

select throws_ok(
  $$select * from public.operator_survey_tags()$$,
  '42501', null, '운영자가 아니면 태그 집계를 못 읽는다');

select throws_ok(
  $$select * from public.operator_survey_comments()$$,
  '42501', null, '운영자가 아니면 적어 주신 글을 못 읽는다');

select throws_ok(
  $$select 1 from public.operator$$,
  '42501', null, '누가 운영자인지는 밖에서 못 읽는다');

/**
 * **「나는 운영자인가」도 못 묻는다.**
 *
 * 열어 두면 화면이 그것으로 메뉴를 세우고, 그때 판정하는 자리가 둘이 된다 — 화면이
 * 세운 길과 DB 가 내주는 자료가 갈리는 날 사용자는 눌러도 아무것도 없는 줄을 본다.
 */
select throws_ok(
  $$select public.is_operator()$$,
  '42501', null, '운영자인지 묻는 자리도 밖에서는 안 열린다');

-- ── 답을 쌓는다 ─────────────────────────────────────────────────────────────

select pg_temp.answer('ops-kim-0001', 'reading-prompt-v9', 5, 2, 'long',
  array['abstract', 'ui'], '셋째 문단이 제 얘기 같았고 넷째는 아니었어요.');

select pg_temp.answer('ops-kim-0002', 'reading-prompt-v10', 4, 4, 'right',
  array['abstract'], null);

select pg_temp.acting((select lee from folks));
select public.create_self_person(
  '너', 'solar', '1992-08-02', '1992-08-02', '09:20', 'male', '부산', 'jo', 'localMean');

select pg_temp.answer('ops-lee-0001', 'reading-prompt-v10', 3, 5, 'right',
  array['abstract', 'repetitive'], '재물 이야기가 두 번 나와요.');

-- ── 운영자를 세운다 ─────────────────────────────────────────────────────────

/** 운영자가 SQL 로 넣는 자리다 — 앱에는 이 표에 닿는 길이 없다 */
set local role postgres;
insert into public.operator (user_id, note)
values ((select kim from folks), '시험 — 답을 읽는 사람');
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 개요 ────────────────────────────────────────────────────────────────────

select is(
  (select array[answers, respondents, answered_runs] from public.operator_survey_overview()),
  array[3, 2, 3],
  '답 셋을 두 사람이 세 시도에 남겼다');

/** 완성된 풀이는 이 파일이 만든 것만 세지 않는다 — 늘어난 만큼을 잰다 */
select is(
  (select succeeded_runs - (select succeeded from before)
   from public.operator_survey_overview()),
  3,
  '이 파일이 완성한 풀이 셋이 함께 센다');

/**
 * **`null` 과 `false` 는 다르다.** 안 물어본 것과 거절한 것을 한 수로 합치면, 설문이
 * 비어 있을 때 화면이 「아직 안 물어봤다」와 「거절당했다」를 같은 말로 하게 된다.
 */
select is(
  (select array[consented - (select consented from before),
                declined - (select declined from before),
                unasked - (select unasked from before)]
   from public.operator_survey_overview()),
  array[2, 1, 1],
  '동의·거절·미응답이 갈려서 센다');

-- ── 판본별 ──────────────────────────────────────────────────────────────────

select is(
  (select array_agg(prompt_version order by answers desc, prompt_version)
   from public.operator_survey_by_version()),
  array['reading-prompt-v10', 'reading-prompt-v9'],
  '답이 많은 판본이 먼저 선다');

select is(
  (select array[answers, felt_short, felt_right, felt_long]
   from public.operator_survey_by_version()
   where prompt_version = 'reading-prompt-v10'),
  array[2, 0, 2, 0],
  '한 판본의 답 둘이 한 줄로 모이고 분량도 함께 센다');

select is(
  (select array[usefulness, perceived_fit]
   from public.operator_survey_by_version()
   where prompt_version = 'reading-prompt-v10'),
  array[3.50, 4.50]::numeric[],
  '평균은 그 판본의 답만으로 난다');

select is(
  (select array[answers, usefulness, perceived_fit]::text[]
   from public.operator_survey_by_version()
   where prompt_version = 'reading-prompt-v9'),
  array['1', '5.00', '2.00'],
  '판본을 바꾸기 전의 답은 옛 판본에 남는다');

-- ── 태그 ────────────────────────────────────────────────────────────────────

select is(
  (select answers from public.operator_survey_tags()
   where prompt_version = 'reading-prompt-v10' and tag = 'abstract'),
  2,
  '같은 판본에 붙은 같은 태그가 모인다');

select is(
  (select array_agg(tag order by tag) from public.operator_survey_tags()
   where prompt_version = 'reading-prompt-v9'),
  array['abstract', 'ui'],
  '태그는 답마다 갈라져 센다');

-- ── 적어 주신 글 ────────────────────────────────────────────────────────────

/**
 * 운영자가 읽는 것은 자기 답이 아니다 — 남이 적은 글이 여기 서지 않으면 이 화면을
 * 둘 까닭이 없다.
 *
 * 차례는 `submitted_at` 으로 안 잰다. 한 트랜잭션에서 남긴 답은 `now()` 가 같아서
 * 그 차례가 시험마다 갈린다 — **재는 것은 무엇이 실리는가**다.
 */
select is(
  (select array_agg(comment order by usefulness) from public.operator_survey_comments()),
  array['재물 이야기가 두 번 나와요.', '셋째 문단이 제 얘기 같았고 넷째는 아니었어요.'],
  '동의한 사람이 적은 글은 남의 것도 보인다');

select is(
  (select count(*)::integer from public.operator_survey_comments()),
  2,
  '글을 안 적은 답은 이 목록에 안 선다');

/** 글만 떼어 보면 「너무 추상적」에 5를 준 사람과 3을 준 사람이 같은 말로 읽힌다 */
select is(
  (select array[usefulness::text, perceived_fit::text, felt_length,
                array_to_string(issue_tags, ',')]
   from public.operator_survey_comments() where usefulness = 3),
  array['3', '5', 'right', 'abstract,repetitive'],
  '글 옆에 그 답의 점수와 태그가 함께 선다');

/**
 * **누가 썼는지는 반환형에 없다.**
 *
 * 화면이 안 그리는 것으로는 부족하다 — 값이 내려와 있으면 그리는 줄 하나가 늘 수 있고,
 * 그때 이 화면은 「누가 뭐라고 했나」가 된다. 안 내주는 것과 안 그리는 것은 다르다.
 */
select unalike(
  pg_get_function_result('public.operator_survey_comments()'::regprocedure),
  '%user%',
  '적어 주신 글에는 누가 썼는지가 안 실린다');

-- ── 로그인 밖 ───────────────────────────────────────────────────────────────

set local role anon;

select throws_ok(
  $$select * from public.operator_survey_overview()$$,
  '42501', null, '로그인하지 않은 쪽에는 문이 아예 없다');

select * from finish();
rollback;
