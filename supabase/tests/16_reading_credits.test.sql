-- 풀이권 — **적어 두지 않고 센다.**
--
-- 여기서 재는 것 넷.
--
-- 1. **성공한 것과 지금 도는 것이 함께 자리를 잡는다.** 성공만 세면 넷을 쓴 사람이
--    서로 다른 두 대상을 잇달아 열어 여섯이 된다.
-- 2. **되돌리는 일이 없다.** 실패는 애초에 안 세고, 성공은 도는 자리를 옮길 뿐이라
--    합계가 움직이지 않는다.
-- 3. **거절의 이유가 갈린다.** 「다 썼다」와 「이미 만들고 있다」는 다른 답이고,
--    다 쓴 사람이 만들던 것을 보러 다시 눌러도 앞의 답을 읽어야 한다.
-- 4. **잔액은 한 자리에서 난다.** 표는 여전히 안 보이고 상수도 직접 못 부른다 —
--    화면이 손으로 셀 길이 없다.
--
-- **잠금은 여기서 못 잰다.** 한 세션으로는 나란히 부르는 둘을 만들 수 없다. 이 파일이
-- 재는 것은 「도는 것이 자리를 잡는가」이고, 그 셈이 동시에도 흔들리지 않는 것은
-- `start_reading_run` 이 이미 잡고 있던 사람 자물쇠가 하는 일이다.
begin;
select plan(17);

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

/** 대상 하나를 열고 끝까지 민다 — 풀이권 하나가 소모되는 온전한 한 바퀴다 */
create or replace function pg_temp.burn(other uuid, key text)
returns void
language plpgsql
as $$
declare
  started uuid;
  mine uuid;
begin
  select self_person_id into mine from public.app_user;
  select run_id into started
  from public.start_reading_run('private', key, other, mine);
  perform pg_temp.save(
    started,
    (select p.current_revision_id from public.person p where p.id = least(other, mine)),
    (select p.current_revision_id from public.person p where p.id = greatest(other, mine)),
    '## 둘 사이', 71::smallint);
end;
$$;

set local role authenticated;

create temporary table folks as select tests.signup('kim-credit@example.com') as kim;
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
    'male', '대전', 'jo', 'localMean') as unc,
  /*
    풀이권이 여덟이 되면서 **대상이 더 있어야 다 쓸 수 있다.** 한 대상의 현재 풀이는
    하나이므로 같은 사람을 다시 눌러서는 자리가 안 준다 — 여덟을 쓰려면 여덟 대상이
    필요하고, 저장 자리(열)는 그것을 감당한다(ADR 0032 의 부등식이 여기서 쓰인다).
  */
  public.create_managed_person('이모', null, 'solar', '1964-04-11', '1964-04-11', '03:20',
    'female', '울산', 'jo', 'localMean') as aunt,
  public.create_managed_person('사촌', null, 'solar', '1992-12-05', '1992-12-05', '18:45',
    'male', '수원', 'jo', 'localMean') as cou,
  public.create_managed_person('친구', null, 'solar', '1991-02-27', '1991-02-27', '20:30',
    'female', '전주', 'jo', 'localMean') as pal;
grant select on kin to authenticated, service_role;

-- ── 아무것도 안 했을 때 ─────────────────────────────────────────────────────

select is(
  (select array[credit_limit, used, reserved, available] from public.my_reading_credits()),
  array[tests.reading_credit_limit(), 0, 0, tests.reading_credit_limit()],
  '아직 아무것도 안 만들었으면 총량이 그대로 남는다');

-- ── 도는 시도가 자리를 잡는다 ───────────────────────────────────────────────

create temporary table run_self as
select run_id as id from public.start_reading_run('self', 'credit-self-0001');
grant select on run_self to authenticated, service_role;

/**
 * **아직 성공이 아닌데 잔액이 줄어든다.**
 *
 * 성공만 세던 때 이 줄이 `[5, 0, 0, 5]` 였다. 그때 넷을 쓴 사람이 두 대상을 잇달아
 * 누르면 둘 다 넷을 보고 시작해 여섯이 됐다.
 */
select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[0, 1, 7],
  '도는 시도가 성공할 자리를 미리 잡는다');

select lives_ok(
  format($$select pg_temp.save(%L::uuid, %L::uuid, null, '## 나의 풀이', null)$$,
    (select id from run_self),
    (select current_revision_id from public.person p
     join public.app_user u on u.self_person_id = p.id)),
  '자기 풀이가 저장된다');

/** `running` → `succeeded` 는 자리를 **옮길** 뿐이다 — 합계가 안 움직인다 */
select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[1, 0, 7],
  '성공하면 잡고 있던 자리가 쓴 자리로 옮겨 갈 뿐이다');

-- ── 끊긴 시도가 풀이권을 물고 있지 않는다 ───────────────────────────────────

