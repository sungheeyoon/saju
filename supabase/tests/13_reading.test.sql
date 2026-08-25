-- 현재 AI 결과 — **대상마다 하나, 성공한 요청만 교체, 이전 결과는 없다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **표는 한 줄도 안 보인다.** 근거와 프롬프트가 그 안에 있다.
-- 2. **kind 마다 접근 판정이 다르고 서로를 열지 않는다.** 내 엣지에 없는 사람으로
--    비공개 궁합을 만들 수 없고, Match 는 매인 판본으로만 난다.
-- 3. **교체는 통째로 일어난다.** 같은 대상에 두 번 저장해도 행은 하나이고 옛 값은
--    어디에도 남지 않는다.
-- 4. **판본을 든다.** 그래서 `revisions_in_use()` 가 이 표를 자동으로 본다(ADR 0011) —
--    표 이름을 적어 둔 목록이 아니라 FK 에서 읽기 때문이다.
begin;
select plan(44);

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
 * 결과 한 벌을 저장한다 — **열쇠인 척한다.**
 *
 * `save_reading` 은 `authenticated` 에게 닫혀 있다(ADR 0013). `security definer` 로
 * 감싸 소유자 권한으로 부르는 것은 서버가 열쇠로 부르는 것과 같은 자리다. 닫혀 있다는
 * 사실 자체는 아래에서 따로 잰다.
 *
 * 대상을 인자로 받지 않는다 — 시도 하나가 곧 대상이다.
 */
create or replace function pg_temp.save(
  run uuid, rev_a uuid, rev_b uuid, body text, score smallint)
returns uuid
language sql
security definer
as $$
  select public.save_reading(
    run, rev_a, rev_b, body, score,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

set local role authenticated;

create temporary table folks as
select
  pg_temp.participant('kim-read@example.com', '김읽', pg_temp.summary(4, 4, 0, 0, 0)) as kim,
  pg_temp.participant('lee-read@example.com', '이읽', pg_temp.summary(0, 0, 4, 4, 0)) as lee,
  pg_temp.participant('choi-read@example.com', '최읽', pg_temp.summary(0, 0, 0, 0, 8)) as choi;
grant select on folks to authenticated, service_role;

-- 김이 가족을 하나 등록한다 — 비공개 궁합의 대상이다.
select pg_temp.acting((select kim from folks));
create temporary table mine as
select public.create_managed_person(
  '엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10', 'female', '부산', 'jo', 'localMean'
) as mom;
grant select on mine to authenticated, service_role;

reset role;

/** 다른 시험이 남긴 참여자는 이 파일의 관심 밖이다(10·11번과 같은 이유) */
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
  lee_person.id as lee_person,
  kim_person.current_revision_id as kim_revision,
  lee_person.current_revision_id as lee_revision,
  (select current_revision_id from public.person where id = (select mom from mine)) as mom_revision
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
 * 사람의 지금 판본 id 를 묻는 문**이 된다.
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
      '00000000-0000-0000-0000-000000000000'::uuid, null, null, 'x', null,
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
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 한 줄로', null)$$,
    (select id from run_self), (select kim_revision from people)),
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
  (select from_current_revision from public.my_reading('self')),
  true,
  '지금 판본으로 난 결과다');

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
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 다시 썼다', null)$$,
    (select id from run_again), (select kim_revision from people)),
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

-- ── 판본을 든다 — FK 가 곧 보존 선언이다 ────────────────────────────────────

reset role;

/**
 * ADR 0011 은 **표 이름이 아니라 FK 에** 정책을 적었다. 그래서 이 표가 생긴 것만으로
 * 참조 목록이 넓어져야 한다 — 아무도 정리 함수를 다시 고치지 않았는데도.
 */
select is(
  (select count(*)::int
   from pg_constraint k
   join pg_class c on c.oid = k.conrelid
   where k.contype = 'f'
     and k.confrelid = 'public.person_chart_revision'::regclass
     and c.relname = 'reading'),
  2,
  '결과가 판본 둘을 FK 로 든다');

select is(
  (select count(distinct u.id)::int from public.revisions_in_use(
     array[(select kim_revision from people)]) as u(id)),
  1,
  '결과가 든 판본은 참조로 잡힌다');
set local role authenticated;
select pg_temp.acting((select kim from folks));

-- ── 만드는 동안 입력이 바뀌면 저장하지 않는다 ───────────────────────────────

create temporary table run_stale as
select run_id as id from public.start_reading_run('self', 'key-self-0003');
grant select on run_stale to authenticated, service_role;

select public.add_person_revision(
  (select kim_person from people),
  'solar', '1990-05-15', '1990-05-15', '15:30', 'female', '서울', 'jo', 'localMean');

select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 낡은 판본', null)$$,
    (select id from run_stale), (select kim_revision from people)),
  '23514', null, '만드는 동안 입력이 바뀌면 저장하지 않는다');

/**
 * **거절당한 시도는 부르는 쪽이 닫는다.**
 *
 * DB 안에서 닫으면 `raise` 가 그 `update` 를 되돌린다. 안 닫으면 그 대상이 만료까지
 * 잠겨 다시 눌러도 아무 일이 일어나지 않는다 — 앱이 하는 일을 여기서도 그대로 한다.
 */
select lives_ok(
  format($$select public.fail_reading_run(%L::uuid, 'save-rejected')$$,
    (select id from run_stale)),
  '거절당한 시도를 닫는다');

select is(
  (select status from public.my_last_reading_run('self')),
  'failed',
  '화면이 「지난번에 실패했다」고 말할 근거가 남는다');

