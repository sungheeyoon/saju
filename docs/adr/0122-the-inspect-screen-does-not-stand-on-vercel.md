# 검산 화면은 Vercel 배포에서 서지 않는다

> **운영자 승인 2026-09-28** — 「운영·Preview 에서 닫기」(조율자가 물어 받은 답).

## 잰 것

- `app/me/reading/inspect/page.tsx` 는 **로그인만** 물었다(`signedInUser` 뒤 곧장 그린다). 운영(Production)에서
  가입한 누구나 `/me/reading/inspect` 를 열어 다음을 읽었다.
  - **프롬프트 몸통 전문** — `READING_PROMPTS` 의 네 kind 전부(「프롬프트 몸통 (자료 없이)」 절, 복사 단추까지)
  - 판본 계약(`READING_POLICY` 의 판본 · 엔진-AI 경계 · 지표)
  - 자기 풀이의 지금 보낼 프롬프트 전체(자기 명식 자료가 붙은 것)
  - 자기 대상(`self` · `person` · `private`)의 저장된 프롬프트 · 근거 · 생성 설정 · 근거 절
- **남의 자료는 안 나왔다.** 인연 궁합의 원문 근거 · 근거 절은 DB 가 운영자이면서 당사자일 때만 낸다(ADR 0068 · 0069).
  그러니 새는 것은 개인정보가 아니라 **우리 프롬프트와 계약**이다.
- 누가 쓰나 — PRD 화면 표는 「주소로만 · **우리 작업대다.** 사용자 동선에 없다」. 부르는 자리는 로컬 흐름
  (`scripts/check-reading.mjs`) · e2e(`e2e/signed-in.spec.ts`) · 화면 사진(`scripts/ui-shots.mjs`)이고 runbook 에는
  운영에서 이 화면을 쓰는 절차가 없다. ADR 0069 가 운영에서 잰 값도 대시보드에서 역할을 바꿔 읽었다.

## 정한 것

- `VERCEL_ENV` 가 `production` · `preview` 이면 **없는 주소**다(`notFound()` → 루트 404). 판단은 `app/me/reading/inspect/open.ts`
  하나가 든다. 로그인보다 먼저 닫는다 — 닫힌 문이 있다는 것도 말하지 않는다.
- 로컬(`next dev` · `next start` · 흐름 · e2e)에서는 그대로 연다.
- 새 화면 문구는 없다 — 루트 404(`app/not-found.tsx`, 2026-09-28 운영자 확정 문구)가 선다.

## 안 고른 것

- **운영자에게만 운영에서 연다.** 판정은 DB 의 `is_operator()` 하나여야 하는데 그 함수는 `authenticated` 에게 닫혀
  있다(`20260915150000_the_operator_reads_the_answers.sql`). 열려면 마이그레이션이 든다 — 운영자가 운영에서 이 화면을
  쓰겠다고 하면 그때 연다.
- **그대로 둔다.** 프롬프트는 우리가 고친 판단의 누적이고 사용자 화면에 나갈 이유가 없다(ADR 0008 · 0025).

## 값

- 운영자도 운영에서 이 화면을 못 연다 — 운영 풀이의 저장된 프롬프트 · 인연 궁합 원문은 SQL(`match_reading_source` ·
  대시보드)로 읽는다.
