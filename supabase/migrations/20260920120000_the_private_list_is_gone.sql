-- 「본 궁합」 목록의 문을 닫는다
--
-- `my_private_readings()` 는 `/me/compat` 을 인자 없이 열었을 때 서던 「본 궁합」 목록이
-- 읽던 자리다. 그 목록은 풀이 목록(`my_readings`, ADR 0033)이 대신하면서 화면에서
-- 걷혔고, `/me/compat` 은 이제 인자가 없으면 `/compat` 으로 보낸다. 앱에서 이 함수를
-- 부르는 곳이 없다.
--
-- 부르는 곳이 없는 `security definer` 함수는 남겨 둘 까닭이 없다 — 내주는 것이 곧
-- 브라우저가 볼 수 있는 것이라, 안 쓰는 문도 문이다.

drop function if exists public.my_private_readings();
