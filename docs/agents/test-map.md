# 시험 지도

이 문서는 **무엇을 고쳤을 때 무엇을 돌리는가** 하나만 답한다. 어디에 놓는가는
`docs/architecture.md`, 어떻게 적는가는 `docs/agents/code-rules.md`. CI 가 무엇을 돌리는가의
**규칙은 `scripts/ci-plan.mjs` 한 곳**이고(ADR 0082), 이 문서는 그 규칙을 사람이 읽는 표로
옮긴 것이다 — 어긋나면 `ci-plan.mjs` 가 맞다. 값은 **2026-09-22 에 잰 것**이다(ADR 0087).

## 시험은 넷이고, 층마다 닿는 것이 다르다

| 시험 | 명령 | 무엇을 재나 | 필요한 것 | 수 |
| --- | --- | --- | --- | --- |
| **단위**(vitest) | `npm test` | 순수 함수 — 엔진 · 도메인 lib · `app/**/*.ts` 의 판단 · `scripts/` 의 검사 도구 자신 | 없음 | 103 파일 · 1,978 · 12초 |
| **pgTAP** | `npm run test:db` | 표 · 함수 · 정책이 **역할을 갈아입고** 실제로 막는가, 함수와 표의 모양(ADR 0084) | Docker + `npm run db:start` | 32 파일 · plan 805 |
| **흐름**(`scripts/check-*.mjs`) | `npm run test:flow` | 가입 → 저장 → 요청 · 수락 → 풀이 · 공유를 **실제 스택에 대고**, 모델만 빼고 | Docker + `db:start`. 제 안에서 Next 서버를 띄운다 | 8 벌 · 단언 약 400 |
| **e2e**(Playwright) | `npm run test:e2e` / `test:e2e:authed` | 화면 — 비로그인 · 로그인 · 둘이 있어야 성립하는 흐름 · 가입 관문 | 익명은 없음(CI 의 껍데기 접속값으로 돈다). 로그인 뒤는 Docker + `db:start` | 7 파일 · 익명 28 × 2 기기, 로그인 58 × 2 기기, 관문 9 |

**vitest 가 닿는 자리는 `.ts` 뿐이다** — `vitest.config.mts` 의 include 가 `src/**` · `app/**` ·
`scripts/**` 의 `*.test.ts` 다. `.tsx` 는 밖이고 jsdom 을 안 들였다(`<dialog>` 때문, ADR 0080).
그래서 화면의 판단은 `.ts` 로 내리고 화면은 그리기만 한다 — 그래야 단위 시험이 닿는다.
`.tsx` 를 재는 것은 e2e 뿐이다.

## 층 × 시험

| 층 | 자리 | 단위 | pgTAP | 흐름 | e2e |
| --- | --- | --- | --- | --- | --- |
| 엔진 | `src/lib/saju/` | **46 파일** — 골든 스냅샷(건수는 스냅샷 머리가 찍는다) · 외부 대조(억부 37 · 종격 41) · 모집단 3000 · 절기 · 음력 왕복 | | | 명식 화면(`saju.spec.ts` 20) |
| 도메인 lib | `src/lib/{input,reading,discovery,matching,consent,people,profile,account,survey,chat}` | **29 파일** — 프롬프트 조립 · 검사 · 점수 · 동의 · 관문 | | | |
| 문 · 액션 | `app/**/*.ts` | **24 파일** — 어댑터 · 파이프라인 · 오류 번역 · 주소 코덱 · 장부 둘(`*.boundary.test.ts`) | 문이 부르는 함수 전부 | **여기가 본거지** — 문·액션·라우트를 주소로 두드린다 | 로그인 뒤 화면이 지나간다 |
| 화면 | `app/**/*.tsx` | 없음 | | | **여기만** — 88 건 |
| 관문 | `proxy.ts` · `src/lib/consent` | `gate.test.ts` · `notice.test.ts` | `20_notice` | | `notice.spec.ts` 9 |
| DB | `supabase/migrations/` | | **32 파일** · 모양 잠금 넷(`33_function_shape`) | 위 | |
| 검사 도구 | `scripts/` · `eslint.config.mjs` | **5 파일** — `ci-plan` · `run-checks` · `layers` · `code-rules` · `worktree-stack` | | | |

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
| `app/**/*.tsx` — 화면 | 비로그인 화면 `npm run test:e2e`, 로그인 뒤 `npm run test:e2e:signed-in` · 요청·수락이면 `test:e2e:match` · 채팅이면 `test:e2e:chat` | vitest 가 안 닿는다. 문구만 바뀐 라운드는 안 돌린다 |
| `proxy.ts` · `src/lib/consent` | `npm test` → `npm run test:e2e:notice` | 관문은 링크를 눌러야 밟힌다 — `page.goto` 로는 못 잰다(ADR 0041) |
| `supabase/migrations/**` | `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` → `npm run test:flow` | 생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다(ADR 0078). CI 의 `authed` 가 diff 를 본다 |
| 프롬프트(`src/lib/reading/prompt*` · `parts.ts` · `vocabulary.ts`) | `npm test`, 본문이 바뀌면 `READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` | 조립 스냅샷은 단위가 든다. **본문이 한 글자라도 바뀌면 실호출 한 번**(ADR 0073). 경로 이름이 본문에 샌 적이 있다 |
| `scripts/ci-plan.mjs` · `release-stage.mjs` · `verify.yml` · `main-red.yml` | `npm test` | `ci-plan.test.ts` 가 단계별 계획을, `main-red.test.ts` 가 이슈의 판단을 든다. YAML 에 `paths` 를 적지 않는다 |
| `eslint.config.mjs` · `scripts/*.test.ts` | `npm run lint` → `npm test`, 그리고 **일부러 어긴 파일**로 걸리는지 | 「규칙을 넣었다」와 「규칙이 건다」는 다른 문장이다(ADR 0085·0086) |

