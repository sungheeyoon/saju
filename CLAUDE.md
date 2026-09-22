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

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with a root glossary and root ADR directory. See `docs/agents/domain.md`.
