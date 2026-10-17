-- 운영자가 회원 화면에서 이용 정지 · 해제를 하고 처분 이력을 한 목록으로 본다 (`20261216090000`, G-111 ③, ADR 0189)
--
--   1. **운영자만** — 정지 · 해제 · 처분 이력 문은 운영자가 아니면 `42501` 이고 되감긴다. 서버 열쇠 · anon 에는 안 열린다
--   2. **모양** — 읽은 버전 · 요청 번호가 없거나, 갈래가 화면 몫이 아니거나(`report` · `deletion_withdrawn`), 메모가 비었거나
--      200자를 넘으면 `22023`
--   3. **버전** — 읽은 버전(그 계정의 상태 이력 줄 수)이 지금과 다르면 `55000`
--   4. **같은 요청은 한 번** — 같은 요청 번호는 버전을 견주기 전에 찾아 첫 줄을 돌려주고 줄을 더하지 않는다. 같은 번호에 다른
--      갈래 · 다른 실행자면 거절한다
--   5. **지금 상태** — 정지는 이용 중만(이미 정지 `55000`, 탈퇴 대기 `23514`), 운영자 계정은 거절(G-111-10). 해제는 정지만
--   6. **이력** — 정지 · 해제마다 실행자 · 갈래 · 메모가 남고, 신고의 「이용 정지 결정」 기록은 해제해도 그대로다
--   7. **처분 이력** — 신고의 경고 · 이용 정지 결정과 상태 이력이 한 목록, 실행자는 닉네임, 공통 함수 밖의 줄은 `recorded = false`
--   8. **접속기록** — 쓰기 · 읽기마다 한 줄, 거른 조건 칸에 id 만(메모는 안 적는다)
begin;
select plan(37);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('ms-member@example.com') as member,
  tests.signup('ms-reporter@example.com') as reporter,
  tests.signup('ms-leaver@example.com') as leaver,
  tests.signup('ms-loose@example.com') as loose,
  tests.signup('ms-operator@example.com') as operator,
  tests.signup('ms-colleague@example.com') as colleague,
  tests.signup('ms-stranger@example.com') as stranger;
grant select on folks to authenticated, service_role, anon;

create temporary table operator_name as
select a.nickname from public.app_user a, folks f where a.id = f.operator;
grant select on operator_name to authenticated;

insert into public.operator (user_id, note)
values ((select operator from folks), '시험 — 회원 정지'), ((select colleague from folks), '시험 — 회원 정지');

create temporary table ids (label text primary key, id uuid);
insert into ids values
  ('suspend', gen_random_uuid()), ('again', gen_random_uuid()), ('lift', gen_random_uuid()),
  ('denied', gen_random_uuid()), ('warn', gen_random_uuid());
grant select on ids to authenticated, service_role, anon;

create or replace function pg_temp.id(label text) returns uuid language sql as $$ select id from ids where ids.label = $1 $$;

create or replace function pg_temp.suspend(
  who uuid, reason text, seen integer, request uuid, note text default '운영 메모')
returns text language sql as $$
  select s.replayed::text from public.operator_suspend_member(who, reason, note, seen, request) s
$$;
create or replace function pg_temp.lift(
  who uuid, reason text, seen integer, request uuid, note text default '해제 메모')
returns text language sql as $$
  select s.replayed::text from public.operator_unsuspend_member(who, reason, note, seen, request) s
$$;

/** 이 파일의 사람 줄만 센다 — 표는 전역이다 */
create or replace function pg_temp.changes(who uuid)
returns table (to_status text, reason text, note text, actor uuid, request uuid)
language sql security definer as $$
  select c.to_status, c.reason, c.note, c.actor_user_id, c.request_id
  from public.account_status_change c where c.user_id = who order by c.at, c.id
$$;
create or replace function pg_temp.lines(who uuid)
returns table (action text, filter text, outcome text)
language sql security definer as $$
  select a.action, a.filter_summary, a.outcome from audit.operator_access a where a.actor_user_id = who order by a.id
