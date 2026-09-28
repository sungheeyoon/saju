# 운영자 화면은 2단계 인증을 마친 세션에서만 운영자 문을 부른다

> **제안이다**(2026-09-28, 보안 수정 라운드 에이전트 C). 「누가 무엇을 볼 수 있는가」를 바꾸므로 운영자가 머지 전에 답한다
> (`docs/agents/delegation.md` 「결정 점검표」). 화면 문구도 제안안이다.

## 잰 것

- **운영자를 가리는 자리는 DB 의 `is_operator()` 하나다**(`20260915150000_the_operator_reads_the_answers.sql`) — `public.operator`
  에 `auth.uid()` 가 있는가만 묻는다. 그 물음을 쓰는 문은 `authenticated` 에 열린 것만 열넷이다: 설문 일곱(`operator_survey_*` 넷 ·
  `operator_service_survey_*` 셋), 신고 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`),
  `operator_reading_refund_basis` · `operator_audit_export_status`, 인연 궁합의 원문 둘(`my_reading_artifacts` 의 match 줄 ·
  `match_reading_source`). 거절 기록 문 `note_operator_denial` 도 같은 물음으로 운영자를 뺀다.
- **세션의 인증 수준(`aal`)을 보는 자리는 0 이다** — `app/**` · `src/**` · `proxy.ts` · `supabase/migrations/**` 에 `aal` ·
  `mfa` · `getAuthenticatorAssuranceLevel` 이 한 번도 없다(2026-09-28, `grep -rniE "aal|mfa"`). 앱에 TOTP 를 등록하는 길도 없었다.
- **운영자의 판정(검토 · 경고 · 정지)은 앱에 없다.** `review_report` 는 `authenticated` 에 안 열렸고 운영자가 CLI 로 부른다
  (ADR 0105 · 0107) — 이 결정이 닿는 것은 **열람**이다. 감사 문장 「운영자 판정에 MFA 없음」은 「운영자 열람에 MFA 없음」이 맞다.
- 로그인은 구글 하나다. G-23 ⑨ 는 운영자의 **바깥 계정**(Supabase · Vercel · GitHub · PortOne · AWS) MFA 를 들고, 앱 안의
  운영자 세션은 어느 줄도 안 들었다. 운영자의 구글 계정이 새면 그 세션으로 신고 근거 스냅샷 · 설문 글을 그대로 읽었다.
- 운영 Auth 는 TOTP 가 켜져 있다(runbook 「보안 advisor」 끝, 2026-09-24). 로컬 `supabase/config.toml` 은 꺼져 있었다 — 운영과 같게 켰다.

## 정한 것 (제안)

- **운영 화면(`/ops/reports` · `/ops/reports/[reportId]` · `/ops/survey`)의 문은 세션이 aal2 가 아니면 운영자 문을 부르지 않는다**
  (`app/ops/second-factor.ts`). 수준은 서명을 확인한 클레임(`getClaims`)에서 읽는다.
  - aal2 — 지금과 같다(DB 가 판정).
  - aal1 이고 확인을 마친 TOTP 가 있다 — `/ops/mfa?next=…` 로 보낸다.
  - aal1 이고 TOTP 가 없다 · 요소를 못 읽었다 — **운영자가 아닌 사람과 같은 404**, 거절 기록도 같다(`note_operator_denial`).
    운영자가 아닌 사람은 앞으로도 확인 화면을 안 본다 — G-24 ⑪ 「비운영자는 같은 주소에서 404 이고 거절 기록이 남음」이 그대로다.
- **`/ops/mfa` — 등록과 확인.** 로그인한 누구든 제 계정에 TOTP 를 등록하고(QR · 설정 키 → 6자리) 코드로 세션을 aal2 로 올린다.
  운영자 여부를 여기서 묻지 않는다 — 등록으로 열리는 운영자 문은 없다. 확인하는 순간 Supabase 가 그 사람의 다른 세션을 끊는다.
  처음 등록은 운영자가 이 주소로 직접 온다(404 가 확인 화면으로 안 보내므로) — runbook 「운영자 2단계 인증」.
- 확인 전 TOTP 는 등록을 새로 열 때 걷는다(한 사람 요소 상한 10).

## DB 층 — 이 PR 에는 없다

**화면의 막음은 세션 토큰을 쥔 사람이 PostgREST 로 문을 직접 두드리는 길을 못 막는다.** 구글 계정이 샌 경우가 바로 그 길이다.
막음은 `is_operator()` 한 곳에 선다 — 마이그레이션 사슬을 다른 세션이 쥐고 있어 이 PR 은 설계만 적는다.

```sql
create or replace function public.is_operator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.operator o where o.user_id = (select auth.uid()));
$$;
```

- 한 줄로 열넷(위)이 함께 닫힌다. aal1 운영자의 부름은 `note_operator_denial` 이 이제 거절로 적는다(지금은 운영자라 빠진다).
- **안 닿는 것** — `review_report`(CLI, `p_reviewer` 로 `public.operator` 를 직접 본다) · 크론의 열쇠 문 · `postgres` 로 도는 SQL.
  JWT 가 없는 자리라 aal 이 없다. 그 길의 막음은 바깥 계정 MFA(G-23 ⑨)다.
- 인연 궁합 원문 둘(`/me/reading/inspect`)은 aal1 운영자에게 이제 안 선다 — 그 화면에 확인 화면으로 가는 길은 없다(운영자는
  `/ops/mfa` 를 먼저 지나고 온다).
- pgTAP: `request.jwt.claims` 에 `aal` 을 aal1 · aal2 로 갈아 끼워 문 열넷이 aal1 에서 `42501` 인지, `note_operator_denial` 이 aal1
  운영자를 적는지. 기존 운영자 시험(`45_operator_reports` 등)의 클레임에 `"aal":"aal2"` 를 더한다.
- 순서: 이 PR(화면 · 등록 길) → 운영자가 운영에서 TOTP 등록 → 마이그레이션. 거꾸로 가면 등록 길이 서기 전에 운영자가 잠긴다.

## 안 고른 것

- **`proxy.ts` 에서 `/ops/**` 를 aal2 로 막기.** 관문은 접근 판정을 안 한다(`proxy.ts` 머리말) — 그리고 운영자인지 모르는 채로
  막으면 운영자가 아닌 사람까지 확인 화면으로 보내 G-24 ⑪ 의 404 가 깨진다.
- **운영자 문을 먼저 부르고 aal 을 나중에 보기.** 운영자인지는 알 수 있지만 문이 이미 자료를 내주고 접속기록에 「읽음」을 적은 뒤다.
- **aal1 운영자를 확인 화면으로 보내려고 「나는 운영자인가」를 여는 문.** ADR 0061 이 안 열기로 한 문이다. 대신 처음 한 번은
  운영자가 주소를 직접 친다.
- **SMS · WebAuthn.** 전화 공급자는 꺼져 있고(runbook) WebAuthn 은 로컬 설정도 없다. TOTP 는 무료 플랜에 있다.

## 값

- 운영자는 세션마다(새 로그인 · 다른 기기) 6자리를 한 번 더 넣는다. 인증 앱을 잃으면 사람이 대시보드에서 요소를 지운다(runbook).
- e2e 의 운영자 넷이 화면으로 등록 · 확인을 지난다(`e2e/second-factor.ts`, RFC 6238 을 검사 안에서 계산).
