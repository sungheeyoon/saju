# 관문 · 화면의 입구 · 인증을 바꾼 PR 은 공개 출시 전에도 머지 전에 전부 돈다

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