$$;
create or replace function pg_temp.status(who uuid) returns text language sql security definer as $$
  select a.status from public.app_user a where a.id = who
$$;
create or replace function pg_temp.entry(label text) returns text language sql security definer as $$
  select c.id::text from public.account_status_change c where c.request_id = pg_temp.id(label)
$$;
grant execute on function pg_temp.changes(uuid), pg_temp.lines(uuid), pg_temp.status(uuid), pg_temp.entry(text)
  to authenticated;

-- ── 1. 운영자만 ─────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select stranger from folks));

select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, %L)$$, (select member from folks), pg_temp.id('denied')),
  '42501', null, '운영자가 아니면 정지하지 못한다');
select throws_ok(
  format($$select pg_temp.lift(%L, 'appeal', 0, %L)$$, (select member from folks), gen_random_uuid()),
  '42501', null, '운영자가 아니면 해제하지 못한다');
select throws_ok(
  format($$select * from public.operator_member_sanctions(%L)$$, (select member from folks)),
  '42501', null, '운영자가 아니면 처분 이력을 못 읽는다');
select is(pg_temp.status((select member from folks)), 'active', '거절된 정지는 계정을 바꾸지 않는다');

reset role;
select ok(
  not has_function_privilege('service_role', 'public.operator_suspend_member(uuid, text, text, integer, uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.operator_unsuspend_member(uuid, text, text, integer, uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.operator_member_sanctions(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated',
    'public.screen_change_member_status(text, uuid, text, text, integer, uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.operator_suspend_member(uuid, text, text, integer, uuid)', 'EXECUTE'),
  '문 둘은 authenticated 에만 열리고 서버 열쇠에는 안 열린다 — 화면 몫의 판정은 누구에게도 안 열린다');

-- ── 2. 모양 ─────────────────────────────────────────────────────────────────────

set local role authenticated;
select pg_temp.acting((select operator from folks));

select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', null, %L)$$, (select member from folks), gen_random_uuid()),
  '22023', '읽은 버전이 없습니다. 화면을 새로 열어 주세요.', '읽은 버전이 비면 거절한다 — 버전 검사를 건너뛰는 길이 아니다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, null)$$, (select member from folks)),
  '22023', '요청 번호가 없습니다. 화면을 새로 열어 주세요.', '요청 번호가 비면 거절한다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'report', 0, %L)$$, (select member from folks), gen_random_uuid()),
  '22023', '사유를 골라 주세요.', '화면의 정지는 신고 갈래를 받지 않는다 — 신고로 정지하는 것은 신고의 처분이다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, %L, '   ')$$, (select member from folks), gen_random_uuid()),
  '22023', '메모를 200자 안으로 적어 주세요.', '메모가 비면 거절한다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, %L, %L)$$, (select member from folks), gen_random_uuid(), repeat('가', 201)),
  '22023', '메모를 200자 안으로 적어 주세요.', '메모가 200자를 넘으면 거절한다');
select throws_ok(
  format($$select pg_temp.lift(%L, 'deletion_withdrawn', 0, %L)$$, (select member from folks), gen_random_uuid()),
  '22023', '사유를 골라 주세요.', '화면의 해제는 탈퇴 대기의 해제 갈래를 받지 않는다 — 그것은 런북이다');

-- ── 3. 버전 ─────────────────────────────────────────────────────────────────────

select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 1, %L)$$, (select member from folks), gen_random_uuid()),
  '55000', '그 사이 이 회원의 상태가 바뀌었습니다. 새로 읽고 다시 확인해 주세요.', '읽은 버전이 지금과 다르면 거절한다');

-- ── 4 · 6. 정지 · 같은 요청 ───────────────────────────────────────────────────────

select is(pg_temp.suspend((select member from folks), 'payment', 0, pg_temp.id('suspend'), '결제 부정 정황'), 'false',
  '읽은 버전이 맞으면 정지한다');
