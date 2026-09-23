-- Supabase 보안 advisor 가 낸 경고 중 고친 것이 다시 안 뜬다 (G-23 ⑪)
--
-- `20261009120000` 이 고친 두 갈래를 지킨다. 남긴 경고(부르라고 연 RPC 문 · 유출 비밀번호 검사)는
-- runbook 「보안 advisor」가 까닭과 함께 든다 — 여기서 재는 것은 **고쳤다고 적은 것**뿐이다.
--
-- 1. lint 0011 은 definer 만이 아니라 **모든 함수**의 search_path 를 본다. `42_definer_search_path` 는
--    definer 만 재서, 상수 함수 열다섯이 풀린 채로 초록이었다. 여기는 invoker 까지 잰다.
--    확장이 만든 함수는 우리 것이 아니라 뺀다(advisor 도 뺀다).
-- 2. 밖에서 아무도 안 부르는 definer 셋은 로그인한 사람에게도, 안 한 사람에게도 닫혀 있다.
begin;
select plan(3);

select ok(
  (select count(*) > 30 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'retention') and not p.prosecdef),
  '재는 함수가 있다 — invoker 함수가 서른 개를 넘는다');

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'retention')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '{}'::text[],
  '우리 스키마의 함수는 invoker 까지 전부 search_path 를 고정한다 (lint 0011)');

select is(
  (select coalesce(array_agg(f || ':' || r order by 1), '{}')
   from unnest(array['public.claimed_by(uuid)',
                     'public.may_edit_person_input(uuid, uuid)',
                     'public.beta_is_over()']) f
   cross join unnest(array['anon', 'authenticated']) r
   where has_function_privilege(r, f::regprocedure, 'EXECUTE')),
  '{}'::text[],
  '다른 definer 안에서만 불리는 셋은 밖의 역할에 닫혀 있다 (lint 0028 · 0029)');

select * from finish();
rollback;
