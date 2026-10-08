# 코드 규칙 — 커밋과 잠금

색인은 `CODING_STANDARDS.md` 다.

## 커밋과 PR

`type(scope): 한국어 문장 (ADR NNNN) (#PR)` — 예를 들면
`fix(lint): 층 시험을 AST 로 옮기고 화면 DB 호출을 지문으로 잠근다 (ADR 0085 정정 둘째) (#103)`.
type 은 `feat` · `fix` · `perf` · `refactor` · `ui` · `test` · `docs` · `chore` · `ci`, 문장은 **무엇이 참이 되는가**다.
squash 가 PR 제목을 커밋 제목으로 쓰므로 `verify` 의 `plan` 이 PR 제목의 꼴을 잰다(`scripts/pr-title.mjs`) — 제목을 고친 뒤에는 `verify` 를 다시 돌린다.
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
| `scripts/code-rules.test.ts` | — | 파일·폴더 이름 두 규약, 시험의 자리와 중간 이름, 마이그레이션·pgTAP·ADR 이름, ADR 참조 806 건이 실제 파일, 입구 문서와 운영 소스 주석(`app/**` · `src/**` · `proxy.ts`)의 백틱 속 뿌리 경로가 실제 파일(옛 자리를 말하는 역사 설명은 이름과 까닭으로 든 허용 목록, 2026-09-28), 탈출구 지문(7 · 12 · 1 · 0 · 0 · 3 · 0 · 1), `@ts-expect-error` 0, import 홑따옴표, `CLAUDE.md` 는 `@AGENTS.md` 와 Claude Code 호출법만(600 바이트, 2026-10-06) |

규칙마다 일부러 어긴 파일로 걸리는 것을 확인하고 지웠다(ADR 0086).

**잠그지 않은 것** — 식별자에 새는 용어집 낱말(그 표는 GLOSSARY.md 재편에서 만든다), 주석의
언어와 내용(지금의 것만 적었는가 — 사람이 본다), 파일 머리말의 유무, 문 파일의 접미사(`docs/architecture.md`), 화면 문구 규칙 전부(사람이
본다), 상수의 SCREAMING_CASE, import 밖의 따옴표.

## 알려진 어긋남 (2026-09-22)

고치지 않고 적어 둔다 — 고칠 때는 이 표와 시험의 지문에서 함께 지운다.

- **코드가 용어집과 다른 말을 쓰는 자리**는 `docs/context/code-names.md` §10 「어긋난 이름」이 든다 — 고칠 것은 2026-09-23 에 다 고쳤고(G-43),
  「그대로 둔다」로 정한 넷(`metaphor` · 후보 목록의 RPC 이름 · 사유값 `unreadable-revision` · 탈퇴 대기)이 까닭과 함께 남았다. 그 표의 이름이 코드에 아직 있는지는 시험이 잰다(ADR 0088).
- `if (error) return null` 하나, `!` 열둘, `as unknown as` 일곱, — `docs/agents/code-rules/escapes.md` 의 탈출구 표(결과를 버리는 DB 쓰기는 2026-09-26 에 일곱을 다 기록으로 옮겨 0 이다). 목록은 시험에 있다.
