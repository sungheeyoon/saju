-- 운영자의 거절된 쓰기가 접속기록에 한 줄로 남는다 (`20261219090000`, G-111 R-4, ADR 0191)
--
--   1. **운영자의 거절은 `refused`** — 앱이 거절을 받은 뒤 부르는 `note_operator_refusal` 이 대상 id 와 `refused=<SQLSTATE>` 만 적는다
--   2. **운영자가 아니면 안 적는다** — 그 거절은 `note_operator_denial` 의 `denied` 다
--   3. **모양** — 쓰기 동작 여덟 밖이거나, 코드가 SQLSTATE · `other` 가 아니거나 `42501` 이면 `22023`
--   4. **표가 막는다** — `refused` 는 앱의 운영자 쓰기에만, 거른 조건 칸이 `refused=<코드>` 로 끝날 때만 선다
--   5. **한 시간에 서른 줄** — 넘으면 조용히 끝난다
--   6. **열린 곳** — `authenticated` 만. anon · 서버 열쇠에는 안 열린다
begin;
select plan(12);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('wr-operator@example.com') as operator,
  tests.signup('wr-busy@example.com') as busy,
  tests.signup('wr-member@example.com') as member,
  tests.signup('wr-stranger@example.com') as stranger,
  gen_random_uuid() as report,
  gen_random_uuid() as order_id;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note)
values ((select operator from folks), '시험 — 거절된 쓰기'), ((select busy from folks), '시험 — 거절된 쓰기');

/** 이 파일의 사람 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.lines(who uuid)
returns table (action text, target uuid, filter text, outcome text)
language sql security definer as $$
  select a.action, a.target_report_id, a.filter_summary, a.outcome from audit.operator_access a
  where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.lines(uuid) to authenticated;

set local role authenticated;

-- ── 1. 운영자의 거절 ─────────────────────────────────────────────────────────

select pg_temp.acting((select operator from folks));

select public.note_operator_refusal('members.suspend', '55000', null, (select member from folks));
select public.note_operator_refusal('reports.review', '22023', (select report from folks));
select public.note_operator_refusal('credits.refund_hold', '23514', null, null, (select order_id from folks));
select public.note_operator_refusal('credits.grant', 'other', null, (select member from folks));

select results_eq(
  format($$select action, target, filter, outcome from pg_temp.lines(%L)$$, (select operator from folks)),
  format($$values ('members.suspend', null::uuid, 'user=%1$s refused=55000', 'refused'),
                  ('reports.review', %2$L::uuid, 'refused=22023', 'refused'),
                  ('credits.refund_hold', null::uuid, 'order=%3$s refused=23514', 'refused'),
                  ('credits.grant', null::uuid, 'user=%1$s refused=other', 'refused')$$,
         (select member from folks), (select report from folks), (select order_id from folks)),
  '거절마다 한 줄 — 대상 id 와 거절 코드만, 결과는 refused');

-- ── 3. 모양 ──────────────────────────────────────────────────────────────────

select throws_ok($$select public.note_operator_refusal('members.find', '55000')$$, '22023', null,
  '읽기 동작은 받지 않는다 — 쓰기 여덟만');
select throws_ok($$select public.note_operator_refusal('members.suspend', '42501')$$, '22023', null,
  '42501 은 거절(denied)의 길이다');
select throws_ok($$select public.note_operator_refusal('members.suspend', '다른 운영자가 먼저 처리했습니다.')$$, '22023', null,
  '오류 문장은 받지 않는다 — 코드만');
select throws_ok($$select public.note_operator_refusal('members.suspend', null)$$, '22023', null,
  '코드가 없으면 받지 않는다');

-- ── 2. 운영자가 아니면 ───────────────────────────────────────────────────────

select pg_temp.acting((select stranger from folks));
select public.note_operator_refusal('members.suspend', '55000', null, (select member from folks));
select is((select count(*)::integer from pg_temp.lines((select stranger from folks))), 0,
  '운영자가 아니면 아무것도 안 적는다');

-- ── 5. 한 시간에 서른 줄 ─────────────────────────────────────────────────────

select pg_temp.acting((select busy from folks));
select count(*) from (select public.note_operator_refusal('credits.revoke', '55000') from generate_series(1, 35)) x;
select is((select count(*)::integer from pg_temp.lines((select busy from folks))), 30,
  '한 사람이 한 시간에 서른 줄을 넘게 적지 못한다');

reset role;

-- ── 4. 표가 막는다 ───────────────────────────────────────────────────────────

select throws_ok(
  format($$insert into audit.operator_access (channel, actor_user_id, action, filter_summary, outcome)
           values ('app', %L, 'members.find', 'refused=55000', 'refused')$$, (select operator from folks)),
  '23514', null, '읽기 동작에는 refused 가 서지 않는다');
select throws_ok(
  format($$insert into audit.operator_access (channel, actor_user_id, action, filter_summary, outcome)
           values ('app', %L, 'members.suspend', 'user=x 메모', 'refused')$$, (select operator from folks)),
  '23514', null, 'refused 줄은 거절 코드로 끝난다');
select throws_ok(
  format($$insert into audit.operator_access (channel, actor_user_id, action, filter_summary, outcome)
           values ('app', %L, 'members.suspend', null, 'failed')$$, (select operator from folks)),
  '23514', null, '결과는 셋 — allowed · denied · refused');

-- ── 6. 열린 곳 ───────────────────────────────────────────────────────────────

select ok(not has_function_privilege('anon', 'public.note_operator_refusal(text, text, uuid, uuid, uuid)', 'execute'),
  'anon 에는 안 열린다');
select ok(not has_function_privilege('service_role', 'public.note_operator_refusal(text, text, uuid, uuid, uuid)', 'execute'),
  '서버 열쇠에는 안 열린다');

select * from finish();
rollback;
