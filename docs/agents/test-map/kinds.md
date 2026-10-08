# 시험 지도 — 시험 넷과 층

색인은 `docs/agents/test-map.md` 다.

## 시험은 넷이고, 층마다 닿는 것이 다르다

| 시험 | 명령 | 무엇을 재나 | 필요한 것 | 수 |
| --- | --- | --- | --- | --- |
| **단위**(vitest) | `npm test` | 순수 함수 — 엔진 · 도메인 lib · `app/**/*.ts` 의 판단 · `scripts/` 의 검사 도구 자신 | 없음 | `npm test` 의 끝 줄 — 실호출 백필 파일은 통째로 건너뛴다 |
| **pgTAP** | `npm run test:db` | 표 · 함수 · 정책이 **역할을 갈아입고** 실제로 막는가, 함수와 표의 모양(ADR 0084) | Docker + `npm run db:start` | `npm run test:db` 의 끝 줄 — 전부 고정 plan(2026-09-26, `no_plan` 둘을 수로 잠갔다 — 단언이 조용히 빠지면 plan 이 붉힌다) |
| **흐름**(`scripts/check-*.mjs`) | `npm run test:flow` | 가입 → 저장 → 요청 · 수락 → 풀이 · 공유를 **실제 스택에 대고**, 모델만 빼고 | Docker + `db:start`. 제 안에서 Next 서버를 띄운다(`check-db-races` · `check-push-race` 는 안 띄우고 psql 둘 · 셋으로 DB 의 두 세션 경합을 일으킨다) | `scripts/check-*.mjs` 한 벌마다 — `npm run test:flow` 가 찍는다 |
| **e2e**(Playwright) | `npm run test:e2e` / `test:e2e:authed` | 화면 — 비로그인 · 로그인 · 둘이 있어야 성립하는 흐름 · 가입 관문 | 익명은 없음(CI 의 껍데기 접속값으로 돈다). 로그인 뒤는 Docker + `db:start` | `npx playwright test --list` — 익명 · 로그인은 기기 둘에서, 관문은 한 번 돈다 |

**vitest 는 `.tsx` 를 불러올 수는 있어도 그리지는 못한다** — `vitest.config.mts` 의 include 가 `src/**` · `app/**` ·
`scripts/**` 의 `*.test.ts` 이고(시험 파일은 `.ts` 뿐이다), 환경은 `node` 다. jsdom 을 안 들였다(`<dialog>` 때문, ADR 0080).
그래서 `.ts` 시험이 `.tsx` 모듈을 import 해 닿는 것은 둘이다.

- **`.tsx` 가 내보내는 순수 함수** — `isNavigationActive`(`app/site-header.test.ts`) · `app/birth-form.test.ts` ·
  `app/me/matching/deck-state.test.ts` · `app/me/reading/panel.test.ts`
- **서버 페이지 함수를 부르고 그 약속만 본다** — DB 를 가짜로 대고 `await Page()` 가 서는가, 못 읽은 결과에서
  던지는가(ADR 0078). `app/compat/page.test.ts` · `app/me/matching/page.test.ts` · `app/me/people/page.test.ts` ·
  `app/me/profile/page.test.ts`(#228). 돌려받은 JSX 를 그리거나 읽지는 않는다

**그리기 · 누름 · 클라이언트 상태는 여전히 e2e 만 잰다.** 그래서 화면의 판단은 `.ts`(또는 `.tsx` 의 내보낸 순수
함수)로 내리고 화면은 그리기만 한다 — 그래야 단위 시험이 닿는다.

## 층 × 시험

| 층 | 자리 | 단위 | pgTAP | 흐름 | e2e |
| --- | --- | --- | --- | --- | --- |
| 엔진 | `src/lib/saju/` | 골든 스냅샷(건수는 스냅샷 머리가 찍는다) · 외부 대조(억부 37 · 종격 41) · 모집단 3000 · 절기 · 음력 왕복 | | | 명식 화면(`saju.spec.ts`) |
| 도메인 lib | `src/lib/{input,reading,discovery,matching,consent,people,profile,account,survey,chat,presence,push}` | 프롬프트 조립 · 검사 · 점수 · 동의 · 관문(실호출 백필 둘은 통째로 건너뛴다) | | | |
| 문 · 액션 | `app/**/*.ts` | 서버 페이지 함수 넷을 부르는 `page.test.ts` 도 여기 든다(실호출 하나는 건너뛴다) — 어댑터 · 파이프라인 · 오류 번역 · 주소 코덱 · 장부(`*.boundary.test.ts`) · 크론 두 주소의 `CRON_SECRET` 자격(`app/api/cron/*/route.test.ts` — 주소를 두드려 403 과 열쇠를 안 꺼냈는가를 본다) | 문이 부르는 함수 전부 | **여기가 본거지** — 문·액션·라우트를 주소로 두드린다 | 로그인 뒤 화면이 지나간다 |
| 화면 | `app/**/*.tsx` | 그리기는 없음 — 내보낸 순수 함수와 서버 페이지 함수의 약속만(위) | | 서버 HTML 만 — `check-reading` 이 「수정 전」 풀이의 딱지 · 표지 색 · 주 단추를 읽는다 | **여기서 누른다.** 누르는 자리 44px · 초점 테두리 한 겹 · 바탕 빛이 되풀이되지 않음은 `e2e/target.ts` 로 잰다(#229 — `saju.spec.ts` 의 새 한 건 · `signed-in.spec.ts` · `match.spec.ts`) |
| 관문 | `proxy.ts` · `src/lib/consent` | `gate.test.ts` · `notice.test.ts` | `20_notice` | | `notice.spec.ts` |
| DB | `supabase/migrations/` | | `supabase/tests/` · 모양 잠금 넷(`33_function_shape`) | 위 | |
| 검사 도구 | `scripts/` · `eslint.config.mjs` | `ci-plan` · `run-checks` · `layers` · `code-rules` · `card-score-sql`(카드 점수의 TS ↔ SQL 이 같은 표를 읽는다) · `worktree-stack` · `secret-env`(비밀의 갈래 · `server-only` 잠금 · runbook 절, G-23 ⑧) · `vercel-ignore`(Preview 를 건너뛸지 — 0 이 건너뜀) · `copy-contracts` · `main-red` · `stack-slot` · `remote-lock` · `db-remote` · `audit-verify` · `brand-share-images`(미리보기 그림의 이름 · 탭 그림의 판) · `merge-sim`(인자와 요약 문장만 — git 은 안 부른다) · `checkout-hint`(메인 체크아웃에 쓸 때 일러 주는 훅) | | | |

## 시험 하나의 시간 — 로컬 5초

시험 하나의 상한은 로컬 5초 · CI 30초다(`vitest.config.mts` 의 `testTimeout`). 로컬 5초는 달아나는 시험을 잡으려고 일부러 좁다 —
넓히지 않는다. 모집단을 도는 시험은 제 파일에 `POPULATION_TIMEOUT_MS` 를 두고 `it` 의 셋째 인자로 든다(예:
`src/lib/saju/daeun/daeun.test.ts`). 시간은 `npx vitest run <파일> --reporter=verbose` 가 시험마다 ms 로 찍고, 많으면
`--reporter=json --outputFile=<파일>` 의 `testResults[].assertionResults[].duration` 을 정렬한다. 늘리기 전에 시험이 안 읽는
것을 짓지 않는지 본다(#509 는 18.9초 → 1.2초).
