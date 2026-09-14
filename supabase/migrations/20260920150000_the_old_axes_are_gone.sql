-- 옛 오행 축을 걷는다
--
-- `discovery_complement`·`discovery_complement_one_way`·`discovery_combined_balance`·
-- `discovery_supplied_elements` 는 첫 후보 정책(`20260825090000_discovery`)의 셈이다.
-- 없는 오행(0개)을 채우는 비율과 가중 비율의 쏠림으로 쟀다.
--
-- 후보 노출이 `discovery-v1`(보이는 글자 수 · 20% 미만 부족분)로 옮기면서 셋은 부르는
-- 곳이 없어졌고, 마지막 하나는 `request_match` 가 받는 쪽 몫을 세며 붙들고 있다가
-- `20260920090000_the_request_names_the_same_elements` 에서 v1 으로 갈렸다. 이제 넷 다
-- 부르는 함수도 뷰도 정책도 앱도 없다.
--
-- 남겨 두면 같은 이름의 셈이 두 벌 서 있게 되고, 다음에 이 자리를 만지는 사람이 옛 쪽을
-- 부른다 — 받는 쪽 오행이 실제로 그렇게 어긋났다.

drop function if exists public.discovery_complement(jsonb, jsonb);
drop function if exists public.discovery_complement_one_way(jsonb, jsonb);
drop function if exists public.discovery_combined_balance(jsonb, jsonb);
drop function if exists public.discovery_supplied_elements(jsonb, jsonb);
