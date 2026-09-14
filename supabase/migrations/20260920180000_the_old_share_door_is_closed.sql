-- 옛 두 인자짜리 공유 문을 닫는다 — **넓히고 나중에 좁힌다**의 뒷걸음
--
-- `20260917090000_the_share_covers_the_people_and_the_pair` 가 공유 대상을 받는 다섯 인자짜리
-- `share_my_reading(body, metaphor, kind, person_a, person_b)` 를 세우면서, 배포 순서가 DB
-- 먼저인 창 동안 옛 앱이 부를 수 있게 두 인자짜리를 남겨 두었다. 그 창은 닫혔다 — 앱
-- (`app/me/reading/share.ts`)도 흐름 검사(`scripts/check-share.mjs`)도 다섯 인자만 넘긴다.
--
-- 서명을 **정확히** 적어 지운다. 다섯 인자짜리는 그대로 남는다.

drop function if exists public.share_my_reading(text, text);
