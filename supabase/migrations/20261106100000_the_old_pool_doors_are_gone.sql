-- 풀에 오르는 값을 쓰는 문 넷의 **인자 없는 옛 판을 걷는다** (G-64 길 ①, ADR 0136 — 좁히기)
--
-- 넓히기(`20261106090000`)가 사람 id 를 첫 인자로 받는 판을 `service_role` 에만 세웠고, 앱은 열쇠 모듈
-- (`app/me/keyed-chart-writes.ts`) 하나에서 세션의 사람으로 그 판을 부른다. 옛 판은 `auth.uid()` 로 사람을 정하고
-- `authenticated` 에 열려 있어, 로그인한 사람이 PostgREST 로 직접 부르면 모양만 맞는 다른 요약 · 여덟 글자를 풀에
-- 올릴 수 있었다. 그 판을 걷으면 이 넷에 대해 브라우저 역할이 부를 수 있는 문이 하나도 안 남는다.
--
-- **앱이 새 판으로 옮겨 배포된 뒤에 올린다** — 옛 앱은 옛 판을 부른다(ADR 0071). 재는 자리는
-- `supabase/tests/72_pool_values_keyed.test.sql`.

drop function public.create_self_person(
  text, text, date, date, time without time zone, text, text, text, text, jsonb, text);

drop function public.edit_person_input(
  uuid, text, date, date, time without time zone, text, text, text, text, jsonb, text);

drop function public.set_discovery_participation(boolean, jsonb, jsonb);

drop function public.ensure_discovery_participation(uuid, jsonb, jsonb);
