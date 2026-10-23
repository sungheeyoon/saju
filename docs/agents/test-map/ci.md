# 시험 지도 — CI

색인은 `docs/agents/test-map.md` 다.

## CI

`scripts/ci-plan.mjs` 가 **출시 단계**(PRD §7.0 의 「(지금)」, `scripts/release-stage.mjs`)와 바뀐 파일로 계획을
고르고, `verify.yml` 은 그 답을 읽을 뿐이다. `gate` 가 필수 검사라 `--auto` 머지는 초록까지 기다린다.

**차선은 여섯이고 서로 따로 선다**(2026-10-01) — `policy`(scripts 시험 · 타입 · 린트) · `core`(단위 · 타입 · 린트 · 빌드, 명령은
`ci-plan.mjs` 의 `CORE_STEPS`) · `anon`(익명 e2e 만) · `authed`(로그인 차선 중 계획이 고른 것 — 차선 목록은 `ci-plan.mjs` 의 `AUTHED_LANES`, 고른 것은 `authed_lanes`) · `flow` · `audit`.
단위 · 타입 · 린트 · 빌드를 도는 것은 `core` 하나다 — 전부일 때도 `anon` 이 다시 돌지 않는다. **`core` · `policy` 안에서는 앞 검사가 붉어도 뒤 검사가 돈다**(`!cancelled()`, 설치가 섰을 때만 — ADR 0097 덧 2026-10-22) — 붉은 단계가 하나라도 있으면 job 과 `gate` 는 그대로 실패다. 옛 이름은 `fast` → `core`,
`verify`(job) → `anon` 이다. 워크플로 이름 `verify` 와 npm 스크립트 `npm run verify` 는 그대로다.

