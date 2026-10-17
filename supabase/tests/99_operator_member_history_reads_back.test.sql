-- 처분 이력이 신고로 건 정지를 결과를 바꾼 뒤에도 잃지 않고, 풀이권 이력은 첫 줄까지 거슬러 읽힌다 (`20261218090000`,
-- G-111 ① · ③, ADR 0188 · 0189 · 0187 덧)
--
--   1. **결과를 바꿔도 정지는 이력에 남는다** — 신고의 이용 정지 결정으로 정지한 뒤 그 신고를 「조치 없음」으로 바꾸면 계정은 정지인
--      채이고, 회원 화면의 처분 이력과 신고 상세의 최근 셋에 그 정지(상태 이력, 갈래 `report`)가 선다
--   2. **결과가 그대로면 두 번 세지 않는다** — 이용 정지 결정이 서 있는 동안은 신고 줄 하나뿐이다
--   3. **커서** — 300줄 넘는 이력을 30줄씩 끝까지 읽으면 모든 줄이 한 번씩, 같은 시각의 줄도 빠지거나 겹치지 않는다. 인자 셋의
--      부름(지금 운영의 앱)은 그대로 맨 앞 쪽이다. 커서가 반쪽이거나 모양이 틀리면 `22023`
--   4. **접속기록** — 쪽마다 `members.credit_history` 한 줄, id 만
--
-- 빼는 조건을 옛 것(`c.reason is distinct from 'report'`)으로 되돌리면 1 이, `not exists` 를 빼면 2 가, 커서의 같은 시각 갈래를
-- 빼면 3 이 붉다.
begin;
select plan(16);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('hb-changed@example.com') as changed,
  tests.signup('hb-kept@example.com') as kept,
  tests.signup('hb-reporter@example.com') as reporter,
  tests.signup('hb-ledger@example.com') as ledger,
  tests.signup('hb-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 이력 거슬러 읽기');

create or replace function pg_temp.report(who uuid, whom uuid)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, 'inappropriate') returning id
$$;
create temporary table cases as
select pg_temp.report(reporter, changed) as changed_case, pg_temp.report(reporter, kept) as kept_case from folks;
grant select on cases to authenticated, service_role, anon;

create or replace function pg_temp.status(who uuid) returns text language sql security definer as $$
  select a.status from public.app_user a where a.id = who
$$;
create or replace function pg_temp.lines(who uuid)
returns table (action text, filter text)
language sql security definer as $$
  select a.action, a.filter_summary from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
grant execute on function pg_temp.status(uuid), pg_temp.lines(uuid) to authenticated;

/** 처분 이력 한 사람의 줄 — `source:kind:reason` */
create or replace function pg_temp.sanctions(who uuid) returns text[] language sql as $$
  select coalesce(array_agg(l ->> 'source' || ':' || (l ->> 'kind') || ':' || coalesce(l ->> 'reason', '-')
                            order by l ->> 'source', l ->> 'kind'), '{}')
  from public.operator_member_sanctions(who) s, jsonb_array_elements(s.lines) l
$$;
/** 신고 상세의 대상 요약 — 신고받은 계정의 최근 셋 `kind:reason` */
create or replace function pg_temp.recent(report uuid) returns text[] language sql as $$
  select coalesce(array_agg((l ->> 'kind') || ':' || coalesce(l ->> 'reason', '-') order by l ->> 'kind'), '{}')
  from public.operator_report_target(report) t, jsonb_array_elements(t.recent) l
  where t.side = 'reported'
$$;

-- ── 1 · 2. 처분 이력 ────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select r.review_version from public.operator_review_report(
  (select changed_case from cases), 'suspension', '판단 근거', (select changed from folks), null, 0, gen_random_uuid()) r;
select r.review_version from public.operator_review_report(
  (select kept_case from cases), 'suspension', '판단 근거', (select kept from folks), null, 0, gen_random_uuid()) r;

select is(pg_temp.sanctions((select changed from folks)), array['report:suspension:-'],
  '이용 정지 결정이 서 있는 동안은 신고 줄 하나뿐이다 — 상태 이력 줄과 두 번 세지 않는다');

select r.review_version from public.operator_review_report(
  (select changed_case from cases), 'no_action', '다시 보니 조치할 것이 없다', null, null, 1, gen_random_uuid()) r;

