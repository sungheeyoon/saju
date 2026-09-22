-- 함수와 표의 **모양** — 행동이 아니라 모양을 잰다
--
-- 이 저장소의 pgTAP 799건은 전부 **행동**을 잰다: 이 역할이 이걸 부르면 막히는가,
-- 저 행이 보이는가. 그래서 `throws_ok` 133 · `is(` 493 · `ok(` 248 이고
-- `policies_are` · `is_definer` · `col_type_is` · `function_returns` 는 **0건**이다.
--
-- 모양은 아무도 안 본다. 그런데 되쓰기 사고가 난 자리가 바로 거기다 — 옛 마이그레이션을
-- 베꼈다가 운영자 풀이권 예외와 하루 상한이 통째로 되감긴 적이 있고(`20260925180000`
-- 머리말), 그때 빨개진 시험은 하나도 없었다. 행동을 재는 시험은 **함수가 다시 적히면서
-- 조용히 달라진 권한·깃발**을 못 본다.
--
-- 여기서 잠그는 넷은 전부 **재서** 골랐다(2026-09-22, 로컬과 운영 양쪽).
--
--   PUBLIC EXECUTE 가 열린 함수   0개 / 0개
--   anon 이 부를 수 있는 함수     3개 / 3개 (이름·인자까지 같다)
--   RLS 가 꺼진 public 표         0개 / 0개 (표는 27개)
--   search_path 안 걸린 definer   0개 / 0개 (definer 는 107개 / 108개)
--
-- **수를 단언하지 않는다.** 「definer 가 107개」는 함수 하나 늘 때마다 깨지는데, 그것은
-- 잠금이 아니라 소음이다. 잠그는 것은 **성질**이다 — 늘어나도 참이어야 하는 것들.

begin;
select plan(6);

-- ---------------------------------------------------------------------------
-- 1. PUBLIC 에 열린 문이 없다
-- ---------------------------------------------------------------------------
--
-- Postgres 함수는 만들면 `PUBLIC EXECUTE` 가 기본으로 붙는다. 역할에 직접 grant 하지
-- 않았다는 것만으로는 닫힌 것이 아니다 — `anon` 도 PUBLIC 의 구성원이다.
--
-- 지금 그것을 막는 것은 `20260826090000_reading.sql:997` 의 한 쌍뿐이다: 그때까지 생긴
-- 함수를 통째로 닫은 `revoke`, 그리고 그 뒤에 생길 함수까지 닫는 `alter default
-- privileges`. **그 한 쌍이 이 저장소의 유일한 방패인데 그것을 재는 시험이 없었다.**
--
-- 이 줄이 빨개지는 때: 누가 `drop function` 뒤에 다시 만들거나(그때 ACL 이 기본값으로
-- 되살아난다), 기본 권한 설정을 되돌리거나, 손으로 `grant execute ... to public` 할 때.
select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and (p.proacl is null
          or exists (select 1 from aclexplode(p.proacl) a
                     where a.grantee = 0 and a.privilege_type = 'EXECUTE'))),
  0,
  'PUBLIC 에 실행이 열린 public 함수는 하나도 없다');

-- ---------------------------------------------------------------------------
-- 2. 로그인 안 한 사람에게 열린 문은 셋뿐이다
-- ---------------------------------------------------------------------------
--
-- 셋 다 그래야 할 까닭이 있다. 베타가 끝났는지와 일정은 **로그인 화면 앞에서** 읽어야
-- 하고, 공유 풀이는 **링크만 든 사람**이 여는 것이다(ADR 0063).
--
-- 수가 아니라 **집합**을 잰다. 하나가 늘면 이름이 함께 드러나므로, 그때 물을 수 있다 —
-- 「이 문이 로그인 앞에 서야 하는 까닭이 무엇인가」. 수만 재면 하나가 늘고 하나가 줄 때
-- 조용히 통과한다.
select set_eq(
  $$select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  $$values ('beta_is_over()'),
           ('current_beta_schedule()'),
           ('shared_reading(p_token text)')$$,
  'anon 이 부를 수 있는 public 함수는 이 셋뿐이다');

-- ---------------------------------------------------------------------------
-- 3. 모든 표에 RLS 가 켜져 있다
-- ---------------------------------------------------------------------------
--
-- 정책을 아무리 잘 써도 `enable row level security` 를 안 걸면 정책은 서지 않는다.
-- 그 한 줄을 빠뜨린 표는 **정책이 있는 채로 전부 열려 있다** — 가장 조용한 사고다.
select is(
  (select count(*)::int
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'RLS 가 꺼진 public 표는 하나도 없다');

-- ---------------------------------------------------------------------------
-- 4. definer 함수는 전부 search_path 가 고정돼 있다
-- ---------------------------------------------------------------------------
--
-- `security definer` 는 소유자 권한으로 돌고 RLS 를 지나간다. 거기에 `search_path` 가
-- 안 걸려 있으면, 부르는 쪽이 제 스키마를 앞에 놓아 함수가 부르는 이름을 바꿔치기할 수
-- 있다 — 알려진 권한 상승 경로다.
--
-- 지금은 100개가 넘는 definer 가 **하나도 빠짐없이** 걸려 있다. 재서 안 것이고, 그래서
-- 지킬 값으로 둘 수 있다. 새로 쓰는 사람이 한 줄을 잊으면 여기서 걸린다.
select is(
  (select count(*)::int
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not coalesce(array_to_string(p.proconfig, ' ') like '%search_path%', false)),
  0,
  'security definer 함수는 전부 search_path 가 고정돼 있다');

-- ---------------------------------------------------------------------------
-- 5~6. 위 넷이 **빈 집합에 대고 참**이 아니라는 것
-- ---------------------------------------------------------------------------
--
-- 1·3·4 는 전부 「0개다」 꼴이라, 재는 대상 자체가 사라지면 조용히 전부 통과한다.
-- 스키마를 못 읽는 자리에서 도는 날 「전부 통과」가 나오는 것이 그 얼굴이다.
select ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef) > 50,
  '재는 대상이 실제로 있다 — definer 함수가 쉰 개를 넘는다');

select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r') > 20,
  '재는 대상이 실제로 있다 — public 표가 스무 개를 넘는다');

select * from finish();
rollback;
