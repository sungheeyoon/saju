# 층은 문서가 아니라 시험과 린트가 지킨다

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

## 정정 (2026-09-22, 같은 날) — 첫 판은 네 자리에서 좁았다

머지 직후 검토가 넷을 잡았고, 넷 다 재어 보니 맞았다.

**1. 별칭만 막았다.** `no-restricted-imports` 의 패턴은 import 문자열을 본다. `@/app/*` 는
걸리고 `../../../app/*` 는 지나갔다. 동적 `import()` 는 그 규칙이 아예 안 본다. `node:*` 는
걸리고 `crypto` 는 지나갔다. 그리고 「잠근 것이 이미 참이었다」도 틀렸다 —
`src/lib/reading/call.live.test.ts` 가 `app/me/reading/model` 을 **동적으로** 부르고 있었다.

경로는 `import/no-restricted-paths` 로 바꿨다. 파일로 풀어서 보므로 별칭·상대경로·`import()`
가 같은 답을 낸다. 패키지는 `no-restricted-imports` 그대로 두되 Node 내장은
`builtinModules` 전부를 **`/` 로 앵커해** 적었다 — 앵커 없이 `constants` 를 적으면 gitignore
문법이라 엔진의 `../constants` 폴더까지 걸려 66건이 빨개졌다. 라이브 시험은 app 의 것을
부르므로 `app/me/reading/` 으로 옮겼다.

그리고 **린트 위에 시험을 하나 뒀다** — `scripts/layers.test.ts`. import 문 네 형태를 문자열로
집어 파일로 풀고 규칙마다 단언 하나를 둔다. 린트는 규칙마다 사각이 있고, 그 사각은 린트를
읽어서는 안 보인다. 시험은 「빈 목록으로 통과」를 막으려고 파일 수와 edge 수의 하한을 먼저
단언한다(ADR 0079).

**2. 도메인 그래프가 틀렸다.** 「셋뿐」은 별칭 import 만 센 수였다. 상대경로까지 세니
**여덟**이고, `discovery ↔ matching` 이 서로를 불렀다 — 파일 순환은 아니었지만(`discovery`
가 부른 것은 `matching/elementAxes` 한 파일) 소유가 양쪽으로 흘렀다. 축 둘은 `discovery-v1`
의 것이라 `elementAxes` 를 `discovery/` 로 옮겼다. 이제 `matching → discovery` 하나다.
시험은 그래프가 허용 목록과 **정확히 같은가**를 잰다 — 같지 않으면 목록과 문서를 함께 고친다.

**3. 파일 단위 예외는 호출 수를 못 막았다.** 열한 파일을 통째로 뺐으니 그 파일의 열넷째
호출은 자유였다. 이제 **호출마다** `eslint-disable-next-line` 이 그 줄 위에 서고, 시험이
표시의 수(13)와 **표시 아래에 실제 `.rpc()`·`.from()` 이 있는가**를 잰다. 같은 파일의 새
호출도 걸린다.

**4. 「4층을 잠갔다」는 과했다.** 보장하는 것은 역방향 import 와 화면 안의 새 DB 호출이다.
문이 깊은지 — 어댑터가 한 번만 옮기는지, 실패를 셋으로 가르는지 — 는 안 잰다. 구문 규칙이라
`supabase['from']()` 은 지나간다. `docs/architecture.md` 가 이제 그 경계를 적는다.

검토가 없었으면 CI 초록이 사각을 가렸을 것이다 — 통과가 곧 「막는다」는 아니다.

## 정정 둘째 (2026-09-22, 같은 날) — 「같은 뜻의 다른 표기」에 아직 넷이 있었다

둘째 판 검토가 넷을 잡았고, 넷 다 재현됐다.

**1. `.mts` 가 지나갔다.** 린트 glob 도 시험의 확장자 목록도 `.ts` 만 봤는데 `tsconfig` 는
`**/*.mts` 를 포함한다. 확장자 목록을 `.ts .mts .cts .tsx .js .mjs .cjs` 로 두고 **린트와
시험이 같은 목록**을 든다(`SOURCE_EXTENSIONS`).

**2. 백틱 `import(\`…\`)` 이 지나갔다.** 시험은 따옴표만 읽는 정규식이었고
`import/no-restricted-paths` 도 그 형태를 안 푼다. 시험을 **TypeScript AST** 로 바꿔 정적 ·
`export … from` · `import()` · `require()` 를 한 자리에서 집고, 문자열 리터럴(따옴표·치환 없는
백틱)이 아닌 `import()` 대상은 **「모르는 것」으로 세어 막는다.** 린트에는
`ImportExpression > :not(Literal)` 을 걸어 애초에 못 적게 했다 — 정규식을 더 넓히는 길은
다음 표기가 또 생기는 길이다.

**3. 표시 하나가 줄 하나를 끈다.** `eslint-disable-next-line` 은 호출이 아니라 다음 줄 전체를
끄므로 같은 줄의 둘째 `.rpc()` 는 자유였고, 시험이 표시 **수**만 세어 하나를 지우고 다른 새
호출에 그 예산을 쓸 수 있었다. 이제 시험이 **호출마다 지문**(`파일 :: supabase.from('표')`)을
AST 로 뽑아 열셋의 목록과 견준다 — 목록 밖의 호출은 표시가 있어도 빨개지고, 목록에 있는데
코드에 없으면(옮기고 안 지움) 그것도 빨개진다. 표시 수와 호출 수가 같아야 한다.

**4. `db` 의 나가는 방향을 안 셌다.** 그래프 단언이 `from !== 'db'` 로 걸러 `db → reading` 을
넣어도 안 빨개졌다. 거름을 지우고 「`db` 는 나가는 방향이 없다」를 따로 단언한다 — 타입만
내는 모듈이라는 문서의 말을 시험이 든다.

덤으로 `eslint-plugin-import` 와 `eslint-import-resolver-typescript` 를 **직접 devDependency 로**
적었다 — Next 가 딸려 오는 것에 기대면 Next 가 그것을 놓는 날 린트가 조용히 죽는다.

세 판을 지나며 남은 교훈은 하나다. **「막는다」는 우회를 밟아서 증명한다** — 별칭/상대경로,
정적/동적, 따옴표/백틱, `.ts`/`.mts`, `node:fs`/`fs`, 한 줄의 둘째 호출. 각 판이 통과시킨 것은
전부 「같은 뜻의 다른 표기」였다.
