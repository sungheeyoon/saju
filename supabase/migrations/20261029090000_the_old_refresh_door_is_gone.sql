-- 옛 새로고침 문을 걷는다 — **좁히기** (G-61, ADR 0115 · ADR 0071)
--
-- 20261028090000 이 덱을 「여섯 자리 · 떠나면 한 명씩 채우기」로 바꾸면서 옛 앱을 위해 셋을 남겼다(넓히기):
-- 사람이 누르는 새로고침 문 `refresh_discovery_snapshot()`, 그 단추의 남은 대기를 내주던
-- `my_discovery_snapshot()`, 둘이 같이 읽던 5분 쿨다운 `discovery_refresh_cooldown()`.
-- 새 앱(`bac61c1`)은 2026-09-27 15:22(서울)에 운영에 섰고 셋을 안 부른다.
--
-- 2026-09-27 에 저장소 전체(app · src · scripts · e2e · pgTAP)에서 셋을 **부르는** 자리는 0 이다 — 남은 것은
-- 옛 마이그레이션 · 문서의 역사 기록 · 생성된 타입뿐이다. DB 안에서 쿨다운을 부르는 함수는 걷는 둘뿐이다.
--
-- `refresh_discovery_snapshot_for(actor, seed)` 는 남는다 — `my_discovery_board()` 가 새 덱을 세울 때 부르고,
-- pgTAP 이 씨앗으로 부른다. 아무에게도 안 열린 문 그대로다.

drop function public.my_discovery_snapshot();
drop function public.refresh_discovery_snapshot();
drop function public.discovery_refresh_cooldown();
