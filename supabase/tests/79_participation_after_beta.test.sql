-- 베타가 끝나면 참여를 켜지 못하고, 끄는 것은 그대로 된다 (운영자 결정 2026-10-01)
--
-- 참여를 여는 문(`ensure_discovery_participation`)은 베타 종료(`beta_is_over()`)를 계정 상태와 함께 물어 막는데, 켜고 끄는
-- 문(`set_discovery_participation`)은 계정 상태만 물었다. 그래서 종료 뒤에도 이 문으로 켜면 풀에 다시 올랐다.
--
--   1. **종료 전** — 켜고 끈다(이 파일이 세운 열린 베타)
--   2. **종료 뒤 켜기** — 여는 문과 같은 거절(`42501`, 「이용이 정지된 계정입니다.」)이고 풀의 줄은 그대로다
--   3. **종료 뒤 끄기** — 막지 않는다. 동의를 거두는 일은 종료 뒤에도 된다(`20261110090000` 의 동의 문과 같은 결)
begin;
select plan(10);

/** 열린 베타를 이 파일이 세운다 — 일정은 늘 가장 늦게 적은 줄이 이긴다(`current_beta_schedule`) */
insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date + 30, '열린 베타', '만세력 운영자', '시험 담당', 'ops@example.com');

create temporary table who (uid uuid, person_id uuid);
grant select on who to authenticated, service_role;

do $$
declare
  u uuid := tests.signup('after-beta@example.com');
  p uuid;
begin
  perform set_config('request.jwt.claims', tests.claims(u), true);
  p := tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart('丙'), 'chart-for-tests');
  insert into who values (u, p);
end;
$$;

select set_config('request.jwt.claims', tests.claims((select uid from who)), true);

create or replace function pg_temp.summary() returns jsonb language sql as $$
  select '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},"ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb
$$;

/** 풀의 줄 — 켜졌는가 · 꺼졌는가 */
create or replace function pg_temp.state() returns text language sql as $$
  select case when d.opted_in_at is not null then 'in' when d.opted_out_at is not null then 'out' else 'none' end
  from public.discovery_profile d where d.user_id = (select uid from who)
$$;

-- ── 1. 종료 전 ───────────────────────────────────────────────────────────────

select ok(not public.beta_is_over(), '이 파일의 베타는 열려 있다');
select ok(tests.set_discovery_participation(true, pg_temp.summary(), tests.need()), '종료 전에는 참여를 켠다');
select ok(not tests.set_discovery_participation(false, null), '끈다');
select ok(tests.set_discovery_participation(true, pg_temp.summary(), tests.need()), '다시 켠다 — 종료를 켜진 채로 맞는다');

-- ── 2 · 3. 종료 뒤 ──────────────────────────────────────────────────────────

insert into public.beta_schedule (ends_on, note, operator_name, operator_officer, operator_contact)
values ((now() at time zone 'Asia/Seoul')::date - 1, '끝난 베타', '만세력 운영자', '시험 담당', 'ops@example.com');

select ok(public.beta_is_over(), '서울로 어제가 종료일이면 끝났다');

select throws_ok(
  $$select tests.ensure_discovery_participation((select person_id from who), pg_temp.summary(), tests.need())$$,
  '42501', '이용이 정지된 계정입니다.',
  '여는 문은 종료 뒤에 거절한다 — 견줄 기준');
select throws_ok(
  $$select tests.set_discovery_participation(true, pg_temp.summary(), tests.need())$$,
  '42501', '이용이 정지된 계정입니다.',
  '켜는 문도 종료 뒤에 같은 말로 거절한다');
select is(pg_temp.state(), 'in', '거절당한 켜기는 풀의 줄을 안 바꾼다');

select lives_ok(
  $$select tests.set_discovery_participation(false, null)$$,
  '끄는 것은 종료 뒤에도 된다 — 동의를 거두는 길은 안 막는다');
select is(pg_temp.state(), 'out', '끈 것이 풀에 선다');

select * from finish();
rollback;
