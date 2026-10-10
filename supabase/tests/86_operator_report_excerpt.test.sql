-- 운영자 신고 목록의 고른 메시지 발췌 (화면 점검 C17, G-24 · ADR 0103 · 0105)
--
-- 여기서 재는 것 넷.
--
--   1. **운영자가 아니면 발췌를 못 얻는다** — 로그인한 사람(신고한 본인 포함) · `anon` · `service_role`. 발췌를 짓는 함수
--      (`report_excerpt`)도 API 역할 어디에도 안 열린다
--   2. **발췌는 신고 당시의 사본에서, 고른 메시지의 첫 줄이다** — 앞의 빈 줄 · 공백은 걷고, 지금의 메시지 표는 안 본다,
--      고른 표시가 둘이면 `seq` 가 앞선 것(상세 화면의 `chosenOnce` 와 같은 고름), 대화 근거가 없으면 `null`
--   3. **길이는 60자다** — 넘으면 59자와 `…`, 60자 꼭 맞으면 그대로
--   4. **목록을 한 번 읽으면 접속기록은 한 줄이고, 그 줄에 그 쪽에서 발췌가 보인 신고 id 가 다 든다** — 쪽 차례로, 발췌가
--      없던 신고는 빼고, 발췌가 하나도 없던 쪽이면 비운다. 본문은 안 든다(ADR 0105 · 그 추기 2026-10-10)
--
-- 세는 것은 이 파일이 만든 행뿐이다(`32_test_isolation`) — 목록은 표 전체를 내주므로 이 파일의 신고 id 로 거른다.
begin;
select plan(21);

create temporary table folks as
select
  tests.signup('opsx-reporter@example.com') as reporter,
  tests.signup('opsx-reported@example.com') as reported,
  tests.signup('opsx-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

create or replace function pg_temp.report(why text, at timestamptz)
returns uuid
language sql
as $$
  insert into public.report (reporter_user_id, reported_user_id, reason, created_at)
  select reporter, reported, why, at from folks returning id
$$;

create temporary table cases as
select
  pg_temp.report('harassment', now() + interval '5 minutes') as multiline,
  pg_temp.report('harassment', now() + interval '4 minutes') as long_line,
  pg_temp.report('harassment', now() + interval '3 minutes') as exact_line,
  pg_temp.report('harassment', now() + interval '2 minutes') as twice_chosen,
  pg_temp.report('other', now() + interval '1 minute') as plain;
grant select on cases to authenticated, service_role, anon;

/** 사본 — 고른 메시지 하나와 그 앞뒤. `report_chat_message` 가 베끼는 모양 그대로다 */
create or replace function pg_temp.snapshot(id uuid, chosen_body text, extra_chosen text default null)
returns void
language sql
as $$
  insert into public.chat_report_snapshot (report_id, match_id, message_id, context_before, context_after, messages)
  select id, gen_random_uuid(), gen_random_uuid(), 1, 1,
    jsonb_build_array(
      jsonb_build_object('seq', 3, 'sender_user_id', f.reporter, 'body', '그만해 주세요',
                         'created_at', '2026-10-10T12:03:00Z', 'chosen', extra_chosen is not null)
        || case when extra_chosen is null then '{}'::jsonb else jsonb_build_object('body', extra_chosen) end,
      jsonb_build_object('seq', 2, 'sender_user_id', f.reported, 'body', chosen_body,
                         'created_at', '2026-10-10T12:02:00Z', 'chosen', true),
      jsonb_build_object('seq', 1, 'sender_user_id', f.reporter, 'body', '안녕하세요',
                         'created_at', '2026-10-10T12:01:00Z', 'chosen', false))
  from folks f
$$;

select pg_temp.snapshot((select multiline from cases), E'\n\n   첫 줄만 보인다  \r\n둘째 줄은 목록에 안 선다\n셋째');
select pg_temp.snapshot((select long_line from cases), repeat('가', 70));
select pg_temp.snapshot((select exact_line from cases), repeat('나', 60));
select pg_temp.snapshot((select twice_chosen from cases), '앞선 고른 말', '뒤의 고른 말');

insert into public.operator (user_id, note)
values ((select operator from folks), '시험 — 신고 목록의 발췌');

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

-- ── 1. 운영자가 아니면 못 얻는다 ────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select reporter from folks));
select throws_ok($$select chosen_excerpt from public.operator_reports()$$,
  '42501', null, '운영자가 아니면 발췌를 못 얻는다 — 자기가 고른 메시지여도');
select throws_ok($$select public.report_excerpt('아무 말')$$,
  '42501', null, '발췌를 짓는 함수는 로그인한 사람에게 안 열린다');

set local role anon;
select throws_ok($$select chosen_excerpt from public.operator_reports()$$,
  '42501', null, '로그인하지 않은 쪽에는 목록 문이 없다');

set local role service_role;
select throws_ok($$select chosen_excerpt from public.operator_reports()$$,
  '42501', null, 'service_role 에도 목록 문이 없다');

