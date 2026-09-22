@AGENTS.md

## 요구사항은 `docs/prd.md` 가 축이다

제품이 무엇을 하는지는 **`docs/prd.md`** 하나가 답한다 — 지금 모양만 적는다. 코드와 어긋나면
그 문서가 맞다. **아직 없는 것 · 안 정한 것 · 어긋난 것은 `docs/product/gaps.md`(간극 대장)**가
상태·종료 조건·언제 닫는가와 함께 들고, 어느 날 무엇을 고쳤는지는 `docs/product/prd-changelog.md`
가 든다(ADR 0089). 요구사항을 셋에서 찾지 않는다 — PRD 하나다.

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

## 무엇을 맡기고 무엇을 묻는가는 `docs/agents/delegation.md` 가

맡길 이슈의 칸 일곱, 권한 등급 다섯(main 머지는 곧 배포이고 `db push` · 실호출 · 운영 SQL 은 사람이
답한 뒤다), PR 이 드는 칸 여섯, 세션마다 다시 배우던 일하는 법과 로컬 환경의 함정은
**`docs/agents/delegation.md`** 한 장이 답한다(ADR 0090). 권한 표는 `.claude/settings.json` 과 같은
목록이고 `scripts/code-rules.test.ts` 가 둘을 견준다. 배포 순서는 `docs/ops/runbook.md` 「배포」.
옛 세션의 판단 기록은 `docs/notes/` 에 있다 — 요구사항이 아니다. **새 기억은 저장소에 적는다.**

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with a root glossary and root ADR directory. See `docs/agents/domain.md`.
