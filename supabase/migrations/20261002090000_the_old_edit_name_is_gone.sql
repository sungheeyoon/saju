-- 저장된 입력을 고치는 문의 옛 이름을 지운다 — **좁히기** (G-43, ADR 0088)
--
-- 20261001090000 이 `edit_person_input` 을 세우고 `add_person_revision` 을 그것을 부르는 얇은 겉으로
-- 남겼다(넓히기). 앱은 #137 로 새 이름을 부르고 그 배포가 Ready 다. 2026-09-23 에 저장소 전체(app ·
-- src · scripts · e2e · pgTAP)에서 옛 이름을 **부르는** 자리는 0 이다 — 남은 것은 옛 마이그레이션과
-- 문서의 역사 기록뿐이다. DB 안에서 옛 이름을 부르는 함수도 0 이다.
--
-- 운영의 함수 호출 수(`pg_stat_user_functions`)는 `track_functions = none` 이라 잴 수 없었다.

drop function public.add_person_revision(
  uuid, text, date, date, time, text, text, text, text, jsonb, text);
