-- 설문 — **답은 그 글을 만든 시도에 매이고, 읽을 수 있는 사람이 남긴다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **자격은 「만들었는가」가 아니라 「볼 수 있는가」다.** 공유 궁합은 누르지 않은
--    쪽도 읽으므로 그쪽도 답할 수 있어야 한다.
-- 2. **설문 전체가 동의 뒤에 있다.** 안 물어본 것(`null`)도 거절이고, 철회하면 이미
--    받은 답까지 지워진다. 그래도 사주 서비스는 하나도 안 좁아진다.
-- 3. **답은 갈리는 글이 아니라 안 갈리는 시도에 매인다.** 새로 만들면 그 글에는 아직
--    답이 없다.
-- 4. **표는 한 줄도 안 보인다.** 답을 세는 것은 운영자의 일이다.
begin;
select plan(31);

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

create or replace function pg_temp.save(
  run uuid, rev_a uuid, rev_b uuid, body text, score smallint)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev_a, rev_b, body, score,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-fb@example.com', '김답', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-fb@example.com', '이답', pg_temp.summary(0, 0, 4, 4, 0)) as lee;
grant select on folks to authenticated, service_role;

reset role;
/** 다른 시험이 남긴 참여자는 이 파일의 관심 밖이다 */
insert into public.discovery_hidden (user_id, hidden_user_id)
select mine.uid, p.user_id
from (select kim as uid from folks union all select lee from folks) mine,
     public.discovery_profile p
where p.user_id not in (select kim from folks union all select lee from folks);
set local role authenticated;

-- ── 자기 풀이 하나 ──────────────────────────────────────────────────────────

/** 설문 전체가 동의 뒤에 있으므로 먼저 켠다. 안 켠 자리는 아래에서 따로 잰다 */
reset role;
update public.app_user set improvement_consent = true where id = (select kim from folks);
set local role authenticated;

select pg_temp.acting((select kim from folks));

create temporary table run_self as
select run_id as id from public.start_reading_run('self', 'fb-self-0001');
grant select on run_self to authenticated, service_role;

/** **아직 안 끝난 글에는 답할 것이 없다** */
select throws_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    (select id from run_self)),
  '23514', null, '완성되지 않은 풀이에는 답할 수 없다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 나의 풀이', null)$$,
    (select id from run_self),
    (select p.current_revision_id from public.person p
     join public.app_user u on u.self_person_id = p.id and u.id = (select auth.uid()))),
  '자기 풀이가 저장된다');

/** **어느 시도가 만들었는지를 결과가 든다** — 없으면 설문이 매달릴 자리가 없다 */
select is(
  (select source_run_id from public.my_reading('self')),
  (select id from run_self),
  '결과가 자기를 만든 시도를 가리킨다');

select is(
  (select my_feedback from public.my_reading('self')),
  null,
  '아직 답하지 않았으면 내려올 답이 없다');

select lives_ok(
  format($$select public.leave_reading_feedback(
    %L::uuid, 5::smallint, 2::smallint, 'long', array['abstract','ui','abstract'])$$,
    (select id from run_self)),
  '답이 들어간다');

/**
 * **답한 사실이 아니라 답을 내려준다.**
 *
 * 「답했는가」만 내주던 때는 고치는 화면이 빈 칸으로 열렸고, 거기서 다시 보내면 적어
 * 두었던 글까지 `null` 로 덮였다 — 고치는 것이 아니라 지우는 것이었다.
 */
select is(
  (select my_feedback from public.my_reading('self')),
  jsonb_build_object(
    'usefulness', 5, 'perceivedFit', 2, 'feltLength', 'long',
    'issueTags', jsonb_build_array('abstract', 'ui'), 'comment', null),
  '답한 뒤에는 그 답이 그대로 결과와 함께 온다');

/** **중복은 RPC 가 턴다** — 부르는 쪽이 기억해야 맞는 것은 언젠가 안 지켜진다 */
reset role;
select is(
  (select issue_tags from public.reading_feedback where reading_run_id = (select id from run_self)),
  array['abstract', 'ui']::text[],
  '같은 태그를 두 번 넣어도 한 번만 남는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

/** 아는 이름만 받는다 — 모르는 값은 세는 쪽에서 조용히 빠진다 */
select throws_ok(
  format($$select public.leave_reading_feedback(
    %L::uuid, 4::smallint, 4::smallint, 'right', array['made-up-tag'])$$,
    (select id from run_self)),
  '23514', null, '모르는 태그는 받지 않는다');

select throws_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 9::smallint, 4::smallint, 'right')$$,
    (select id from run_self)),
  '23514', null, '눈금 밖의 값은 받지 않는다');

/** **다시 답하면 고쳐진다** — 행이 늘지 않는다 */
select lives_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 1::smallint, 1::smallint, 'short')$$,
    (select id from run_self)),
  '다시 답할 수 있다');

reset role;
select is(
  (select array[count(*)::int, max(usefulness)::int]
   from public.reading_feedback where reading_run_id = (select id from run_self)),
  array[1, 1],
  '다시 답해도 행은 하나이고 값이 바뀐다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 동의 ───────────────────────────────────────────────────────────────────

reset role;
update public.app_user set improvement_consent = null where id = (select kim from folks);
set local role authenticated;
select pg_temp.acting((select kim from folks));

/**
 * **`null` 도 거절이다.**
 *
 * `if not consent` 라고 적었다면 `null` 이 거절 갈래에 안 들어가고, 아직 묻지도 않은
 * 사람의 답이 그대로 들어왔을 것이다.
 */
select throws_like(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    (select id from run_self)),
  '%동의%',
  '안 물어본 사람의 답은 점수 하나도 받지 않는다');

