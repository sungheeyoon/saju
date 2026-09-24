# 시험 지도

이 문서는 **무엇을 고쳤을 때 무엇을 돌리는가** 하나만 답한다. 어디에 놓는가는
`docs/architecture.md`, 어떻게 적는가는 `docs/agents/code-rules.md`. CI 가 무엇을 돌리는가의
**규칙은 `scripts/ci-plan.mjs` 한 곳**이고(ADR 0082), 이 문서는 그 규칙을 사람이 읽는 표로
옮긴 것이다 — 어긋나면 `ci-plan.mjs` 가 맞다. 값은 **2026-09-22 에 잰 것**이다(ADR 0087). 아래 두 표의 파일 수 ·
시험 수는 **2026-09-25 에 다시 쟀다**(#229 뒤, `aa6f0a3`) — 단위는 `npm test` 의 끝 줄, pgTAP 은 `npm run test:db` 의 끝 줄과
`select plan(N)` 의 합, e2e 는 `npx playwright test --list`, 파일 수는 `find … -name '*.test.ts'` 다. pgTAP 과 흐름은 #222 뒤로
`supabase/tests` · `scripts/check-*.mjs` 가 안 바뀌어 그때 잰 값이다(파일 수와 plan 합은 다시 셌다).

## 시험은 넷이고, 층마다 닿는 것이 다르다

| 시험 | 명령 | 무엇을 재나 | 필요한 것 | 수 |
| --- | --- | --- | --- | --- |
| **단위**(vitest) | `npm test` | 순수 함수 — 엔진 · 도메인 lib · `app/**/*.ts` 의 판단 · `scripts/` 의 검사 도구 자신 | 없음 | 142 파일(그중 둘은 통째로 건너뜀 — 실호출 백필) · 2,411 통과 + 10 건너뜀 · 13초 |
| **pgTAP** | `npm run test:db` | 표 · 함수 · 정책이 **역할을 갈아입고** 실제로 막는가, 함수와 표의 모양(ADR 0084) | Docker + `npm run db:start` | 57 파일 · 1,453 건(고정 plan 1,424 + `no_plan` 둘) |
| **흐름**(`scripts/check-*.mjs`) | `npm run test:flow` | 가입 → 저장 → 요청 · 수락 → 풀이 · 공유를 **실제 스택에 대고**, 모델만 빼고 | Docker + `db:start`. 제 안에서 Next 서버를 띄운다(`check-db-races` 는 안 띄우고 psql 둘 · 셋으로 DB 의 두 세션 경합을 일으킨다) | 9 벌 · 단언 464(2026-09-25) |
| **e2e**(Playwright) | `npm run test:e2e` / `test:e2e:authed` | 화면 — 비로그인 · 로그인 · 둘이 있어야 성립하는 흐름 · 가입 관문 | 익명은 없음(CI 의 껍데기 접속값으로 돈다). 로그인 뒤는 Docker + `db:start` | 8 파일 · 익명 34 × 2 기기, 로그인 73 × 2 기기, 관문 9 — 합 223 |

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
| 엔진 | `src/lib/saju/` | **46 파일** — 골든 스냅샷(건수는 스냅샷 머리가 찍는다) · 외부 대조(억부 37 · 종격 41) · 모집단 3000 · 절기 · 음력 왕복 | | | 명식 화면(`saju.spec.ts` 22) |
| 도메인 lib | `src/lib/{input,reading,discovery,matching,consent,people,profile,account,survey,chat,presence}` | **34 파일**(+ 실호출 백필 둘) — 프롬프트 조립 · 검사 · 점수 · 동의 · 관문 | | | |
| 문 · 액션 | `app/**/*.ts` | **45 파일**(+ 실호출 하나 — 서버 페이지 함수 넷을 부르는 `page.test.ts` 도 여기 든다) — 어댑터 · 파이프라인 · 오류 번역 · 주소 코덱 · 장부(`*.boundary.test.ts`) · 크론 두 주소의 `CRON_SECRET` 자격(`app/api/cron/*/route.test.ts` — 주소를 두드려 403 과 열쇠를 안 꺼냈는가를 본다) | 문이 부르는 함수 전부 | **여기가 본거지** — 문·액션·라우트를 주소로 두드린다 | 로그인 뒤 화면이 지나간다 |
| 화면 | `app/**/*.tsx` | 그리기는 없음 — 내보낸 순수 함수와 서버 페이지 함수의 약속만(위) | | 서버 HTML 만 — `check-reading` 이 「수정 전」 풀이의 딱지 · 표지 색 · 주 단추를 읽는다 | **여기서 누른다** — 116 건(기기 둘을 겹치면 223). 누르는 자리 44px · 초점 테두리 한 겹 · 바탕 빛이 되풀이되지 않음은 `e2e/target.ts` 로 잰다(#229 — `saju.spec.ts` 의 새 한 건 · `signed-in.spec.ts` · `match.spec.ts`) |
| 관문 | `proxy.ts` · `src/lib/consent` | `gate.test.ts` · `notice.test.ts` | `20_notice` | | `notice.spec.ts` 9 |
| DB | `supabase/migrations/` | | **57 파일** · 모양 잠금 넷(`33_function_shape`) | 위 | |
| 검사 도구 | `scripts/` · `eslint.config.mjs` | **14 파일** — `ci-plan` · `run-checks` · `layers` · `code-rules` · `worktree-stack` · `secret-env`(비밀의 갈래 · `server-only` 잠금 · runbook 절, G-23 ⑧) · `vercel-ignore`(Preview 를 건너뛸지 — 0 이 건너뜀) · `copy-contracts` · `main-red` · `stack-slot` · `remote-lock` · `db-remote` · `audit-verify` · `brand-share-images` | | | |

## 무엇을 고쳤으면 무엇을 돌리나

**공개 출시 전(지금)에는 로컬 최소가 `npm test` · `npm run typecheck` · `npm run lint` 셋이다**(#161, ADR 0097).
화면 · 흐름 · DB 는 머지 뒤 main 의 전체 검증이 재고, 붉으면 `ci-main-red` 이슈가 든다. 예외 넷은 CI 가 대신
못 하거나 머지 전에 알아야 하는 것이라 남긴다:

- **e2e · 흐름 시험 자체를 고쳤으면** 그 시험을 한 번 돌린다 — 시험이 도는지는 시험을 돌려야 안다
- **새 잠금 · 계약 시험을 세웠으면** 일부러 깨뜨려 붉어지는지 본다(PR 의 「잠금이면 일부러 어긴 것」)
- **마이그레이션은** 아래 표의 줄 그대로(pgTAP · 생성 타입) — `supabase/**` PR 은 CI 도 머지 전에 전부를 돈다
- **프롬프트 본문을 바꿨으면** 실호출 한 번 — CI 는 모델을 안 부른다

아래 표는 **공개 출시 뒤의 로컬 최소**이고, 지금은 「이 자리를 고치면 무엇이 재나」를 찾는 지도다. 그때는 화면이나
라우트를 건드렸으면 커밋 전에 e2e 를 돌린다 — 단위 시험은 화면이 사라진 것을 모른다.

| 고친 것 | 돌리는 것 | 왜 그것만 |
| --- | --- | --- |
| `docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts` | `npx vitest run scripts/` | `code-rules.test.ts` 가 대장 · PRD · 위임 규약 · ADR · 설정을 읽는다. CI 는 `policy` 차선이다 |
| `src/lib/saju/**` · `app/saju/**` | `npm test` → `npm run typecheck` · `npm run lint` | 로그인 뒤 화면과 흐름 검사는 같은 엔진으로 기대값을 짓는다. **예외** — `version.ts` · `pillars/index.ts` 는 DB 검사식이 보므로 전부 |
| `src/lib/*` (엔진 밖) | `npm test`, 프롬프트면 아래 「프롬프트」 | 순수 함수. 문이 부르는 모양이 바뀌면 `typecheck` 가 잡는다 |
| `app/**/*.ts` — 문 · 액션 · 라우트 | `npm test` → `npm run test:flow` | 문의 실패 셋과 액션의 값은 단위가, 실제 스택에서 문이 여는가는 흐름이 |
| `app/api/cron/reading/**` | `npx vitest run app/api/cron` | 복구기의 자격 — 머리 없음 · 다른 비밀 · `Basic` · 비밀이 없는 배포는 403 이고 열쇠를 안 꺼낸다, 맞는 비밀만 일감을 줍는다(`route.test.ts`). 소스를 훑는 정규식(`app/me/reading/boundary.test.ts`)은 조건이 헐거워져도 초록이었다 |
| `app/**/*.tsx` — 화면 | 비로그인 화면 `npm run test:e2e`, 로그인 뒤 `npm run test:e2e:signed-in` · 요청·수락이면 `test:e2e:match` · 채팅이면 `test:e2e:chat`. 서버 페이지의 읽기를 고쳤으면 옆의 `page.test.ts` 도 | vitest 는 그리지 못한다(위). 문구만 바뀐 라운드는 안 돌린다 |
| `proxy.ts` · `src/lib/consent` | `npm test` → `npm run test:e2e:notice` | 관문은 링크를 눌러야 밟힌다 — `page.goto` 로는 못 잰다(ADR 0041) |
| `supabase/migrations/**` | `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` → `npm run test:flow` | 생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다(ADR 0078). CI 의 `authed` 중 `notice` 차선이 diff 를 본다 |
| 프롬프트(`src/lib/reading/prompt*` · `parts.ts` · `vocabulary.ts`) | `npm test`, 본문이 바뀌면 `READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` | 조립 스냅샷은 단위가 든다. **본문이 한 글자라도 바뀌면 실호출 한 번**(ADR 0073). 경로 이름이 본문에 샌 적이 있다 |
| `scripts/ci-plan.mjs` · `release-stage.mjs` · `verify.yml` · `main-red.yml` | `npm test` | `ci-plan.test.ts` 가 단계별 계획을, `main-red.test.ts` 가 이슈의 판단을 든다. YAML 에 `paths` 를 적지 않는다 |
| `vercel.json` · `scripts/vercel-ignore.mjs` | `npx vitest run scripts/vercel-ignore.test.ts` | Vercel 이 Preview 를 건너뛸지. **0 이면 건너뛰고 1 이면 빌드한다** — 시험이 그 반대 의미와 「모르면 빌드」를 든다(runbook 「배포」) |
| `package.json` · `package-lock.json` | `npm audit --omit=dev --audit-level=high` → `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` | CI 는 `fast` 와 `audit` 만 돈다. 의존성은 화면과 DB 도구에도 닿으니 큰 판 올림이면 e2e · pgTAP 도 한 번 |
| `eslint.config.mjs` · `scripts/*.test.ts` | `npm run lint` → `npm test`, 그리고 **일부러 어긴 파일**로 걸리는지 | 「규칙을 넣었다」와 「규칙이 건다」는 다른 문장이다(ADR 0085·0086) |
| `app/api/cron/audit-export/**` · `scripts/db-remote.mjs` · `scripts/audit-verify.mjs` | `npx vitest run app/api/cron/audit-export scripts/db-remote.test.ts scripts/audit-verify.test.ts`(자격은 복구기와 같은 모양으로 `route.test.ts` 가 든다), 표 · 함수면 `npm run test:db`(`46_operator_access_log` · `50_audit_export_runs`) · `node scripts/check-db-races.mjs`(반출과 늦은 커밋 · 거절 한도 · 같은 열쇠의 주문 · 두 반출 실행 · CLI 결과 한 줄 — 두 세션 경합, `20261013090000` · `20261014090000` · `20261015090000`) | 접속기록 반출과 CLI 기록(ADR 0105). S3 는 가짜로 대신한다 — 진짜 버킷은 AWS 계정이 서는 날 runbook 「반출」의 7 이 잰다 |

**워크트리에서는 제 자리의 포트다** — `npm run stack:slot -- N` 이 스택 이름 · Supabase 포트 · dev 서버(`3000+10N`) ·
흐름 검사(`3210+10N` 부터 여덟)를 함께 옮긴다(ADR 0096). 아래는 main 체크아웃(자리 0)의 이야기다.

**먼저 죽여야 하는 것** — 3000 의 dev 서버. 로그인 e2e 와 흐름 검사는 제 서버를 띄우고,
남의 서버를 재사용하면 옛 코드를 잰다. `lsof -i :3000` 로 본다.

## 잠긴 시험 셋 — `*.live.test.ts`

이름이 말한다. **운영 DB 나 모델을 실제로 두드리는 블록**은 환경변수를 켜야만 돈다(`describe.skipIf`). CI 밖이다.
다만 `call.live.test.ts` 에는 `skipIf` 가 없는 블록 둘(실호출 원문의 이름이 겹치지 않는가 · P0/P1 표본이 실제로 갈리는
명식인가)이 있어 **`npm test` 에서 늘 돈다** — 모델을 안 부르고 돈을 안 쓴다. 그래서 단위의 건너뛴 파일은 셋이 아니라 백필 둘이다.

| 파일 | 켜는 값 | 무엇을 |
| --- | --- | --- |
| `app/me/reading/call.live.test.ts` | `READING_LIVE=1` (변형 · 두 판 · 인연 입력은 `READING_VARIANTS_LIVE` · `READING_PAIR_LIVE` · `READING_MATCH_INPUT_LIVE`) | 네 kind 의 풀이를 실제로 한 번 만든다 — 토큰이 나간다 |
| `src/lib/input/backfill-chart.live.test.ts` | `BACKFILL_CHART=1` (+ `BACKFILL_TARGET=remote` 와 ref 확인) | 명식 없는 사람 행을 채운다 |
| `src/lib/input/backfill-reading-chart.live.test.ts` | `BACKFILL_READING_CHART=1` | 풀이 행의 여덟 글자를 채운다 |

접속값은 `src/lib/local-env.ts` 가 `.env.development.local` 에서 읽는다 — 이름과 달리 **운영**
값이다. 그래서 이 셋만 그 파일을 부른다.

## CI

`scripts/ci-plan.mjs` 가 **출시 단계**(PRD §7.0 의 「(지금)」, `scripts/release-stage.mjs`)와 바뀐 파일로 계획을
고르고, `verify.yml` 은 그 답을 읽을 뿐이다. `gate` 가 필수 검사라 `--auto` 머지는 초록까지 기다린다.

**공개 출시 전(지금) — 빠른 검사만 머지를 막는다**(#161, ADR 0097)

| 바뀐 것 | 도는 차선 | 시간 |
| --- | --- | --- |
| 정책만(문서 · `.claude/**` · `scripts/*.test.ts`) | `policy` | 31초(#153) |
| `supabase/**` 가 하나라도 | 전부 — 라벨 없이 | 약 5분 |
| 그 밖 전부 | `fast`(단위 · 타입 · 린트 · 빌드 — 명령은 `ci-plan.mjs` 의 `FAST_STEPS`) | 빌드 없이 1분 55초(#162), 빌드를 넣은 뒤(#219)의 시간은 아직 안 쟀다 — 전에는 전부 약 5분 |
| 단계를 모른다(「(지금)」이 없거나 둘 · 표에 없는 이름) | 전부 | |

**운영 의존성 감사 `audit` 은 단계와 따로 켠다**(G-23 ①, ADR 0104) — `npm audit --omit=dev --audit-level=high`. 결과를 바꾸는
것이 바뀐 파일이 아니라 밖의 advisory DB 라서, PR 에서는 **`package.json` · `package-lock.json` 을 바꾼 PR 에만** 머지를
막는다(라벨 · 빈 diff 도 켠다). 아무것도 안 바꾼 PR 이 어느 날 붉어지는 일이 없다. 새로 뜬 advisory 는 main 푸시와 하루
한 번의 일정이 잡고, `ci-main-red` 가 「`audit` 만 붉다」고 적는다. 절차는 runbook 「운영 의존성 취약점」. 개발 의존성은
CI 가 안 막는다.

전체(빌드 · 익명 e2e · `authed` 일곱 · `flow`)는 **머지 뒤 최신 main 하나**에서 비차단으로 돈다. 붉으면
`main-red.yml` 이 `ci-main-red` 이슈 하나를 열고(이미 있으면 댓글), 지금 main 머리가 초록이 되면 닫는다.
PRD 의 「(지금)」을 공개 출시로 옮기면 아래 세 단계로 저절로 돌아간다 — 실제 사용자 데이터가 들어오는 날에는
사람이 그날 옮긴다(`docs/ops/runbook.md` 「초대」).

**빌드는 끝에 비밀 검사를 돈다**(`npm run build` = `next build && node scripts/secret-env.mjs`, G-23 ⑧) — 브라우저로 가는 파일에
비밀 이름이나 그 빌드의 비밀 값이 있으면 빌드가 선다. CI 는 빌드가 드는 차선(머지 전 `fast` · 머지 뒤 main 의 `verify`)에서,
**Vercel 은 배포 빌드마다 진짜 값을 들고** 돈다. 새 차선은 없다. `fast` 에 빌드를 넣은 까닭은 `next build` 만 잡는 실패다 —
`app/**/icon.tsx` 는 파비콘 라우트로 읽혀 빌드가 섰는데 단위 · 타입 · 린트는 초록이라 Production 이 두 시간 멈췄다(#219).

**공개 출시 뒤 — 머지 전에 전체를 잰다**

| 바뀐 것이 이 안에만 있으면 | 도는 차선 | 2026-09-22 의 시간 |
| --- | --- | --- |
| 정책(문서 · `.claude/**` · `scripts/*.test.ts`) | `policy`(scripts 시험 · 타입 · 린트) | 31초(#153) |
| 엔진 · `app/saju/**` | `verify`(단위 · 타입 · 린트 · 빌드 + 익명 e2e) | 3분 55초 |
| 그 밖 전부 · 모르는 파일 | `verify` + `authed` 일곱(`signed-in` · `match` · `chat` × 기기 둘, `notice`) + `flow` | 병렬, 가장 긴 차선 4분 53초 |

`authed` 는 `db:start` 를 하고 e2e 차선 하나를 돈다. pgTAP 과 **생성 타입 diff** 는 그 일곱 중 **`notice` 차선만** 본다
(`verify.yml` 의 `if: matrix.lane == 'notice'` — e2e 가 남긴 계정이 전역으로 세는 pgTAP 을 흐리므로 e2e 앞, 가장 짧은 차선에 둔다).
`full-ci` 라벨은 더할 수만 있다. `main` 푸시와 손으로 켠 실행은 계획을 안 보고 전부 돈다.
**main 푸시는 최신 하나만 끝까지 돈다** — 새 푸시가 앞 실행을 끊는다(#161 이 #143 의 「커밋마다 제 그룹」을
되돌렸다). 끊긴 실행은 실패가 아니다. 하루 한 번의 일정은 제 그룹이라 안 끊긴다. 보호 규칙은 strict 라 PR 은
최신 main 을 품어야 든다(`BEHIND` 면 `gh pr update-branch`).

## 커버리지 — 한 번 쟀다

도구를 안 들였다(`@vitest/coverage-v8` 은 devDependency 에 없다). 2026-09-22 에 `--no-save` 로
한 번 재고 값만 둔다 — 문턱도 없다.

```bash
npm i -D --no-save @vitest/coverage-v8@4.1.10
CI=1 npx vitest run --coverage --coverage.reporter=text \
  --coverage.include='src/**/*.ts' --coverage.include='app/**/*.ts' --coverage.include='app/**/*.tsx' \
  --coverage.exclude='**/*.test.ts' --coverage.exclude='**/*.generated.ts'
```

| 자리 | 파일 | 실행 줄 | vitest 가 닿은 비율 |
| --- | --- | --- | --- |
| `src/lib/saju` | 70 | 2,023 | **99.0%** |
| `src/lib/reading` | 14 | 578 | 97.4% |
| `src/lib/{input,consent,discovery,matching,people,profile,account,db}` | 16 | 312 | 91~100% |
| `src/lib/survey` | 1 | 36 | 0% → **100%**(2026-09-23, `index.test.ts` — 판단 넷) |
| `app/**/*.ts` | 61 | 899 | **31.4%** — 34 파일이 0% |
| `app/**/*.tsx` | 89 | 2,088 | **1.8%** |
| `proxy.ts` | 1 | 17 | 0% |

**낮은 수가 구멍은 아니다.** `app` 의 0% 서른넷은 액션 · 라우트 · 문(`actions.ts` ·
`route.ts` · `candidates.ts` · `same-chart.ts` …)이고, 그것들은 **흐름 검사와 pgTAP 이 실제
스택에서 잰다.** 화면 `.tsx` 는 e2e 가 잰다. `proxy.ts` 는 `notice.spec.ts` 가 밟는다. 이 표가
말하는 것은 「vitest 의 사정권이 어디서 끝나는가」이지 「무엇이 안 재어졌는가」가 아니다.
그래서 CI 에 문턱을 안 건다 — 문턱은 `.tsx` 를 `.ts` 로 억지로 옮기거나 화면 시험을 흉내 내게
만든다.

**정말로 비던 자리 셋**은 2026-09-23 에 다시 쟀다(G-47). 셋 다 vitest 0% 였다.

| 자리 | 무엇인가 | 이제 |
| --- | --- | --- |
| `src/lib/survey` | 표만이 아니었다 — 폼과 운영 화면이 부르는 **순수 판단 넷**(`afterPicking` · `isAnswered` · `withoutHidden` · `choiceLabel`) | **단위가 잰다** — `index.test.ts` 25건, 100%. 슬러그와 DB 검사식은 pgTAP `27_service_survey`, 폼을 누르는 것은 `signed-in.spec.ts` |
| `app/hash-query.ts` | `'use client'` 훅 — `window.location` · `history` · `sessionStorage` 를 구독한다. 코덱은 `src/lib/input/query.ts` 에 있고 그쪽은 이미 단위가 잰다 | **단위로 안 잰다.** 남는 것이 브라우저 구독뿐이라 jsdom 없이는 흉내가 된다. e2e 가 잰다 — `saju.spec.ts`(`#` 링크를 읽고 쓴다) · `reading-entry.spec.ts`(`#resume-reading`) |
| `app/me/reading/preview.ts` | 서버에서 계정 · 사람 행을 읽어 자기 풀이 프롬프트를 짓는 문. 조립은 `readingPromptOf` 가 하고 그쪽은 단위가 잰다 | **단위로 안 잰다.** 판단이 DB 를 읽은 값에 매여 있다. 흐름 `check-reading.mjs`(`/me/reading/inspect?kind=self`) · e2e `signed-in.spec.ts` 가 실제 스택에서 연다 |

## 계약 문구 — 글자가 곧 결정인 것

동의 확인문 · 설문 동의 철회의 삭제 결과 · 수락 때 공개되는 것과 안 되는 것 · 요청만으로 열리는 것이 없다는 약속 ·
풀이권의 임시 차감과 복구 · 승인된 채팅 한도 거절 문장은 **`scripts/copy-contracts.test.ts` 가 독립 리터럴로** 든다
(#147). 제품 상수를 가져와 견주면 둘이 함께 틀려도 초록이라서다. 화면에 뜨는지는 e2e 가 따로 잰다. 그 밖의 한글
단언(역할 이름 · 본문)은 일부러 남겼다 — 문구는 거의 안 바뀌고, 버튼 이름이 바뀌어 깨지는 것은 대개 옳은 신호다.
탈퇴 안내는 G-51 과 함께 이 표에 든다.

## 재지 않는 것

- **모델이 낸 글** — 실호출뿐이고 잠겨 있다. 프롬프트 본문이 바뀌면 사람이 한 번 돌리고 읽는다
- **구글 로그인 화면** — 남의 화면. e2e 는 세션을 만들어 쥐여 주고 가입 관문부터 밟는다
- **운영 DB** — `*.live.test.ts` 셋만, 손으로
- **화면 단위** — jsdom 이 없다. 화면의 판단은 `.ts` 로 내린다
- **`app/hash-query.ts` · `app/me/reading/preview.ts` 의 단위** — 브라우저 구독과 DB 를 읽는 문이라 위 「커버리지」 표대로 e2e · 흐름이 든다
- **커버리지 문턱** — 위 표가 까닭이다

## 어디를 봐야 하나

- `scripts/ci-plan.mjs` — 세 단계와 예외 둘. 규칙의 원본
- `.github/workflows/verify.yml` — 차선 여섯(`policy` · `fast` · `verify` · `authed` · `flow` · `audit`)과 `gate`
- `playwright.config.ts` — 프로젝트 다섯(`desktop-chromium` · `mobile-chromium` · `authed-desktop` · `authed-mobile` · `notice-gate`), 서버 띄우기
- `scripts/run-checks.mjs` — 흐름 아홉 벌(`SCRIPTS`)을 **전부** 돌리고 끝에 한 번 답한다(사슬이면 첫 실패가 나머지를 삼킨다)
- `e2e/session.ts` — 로컬 스택에 초대된 계정을 만든다
- `e2e/target.ts` — 누르는 넓이(`elementFromPoint` 로 손가락이 닿는 자리) · 초점 테두리 · 바탕 이음매를 재는 도우미(#229)
- `supabase/tests/00_helpers.sql` — 역할을 갈아입는 헬퍼. `32_test_isolation` 이 순서 의존을 잰다
- `docs/ops/runbook.md` — 로컬 스택 · 접속값 여섯 · 코드 · 날짜
