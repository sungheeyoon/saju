# 관문 · 화면의 입구 · 인증을 바꾼 PR 은 공개 출시 전에도 머지 전에 전부 돈다

> 후속 결정(일부): ADR 0155 — 정적인 JSX 문구만 바뀐 화면 파일은 CI 에서 `core` 로 센다

> **섰다**(2026-09-27). 운영자 결정 — ADR 0097 의 「PR 은 `fast` 만」에 예외를 하나 더 둔다(첫째는 `supabase/**`).

## 잰 것

#284(탭 넷의 `loading.tsx` 뼈대 · route group 이동, 24 파일)와 #286(`proxy.ts` · 화면 · 서버 액션, 39 파일)의 바뀐 파일
목록을 `scripts/ci-plan.mjs` 에 그대로 넣으니 둘 다 `fast` 가 나왔다 — 「운영 베타 — 빠른 검사만 머지를 막고 전체는 main 에서
돈다」. **목록은 맞았고 규칙이 의도대로 돌았다.** 베타의 `fast` 가 `supabase/**` · 정책 밖의 「그 밖 전부」를 받았고, 관문 ·
화면 · 인증을 가를 자리가 규칙에 없었다. #284 는 머지 뒤 main 의 `flow`(`check-discovery` 「홈을 한 번 여는 것만으로 풀에
든다」)가 붉었고(`e370931` → `d7b38f5`), #286 은 로그인 확인 방식을 바꾸고도 `authed` · `flow` 를 한 번도 안 지나 머지됐다.
단위 · 타입 · 린트 · 빌드는 **화면이 열리는가, 관문이 누구를 들이는가**를 모른다(vitest 는 `.tsx` 에 안 닿는다).

## 정한 것

공개 출시 전에도, 바뀐 파일 중 하나라도 아래에 들면 PR 이 전부(익명 e2e · `authed` 일곱 · `flow`)를 돈다. 목록은
`ci-plan.mjs` 의 `SURFACE` 한 곳이다.

- 관문 — `proxy.ts` · `src/lib/consent/**`
- 인증 — `app/auth/**`
- 화면의 입구 — `app/**` 의 `page` · `layout` · `loading` · `template` · `error` · `not-found` · `default`(`.tsx`) · `route.ts`.
  route group 이동은 `--no-renames` 로 옛 · 새 `page.tsx` 가 다 서서 여기 걸린다
- 서버 액션 — `app/**/actions.ts` 와 이름이 다른 `'use server'` 파일(`SERVER_ACTIONS_ELSEWHERE`). 시험이 `app/` 의
  `'use server'` 파일이 전부 걸리는지 재므로 새 액션 파일이 조용히 빠지지 않는다
- 그것을 재는 시험 — `e2e/**` · 흐름 검사(`scripts/check-*.mjs` · `run-checks.mjs` · `next-server.mjs`)

`*.test.ts` 는 입구가 아니다 — 제 결과만 바꾼다.

## 안 고른 것

- **입구가 아닌 컴포넌트 · `src/lib/**` 까지.** 그러면 코드 PR 이 거의 다 전부가 되어 ADR 0097 이 없던 것과 같다. 그 자리의 붉음은
  전처럼 main 이 잡는다.
- **경로마다 `authed` 차선을 골라 켜기**(채팅이면 `chat` 만). ADR 0082 의 까닭 그대로 — 「이 경로는 저 차선에 안 걸린다」는
  문장은 파일이 옮겨지는 날 조용히 거짓이 되고, 관문 · 로그인 확인은 모든 차선이 밟는다. 일곱을 다 돈다.

## 값

그런 PR 은 머지 전에 약 5분(전부)을 기다린다 — `fast` 는 빌드를 넣은 뒤 몇 분이라 차이는 몇 분이다. strict 가 뒤에 선 PR 을
최신 main 위에서 다시 돌리므로 그 값이 두 번 들 수 있다. 공개 출시로 옮기면 이 예외는 「그 밖 전부 → 전부」에 녹아 사라진다.

## 추기 (2026-09-28) — 이름이 아니라 import 로 가르는 입구 둘

