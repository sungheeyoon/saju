-- 「다시 보지 않기」를 걷는다 (ADR 0077)
--
-- 만드는 길이 먼저 사라졌다. 홈의 후보 목록이 매칭으로 옮겨 가면서(ADR 0070) 그 목록에
-- 붙어 있던 「다시 보지 않기」 버튼이 닿을 수 없는 자리가 됐고, ADR 0076 이 그 죽은 가지를
-- 걷으면서 쓰는 액션도 함께 사라졌다. 남은 것은 **아무도 못 채우는 표**와 그 표를 보는
-- 자격 조건 하나다.
--
-- ## 이 제거는 후보 선정을 안 바꾼다
--
-- 프로덕션의 `discovery_hidden` 은 **0행 0명**이다(2026-09-20 두 번 확인). 비어 있는 표를
-- 보는 `not exists` 는 언제나 참이므로, 아래에서 그 절을 걷어도 누가 후보가 되는지는
-- 한 사람도 안 달라진다. **값을 안 바꾸는 제거**다.
--
-- ## 되쓰는 바탕은 마지막에 서 있던 정의다
--
-- 옛 마이그레이션을 베끼지 않았다(`20260925180000` 이 같은 자리에서 같은 말을 한다).
-- 아래 본문은 스키마에서 떠 온 지금 정의에서 **첫 절만** 덜어낸 것이다.
--
-- 서명이 그대로라 `create or replace` 로 둔다 — 권한이 유지된다. `20260825120000` 이 걸어
-- 둔 `revoke execute … from anon, public, authenticated` 도 그대로 선다.
--
-- ## 차단과 지나침은 그대로다
--
-- 셋은 다른 일이다(용어집). 차단은 양방향으로 접촉을 끊고 되돌리지 않으며, 지나침은
-- 최근 스물과 24시간이 수명을 정한다. **「다시 보지 않기」를 차단에 합치지 않는다** —
-- 합치면 「보기 싫다」와 「규칙을 어겼다」가 같은 기록이 된다.

-- ---------------------------------------------------------------------------
-- 1. 자격 판정에서 숨김 절을 덜어낸다
-- ---------------------------------------------------------------------------

create or replace function public.discovery_unavailable(actor uuid, other uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.block b
      where (b.user_id = actor and b.blocked_user_id = other)
         or (b.user_id = other and b.blocked_user_id = actor)
    )
    or exists (
      select 1 from public.match_request r
      where r.status in ('pending', 'accepted', 'rejected')
        and ((r.requester_user_id = actor and r.addressee_user_id = other)
          or (r.requester_user_id = other and r.addressee_user_id = actor))
    );
$$;

-- ---------------------------------------------------------------------------
-- 2. 표를 걷는다
-- ---------------------------------------------------------------------------
--
-- 이 표를 가리키는 FK 는 없고(재어 봤다), 정책 셋과 권한은 표와 함께 떨어진다.
-- 읽는 함수도 위의 하나뿐이었다 — `pg_proc.prosrc` 로 전부 훑어 확인했다.

drop table if exists public.discovery_hidden;
