-- 운영자가 읽는 신고와 근거 스냅샷 (G-24 1차판, ADR 0103)
--
-- 여기서 재는 것 여섯.
--
--   1. **운영자가 아니면 아무것도 안 나온다** — 로그인한 사람 · `anon` · `service_role` 셋 다. 표를
--      직접 읽는 길도 운영자에게조차 안 열린다
--   2. **운영자는 목록을 거르고 쪽으로 나눠 읽는다** — 최신부터 30건씩, 검토 여부 · 사유 · 대화 근거
--   3. **한 건의 상단** — 사유 · 덧붙인 말 · 두 계정의 지금 상태 · 검토 시각 · 캡처 시각 · 문맥 범위
--   4. **스냅샷은 베낀 차례대로, 보낸 쪽은 두 계정 중 하나로, 고른 메시지는 정확히 하나** — 대화
--      근거가 없는 신고는 빈 목록이다
--   5. **떠난 사람의 신고(`retention.report`)는 안 나온다** — ADR 0098 의 경계
--   6. **반환형에 이메일 · 출생정보 · 방으로 가는 실마리가 없다** — 안 그리는 것과 안 내주는 것은 다르다
--
-- 세는 것은 이 파일이 만든 행뿐이다(`32_test_isolation`) — 운영자 함수는 표 전체를 내주므로 이 파일의
-- 신고 id 로 거른다. 쪽을 재는 자리만 전체 수를 쓰고, 그 수는 `postgres` 로 같은 표를 세어 견준다.
begin;
select plan(35);

create temporary table folks as
select
  tests.signup('opsr-reporter@example.com') as reporter,
  tests.signup('opsr-reported@example.com') as reported,
  tests.signup('opsr-bystander@example.com') as bystander,
  tests.signup('opsr-leaver@example.com') as leaver,
  tests.signup('opsr-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

create or replace function pg_temp.report(who uuid, whom uuid, why text, said text, at timestamptz)
returns uuid
language sql
as $$
  insert into public.report (reporter_user_id, reported_user_id, reason, detail, created_at)
  values (who, whom, why, said, at) returning id
$$;

/** 시각을 떼어 둔다 — 한 트랜잭션의 `now()` 는 하나라 차례를 못 잰다 */
create temporary table cases as
select
  pg_temp.report(reporter, reported, 'harassment', '밤마다 같은 말을 보냅니다', now() + interval '3 minutes') as chat,
  pg_temp.report(bystander, reported, 'other', null, now() + interval '2 minutes') as plain,
  pg_temp.report(reported, bystander, 'impersonation', null, now() + interval '1 minute') as reviewed,
  pg_temp.report(leaver, bystander, 'inappropriate', '떠날 사람의 신고', now()) as leaving
from folks;
grant select on cases to authenticated, service_role, anon;

/**
 * 스냅샷 — `report_chat_message` 가 베끼는 모양 그대로 손으로 넣는다. 베끼는 문은 `34_chat` 이
 * 잰다. 여기서 재는 것은 **읽는 쪽**이다. 차례를 일부러 섞어 넣는다 — 읽는 문이 `seq` 로 세우는지 본다.
 */
insert into public.chat_report_snapshot
  (report_id, match_id, message_id, context_before, context_after, messages, captured_at)
select c.chat, gen_random_uuid(), gen_random_uuid(), 2, 2,
  jsonb_build_array(
    jsonb_build_object('message_id', gen_random_uuid(), 'seq', 14, 'sender_user_id', f.reporter,
                       'body', '그만 보내 주세요', 'created_at', '2026-09-20T12:04:00Z', 'chosen', false),
    jsonb_build_object('message_id', gen_random_uuid(), 'seq', 11, 'sender_user_id', f.reported,
                       'body', '오늘도 안녕', 'created_at', '2026-09-20T12:01:00Z', 'chosen', false),
    jsonb_build_object('message_id', gen_random_uuid(), 'seq', 12, 'sender_user_id', f.reporter,
                       'body', '네', 'created_at', '2026-09-20T12:02:00Z', 'chosen', false),
    jsonb_build_object('message_id', gen_random_uuid(), 'seq', 13, 'sender_user_id', f.reported,
                       'body', '고른 말', 'created_at', '2026-09-20T12:03:00Z', 'chosen', true),
    jsonb_build_object('message_id', gen_random_uuid(), 'seq', 15, 'sender_user_id', f.reported,
                       'body', '왜요', 'created_at', '2026-09-20T12:05:00Z', 'chosen', false)),
  '2026-09-20T12:06:00Z'
from cases c, folks f;

update public.report set reviewed_at = '2026-09-21T09:00:00Z' where id = (select reviewed from cases);
update public.app_user set status = 'suspended' where id = (select reported from folks);

/** 떠난 사람의 신고는 지워지기 전에 떨어진 자리로 옮겨진다(ADR 0098) */
select public.forget_user((select leaver from folks));

insert into public.operator (user_id, note)
values ((select operator from folks), '시험 — 신고를 읽는 사람');

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

-- ── 1. 운영자가 아니면 아무것도 안 나온다 ───────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select reporter from folks));

