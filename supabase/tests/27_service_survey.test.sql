-- 서비스 설문 — **탭에서 언제든, 초안과 제출은 갈린다.**
--
-- 여기서 재는 것 다섯.
--
-- 1. **동의 뒤에만 받는다.** 끄면 남긴 답도 함께 사라진다 — 값만 꺼 두면 근거 없이 남는다.
-- 2. **안 물어본 문항의 답은 저장되지 않는다.** 안 읽은 종류의 값은 실려 와도 안 받는다 —
--    화면이 숨기는 것과 서버가 안 받는 것은 다른 일이다.
-- 3. **초안은 집계에 안 든다.** 작성 도중의 문장을 제출한 의견처럼 읽으면 안 된다.
-- 4. **처음 제출한 때와 그때의 일정은 안 움직인다.** 답을 고쳐도 그렇다.
-- 5. **표는 밖에서 한 줄도 안 보인다.**
begin;
select plan(22);

create or replace function pg_temp.save(run uuid, rev uuid)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev, null, '## 풀이', null, '한 사람을 한마디로.',
    '{"charts":{}}', '# 역할', 'reading-prompt-v10', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 저장한 사람 하나를 열고 끝까지 민다 — 풀이권 하나가 온전히 소모되는 한 바퀴 */
create or replace function pg_temp.burn(who uuid, key text)
returns void language plpgsql as $$
declare started uuid; rev uuid;
begin
  select run_id, revision_a into started, rev
  from public.start_reading_run('person', key, who);
  perform pg_temp.save(started, rev);
end;
$$;

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

/** 답 한 벌 — 시험이 매번 열네 인자를 적지 않게 */
create or replace function pg_temp.answer(
  liked text[] default array[]::text[],
  improve text[] default array[]::text[],
  said text default null,
  solo text default null,
  pair text default null,
  submit boolean default false)
returns timestamptz language sql as $$
  select public.save_service_survey(
    liked, array[]::text[], improve, said,
    array[]::text[], array[]::text[], solo, pair, array[]::text[], null,
    array['free', '990', '1990', '4900', '9900', '12000', 'over_12000', 'unsure'],
    submit);
$$;

/** 운영자 집계는 표 전체를 센다 — 앞선 검사가 남긴 줄을 치우고 잰다(되돌려진다) */
set local role postgres;
delete from public.service_survey;

set local role authenticated;

create temporary table folks as
select tests.signup('kim-svc@example.com') as kim,
       tests.signup('lee-svc@example.com') as lee;
grant select on folks to authenticated, service_role;

set local role postgres;
update public.app_user set improvement_consent = true where id = (select kim from folks);
set local role authenticated;

select pg_temp.acting((select kim from folks));
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');

-- ── 아무것도 안 읽었고 잔액이 그대로일 때 ───────────────────────────────────

select is(
  (select array[read_solo, read_pair, consented] from public.service_survey_context()),
  array[false, false, true],
  '아직 읽은 풀이가 없으면 값 문항이 안 선다');

select is(
  (select credits_left from public.service_survey_context()),
  tests.reading_credit_limit(),
  '잔액은 한도 그대로다');

/** **안 물어본 값은 안 받는다** — 화면이 안 세운 문항의 답이 실려 와도 저장되지 않는다 */
select lives_ok(
  $$select pg_temp.answer(array['discovery'], solo => '9900', pair => '4900')$$,
  '안 읽은 종류의 값이 실려 와도 저장 자체는 된다');

select is(
  (select array[price_solo, price_pair] from public.my_service_survey()),
  array[null, null]::text[],
  '안 읽은 종류의 값은 비워 둔다');

select is(
  (select submitted_at from public.my_service_survey()),
  null,
  '초안에는 제출한 때가 없다');

-- ── 화면이 깨진 것은 거절한다 ───────────────────────────────────────────────

select throws_ok(
  $$select pg_temp.answer(array['discovery', 'none'])$$,
  '23514', null, '함께 고를 수 없는 답이 섞이면 거절한다');

select throws_ok(
  $$select pg_temp.answer(array['made-up'])$$,
  '23514', null, '모르는 선택지는 받지 않는다');

-- ── 하나도 안 고르면 제출이 아니다 ──────────────────────────────────────────

select throws_like(
  $$select pg_temp.answer(submit => true)$$,
  '%하나도%',
  '빈 줄은 제출로 받지 않는다');

-- ── 풀이를 읽으면 값 문항이 선다 ────────────────────────────────────────────