/** **그래도 사주는 그대로 보인다** — 닫히는 것은 설문 하나뿐이다 */
select is(
  (select count(*)::int from public.my_reading('self')),
  1,
  '설문에 동의하지 않아도 풀이는 그대로 보인다');

select lives_ok(
  $$select * from public.start_reading_run('self', 'fb-self-after-refusal')$$,
  '설문에 동의하지 않아도 새 풀이를 만들 수 있다');

select lives_ok($$select public.set_improvement_consent(true)$$, '동의를 켠다');

select lives_ok(
  format($$select public.leave_reading_feedback(
    %L::uuid, 4::smallint, 4::smallint, 'right', array[]::text[], '두 번째 문단이 맞았어요')$$,
    (select id from run_self)),
  '동의한 뒤에는 답이 들어간다');

/**
 * **철회하면 이미 받은 답까지 지운다.**
 *
 * 「앞으로는 안 받는다」로만 두면 사용자는 자기가 철회한 뒤에도 자기 답이 개선에
 * 쓰이는 것을 모른다. 동의를 근거로 처리하던 것은 동의가 사라지면 근거가 사라진다.
 */
select lives_ok($$select public.set_improvement_consent(false)$$, '동의를 끈다');

reset role;
select is(
  (select count(*)::int from public.reading_feedback
   where respondent_user_id = (select kim from folks)),
  0,
  '철회하면 그때까지 받은 답이 남지 않는다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

select is(
  (select my_feedback from public.my_reading('self')),
  null,
  '철회 뒤에는 화면에도 답이 안 남는다');

select throws_ok(
  $$select public.set_improvement_consent(null)$$,
  '23514', null, '동의 여부를 비워 두고 정할 수는 없다');

select lives_ok($$select public.set_improvement_consent(true)$$, '다시 켤 수 있다');

-- ── 남의 풀이 ───────────────────────────────────────────────────────────────

select pg_temp.acting((select lee from folks));

/** 없는 것과 못 보는 것을 가르지 않는다 — 가르면 남의 시도 id 를 확인하는 문이 된다 */
select throws_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    (select id from run_self)),
  'P0002', null, '남의 성공한 풀이에는 답할 수 없다');

/**
 * **상태로 갈라 답하지 않는다.**
 *
 * 검사 차례가 뒤집혀 있었다 — 상태를 먼저 봤으므로 남의 `running` 시도에는
 * 「완성된 풀이에만 답할 수 있습니다」(`23514`)가, 남의 `succeeded` 시도에는
 * 「찾지 못했습니다」(`P0002`)가 나갔다. 두 답이 다르면 **남의 시도가 어느 상태인지**를
 * 되묻는 문이 된다.
 *
 * 앞의 시험은 성공한 것만 넣어 봐서 이 구멍을 못 잡았다.
 */
select pg_temp.acting((select kim from folks));
create temporary table run_running as
select run_id as id from public.start_reading_run('self', 'fb-open-0001');
grant select on run_running to authenticated, service_role;

select pg_temp.acting((select lee from folks));
select throws_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    (select id from run_running)),
  'P0002', null, '남의 도는 시도도 같은 답으로 거절한다');

reset role;
update public.reading_run set status = 'failed', failure_code = 'call_failed'
where id = (select id from run_running);
set local role authenticated;
select pg_temp.acting((select lee from folks));

select throws_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 4::smallint, 4::smallint, 'right')$$,
    (select id from run_running)),
  'P0002', null, '남의 실패한 시도도 같은 답으로 거절한다');

-- ── 공유 궁합 — 누르지 않은 쪽도 답한다 ─────────────────────────────────────

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

create temporary table matched as select match_id from public.my_matches();
grant select on matched to authenticated, service_role;

reset role;
create temporary table pinned as
select m.low_revision_id as low_rev, m.high_revision_id as high_rev
from public.match m where m.id = (select match_id from matched);
grant select on pinned to authenticated, service_role;
set local role authenticated;

/** **이가 누른다.** 풀이권도 이가 쓰고, 시도의 `user_id` 도 이다 */
select pg_temp.acting((select lee from folks));
create temporary table run_match as
select run_id as id from public.start_reading_run(
  'match', 'fb-match-0001', null, null, (select match_id from matched));
grant select on run_match to authenticated, service_role;

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 공유 궁합', 64::smallint)$$,
    (select id from run_match), (select low_rev from pinned), (select high_rev from pinned)),
  '공유 궁합이 저장된다');

/**
 * **누르지 않은 쪽이 답한다.**
 *
 * 자격을 `reading_run.user_id` 로 물었다면 여기서 막혔을 것이다. 그 글은 양쪽이 읽고,
 * 양쪽의 체감이 다를 수 있다 — 상대의 답은 남길 자리가 없어진다.
 */
select pg_temp.acting((select kim from folks));
select lives_ok(
  format($$select public.leave_reading_feedback(%L::uuid, 5::smallint, 5::smallint, 'right')$$,
    (select id from run_match)),
  '공유 궁합은 누르지 않은 쪽도 답한다');

/** 답은 사람마다다 — 내가 답했다고 상대의 자리가 채워지지 않는다 */
select is(
  (select my_feedback -> 'usefulness' from public.my_reading(
    'match', null, null, (select match_id from matched))),
  to_jsonb(5),
  '내가 답한 것이 내 화면에 선다');

select pg_temp.acting((select lee from folks));
select is(
  (select my_feedback from public.my_reading(
    'match', null, null, (select match_id from matched))),
  null,
  '상대가 답한 것이 내 답으로 세어지지 않는다');

-- ── 표는 안 보인다 ──────────────────────────────────────────────────────────

select throws_ok(
  $$select 1 from public.reading_feedback$$,
  '42501', null, '답을 모아 둔 표는 한 줄도 직접 안 보인다');

select * from finish();
rollback;