**공개 출시 전(지금) — 그 주소에 실제로 닿는 차선만 머지를 막는다**(#161, ADR 0097 · 0119 추기 2026-10-01)

판정은 위에서 아래로, 먼저 걸린 줄이 답이다.

| 바뀐 것 | 도는 차선 |
| --- | --- |
| 계획 밖 이벤트(일정 · 손으로 켠 실행) · `full-ci` 라벨 · 빈 diff · `supabase/**` · 단계 모름 · **시험 실행 의존성**(`package.json` · `package-lock.json` 을 base 와 견줘 `TEST_RUNNERS` — Playwright · Supabase CLI · 시험 도우미만 들이는 `http_ece` — 의 판이나 차선 job 과 e2e 가 부르는 스크립트 `LANE_SCRIPTS`(`dev` 포함)가 바뀜, 못 읽으면 가를 수 없어 전부. ADR 0195) | 전부 — `core` · `anon` · `authed` 전부(`AUTHED_LANES`) · `flow` |
| main 푸시 — 푸시 전 SHA(`github.event.before`)부터의 변경 전체가 정책 · 주석만 바뀐 코드 파일뿐이고 푸시 전 SHA 의 verify 가 초록으로 끝났다(ADR 0154, 판정은 `ci-plan.mjs` 「문서만 바뀐 main 푸시」). 그 밖 · 0 SHA · 강제 갱신 · 앞 실행이 끊김 · 붉음 · 못 읽음은 전부 | `policy` 만(`audit` 도 건너뛴다). `ci-main-red` 는 이 초록으로 이슈를 닫지 않고 「마지막 초록」으로도 안 센다 |
| 주석만 바뀐 코드 파일 — base(merge-base)와 구문 나무가 같고 뜻이 있는 주석이 그대로(ADR 0153, 판정은 `ci-plan.mjs` 「주석만 바뀐 코드 파일」, PR 에서만) | 정책으로 센다 — 아래 줄은 나머지 파일로 잰다 |
| 문구만 바뀐 파일 — 화면 문구 자리(JSX 글자 · JSX 자식 식이 그대로 세우는 문자열과 템플릿의 글자 조각 · HTML 요소의 `aria-label` 글자 · `COPY_FILES` 의 상수와 표의 값)의 글자만 base 와 다르고 나무는 같다(ADR 0159 · 덧 G-90, 판정은 `ci-plan.mjs` 「문구만 바뀐 파일」, 운영 베타의 PR 에서만). 그 밖의 속성 · 조건 · 핸들러 · 구조 · 템플릿의 식 · 목록 밖 문자열이 섞이거나 판별이 불확실하면 지금 규칙. **바뀐 글자를 `e2e/**` · `scripts/check-*.mjs` 가 글자 그대로(통째 · 따옴표 조각 · 그 글자를 찾는 글자 있는 정규식) 찾으면 문구만이 아니다**(운영자 2026-10-10 — 배포도 기다린다). 문구 상수는 시험이 이름으로 읽는다. e2e 를 고친 PR 은 문구만이 아니다 | `core` + **바뀐 자리의 옛 글자나 새 글자를 말하는 시험**과 **바뀐 문구 파일을 들이는 시험**(`e2e/**` · `scripts/check-*.mjs`, 정규식은 파서로 읽고 쓰임 자리로 가른다)의 차선이 **그 파일의 지금 규칙 차선의 부분집합일 때만** 그것으로 센다 — 아니면(검색이 전부 · 지금 규칙에 없는 차선이 섞임) 아래 줄의 지금 규칙 그대로. 문구 판정은 좁히기만 한다(운영자 2026-10-09). 여러 파일이면 파일마다 정한 계획의 합. 동적으로 조합한 selector 는 머지 뒤 main 의 전체가 잡는다 |
| **공용 위험**이 하나라도(`ci-plan.mjs` 의 `SHARED_RISK`) — 관문(`proxy.ts` · `src/lib/consent/**`) · 인증(`app/auth/**`) · `app/**/layout.tsx` · `app/**/route.ts` · 서버 액션(`actions.ts` · `SERVER_ACTIONS_ELSEWHERE`) · spec 이 아닌 `e2e/**` · 시험 도구(`HARNESS` · CI · 개발 도구가 아닌 `scripts/*.mjs`) · Next 공용 경계(`app/` 뿌리의 `global-error.tsx` · `global-not-found.tsx`, `app/**/forbidden.tsx` · `app/**/unauthorized.tsx` · 뿌리의 `instrumentation.ts` · `instrumentation-client.ts` · `middleware.ts`) · 엔진의 DB 쪽(`ENGINE_DB_FACING` — `src/lib/saju/version.ts` · `pillars/index.ts`) · CI 자체(`.github/workflows/**` · `.nvmrc`, ADR 0195). `*.test.ts` 는 빼고 | 전부 — 까닭에 갈래 이름이 실린다 |
| 정책만(문서 · `.claude/**` · `scripts/*.test.ts`) | `policy` |
| `e2e/*.spec.ts` | `core` + 그 spec 을 부르는 차선(`package.json` 의 `test:e2e:<차선>`). 로그인 무늬(`AUTHED` · `NOTICE`)인데 부르는 차선이 없으면 전부, 그 밖 spec 은 `anon` |
| `scripts/check-*.mjs` | `core` + `flow` |
| 화면의 입구(`app/**/{page,loading,error,not-found,template,default}.tsx`) | `core` + **그 주소를 요청하는 시험**의 차선. 주소는 경로에서(`(group)` · `@slot` 걷음, `[x]` 한 마디, `page` 밖은 그 아래 전부), 시험의 주소는 `e2e/*.spec.ts` · `scripts/check-*.mjs` 의 주석 줄을 뺀 따옴표 · 백틱 속 `/…` 에서 뽑는다. 닿는 시험이 0 이면 — 시험 · 그 도우미가 템플릿 · 이어 붙임 · 정규식으로 그 주소를 요청할 수도 있거나(`looseAddressesOf`), 그 코드나 바로 들이는 파일에 입구의 경로가 글자로 들었거나(`mentionOf` — glob · 정규식 문자열 · 경로 상수), 그 입구를 들이는 파일이 있거나(다시 내보내는 page), 다른 화면이 그 입구를 가리키고(링크든 경로 상수 · `router.push` · `redirect` 든) 그 화면을 여는 시험이 있으면(`linkReach` — 무엇을 누르는지는 가르지 않는다, ADR 0195 덧) 전부, 그것도 없으면 그 파일은 `core` 이고 까닭에 시험 공백(간극 대장 G-116 — 그 기록과 계획의 `untestedEntries()` · `linkedOnlyEntries()` 를 시험이 견준다)이 실린다. 다른 파일이 켠 차선은 그대로다(운영자 2026-10-22, ADR 0195) |
| Next 메타데이터(`app/**/icon.*` · `opengraph-image.*` · `sitemap.*` …) | `core` + `anon` |
| 관문이 import 하는 `app/` 파일(ADR 0119 추기) | 전부 |
| 서버에 닿는 `app/` 파일(ADR 0119 추기) — Supabase 클라이언트 · 서버 전용 모듈을 들인다. 타입만 들여도 센다 — 주입받은 클라이언트로 DB 를 부른다(ADR 0178 「고르지 않은 것」). **입구가 아닌 화면 컴포넌트**(`app/**` 의 시험 아닌 `.tsx` · css module(`.module.css`)과 React 를 들이거나 `'use client'` 인 `.ts` — hook 같은 것, 지운 파일은 빼고)도 같은 줄이다(ADR 0195 · 덧 2026-10-22 css module) | 입구면 위 「화면의 입구」 줄. 입구가 아니면 **import 를 거꾸로 따라** 그 파일을 (간접으로라도) 쓰는 입구(입구를 다시 내보내는 page 까지)와 그것을 직접 부르는 시험을 모아 그 주소에 닿는 차선만(`entriesReaching`, ADR 0178). 길 위에 공용 위험(`layout` · `route.ts` · 서버 액션 · 관문 · 인증 · 시험 도구 …) · 메타데이터가 서거나, 입구를 하나도 못 찾거나(고아), 찾은 입구의 주소에 닿는 시험이 0 인데 탐색이 놓쳤을 수 있으면 전부(정말 없는 입구는 위 줄처럼 시험 공백) |
| 서비스 워커(`public/sw.js` — `ci-plan.mjs` 의 `SERVICE_WORKER`, 앱이 등록하는 주소와 시험이 견준다) | `core` + **서비스 워커를 여는 시험**(주석을 뺀 코드에 `serviceWorker` 가 든 spec · 흐름 검사, `workerTests` — 지금 `e2e/push.spec.ts` 의 `push`)의 차선. 그런 시험이 0 이면 전부(「닿는 시험 모름」). `flow` 는 안 켠다 — `check-push.mjs` 는 서비스 워커를 띄우지 않는다. 웹 푸시를 운영에 켰는지와 따로다(ADR 0195 덧) |
| 알려진 `core` 자리 — `src/**` · 입구도 화면 컴포넌트도 서버 파일도 아닌 `app/**`(React 도 `'use client'` 도 없는 `.ts` — 셈 · 상수, 뿌리 layout 이 들이는 `app/globals.css` — 좁히면 사실상 전부다) · `scripts/**` · 워크플로 밖의 `.github/**` · 서비스 워커 밖의 `public/**` · 뿌리 설정(`ROOT_CONFIGS`, 의존성 목록은 시험 실행 의존성이 그대로일 때) | `core` |
| **그 밖 — 모르는 파일** | 전부(베타에서도) |

예: `app/me/(shelf)/readings/compat/page.tsx` 하나 → `core` + `authed (signed-in:desktop)` · `authed (signed-in:mobile)`.
`app/me/people/page.tsx` → `core` + `anon`(`auth.spec.ts` 가 `/me/people` 을 요청한다) + signed-in 둘 + match 둘 + `flow`.
2026-10-01 에 추적 파일 1,139 개를 한 파일씩 넣으니 옛 `fast` 489 개 중 486 개가 그대로 `core` 였고(`app/global-error.tsx` ·
`instrumentation.ts` 는 전부로, `app/icon.svg` 는 `core` + `anon` 으로), 옛 전부 382 개 중 61 개가 좁혀졌다. **남는 구멍** — 주소를
문자열로 적지 않고 링크를 눌러 닿는 화면은, 그 화면의 주소를 적은 다른 시험이 있으면 그 시험의 차선만 켠다(링크로 닿는 시험은 안 센다).
그 붉음은 머지 뒤 main 의 전체가 잡는다. 주소를 적은 시험이 0 인 화면은 다른 화면이 가리키고 그 화면을 여는 시험이 있으면 전부다(아래 2026-10-22 덧).
그 「가리킴」도 앱 코드(`app/**` · `src/**`)에서만 찾는다 — `proxy.ts` · `next.config.ts` 의 redirect 와 상대 주소(`href="help"`)는 못 본다(지금 해당 없음).
2026-10-12 에 입구가 아닌 서버 파일을 거꾸로 따라가게 하자 `app/` 의 시험 아닌 파일 388 개 중 전부로 가는 것이 113 → 91 개,
그중 「주소 없음」이 65 → 42 개가 됐다(ADR 0178). 남은 42 개는 layout · 서버 액션 · `route.ts` · 관문 · `instrumentation.ts` 가 부르는
파일이다 — 예: `app/me/requests/inbox.ts` 는 `/me/readings` 의 layout 과 요청 액션이 부른다. `app/me/match/screen.tsx` 는 그것을 쓰는
page 의 주소로 `match` · `chat` · `anon` · `flow` 만, `room-compat.ts` 는 `chat` · `live` · `push` · `flow` 만이다.
2026-10-22 에 입구가 아닌 화면 컴포넌트도 같은 길을 타게 하자(ADR 0195) 옛 규칙 `core` 이던 컴포넌트 157 개(`.tsx` 145 · hook 같은 `.ts` 열둘) 중 123 개가 좁힌 차선,
21 개가 전부(길 위에 layout · 인증 · Next 공용 경계 — `app/ui/**` 의 `icons.tsx` · `logo.tsx` 같은 여덟), 11 개가 그대로 `core`(쓰는 입구에
닿는 시험이 정말 없다)가 됐다. main 이 붉었던 #581 · #614 · #595 의 PR 은 화면 파일만으로 그때 붉은 차선(`anon` · `signed-in` · `push`)을
머지 전에 돈다. 같은 날 닿는 시험이 정말 없다던 입구 아홉(`/help` · `/terms` · `/refund` · `/me/credits` 셋 · `/ops` 셋)은 링크를 눌러 닿는
시험을 놓친 것이라(외부 리뷰) 다시 전부다 — 공용 바닥글(`app/site-links.ts`) · 회원 머리의 풀이권 메뉴(`CREDITS_PATH`) · 운영 머리
(`app/ops/ops-header.tsx`) · 결제 화면이 가리킨다(ADR 0195 덧). 그 아홉과 그것만 쓰는 서버 파일 여섯 · 화면 컴포넌트 열셋, 모두 스물여덟이
`core` · 좁힌 차선 → 전부이고 좁아진 파일은 없다. 계획의 `untestedEntries()` 는 비고 아홉은 `linkedOnlyEntries()` 로 간다(G-116).

**문구 변경의 머지와 배포**(운영자 2026-10-09, ADR 0159) — 사용자가 확인한 문구 변경은 필요한 PR 검사가 통과하면 재승인 없이
squash-merge 하고 배포한다. 동작 변경이 없다고 판별된 경우 main 전체 CI 완료는 배포의 대기 조건으로 두지 않는다. 문서만 변경한
경우 앱을 배포하지 않는다. 「문구」는 위 표의 「문구만 바뀐 파일」 줄이고, 「판별」은 `node scripts/deploy-range.mjs` 다 — 마지막으로
전부를 잰 main 의 초록(GitHub 에서 읽는다 — `--from` 이 대신하지 못한다)부터 올릴 SHA 까지를 **커밋마다** 같은 판정으로 가르고 범위의
PR 마다 `gate` 의 최신 실행을 읽는다(`docs/ops/runbook/deploy.md` 「묶음 배포」의 0). 기다리지 않으면 배포 전 검증이 준다 — main 의
전체는 배포 뒤에 끝나고, 붉으면 `ci-main-red` 로 대응한다.

**라벨만 달면 다시 안 돈다** — `pull_request` 트리거에 `labeled` 가 없어서, `full-ci` 를 단 뒤 커밋을 하나 더 밀어야 전부가
선다. 라벨은 더할 수만 있다.

**운영 의존성 감사 `audit` 은 단계와 따로 켠다**(G-23 ①, ADR 0104) — `npm audit --omit=dev --audit-level=high`. 결과를 바꾸는
것이 바뀐 파일이 아니라 밖의 advisory DB 라서, PR 에서는 **`package.json` · `package-lock.json` 을 바꾼 PR 에만** 머지를
막는다(라벨 · 빈 diff 도 켠다). 아무것도 안 바꾼 PR 이 어느 날 붉어지는 일이 없다. 새로 뜬 advisory 는 main 푸시와 하루
한 번의 일정이 잡고, `ci-main-red` 가 「`audit` 만 붉다」고 적는다. 절차는 `docs/ops/runbook/security.md` 「운영 의존성 취약점」. 개발 의존성은
CI 가 안 막는다.

입구 · 공용 위험 줄은 #284(탭 뼈대 `loading.tsx` · route group 이동)와 #286(`proxy.ts` · 화면 · 서버 액션)이 PR 에서 `fast`(지금
`core`)만 돌고 #284 는 머지 뒤 main 의 `flow` 가 붉었던 일에서 왔다 — 단위 · 타입 · 린트 · 빌드는 화면이 열리는가 · 관문이 누구를
들이는가를 모른다(ADR 0119). 2026-10-01 에 「입구면 전부」를 「그 주소에 닿는 차선만」으로 좁혔다 — #284 는 지금 규칙에서도
`layout` 이 들어 전부다. 시험이 `app/` 의 `'use server'` 파일이 전부 입구로 걸리는지, 공용 위험의 갈래마다 전부로 가는지 잰다.

