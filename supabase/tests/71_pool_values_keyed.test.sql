-- 풀에 오르는 요약과 여덟 글자는 **로그인한 사람이 직접 못 쓴다** (G-64 길 ①, ADR 0136)
--
-- 매칭 풀의 요약 둘(`element_summary` · `need_summary`)과 내 사람의 여덟 글자(`person.current_chart`)는 앱이 엔진으로
-- 짓고 DB 는 모양만 본다. 그 값을 쓰는 문 넷이 `authenticated` 에 열려 있던 동안, 로그인한 사람이 PostgREST 로 직접 부르면
-- 제 저장된 입력과 다른 — 모양만 맞는 — 값을 풀에 올릴 수 있었다(2026-09-28 보안 감사). 이제 넷은 `service_role` 에만
-- 열리고, 부르는 자리는 세션의 사람으로 서버가 지은 값을 싣는 열쇠 모듈 하나다(`app/me/keyed-chart-writes.ts`).
--
-- 여기서 잰다.
--
--   1. 넷 다 이름의 모든 판이 `anon` · `authenticated` 에 닫혀 있고 `service_role` 에만 열려 있다 — 인자 없는 옛 판은 없다
--   2. 브라우저 역할(`authenticated`)로 넷을 부르면 권한 거절(`42501`)이다 — 제 id 를 실어도
--   3. 모양만 맞는 다른 요약 · 여덟 글자를 사용자 역할로 올리는 길이 없다 — 문으로도, 표를 직접 고쳐서도. 풀의 값은 그대로다
begin;
select plan(17);

create temporary table who (uid uuid, person_id uuid);
grant select on who to authenticated, service_role;

/* 서버가 하는 일을 흉내 내어 참여시킨다 — 세션의 사람으로, 열쇠의 문을(`tests.*` 손잡이) */
do $$
declare
  u uuid := tests.signup('pool-keyed@example.com');
  p uuid;
begin
  perform set_config('request.jwt.claims', tests.claims(u), true);
  p := tests.create_self_person('나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울', 'jo', 'localMean',
    tests.chart('丙'), 'chart-for-tests');
  perform tests.set_discovery_participation(true,
    '{"glyphCount":8,"counts":{"木":2,"火":2,"土":2,"金":1,"水":1},"ratios":{"木":0.25,"火":0.25,"土":0.25,"金":0.125,"水":0.125}}'::jsonb,
    tests.need());
  insert into who values (u, p);
end;
$$;

-- ── 1. 권한의 모양 ──────────────────────────────────────────────────────────

select is(
  (select array_agg(p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by 1)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_self_person', 'edit_person_input', 'set_discovery_participation', 'ensure_discovery_participation')
     and (has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))),
  null,
  '풀에 오르는 값을 쓰는 문 넷은 로그인한 사람에게도 익명에게도 닫혀 있다');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_self_person', 'edit_person_input', 'set_discovery_participation', 'ensure_discovery_participation')
     and has_function_privilege('service_role', p.oid, 'EXECUTE')
     and pg_get_function_identity_arguments(p.oid) like 'p_user_id uuid, %'),
  4,
  '넷은 사람 id 를 첫 인자로 받는 판 하나씩이고 열쇠에만 열려 있다');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_self_person', 'edit_person_input', 'set_discovery_participation', 'ensure_discovery_participation')),
  4,
  '인자 없는 옛 판은 남지 않았다 — 이름마다 한 판이다');

-- ── 2. 브라우저 역할로 부르면 권한 거절 ─────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', tests.claims((select uid from who)), true);

select throws_ok(
  format($$select public.set_discovery_participation(%L::uuid, true,
    '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb,
    tests.need('火', '水'))$$, (select uid from who)),
  '42501', null,
  '제 id 를 실어도 참여 요약을 쓰는 문을 부를 수 없다');

select throws_ok(
  format($$select public.ensure_discovery_participation(%L::uuid, %L::uuid,
    '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb,
    tests.need('火', '水'))$$, (select uid from who), (select person_id from who)),
  '42501', null,
  '참여를 여는 문도 부를 수 없다');

select throws_ok(
  format($$select public.edit_person_input(%L::uuid, %L::uuid, 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울',
    'jo', 'localMean', tests.chart('庚'), 'chart-for-tests')$$, (select uid from who), (select person_id from who)),
  '42501', null,
  '입력과 여덟 글자를 고치는 문도 부를 수 없다');

select throws_ok(
  format($$select public.create_self_person(%L::uuid, '나', 'solar', '1990-05-15', '1990-05-15', '14:30', 'female', '서울',
    'jo', 'localMean', tests.chart('庚'), 'chart-for-tests')$$, (select uid from who)),
  '42501', null,
  '내 사람을 등록하는 문도 부를 수 없다');

select throws_ok(
  $$select public.set_discovery_participation(false, null::jsonb, null::jsonb)$$,
  '42883', null,
  '인자 없는 옛 판은 없다 — PostgREST 로 옛 모양을 불러도 문이 없다');

-- ── 3. 모양만 맞는 다른 값을 올리는 다른 길도 없다 ─────────────────────────

select throws_ok(
  $$update public.discovery_profile
    set element_summary = '{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb$$,
  '42501', null,
  '풀의 오행 요약 칸을 직접 고칠 수 없다');

select throws_ok(
  $$update public.discovery_profile set need_summary = tests.need('火', '水')$$,
  '42501', null,
  '필요한 기운 요약 칸을 직접 고칠 수 없다');

select throws_ok(
  $$update public.person set current_chart = tests.chart('庚')$$,
  '42501', null,
  '내 사람의 여덟 글자를 직접 고칠 수 없다');

select throws_ok(
  $$insert into public.discovery_profile (element_summary)
    values ('{"glyphCount":8,"counts":{"木":8,"火":0,"土":0,"金":0,"水":0},"ratios":{"木":1,"火":0,"土":0,"金":0,"水":0}}'::jsonb)$$,
  '42501', null,
  '요약을 실은 새 줄을 넣을 수도 없다');

reset role;

select is(
  (select element_summary -> 'counts' ->> '木' from public.discovery_profile where user_id = (select uid from who)),
  '2',
  '거절된 시도 뒤에도 풀의 오행 요약은 서버가 올린 그대로다');

select is(
  (select need_summary ->> 'primary' from public.discovery_profile where user_id = (select uid from who)),
  '木',
  '필요한 기운 요약도 그대로다');

select is(
  (select current_chart ->> 'dayMaster' from public.person where id = (select person_id from who)),
  '丙',
  '여덟 글자도 그대로다');

-- ── 열쇠로 부르면 선다 — 막힌 것이 문 자체가 아니라 역할이다 ─────────────────

set local role service_role;

select is(
  public.set_discovery_participation((select uid from who), false, null, null),
  false,
  '열쇠는 세션의 사람 id 로 참여를 끈다');

reset role;

select ok(
  (select opted_out_at is not null and element_summary is null
   from public.discovery_profile where user_id = (select uid from who)),
  '끈 사람의 요약은 걷힌다 — 열쇠의 문도 옛 판과 같은 판정을 지난다');

select * from finish();
rollback;
