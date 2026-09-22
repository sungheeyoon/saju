# 층은 문서가 아니라 린트가 지킨다

## 무엇이 흩어져 있었나

층은 있었다. README 가 「React/Next 의존성은 `app/` 에만 있다. `src/lib/saju` 는 순수
TypeScript 다」라고 적었고, ADR 0072·0078 이 「읽는 문」을 정했고, `src/lib/db/index.ts`
머리말이 「`src/lib` 은 supabase 를 부르지 않는다(런타임 의존 0건)」고 적었다.

2026-09-22 에 재어 보니 **그 말은 전부 참이었다.**

| 방향 | 건수 |
| --- | --- |
| `src/lib` → `@/app` | 0 |
| `src/lib/saju` → 다른 `src/lib` | 0 |
| `src/lib` → `@supabase/*` 런타임 | 0 (잠긴 시험 하나 제외) |
| `src/lib` → React/Next | 0 |
| `scripts`·`e2e` → `@/app` | 0 |

그런데 **그것을 막는 규칙이 한 줄도 없었다.** `eslint.config.mjs` 는 next 기본 둘과
Playwright 예외 하나뿐이었다. 지켜진 것은 사람이 알고 있어서였고, 에이전트는 세션마다
새로 배운다. 문서에만 있는 층은 「이 경로가 저 층에 안 걸린다」는 문장과 같다 — 파일이
옮겨지는 날 조용히 거짓이 된다(ADR 0082 가 CI 경로 규칙에 대해 같은 말을 했다).

하나는 참이 아니었다. 「화면은 DB 를 부르지 않는다」 — `.rpc()`·`.from()` 을 부르는
파일 마흔 중 **열한 개가 `.tsx`** 였다. ADR 0072 가 여섯 화면의 `select` 를 문 하나로 모은
뒤에도, 새 화면이 다시 `.from('person')` 을 안에 적는 것을 막는 자리가 없었다.

## 정한 것

**이미 참인 것을 값으로 잠근다.** 새 층을 정하지 않는다. `docs/architecture.md` 가 층 넷과
방향을 한 장으로 적고, `eslint.config.mjs` 가 같은 규칙을 든다. 둘이 어긋나면 린트가 맞다.

| 규칙 | 어디에 | 막는 것 |
| --- | --- | --- |
| `no-restricted-imports` | `src/lib/**` | `@/app/*` · `next`·`react` · `@supabase/*` · `ai`·`openai` · `node:*` |
| `no-restricted-imports` | `src/lib/saju/**` | 위 전부 + `^@/src/lib/(?!saju)` |
| `no-restricted-imports` | `scripts/**` · `e2e/**` | `@/app/*` |
| `no-restricted-syntax` | `app/**/*.tsx` | `CallExpression` 의 `.rpc()` · `.from()` |

**예외는 이름이 말한다.** `src/lib/local-env.ts` 와 `*.live.test.ts` 는 실행 환경과 운영
DB 를 안다 — 그래서 `node:*`·`@supabase/*` 가 열린다. 그래도 `@/app` 은 닫혀 있다. 예외를
파일 이름이 아니라 주석으로 두면 다음 예외가 옆에 붙는다.

**`.from()` 은 객체 이름으로 거른다.** `Array.from`·`Buffer.from` 과 이름이 같다. 셀렉터가
`callee.object.name` 이 `Array`·`Buffer`·`Promise` 등이면 지나간다. 변수 이름이 `Array` 인
supabase 클라이언트는 없다.

## 옛 자리는 좁히기만 한다

화면 안에서 DB 를 부르던 열한 파일을 **이번에 옮기지 않았다.** 옮기는 일은 화면마다
문을 하나씩 세우는 일이고, 그 화면 여럿을 다른 작업이 같은 날 만지고 있었다(후보 D).
함께 옮기면 충돌이고, 안 잠그면 열둘째가 생긴다.

그래서 `SCREENS_STILL_CALLING_DB` 에 **그 열하나를 이름으로 적고** 규칙에서 뺐다.
목록은 **줄어들기만 한다** — 하나를 문으로 옮기면 거기서 지우고, 새 화면은 못 든다.
ADR 0074 의 컷 표와 같은 결이다: 잠금은 옛 상태를 되살려 증명하고, 목록이 늘면 잠금이
아니다. 열한 화면을 옮기는 일은 따로 잰다 — 모두 `page.tsx` 라 서버 컴포넌트 안의
`await supabase.from(...)` 한두 줄이고, 옮길 곳은 같은 폴더의 `.ts` 다.

`app/me/readings/[subject]/page.tsx` 는 대괄호를 벗겨 적는다 — glob 의 문자 집합이라
그냥 적으면 **안 걸리는 것이 아니라 안 빠진다.** 첫 실행이 그 파일 하나로 빨개졌다.

## 잠금은 어겨서 증명했다

규칙 아홉이 실제로 걸리는지를 **일부러 어긴 파일 넷**으로 쟀다 — 엔진 안에서 `@/app`·
다른 lib·`node:fs`·`@supabase`·`react` 를 부르는 것, 도메인 lib 에서 `@/app` 을 부르는 것,
`.tsx` 안에서 `.rpc()`·`.from()`·`Array.from()` 을 부르는 것, e2e 에서 `@/app` 을 부르는 것.
아홉 오류가 서고 `Array.from` 은 지나갔다. 파일은 지웠다. 저장소 전체는 오류 0, 경고 2
(기존).

주석이 없는 시험을 적던 실수(ADR 0074)를 여기서 되풀이하지 않으려는 것이다 — 「규칙을
넣었다」와 「규칙이 건다」는 다른 문장이다.

## 잠그지 않은 것

- **도메인 lib 끼리의 방향.** 지금 셋뿐이라(`input`→`saju`, `matching`→`discovery`,
  `reading`→`saju`·`discovery`) 표로만 적었다. 넷째가 생기면 그때 규칙으로 올린다.
- **문 파일의 접미사.** `inbox.ts`·`current.ts`·`candidates.ts` 처럼 무엇을 내주는가로
  짓는 규약만 적었다. 서른 파일을 한 번에 옮기는 일이라 이름 규약은 미뤘다.
- **`app` 안 화면끼리의 import.** 위반이 없어 재지 않았다.
- **DB 호출이 `.ts` 어디에나 있어도 되는가.** 지금은 그렇다. 「문」과 「액션」과 「그 밖의
  `.ts`」를 가르는 것은 접미사 규약이 서야 가능하다.

## 결과

`eslint.config.mjs` 규칙 블록 다섯, `docs/architecture.md` 한 장, `CLAUDE.md` 에 입구 한 줄.
코드는 한 줄도 안 바뀌었다 — 잠근 것이 이미 참이었기 때문이다.