그 밖의 PR 에서 전체(익명 e2e · `authed` 전부 · `flow`)는 **머지 뒤 최신 main 하나**에서 비차단으로 돈다. 붉으면
`main-red.yml` 이 `ci-main-red` 이슈 하나를 열고(이미 있으면 댓글), 지금 main 머리가 초록이 되면 닫는다.
PRD 의 「(지금)」을 공개 출시로 옮기면 아래 세 단계로 저절로 돌아간다 — 실제 사용자 데이터가 들어오는 날에는
사람이 그날 옮긴다(`docs/ops/runbook/signup.md` 「초대」).

**빌드는 끝에 비밀 검사를 돈다**(`npm run build` = `next build && node scripts/secret-env.mjs`, G-23 ⑧) — 브라우저로 가는 파일에
비밀 이름이나 그 빌드의 비밀 값이 있으면 빌드가 선다. CI 는 빌드가 드는 차선 `core` 에서(머지 전 · 머지 뒤 main 모두),
**Vercel 은 배포 빌드마다 진짜 값을 들고** 돈다. 새 차선은 없다. `core` 에 빌드를 넣은 까닭은 `next build` 만 잡는 실패다 —
`app/**/icon.tsx` 는 파비콘 라우트로 읽혀 빌드가 섰는데 단위 · 타입 · 린트는 초록이라 Production 이 두 시간 멈췄다(#219).
**코드가 화면 문구만 바뀐 PR 은 빌드를 건너뛴다**(운영자 2026-10-12, ADR 0178) — 위 표의 「문구만 바뀐 파일」로 좁혀진 파일과 정책
파일뿐이면 계획의 `build` 가 `false` 라 `core` 가 단위 · 타입 · 린트만 돈다(바뀐 글자를 찾는 시험의 차선은 그대로). #219 같은 이름 ·
모양 실패는 문구 한 줄로 안 생긴다. 메타데이터 파일(`icon` · `opengraph-image` …)은 빌드 때 그림을 그리므로 문구만이어도 빌드가 돈다. 문구 밖의 코드가 하나라도 섞이거나 · 라벨 · 공개 출시 · main 푸시 · 일정이면 빌드가 돈다.
`build` 가 비면(계획 실패) 돈다 — 워크플로는 `!= 'false'` 로 읽는다. 배포 빌드는 Vercel 이 늘 돈다.

**공개 출시 뒤 — 머지 전에 전체를 잰다**

| 바뀐 것이 이 안에만 있으면 | 도는 차선 |
| --- | --- |
| 정책(문서 · `.claude/**` · `scripts/*.test.ts`) | `policy`(scripts 시험 · 타입 · 린트) |
| 엔진 · `app/saju/**` | `core`(단위 · 타입 · 린트 · 빌드) + `anon`(익명 e2e) |
| 그 밖 전부 · 모르는 파일 | `core` + `anon` + `authed` 전부(`ci-plan.mjs` 의 `AUTHED_LANES`) + `flow` |

공개 출시 뒤에는 주소로 좁히지 않는다 — 화면 하나도 전부다.

**차선 수와 시간은 이 문서에 적지 않는다** — 로그인 차선은 `ci-plan.mjs` 의 `AUTHED_LANES` 가, 그 실행이 고른 차선은
plan job 의 step summary(`summaryOf`)가, 차선마다 걸린 시간은 `gh run view <run id>` 의 job 시간이 답한다.
지난 PR 의 계획(`tier` · 까닭 · 차선)은 `gh run view <run id> --log --job <plan job id>` 로 읽는다.
**붉은 job 의 기록은 `gh run view <run id> --log-failed` 로 읽고, 빈 출력이면 job 기록을 API 로 연다(2026-10-22)** —
`gh api --allow-escape-sequences "repos/{owner}/{repo}/actions/jobs/<job id>/logs"`(job id 는 `gh run view <run id> --json jobs`).
기록에 제어 문자가 있어 `--allow-escape-sequences` 없이는 거절된다. **아직 도는 run 은 `--log` 가 비므로** 끝난 job 의 기록도 같은 API 로 연다(2026-10-23).
가정한 변경 묶음의 계획은 저장소 뿌리에서 `planFor` 에 넣어 본다(단계는 PRD 의 「(지금)」 — `currentStageOf`):
`node --input-type=module -e "import {readFileSync} from 'node:fs'; import {planFor} from './scripts/ci-plan.mjs'; import {STAGE_FILE,currentStageOf} from './scripts/release-stage.mjs'; const p = planFor({ files: ['public/sw.js'], stage: currentStageOf(readFileSync(STAGE_FILE,'utf8')) }); console.log(p.tier, p.cause ?? '', p.authedLanes, p.lanes, p.reason)"`
— 파일은 디스크(HEAD)에서 읽는다. 의존성 목록은 `baseSourceOf` 를 안 주면 base 를 못 읽어 전부로 나온다.

**새 `scripts/*.mjs` 를 더한 PR 은 전부다** — `NOT_HARNESS` 밖은 시험 도구로 센다. 시험이 부르지 않는 CI · 개발 도구를 어떻게 빼나는
`ci-plan.mjs` 머리말 「시험 도구가 혼자 쓰는 파일」이 답한다.

`authed` 는 `db:start` 를 하고 e2e 차선 하나를 돈다. pgTAP 과 **생성 타입 diff** 는 그중 **`notice` 차선만** 본다
(`verify.yml` 의 `if: matrix.lane == 'notice'` — e2e 가 남긴 계정이 전역으로 세는 pgTAP 을 흐리므로 e2e 앞, 가장 짧은 차선에 둔다).
계획이 `notice` 를 빼는 것은 `supabase/**` 를 안 바꾼 PR 뿐이다. `authed` 의 matrix 는 `fromJSON(needs.plan.outputs.authed_lanes)` 이고,
배열이 비면 `authed` 가 `false` 라 job 이 건너뛰어진다.
**e2e 가 붉으면 `test-results/` 가 artifact 로 올라온다**(7일) — 익명은 `anon-test-results`, 로그인은
`authed-test-results-<차선>`(콜론을 `-` 로, 예: `authed-test-results-signed-in-mobile`). 안에는 시도마다의 `error-context.md` 와
첫 재시도의 `trace.zip` 이 있다 — `gh run download <run id> -n <이름>` 뒤 `npx playwright show-trace <…>/trace.zip`. 리포터가
`github` 하나라 `playwright-report/` 는 없다. 스택을 내리는 `db:stop` 단계는 없다 — hosted runner 는 job 마다 버려진다.
`full-ci` 라벨은 더할 수만 있다. 일정과 손으로 켠 실행은 계획을 안 보고 전부 돈다. `main` 푸시는 계획을 본다 — 푸시 전
SHA 부터의 변경이 정책 · 주석만이고 앞 실행이 초록이면 `policy` 만, 그 밖은 전부다(ADR 0154, 위 표의 둘째 줄 · `verify.yml` 의
`concurrency` 머리말).
**main 푸시는 최신 하나만 끝까지 돈다** — 새 푸시가 앞 실행을 끊는다(#161 이 #143 의 「커밋마다 제 그룹」을
되돌렸다). 끊긴 실행은 실패가 아니다. 하루 한 번의 일정은 제 그룹이라 안 끊긴다. **보호 규칙의 strict 는 껐다**(2026-10-12,
ADR 0178) — 필수 검사는 `gate` 그대로이고, 가지가 최신 main 을 품지 않아도 `gate` 가 초록이면 든다. 합친 뒤의 깨짐은 머지 뒤
main 의 전체와 `ci-main-red` 가 잡는다.
