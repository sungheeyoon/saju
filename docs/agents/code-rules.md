# 코드 규칙

이 문서는 **코드를 어떻게 적는가** 하나만 답한다 — 이름, 실패를 말하는 법, 주석과 ADR 참조,
탈출구, 화면 문구, 금지어. 어디에 놓는가는 `docs/architecture.md` 가, 낱말은 `CONTEXT.md` 가,
무엇을 만드는가는 `docs/prd.md` 가 답한다.

여기 적힌 것은 정한 규칙이 아니라 **2026-09-22 에 잰 값**이다(ADR 0086). 린트가 잡을 수 있는
것은 `eslint.config.mjs` 가 잡고, 못 잡는 것(파일 이름 · ADR 참조 · 탈출구의 지문)은
`scripts/code-rules.test.ts` 가 든다. 문서와 둘이 어긋나면 **린트와 시험이 맞다.** 문서를 고친다.

## 이름

| 무엇 | 규칙 | 잰 값 |
| --- | --- | --- |
| 파일 — 엔진 밖 | **kebab-case** — `person-input.ts` · `db-error.boundary.test.ts` · `check-share.mjs` | app 178 · lib 61 · scripts 23 · e2e 8, 전부 |
| 파일 — 엔진 안 `src/lib/saju/` | **camelCase** — `solarTerms.ts` · `timeCorrection/`. 옛 규약이고 그대로 둔다. 한 폴더에 두 규약을 섞지 않는다 | 119 중 camel 28, 하이픈 0 |
| 폴더 | 파일과 같다. Next 의 `[userId]` · `(group)` 은 그대로 | |
| 시험 | 소스 **옆에** `*.test.ts`. 중간 이름은 넷 — `.live`(운영·환경을 두드린다, CI 밖) · `.boundary`(여러 파일을 훑는 장부) · `.external`(외부 사례 대조) · `.generated`(생성 표). e2e 는 `e2e/*.spec.ts`. `__tests__` 폴더는 없다 | 102 · 6 |
| pgTAP · 마이그레이션 | `NN_snake.test.sql` · `YYYYMMDDHHMMSS_english_sentence.sql` — 이름이 **문장**이다(`the_revision_store_is_gone`) | 33 · 81 |
| ADR | `NNNN-english-sentence.md`, 제목은 한국어 문장, 번호는 빈틈없이 | 85 |
| 타입 | `type`, PascalCase. `interface` 는 안 쓴다 | 398 / 0 |
| 값 | 정책 표·상수는 SCREAMING_CASE(`STRENGTH_POLICY` · `HOUR_UNKNOWN_LABEL`), 함수는 camelCase. Next 가 이름을 정한 것(`metadata` · `maxDuration`)만 예외 | 336 · 63 |
| `enum` · `class` | `enum` 은 없다 — 문자열 리터럴 유니언이다. `class` 는 내장을 잇는 자리뿐(`InvalidSajuInputError extends Error`) — 상태를 가진 클래스는 없다 | 0 · 8 |
| export | 이름 있는 export. `export default` 는 Next 가 요구하는 `app/` 과 루트 설정 파일에만 | src·scripts·e2e 0 |
| 따옴표 | 홑따옴표 | import 1203 / 0 |

**식별자는 영어, 뜻은 용어집.** `CONTEXT.md` 의 _Avoid_ 는 화면 문구만이 아니라 식별자에도
적용된다 — DB 를 읽는 함수는 **문**이지 `query` · `fetch` · `repository` 가 아니고, 이름은
**무엇을 내주는가**로 짓는다(`inbox` · `current` · `candidates`). 사람은 `selfPerson` 이지
`isSelf` 가 아니다. 지금 새어 있는 자리는 아래 「알려진 어긋남」에 있다.

## 실패를 말하는 법

**문(DB 를 읽는 `.ts`)은 셋으로 가른다**(ADR 0078, `docs/architecture.md`).

| 무엇 | 어떻게 | 어디서 |
| --- | --- | --- |
| 없으면 화면의 뜻이 무너지는 **본체** | `throw dbFailure(error, '문 이름')` — 오류 경계가 받는다 | `app/db-error.ts` |
| 없어도 본체가 서는 **부속 정보** | `SkippableRead` 로 값을 낸다(`read` / `unread`) — 화면이 그 자리만 비운다 | 같은 곳 |
| 문은 성공했고 자료가 없음 | `null` · `[]` · `0` | |

**서버 액션은 값으로 낸다** — `{ ok: false, message: userFacingDbMessage(error, '문 이름') }`.
폼이 그 문장을 세운다.