**워크트리에서는 제 자리의 포트다** — `npm run stack:slot -- N` 이 스택 이름 · Supabase 포트 · dev 서버(`3000+10N`) ·
흐름 검사(`3210+10N` 부터 여덟)를 함께 옮긴다(ADR 0096). 아래는 main 체크아웃(자리 0)의 이야기다.

**먼저 죽여야 하는 것** — 3000 의 dev 서버. 로그인 e2e 와 흐름 검사는 제 서버를 띄우고,
남의 서버를 재사용하면 옛 코드를 잰다. `lsof -i :3000` 로 본다.

## 잠긴 시험 셋 — `*.live.test.ts`

이름이 말한다. **운영 DB 나 모델을 실제로 두드리고**, 환경변수를 켜야만 돈다. CI 밖이다.

| 파일 | 켜는 값 | 무엇을 |
| --- | --- | --- |
| `app/me/reading/call.live.test.ts` | `READING_LIVE=1` | 네 kind 의 풀이를 실제로 한 번 만든다 — 토큰이 나간다 |
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
| 그 밖 전부 | `fast`(단위 · 타입 · 린트, 빌드 없음) | #161 머지 뒤 첫 코드 PR 이 찍는다 |
| 단계를 모른다(「(지금)」이 없거나 둘 · 표에 없는 이름) | 전부 | |

전체(빌드 · 익명 e2e · `authed` 일곱 · `flow`)는 **머지 뒤 최신 main 하나**에서 비차단으로 돈다. 붉으면
`main-red.yml` 이 `ci-main-red` 이슈 하나를 열고(이미 있으면 댓글), 지금 main 머리가 초록이 되면 닫는다.
PRD 의 「(지금)」을 공개 출시로 옮기면 아래 세 단계로 저절로 돌아간다 — 실제 사용자 데이터가 들어오는 날에는
사람이 그날 옮긴다(`docs/ops/runbook.md` 「초대」).

**공개 출시 뒤 — 머지 전에 전체를 잰다**

| 바뀐 것이 이 안에만 있으면 | 도는 차선 | 2026-09-22 의 시간 |
| --- | --- | --- |
| 정책(문서 · `.claude/**` · `scripts/*.test.ts`) | `policy`(scripts 시험 · 타입 · 린트) | 31초(#153) |
| 엔진 · `app/saju/**` | `verify`(단위 · 타입 · 린트 · 빌드 + 익명 e2e) | 3분 55초 |
| 그 밖 전부 · 모르는 파일 | `verify` + `authed` 일곱(`signed-in` · `match` · `chat` × 기기 둘, `notice`) + `flow` | 병렬, 가장 긴 차선 4분 53초 |

`authed` 는 `db:start` 를 하고 pgTAP 과 **생성 타입 diff** 를 본 뒤 e2e 차선 하나를 돈다.
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
- `.github/workflows/verify.yml` — 차선 다섯과 `gate`
- `playwright.config.ts` — 프로젝트 다섯(`desktop-chromium` · `mobile-chromium` · `authed-desktop` · `authed-mobile` · `notice-gate`), 서버 띄우기
- `scripts/run-checks.mjs` — 흐름 일곱 벌을 **전부** 돌리고 끝에 한 번 답한다(사슬이면 첫 실패가 나머지를 삼킨다)
- `e2e/session.ts` — 로컬 스택에 초대된 계정을 만든다
- `supabase/tests/00_helpers.sql` — 역할을 갈아입는 헬퍼. `32_test_isolation` 이 순서 의존을 잰다
- `docs/ops/runbook.md` — 로컬 스택 · 접속값 여섯 · 코드 · 날짜