/**
 * 서버가 죽으면 그 행을 닫을 사람이 없다. 유효시간까지 세면 끊긴 시도 하나가 풀이권을
 * 영영 물고 있는다 — 사용자는 쓰지도 않은 것을 잃는다.
 */
reset role;
insert into public.reading_run (user_id, kind, idempotency_key, created_at)
values ((select kim from folks), 'self', 'credit-abandoned-0001',
        now() - interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select kim from folks)), true);

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[1, 0, 7],
  '유효시간이 지난 시도는 자리를 잡지 않는다');

-- ── 마지막 하나만 남을 때까지 쓴다 ─────────────────────────────────────────

select lives_ok(
  $$select pg_temp.burn((select mom from kin), 'credit-priv-0001')$$,
  '비공개 궁합 하나가 소모된다');
select pg_temp.burn((select dad from kin), 'credit-priv-0002');
select pg_temp.burn((select sis from kin), 'credit-priv-0003');
select pg_temp.burn((select aunt from kin), 'credit-priv-0009');
select pg_temp.burn((select cou from kin), 'credit-priv-0010');
select pg_temp.burn((select pal from kin), 'credit-priv-0011');

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[7, 0, 1],
  '일곱을 쓰면 하나가 남는다');

-- ── 마지막 하나를 도는 시도가 잡고 있다 ─────────────────────────────────────

create temporary table run_bro as
select run_id as id from public.start_reading_run(
  'private', 'credit-priv-0004', (select bro from kin),
  (select self_person_id from public.app_user));
grant select on run_bro to authenticated, service_role;

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[7, 1, 0],
  '마지막 하나를 도는 시도가 잡으면 남은 것이 없다');

/** **이 줄이 아홉 번째를 막는다** — 성공은 아직 일곱뿐이지만 자리는 다 찼다 */
select throws_like(
  format($$select * from public.start_reading_run('private', 'credit-priv-0005', %L::uuid, %L::uuid)$$,
    (select unc from kin), (select self_person_id from public.app_user)),
  '%만들고 있는 풀이가 마지막%',
  '도는 것까지 자리가 차면 다른 대상을 시작할 수 없고, 기다리라고 말한다');

/**
 * **다 쓴 사람이 만들던 것을 보러 다시 눌러도 「없다」를 읽지 않는다.**
 *
 * 검사가 「이미 도는 시도」보다 앞에 서면 이 줄이 거절로 뒤집힌다. 그 사람은 이미 낸
 * 것을 기다리는 중이고, 화면은 그 사실을 말해야 한다.
 */
select is(
  (select count(*)::int from public.start_reading_run(
    'private', 'credit-priv-0006', (select bro from kin),
    (select self_person_id from public.app_user))),
  0,
  '자리가 다 차 있어도 만들던 대상을 다시 누른 것은 거절이 아니다');

-- ── 실패는 되돌리는 일 없이 풀린다 ──────────────────────────────────────────

select public.fail_reading_run((select id from run_bro), 'call_failed');

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[7, 0, 1],
  '실패한 시도는 세지 않으므로 자리가 저절로 풀린다');

select lives_ok(
  $$select pg_temp.burn((select unc from kin), 'credit-priv-0007')$$,
  '풀린 자리로 마지막 하나를 만든다');

-- ── 다 쓰면 막힌다 ──────────────────────────────────────────────────────────

select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[8, 0, 0],
  '다 쓰면 남은 것이 없다');

/**
 * **시간당 한도와 다른 말을 한다.** 거절의 이유가 하나로 뭉치면 사용자가 무엇을
 * 어겼는지 고르게 된다 — 기다리면 되는 것과 다 쓴 것은 할 일이 다르다.
 */
select throws_like(
  format($$select * from public.start_reading_run('private', 'credit-priv-0008', %L::uuid, %L::uuid)$$,
    (select bro from kin), (select self_person_id from public.app_user)),
  '%풀이권%',
  '다 쓰면 풀이권이라는 말로 거절한다');

-- ── 손으로 셀 길이 없다 ─────────────────────────────────────────────────────

select throws_ok(
  $$select public.reading_credit_limit()$$,
  '42501', null, '몇 장인지는 직접 못 묻는다');

select throws_ok(
  $$select 1 from public.reading_run$$,
  '42501', null, '시도 기록은 여전히 직접 안 보인다');

/** definer 라 정책을 지나간다 — 그래서 uuid 를 안 받고, 답은 부른 사람 것뿐이다 */
select set_config('request.jwt.claims', tests.claims(tests.signup('lee-credit@example.com')), true);
select is(
  (select array[used, reserved, available] from public.my_reading_credits()),
  array[0, 0, tests.reading_credit_limit()],
  '다른 사람은 자기 잔액을 본다');

select * from finish();
rollback;