넷 다 한 가지를 지킨다: **`error.message` 를 사용자에게 그대로 내지 않는다.** 우리가 쓴 한국어
거절만 옮기고 나머지는 `console.error` 로 기록에 보낸다 — `app/db-error.boundary.test.ts` 가
모든 파일을 훑는다(#67). `if (error) return null` 은 「DB 실패」와 「없음」을 한 값으로 합치므로
새로 쓰지 않는다. 남은 셋은 지문으로 잠겨 있다.

**엔진과 도메인 lib** 은 DB 를 모르므로 다르다 — 사용자가 고칠 수 있는 것은 **값**으로
(`hour: null` · `unresolved` · `candidate`), 고칠 수 없는 것은 **예외**로(`InvalidSajuInputError`).
`CONTEXT.md` 「입력」 항목이 그 경계다.

**`console`** — 앱(`src/` · `app/`)에 `console.log` 는 없다. `console.error` 는 못 옮긴 오류를
기록하는 자리 셋뿐이다. 찍어 보는 자리는 `scripts/` 와, 사람이 읽으려고 돌리는 `*.live.test.ts` 다.

## 주석과 ADR 참조

- **주석은 한국어 산문**이다. 식별자 · 인용 · 명령줄만 영어다(주석 18,415 줄 중 14,049 줄에
  한글이 있고, 나머지는 인용과 명령이다).
- **파일 머리말이 「왜」를 든다** — 무엇이 흩어져 있었고 무엇을 재어 이렇게 됐는지, **수를 붙여서**
  (`537개` · `84종 중 0개`). `app/db-error.ts` 와 `eslint.config.mjs` 가 본보기다. 「무엇을 한다」는
  이름이 말하고, 주석은 이름이 못 말하는 것만 적는다.
- **결정은 `ADR NNNN` 으로 가리킨다.** 네 자리, 띄어쓰기 하나(`ADR 0078`), 여럿은 `·` 로
  (`ADR 0072·0078`). 붙여 쓰거나 하이픈으로 잇거나 자릿수를 줄이지 않는다 — 시험이 그 표기를 센다.
  806 건이 264 파일에 있고 전부 실제 파일을 가리킨다 — 시험이 이것을 든다. 이슈는 `#67` 이다.
- **TODO · FIXME 를 남기지 않는다**(0건). 미결은 ADR 의 「잠그지 않은 것」, 간극 대장
  (`docs/product/gaps.md`), 아니면 이슈다. 코드 안의 TODO 는 아무도 안 세는 목록이다.
- 시험 이름은 **참인 문장**이다 — `it('src/lib 은 app 과 관문을 모른다')`. 무엇을 잰다가 아니라
  무엇이 참이다.

## 탈출구 — 지문으로 잠겨 있고 줄어들기만 한다

타입이 못 잇는 자리를 사람이 잇는 것들이다. 없애자는 것이 아니라 **늘리지 않는다** —
2026-09-22 에 있던 자리를 `scripts/code-rules.test.ts` 가 `파일 :: 코드` 지문으로 들고, 새 자리는
그 목록에 못 든다. 하나를 고치면 목록에서 지운다(ADR 0085 §3 의 화면 DB 호출과 같은 결).
같은 지문이 둘이면 목록에도 둘을 적는다 — 셋째가 둘째의 이름으로 지나가지 않게.

| 탈출구 | 잰 값 | 대신 |
| --- | --- | --- |
| `x as unknown as T` | 8 | 생성 타입 `Database` 와 `rpcArgs`. `jsonb` 를 내주는 문만 어댑터 안에서 한 번 |
| `x!` | 16 | 좁히기(`if (x === null) return …`), 아니면 없음을 값으로 |
| `if (error) return null` | 3 | 위 「실패를 말하는 법」 |
| `eslint-disable` | 화면 DB 호출 13(층 시험이 든다) + 6 | `// eslint-disable-next-line 규칙 -- 까닭` 한 줄. 파일째 끄지 않는다. 까닭 없는 것은 하나 남았다 |
| `any` · `@ts-ignore` | 0 · 0 | 린트가 막는다 |
| 안 걸리는 예외 표시 | 0 | `reportUnusedDisableDirectives` 가 오류로 세운다 |

## 화면 문구

규칙은 여기 없다 — **`CONTEXT.md` 「화면 문구 규칙」**(마침표 · 「~ 중…」 · 합쇼체 버튼 · 한 사실
한 표기 · 한 화면 한 이름 · 늘 참인 문장은 안 세운다)과 **`docs/prd.md` §3.2**(상품 이름 넷,
버튼은 동사로 갈린다)가 답이고, ADR 0025 · 0026 · 0027 이 그 근거다.

에이전트에게는 규칙이 하나 더 있다. **한글 문구를 지어내지 않는다.** 새로 쓰거나 고칠 문구는
코드에 넣기 전에 **표로**(지금 글자 / 바꿀 글자 / 그 자리가 하는 일) 보여주고 답을 기다린다.
문법이 맞아도 제품이 쓰는 말이 아닌 문장이 연달아 퇴짜를 맞았다. 사용자가 문안을 불러 주면
줄바꿈까지 그대로 쓴다. 문구만 바뀐 라운드는 시험을 안 돌린다.

문구는 그 화면(`.tsx`)에 산다. 여러 화면이 같은 사실을 적으면 상수 하나(`HOUR_UNKNOWN_LABEL`)로
든다 — 화면마다 다시 적지 않는다.

## 금지어

| 어디 | 무엇 | 대신 | 누가 잠그나 |
| --- | --- | --- | --- |
| 식별자 | `query` · `fetch` · `repository`(DB 읽는 함수), `isSelf`, `revision`, `birthDate` — 용어집 _Avoid_ | 문 이름은 내주는 것, `selfPerson`, 「입력」, 달력이 붙은 이름 | 안 잠갔다(아래 어긋남) |
| 화면 문구 | 「판본」 · 「revision」, 내부어(`self` · `person` · 검사 코드), 해라체 버튼, 「~ 중이에요」 | `CONTEXT.md` 규칙 | `consent.test.ts` 가 「판본」을 훑는다. 나머지는 사람 |
| 풀이 본문(모델이 낸 글) | 동의 밖 판정 이름 — 신강 · 신약 · 억부 · 용신 · 격국 · 조후 · 대운 · 세운 · 월운 … | 그 이름은 `reading/vocabulary.ts` 의 갈래에서 프롬프트가 읽어 「쓰지 마라」고 말한다 | `reading/check.ts` 가 저장 전에 막는다(ADR 0073) |
| 풀이 본문 | 「후보」 · 「시험값」 · 「자료상」 · 「~라고 본다면?」 — 제품이 덜 됐다고 스스로 말하는 말투 | 결론의 세기로(「~일 것 같아요」) | 프롬프트 지시(`pairReadingGuideBlock`). 검사는 안 한다 |
| 프롬프트 | **금지어 목록을 늘리지 않는다** — 목록이 길면 글이 점검표가 된다 | 지시가 결론의 모양을 시킨다. 고치면 실호출 한 번(`READING_LIVE=1`) | ADR 0073 |
| 주석 | TODO · FIXME · XXX · HACK | ADR · 간극 대장 · 이슈 | 린트 |

## 커밋과 PR

`type(scope): 한국어 문장 (ADR NNNN) (#PR)` — 예를 들면
`fix(lint): 층 시험을 AST 로 옮기고 화면 DB 호출을 지문으로 잠근다 (ADR 0085 정정 둘째) (#103)`.
type 은 `feat` · `fix` · `refactor` · `test` · `docs` · `chore` · `ci`, 문장은 **무엇이 참이 되는가**다.
결정이 있으면 ADR 을 같은 PR 에 쓴다. PR 은 squash 로 main 에 들고 `gate` 가 필수 검사다
(ADR 0082).

## 린트가 잠근 것 · 시험이 잠근 것

| 규칙 | 어디 | 무엇 |
| --- | --- | --- |
| `no-restricted-syntax` 의 `CODE_SHAPE` | 소스 전부 | `enum`, 내장을 잇지 않는 `class` |
| `@typescript-eslint/consistent-type-definitions` | 소스 전부 | `interface` → `type` |
| `no-warning-comments` | 소스 전부 | TODO · FIXME · XXX · HACK |
| `no-console` | `src/` · `app/` · `proxy.ts`(`*.live.test.ts` 제외) | `console.log` |
| `import/no-default-export` | `src/` · `scripts/` · `e2e/` | `export default` |
| `reportUnusedDisableDirectives` | 전부 | 안 걸리는 예외 표시 |
| `scripts/code-rules.test.ts` | — | 파일·폴더 이름 두 규약, 시험의 자리와 중간 이름, 마이그레이션·pgTAP·ADR 이름, ADR 참조 806 건이 실제 파일, 탈출구 지문(8 · 16 · 3 · 6 · 1 · 1), import 홑따옴표 |

규칙마다 일부러 어긴 파일로 걸리는 것을 확인하고 지웠다(ADR 0086).

**잠그지 않은 것** — 식별자에 새는 용어집 낱말(그 표는 CONTEXT.md 재편에서 만든다), 주석의
언어, 파일 머리말의 유무, 문 파일의 접미사(`docs/architecture.md`), 화면 문구 규칙 전부(사람이
본다), 상수의 SCREAMING_CASE, import 밖의 따옴표.

## 알려진 어긋남 (2026-09-22)

고치지 않고 적어 둔다 — 고칠 때는 이 표와 시험의 지문에서 함께 지운다.

- **코드가 용어집과 다른 말을 쓰는 자리 둘**은 `CONTEXT.md` §10 「어긋난 이름」이 든다
  (`revision` 계열 · `DiscoveryProfile`, 그리고 「그대로 둔다」로 정한 `metaphor` · 후보 목록의 RPC 이름 · 탈퇴 대기). 그 표의 이름이 코드에 아직 있는지는 시험이 잰다(ADR 0088).
- `if (error) return null` 셋, `!` 열여섯, `as unknown as` 여덟 — 위 표. 목록은 시험에 있다.
- `app/me/survey/form.tsx` 의 `react-hooks/exhaustive-deps` 표시에 까닭이 없다.
