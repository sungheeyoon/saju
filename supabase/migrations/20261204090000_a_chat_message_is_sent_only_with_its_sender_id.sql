-- 보내기는 전송 id 를 싣는 세 칸 한 벌뿐이다 — 옛 두 칸 서명을 지운다 (G-96 · ADR 0155 덧, 좁히기)
--
-- `20261201090000` 이 `send_chat_message(p_match_id, p_body, p_client_id)` 를 세우고 옛 두 칸 서명을 떠 있는 옛 앱을 위해
-- 남겼다(넓히기, `docs/ops/runbook/deploy.md` 규약 넷의 3). 새 앱(id 를 싣는 보내기, #624 · #627)은 2026-10-11 묶음 배포
-- `ca4b1924`(09:06 KST)로 운영에 섰고, 그 뒤 운영에서 id 없는 새 메시지는 0 이다(같은 날 집계 — id 있는 것 1 · 없는 것 0).
-- 재기를 지났으니 좁힌다.
--
-- 이 뒤로 `ca4b1924` 앞의 앱은 채팅 보내기가 `PGRST202` 로 선다 — 그 앱으로 Promote 하지 않는다
-- (`docs/ops/runbook/deploy.md` 「묶음 배포」 5 의 롤백 바닥).

drop function public.send_chat_message(uuid, text);