select throws_ok($$select * from public.operator_reports()$$,
  '42501', null, '운영자가 아니면 신고 목록을 못 읽는다 — 자기가 낸 신고여도');
select throws_ok(format($$select * from public.operator_report(%L)$$, (select chat from cases)),
  '42501', null, '운영자가 아니면 신고 한 건을 못 읽는다');
select throws_ok(format($$select * from public.operator_report_snapshot(%L)$$, (select chat from cases)),
  '42501', null, '운영자가 아니면 스냅샷을 못 읽는다 — 자기가 고른 메시지여도');
select throws_ok($$select 1 from public.chat_report_snapshot$$,
  '42501', null, '스냅샷 표는 직접 못 읽는다');

set local role anon;
select throws_ok($$select * from public.operator_reports()$$,
  '42501', null, '로그인하지 않은 쪽에는 목록 문이 없다');
select throws_ok(format($$select * from public.operator_report_snapshot(%L)$$, (select chat from cases)),
  '42501', null, '로그인하지 않은 쪽에는 스냅샷 문이 없다');

set local role service_role;
select throws_ok($$select * from public.operator_reports()$$,
  '42501', null, 'service_role 에도 목록 문이 없다 — 그 열쇠가 새면 남의 신고를 읽는 문이 된다');
select throws_ok(format($$select * from public.operator_report(%L)$$, (select chat from cases)),
  '42501', null, 'service_role 에도 한 건 문이 없다');
select throws_ok(format($$select * from public.operator_report_snapshot(%L)$$, (select chat from cases)),
  '42501', null, 'service_role 에도 스냅샷 문이 없다');

reset role;
select ok(
  not has_function_privilege('anon', 'public.operator_reports(boolean, text, boolean, integer)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.operator_report(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.operator_report_snapshot(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.operator_report_snapshot(uuid)', 'EXECUTE'),
  '문은 로그인한 사람에게만 열리고 판정은 함수 안의 `is_operator()` 가 한다');

-- ── 2. 목록 ───────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(
  (select array_agg(l.report_id order by l.created_at desc)
   from public.operator_reports() l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed, c.leaving)),
  (select array[chat, plain, reviewed] from cases),
  '운영자는 남의 신고를 최신부터 읽는다 — 떠난 사람의 신고는 없다');

reset role;
create temporary table expected as
select array['harassment', a.nickname, b.nickname, f.reporter::text, f.reported::text, '5'] as chat_row
from folks f
join public.app_user a on a.id = f.reporter
join public.app_user b on b.id = f.reported;
grant select on expected to authenticated;
set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(
  (select array[l.reason, l.reporter_nickname, l.reported_nickname,
                l.reporter_user_id::text, l.reported_user_id::text, l.snapshot_messages::text]
   from public.operator_reports() l where l.report_id = (select chat from cases)),
  (select chat_row from expected),
  '한 줄에 사유 · 두 계정의 닉네임과 UUID · 저장된 메시지 수가 선다');

select is(
  (select l.snapshot_messages from public.operator_reports() l where l.report_id = (select plain from cases)),
  null::integer,
  '대화 근거가 없는 신고는 메시지 수가 비어 있다 — 0 이 아니다');

select is(
  (select array_agg(l.report_id order by l.created_at desc)
   from public.operator_reports(p_reviewed => false) l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed)),
  (select array[chat, plain] from cases),
  '「검토 전」은 검토 시각이 없는 것만');

select is(
  (select array_agg(l.report_id) from public.operator_reports(p_reviewed => true) l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed)),
  (select array[reviewed] from cases),
  '「검토함」은 검토 시각이 있는 것만');

select is(
  (select array_agg(l.report_id) from public.operator_reports(p_reason => 'other') l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed)),
  (select array[plain] from cases),
  '사유로 거른다');

select is(
  (select array_agg(l.report_id) from public.operator_reports(p_has_snapshot => true) l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed)),
  (select array[chat] from cases),
  '「대화 근거 있음」은 스냅샷이 붙은 것만');

select is(
  (select array_agg(l.report_id order by l.created_at desc)
   from public.operator_reports(p_has_snapshot => false) l, cases c
   where l.report_id in (c.chat, c.plain, c.reviewed)),
  (select array[plain, reviewed] from cases),
  '「대화 근거 없음」은 스냅샷이 없는 것만');

/** 쪽 — 31건을 더 쌓아 한 쪽이 30건에서 끊기는지 본다 */
reset role;
insert into public.report (reporter_user_id, reported_user_id, reason, created_at)
select f.bystander, f.reporter, 'other', now() - make_interval(days => n)
from folks f, generate_series(1, 31) n;
create temporary table everything as
select count(*)::integer as n from public.report;
grant select on everything to authenticated;
set local role authenticated;
select pg_temp.acting((select operator from folks));

