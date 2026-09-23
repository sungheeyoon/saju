<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 무엇을 맡기고 무엇을 묻는가는 `docs/agents/delegation.md` 가

맡길 이슈의 칸 일곱, 권한 등급 다섯(main 머지 · `db push` · 실호출 · 운영 SQL 을 사람이 답한 뒤에
하는 등급 3 을 포함해), PR 이 드는 칸 여섯, 세션마다 다시 배우던 일하는 법과 로컬 환경의 함정은
**`docs/agents/delegation.md`** 한 장이 답한다(ADR 0090). 이 문서는 에이전트 전부의
입구다. 권한 표는 `.claude/settings.json` 과 같은 목록인데 **그 파일은 Claude Code 만 읽는다** — 다른
에이전트에게는 표가 전부다. 시험은 `scripts/code-rules.test.ts` 가 둘을 견준다. 배포 순서는 `docs/ops/runbook.md` 「배포」.
옛 세션의 판단 기록은 `docs/notes/` 에 있다 — 요구사항이 아니다. **새 기억은 저장소에 적는다.**