/** 거절당해도 **직전 성공 결과는 그대로다** */
select is(
  (select output from public.my_reading('self')),
  '## 다시 썼다',
  '실패한 저장이 현재 결과를 건드리지 않는다');

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
 * 판본은 **사람 차례**를 따라간다(작은 Person id 가 앞). 판본 id 로 줄을 세우면
 * 저장이 거절된다 — 그것이 이 시험이 한 번 걸려 본 자리다.
 */
select lives_ok(
  format($$select pg_temp.save(%L::uuid,
      (select p.current_revision_id from public.person p where p.id = least(%L::uuid, %L::uuid)),
      (select p.current_revision_id from public.person p where p.id = greatest(%L::uuid, %L::uuid)),
      '## 둘 사이', 71::smallint)$$,
    (select id from run_private),
    (select mom from mine), (select kim_person from people),
    (select mom from mine), (select kim_person from people)),
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
select public.refresh_discovery_summary(
  (select kim_person from people), pg_temp.summary(4, 4, 0, 0, 0));

-- 요청은 **노출 기록에 매인다**(ADR 0009). 목록을 먼저 열어야 청할 수 있다.
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

-- 매인 판본은 `match` 행에 있다. 그 표는 당사자에게도 한 줄도 안 열리므로 여기서만
-- `postgres` 로 읽는다 — 시험이 재려는 것은 「그 판본으로만 저장된다」이지 열람이 아니다.
reset role;
create temporary table pinned as
select m.low_revision_id as low_rev, m.high_revision_id as high_rev
from public.match m where m.id = (select match_id from matched);
grant select on pinned to authenticated, service_role;
set local role authenticated;
select pg_temp.acting((select lee from folks));

create temporary table run_match as
select run_id as id from public.start_reading_run(
  'match', 'key-match-0001', null, null, (select match_id from matched));
grant select on run_match to authenticated, service_role;

/**
 * **매인 판본이 아니면 저장하지 않는다.** 동의한 대상이 그 판본이라 결과도 그것으로
 * 나야 한다(ADR 0010). 지금 판본을 적어 넣는 길이 있으면 그 약속이 앱 코드에만 남는다.
 */
select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 공유', 64::smallint)$$,
    (select id from run_match), (select kim_revision from people), (select lee_revision from people)),
  '23514', null, '매인 판본이 아니면 공유 결과를 저장하지 않는다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 공유 궁합', 64::smallint)$$,
    (select id from run_match), (select low_rev from pinned), (select high_rev from pinned)),
  '매인 판본으로는 저장된다');

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

/**
 * 알림은 **상대에게만** 선다 — 누른 사람은 결과를 그 자리에서 본다.
 * 여기서 만든 사람은 이(수락한 쪽)이므로 알림은 김에게 가야 한다.
 */
select is(
  (select count(*)::int from public.my_notifications() n where n.kind = 'reading_ready'),
  0,
  '누른 사람에게는 알림이 서지 않는다');

select pg_temp.acting((select kim from folks));
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
  '이읽',
  '준비 완료 알림이 상대 별명을 든다');

/**
 * **일어나지 않는 사건은 검사식에 적지 않는다.** 생성이 요청과 같은 왕복에서 끝나므로
 * 실패는 누른 사람 화면에 서고 시도 기록이 그것을 든다.
 */
reset role;
select is(
  (select count(*)::int from pg_constraint
   where conname = 'notification_kind_check'
     and pg_get_constraintdef(oid) like '%reading_failed%'),
  0,
  '아직 일어나지 않는 알림은 검사식에 없다');

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
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 늦게 돌아왔다', null)$$,
    (select id from run_first), (select current_revision_id from public.person
      where id = (select kim_person from people))),
  '23514', null, '그 사이에 새 시도가 열렸으면 늦은 저장을 거절한다');

select is(
  (select output from public.my_reading('self')),
  '## 다시 썼다',
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
  format($$select pg_temp.save(%L::uuid, %L::uuid, %L::uuid, '## 차단 뒤 결과', 63::smallint)$$,
    (select id from run_blocked_match),
    (select low_rev from pinned), (select high_rev from pinned)),
  'P0002', null, '만드는 동안 차단되면 공유 결과를 저장하지 않는다');

/** 계정 제재도 같은 자격 질문을 지난다. */
select pg_temp.acting((select choi from folks));
create temporary table run_suspended_self as
select run_id as id from public.start_reading_run('self', 'key-self-suspended-0001');
grant select on run_suspended_self to authenticated, service_role;

reset role;
create temporary table suspended_input as
select p.current_revision_id as revision
from public.app_user u join public.person p on p.id = u.self_person_id
where u.id = (select choi from folks);
grant select on suspended_input to authenticated, service_role;
update public.app_user set status = 'suspended' where id = (select choi from folks);
set local role authenticated;
select pg_temp.acting((select choi from folks));

select throws_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 제재 뒤 결과', null)$$,
    (select id from run_suspended_self), (select revision from suspended_input)),
  'P0002', null, '만드는 동안 계정이 중지되면 자기 풀이도 저장하지 않는다');

-- 열쇠의 허용 집합은 설명이 아니라 실제 ACL 로 **정확히 둘**이다.
reset role;
select is(
  (select array_agg(p.proname::text order by p.proname::text)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  array['match_calculation_inputs', 'save_reading']::text[],
  'service_role 이 부를 수 있는 public 함수는 두 개뿐이다');

select * from finish();
rollback;
