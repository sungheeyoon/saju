# 코드 규칙 — 이름

색인은 `docs/agents/code-rules.md` 다.

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
| `enum` · `class` | `enum` 은 없다 — 문자열 리터럴 유니언이다. `class` 는 내장을 잇는 자리뿐(`InvalidSajuInputError extends Error`) — 상태를 가진 클래스는 없다 | 0 · 10 |
| export | 이름 있는 export. `export default` 는 Next 가 요구하는 `app/` 과 루트 설정 파일에만 | src·scripts·e2e 0 |
| 따옴표 | 홑따옴표 | import 1203 / 0 |

**식별자는 영어, 뜻은 용어집.** `CONTEXT.md` 의 _Avoid_ 는 화면 문구만이 아니라 식별자에도
적용된다 — DB 를 읽는 함수는 **문**이지 `query` · `fetch` · `repository` 가 아니고, 이름은
**무엇을 내주는가**로 짓는다(`inbox` · `current` · `candidates`). 사람은 `selfPerson` 이지
`isSelf` 가 아니다. 지금 새어 있는 자리는 `docs/agents/code-rules/locks.md` 「알려진 어긋남」에 있다.