create temporary table kin as
select
  public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
    'female', '부산', 'jo', 'localMean') as mom,
  public.create_managed_person('아빠', null, 'solar', '1960-11-08', '1960-11-08', '05:40',
    'male', '대구', 'jo', 'localMean') as dad,
  public.create_managed_person('누나', null, 'solar', '1988-01-19', '1988-01-19', '22:05',
    'female', '광주', 'jo', 'localMean') as sis,
  public.create_managed_person('형', null, 'solar', '1986-07-23', '1986-07-23', '11:15',
    'male', '인천', 'jo', 'localMean') as bro,
  public.create_managed_person('삼촌', null, 'solar', '1958-09-30', '1958-09-30', '16:50',
    'male', '대전', 'jo', 'localMean') as unc;
grant select on kin to authenticated, service_role;

select pg_temp.burn((select mom from kin), 'svc-0001');

select is(
  (select array[read_solo, read_pair] from public.service_survey_context()),
  array[true, false],
  '한 사람 풀이를 읽었으면 사주풀이 값만 묻는다');

select lives_ok(
  $$select pg_temp.answer(array['self_reading'], solo => '9900', pair => '4900')$$,
  '읽은 종류의 값은 들어간다');

select is(
  (select array[price_solo, price_pair] from public.my_service_survey()),
  array['9900', null],
  '읽은 종류만 값이 남는다');

-- ── 초안은 집계에 안 든다 ───────────────────────────────────────────────────

set local role postgres;
insert into public.operator (user_id, note) values ((select kim from folks), '시험');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select array[submitted, drafts] from public.operator_service_survey_overview()),
  array[0, 1],
  '아직 제출하지 않은 줄은 초안으로 센다');

select is(
  (select count(*)::integer from public.operator_service_survey_counts()),
  0,
  '초안의 선택지는 한 줄도 안 세어진다');

-- ── 제출 ────────────────────────────────────────────────────────────────────

select lives_ok(
  $$select pg_temp.answer(array['self_reading', 'discovery'],
      improve => array['content'], said => '셋째 절이 길어요', solo => '9900',
      submit => true)$$,
  '제출된다');

/** 표를 직접 읽는 것은 운영자의 일이다 — 시험도 그 경계를 안 넘는다 */
set local role postgres;
create temporary table first_time as
select s.submitted_at as at, s.schedule_id as sched
from public.service_survey s where s.user_id = (select kim from folks);
grant select on first_time to authenticated, service_role;
set local role authenticated;

select is(
  (select array[submitted, drafts] from public.operator_service_survey_overview()),
  array[1, 0],
  '제출하면 초안이 아니다');

select is(
  (select answers from public.operator_service_survey_counts()
   where question = 'liked' and choice = 'self_reading'),
  1,
  '제출한 답이 문항별로 세어진다');

-- ── 고쳐도 처음 제출한 때와 그때의 일정은 안 움직인다 ──────────────────────

/** 운영자가 일정을 옮겼다 — 그래도 이미 답한 줄의 `schedule_id` 는 그 자리에 있다 */
set local role postgres;
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ('2026-11-30', '시험 — 미룬다', '만세력 운영자', '시험 담당', 'ops@example.com');
set local role authenticated;

select lives_ok(
  $$select pg_temp.answer(array['self_reading'], improve => array['content'],
      said => '고쳐 적었어요', submit => true)$$,
  '고쳐서 다시 제출한다');

set local role postgres;
create temporary table after_edit as
select s.submitted_at as at, s.schedule_id as sched, s.updated_at as edited
from public.service_survey s where s.user_id = (select kim from folks);
grant select on after_edit to authenticated, service_role;
set local role authenticated;

select is(
  (select array[
     (select at from first_time) = (select at from after_edit),
     (select edited from after_edit) is not null,
     (select sched from first_time) = (select sched from after_edit)]),
  array[true, true, true],
  '처음 제출한 때와 그때의 일정은 그대로고, 고친 때가 따로 남는다');

-- ── 동의를 끄면 함께 사라진다 ───────────────────────────────────────────────

select lives_ok(
  $$select public.set_improvement_consent(false)$$,
  '동의를 끈다');

select is(
  (select count(*)::integer from public.my_service_survey()),
  0,
  '끄면 남긴 답도 함께 사라진다');

-- ── 밖에서는 안 닿는다 ──────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

select throws_ok(
  $$select 1 from public.service_survey$$,
  '42501', null, '표는 밖에서 한 줄도 안 보인다');

select throws_like(
  $$select pg_temp.answer(array['discovery'])$$,
  '%동의%',
  '동의하지 않았으면 답을 남길 수 없다');

select * from finish();
rollback;
