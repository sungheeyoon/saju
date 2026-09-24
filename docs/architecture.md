# 층과 방향

이 저장소가 무엇을 하는지는 `docs/prd.md` 가, 낱말은 `CONTEXT.md` 가 답한다. 이 문서는
**코드가 어디에 살고 무엇이 무엇을 불러도 되는가** 하나만 답한다. 여기 적힌 규칙 중 잠긴 것은
`scripts/layers.test.ts` 와 `eslint.config.mjs` 에 같은 표로 있다(ADR 0085) — 문서와 시험이
어긋나면 **시험이 맞다.** 문서를 고친다.

## 층 넷

| 층 | 자리 | 아는 것 | 모르는 것 |
| --- | --- | --- | --- |
| **엔진** | `src/lib/saju/` | 자기 자신뿐 | 다른 lib · app · React/Next · supabase · 실행 환경(`node:*`) |
| **도메인 lib** | `src/lib/{input,reading,discovery,matching,consent,people,profile,account,survey,chat,presence,brand,db}/` | 엔진, 서로(아래 표) | app · React/Next · supabase 런타임 · 모델 SDK · 실행 환경 |
| **문과 액션** | `app/**/*.ts` | 도메인 lib, 엔진, supabase 클라이언트 넷 | — |
| **화면** | `app/**/*.tsx` | 문과 액션, 도메인 lib 의 타입·순수 함수 | **DB 호출**(`.rpc()`·`.from()`) |

방향은 아래로만 흐른다. 엔진 ← 도메인 lib ← 문·액션 ← 화면. 거꾸로 부르는 자리는 린트와
`scripts/layers.test.ts` 가 막는다 — 별칭이든 상대경로든 따옴표 `import()` 든 같은 파일이면 같은
답이다. **`import()` 의 대상은 따옴표 문자열로만 적는다** — 백틱·변수·식은 검사가 못 읽으므로
`src/lib`·`scripts`·`e2e`·`app/**/*.ts` 에서 금지다. 읽는 확장자는 `.ts .mts .cts .tsx .js .mjs .cjs`
로, 린트와 시험이 같은 목록을 든다.

**도메인 lib 끼리 지금 열려 있는 방향은 열둘이다.** `scripts/layers.test.ts` 의 허용 목록과
같은 표이고, 새 방향을 열면 둘을 함께 고친다. 순환은 없다 — `discovery ↔ matching` 이 서로를
부르던 것을 2026-09-22 에 축 파일(`element-axes`)을 `discovery` 로 옮겨 끊었다.

| 부르는 쪽 | 부르는 것 |
| --- | --- |
| `consent` | `discovery` · `presence` · `reading` · `saju` |
| `discovery` | `saju` |
| `input` | `saju` · `local-env` |
| `matching` | `discovery` · `saju` |
| `reading` | `discovery` · `people` · `saju` |

**`src/lib/db` 는 타입만 낸다.** 생성된 `Database` 와 `rpcArgs` 다(ADR 0078). 호출은 없다.

**예외 둘**은 이름이 말한다 — `src/lib/local-env.ts` 와 `*.live.test.ts` 는 실행 환경과
운영 DB 를 안다. 잠긴 시험이라 CI 에서 안 돈다. 그래도 app 은 모른다. 모델을 실호출하는
시험(`call.live.test.ts`)은 app 의 `model.ts` 를 부르므로 **app 쪽에 산다**(`app/me/reading/`).

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

**옛 자리 열.** 잠근 날(2026-09-22)에 열셋이었고, 2026-09-23 에 `discovery_profile` 둘이 문(`app/me/discovery/discovery-profile.ts`)으로, 2026-09-24 에 홈의 엣지 읽기가 문(`app/me/home/circle.ts`)으로 옮겼다. 잠근 날 이미 `.tsx` 안에서 DB 를 부르고 있던 호출이다.
**호출 하나마다** 그 줄 위에 `eslint-disable-next-line no-restricted-syntax` 가 붙어 있고,
`scripts/layers.test.ts` 가 **호출의 지문**(`파일 :: supabase.from('표')`)을 목록으로 든다 —
**줄어들기만 한다.** 하나를 문으로 옮기면 표시와 지문을 함께 지운다. 표시는 줄 하나를 통째로
끄므로 같은 줄의 둘째 호출은 린트를 지나가지만 지문 목록에 없어 시험에서 빨개진다. 지문 수와
표시 수가 같아야 하므로 지운 자리의 예산을 새 호출이 쓸 수도 없다.