select is(
  (select count(*)::integer from public.operator_reports()),
  30,
  '한 쪽은 30건이다');

select is(
  (select pages from public.operator_reports() limit 1),
  (select ceil(n / 30.0)::integer from everything),
  '쪽 수는 거른 결과 전체를 30으로 나눠 올린 것이다');

select ok(
  (select min(created_at) from public.operator_reports(p_page => 0))
    >= (select max(created_at) from public.operator_reports(p_page => 1)),
  '다음 쪽은 앞 쪽보다 오래된 것부터 잇는다');

select is(
  (select count(*)::integer
   from (select report_id from public.operator_reports(p_page => 0)
         intersect
         select report_id from public.operator_reports(p_page => 1)) both_pages),
  0,
  '두 쪽에 같은 신고가 서지 않는다');

select throws_ok($$select * from public.operator_reports(p_page => -1)$$,
  '22023', null, '음수 쪽은 없다');

-- ── 3. 한 건의 상단 ──────────────────────────────────────────────────────────

select is(
  (select array[o.reason, o.detail, o.reporter_status, o.reported_status,
                o.context_before::text, o.context_after::text,
                (o.captured_at = '2026-09-20T12:06:00Z')::text, (o.reviewed_at is null)::text]
   from public.operator_report((select chat from cases)) o),
  array['harassment', '밤마다 같은 말을 보냅니다', 'active', 'suspended', '2', '2', 'true', 'true'],
  '상단에 사유 · 덧붙인 말 · 두 계정의 지금 상태 · 문맥 범위 · 캡처 시각이 서고, 검토 전이다');

select is(
  (select array[(o.captured_at is null)::text, (o.reviewed_at = '2026-09-21T09:00:00Z')::text]
   from public.operator_report((select reviewed from cases)) o),
  array['true', 'true'],
  '대화 근거가 없는 신고는 캡처 시각이 비고, 검토한 신고는 검토 시각이 선다');

-- ── 4. 스냅샷 ────────────────────────────────────────────────────────────────

select is(
  (select array_agg(s.body order by s.ord)
   from public.operator_report_snapshot((select chat from cases))
        with ordinality as s(seq, sent_at, side, body, chosen, ord)),
  array['오늘도 안녕', '네', '고른 말', '그만 보내 주세요', '왜요'],
  '스냅샷은 베낀 차례(seq)대로 나온다');

select is(
  (select array_agg(s.side order by s.seq) from public.operator_report_snapshot((select chat from cases)) s),
  array['reported', 'reporter', 'reported', 'reporter', 'reported'],
  '보낸 쪽은 신고한 사용자 · 신고받은 사용자 둘 중 하나로 옮겨진다');

select is(
  (select array_agg(s.body) from public.operator_report_snapshot((select chat from cases)) s where s.chosen),
  array['고른 말'],
  '고른 메시지는 정확히 하나다');

select is(
  (select s.sent_at from public.operator_report_snapshot((select chat from cases)) s where s.chosen),
  '2026-09-20T12:03:00Z'::timestamptz,
  '메시지 작성 시각은 베낄 때의 값이다');

select is(
  (select count(*)::integer from public.operator_report_snapshot((select plain from cases))),
  0,
  '대화 근거가 없는 신고의 스냅샷은 빈 목록이다');

-- ── 5. 떠난 사람의 신고 ──────────────────────────────────────────────────────

select is(
  (select count(*)::integer from public.operator_report((select leaving from cases))),
  0,
  '떠난 사람의 신고는 한 건 문으로도 안 나온다 — runbook 의 SQL 로만 읽는다');

select throws_ok($$select 1 from retention.report$$,
  '42501', null, '운영자라도 떨어진 자리는 직접 못 읽는다');

-- ── 6. 반환형 ───────────────────────────────────────────────────────────────

reset role;
select unalike(
  pg_get_function_result('public.operator_reports(boolean, text, boolean, integer)'::regprocedure)
    || pg_get_function_result('public.operator_report(uuid)'::regprocedure)
    || pg_get_function_result('public.operator_report_snapshot(uuid)'::regprocedure),
  '%email%',
  '세 문 어디에도 이메일이 안 실린다');

select ok(
  (pg_get_function_result('public.operator_reports(boolean, text, boolean, integer)'::regprocedure)
    || pg_get_function_result('public.operator_report(uuid)'::regprocedure)
    || pg_get_function_result('public.operator_report_snapshot(uuid)'::regprocedure))
  !~ '(birth|solar|lunar|chart|reading|person|match_id|message_id|room|sender)',
  '출생정보 · 명식 · 풀이 · 저장한 사람 · 방과 메시지로 가는 실마리 · 보낸 사람의 UUID 가 반환형에 없다');

select is(
  (select reviewed_at from public.report where id = (select chat from cases)),
  null::timestamptz,
  '읽는 것은 검토 시각을 바꾸지 않는다');

select * from finish();
rollback;