밤샘 감사가 경로를 `ci-plan.mjs` 에 넣어 보니 판단이 사는 문이 `fast` 였다. `page.tsx` 는 얇고 DB 를 부르는 것은 옆의 `.ts` 다 —
`app/me/reading/pipeline.ts` · `app/me/candidates.ts` · `app/me/chat/rooms.ts` · `app/keyed-client.ts`(service-role) · `app/ops/reports/read.ts` ·
`app/share/public-client.ts`, 그리고 `proxy.ts` 가 부르는 `app/beta-schedule.ts`. 앱 서버의 설정(`next.config.ts` 의 CSP — 익명 e2e 가 잰다) ·
`playwright.config.ts` · 흐름 검사의 도우미(`scripts/checks.mjs` · `notice.mjs`) · `src/lib/local-env.ts` 도 그랬다. 그래서 `SURFACE` 에 둘을 더했다.
**서버에 닿는 `app/` 파일** — `app/**` 의 시험 아닌 `.ts` · `.tsx` 가 Supabase 클라이언트나 서버 전용 모듈(`server-only` · `next/server` ·
`next/headers` · `next/cache`)을 import 하면 이름과 상관없이 입구다(`SERVER_REACHING`, 계획 job 이 HEAD 를 읽는다). **시험 도구가 혼자
쓰는 파일** — 설정 둘과 `src/lib/local-env.ts`(`HARNESS`), 그리고 `scripts/*.mjs` 중 CI · 개발 도구(`NOT_HARNESS`, 빼는 쪽을 적는다)가
아닌 것 전부. 새 도우미는 이름을 안 적어도 걸린다. **관문이 import 하는 `app/` 파일** — `proxy.ts` 에서 import 를 따라가 닿는 `app/**` 는
서버에 안 닿아도 입구다(계획 job 이 그때 잰다). 셋 다 목록이 파일의 실재를 요구하지 않아, 나란히 선 PR 이 도우미를 새로 만들거나 관문이
새 파일을 부르기 시작해도 머지 순서와 상관없이 맞다. 시험은 e2e · 흐름 검사 · Playwright 에서 import 를 따라가 앱이 안 닿는 파일, 관문이
닿는 `app/` 파일이 전부 걸리는지 잰다. 잰 값: 한 파일만 바꾼 PR 이 전부로 옮는 파일 42 개(`app/**` `.ts` 35 · 브라우저 client 를 부르는 `.tsx` 2 · 도구 5), `app/**` 의 순수
로직 `.ts` 44 개는 그대로 `fast`. 최근 머지된 PR 30 개를 넣으면 전부가 16 → 17 이다. `src/lib/**` 는 위 「안 고른 것」대로 내용으로 안 가른다.
같은 날 `ci-plan.test.ts` 가 계획이 내는 차선 전부를 `verify.yml` 의 `plan.outputs` · job `if` · `gate` 의 `needs` 와 견주게 했다 —
한쪽 이름만 바뀌면 그 job 은 늘 skipped 이고 `gate` 는 초록이라, 전에는 `audit` 하나만 견줬다.

## 추기 (2026-10-01, 운영자 승인) — 「경로마다 `authed` 차선을 골라 켜기」를 소스에서 뽑는 대응으로 골랐다

위 「안 고른 것」 둘째를 고른다. 안 고른 까닭은 둘이었다 — 손으로 적은 「이 경로는 저 차선」은 파일이 옮겨지는 날 거짓이
되고, 관문 · 로그인 확인은 모든 차선이 밟는다. 그런데 입구 하나만 바뀌어도 전부라서, `app/me/(shelf)/readings/compat/page.tsx`
한 줄을 고친 PR 도 그 주소를 여는 시험이 `e2e/signed-in.spec.ts` 하나뿐인데 로그인 일곱 · 흐름 · 익명을 다 기다렸다. 그래서
두 까닭에 각각 답하고 고른다(`scripts/ci-plan.mjs` 「그 주소에 실제로 닿는 차선만」).

- **모든 차선이 밟는 자리는 공용 위험으로 먼저 거른다.** 바뀐 파일 전체를 주소 대응보다 먼저 훑어, 하나라도 들면 전부다 —
  관문 · 인증 · `layout` · `route.ts` · 서버 액션 · spec 이 아닌 `e2e/**` · 시험 도구, 그리고 Next 의 공용 경계(`global-error` ·
  `global-not-found` · `forbidden` · `unauthorized` · 뿌리의 `instrumentation` · `instrumentation-client` · `middleware`). #284 는
  지금 규칙에서도 `layout` 으로 전부다.
- **대응을 손으로 적지 않고 소스에서 뽑는다.** 입구 파일의 주소는 경로에서(`(group)` · `@slot` 걷음, `[x]` 한 마디, `[...x]`
  나머지, `page` 밖은 그 아래 전부), 시험이 요청하는 주소는 `e2e/*.spec.ts` · `scripts/check-*.mjs` 의 주석 줄을 뺀 따옴표 ·
  백틱 속 `/…` 에서, spec 과 차선은 `package.json` 의 `test:e2e:<차선>` 과 `playwright.config.ts` 의 `AUTHED` · `NOTICE` 무늬에서
  읽는다. 파일이 옮겨지면 대응도 함께 옮는다.
- **모르면 전부다.** 주소를 못 뽑는 입구(서버에 닿는 `.ts` · 관문이 부르는 파일), 닿는 시험이 0 인 화면, 로그인 무늬인데 부르는
  차선이 없는 spec, 알려진 자리가 아닌 파일(ADR 0097 추기 같은 날)은 전부로 간다.

예: `app/me/(shelf)/readings/compat/page.tsx` → `core` + signed-in 둘. `app/me/people/page.tsx` → `core` + `anon`(`auth.spec.ts` 가
`/me/people` 을 요청한다) + signed-in 둘 + match 둘 + `flow`. 잰 값: 옛 규칙에서 한 파일로 전부였던 382 개 중 61 개가 좁혀진다.
job 이름도 뜻대로 바꿨다 — `fast` → `core`, `verify` → `anon`(익명 e2e 만), 익명 artifact 는 `anon-test-results`.

**대가** — 시험이 주소를 문자열로 적지 않고 링크를 눌러 닿는 화면은 그 시험에 안 잡힌다. 그 붉음은 전처럼 머지 뒤 main 의
전체가 잡는다. 시험(`ci-plan.test.ts`)이 공용 위험의 갈래마다 전부로 가는지(까닭의 갈래 이름까지), 차선 스크립트가 부르는
spec 이 모두 로그인 무늬에 드는지, 주석 속 주소를 안 세는지, 모르는 파일이 전부인지 잰다.