select is(pg_temp.status((select member from folks)), 'suspended', '계정이 이용 정지가 된다');
select is(
  (select array[c.to_status, c.reason, c.note, (c.actor = f.operator)::text, (c.request = pg_temp.id('suspend'))::text]
   from pg_temp.changes((select member from folks)) c, folks f),
  array['suspended', 'payment', '결제 부정 정황', 'true', 'true'],
  '상태 이력에 실행자(부른 사람) · 갈래 · 메모 · 요청 번호가 남는다');

select is(pg_temp.suspend((select member from folks), 'payment', 0, pg_temp.id('suspend'), '결제 부정 정황'), 'true',
  '같은 요청 번호는 버전이 바뀐 뒤에도 첫 결과를 돌려준다 — 같은 요청 찾기가 버전보다 먼저다');
select is((select count(*)::integer from pg_temp.changes((select member from folks))), 1, '같은 요청은 줄을 더하지 않는다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, %L)$$, (select member from folks), pg_temp.id('suspend')),
  '22023', '이 요청 번호는 다른 처리에 쓰였습니다. 화면을 새로 열어 주세요.', '같은 요청 번호에 다른 갈래면 거절한다');

select pg_temp.acting((select colleague from folks));
select throws_ok(
  format($$select pg_temp.suspend(%L, 'payment', 0, %L, '결제 부정 정황')$$, (select member from folks), pg_temp.id('suspend')),
  '22023', '이 요청 번호는 다른 처리에 쓰였습니다. 화면을 새로 열어 주세요.',
  '같은 요청 번호라도 다른 운영자면 첫 결과를 받아 가지 못한다');
select pg_temp.acting((select operator from folks));

-- ── 5. 지금 상태 ─────────────────────────────────────────────────────────────────

select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 1, %L)$$, (select member from folks), pg_temp.id('again')),
  '55000', '이미 이용 정지된 계정입니다.', '이미 정지인 계정은 다시 정지하지 못한다');
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 0, %L)$$, (select colleague from folks), gen_random_uuid()),
  '55000', '운영자 계정은 정지할 수 없습니다.', '운영자 계정은 정지하지 못한다 (G-111-10)');
select throws_ok(
  format($$select pg_temp.lift(%L, 'appeal', 0, %L)$$, (select reporter from folks), gen_random_uuid()),
  '55000', '이미 이용 중인 계정입니다.', '이용 중인 계정은 해제할 것이 없다');

reset role;
set local role authenticated;
select pg_temp.acting((select leaver from folks));
select public.request_account_deletion();
select pg_temp.acting((select operator from folks));
select throws_ok(
  format($$select pg_temp.suspend(%L, 'policy', 1, %L)$$, (select leaver from folks), gen_random_uuid()),
  '23514', '탈퇴를 신청한 계정이라 정지할 수 없습니다.', '탈퇴 대기 계정은 정지하지 못한다');

-- ── 6. 해제 — 신고의 정지 결정은 그대로 ─────────────────────────────────────────────

reset role;
create or replace function pg_temp.report(who uuid, whom uuid, reason text)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, reason) returning id
$$;
create temporary table cases as
select
  pg_temp.report(reporter, member, 'other') as warned,
  pg_temp.report(reporter, member, 'inappropriate') as decided
from folks;
grant select on cases to authenticated, service_role, anon;

set local role authenticated;
select pg_temp.acting((select operator from folks));
select r.review_version from public.operator_review_report(
  (select warned from cases), 'warning', '판단 근거', (select member from folks), null, 0, pg_temp.id('warn')) r;
select r.review_version from public.operator_review_report(
  (select decided from cases), 'suspension', '판단 근거', (select member from folks), null, 0, gen_random_uuid()) r;

select is(pg_temp.lift((select member from folks), 'appeal', 1, pg_temp.id('lift'), '소명 인정'), 'false',
  '정지인 계정은 해제한다 — 신고의 정지 결정이 이미 정지인 계정을 그대로 두어 버전은 1 이다');
select is(pg_temp.status((select member from folks)), 'active', '계정이 이용 중으로 돌아온다');
select is(
  (select r.review_outcome from public.operator_report((select decided from cases)) r),
  'suspension', '해제해도 신고의 「이용 정지 결정」 기록은 그대로다');

