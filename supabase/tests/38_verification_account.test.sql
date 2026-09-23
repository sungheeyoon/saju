-- 하루 상한 500 과 운영 검증 계정 (G-03, ADR 0039)
--
-- 재는 것 넷.
--
-- 1. **상한이 500, 알림이 400 이다.** 알림은 상한에서 뽑히므로 상한만 바꿔도 따라온다.
-- 2. **검증 계정의 시도는 따로 세이지만 전체에서 빠지지 않는다.** 토큰은 누가 눌렀든 나간다.
-- 3. **검증 계정이 아닌 사람의 시도는 검증 칸에 안 든다.**
-- 4. **검증 계정 표는 밖에서 못 읽는다.**
begin;
select plan(7);

select is(public.reading_daily_budget(), 500, '하루 전체 상한은 500 이다');
select is(public.reading_budget_warning(), 400, '80% 알림은 상한을 따라 400 이다');

create temporary table folks as
select
  tests.signup('verify-ops@example.com') as ops,
  tests.signup('verify-user@example.com') as usr;

insert into public.verification_account (user_id, note)
select ops, '시험 — 검증 계정' from folks;

/** 시도 행을 직접 쌓는다 — 문을 지나는 것은 23번이 잰다 */
insert into public.reading_run (user_id, kind, status, idempotency_key, usage)
select f.ops, 'self', 'succeeded', 'verify-ops-1', '{"totalTokens": 700}'::jsonb from folks f
union all
select f.ops, 'self', 'failed', 'verify-ops-2', null from folks f
union all
select f.usr, 'self', 'succeeded', 'verify-usr-1', '{"totalTokens": 300}'::jsonb from folks f;

create temporary table today as
select * from public.reading_spend_daily v
where v.day = (now() at time zone 'Asia/Seoul')::date and v.kind = 'self';

select cmp_ok(
  (select attempts from today), '>=', 3,
  '전체 시도는 검증 계정의 것까지 센다 — 상한이 보는 수와 같다');

select is(
  (select verification_attempts from today), 2,
  '검증 계정의 시도만 검증 칸에 든다 — 다른 사람의 시도는 안 든다');

select is(
  (select array[verification_succeeded, verification_failed] from today), array[1, 1],
  '검증 계정의 성공과 실패를 가른다');

select is(
  (select verification_total_tokens::int from today), 700,
  '검증 계정이 쓴 토큰을 따로 낸다');

select table_privs_are('public', 'verification_account', 'authenticated', array[]::text[],
  '어느 계정이 검증용인지는 로그인한 사람에게 닫혀 있다');

select * from finish();
rollback;
