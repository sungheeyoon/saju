/**
 * 어떤 변경에 어떤 검사를 돌리는가 — **규칙은 이 파일 한 곳에만 있다** (ADR 0082).
 *
 * `verify.yml` 은 여기서 나온 답을 읽을 뿐 스스로 판단하지 않는다. 경로 규칙을 YAML 의
 * `paths` 필터에 적으면 두 자리가 되고, 필터로 건너뛴 job 은 필수 검사에서 「기다리는 중」으로
 * 영원히 남는다. 여기서 낸 계획은 job 의 `if` 가 읽고, `gate` 는 `skipped` 를 통과로 센다.
 *
 * ## 세 단계뿐이다
 *
 * 최근 PR 여섯 중 넷이 스무 디렉터리를 건드리는 횡단 변경이었다. 잘게 나눈 매트릭스로 아낄
 * PR 은 드물고, 나눈 만큼 「이 경로가 저 검사에 안 걸린다」는 문장이 늘어난다 — 그 문장은
 * 파일이 옮겨지는 날 조용히 거짓이 된다. 그래서 굵게 셋만 둔다.
 *
 * | 변경이 이 안에만 있으면 | 도는 것 |
 * |---|---|
 * | 정책(`docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts`) | `policy` (scripts 시험 · 타입 · 린트, 1분 안) |
 * | 주석만 바뀐 코드 파일 — base 와 구문 나무가 같다(아래 「주석만 바뀐 코드 파일」, 어느 단계든) | 정책으로 센다 |
 * | 엔진(`src/lib/saju/**`) · 엔진을 그리는 칸(`app/saju/**`) | `core`(단위·타입·린트·빌드) + `anon`(익명 e2e) |
 * | 그 밖 전부 · **모르는 파일** | 전부 |
 *
 * ## 엔진 단계의 예외 둘 — 재서 뺐다
 *
 * `src/lib/saju` 는 모든 층이 읽지만, 로그인 뒤 화면과 흐름 검사는 **같은 엔진으로 기대값을
 * 짓는다** — 엔진이 달라져도 둘은 함께 달라져 빨개지지 않는다. 빨개지는 자리는 **DB 가
 * 모양을 검사하는 곳**뿐이다: 저장되는 여덟 글자의 모양(`chartSnapshotOf`,
 * `pillars/index.ts`)과 판본(`version.ts`)은 마이그레이션의 검사식이 본다
 * (`the_person_carries_its_eight_characters`). 그 둘을 고친 PR 은 전부 돈다.
 *
 * 홈(`app/page.tsx`)과 출생 입력 폼(`app/birth-form.tsx`)은 **익명 화면이 아니다** — 홈은
 * 로그인 e2e 세 건이 회원으로 열고, 폼은 온보딩·수정·사람 관리가 같이 쓴다. 그래서 목록에 없다.
 *
 * ## 문서도 시험이 읽는다 — 정책 단계 (2026-09-23, #145)
 *
 * 문서만 바뀌면 `gate` 만 돌던 동안 구멍이 났다. `scripts/code-rules.test.ts` 는 간극 대장 · PRD ·
 * 위임 규약 · ADR · `.claude/settings.json` 을 **읽고** 견주므로, 문서 PR 이 그 시험을 깨도 그 PR 에서는
 * 아무것도 안 돌고 다음에 오는 남의 PR 에서 터졌다. 반대로 `.claude/settings.json` 과 문서만 바꾼 PR
 * (#141)은 모르는 파일이라 전부(약 5분)를 돌았다. 그 둘을 한 단계로 묶었다 — `scripts/` 의 시험 · 타입 ·
 * 린트다. `scripts/*.test.ts` 만 바뀐 PR 도 여기다: 시험 파일은 저 자신의 결과만 바꾼다.
 *
 * ## 공개 출시 전에는 빠른 검사만 머지를 막는다 (2026-09-23, #161, ADR 0097)
 *
 * 운영 베타에는 실제 사용자가 없다. PR 마다 전부(약 5분)를 돌리고 strict 가 뒤에 선 PR 을 다시 돌리는 값이
 * 다치는 사람을 막는 값보다 컸다. 그래서 단계가 공개 뒤의 규율을 켜지 않았으면(`release-stage.mjs`) PR 은
 * `core`(단위 · 타입 · 린트 · 빌드 — 그때 이름 `fast`)를 탄다 — 정책 파일만 바뀌었으면 전처럼 `policy`. 전체 검증은 main
 * 푸시가 최신 커밋 하나에서 비차단으로 돌고(정책만 바꾼 푸시는 `policy` 만 — 아래 「문서만 바뀐 main 푸시」), 붉으면 `ci-main-red` 이슈가 든다. 화면의 입구를 바꾸면 그 주소에 닿는
 * 차선이 더 선다(아래 「그 주소에 닿는 차선만」).
 *
 * - **`supabase/**` 는 단계와 상관없이 전부다.** 마이그레이션 · pgTAP · `config.toml` 은 DB 차선에서만 재어지고,
 *   `db:start` 가 깨지면 main 의 DB 차선이 다 선다. 라벨에 기대지 않는다 — 에이전트는 라벨을 잊는다.
 * - **단계를 모르면 전부다.** 「(지금)」이 없거나 둘이거나 표에 없는 이름이면 안전 쪽으로 간다.
 * - **공개 출시면 아래 세 단계로 돌아간다.** 단계를 옮기는 PR 은 그 PR 에서부터 새 단계로 계획된다.
 *
 * ## 빠른 검사에도 빌드가 든다 (2026-09-24, #219)
 *
 * `core` 는 처음에 빌드를 뺐다 — 빌드가 깨지면 Vercel 이 이전 배포를 그대로 세우므로 머지 뒤 main 의 전체 검증으로
 * 넉넉하다고 봤다. 그런데 `next build` 만 잡는 실패가 있다: `app/…/icon.tsx` 는 Next 가 파비콘 라우트로 읽어
 * 빌드가 섰고, 단위 · 타입 · 린트는 다 초록이었다(3d54d56). Production 이 두 시간 멈췄다. 그래서 `CORE_STEPS` 에
 * `npm run build` 를 넣는다 — 빌드는 끝에 비밀 검사도 돈다(G-23 ⑧). `verify.yml` 의 `core` job 은 이 목록을
 * 그대로 돌고, 시험이 둘을 견준다. 단위 · 타입 · 린트 · 빌드를 도는 job 은 이것 하나다 — `anon` 은 익명 e2e 만 돈다.
 *
 * ## 운영 의존성 감사는 단계와 따로 켠다 (2026-09-23, G-23 ①, ADR 0104)
 *
 * `audit` 차선은 `npm audit --omit=dev --audit-level=high` 하나다. 위 단계들과 달리 **바뀐 파일이 아니라 밖의
 * advisory DB 가 결과를 바꾼다** — 모든 PR 에 걸면 아무것도 안 바꾼 PR 이 어느 날 붉어지고, 나란히 선 세션이
 * 그것을 제 빨간불로 읽는다. 그래서 PR 에서는 **의존성 목록(`package.json` · `package-lock.json`)을 바꾼 PR 에만**
 * 머지를 막고, 새로 뜬 advisory 는 main 푸시 · 하루 한 번의 일정이 잡아 `ci-main-red` 이슈로 알린다.
 * 라벨 · 빈 diff · 계획 밖 이벤트는 「전부」와 같이 켠다.
 *
 * ## 관문 · 화면 · 인증 · 그것을 재는 시험은 베타에서도 머지 전에 전부다 (2026-09-27, ADR 0119)
 *
 * 베타의 `fast` 는 「그 밖 전부」를 받았다. 그래서 #284(탭 넷의 `loading.tsx` · route group 이동)와 #286(`proxy.ts` 와
 * 화면 · 서버 액션 27개)이 PR 에서 `fast` 만 돌았다 — 목록이 틀린 게 아니라 규칙에 그 자리가 없었다. #284 는 머지 뒤
 * main 의 `flow` 가 붉었다(`check-discovery`, e370931). 단위 · 타입 · 린트 · 빌드는 **화면이 열리는가 · 관문이 누구를
 * 들이는가**를 모른다. 그래서 아래 `SURFACE` 가 하나라도 섞이면 단계와 상관없이 전부(익명 e2e · `authed` · `flow`)였다 —
 * 2026-10-01 부터는 공용 위험이 아닌 화면의 입구가 그 주소에 닿는 차선만 돈다(아래 「그 주소에 닿는 차선만」).
 *
 * - **관문** — `proxy.ts` · `src/lib/consent/`(test-map 「관문」 줄)
 * - **인증** — `app/auth/`
 * - **화면의 입구** — `app/` 아래의 `page` · `layout` · `loading` · `template` · `error` · `not-found` · `default`(`.tsx`) ·
 *   `route.ts`. route group 을 옮기면 `--no-renames` 로 옛 · 새 `page.tsx` 가 다 서므로 이것이 잡는다
 * - **서버 액션** — `app/` 의 `actions.ts`, 그리고 이름이 다른 `'use server'` 파일(`SERVER_ACTIONS_ELSEWHERE`). 시험이
 *   `app/` 의 `'use server'` 파일 전부가 여기 걸리는지 잰다 — 새 액션 파일이 조용히 빠지지 않게
 * - **그것을 재는 시험 자체** — `e2e/` · 흐름 검사(`scripts/check-*.mjs` · `run-checks.mjs` · `next-server.mjs`).
 *   시험이 도는지는 시험을 돌려야 안다(ADR 0097 의 로컬 예외 첫째를 CI 로 옮겼다)
 *
 * 입구가 아닌 컴포넌트(`app/me/(shelf)/readings/shelf.tsx` 같은 것)와 `src/lib/**` 는 전처럼 `core` 다 — 거기까지 넓히면 코드 PR 이 다
 * 전부가 되어 ADR 0097 이 없던 것과 같다. 그날은 차선을 경로별로 고르지 않았다(ADR 0082 — 손으로 적은 「이 경로는 저
 * 차선」은 파일이 옮겨지는 날 거짓이 된다). 2026-10-01 에 손 목록이 아니라 소스에서 뽑는 대응으로 골랐다(아래).
 *
 * ## 서버에 닿는 `app/` 파일과 시험 도구가 혼자 쓰는 파일도 입구다 (2026-09-28, ADR 0119 추기)
 *
 * 이름으로만 입구를 골랐더니 판단이 사는 문이 빠졌다. `page.tsx` 는 얇고, DB 를 부르는 것은 그 옆의 `.ts` 다 —
 * `app/me/reading/pipeline.ts` · `app/me/candidates.ts` · `app/me/chat/rooms.ts` · `app/keyed-client.ts`(service-role) ·
 * `app/ops/reports/read.ts` · `app/share/public-client.ts` · `proxy.ts` 가 부르는 `app/beta-schedule.ts` 가 다 `core`(그때 `fast`)였다.
 * 흐름 · pgTAP 은 머지 뒤 main 에서만 돌아 #284 와 같은 모양이 남았다. 이름을 늘어놓지 않고 **내용으로 가른다**:
 *
 * - **서버에 닿는 `app/` 파일** — `app/**` 의 `.ts` · `.tsx`(시험 빼고) 중 Supabase 클라이언트(`@supabase/*` 나
 *   `server-client` · `browser-client` · `keyed-client` · `public-client`)나 서버 전용 모듈(`server-only` · `next/server` ·
 *   `next/headers` · `next/cache`)을 import 하는 것(`SERVER_REACHING`). 계획 job 이 HEAD 를 받아 두므로 파일을 읽는다.
 *   못 읽는 파일(지운 것)은 안 건다 — 그것을 부르던 쪽이 함께 바뀌어 그쪽이 걸린다. 순수 화면 로직(`book.ts` ·
 *   `deck-state.ts` · 받은 client 를 쓰기만 하는 `settle.ts`)은 단위 시험이 재므로 전처럼 `core` 다.
 * - **관문이 import 하는 `app/` 파일** — `proxy.ts` 에서 import 를 따라가 닿는 `app/**` 파일은 서버에 안 닿아도
 *   입구다(`app/beta-schedule.ts` 가 부르는 `app/db-error.ts` 처럼). 이것도 계획 job 이 HEAD 를 읽어 그때 잰다 —
 *   관문이 새 파일을 부르기 시작한 PR 에서부터 걸린다.
 * - **시험 도구가 혼자 쓰는 파일** — 앱 서버의 설정(`next.config.ts` 의 CSP · 보안 헤더는 익명 e2e 가 잰다) ·
 *   `src/lib/local-env.ts`(`HARNESS`), 그리고 `scripts/*.mjs` 중 CI · 개발 도구가 아닌 것 전부(`NOT_HARNESS` 가 빼는
 *   쪽이다 — 새 도우미는 이름을 안 적어도 걸리고, 모르는 스크립트는 전부로 간다). 시험이 e2e · 흐름 검사 ·
 *   Playwright 설정에서 import 를 따라가 앱이 안 닿는 파일이 전부 걸리는지 잰다. `scripts/fake-clock.mjs` 는
 *   `ui-shots` 만 쓰고 CI 가 안 돌리므로 뺀다.
 *
 * 잰 값(2026-09-28): 한 파일만 바꾼 PR 이 `core` 에서 전부로 옮는 파일이 42 개다 — `app/**` 의 `.ts` 35 개(시험 아닌 105 개 중
 * 입구가 26 → 61, 순수 로직 44 개는 그대로 `core`), 브라우저 client 를 부르는 `.tsx` 둘(`site-header.tsx` · `save-for-reading.tsx`),
 * 도구 다섯. 최근 머지된 PR 30 개를 옛 · 새 규칙에 넣으면 전부가 16 → 17 이다(#264 가 `s3.ts` · `ops/reports/read.ts` 로 옮는다).
 * 전부로 가는 PR 은 대개 이미 화면의 입구를 함께 바꾼다.
 *
 * ## 그 주소에 실제로 닿는 차선만 (2026-10-01, ADR 0097 · 0119 추기, 운영자 승인)
 *
 * 입구 하나만 바뀌어도 전부(로그인 일곱 · 흐름 · 익명)였다. `app/me/(shelf)/readings/compat/page.tsx` 한 줄을 고친 PR 도 그
 * 주소를 여는 시험이 `e2e/signed-in.spec.ts` 하나뿐인데 일곱 차선을 다 기다렸다. 그래서 차선을 독립 출력으로 내고
 * (`core` · `anon` · `authed` 와 `authed_lanes` · `flow`, 그대로 `policy` · `audit`), 운영 베타의 PR 에서만 좁힌다. job 이름도
 * 그 뜻으로 바꿨다 — `fast` → `core`, `verify` → `anon`. `tier` 는 요약의 낱말일 뿐이다.
 *
 * 판정 차례:
 *
 * 1. 위의 「전부」 조건 그대로 — 계획 밖 이벤트(main 푸시는 아래 「문서만 바뀐 main 푸시」가 따로 가른다) ·`full-ci` 라벨 · 빈 diff · `supabase/**` · 단계 모름. 공개 출시는 세 단계.
 *    그 뒤 주석만 바뀐 코드 파일은 정책으로 돌린다(아래 「주석만 바뀐 코드 파일」)
 * 2. **공용 위험**(`SHARED_RISK`) — 바뀐 파일 전체를 먼저 훑고 하나라도 들면 전부. 관문 · 인증 · `layout` · `route.ts` ·
 *    서버 액션 · spec 이 아닌 `e2e/**` · 시험 도구, 그리고 Next 의 공용 경계(`global-error` · `global-not-found` ·
 *    `forbidden` · `unauthorized` · 뿌리의 `instrumentation` · `instrumentation-client` · `middleware`). 주소 하나로는 그것을
 *    밟는 시험을 셀 수 없는 자리다
 * 3. 정책만이면 `policy`
 * 4. 파일마다 — 시험 파일 · 입구가 아닌 파일은 `core` 만. `e2e/*.spec.ts` 는 그 spec 의 차선(차선 스크립트가 부르면 그
 *    차선, 아닌데 `AUTHED` · `NOTICE` 무늬면 전부, 그 밖은 `anon`). `scripts/check-*.mjs` 는 `flow`. 메타데이터 파일은
 *    `anon`. 화면의 입구(`page` · `loading` · `error` · `not-found` · `template` · `default`)는 **주소로** 닿는 시험을 찾고,
 *    그 시험의 차선을 켠다. 주소를 못 뽑는 입구(서버에 닿는 `.ts` · 관문이 부르는 파일)나 닿는 시험이 0 이면 전부
 * 5. 좁힌 계획에도 `core` 는 늘 선다
 *
 * **주소 대응은 소스에서 뽑는다** — 손으로 적은 「이 경로는 저 차선」이 없다. 입구 파일의 주소는 경로에서(`(group)` ·
 * `@slot` 은 걷고 `[x]` 는 한 마디, `[...x]` 는 나머지, `page` 밖은 그 아래 전부), 시험이 요청하는 주소는
 * `e2e/*.spec.ts` · `scripts/check-*.mjs` 의 주석 줄을 뺀 따옴표 · 백틱 속 `/…` 에서(`addressesOf`), spec 과 차선은
 * `package.json` 의 `test:e2e:<차선>` 과 `playwright.config.ts` 의 무늬에서 읽는다. 파일이 옮겨지면 대응도 함께 옮는다.
 *
 * **모르는 파일은 베타에서도 전부다.** 알려진 `core` 자리(`KNOWN_CORE` · `ROOT_CONFIGS`)는 자리로 적는다 — `src/**` ·
 * 입구가 아닌 `app/**` · `scripts/**` · `.github/**` · `public/**` 와 뿌리 설정 몇. 잰 값(2026-10-01, 추적 파일 1,139 개를 한
 * 파일씩): 옛 규칙의 `fast` 489 개 중 486 개가 그대로 `core` 이고, 셋이 옮는다 — `app/global-error.tsx` ·
 * `instrumentation.ts` 는 공용 경계라 전부, `app/icon.svg` 는 메타데이터라 `core` + `anon`. 옛 전부 382 개 중 61 개가
 * 좁혀진다.
 *
 * 남는 구멍: 시험이 주소를 문자열로 적지 않고 링크를 눌러 닿는 화면은 그 시험에 안 잡힌다. 그 자리의 붉음은 전처럼
 * 머지 뒤 main 의 전체가 잡는다.
 *
 * ## 주석만 바뀐 코드 파일은 정책으로 센다 (ADR 0153)
 *
 * `.ts` · `.tsx` · `.mjs` · `.js`(와 `.cjs` · `.mts` · `.cts` · `.jsx`)의 바뀐 것이 주석 · 공백뿐이면 그 파일은 정책이다 —
 * `layout.tsx` 주석 한 줄이 공용 위험으로 전부를 부르지 않는다. 다른 파일이 없으면 PR 이 `policy` 다. 줄 무늬로 고르지 않고
 * **파서로 가른다**: `typescript` 로 base 커밋(`--base`, 계획 job 이 merge-base 를 넘긴다)의 소스와 HEAD 소스를 읽어 주석 · 공백
 * 트리비아와 위치를 뺀 구문 나무(노드 종류 · 식별자 · 리터럴 · 연산자)가 같아야 한다(`syntaxOf`). 줄바꿈이 자동 세미콜론으로
 * 뜻을 바꾸면(`return` 뒤 줄바꿈) 나무가 다르다. JSX 주석 `{/* … *\/}` 안만 바뀐 것은 주석만이고, 문자열 · 템플릿 속의 `//` 나
 * JSX 글자는 나무의 값이라 주석이 아니다. 지금 규칙 그대로 가는 것:
 *
 * - 뜻이 있는 주석(`MEANINGFUL_COMMENT` — `@ts-…` · `eslint…` · `/// <reference` · `@jsx…` · 번들러 · 커버리지 지시)이 더해지거나
 *   지워지거나 다른 노드에 붙은 파일. `'use client'` · `'use server'` 는 문자열이라 나무가 잡는다. 정책 단계는 `scripts/` 밖을
 *   린트하지 않는다
 * - 파싱 실패 · 가르지 않는 확장자 · base 쪽을 못 읽음(추가 · 삭제 · 이름 바꿈 · 실행 비트 변경) · `typescript` 를 못 부름
 * - 일정 · 손으로 켠 실행은 전처럼 전부다. main 푸시는 아래 「문서만 바뀐 main 푸시」가 푸시 전 SHA 를 base 로 같은 판정을 쓴다.
 *   `supabase/**` 는 이것보다 먼저 전부다
 *
 * ## 문서만 바뀐 main 푸시는 `policy` 만 (ADR 0154)
 *
 * 머지 뒤 main 의 전체(약 11분)는 문서 PR 에도 돌았다 — 재는 것이 없는데 러너와 `ci-main-red` 의 기다림만 들었다. 그래서
 * main 푸시도 계획을 본다. 판정하는 것은 **푸시 전 SHA(`github.event.before`)와 뒤 SHA 사이의 변경 전체**다 — 여러 PR 이 한 푸시에
 * 들어도 그 범위 전부. 그 안이 정책 파일과 주석만 바뀐 코드 파일(위, base 는 푸시 전 SHA)뿐이면 `policy` 만, 하나라도 그 밖이면
 * 전부다. 단계 · 주소 대응은 안 본다 — main 의 일은 전체 검증이다. `audit` 도 `policy` 만일 때는 건너뛴다(새 advisory 는 일정이 잡는다).
 *
 * **앞 커밋이 초록으로 끝났을 때만 좁힌다.** main 의 concurrency 는 새 푸시가 앞 실행을 끊는다. 코드 커밋 A 의 전체가 문서 커밋 B 에
 * 끊기고 B 가 `policy` 만 돌면 A 는 아무도 안 잰다. 그래서 푸시 전 SHA 의 verify 실행(main 의 push · 일정 · 손으로 켠 것)이 하나라도
 * 초록이고 붉은 것이 없어야 좁힌다(`beforeGreen`). 그 초록이 `policy` 만이었으면 그것도 같은 조건으로 좁혀졌으므로, 사슬을 따라가면
 * 끝에 전부를 잰 초록이 있다. 붉은 main 위의 문서 푸시도 전부다 — 붉음이 풀렸는지 다음 푸시가 다시 잰다.
 *
 * 닫히는 쪽: 범위를 못 받음 · 푸시 전 SHA 가 0(새 가지) · 강제 갱신 · diff 를 못 읽음(빈 목록) · 앞 실행을 못 읽음(API 실패)은 전부다.
 * `policy` 만 돈 초록은 전부를 잰 것이 아니라서 `ci-main-red` 가 그것으로 이슈를 닫지 않고 「마지막 초록」으로도 세지 않는다
 * (`main-red.mjs` 의 `measuredEverything`).
 *
 * ## 원칙
 *
 * - 라벨(`full-ci`)은 **더할 수만 있고 뺄 수 없다.**
 * - 모르는 파일은 전부로 간다. 조용히 건너뛰지 않는다.
 * - diff 를 못 받았으면(빈 목록) 모르는 것이므로 전부 돈다.
 * - `schedule` · 손으로 켠 실행은 계획을 안 보고 전부 돈다. `main` 푸시는 정책만 바꿨을 때만 좁힌다(위).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FAILED } from './main-red.mjs';
import { LAUNCHED, STAGE_FILE, currentStageOf } from './release-stage.mjs';

export const FULL_LABEL = 'full-ci';

/** 이 이름들로만 판단한다 — 워크플로가 `github.event_name` 을 그대로 넘긴다 */
const PLANNED_EVENTS = new Set(['pull_request']);