-- ── 7. 처분 이력 ─────────────────────────────────────────────────────────────────

reset role;
update public.app_user set status = 'suspended' where id = (select loose from folks);

set local role authenticated;
select pg_temp.acting((select colleague from folks));

select is(
  (select array[s.status, s.is_operator::text, s.version::text, s.warnings_12m::text]
   from public.operator_member_sanctions((select member from folks)) s),
  array['active', 'false', '2', '1'],
  '지금 상태 · 운영자 계정인가 · 읽은 버전(상태 이력 줄 수) · 현재 신고 기준 12개월 경고 수');
select is(
  (select array_agg(l ->> 'source' || ':' || (l ->> 'kind') || ':' || coalesce(l ->> 'reason', '-')
                   order by l ->> 'source', l ->> 'kind')
   from public.operator_member_sanctions((select member from folks)) s,
        jsonb_array_elements(s.lines) l),
  array['report:suspension:-', 'report:warning:other', 'status:active:appeal', 'status:suspended:payment'],
  '신고의 경고 · 이용 정지 결정과 상태 이력이 한 목록에 선다');
select is(
  (select array[l ->> 'note', l ->> 'actor_nickname', l ->> 'recorded']
   from public.operator_member_sanctions((select member from folks)) s,
        jsonb_array_elements(s.lines) l
   where l ->> 'kind' = 'active'),
  array['소명 인정', (select nickname from operator_name), 'true'],
  '상태 이력 줄은 메모와 실행자 닉네임을 낸다 (G-111-9)');
select is(
  (select array[l ->> 'warning_ref' is not null, (l ->> 'counted')::boolean]::text[]
   from public.operator_member_sanctions((select member from folks)) s,
        jsonb_array_elements(s.lines) l
   where l ->> 'kind' = 'warning'),
  array['true', 'true'],
  '경고 줄은 안내번호와 12개월 셈을 든다');
select is(
  (select array[l ->> 'recorded', coalesce(l ->> 'actor_nickname', '없음')]
   from public.operator_member_sanctions((select loose from folks)) s,
        jsonb_array_elements(s.lines) l),
  array['false', '없음'],
  '공통 함수 밖의 직접 UPDATE 줄은 「실행자 · 사유 없음」으로 읽힌다');
select is(
  (select s.is_operator from public.operator_member_sanctions((select operator from folks)) s),
  true, '운영자 계정이면 그렇다고 낸다 — 화면이 정지 단추를 세우지 않는다');
select is(
  (select count(*)::integer from public.operator_member_sanctions(gen_random_uuid())),
  0, '없는 계정은 빈 결과다');

-- ── 8. 접속기록 ─────────────────────────────────────────────────────────────────

select is(
  (select array_agg(l.action || ' ' || l.filter order by l.action || ' ' || l.filter)
   from pg_temp.lines((select operator from folks)) l
   where l.action in ('members.suspend', 'members.unsuspend')),
  (select array_agg(v.x order by v.x) from (values
     ('members.suspend user=' || (select member from folks) || ' entry=' || pg_temp.entry('suspend')),
     ('members.suspend user=' || (select member from folks) || ' entry=' || pg_temp.entry('suspend') || ' replayed'),
     ('members.unsuspend user=' || (select member from folks) || ' entry=' || pg_temp.entry('lift'))) v(x)),
  '정지 · 해제마다 한 줄, 거른 조건 칸에 계정 · 이력 줄 id 만');
select ok(
  not exists (select 1 from pg_temp.lines((select operator from folks)) l
              where l.filter like '%결제 부정%' or l.filter like '%소명%'),
  '메모는 접속기록에 안 적는다');
select is(
  (select count(*)::integer from pg_temp.lines((select colleague from folks)) l where l.action = 'members.sanctions'),
  7, '처분 이력을 읽을 때마다 한 줄');
select is(
  (select count(*)::integer from pg_temp.lines((select stranger from folks)) l),
  0, '거절된 시도는 접속기록 줄과 함께 되감긴다 — 거절은 앱이 따로 적는다');

select * from finish();
rollback;
