# 실험 · 평가 코드는 `src/lab` 에 살고, 시험만 그것을 부른다

> **운영자 승인 2026-10-12**(시스템 점검의 후속 일, 조율자가 옮김) — 앱이 부르지 않고 시험 · 잠긴 실호출 · e2e 만 쓰는 실험 · 평가 코드가
> 운영 도메인 lib 에 섞여 있다고 점검이 쟀다. 2026-09-28 밤샘 감사도 「실험 장치를 lab 으로」를 권했다
> (`docs/notes/2026-09-28-overnight-audit.md`). 동작은 바꾸지 않는 파일 이동이다.

ADR 0085 의 층 표에 자리 하나를 더한다. 규칙의 원본은 `docs/architecture.md` 「그 밖의 자리」와 `scripts/layers.test.ts` 다.

## 정한 것

- **`src/lab/` 은 실험 · 평가 코드의 자리다.** 앱(`app/**` 의 시험 아닌 파일 · `proxy.ts`)과 운영 lib(`src/lib/**` 의 시험 아닌
  파일)은 이 자리를 import 하지 않는다 — 부르는 것은 `*.test.ts` · `*.spec.ts` · `e2e/` 와 `src/lab` 자신뿐이다. 운영 lib 의
  시험은 실험판을 견본으로 부를 수 있다(프롬프트 조립 시험이 변형을 대 보는 것처럼).
- **밖으로는 도메인 lib 과 같은 줄을 지킨다** — 앱 · 관문 · React/Next · supabase · 모델 SDK · 실행 환경을 모른다. 엔진과
  도메인 lib 은 부른다. 도메인 lib 끼리의 방향 표에는 들지 않는다 — lib 이 lab 을 부르는 길이 시험뿐이라 순환이 아니다.
- 처음 옮긴 것: 프롬프트 변형(`variants.ts`) · 출력 재기(`measure.ts`) · 인연 궁합 입력 두 판의 자(`match-input-eval.ts`)를
  `src/lab/reading/` 으로, 궁합 공식 비교기(`formula-comparison/`)를 `src/lab/matching/` 으로. 시험은 옆에 함께 옮겼다.
- `src/lib/reading/bundle.ts` 의 `refundableCredits` · `shareIsRefundable` 은 옮기지 않고 지웠다. 운영 호출처가 없고, 같은 판단의
  원본은 DB 함수 `operator_reading_refund_basis` 이며 그 동작은 pgTAP(`48_reading_bundle_ledger`)이 잰다. TS 시험은 SQL 을 재지 않는
  사본의 시험이었다.

## 고르지 않은 것

- **`src/lib/lab/`** — 도메인 lib 의 한 모듈로 두면 `lab → reading` 과 (시험의) `reading → lab` 이 방향 표에서 순환이 된다.
- **`scripts/` 아래** — CI 계획이 `scripts/*.mjs` 를 시험 도구(공용 위험)로, `scripts/*.test.ts` 를 정책 차선으로 가른다. 실험 코드가
  거기 서면 차선의 뜻이 흐려진다.
- **린트로도 「lab 은 시험만 부른다」를 잠그기** — `no-restricted-imports` 는 같은 파일에 두 블록이 걸면 뒤가 앞을 덮어, 운영 lib ·
  앱의 기존 패턴 블록과 섞기 번거롭다. 시험(`scripts/layers.test.ts`)이 잠근다. 밖으로 향하는 줄은 린트도 든다.

## 결과

- 운영 lib(`src/lib` 의 시험 아닌 `.ts`)이 43,583 줄에서 42,042 줄로 1,541 줄 줄었다.
- CI 계획에서 `src/lab/**` 는 `src/` 라 `core` 다. e2e 가 부르는 변형만 시험 도구(`HARNESS`)로 이름이 든다.