/** 정책 — 사람과 에이전트가 읽는 규약, 그리고 그것을 견주는 시험. 코드가 아니라 `scripts/` 시험이 잰다 */
const POLICY = [/^docs\//, /\.md$/, /^\.claude\//, /^scripts\/[^/]+\.test\.ts$/];
const ENGINE = [/^src\/lib\/saju\//, /^app\/saju\//];
/** 의존성 목록 — 이것을 바꾼 PR 만 `audit` 이 머지를 막는다 */
export const DEPENDENCY_LISTS = ['package.json', 'package-lock.json'];
/** 관문 · 인증 · 화면의 입구 · 서버 액션 · 그것을 재는 시험 — 베타에서도 주소를 재거나 전부를 돈다(위 「관문 · 화면 · 인증」) */
const SURFACE = [
  /^proxy\.ts$/,
  /^src\/lib\/consent\//,
  /^app\/auth\//,
  /^app\/(.+\/)?(page|layout|loading|template|error|not-found|default)\.tsx$/,
  /^app\/(.+\/)?route\.ts$/,
  /^app\/(.+\/)?actions\.ts$/,
  /^e2e\//,
  /^scripts\/check-[^/]+\.mjs$/,
];
/** 이름이 `actions.ts` 가 아닌 `'use server'` 파일 — 이름으로 견주므로 시험이 실재를 잰다 */
export const SERVER_ACTIONS_ELSEWHERE = ['app/nickname.ts', 'app/me/reading/share.ts'];
/**
 * 앱 서버의 설정, 그리고 e2e · 흐름 검사가 import 하되 앱은 안 부르는 파일 — 위 「서버에 닿는 `app/` 파일과 시험 도구」.
 * 시험이 import 를 따라가 앱이 안 닿는 도구 파일이 전부 여기 있는지 잰다 — 새 도우미가 조용히 빠지지 않게
 */
export const HARNESS = ['next.config.ts', 'playwright.config.ts', 'src/lib/local-env.ts', 'src/lib/reading/variants.ts'];
/**
 * `scripts/*.mjs` 는 흐름 검사 · e2e 의 도우미로 보고 입구로 건다 — 여기 든 CI · 개발 도구만 뺀다. 빼는 쪽을 적으므로
 * 새 도우미(`scripts/beta-dates.mjs` 같은 것)는 이름을 안 적어도 걸리고, 여기 든 이름이 없어져도 넓어질 뿐이다
 */
const NOT_HARNESS =
  /^scripts\/(?:ci-plan|release-stage|main-red|audit-verify|vercel-ignore|secret-env|remote-lock|db-remote|stack-slot|merge-sim|read-budget|brand-share-images|checkout-hint|generate-[^/]+|fake-clock|ui-[^/]+)\.mjs$/;
const isHarness = (file) => HARNESS.includes(file) || (/^scripts\/[^/]+\.mjs$/.test(file) && !NOT_HARNESS.test(file));
/** 관문 — 여기서 import 를 따라가 닿는 `app/` 파일은 입구다(위 「관문이 import 하는 `app/` 파일」) */
const GATE = 'proxy.ts';
/**
 * 서버에 닿는 `app/` 파일을 가르는 import — Supabase 클라이언트와 서버 전용 모듈. 이것을 부르는 `app/**` 파일은 이름과
 * 상관없이 입구다(위 「서버에 닿는 `app/` 파일」)
 */
const SERVER_REACHING =
  /^(?:@supabase\/|server-only$|next\/(?:server|headers|cache)$)|\/(?:server-client|browser-client|keyed-client|public-client)(?:\.ts)?$/;
/** DB 차선에서만 재어지는 자리 — 단계와 상관없이 전부를 돈다 */
const DATABASE = [/^supabase\//];
/** 엔진 안에서 DB 의 검사식이 보는 파일 — 여기가 바뀌면 로그인 뒤 자리도 재야 한다 */
export const ENGINE_DB_FACING = ['src/lib/saju/version.ts', 'src/lib/saju/pillars/index.ts'];

/** `core` job 이 `npm ci` 뒤에 차례로 도는 명령 — `verify.yml` 이 이 목록과 같아야 한다(위 「빠른 검사에도 빌드가 든다」) */
export const CORE_STEPS = ['npm test', 'npm run typecheck', 'npm run lint', 'npm run build'];

/**
 * 로그인 뒤 차선 — `verify.yml` 의 `authed` matrix 가 계획의 `authed_lanes` 로 받는다. 차선마다 `package.json` 에
 * `test:e2e:<차선>` 이 있고, 그 스크립트가 어느 spec 을 부르는지가 곧 그 차선이 재는 것이다(위 「그 주소에 닿는 차선만」)
 */
export const AUTHED_LANES = [
  'signed-in:desktop',
  'signed-in:mobile',
  'match:desktop',
  'match:mobile',
  'chat:desktop',
  'chat:mobile',
  /* 두 계정의 채널 — 넓은 화면 한 벌이다(ADR 0155) */
  'live',
  /* 설정의 「새 메시지 알림」 — 넓은 화면 한 벌이다(ADR 0156) */
  'push',
  'notice',
];

const matches = (rules, file) => rules.some((rule) => rule.test(file));

const isPolicy = (file) => matches(POLICY, file);
const isTestFile = (file) => /\.test\.tsx?$/.test(file);
const isSpec = (file) => /^e2e\/[^/]+\.spec\.ts$/.test(file);
const isFlowCheck = (file) => /^scripts\/check-[^/]+\.mjs$/.test(file);

/**
 * 공용 위험 — 주소 하나로 닿는 시험을 셀 수 없는 자리. 바뀐 파일 전부를 **주소 대응보다 먼저** 훑고, 하나라도 들면 전부다.
 * 이름이 까닭에 그대로 실린다(위 「공용 위험」)
 */
export const SHARED_RISK = [
  ['DB', (file) => matches(DATABASE, file)],
  [
    'Next 공용 경계',
    (file) =>
      /^app\/global-(?:error|not-found)\.tsx$/.test(file) ||
      /^app\/(?:.+\/)?(?:forbidden|unauthorized)\.tsx$/.test(file) ||
      /^(?:instrumentation|instrumentation-client|middleware)\.[jt]s$/.test(file),
  ],
  ['관문', (file) => file === GATE || /^src\/lib\/consent\//.test(file)],
  ['인증', (file) => /^app\/auth\//.test(file)],
  ['layout', (file) => /^app\/(?:.+\/)?layout\.tsx$/.test(file)],
  ['route.ts', (file) => /^app\/(?:.+\/)?route\.ts$/.test(file)],
  ['서버 액션', (file) => /^app\/(?:.+\/)?actions\.ts$/.test(file) || SERVER_ACTIONS_ELSEWHERE.includes(file)],
  ['e2e 기반', (file) => /^e2e\//.test(file) && !isSpec(file)],
  ['시험 도구', (file) => isHarness(file) && !isFlowCheck(file)],
];

/**
 * 알려진 core 자리 — 단위 · 타입 · 린트 · 빌드가 재는 곳. 위 판정이 안 걸린 파일이 여기 들면 `core` 만이고, **여기도
 * 정책도 아니면 베타에서도 전부다**(ADR 0097 추기). 파일을 늘어놓지 않고 자리로 적는다
 */
const KNOWN_CORE = [/^src\//, /^app\//, /^scripts\//, /^\.github\//, /^public\//];
/** 뿌리의 설정 — 이름으로 든다. 앱 서버 · Playwright 의 설정은 `HARNESS` 라 공용 위험이다 */
export const ROOT_CONFIGS = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'eslint.config.mjs',
  'postcss.config.mjs',
  'vitest.config.mts',
  'vercel.json',
  '.nvmrc',
  '.gitignore',
  '.gitattributes',
  '.vercelignore',
];
const isKnownCore = (file) => matches(KNOWN_CORE, file) || ROOT_CONFIGS.includes(file);

/** Next 의 메타데이터 파일 — 빌드와 익명 e2e(문서 머리)가 잰다 */
const METADATA =
  /^app\/(?:.+\/)?(?:icon|apple-icon|favicon|opengraph-image|twitter-image|manifest|robots|sitemap)\d*\.(?:tsx?|png|jpe?g|gif|svg|ico|txt|xml|json|webmanifest)$/;

/** 파일이 import 하는 이름들 — `import … from` · `export … from` · `import '…'` · `import('…')` */
export const importsOf = (source) =>
  [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((one) => one[1]);

/** 저장소 뿌리에서 읽는다 — 계획 job 은 PR 의 HEAD 를 받아 둔다. 못 읽으면(지운 파일) `null` */
function sourceFromDisk(file) {
  try {
    return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

/** `app/**` 의 시험 아닌 `.ts` · `.tsx` 가 Supabase 클라이언트나 서버 전용 모듈을 부르는가 */
function reachesServer(file, sourceOf = sourceFromDisk) {
  if (!/^app\/.+\.tsx?$/.test(file)) return false;
  const source = sourceOf(file);
  return source !== null && importsOf(source).some((name) => SERVER_REACHING.test(name));
}

/** 저장소 안의 import(`./` · `../` · `@/`)를 파일로 푼다 — 패키지이거나 못 읽으면 `null` */
function resolveImport(name, from, sourceOf) {
  let base;
  if (name.startsWith('@/')) base = name.slice(2);
  else if (name.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(from), name));
  else return null;
  for (const tail of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']) {
    if (sourceOf(base + tail) !== null) return base + tail;
  }
  return null;
}

/** 관문에서 import 를 따라가 닿는 저장소 파일 — `sourceOf` 하나마다 한 번만 잰다 */
const gateReachOf = new WeakMap();
function gateReach(sourceOf = sourceFromDisk) {
  if (gateReachOf.has(sourceOf)) return gateReachOf.get(sourceOf);
  const seen = new Set();
  const queue = [GATE];
  while (queue.length > 0) {
    const file = queue.pop();
    const source = seen.has(file) ? null : sourceOf(file);
    if (source === null) continue;
    seen.add(file);
    for (const name of importsOf(source)) {
      const next = resolveImport(name, file, sourceOf);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  gateReachOf.set(sourceOf, seen);
  return seen;
}

/** 시험 파일(`*.test.ts`)은 제 결과만 바꾼다 — `app/auth/signed-in.test.ts` 하나로 전부를 돌지 않는다 */
export const isSurface = (file, sourceOf = sourceFromDisk) =>
  !isTestFile(file) &&
  (matches(SURFACE, file) ||
    SERVER_ACTIONS_ELSEWHERE.includes(file) ||
    isHarness(file) ||
    reachesServer(file, sourceOf) ||
    (file.startsWith('app/') && gateReach(sourceOf).has(file)));
const isEngine = (file) => matches(ENGINE, file) && !ENGINE_DB_FACING.includes(file);

// ---------------------------------------------------------------------------
// 주소 대응 — 소스에서 뽑는다(위 「그 주소에 닿는 차선만」)
// ---------------------------------------------------------------------------

/** 주소를 가진 화면의 입구. `layout` 은 공용 위험이라 여기 없다 */
const ENTRY = /^app\/(?:(.*)\/)?(page|loading|template|error|not-found|default)\.tsx$/;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 화면 입구 파일이 맡는 주소의 무늬. `page` 는 그 주소 하나, 나머지는 그 아래 전부(뿌리면 모든 주소).
 * `(group)` · `@slot` 은 걷고, `[x]` 는 한 마디, `[...x]` 는 하나 이상, `[[...x]]` 는 없어도 된다. 입구가 아니면 `null`
 *
 * @param {string} file
 * @returns {RegExp | null}
 */
export function routeOf(file) {
  const entry = ENTRY.exec(file);
  if (!entry) return null;
  const segments = (entry[1] ?? '').split('/').filter((one) => one !== '' && !/^\(.*\)$/.test(one) && !one.startsWith('@'));
  const path = segments
    .map((one) => {
      if (/^\[\[\.\.\..+\]\]$/.test(one)) return '(?:/.*)?';
      if (/^\[\.\.\..+\]$/.test(one)) return '/.+';
      if (/^\[.+\]$/.test(one)) return '/[^/]+';
      return `/${escapeRegExp(one)}`;
    })
    .join('');
  return new RegExp(entry[2] === 'page' ? `^${path}/?$` : `^${path}(?:/.*)?$`);
}

/** 주석 줄 — `//` · `/*` · ` *` 로 여는 줄. 거기 적힌 주소는 시험이 요청하지 않는다 */
const isCommentLine = (line) => /^\s*(?:\/\/|\/\*|\*)/.test(line);

/**
 * 시험 소스가 요청하는 주소들 — 주석 줄을 뺀 따옴표 · 백틱 속 `/…`. `${…}` 는 한 마디로, `%2F…` 는 풀어서 하나 더,
 * `?` · `#` 뒤는 버린다
 *
 * @param {string} source
 * @returns {string[]}
 */
export function addressesOf(source) {
  const code = source
    .split('\n')
    .filter((line) => !isCommentLine(line))
    .join('\n');
  const found = new Set();
  for (const one of code.matchAll(/['"`](\/[^'"`\s]*)/g)) found.add(one[1].replace(/\$\{[^}]*\}/g, 'x').split(/[?#]/)[0]);
  for (const one of code.matchAll(/%2F[\w%.-]+/g)) {
    try {
      found.add(decodeURIComponent(one[0]).split(/[?#]/)[0]);
    } catch {
      // 풀 수 없는 조각은 주소가 아니다
    }
  }
  return [...found];
}

/** `playwright.config.ts` 의 `const NAME = ['**\/x.spec.ts', …]` — e2e 아래 spec 경로로 */
function specGlobOf(config, name) {
  const list = new RegExp(`const ${name} = \\[([^\\]]*)\\];`).exec(config)?.[1] ?? '';
  return [...list.matchAll(/\*\*\/([\w.-]+)/g)].map((one) => `e2e/${one[1]}`);
}

/**
 * 시험과 차선의 대응 — 저장소에서 한 번 읽는다. 로그인 spec 은 Playwright 의 `AUTHED` · `NOTICE` 무늬, 차선이 부르는
 * spec 은 `package.json` 의 `test:e2e:<차선>`(spec 을 안 적었으면 `--project` 의 `testMatch` 무늬)
 */
let testMapCache = null;
function testMap() {
  if (testMapCache) return testMapCache;
  const scripts = JSON.parse(sourceFromDisk('package.json') ?? '{}').scripts ?? {};
  const config = sourceFromDisk('playwright.config.ts') ?? '';
  const loginSpecs = [...specGlobOf(config, 'AUTHED'), ...specGlobOf(config, 'NOTICE')];
  const specsOfLane = Object.fromEntries(
    AUTHED_LANES.map((lane) => {
      const script = scripts[`test:e2e:${lane}`] ?? '';
      const named = [...script.matchAll(/\be2e\/[\w.-]+\.spec\.ts\b/g)].map((one) => one[0]);
      if (named.length > 0) return [lane, named];
      const projects = [...script.matchAll(/--project=([\w-]+)/g)].map((one) => one[1]);
      const globbed = projects.flatMap((project) => {
        const glob = new RegExp(`name: '${escapeRegExp(project)}',\\s*testMatch: (\\w+)`).exec(config)?.[1];
        return glob ? specGlobOf(config, glob) : [];
      });
      return [lane, globbed];
    }),
  );
  const listed = (dir, pattern) => {
    try {
      return readdirSync(new URL(`../${dir}`, import.meta.url)).filter((name) => pattern.test(name)).map((name) => `${dir}/${name}`);
    } catch {
      return [];
    }
  };
  const tests = [...listed('e2e', /\.spec\.ts$/), ...listed('scripts', /^check-[^/]+\.mjs$/)];
  const addresses = Object.fromEntries(tests.map((test) => [test, addressesOf(sourceFromDisk(test) ?? '')]));
  testMapCache = { loginSpecs, specsOfLane, addresses };
  return testMapCache;
}

/** 시험 하나가 켜는 차선 — 흐름 검사는 `flow`, 차선 스크립트가 부르는 spec 은 그 차선, 로그인 무늬인데 부르는 차선이 없으면 `null`(전부), 그 밖 spec 은 `anon` */
export function lanesOfTest(test) {
  if (isFlowCheck(test)) return ['flow'];
  const map = testMap();
  const lanes = AUTHED_LANES.filter((lane) => map.specsOfLane[lane].includes(test));
  if (lanes.length > 0) return lanes;
  if (map.loginSpecs.includes(test)) return null;
  return isSpec(test) ? ['anon'] : null;
}

/** 그 주소 무늬에 닿는 시험들 */
const testsReaching = (route) =>
  Object.entries(testMap().addresses)
    .filter(([, addresses]) => addresses.some((address) => route.test(address)))
    .map(([test]) => test);

/** 로그인 spec 이 무엇인가 — 시험이 차선 스크립트와 견준다 */
export const loginSpecs = () => [...testMap().loginSpecs];
/** 차선이 부르는 spec — 시험이 무늬와 견준다 */
export const specsOfLane = (lane) => [...testMap().specsOfLane[lane]];

// ---------------------------------------------------------------------------
// 주석만 바뀐 코드 파일 — 정책으로 센다(위 「주석만 바뀐 코드 파일」, ADR 0153)
// ---------------------------------------------------------------------------

/** 파서로 가르는 코드 파일 — 확장자마다 TypeScript 의 읽는 법. 여기 없는 확장자는 가르지 않는다 */
const SCRIPT_KINDS = { '.ts': 'TS', '.mts': 'TS', '.cts': 'TS', '.tsx': 'TSX', '.js': 'JS', '.mjs': 'JS', '.cjs': 'JS', '.jsx': 'JSX' };

/**
 * 뜻이 있는 주석 — 타입 검사 · 린트 · 번들러 · 커버리지 · 런타임이 읽는다. 이것이 더해지거나 지워지거나 다른 토큰 앞으로 옮으면
 * 주석만 바뀐 것이 아니다. 정책 단계는 `scripts/` 밖을 린트하지 않는다. 도구는 주석(이나 JSDoc 의 한 줄)의 **머리**에 선 지시만
 * 읽으므로 머리에서 견준다 — 산문 가운데의 「`eslint` 은」은 지시가 아니다
 */
export const MEANINGFUL_COMMENT =
  /^(?:@ts-|eslint|<(?:reference|amd)|@jsx|webpack|turbopack|@vite-ignore|istanbul|[cv]8 ignore|prettier-ignore|biome-ignore|#?__PURE__|#?__NO_SIDE_EFFECTS__|@refresh|@vitest-environment|global\s|exported\s)/;
/** 주석 하나에서 지시로 읽히는 줄 — 여는 `//` · `///` · `/*` · `/**` 와 JSDoc 의 `*` 를 걷은 머리로 견준다 */
const directivesIn = (comment) =>
  comment
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\/\/\/?|\/\*+|\*)?\s*/, ''))
    .filter((line) => MEANINGFUL_COMMENT.test(line));

/**
 * 구문 나무를 펼친 열과 뜻이 있는 주석의 자리. 열은 노드마다 `(종류 … )` 로 감싸고 잎은 종류와 글자(식별자 · 리터럴 ·
 * 연산자)다 — 위치와 트리비아(주석 · 공백)는 빠진다. 토큰만 견주면 줄바꿈이 자동 세미콜론으로 뜻을 바꾸는 것(`return` 뒤
 * 줄바꿈)을 놓치므로 나무의 모양까지 든다. JSDoc 노드는 주석이라 건너뛴다. 뜻이 있는 주석은 「열의 몇 번째 앞(뒤)에
 * 무엇이」로 적는다 — 열이 같을 때 그 자리가 같으면 같은 것에 붙은 것이다. 파싱 진단이 하나라도 있으면 `null`
 *
 * @param {typeof import('typescript')} ts
 * @param {string} file
 * @param {string} source
 * @returns {{ tokens: string[], meaningful: string[] } | null}
 */
export function syntaxOf(ts, file, source) {
  const kind = SCRIPT_KINDS[posix.extname(file)];
  if (!kind) return null;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind[kind]);
  if (tree.parseDiagnostics?.length !== 0) return null;
  const tokens = [];
  const meaningful = [];
  const note = (ranges, where) => {
    for (const range of ranges ?? []) {
      for (const directive of directivesIn(source.slice(range.pos, range.end))) meaningful.push(`${where}:${directive}`);
    }
  };
  const walk = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const children = node.getChildren(tree);
    if (children.length > 0 && node.kind !== ts.SyntaxKind.JsxText) {
      tokens.push(`(${node.kind}`);
      for (const child of children) walk(child);
      tokens.push(')');
      return;
    }
    note(ts.getLeadingCommentRanges(source, node.pos), `${tokens.length}<`);
    tokens.push(`${node.kind}:${node.getText(tree)}`);
    note(ts.getTrailingCommentRanges(source, node.end), `${tokens.length - 1}>`);
  };
  walk(tree);
  const shebang = ts.getShebang(source);
  if (shebang) meaningful.push(`#!${shebang}`);
  return { tokens, meaningful };
}

/**
 * 옛 소스와 지금 소스의 구문 나무가 같고 뜻이 있는 주석도 그대로인가 — 「주석만 바뀌었다」.
 * 한쪽을 못 읽으면(추가 · 삭제 · 이름 바꿈), 가르지 않는 확장자면, 파싱이 실패하면, 둘이 글자째 같으면 `false`
 *
 * @param {typeof import('typescript') | null} ts
 * @param {string} file
 * @param {string | null} before base 쪽 내용
 * @param {string | null} after HEAD 쪽 내용
 */
export function onlyCommentsChanged(ts, file, before, after) {
  if (ts === null || before === null || after === null || before === after) return false;
  const old = syntaxOf(ts, file, before);
  const now = syntaxOf(ts, file, after);
  if (old === null || now === null) return false;
  const same = (a, b) => a.length === b.length && a.every((one, at) => one === b[at]);
  return same(old.tokens, now.tokens) && same(old.meaningful, now.meaningful);
}

// ---------------------------------------------------------------------------
// 계획
// ---------------------------------------------------------------------------

/** 차선 묶음 — `verify.yml` 의 job 이름과 같다. `authed` 는 `authedLanes` 가 비었는가로 정한다 */
const picked = ({ policy = false, core = false, anon = false, authedLanes = [], flow = false }) => ({
  lanes: { policy, core, anon, authed: authedLanes.length > 0, flow },
  authedLanes: AUTHED_LANES.filter((lane) => authedLanes.includes(lane)),
});
const EVERYTHING = { core: true, anon: true, authedLanes: AUTHED_LANES, flow: true };

/**
 * `stage` 는 `release-stage.mjs` 의 `currentStageOf` 가 낸 값이다 — `null` 이나 빠진 값은 모르는 단계다.
 * `pushed` 는 main 푸시의 범위다(위 「문서만 바뀐 main 푸시」) — `before` 는 푸시 전 SHA, `forced` 는 강제 갱신,
 * `beforeGreen` 은 그 SHA 의 verify 가 초록으로 끝났는가(`settledGreen`). 빠지면 범위를 모르는 것이라 전부다.
 * `sourceOf` 는 바뀐 파일의 지금 내용이다(서버에 닿는 `app/` 파일을 가른다) — 빠지면 저장소에서 읽는다.
 * `baseSourceOf` 는 그 파일의 base 쪽 내용, `ts` 는 `typescript` 모듈이다(주석만 바뀐 코드 파일을 가른다) — 둘 중 하나가
 * 빠지거나 `null` 이면 지금 규칙 그대로다.
 *
 * `tier` 는 사람이 읽는 요약이다 — job 은 `lanes` 와 `authedLanes` 만 읽는다. `cause` 는 전부로 간 갈래의 이름이다.
 *
 * @param {{ files: readonly string[], labels?: readonly string[], event?: string, stage?: string | null, sourceOf?: (file: string) => string | null, baseSourceOf?: (file: string) => string | null, ts?: typeof import('typescript') | null, pushed?: { before: string | null, forced: boolean, beforeGreen: boolean | null } | null }} input
 * @returns {{ tier: 'policy' | 'core' | 'narrow' | 'engine' | 'full', reason: string, cause: string | null, lanes: { policy: boolean, core: boolean, anon: boolean, authed: boolean, flow: boolean, audit: boolean }, authedLanes: string[] }}
 */
export function planFor({ files, labels = [], event = 'pull_request', stage = null, sourceOf = sourceFromDisk, baseSourceOf = () => null, ts = null, pushed = null }) {
  const decided =
    event === 'push' ? decidePush({ files, pushed, sourceOf, baseSourceOf, ts }) : decide({ files, labels, event, stage, sourceOf, baseSourceOf, ts });
  const { lanes, authedLanes } = picked(decided.tier === 'full' ? EVERYTHING : decided.pick ?? {});
  return {
    tier: decided.tier,
    reason: decided.reason,
    cause: decided.cause ?? null,
    lanes: { ...lanes, audit: audits({ files, labels, event, tier: decided.tier }) },
    authedLanes,
  };
}

/** 단계와 상관없다 — 위 「운영 의존성 감사」. main 푸시는 `policy` 만일 때 건너뛴다(위 「문서만 바뀐 main 푸시」) */
function audits({ files, labels, event, tier }) {
  if (event === 'push') return tier !== 'policy';
  if (!PLANNED_EVENTS.has(event) || labels.includes(FULL_LABEL)) return true;
  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  return changed.length === 0 || changed.some((one) => DEPENDENCY_LISTS.includes(one));
}

const full = (cause, reason) => ({ tier: 'full', cause, reason });

function decide({ files, labels, event, stage, sourceOf, baseSourceOf, ts }) {
  if (!PLANNED_EVENTS.has(event)) return full('계획 밖 이벤트', `\`${event}\` 은 계획을 안 본다`);
  if (labels.includes(FULL_LABEL)) return full('라벨', `\`${FULL_LABEL}\` 라벨`);

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return full('빈 diff', '바뀐 파일 목록을 못 받았다');

  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return full('DB', `\`${database}\` 은 DB 차선에서만 재어진다`);
  if (stage === null || !(stage in LAUNCHED)) return full('단계 모름', '출시 단계를 모른다 — PRD §7.0 의 「(지금)」');

  const commentOnly = commentOnlyOf(changed, { sourceOf, baseSourceOf, ts });
  const judged = changed.filter((file) => !commentOnly.includes(file));
  return notingComments(LAUNCHED[stage] ? decideLaunched(judged) : decideBeta(judged, stage, sourceOf), commentOnly);
}

/** 바뀐 파일 중 주석만 바뀐 코드 파일 — 파서가 없으면 없다(위 「주석만 바뀐 코드 파일」) */
const commentOnlyOf = (changed, { sourceOf, baseSourceOf, ts }) =>
  ts === null ? [] : changed.filter((file) => posix.extname(file) in SCRIPT_KINDS && onlyCommentsChanged(ts, file, baseSourceOf(file), sourceOf(file)));

const notingComments = (decided, commentOnly) =>
  commentOnly.length === 0
    ? decided
    : { ...decided, reason: `${decided.reason} — 주석만 바뀐 코드 파일은 정책으로 셌다: ${commentOnly.map((one) => `\`${one}\``).join(' · ')}` };

/** 푸시 전 SHA 가 없다 — 새 가지 · 지운 가지에서 GitHub 가 넘기는 0 */
const NO_COMMIT = /^0+$/;

/**
 * 푸시 전 SHA 의 verify 실행들이 초록으로 끝났는가 — main 의 push · 일정 · 손으로 켠 실행 중 하나라도 `success` 이고 붉은 것이
 * 없어야 참이다. 끊긴 것 · 아직 도는 것은 세지 않는다 — 끊긴 것만 있으면 아무도 끝까지 안 잰 것이라 거짓이다(위 「문서만 바뀐 main 푸시」)
 *
 * @param {readonly { event?: string, conclusion?: string | null }[]} runs
 */
export function settledGreen(runs) {
  const onMain = runs.filter((run) => run.event !== 'pull_request');
  return onMain.some((run) => run.conclusion === 'success') && !onMain.some((run) => FAILED.has(run.conclusion ?? ''));
}

/** main 푸시 — 범위 전체가 정책 · 주석만이고 앞 커밋이 초록이면 `policy`, 아니면 전부(위 「문서만 바뀐 main 푸시」) */
function decidePush({ files, pushed, sourceOf, baseSourceOf, ts }) {
  if (pushed === null || !pushed.before || NO_COMMIT.test(pushed.before)) return full('범위 모름', 'main 푸시 — 푸시 전 SHA 가 없다(새 가지 · 못 받음)');
  if (pushed.forced) return full('강제 갱신', 'main 푸시 — 강제 갱신이라 푸시 전 SHA 부터의 범위를 믿지 않는다');

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return full('빈 diff', 'main 푸시 — 푸시 전 SHA 부터 바뀐 파일 목록을 못 받았다');
  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return full('DB', `main 푸시 — \`${database}\` 은 DB 차선에서만 재어진다`);

  const commentOnly = commentOnlyOf(changed, { sourceOf, baseSourceOf, ts });
  const code = changed.find((file) => !commentOnly.includes(file) && !isPolicy(file));
  if (code) return full('main 푸시', `main 푸시 — \`${code}\` 이 정책 밖이라 전부 잰다`);
  const before = pushed.before.slice(0, 7);
  if (pushed.beforeGreen !== true) {
    return full('앞 커밋 미검증', `main 푸시 — 정책만 바뀌었지만 앞 커밋 \`${before}\` 의 verify 가 초록으로 끝나지 않았다(끊김 · 붉음 · 못 읽음)`);
  }
  return notingComments({ tier: 'policy', reason: `main 푸시 — \`${before}\` 부터 정책만 바뀌었다`, pick: { policy: true } }, commentOnly);
}

/** 공개 출시 — 위 「세 단계뿐이다」 그대로. 엔진 단계는 `core` + `anon` 이다 */
function decideLaunched(changed) {
  const unknown = changed.filter((one) => !isPolicy(one) && !isEngine(one));
  if (unknown.length > 0) return full('정책도 엔진도 아님', `\`${unknown[0]}\` 은 정책도 엔진도 아니다`);
  if (changed.every(isPolicy)) return { tier: 'policy', reason: '정책(문서 · 도구 설정 · scripts 시험)만 바뀌었다', pick: { policy: true } };
  return { tier: 'engine', reason: '엔진과 그것을 그리는 칸만 바뀌었다', pick: { core: true, anon: true } };
}

/** 공개 출시 전 — 공용 위험 → 정책 → 파일마다 그 주소에 닿는 차선. 좁힌 계획에도 `core` 는 늘 선다 */
function decideBeta(changed, stage, sourceOf) {
  for (const file of changed) {
    if (isTestFile(file)) continue;
    const risk = SHARED_RISK.find(([, hits]) => hits(file));
    if (risk) return full(risk[0], `${stage} — \`${file}\` 은 공용 위험(${risk[0]})이라 머지 전에 전부 잰다`);
  }
  if (changed.every(isPolicy)) return { tier: 'policy', reason: `${stage} — 정책만 바뀌었다`, pick: { policy: true } };

  const pick = { core: true, anon: false, authedLanes: [], flow: false };
  const why = [];
  const take = (lanes) => {
    for (const lane of lanes) {
      if (lane === 'anon') pick.anon = true;
      else if (lane === 'flow') pick.flow = true;
      else if (!pick.authedLanes.includes(lane)) pick.authedLanes.push(lane);
    }
  };
  for (const file of changed) {
    if (isTestFile(file) || isPolicy(file)) continue;
    let tests;
    if (isSpec(file) || isFlowCheck(file)) tests = [file];
    else if (METADATA.test(file) && !reachesServer(file, sourceOf)) {
      take(['anon']);
      why.push(`\`${file}\` → 메타데이터`);
      continue;
    } else if (isSurface(file, sourceOf)) {
      const route = routeOf(file);
      if (!route) return full('주소 없음', `${stage} — \`${file}\` 은 입구인데 주소를 못 뽑는다`);
      tests = testsReaching(route);
      if (tests.length === 0) return full('닿는 시험 없음', `${stage} — \`${file}\` 의 주소에 닿는 시험이 없다`);
    } else if (isKnownCore(file)) continue;
    else return full('미분류', `${stage} — \`${file}\` 은 알려진 자리가 아니다`);

    for (const test of tests) {
      const lanes = lanesOfTest(test);
      if (!lanes) return full('차선 모름', `${stage} — \`${test}\` 을 부르는 차선을 못 찾는다`);
      take(lanes);
    }
    why.push(tests[0] === file ? `\`${file}\`` : `\`${file}\` ← ${tests.map((one) => `\`${one}\``).join(' · ')}`);
  }
  if (why.length === 0) return { tier: 'core', reason: `${stage} — 입구가 아니라 core 만 머지를 막고 전체는 main 에서 돈다`, pick };
  return { tier: 'narrow', reason: `${stage} — 그 주소에 닿는 차선만: ${why.join(', ')}`, pick };
}

/** 사람이 읽는 표 — step summary 에 찍는다 */
export function summaryOf(plan, files) {
  const lanes = Object.entries(plan.lanes)
    .map(([lane, on]) => `| \`${lane}\` | ${on ? (lane === 'authed' ? plan.authedLanes.map((one) => `\`${one}\``).join(' · ') : '돈다') : '건너뛴다'} |`)
    .join('\n');
  return [
    `## CI 계획: \`${plan.tier}\``,
    '',
    `${plan.reason} (바뀐 파일 ${files.length}개)`,
    '',
    '| 차선 | |',
    '|---|---|',
    lanes,
    '',
  ].join('\n');
}

function argOf(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

/**
 * base 커밋의 그 파일 — 못 읽으면(그 커밋에 없다 · git 실패) `null`. 실행 비트가 바뀐 파일도 `null` 이다: 토큰은 같아도
 * 주석만 바뀐 것이 아니다
 */
function baseSourceFromGit(base, file) {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
  try {
    const modeOf = (ref) => git('ls-tree', ref, '--', file).split(/\s/)[0];
    if (modeOf(base) !== modeOf('HEAD')) return null;
    return git('show', `${base}:${file}`);
  } catch {
    return null;
  }
}

/**
 * main 푸시의 범위 — 푸시 전 SHA 의 verify 실행을 API 로 읽는다(계획 job 의 `actions: read`). 못 읽으면 `beforeGreen` 이
 * `null` 이라 전부다(위 「문서만 바뀐 main 푸시」)
 */
function pushedOf(before, forced) {
  let beforeGreen = null;
  const repo = process.env.GITHUB_REPOSITORY;
  if (before !== null && /^[0-9a-f]{40}$/.test(before) && !NO_COMMIT.test(before) && repo) {
    try {
      const runs = execFileSync(
        'gh',
        ['api', `repos/${repo}/actions/workflows/verify.yml/runs?branch=main&head_sha=${before}&per_page=100`, '--jq', '[.workflow_runs[] | {event, conclusion}]'],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      beforeGreen = settledGreen(JSON.parse(runs));
    } catch {
      // 못 읽으면 모르는 것이다 — 전부로 간다
    }
  }
  return { before, forced, beforeGreen };
}

async function main() {
  const files = readFileSync(0, 'utf8').split('\n').filter((one) => one.trim() !== '');
  const labels = (argOf('--labels') ?? '').split(',').map((one) => one.trim()).filter(Boolean);
  const event = argOf('--event') ?? 'pull_request';

  let stage = null;
  try {
    stage = currentStageOf(readFileSync(new URL(`../${STAGE_FILE}`, import.meta.url), 'utf8'));
  } catch {
    // PRD 를 못 읽으면 모르는 단계다 — 전부로 간다
  }
  // 주석만 바뀐 코드 파일을 가르는 둘 — base 커밋과 파서. 하나라도 없으면(인자 없음 · 설치 전) 지금 규칙 그대로 간다
  const base = argOf('--base') || null;
  let ts = null;
  if (base !== null) {
    try {
      ts = (await import('typescript')).default;
    } catch {
      // 위와 같다
    }
  }
  const plan = planFor({
    files,
    labels,
    event,
    stage,
    ts,
    baseSourceOf: (file) => (base === null ? null : baseSourceFromGit(base, file)),
    pushed: event === 'push' ? pushedOf(argOf('--before') || null, argOf('--forced') === 'true') : null,
  });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `tier=${plan.tier}`,
        ...Object.entries(plan.lanes).map(([lane, on]) => `${lane}=${on}`),
        `authed_lanes=${JSON.stringify(plan.authedLanes)}`,
        '',
      ].join('\n'),
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryOf(plan, files));

  console.log(JSON.stringify({ ...plan, stage, files: files.length }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
