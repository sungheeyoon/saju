-- 정지된 이용자가 제 정지의 갈래를 읽고, 정지된 사람의 탈퇴 요청은 운영자가 탈퇴 대기로 옮긴다 (`20261217090000`, G-111-8 · R-1,
-- ADR 0190)
--
--   1. **본인만** — `my_suspension` 은 authenticated 에만 열린다. 부른 사람 제 것만 나오고, 지금 정지가 아니면 빈 결과다
--   2. **갈래만** — 나가는 칸은 닉네임 · 갈래 둘이다. 메모 · 실행자 · 관련 신고는 안 나간다
--   3. **갈래가 없을 때** — 직접 UPDATE 의 정지 · 이력 없는 정지는 갈래가 빈 한 줄이다. 앞 정지의 갈래가 새 정지에 묻어오지 않는다
--   4. **정지 → 탈퇴 대기**(R-1) — 운영자가 공통 함수로 옮기고(`deletion_request`, 메모 필수), 탈퇴 대기 시각이 서고 노출이 꺼진다.
--      이용 중 · 이미 탈퇴 대기는 거절한다. 이용자는 여전히 스스로 신청하지 못한다(`42501`)
--   5. **그 해제는 정지로** — 정지에서 온 탈퇴 대기는 정지로만 되돌리고, 앞 정지의 갈래가 다시 읽힌다. 이용 중에서 온 것은 지금처럼
--      이용 중으로
begin;
select plan(30);

