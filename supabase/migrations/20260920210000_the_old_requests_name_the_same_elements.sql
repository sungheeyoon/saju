-- 이미 적힌 요청의 「채우는 오행」을 **지금 후보 카드와 같은 규칙**으로 다시 적는다
--
-- `20260920090000_the_request_names_the_same_elements` 가 `request_match` 를 고쳐 새 요청부터
-- 받는 사람 몫도 `discovery-v1` 규칙(내 비율 20% 미만 · 상대가 1개 이상)으로 적는다. 그 전에
-- 들어온 요청은 받는 사람 몫이 옛 규칙(내게 0개 · 상대가 1개 이상)으로 남아 있고, v1 을
-- 들이기 전의 노출 기록에서 옮긴 요청이면 보낸 사람 몫도 옛 규칙이다.
--
-- 두 값이 화면에 서는 자리는 소식(`/me/requests`)의 요청 카드다 — 「나에게 부족한 … 기운을
-- 이 사람이 채웁니다」·「이 사람에게 부족한 … 기운을 내가 채웁니다」. 옛 규칙은 한 글자도
-- 없는 오행만 셌으므로 1개 이상 20% 미만인 오행이 빠져 있었다.
--
-- ## 무엇으로 다시 세나
--
-- 요청이 붙들어 둔 **노출 기록의 두 요약**으로 센다(`impression_id`). 그때 카드가 본 요약이라
-- 그 사이 누가 입력을 고쳤어도 요청이 가리키는 판과 같다. 노출 기록이 지워진 요청은
-- 다시 셀 재료가 없으므로 그대로 둔다.
--
-- ## 안 건드리는 것
--
-- 오행 두 칸만 바꾼다. 상태·판본·균형 칸은 그대로다. `match_request` 의 update 트리거 둘은
-- 상태가 바뀔 때만 일을 하므로(판본 풀기·보존 정리) 여기서는 돌아도 바뀌는 것이 없다.
-- 이미 v1 과 같은 줄은 쓰지 않는다.

do $$
declare
  changed integer;
begin
  update public.match_request r
  set supplied_to_requester = public.discovery_supplied_elements_v1(i.viewer_summary, i.candidate_summary),
      supplied_to_addressee = public.discovery_supplied_elements_v1(i.candidate_summary, i.viewer_summary)
  from public.discovery_impression i
  where i.id = r.impression_id
    and (
      r.supplied_to_requester is distinct from
        public.discovery_supplied_elements_v1(i.viewer_summary, i.candidate_summary)
      or r.supplied_to_addressee is distinct from
        public.discovery_supplied_elements_v1(i.candidate_summary, i.viewer_summary)
    );

  get diagnostics changed = row_count;
  raise notice '채우는 오행을 discovery-v1 규칙으로 다시 적은 요청: %줄', changed;
end;
$$;
