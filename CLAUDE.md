@AGENTS.md

## 요구사항은 `docs/prd.md` 가 축이다

제품이 무엇을 하는지는 **`docs/prd.md`** 하나가 답한다. 2026-09-03 에 코드와 대조해 다시
썼고, 코드와 어긋나면 그 문서가 맞다 — 어긋난 자리는 ADR 0032~0038 초안에 있다.

`docs/product/prd-archive.md` 는 **요구사항이 아니다.** 코드 주석이 가리키는 US 번호의
출처로만 남겼다. 거기서 무엇을 만들지 읽지 마라.

## 층은 `docs/architecture.md` 가, 잠금은 린트가

코드가 어디에 살고 무엇이 무엇을 불러도 되는가는 **`docs/architecture.md`** 한 장이 답한다.
역방향 import 와 화면 안의 새 DB 호출은 `scripts/layers.test.ts` 와 `eslint.config.mjs` 가
막는다(ADR 0085) — 문서와 시험이 어긋나면 시험이 맞다. 새 파일을 놓기 전에 그 문서의
「새 것을 놓을 때」를 본다. 도메인 lib 사이에 새 방향을 열면 시험의 허용 목록과 문서를 함께 고친다.

## 어떻게 적는가는 `docs/agents/code-rules.md` 가

이름 · 실패를 말하는 법 · 주석과 ADR 참조 · 탈출구 · 화면 문구 · 금지어는 **`docs/agents/code-rules.md`**
한 장이 답한다. 잰 값이지 정한 규칙이 아니고(ADR 0086), 린트가 잡을 것은 `eslint.config.mjs` 가,
못 잡을 것은 `scripts/code-rules.test.ts` 가 든다 — 문서와 어긋나면 그 둘이 맞다. **한글 문구는
코드에 넣기 전에 표로 보여주고 답을 기다린다.**

## 무엇을 돌리는가는 `docs/agents/test-map.md` 가

시험 넷(단위 · pgTAP · 흐름 · e2e)이 층마다 어디까지 닿는지, **고친 자리 → 로컬 명령** 표, 잠긴
실호출 시험 셋, CI 차선은 **`docs/agents/test-map.md`** 가 답한다. 규칙의 원본은 `scripts/ci-plan.mjs`
다. vitest 는 `.tsx` 에 안 닿는다 — 화면을 건드렸으면 커밋 전에 e2e 를 돌린다.

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with a root glossary and root ADR directory. See `docs/agents/domain.md`.
