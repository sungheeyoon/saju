# 층과 방향

이 저장소가 무엇을 하는지는 `docs/prd.md` 가, 낱말은 `CONTEXT.md` 가 답한다. 이 문서는
**코드가 어디에 살고 무엇이 무엇을 불러도 되는가** 하나만 답한다. 여기 적힌 규칙 중 린트가
잠근 것은 `eslint.config.mjs` 에 같은 이름으로 있다(ADR 0085) — 문서와 린트가 어긋나면
**린트가 맞다.** 문서를 고친다.

## 층 넷

| 층 | 자리 | 아는 것 | 모르는 것 |
| --- | --- | --- | --- |
| **엔진** | `src/lib/saju/` | 자기 자신뿐 | 다른 lib · app · React/Next · supabase · 실행 환경(`node:*`) |
| **도메인 lib** | `src/lib/{input,reading,discovery,matching,consent,people,profile,account,survey,db}/` | 엔진, 서로(아래 표) | app · React/Next · supabase 런타임 · 모델 SDK · 실행 환경 |
| **문과 액션** | `app/**/*.ts` | 도메인 lib, 엔진, supabase 클라이언트 넷 | — |
| **화면** | `app/**/*.tsx` | 문과 액션, 도메인 lib 의 타입·순수 함수 | **DB 호출**(`.rpc()`·`.from()`) |

방향은 아래로만 흐른다. 엔진 ← 도메인 lib ← 문·액션 ← 화면. 거꾸로 부르는 자리는 린트가
막는다.

**도메인 lib 끼리** 지금 부르는 것은 셋뿐이다 — `input`→`saju`, `matching`→`discovery`,
`reading`→`saju`·`discovery`. 새 방향을 열 때는 여기에 적는다.

**`src/lib/db` 는 타입만 낸다.** 생성된 `Database` 와 `rpcArgs` 다(ADR 0078). 호출은 없다.

**예외 둘**은 이름이 말한다 — `src/lib/local-env.ts` 와 `*.live.test.ts` 는 실행 환경과
운영 DB 를 안다. 잠긴 시험이라 CI 에서 안 돈다. 그래도 app 은 모른다.

## 문 — DB 를 부르는 자리

**화면은 DB 를 부르지 않는다.** `.rpc()` 와 `.from()` 은 `.ts` 모듈 안에 산다(ADR 0072·0078).
그 모듈이 **문**이다 — `CONTEXT.md` 의 「읽는 문」. 화면은 클라이언트를 만들어 문에 **넘길
수는 있다**(`person-input.ts` 가 그렇게 받는다). 부르는 것은 문이 한다.

| 무엇 | 자리 | 예 |
| --- | --- | --- |
| 읽는 문 | 화면 폴더의 `.ts` | `app/me/person-input.ts` · `app/me/reading/current.ts` · `app/me/requests/inbox.ts` |
| 서버 액션 | `actions.ts`(`'use server'`) | `app/me/actions.ts` · `app/me/requests/actions.ts` |
| 라우트 | `route.ts` | `app/api/cron/reading/route.ts` · `app/me/photo/[userId]/route.ts` |
| 클라이언트 넷 | 이름으로 갈린다 | `app/auth/server-client.ts`(쿠키) · `app/auth/browser-client.ts` · `app/keyed-client.ts`(열쇠, ADR 0010) · `app/share/public-client.ts`(로그인 없음) |

문 파일에 **접미사 규약은 없다.** 있으면 좋지만 서른 파일을 한 번에 옮기는 일이라 미뤘다.
새 문을 만들 때는 그 화면 폴더의 `.ts` 로 두고 이름은 **무엇을 내주는가**로 짓는다
(`inbox`·`candidates`·`current`). 「query」·「fetch」·「repository」는 안 쓴다(용어집 _Avoid_).

**문이 실패를 말하는 법은 셋이다** — 본체는 `dbFailure` 로 던지고, 부속 정보는
`SkippableRead` 로 값을 내고, 성공했는데 없는 것만 `null`·`[]`·`0` 이다(ADR 0078).
`if (error) return []` 는 셋을 하나로 합치므로 쓰지 않는다.

**옛 자리 열하나.** 잠근 날(2026-09-22)에 이미 `.tsx` 안에서 DB 를 부르고 있던 화면이다.
`eslint.config.mjs` 의 `SCREENS_STILL_CALLING_DB` 가 그 목록이고, **줄어들기만 한다.**
하나를 문으로 옮기면 거기서 지운다. 새 화면은 이 목록에 못 든다.

## 그 밖의 자리

| 자리 | 무엇 | 아는 것 |
| --- | --- | --- |
| `proxy.ts` | 관문 — 레이아웃에 못 사는 판단(ADR 0041) | `src/lib/consent` · `app/auth/config` |
| `supabase/migrations/` | 표·함수·정책. **앱이 아는 DB 의 모양 전부는 여기서 생성된 `database.generated.ts` 다** | — |
| `supabase/tests/` | pgTAP — 역할을 갈아입고 「막힌다」를 잰다 | — |
| `scripts/` | 흐름 검사·생성기·UI 훑기. **화면 모듈을 안 부른다** — 주소로 두드린다 | `src/lib` |
| `e2e/` | Playwright. 같다 | `src/lib` |
| `app/me/reading/model.ts` | **모델을 부르는 유일한 자리**(ADR 0047) | `ai` · `openai` |

## 새 것을 놓을 때

- **계산이면** `src/lib/saju/`. 옵션이 갈리면 `meta` 에 적는다(README).
- **정책이면** — 점수·한도·프롬프트·문장 계약 — 그 도메인의 `src/lib/*`. DB 도 React 도 모른 채
  순수 함수로 쓴다. 시험은 `*.test.ts` 로 옆에 둔다.
- **DB 를 읽거나 쓰면** 화면 폴더의 `.ts` 문 하나. 어댑터가 snake_case 를 도메인 말로 **한 번만**
  옮긴다. `rpcArgs<'문 이름'>()` 로 인자를 짓는다.
- **누름이면** `actions.ts`. 누름과 완성이 같은 요청에 없는 일(생성)은 `pipeline`·webhook 으로
  간다(ADR 0016·0020).
- **화면이면** `.tsx`. 문에서 받은 값을 그리기만 한다. 판단이 생기면 `.ts` 로 내린다 — 그래야
  vitest 가 닿는다(ADR 0080).

## 린트가 잠근 것

| 규칙 | 어디에 | 무엇을 막나 |
| --- | --- | --- |
| `no-restricted-imports` | `src/lib/**` | `@/app/*` · React/Next · `@supabase/*` · `ai`/`openai` · `node:*` |
| `no-restricted-imports` | `src/lib/saju/**` | 위 전부 + `@/src/lib/(saju 아닌 것)` |
| `no-restricted-imports` | `scripts/**` · `e2e/**` | `@/app/*` |
| `no-restricted-syntax` | `app/**/*.tsx` (옛 자리 열하나 제외) | `.rpc()` · `.from()` |

2026-09-22 에 잠그기 전 값: 방향 위반 0건, 화면 안 DB 호출 열한 파일. 규칙 아홉이 실제로
걸리는지는 일부러 어긴 파일 넷으로 확인하고 지웠다(ADR 0085).

**잠그지 않은 것** — 도메인 lib 끼리의 방향(셋뿐이라 표로만), 문 파일의 접미사, `app` 안
화면끼리의 import. 위반이 생기면 그때 잰다.
