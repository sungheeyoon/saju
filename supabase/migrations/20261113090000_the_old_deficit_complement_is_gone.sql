-- 첫인상 점수의 옛 상호보완 셈 `discovery_deficit_complement_v1` 과 그 한 방향 `_one_way_v1` 을 걷는다 (슬롭 감사 G 의 좁히기)
--
-- 두 함수는 `20260915120000` · `20260915130000` 이 세운 `discovery-v1` 첫인상 점수의 상호보완 축이다. 카드 점수가
-- `v2-beta`(ADR 0113 · 0114)로 옮긴 뒤 그 축을 부르던 함수는 하나씩 다시 적혔고, 마지막으로 부르던 정의는
-- `20261021090000` 이었다 — 그 뒤의 정의(`20261105090000` 의 넷)는 v1 균형(`discovery_count_balance_v1`)과
-- 보완 오행(`discovery_supplied_elements_v1`)만 부른다.
--
-- ## 잰 값 (2026-10-01, 로컬 `20261112090000` 까지)
--
-- - **부르는 함수** — `pg_proc.prosrc` 에 `discovery_deficit_complement_v1` 이 든 함수 0. `_one_way_v1` 을 부르는 것은
--   `discovery_deficit_complement_v1` 하나뿐이다. `pg_depend` 0, 뷰 0, 크론 0.
-- - **앱 · scripts · e2e 0** — 운영에 서 있는 앱(`83a6192`)의 `app/` · `proxy.ts` 에도 0. 부르던 것은 pgTAP
--   `07_discovery` 의 단언 넷(값 둘 · 권한 둘)이고 이 PR 이 걷는다.
-- - **권한** — 둘 다 `security invoker` 이고 실행은 소유자 `postgres` 에만 열려 있다(`authenticated` · `anon` 에 안
--   열림). 그래서 이 변경은 **누가 무엇을 볼 수 있는가를 안 바꾼다.**
-- - **TS 쪽 셈은 산다** — `src/lib/discovery/element-axes.ts` 의 `mutualDeficitComplementOf` 는 궁합 점수
--   (`src/lib/matching`)와 비교 도구가 부른다. SQL 쪽 짝만 사라진다.
--
-- 남기는 것: `discovery_count_balance_v1` · `discovery_supplied_elements_v1` — 살아 있는 함수 넷
-- (`fill_discovery_deck` · `my_passed_connections` · `restore_passed_connection` · `request_match`)이 부른다.
--
-- **배포 순서는 상관없다** — 지금 운영의 앱이 이 함수를 안 부른다. 부르는 쪽(v1)을 먼저 지운다.

drop function public.discovery_deficit_complement_v1(jsonb, jsonb);
drop function public.discovery_deficit_complement_one_way_v1(jsonb, jsonb);
