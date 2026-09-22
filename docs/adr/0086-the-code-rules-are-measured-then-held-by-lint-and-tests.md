# 코드 규칙은 잰 값에서 나오고 린트와 시험이 든다

## 무엇이 흩어져 있었나

코드를 **어떻게** 적는가를 답하는 자리가 없었다. `docs/architecture.md` 는 어디에 놓는가를,
`CONTEXT.md` 는 낱말을, `docs/prd.md` 는 무엇을 만드는가를 답하고, 린트는 next 기본 둘과
ADR 0085 의 층 규칙뿐이었다. 파일 이름 · 실패를 말하는 법 · 주석 · 탈출구 · 문구는 **사람이
알고 있어서** 지켜졌고, 에이전트는 세션마다 새로 배웠다(2026-09-22 진단, 위임 준비 3단계).

2026-09-22 에 재어 보니 **거의 전부 한 방향이었다.**

| 무엇 | 잰 값 |
| --- | --- |
| 파일 이름 | 엔진 밖은 kebab-case 전부(app 178 · scripts 23 · e2e 8), 엔진 안은 camelCase 28 · 하이픈 0 |
| `type` / `interface` | 398 / 0 |
| `enum` · `class` | 0 · 8 — 전부 내장을 잇는다(`Error` 일곱, 훑기용 시계가 `Date` 하나) |
| `export default`(app·루트 설정 밖) | 0 |
| TODO · FIXME · `any` · `@ts-ignore` | 0 · 0 · 0 · 0 |
| `console.log`(src·app) | 0 — 실호출 시험 셋만 `console.info` 로 찍는다 |
| ADR 참조 | 806 건 · 264 파일, 표기는 `ADR NNNN` 하나, 없는 파일을 가리키는 것 0 |
| import 따옴표 | 홑따옴표 1203 / 겹따옴표 4(`app/layout.tsx` 한 파일) |
| 주석 언어 | 18,415 줄 중 14,049 줄에 한글. 나머지는 인용과 명령줄 |
| 커밋 메시지 | `type(scope): 한국어 문장 (ADR NNNN) (#PR)` |

어긋난 것은 적었다. 엔진 밖에 camelCase 파일 둘(`src/lib/discovery/elementAxes.ts` 와 그
시험 — ADR 0085 정정에서 `matching/` 에서 옮기며 이름을 그대로 가져온 것), `app/layout.tsx`
의 겹따옴표 import 넷, 그리고 **타입이 못 잇는 자리를 사람이 잇는 탈출구** — `as unknown as`
여덟, `!` 열여섯, `if (error) return null` 셋(ADR 0078 이 없애자고 한 모양), 까닭 없는
`eslint-disable` 하나.

## 정한 것

**`docs/agents/code-rules.md` 한 장이 답한다.** 새 규칙을 정하지 않는다 — 잰 값을 규칙으로
적고, 문서 · 린트 · 시험이 어긋나면 **린트와 시험이 맞다.** ADR 0085 와 같은 방법이다: 재고,
잠그고, 어겨서 증명한다.

**린트가 잡을 수 있는 것은 린트가 잡는다.**

| 규칙 | 어디 | 막는 것 |
| --- | --- | --- |
| `no-restricted-syntax` `CODE_SHAPE` | 소스 전부 | `TSEnumDeclaration`, `superClass` 없는 `class` |
| `@typescript-eslint/consistent-type-definitions` | 소스 전부 | `interface` |
| `no-warning-comments` | 소스 전부 | TODO · FIXME · XXX · HACK |
| `no-console` | `src/` · `app/` · `proxy.ts`, `*.live.test.ts` 제외 | `console.log` |
| `import/no-default-export` | `src/` · `scripts/` · `e2e/` | `export default` |
| `linterOptions.reportUnusedDisableDirectives` | 전부 | 안 걸리는 예외 표시 |

`CODE_SHAPE` 는 `no-restricted-syntax` 의 몫이라 **이미 그 규칙을 든 블록마다** 얹었다 — 이
규칙은 블록끼리 합쳐지지 않고 덮어써서, 따로 블록을 두면 층 규칙의 셀렉터가 지워진다.
`proxy.ts` 는 어느 블록에도 없어서 화면 폴더의 `.ts` 블록에 넣었다.

**린트가 못 보는 것은 시험이 든다** — `scripts/code-rules.test.ts`. 파일 · 폴더 이름의 두 규약,
시험의 자리와 중간 이름 넷, 마이그레이션 · pgTAP · ADR 의 이름과 번호, **ADR 참조 806 건이
실제 파일을 가리키는가**, import 의 홑따옴표. 그리고 **탈출구의 지문**.

**탈출구는 지문으로 잠그고 줄어들기만 한다.** `as unknown as` 여덟, `!` 열여섯,
`if (error) return null` 셋, 화면 DB 호출 밖의 `eslint-disable` 여섯, 까닭 없는 표시 하나,
`Error` 가 아닌 것을 잇는 `class` 하나 — 각각 `파일 :: 코드` 로 적혀 있고, 목록 밖의 새 자리도
목록에만 남은 옛 자리도 빨개진다. ADR 0085 §3 의 화면 DB 호출과 같은 결이다. **같은 지문이
둘이면 목록에도 둘을 적는다** — 집합으로 견주면 셋째가 둘째의 이름으로 지나간다. 첫 판이
그렇게 적혀 있었고, 같은 파일의 `candidates.find(…)!` 셋을 보고 다중집합으로 바꿨다.

