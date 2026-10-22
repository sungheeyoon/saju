<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 일은 `docs/start.md` 에서 연다

손대기 전에 **`docs/start.md` 에서 역할을 고르고 그 역할 문서(`docs/roles/`)를 끝까지 읽는다** — 읽을 것 · 이 저장소의 방식 ·
하지 않을 것 · 끝날 때 고칠 문서가 역할마다 한 장이다(ADR 0140).

## 무엇을 맡기고 무엇을 묻는가는 `docs/agents/delegation.md` 가

맡길 이슈의 칸 아홉, 권한 등급 다섯(등급 3 가운데 **프로덕션 배포는 운영 베타에서도 사람이 답한 뒤**이고, `db push` · 운영 SQL 은
공식 운영 전까지 밟고 값을 적으며, 실호출은 운영자가 직접 돌린다 — 표는 `docs/agents/delegation/permissions.md` 「권한 등급」, ADR 0093),
PR 이 드는 칸 여섯, 세션마다 다시 배우던 일하는 법과 로컬 환경의 함정은
**`docs/agents/delegation.md`** 의 색인이 가리키는 `docs/agents/delegation/` 의 주제별 파일이 답한다(ADR 0090). 이 색인은 맡기는 규약의
색인이다 — 일의 입구는 `docs/start.md` 다. 권한 표는 `.claude/settings.json` 과 같은 목록인데 **그 파일은 Claude Code 만 읽는다** — 다른
에이전트에게는 표(`docs/agents/delegation/permissions.md`)가 전부다. 시험은 `scripts/code-rules.test.ts` 가 둘을 견준다. 배포 순서는 `docs/ops/runbook/deploy.md` 「배포」.
**새 기억은 저장소에 적는다** — 남은 일은 `docs/product/gaps.md`, 결정은 ADR, 사정만 `docs/notes/`(요구사항 아님, 원본 `docs/agents/delegation/notes.md` 「세션 기록」).

## Agent skills

This section is here, not in `CLAUDE.md`, so Codex reads it too — `CLAUDE.md` pulls this file in with `@AGENTS.md`.

### Issue tracker

Issues and PRDs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five canonical labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with a root glossary and root ADR directory. See `docs/agents/domain.md`.
