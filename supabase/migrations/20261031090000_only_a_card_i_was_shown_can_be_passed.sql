-- 지나칠 수 있는 사람은 내게 카드로 선 적이 있는 사람뿐이다 (보안 감사 3~14 의 하나, 2026-09-28)
--
-- `discovery_passed` 는 `authenticated` 가 직접 넣는 표다(`20260923090000`) — 넘김 단추가 서버 액션에서 upsert
-- 한다(`app/me/discovery/actions.ts` 의 `passCandidate`). 정책은 `user_id = auth.uid()` 만 물었고 **누구를 넘기는지는
-- 안 물었다.** 그래서 앱을 거치지 않고 PostgREST 로 아무 id 나 넣을 수 있었고, 그 한 줄이 복원 문의 조건을 채웠다:
--
--   1. `insert into discovery_passed (passed_user_id) values ('<덱에 선 적 없는 사람>')` — 정책을 지난다
--   2. `restore_passed_connection('<그 사람>')` — 「보관 중인가」는 그 행 하나로 참이 되고, 복원은 그 사람을 **덱 맨 앞**에
--      세우며 노출 기록(`discovery_impression`)을 새로 쓴다
--   3. `request_match('<그 사람>')` — 요청은 「내가 본 그 카드」를 노출 기록에서 찾는다. 2 가 방금 적었으므로 지나간다
--
-- 로컬 스택에서 그대로 쟀다(2026-09-28): 참여자 열셋, 첫 사람의 덱 여섯 · 노출 기록 없는 한 사람을 골라 1 → 2 → 3 이 모두
-- 지나갔고, 그 사람이 덱의 0번 자리에 섰다. 풀의 점수 · 상위 20% 컷 · 씨앗 무작위를 건너뛰고 **id 를 아는 사람을 골라
-- 불러오는 문**이었다. 둘 다 참여 중 · 서로의 성별 조건 · 차단 없음(`discovery_pair_eligible`)은 복원이 여전히 묻는다 —
-- 새는 것은 「추천이 고르지 않은 사람」까지다.
--
-- **넘길 수 있는 사람은 내게 카드로 선 적이 있는 사람**으로 좁힌다. 카드는 덱에 실릴 때 노출 기록을 남긴다(채우기 ·
-- 복원 둘 다, `20261028090000` · `20261025160000`) — 앱의 넘김 단추가 넘기는 사람은 언제나 이 조건을 채운다. 운영의
-- `discovery_passed` 스무 줄 중 노출 기록이 없는 줄은 0 이다(2026-09-28, 집계 질의) — 좁혀도 이미 선 줄이 안 걸린다.
--
-- 앱은 그대로다 — 같은 표 · 같은 upsert 다. 정책 둘(넣기 · 옮기기)에 조건 하나를 더할 뿐이다. `update` 도 조건을
-- 묻는 까닭: 옮기기 정책의 `with check` 가 `user_id` 만 물어서, 내 행의 `passed_user_id` 를 남의 id 로 바꾸는 것으로
-- 같은 문이 열렸다.
--
-- 재는 자리는 `supabase/tests/65_passed_only_shown.test.sql`.

/**
 * 이 사람이 내게 카드로 선 적이 있는가 — 노출 기록에 나와 그 사람의 줄이 있는가.
 *
 * 정책 안에서 불리므로 `authenticated` 가 실행할 수 있어야 한다. 묻는 것은 **나의** 기록뿐이다 — 남의 노출을
 * 묻는 인자가 없다. 노출 기록 표는 사용자에게 안 열려 있어(select 권한 없음) 정책이 표를 직접 못 읽는다.
 */
create function public.discovery_shown_to_me(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.discovery_impression i
    where i.viewer_user_id = (select auth.uid())
      and i.candidate_user_id = p_other
  );
$$;

revoke execute on function public.discovery_shown_to_me(uuid) from public, anon;
grant execute on function public.discovery_shown_to_me(uuid) to authenticated;

drop policy "내 목록에만 쌓는다" on public.discovery_passed;

create policy "내 목록에만 쌓는다"
on public.discovery_passed for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_active_account()
  and public.discovery_shown_to_me(passed_user_id)
);

drop policy "내가 쌓은 것만 맨 위로 옮긴다" on public.discovery_passed;

create policy "내가 쌓은 것만 맨 위로 옮긴다"
on public.discovery_passed for update to authenticated
using (user_id = (select auth.uid()) and public.is_active_account())
with check (
  user_id = (select auth.uid())
  and public.discovery_shown_to_me(passed_user_id)
);