create or replace function pg_temp.acting(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', tests.claims(uid), true);
end;
$$;

create temporary table folks as
select
  tests.signup('mys-member@example.com') as member,
  tests.signup('mys-other@example.com') as other,
  tests.signup('mys-direct@example.com') as direct,
  tests.signup('mys-leaver@example.com') as leaver,
  tests.signup('mys-self@example.com') as self_leaver,
  tests.signup('mys-operator@example.com') as operator;
grant select on folks to authenticated, service_role, anon;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 내 정지');

create or replace function pg_temp.change(who uuid, status text, reason text, note text default '시험 메모')
returns uuid language sql as $$
  select public.change_account_status((select operator from folks), who, status, reason, note)
$$;

create or replace function pg_temp.mine()
returns table (nickname text, reason text) language sql as $$ select * from public.my_suspension() $$;
grant execute on function pg_temp.mine() to authenticated;

create or replace function pg_temp.status(who uuid) returns text language sql security definer as $$
  select a.status from public.app_user a where a.id = who
$$;
grant execute on function pg_temp.status(uuid) to authenticated;

-- ── 1. 본인만 ────────────────────────────────────────────────────────────────────

select ok(
  has_function_privilege('authenticated', 'public.my_suspension()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.my_suspension()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.my_suspension()', 'EXECUTE'),
  '내 정지 문은 authenticated 에만 열린다 — anon · 서버 열쇠에는 안 열린다');

select is(pg_get_function_result('public.my_suspension()'::regprocedure), 'TABLE(nickname text, reason text)',
  '나가는 칸은 닉네임 · 갈래 둘뿐이다 — 메모 · 실행자 · 관련 신고 · 시각이 없다');

select pg_temp.change((select member from folks), 'suspended', 'policy', '내부 메모 — 이용자에게 안 간다');
select pg_temp.change((select other from folks), 'suspended', 'payment', '다른 사람의 메모');

set local role authenticated;

select pg_temp.acting((select member from folks));
select results_eq(
  'select nickname, reason from pg_temp.mine()',
  format($$select nickname, 'policy'::text from public.app_user where id = %L$$, (select member from folks)),
  '정지된 사람은 제 닉네임과 지금 정지의 갈래를 읽는다');
select is((select count(*)::int from pg_temp.mine()), 1, '한 줄이다');
select ok(
  not exists (select 1 from pg_temp.mine() m where m.nickname like '%메모%' or m.reason like '%메모%'),
  '메모는 어느 칸에도 안 나간다');

select pg_temp.acting((select other from folks));
select is((select reason from pg_temp.mine()), 'payment', '다른 정지된 사람은 제 갈래만 읽는다');
select results_eq(
  'select nickname from pg_temp.mine()',
  format($$select nickname from public.app_user where id = %L$$, (select other from folks)),
  '닉네임도 제 것이다 — 남의 닉네임이 안 나온다');

select pg_temp.acting((select direct from folks));
select is((select count(*)::int from pg_temp.mine()), 0, '이용 중인 사람에게는 빈 결과다 — 남의 정지를 못 읽는다');

select pg_temp.acting((select operator from folks));
select is((select count(*)::int from pg_temp.mine()), 0, '운영자도 이 문으로 남의 정지를 못 읽는다 — 인자가 없다');

reset role;
set local role anon;
select throws_ok('select * from public.my_suspension()', '42501', null, '로그인하지 않으면 못 부른다');
reset role;

-- ── 3. 갈래가 없을 때 ───────────────────────────────────────────────────────────

update public.app_user set status = 'suspended' where id = (select direct from folks);

set local role authenticated;
select pg_temp.acting((select direct from folks));
select is((select count(*)::int from pg_temp.mine()), 1, '직접 UPDATE 로 정지된 사람도 한 줄을 받는다');
select ok((select reason from pg_temp.mine()) is null, '그 줄의 갈래는 비어 있다 — 공통 함수 밖의 정지');
reset role;

-- 앞 정지의 갈래가 새 정지에 묻어오지 않는다 — 풀고 직접 UPDATE 로 다시 정지
select pg_temp.change((select member from folks), 'active', 'appeal');
update public.app_user set status = 'suspended' where id = (select member from folks);

set local role authenticated;
select pg_temp.acting((select member from folks));
select ok((select reason from pg_temp.mine()) is null, '풀린 앞 정지의 갈래는 새 정지에 안 묻어온다');
reset role;

-- 이력이 아예 없는 정지(20261215090000 전) — 이력 줄을 지우는 길이 없으므로 트리거를 잠시 끄고 세운다
alter table public.app_user disable trigger account_status_is_recorded;
update public.app_user set status = 'suspended' where id = (select leaver from folks);
alter table public.app_user enable trigger account_status_is_recorded;

set local role authenticated;
select pg_temp.acting((select leaver from folks));
select ok((select count(*)::int from pg_temp.mine()) = 1 and (select reason from pg_temp.mine()) is null,
  '이력이 없는 정지도 갈래가 빈 한 줄이다');
reset role;

-- 신고로 정지 — 갈래 report
select public.change_account_status((select operator from folks), (select self_leaver from folks), 'suspended', 'report',
  null, gen_random_uuid());
set local role authenticated;
select pg_temp.acting((select self_leaver from folks));
select is((select reason from pg_temp.mine()), 'report', '신고로 정지된 사람도 갈래를 읽는다 — 신고 id 는 안 나간다');
reset role;
select pg_temp.change((select self_leaver from folks), 'active', 'mistake');

-- ── 4. 정지 → 탈퇴 대기 ────────────────────────────────────────────────────────

-- 이용자는 여전히 스스로 신청하지 못한다
set local role authenticated;
select pg_temp.acting((select other from folks));
select throws_ok('select public.request_account_deletion()', '42501', null, '정지된 계정은 화면에서 탈퇴를 신청하지 못한다');
reset role;

-- 정지 전에 켜 둔 노출이 정지 동안 남아 있던 자리 — 요약 칸은 검사식(`opted_in_needs_summary`)을 지나는 값이면 된다
insert into public.discovery_profile (user_id, opted_in_at, element_summary, element_input_version)
values ((select other from folks), now(),
        jsonb_build_object('glyphCount', 8,
          'counts', jsonb_build_object('木', 4, '火', 4, '土', 0, '金', 0, '水', 0),
          'ratios', jsonb_build_object('木', 0.5, '火', 0.5, '土', 0, '金', 0, '水', 0)), 1)
on conflict (user_id) do update
set opted_in_at = excluded.opted_in_at, element_summary = excluded.element_summary,
    element_input_version = excluded.element_input_version;

select throws_ok(
  format($$select pg_temp.change(%L, 'deletion_requested', 'deletion_request', '  ')$$, (select other from folks)),
  '22023', '메모를 200자 안으로 적어 주세요.', '메모가 비면 거절한다');
select throws_ok(
  format($$select pg_temp.change(%L, 'deletion_requested', 'other')$$, (select other from folks)),
  '22023', '사유를 골라 주세요.', '갈래는 deletion_request 하나다');
select throws_ok(
  format($$select pg_temp.change(%L, 'suspended', 'deletion_request')$$, (select self_leaver from folks)),
  '22023', '사유를 골라 주세요.', 'deletion_request 는 정지 갈래가 아니다');
select throws_ok(
  format($$select pg_temp.change(%L, 'deletion_requested', 'deletion_request')$$, (select self_leaver from folks)),
  '55000', '이용 정지인 계정만 탈퇴 대기로 옮깁니다.', '이용 중인 사람은 운영자가 옮기지 않는다 — 스스로 신청한다');

select pg_temp.change((select other from folks), 'deletion_requested', 'deletion_request', '문의 2026-10-17 본인 확인');

select ok(
  (select a.status = 'deletion_requested' and a.deletion_requested_at is not null
   from public.app_user a where a.id = (select other from folks)),
  '정지된 사람이 탈퇴 대기가 되고 탈퇴 대기 시각이 선다 — 처분은 크론이 한다');
select results_eq(
  format($$select from_status, reason, actor_user_id, note from public.account_status_change
           where user_id = %L order by at desc, id desc limit 1$$, (select other from folks)),
  format($$values ('suspended'::text, 'deletion_request'::text, %L::uuid, '문의 2026-10-17 본인 확인'::text)$$,
    (select operator from folks)),
  '이력에 정지 → 탈퇴 대기 · 갈래 deletion_request · 실행자 운영자 · 메모가 남는다');
select ok(
  (select opted_in_at is null from public.discovery_profile where user_id = (select other from folks)),
  '인연 찾기 노출이 꺼진다 — 스스로 신청한 탈퇴 대기와 같은 자리');
select throws_ok(
  format($$select pg_temp.change(%L, 'deletion_requested', 'deletion_request')$$, (select other from folks)),
  '55000', '이미 탈퇴 대기인 계정입니다.', '이미 탈퇴 대기면 거절한다');

set local role authenticated;
select pg_temp.acting((select other from folks));
select is((select count(*)::int from pg_temp.mine()), 0, '탈퇴 대기가 되면 정지 문은 빈 결과다');
reset role;

-- ── 5. 그 해제는 정지로 ─────────────────────────────────────────────────────────

select throws_ok(
  format($$select pg_temp.change(%L, 'active', 'deletion_withdrawn')$$, (select other from folks)),
  '22023', '정지 중에 받은 탈퇴 요청이라 이용 정지로 되돌립니다.', '정지에서 온 탈퇴 대기를 이용 중으로 풀지 못한다');

select pg_temp.change((select other from folks), 'suspended', 'deletion_withdrawn', '탈퇴 요청 철회');
select ok(
  (select a.status = 'suspended' and a.deletion_requested_at is null from public.app_user a where a.id = (select other from folks)),
  '탈퇴 대기의 해제는 정지로 돌아가고 탈퇴 대기 시각이 빈다');

set local role authenticated;
select pg_temp.acting((select other from folks));
select is((select reason from pg_temp.mine()), 'payment', '되돌아온 정지는 앞 정지의 갈래를 다시 읽는다');
reset role;

-- 이용 중에서 온 탈퇴 대기는 지금처럼 이용 중으로
set local role authenticated;
select pg_temp.acting((select self_leaver from folks));
select public.request_account_deletion();
reset role;
select throws_ok(
  format($$select pg_temp.change(%L, 'suspended', 'deletion_withdrawn')$$, (select self_leaver from folks)),
  '22023', '이용 중에서 온 탈퇴 대기는 이용 중으로 되돌립니다.', '스스로 신청한 탈퇴 대기는 정지로 되돌리지 않는다');
select pg_temp.change((select self_leaver from folks), 'active', 'deletion_withdrawn');
select is(pg_temp.status((select self_leaver from folks)), 'active', '스스로 신청한 탈퇴 대기의 해제는 이용 중이다');

select * from finish();
rollback;
