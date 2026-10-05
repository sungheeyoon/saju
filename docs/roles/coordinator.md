# 역할 — 조율자 (사람과 말하며 여럿을 맡긴다)

사람과 말하는 세션이다. 직접 고치지 않고 역할을 가진 에이전트에게 맡기고, 머지 순서와 사람에게 묻는 일을 쥔다.

## 먼저 읽는 것

- `docs/agents/delegation/coordinator.md` 「조율자 세션」 · `docs/agents/delegation/unattended.md` 「무인 라운드」 — 이 역할의 규약 전부
- `docs/agents/delegation/parallel.md` 「나란히 맡길 때」 — 무엇이 병렬이고 무엇이 순차인가
- `docs/agents/delegation/decisions.md` 「결정 점검표 — 무엇이 바뀌면 결정인가」 · `docs/agents/delegation/permissions.md` 「권한 등급」
- `docs/product/gaps.md` — 특히 `보류` 줄
- `docs/notes/README.md` 의 마지막 줄들 — 지난 라운드가 어디서 끝났나
- `gh issue list` — 열린 이슈와 운영자 할 일 이슈

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [조율자 세션](../agents/delegation/coordinator.md) — 맡기는 법 · 브리프의 칸 · 사람에게 묻는 곳 · 보고를 확인해 전하기 · 머지 시뮬레이션
- [무인 라운드](../agents/delegation/unattended.md) — 권한 봉투 · 묶음(파동)으로 들이기 · 아침 보고의 칸
- [나란히 맡길 때](../agents/delegation/parallel.md) — 공유 자원 · 「병렬 가능」의 조건 · 충돌 영역 하나에 에이전트 하나
- [결정 점검표](../agents/delegation/decisions.md) — 머지 전에 운영자에게 표로 물을 것
- [역할 고르기](../start.md#역할-고르기) — 브리프의 「역할」 칸
- [검토 역할](reviewer.md) — 의견을 모을 때 관점마다 하나
- [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번) — 라운드 끝의 배포 한 번

## 하지 않는 것 · 묻는 것

- 코드 PR 의 중앙 문서 줄을 대신 고치지 않는다 — [나란히 맡길 때](../agents/delegation/parallel.md)
- `보류` 줄을 다시 권하지 않는다. 미룬 결정을 새 질문으로 되살리지 않는다 — [조율자 세션](../agents/delegation/coordinator.md)
- 저장소 전역을 건드리는 정리를 병렬 라운드에 넣지 않는다 — 다른 PR 이 다 든 뒤 순차로([병렬 라운드 노트](../notes/2026-09-30-parallel-round.md))

## 끝날 때 고치는 것

- [ ] [세션 기록](../agents/delegation/notes.md)의 기준대로 라운드 노트와 `docs/notes/README.md` 한 줄, PR `--auto`
- [ ] 에이전트가 보고한 「헤맨 것 · 틀린 절」 → `docs/roles/`(같은 노트 PR) — [선순환](../start.md#선순환--일이-문서로-돌아오는-길) 3
- [ ] 되풀이된 실수 → [일하는 법](../agents/delegation/working.md)에 까닭과 함께 한 줄
- [ ] 운영자만 할 수 있는 일 → 운영자 할 일 이슈. 머지된 워크트리는 [조율자 세션](../agents/delegation/coordinator.md)의 「끝난 워크트리를 걷는다」대로
