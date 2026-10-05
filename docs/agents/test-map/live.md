# 시험 지도 — 잠긴 시험

색인은 `docs/agents/test-map.md` 다.

## 잠긴 시험 넷 — `*.live.test.ts`

이름이 말한다. **운영 DB 나 모델을 실제로 두드리는 블록**은 환경변수를 켜야만 돈다(`describe.skipIf`). CI 밖이다.
다만 `call.live.test.ts` 에는 `skipIf` 가 없는 블록 둘(실호출 원문의 이름이 겹치지 않는가 · P0/P1 표본이 실제로 갈리는
명식인가)이 있어 **`npm test` 에서 늘 돈다** — 모델을 안 부르고 돈을 안 쓴다. 그래서 단위의 건너뛴 파일은 넷이 아니라 셋(백필 둘 · 로그인 전 사주 문단)이다.

| 파일 | 켜는 값 | 무엇을 |
| --- | --- | --- |
| `app/me/reading/call.live.test.ts` | `READING_LIVE=1` (변형 · 두 판 · 인연 입력은 `READING_VARIANTS_LIVE` · `READING_PAIR_LIVE` · `READING_MATCH_INPUT_LIVE`) | 네 kind 의 풀이를 실제로 한 번 만든다 — 토큰이 나간다. 원문 옆에 자리 검사(`positionSlips`)와 근거 칸의 층 검사(`groundingTiers`, #427 — 층이 `claims` 상한을 넘는 경로와 분류별 수)를 적는다. 층 검사는 **보고만 하고 실패로 세우지 않는다** |
| `src/lib/input/backfill-chart.live.test.ts` | `BACKFILL_CHART=1` (+ `BACKFILL_TARGET=remote` 와 ref 확인) | 명식 없는 사람 행을 채운다 |
| `src/lib/input/backfill-reading-chart.live.test.ts` | `BACKFILL_READING_CHART=1` | 풀이 행의 여덟 글자를 채운다 |
| `app/me/reading/taste.live.test.ts` | `TASTE_LIVE=1` (+ `TASTE_WRITE=1` 이면 운영 표에 쓴다 · `TASTE_KEYS=` 로 몇 칸만) | 로그인 전 사주 문단 표(720칸)를 채운다 — 토큰이 나간다(ADR 0131) |
| `app/me/reading/taste-run.live.test.ts` | `TASTE_RUN_LIVE=1` (+ `TASTE_RUN_EFFORTS=none,low` · `TASTE_RUN_SAMPLES=` · `TASTE_RUN_PAIR=1` 이면 전체 자기 풀이까지) | **실험** — 개인별 맛보기 · 가입 뒤 이어쓰기의 짝 견본을 `.taste-run-live/` 에 떨군다. DB 에 안 쓴다 — 토큰이 나간다(`docs/notes/2026-10-03-taste-run-experiment.md`). 견본이 신강 · 신약 · 시간 모름 · 남녀를 섞는지 재는 블록은 잠금 없이 `npm test` 에서 돈다 |

접속값은 `src/lib/local-env.ts` 가 `.env.development.local` 에서 읽는다 — 이름과 달리 **운영**
값이다. 그래서 이 다섯만 그 파일을 부른다(실험인 `taste-run.live.test.ts` 를 더해, 2026-10-03).
