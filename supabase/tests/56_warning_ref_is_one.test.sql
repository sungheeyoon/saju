-- 안내번호는 두 표를 합쳐 하나다 (ADR 0108 추기, G-57)
--
-- 경고는 지금 계정의 신고(`public.report`)에도, 떠난 사람의 신고(`retention.report`)에도 적힌다. 안내번호는 운영자가
-- 이의 제기 메일을 계정으로 잇는 실마리라 **두 표를 합쳐 한 경고만** 가리켜야 한다. 표마다의 유일 제약으로는 한 번호가 두
-- 표에 하나씩 설 수 있었다 — 뽑을 때 두 표를 함께 봐도, 나란히 적는 두 세션은 서로의 커밋 전 줄을 못 본다(두 세션 경합은
-- `scripts/check-db-races.mjs` 의 6 이 잰다).
--
--   1. **한 번호는 두 표를 합쳐 한 신고의 것이다** — 어느 쪽을 먼저 적어도 둘째는 `23505`
--   2. **떠날 때 옮겨도 번호가 따라가고 대장은 그대로다** — 옮긴 뒤에도 그 번호는 다른 신고가 못 받는다
--   3. **파기된 경고의 번호도 다시 안 쓴다** — 옛 이메일의 번호가 다른 사람의 경고를 가리키지 않는다
--   4. **대장은 API 역할에 닫혀 있다**
begin;
select plan(9);

create temporary table folks as
select
  tests.signup('wr-reporter@example.com') as reporter,
  tests.signup('wr-warned@example.com') as warned,
  tests.signup('wr-leaving@example.com') as leaving,
  tests.signup('wr-operator@example.com') as operator;

insert into public.operator (user_id, note) values ((select operator from folks), '시험 — 안내번호 대장');

create or replace function pg_temp.report(who uuid, whom uuid)
returns uuid language sql as $$
  insert into public.report (reporter_user_id, reported_user_id, reason) values (who, whom, 'harassment') returning id
$$;

/** 떠난 사람의 신고 한 줄 — 옮기는 트리거를 거치지 않고 그 모양 그대로 */
create or replace function pg_temp.retained()
returns uuid language sql as $$
  insert into retention.report (report_id, reason, reported_at, reporter_user_id, reported_user_id, reporter_left_at)
  values (gen_random_uuid(), 'other', now(), gen_random_uuid(), gen_random_uuid(), now())
  returning report_id
$$;

create temporary table cases as
select
  pg_temp.report(reporter, warned) as here,
  pg_temp.report(reporter, warned) as here_too,
  pg_temp.report(reporter, warned) as here_three,
  pg_temp.report(leaving, warned) as moving,
  pg_temp.retained() as kept,
  pg_temp.retained() as kept_too,
  pg_temp.retained() as purged
from folks;

-- ── 1. 두 표를 합쳐 한 신고 ──────────────────────────────────────────────────

update public.report set warning_ref = 'W-AAAA' where id = (select here from cases);
select throws_ok(
  format($$update retention.report set warning_ref = 'W-AAAA' where report_id = %L$$, (select kept from cases)),
  '23505', null, '지금 계정의 신고에 있는 번호는 떠난 사람의 신고가 못 받는다');

update retention.report set warning_ref = 'W-BBBB' where report_id = (select kept_too from cases);
select throws_ok(
  format($$update public.report set warning_ref = 'W-BBBB' where id = %L$$, (select here_too from cases)),
  '23505', null, '떠난 사람의 신고에 있는 번호는 지금 계정의 신고가 못 받는다');

update public.report set warning_ref = 'W-DDDD' where id = (select here_three from cases);
select throws_ok(
  $$insert into retention.report
      (report_id, reason, reported_at, reporter_user_id, reported_user_id, reporter_left_at, warning_ref)
    values (gen_random_uuid(), 'other', now(), gen_random_uuid(), gen_random_uuid(), now(), 'W-DDDD')$$,
  '23505', null, '새로 넣는 줄도 같다');

-- ── 2. 떠날 때 옮긴다 ────────────────────────────────────────────────────────

select public.review_report((select moving from cases), (select operator from folks), 'warning', null,
                            (select warned from folks));
create temporary table moved_ref as
select warning_ref from public.report where id = (select moving from cases);
select public.forget_user((select leaving from folks));

select is((select warning_ref from retention.report where report_id = (select moving from cases)),
  (select warning_ref from moved_ref),
  '신고한 사람이 떠나 옮겨진 경고는 같은 번호를 든다');
select throws_ok(
  format($$update public.report set warning_ref = %L where id = %L$$,
         (select warning_ref from moved_ref), (select here_too from cases)),
  '23505', null, '옮긴 뒤에도 그 번호는 다른 신고가 못 받는다');

-- ── 3. 파기된 번호 ───────────────────────────────────────────────────────────

update retention.report set warning_ref = 'W-CCCC' where report_id = (select purged from cases);
delete from retention.report where report_id = (select purged from cases);
select throws_ok(
  format($$update public.report set warning_ref = 'W-CCCC' where id = %L$$, (select here_too from cases)),
  '23505', null, '파기된 경고의 번호도 다시 쓰지 않는다');

-- ── 4. 대장은 닫혀 있다 ──────────────────────────────────────────────────────

select ok((select relrowsecurity from pg_class where oid = 'public.warning_reference'::regclass),
  '대장에 RLS 가 켜져 있다');
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'warning_reference'
     and grantee in ('anon', 'authenticated', 'service_role')),
  0,
  '대장은 API 역할에 아무 권한도 없다');
select is(
  (select count(*)::integer from public.warning_reference where ref in ('W-AAAA', 'W-BBBB', 'W-CCCC', 'W-DDDD')),
  4,
  '적힌 번호는 모두 대장에 있다');

select * from finish();
rollback;