## 그 밖의 자리

| 자리 | 무엇 | 아는 것 |
| --- | --- | --- |
| `proxy.ts` | 관문 — 레이아웃에 못 사는 판단(ADR 0041) | `src/lib/consent` · `app/auth/config` |
| `supabase/migrations/` | 표·함수·정책. **앱이 아는 DB 의 모양 전부는 여기서 생성된 `database.generated.ts` 다** | — |
| `supabase/tests/` | pgTAP — 역할을 갈아입고 「막힌다」를 잰다 | — |
| `scripts/` | 흐름 검사·생성기·UI 훑기. **화면 모듈을 안 부른다** — 주소로 두드린다 | `src/lib` |
| `e2e/` | Playwright. 같다 | `src/lib` |
| `app/me/reading/model.ts` | **모델을 부르는 유일한 자리**(ADR 0047) | `ai` · `openai` |
| 비밀을 읽는 모듈 | `app/keyed-client.ts` · `app/me/reading/model.ts` · `app/api/cron/reading/route.ts` · `app/api/cron/audit-export/route.ts`(접속기록 반출, ADR 0105) · `app/api/portone/webhook/route.ts`(결제 알림, G-23 ⑥) — 첫 줄이 `import 'server-only'` 라 화면 층이 부르면 빌드가 선다. 새 비밀은 `scripts/secret-env.mjs` 의 갈래에 먼저 서고, `scripts/secret-env.test.ts` 가 둘을 견준다(G-23 ⑧) | 서버 환경변수 |

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

## 무엇이 잠겨 있나 — 그리고 무엇이 아닌가

두 자리가 같은 표를 든다. 린트는 편집기에서 알려 주고, 시험은 CI 에서 잠근다.

| 무엇 | 린트 (`eslint.config.mjs`) | 시험 (`scripts/layers.test.ts`) |
| --- | --- | --- |
| `src/lib` → `app`·`proxy.ts` | `import/no-restricted-paths` (파일로 푼다) | 다섯 형태의 import 전부(정적 · `export … from` · `import()` · `require()` · 타입 자리의 `import('…').X`), 확장자를 뗀 대상 |
| `src/lib/saju` → 다른 lib | 같다 | 같다 |
| `scripts`·`e2e` → `app` | 같다 | 같다 |
| `src/lib` → React/Next · `@supabase` · 모델 SDK · Node 내장 | `no-restricted-imports` (패키지 이름) | 같다 |
| 문자열이 아닌 `import()` 대상 | `no-restricted-syntax` | 대상을 모르는 import 0건 |
| 도메인 lib 끼리의 방향 | — | 허용 목록과 **정확히 같은가**, 순환 없는가, `db` 는 나가는 방향 0 |
| 화면(`.tsx`) 안의 `.rpc()`·`.from()` | `no-restricted-syntax` | 호출 지문이 옛 자리 열 안에만, 표시 수 = 호출 수 |

**보장하는 것은 여기까지다** — 역방향 import 와 화면 안의 새 DB 호출을 막는다. 아래는 **안**
보장한다.

- 문이 snake_case 를 한 번만 옮기는지, 실패를 셋으로 가르는지, 도메인 타입만 내주는지. 그것은
  ADR 0072·0078 의 규약이고 코드 리뷰가 본다. `.from()` 한 줄을 `.ts` 로 옮기기만 해도 린트는
  만족한다 — 그것은 문이 아니라 자리 옮기기다.
- `supabase['from']()` · 구조분해한 `from` · 감싼 함수는 구문 규칙을 지나간다. 이 규칙은 뜻이
  아니라 구문을 본다.
- 문 파일의 접미사, `app` 안 화면끼리의 import, `.ts` 어디에 DB 호출이 있어도 되는가.

2026-09-22 첫 판은 별칭의 정적 import 만 막아 상대경로·`import()`·`crypto` 같은 접두사 없는
내장 모듈이 지나갔고, 문서의 도메인 그래프가 셋이라 적혔는데 실제는 여덟이었으며, 파일 단위
예외는 같은 파일의 새 호출을 못 막았다. 둘째 판은 `.mts` 와 백틱 `import()` 가 지나갔고 표시
수만 세어 같은 줄의 둘째 호출을 못 봤다. 같은 날 검토 두 번이 잡아 위 표로 고쳤다(ADR 0085 §정정).
