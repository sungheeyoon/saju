-- 운영자 판정이 세션의 2단계 인증(aal2)도 묻는다 (ADR 0209 「DB 층」 — ADR 0123 의 설계, 운영자 결정 2026-10-28, G-65)
--
-- 운영 화면은 aal2 가 아니면 운영자 문을 안 부른다(`app/ops/second-factor.ts`). 그것은 **화면의** 막음이라, 세션 토큰을 쥔 사람이
-- PostgREST 로 문을 직접 두드리면 지나간다 — 구글 계정이 샌 경우, 그리고 켜져 있는 이메일 · 비밀번호 로그인으로 구글을 거치지 않고
-- 든 운영자 계정의 세션이 그 길이다. 막음은 운영자를 가리는 자리 하나(`is_operator()`)에 선다: 그것을 묻는 함수 서른둘(운영자 문 ·
-- 거절 기록 둘 · 인연 궁합 원문 둘, 로컬 `pg_proc` 2026-10-28)이 한 줄로 함께 닫힌다.
--
-- - 몸은 저장소의 마지막 정의(`20261215090000_the_operator_decides_a_report_on_its_screen_and_each_decision_is_kept.sql` 10.)에
--   `aal` 한 줄만 더했다. `create or replace` 라 권한(전부 닫힘)은 그대로이고 아래에서 다시 닫는다.
-- - 수준은 PostgREST 가 서명을 확인한 JWT 의 `aal` 클레임이다 — Supabase Auth 가 TOTP 확인을 마친 세션에 `aal2` 를 적는다.
-- - aal1 운영자의 부름은 이제 운영자가 아니다 — 운영자 문은 `42501`, 거절 기록은 `note_operator_denial` 이 적고
--   `note_operator_refusal` 은 안 적는다(둘은 서로의 반대만 적는다, ADR 0191).
-- - **안 닿는 것** — JWT 가 없는 자리(`postgres` 로 도는 CLI SQL · 크론의 열쇠 문). 실행자를 따로 재는 공통 함수(`book_reading_credit_grant` ·
--   `change_account_status` · `write_report_review`)는 `public.operator` 를 직접 보지만 `authenticated` 에 안 열렸고 위 문 뒤에서만 불린다.
--
-- **차례 — 이 마이그레이션은 문을 좁힌다**(`docs/ops/runbook/deploy.md` 규약 넷의 3). 앱(`/ops/mfa`)이 운영에 오르고 운영자가 운영에서
-- 인증 앱을 등록한 뒤에 `db push` 한다(ADR 0209 「차례」). 먼저 오르면 앱이 나갈 때까지 운영자가 운영 화면을 못 연다.
--
-- 재는 자리는 `supabase/tests/99_operator_door_asks_for_the_second_factor.test.sql`.

create or replace function public.is_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (
       select 1
       from public.operator o
       join public.app_user a on a.id = o.user_id
       where o.user_id = (select auth.uid()) and a.status = 'active'
     );
$$;

revoke execute on function public.is_operator() from anon, public, authenticated, service_role;

comment on function public.is_operator() is
  '지금 부른 사람이 운영자인가 — 운영자 표에 있고, 계정이 이용 중이고, 세션이 2단계 인증(aal2)을 마쳤을 때만 (ADR 0209)';