select is(pg_temp.status((select changed from folks)), 'suspended',
  '결과를 「조치 없음」으로 바꿔도 계정은 정지인 채다 — 해제는 따로다(ADR 0188)');
select is(pg_temp.sanctions((select changed from folks)), array['status:suspended:report'],
  '결과를 바꾼 뒤에는 그 정지가 상태 이력 줄(갈래 신고 처분)로 선다 — 정지가 이력에서 사라지지 않는다');
select is(
  (select array[l ->> 'report_id', l ->> 'recorded', (l ->> 'actor_nickname' is not null)::text]
   from public.operator_member_sanctions((select changed from folks)) s, jsonb_array_elements(s.lines) l),
  array[(select changed_case from cases)::text, 'true', 'true'],
  '그 줄은 관련 신고 · 실행자를 든다 — 화면이 「신고 내용 보기」를 단다');
select is(pg_temp.recent((select changed_case from cases)), array['suspended:report'],
  '신고 상세의 최근 셋도 같은 규칙이다 — 결과를 바꾼 뒤 정지가 선다');

select is(pg_temp.sanctions((select kept from folks)), array['report:suspension:-'],
  '다른 계정의 결과가 그대로인 정지는 여전히 한 줄이다');
select is(pg_temp.recent((select kept_case from cases)), array['suspension:-'],
  '신고 상세의 최근 셋도 결과가 그대로면 한 칸이다');

-- ── 3 · 4. 풀이권 이력의 커서 ────────────────────────────────────────────────────

reset role;
-- 지급 장부 320줄 — 둘씩 같은 시각이라 같은 시각의 줄 사이도 커서가 가른다
insert into public.reading_credit_grant_entry (user_id, kind, credits, reason, note, request_id, actor_user_id, at)
select (select ledger from folks), 'grant', 1, 'operator', '시험 ' || i, gen_random_uuid(), (select operator from folks),
       timestamptz '2026-01-01 00:00:00+00' + make_interval(mins => i / 2)
from generate_series(1, 320) i;

create temporary table pages (page integer, at timestamptz, line_key text, note text);
grant select, insert on pages to authenticated;

set local role authenticated;
select pg_temp.acting((select operator from folks));

do $$
declare
  n integer := 0;
  last_at timestamptz;
  last_key text;
  got integer;
begin
  loop
    n := n + 1;
    insert into pages
    select n, h.at, h.line_key, h.note
    from public.operator_member_credit_history((select ledger from folks), 'all', 30, last_at, last_key) h;
    get diagnostics got = row_count;
    exit when got < 30 or n > 20;
    select p.at, p.line_key into last_at, last_key from pages p where p.page = n
    order by p.at, p.line_key limit 1;
  end loop;
end;
$$;

select is((select count(*)::integer from pages), 320, '30줄씩 끝까지 읽으면 320줄이 다 나온다 — 300 에서 멈추지 않는다');
select is((select count(distinct line_key)::integer from pages), 320, '어느 줄도 두 번 나오지 않는다');
select is((select max(page) from pages), 11, '쪽은 열하나다 — 마지막 쪽은 20줄');
select is((select note from pages order by at, line_key limit 1), '시험 1',
  '마지막 쪽의 끝이 장부의 첫 줄이다');
select is(
  (select count(*)::integer from public.operator_member_credit_history((select ledger from folks), 'all', 30)),
  30, '인자 셋의 부름(지금 운영의 앱)은 그대로 맨 앞 쪽이다');
select throws_ok(
  format($$select * from public.operator_member_credit_history(%L, 'all', 30, now(), null)$$, (select ledger from folks)),
  '22023', null, '커서가 반쪽이면 거절한다');
select throws_ok(
  format($$select * from public.operator_member_credit_history(%L, 'all', 30, now(), 'money:1')$$, (select ledger from folks)),
  '22023', null, '모르는 종류의 열쇠는 거절한다');

reset role;
select is(
  (select count(*)::integer from pg_temp.lines((select operator from folks)) l
   where l.action = 'members.credit_history' and l.filter = 'user=' || (select ledger from folks)),
  12, '쪽마다 접속기록 한 줄 — 열하나와 인자 셋의 한 번');
select ok(
  not exists (select 1 from pg_temp.lines((select operator from folks)) l
              where l.action = 'members.credit_history' and l.filter like '%:%'),
  '커서는 접속기록에 안 적는다 — id 만');

select * from finish();
rollback;
