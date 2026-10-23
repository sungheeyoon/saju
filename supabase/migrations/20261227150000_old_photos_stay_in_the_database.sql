-- 옛 사진은 옮기지 않는다 — 옮기는 문 셋을 걷는다 (G-120, ADR 0202)
--
-- `20261227090000` 이 옛 사진(바이트 줄)을 저장소로 옮기는 도구(`scripts/photo-move.mjs`)의 문 셋을 열었다 — `photo_move_begin` ·
-- `photo_bytes_to_move` · `photo_bytes_moved`. **운영자 판단(2026-10-23, 운영 베타): 옮기지 않는다.** 한 줄은 바이트 또는 열쇠를 들고
-- (`profile_photo_bytes_or_object`), 바이트 줄은 저장소를 켠 뒤에도 지금 길(`photo_at` 의 `base64`)로 그대로 열린다. 그래서 옛 장은
-- DB 에 남고, 바꾸거나 새로 올리는 장부터 저장소에 산다. 도구와 문을 함께 걷는다 — 열쇠(service_role)에만 열렸던 문이고 앱은 부르지 않는다.
--
-- `photo_object_keys` 는 남긴다 — 열쇠 줄마다 저장소에 두 벌이 있는가를 재는 월 점검(`scripts/photo-verify.mjs`)이 부른다.
--
-- 재는 자리는 `supabase/tests/99_photo_object_store.test.sql`(문 셋이 없다) · `13_reading`(열쇠에만 열린 문 목록).

drop function public.photo_bytes_moved(uuid, integer, bigint, text);
drop function public.photo_bytes_to_move(integer);
drop function public.photo_move_begin(uuid);
