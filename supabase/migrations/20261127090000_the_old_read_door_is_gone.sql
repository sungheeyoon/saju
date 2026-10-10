-- 옛 읽음 문 `mark_chat_read(p_match_id)` 를 걷는다 — 좁히기 (G-77, ADR 0155)
--
-- `20261120090000` 이 새 읽음 문 `mark_chat_read(p_match_id, p_up_to_seq)` 를 세우면서 옛 한 칸 서명을 남겼다(넓히기,
-- `docs/ops/runbook/deploy.md` 「규약 넷」 3) — 떠 있는 옛 앱 · 열린 브라우저 · 롤백이 부르는 창을 닫으려고.
--
-- 걷어도 되는 근거는 잰 값이다(2026-10-10 15:38 서울, `npm run db:remote`): 새 앱(`41a91368`)이 2026-10-08 10:37 서울에
-- Production 으로 오른 뒤 2일 5시간, `pg_stat_statements`(마지막 초기화 2026-10-04 19:16 서울, 축출 `dealloc` 0)에
-- `p_up_to_seq` 없이 `mark_chat_read` 를 부르는 문은 한 줄도 없다. 새 서명을 부르는 문만 7회다.
--
-- 새 서명은 그대로다. 앱 · 흐름 검사는 모두 새 서명을 부른다.

drop function public.mark_chat_read(uuid);
