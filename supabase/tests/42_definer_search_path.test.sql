-- 권한을 빌리는 함수는 전부 search_path 를 비워 고정한다 (G-23 ③)
--
-- `security definer` 는 만든 사람의 권한으로 돈다. search_path 가 부르는 사람을 따르면
-- 부르는 사람이 앞 스키마에 같은 이름의 함수 · 표를 놓아 그 권한을 빌려 쓸 수 있다.
-- 2026-09-23 에 재 보니 이미 전부(public 128 · retention 1) `search_path=""` 였다 —
-- 이 파일은 그것을 **지킨다.** 이름을 나열하지 않으므로 새 함수도 든다.
--
-- `tests` 스키마는 시험 도우미라 뺀다.
begin;
select plan(3);

select ok(
  (select count(*) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public', 'retention')),
  '재는 함수가 있다 — 빈 목록으로 초록이 되지 않는다');

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public', 'retention')
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  '{}'::text[],
  'security definer 함수는 전부 search_path 를 고정한다');

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by 1), '{}')
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where p.prosecdef and n.nspname in ('public', 'retention')
     and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%' and c <> 'search_path=""')),
  '{}'::text[],
  '고정한 search_path 는 비어 있다 — 이름은 스키마까지 적어 부른다');

select * from finish();
rollback;