reset role;
select ok(
  not has_function_privilege('anon', 'public.report_excerpt(text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.report_excerpt(text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.report_excerpt(text)', 'EXECUTE')
  and not has_function_privilege('public', 'public.report_excerpt(text)', 'EXECUTE'),
  '발췌 함수는 API 역할 넷 어디에도 안 열린다 — 목록 문 안에서만 쓰인다');

-- ── 2 · 3. 발췌의 모양 ─────────────────────────────────────────────────────────

/** 목록은 **한 번만** 읽는다 — 접속기록의 줄 수를 4 에서 잰다 */
create temporary table listed (report_id uuid, chosen_excerpt text);
grant insert, select on listed to authenticated;

set local role authenticated;
select pg_temp.acting((select operator from folks));

insert into listed
select l.report_id, l.chosen_excerpt from public.operator_reports() l, cases c
where l.report_id in (c.multiline, c.long_line, c.exact_line, c.twice_chosen, c.plain);

select is((select chosen_excerpt from listed where report_id = (select multiline from cases)),
  '첫 줄만 보인다',
  '고른 메시지의 첫 줄 — 앞의 빈 줄과 앞뒤 공백 · 줄 끝의 \r 은 걷는다');

select is((select chosen_excerpt from listed where report_id = (select long_line from cases)),
  repeat('가', 59) || '…',
  '60자를 넘으면 59자와 말줄임표');
select is((select char_length(chosen_excerpt) from listed where report_id = (select long_line from cases)),
  60,
  '말줄임표를 붙여도 60자다');
select is((select chosen_excerpt from listed where report_id = (select exact_line from cases)),
  repeat('나', 60),
  '60자 꼭 맞으면 그대로 — 말줄임표가 없다');
select ok((select bool_and(char_length(chosen_excerpt) <= 60) from listed),
  '어느 발췌도 60자를 안 넘는다');

select is((select chosen_excerpt from listed where report_id = (select twice_chosen from cases)),
  '앞선 고른 말',
  '고른 표시가 둘이면 seq 가 앞선 것 — 상세 화면의 고름과 같다');

select is((select chosen_excerpt from listed where report_id = (select plain from cases)),
  null::text,
  '대화 근거가 없는 신고는 발췌가 비어 있다');

-- ── 4. 접속기록 ──────────────────────────────────────────────────────────────

reset role;
select is(public.report_excerpt(E' \n \n '), null::text, '빈 본문은 발췌가 없다 — 빈 글자가 아니라');

select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select operator from folks) and a.action = 'reports.list'),
  1,
  '발췌가 실린 목록을 한 번 읽으면 접속기록은 한 줄이다 — 신고마다가 아니다');

select is(
  (select count(*)::integer from audit.operator_access a
   where a.actor_user_id = (select operator from folks)
     and to_jsonb(a)::text ~ '(첫 줄만|가가가|나나나|고른 말)'),
  0,
  '접속기록에 발췌(메시지 본문)가 안 들어간다');

create temporary table logged as
select a.target_report_ids as ids from audit.operator_access a
where a.actor_user_id = (select operator from folks) and a.action = 'reports.list';

select is(
  (select array_agg(x order by o)
   from logged, unnest(ids) with ordinality u(x, o), cases c
   where x in (c.multiline, c.long_line, c.exact_line, c.twice_chosen, c.plain)),
  (select array[multiline, long_line, exact_line, twice_chosen] from cases),
  '그 한 줄에 발췌가 보인 신고 id 가 쪽 차례로 다 든다 — 발췌가 없던 신고(대화 근거 없음)는 빠진다');

select is(
  (select cardinality(ids) from logged),
  (select count(*)::integer from public.report r
   join public.chat_report_snapshot s on s.report_id = r.id
   where exists (select 1 from jsonb_array_elements(s.messages) e where (e ->> 'chosen')::boolean)),
  '적힌 id 의 수는 그 쪽에서 발췌가 선 줄의 수다 — 더도 덜도 아니다');

/** 발췌가 하나도 없는 쪽 — 대화 근거 없음으로 거른다 */
set local role authenticated;
select pg_temp.acting((select operator from folks));
select ok((select count(*) >= 1 from public.operator_reports(p_has_snapshot => false)),
  '운영자는 대화 근거 없는 신고만 거른 쪽을 읽는다');
reset role;

select is(
  (select array_agg(a.target_report_ids is null order by a.id) from audit.operator_access a
   where a.actor_user_id = (select operator from folks) and a.action = 'reports.list'),
  array[false, true],
  '발췌가 하나도 안 보인 쪽의 줄은 id 칸이 비어 있다 — 빈 배열이 아니라');

select throws_ok(
  format($$insert into audit.operator_access (channel, actor_user_id, action, target_report_id, outcome, target_report_ids)
           values ('app', %L, 'reports.detail', %L, 'allowed', array[%L::uuid])$$,
         (select operator from folks), (select plain from cases), (select plain from cases)),
  '23514', null, 'id 들의 칸은 목록 줄에만 선다');

select throws_ok(
  format($$insert into audit.operator_access (channel, actor_user_id, action, outcome, target_report_ids)
           values ('app', %L, 'reports.list', 'allowed', '{}')$$, (select operator from folks)),
  '23514', null, '빈 배열은 안 받는다 — 없으면 null 이다');

select * from finish();
rollback;