**예외는 이름이 말한다**(ADR 0085). `*.live.test.ts` 는 사람이 읽으려고 돌리므로 `console`
을 쓴다. 엔진 폴더(`src/lib/saju/`)는 camelCase 다.

**엔진의 camelCase 는 그대로 둔다.** 스물여덟 파일을 옮기는 일은 값이 없고, 위임에 필요한 것은
「어느 규약인가」가 아니라 **한 폴더에 둘이 섞이지 않는 것**이다. 그래서 양쪽을 다 잠갔다 —
엔진 밖의 camelCase 도, 엔진 안의 kebab-case 도 빨개진다. 엔진 밖에 있던 둘은 옮겼다
(`element-axes.ts`).

**`class` 는 「`Error` 를 잇는 것만」이 아니라 「내장을 잇는 것만」이다.** 첫 셀렉터는
`superClass.name='Error'` 였는데 `scripts/fake-clock.mjs` 의 `Shifted extends Real`(= `Date`)
이 걸렸다. 린트는 「부모가 없는 클래스」를 막고, 부모가 `Error` 가 아닌 것은 시험이 이름으로
든다. 막으려는 것은 상속이 아니라 **상태를 가진 클래스** — 그 안의 판단은 vitest 가 닿기 어렵다
(ADR 0080 의 같은 결).

## 잠금은 어겨서 증명했다

**린트** — 일부러 어긴 파일 넷과 `proxy.ts` 끝에 붙인 `enum` 으로 쟀다. `enum` · `interface` ·
`class Bag {}` · 클래스 식 · `console.log` · TODO · FIXME · `export default` · 안 걸리는
`eslint-disable` — **열다섯 오류**가 섰고, `class ProbeError extends Error` 와 `scripts/` 의
`console.log` 는 지나갔다. 파일은 지우고 `proxy.ts` 는 되돌렸다.

**시험** — 엔진 밖의 `probeFile.tsx`, 엔진 안의 `probe-file.ts`, 그리고 파일째 끄는
`/* eslint-disable */` · 겹따옴표 import · 없는 번호를 가리키는 ADR 참조 · 하이픈으로 이은 ADR 표기 · `if (error) return []` · 새
`!` · 새 `as unknown as` 둘을 한 파일에 적었다. **단언 아홉이 빨개졌고** 각각이 그 줄을
이름으로 짚었다. 파일은 지웠다.

시험 자신도 세 번 걸렸다 — 시험 제목 · 규칙 문서 · 이 ADR 에 적은 어긋난 표기의 **본보기**를 표기
검사가 잡았다. 린트도 이 시험의 머리말을 잡았다 — 미결 표시를 막는다고 설명하느라 그 낱말을
적었다. 본보기는 말로 풀어 적었다. **규칙을 설명하는 글이 규칙에 걸리는 것**은 검사가 실제로
읽고 있다는 뜻이라 규칙을 무르지 않았다.

## 고친 것

코드 셋뿐이다. `elementAxes.ts` · `elementAxes.test.ts` → `element-axes.ts` · `element-axes.test.ts`
(부르는 다섯 파일과 주석 둘), `app/layout.tsx` 의 import 넷을 홑따옴표로. 나머지는 잠근 것이
이미 참이었다.

## 잠그지 않은 것

- **식별자에 새는 용어집 낱말** — `isSelf` 여섯 화면, `revision` 을 든 DB 함수 이름 둘,
  엔진의 `birthDate`. 규칙은 문서에 적고 자리는 「알려진 어긋남」에 적었다. 고치는 일은
  CONTEXT.md 재편(용어 ↔ 코드 식별자 대조표)과 함께 잰다.
- **따옴표 전부.** 코어 `quotes` 규칙은 ESLint 9 에서 deprecated 이고 10 에서 사라진다.
  `@stylistic` 을 들이는 것은 이 한 규칙에 값이 크다. import 만 AST 로 든다.
- **주석의 언어, 파일 머리말의 유무, 상수의 SCREAMING_CASE, 화면 문구 규칙 전부** — 사람이 본다.
- **문 파일의 접미사** — ADR 0085 그대로.

## 앞선 결정과의 관계

- **ADR 0085** — 같은 방법(재고 → 잠그고 → 어겨서 증명)이고 `CODE_SHAPE` 는 그 블록들 위에
  얹혔다. 「예외는 이름이 말한다」도 그대로다
- **ADR 0078** — 그대로. 실패 셋을 문서가 다시 적고, 그 모양을 어기는 세 자리는 지문으로 잠겼다
- **ADR 0073** — 그대로. 금지어 표는 문서가 가리킬 뿐, 표도 프롬프트도 안 바뀌었다
- **ADR 0079** — 그대로. 모든 부재 단언 앞에 모집단의 하한이 선다
- **ADR 0080** — `class` 를 막는 근거. `await` 에 붙은 판단처럼, 상태를 가진 클래스 안의 판단도
  시험 사정권 밖으로 간다
