# 라운드 끝의 돌아보기는 `/retro` 가 한다 — 저장소만의 절차를 따로 두지 않는다

> **운영자 결정 2026-10-06**(조율자 브리프로 전함) — 「저장소만의 retro 절차를 나란히 두지 말고 `/retro` 를 부른다.」
> 운영자가 mattpocock/skills 를 전역(`~/.agents/skills`)에 깔았고 Claude Code 와 Codex 가 함께 읽는다.

ADR 0140 의 한 대목 — 「역할 문서는 조율자가 라운드 끝에 고친다」 — 을 대체한다. 에이전트가 헤맨 자리를 보고에 한 줄 남기는
것과, 나머지(입구 · 역할 문서 · 칸 넷 · 끝날 때 문서를 고친다)는 그대로 선다.

## 잰 것 (2026-10-06)

- `docs/start.md` 「선순환」 3 과 `docs/roles/coordinator.md` 「끝날 때 고치는 것」의 두 줄(헤맨 것 → `docs/roles/` · 되풀이된
  실수 → `docs/agents/delegation/working.md`)이 `/retro` 와 같은 일을 했다. 길이 둘이면 같은 교훈이 두 자리에 적힌다.
- `/retro` 는 세 갈래로 놓는다 — 길잡이는 `AGENTS.md`/`CLAUDE.md`, 기계로 잡을 실수는 린트 · 시험 · CI, 판단은
  `CODING_STANDARDS.md`. 그대로 따르면 길잡이가 매 턴 읽히는 두 파일에 쌓인다.

## 정한 것

- **조율자가 라운드 끝, 세션을 비우기 전에 `/retro` 를 돈다.** 입력은 에이전트 보고의 「헤맨 것 · 틀린 절」이다.
- **놓는 자리는 이 저장소에 맞춘다** — 길잡이 → `docs/roles/`(AGENTS.md · CLAUDE.md 아님) · 기계로 잡을 실수 → `eslint.config.mjs` ·
  `scripts/` 의 시험 · 판단 → `docs/agents/code-rules/`(색인 `CODING_STANDARDS.md`). 이 줄은 `docs/roles/coordinator.md` 한 곳에 둔다.
- 「되풀이된 실수 → `docs/agents/delegation/working.md` 에 한 줄」은 걷는다 — `/retro` 가 그 실수를 시험이나 규칙으로 옮긴다.
- 선순환의 1 · 2 · 4(읽고 시작 · PR 마다 문서 · 라운드 노트)는 `/retro` 가 하지 않으므로 그대로 둔다.

## 치르는 값

- 돌아보기의 절차는 저장소 밖(전역 스킬)에 산다 — 스킬이 바뀌면 저장소 모르게 바뀐다. 놓는 자리만 저장소가 든다.
- 스킬이 없는 세션은 3 을 밟지 못한다. 그때는 보고의 「헤맨 것」을 위 놓는 자리대로 손으로 옮긴다.
