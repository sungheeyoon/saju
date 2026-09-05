-- 풀이권 예외 — **한도는 안 옮기고, 그 위에 몫을 얹는다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **한도를 묻는 자리가 하나다.** 화면·인연 요청·생성이 저마다 상수를 읽으면 예외를
--    넣을 때 하나를 빠뜨리고, 그러면 **잔액은 남았는데 누르면 거절되는** 자리가 난다.
--    그 하나를 카탈로그에 대고 잰다 — 다음 사람이 새 자리에서 상수를 다시 읽는 순간
--    이 줄이 먼저 무너진다.
-- 2. **얹은 몫으로 실제로 만들어진다.** 화면의 숫자만 재면 1번의 그 자리를 못 잡는다.
--    다 쓴 사람에게 몫을 주고 **한 번 더 눌러 본다.**
-- 3. **받지 않은 사람은 그대로다.** 예외가 정책이 되면 이 표를 둔 까닭이 없어진다.
-- 4. **표도 함수도 밖에서 안 닿는다.** 여기에 닿는 길이 하나라도 열리면 그것은 남에게
--    풀이권을 나눠 주는 문이다(ADR 0006).
begin;
select plan(10);

/**
 * **한도를 묻는 자리는 하나뿐이다.**
 *
 * 상수를 그대로 읽는 함수는 상수 자신 말고는 없어야 하고, 예외를 지나는
 * `reading_credit_limit_for` 만 그것을 부른다. 역할을 바꾸기 전에 잰다 — 카탈로그를
 * 읽는 일이지 사용자가 하는 일이 아니다.
 */
select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind = 'f'
     and p.proname <> 'reading_credit_limit_for'
     and pg_get_functiondef(p.oid) ~ 'reading_credit_limit\s*\('),
  array['reading_credit_limit'],
  '상수를 직접 읽는 자리는 예외를 지나는 함수 하나뿐이다');

create or replace function pg_temp.save(run uuid, rev uuid)
returns uuid language sql security definer as $$
  select public.save_reading(
    run, rev, null, '## 풀이', null,
    '{"charts":{}}', '# 역할', 'reading-prompt-v1', 'openai/gpt-5.6-luna',
    '{"temperature":1}'::jsonb, now());
$$;

/** 저장한 사람 하나를 열고 끝까지 민다 — 풀이권 하나가 소모되는 온전한 한 바퀴다 */
create or replace function pg_temp.burn(who uuid, key text)
returns void language plpgsql as $$
declare started uuid; rev uuid;
begin
  select run_id, revision_a into started, rev
  from public.start_reading_run('person', key, who);
  perform pg_temp.save(started, rev);
end;
$$;

set local role authenticated;

create temporary table folks as
  select tests.signup('kim-grant@example.com') as kim,
         tests.signup('lee-grant@example.com') as lee;
grant select on folks to authenticated, service_role;

select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);
select public.create_self_person(
  '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean');

create temporary table kin as
select
  public.create_managed_person('엄마', null, 'solar', '1962-03-02', '1962-03-02', '07:10',
    'female', '부산', 'jo', 'localMean') as mom,
  public.create_managed_person('아빠', null, 'solar', '1960-11-08', '1960-11-08', '05:40',
    'male', '대구', 'jo', 'localMean') as dad,
  public.create_managed_person('누나', null, 'solar', '1988-01-19', '1988-01-19', '22:05',
    'female', '광주', 'jo', 'localMean') as sis,
  public.create_managed_person('형', null, 'solar', '1986-07-23', '1986-07-23', '11:15',
    'male', '인천', 'jo', 'localMean') as bro,
  public.create_managed_person('삼촌', null, 'solar', '1958-09-30', '1958-09-30', '16:50',
    'male', '대전', 'jo', 'localMean') as unc;
grant select on kin to authenticated, service_role;

-- ── 몫이 없으면 상수 그대로다 ───────────────────────────────────────────────

select is(
  (select array[credit_limit, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit(), tests.reading_credit_limit()],
  '몫을 받지 않았으면 한도가 상수 그대로다');

select pg_temp.burn((select mom from kin), 'grant-0001');
select pg_temp.burn((select dad from kin), 'grant-0002');
select pg_temp.burn((select sis from kin), 'grant-0003');
select pg_temp.burn((select bro from kin), 'grant-0004');
select pg_temp.burn((select unc from kin), 'grant-0005');

select is(
  (select available from public.my_reading_credits()),
  0,
  '다섯을 쓰면 남은 것이 없다');

select throws_like(
  $$select * from public.start_reading_run('self', 'grant-0006')$$,
  '%풀이권%',
  '몫이 없으면 다 쓴 사람은 막힌다');

-- ── 몫을 얹는다 ─────────────────────────────────────────────────────────────

/** 운영자가 SQL 로 넣는 자리다 — 앱에는 이 표에 닿는 길이 없다 */
set local role postgres;
insert into public.reading_credit_grant (user_id, extra, note)
values ((select kim from folks), 2, '시험 — 예외가 한 사람에게만 얹히는지 잰다');
set local role authenticated;

select is(
  (select array[credit_limit, used, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit() + 2, 5, 2],
  '얹은 몫만큼 화면의 한도와 잔액이 는다');

/**
 * **화면이 아니라 문(門)에 대고 잰다.**
 *
 * 잔액을 내주는 자리와 누름을 받는 자리가 다른 한도를 읽으면, 사용자는 「둘 남았다」를
 * 보고 눌러서 「다 쓰셨습니다」를 받는다. 그 자리를 잡는 줄이 이것이다.
 */
select lives_ok(
  $$select * from public.start_reading_run('self', 'grant-0006')$$,
  '얹은 몫으로 여섯째가 실제로 선다');

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[5, 1, 1],
  '여섯째가 도는 동안 남은 것은 하나다');

-- ── 예외는 그 사람에게만 얹힌다 ─────────────────────────────────────────────

select set_config('request.jwt.claims', tests.claims((select lee from folks)), true);

select is(
  (select array[credit_limit, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit(), tests.reading_credit_limit()],
  '몫을 받지 않은 사람의 한도는 안 움직인다');

-- ── 밖에서는 안 닿는다 ──────────────────────────────────────────────────────

select throws_ok(
  $$select 1 from public.reading_credit_grant$$,
  '42501', null, '누구에게 얼마를 주었는지는 밖에서 못 읽는다');

select throws_ok(
  format($$select public.reading_credit_limit_for(%L::uuid)$$, (select lee from folks)),
  '42501', null, '예외를 지나는 한도도 직접은 못 묻는다');

select * from finish();
rollback;
