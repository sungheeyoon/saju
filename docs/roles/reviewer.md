# 역할 — 검토 · 감사 (읽기만)

조율자가 두 번째 의견을 모을 때 띄우는 역할이다. 관점 하나(아래 여덟 가운데)를 받고, 고치지 않고 보고한다.

## 먼저 읽는 것

- `docs/agents/delegation/coordinator.md` 「조율자 세션」 — 「확인한 흔적을 붙여 전한다」 · 「위험에 따라 두 번째 검토」 · 「전체 감사」 줄
- `docs/notes/2026-09-28-overnight-audit.md` 「팀 — 감사(읽기만)」 — 관점 여덟(코드 규칙 · 아키텍트 · 시험 · 보안 · DB · 프런트 · 문서 · SRE)과 그때 찾은 것
- 하나를 고른다 — 받은 관점의 원본
  - 코드 규칙 — `CODING_STANDARDS.md` 의 차례에서 [그 주제 파일](../agents/code-rules/)
  - 아키텍트 — `docs/architecture.md`
  - 시험 — `docs/agents/test-map.md` 의 차례에서 [그 주제 파일](../agents/test-map/)
  - 보안 — `docs/ops/runbook/security.md` 「보안 점검」 · `docs/ops/runbook/access.md` 「개인정보는 화면으로만」
  - DB — `docs/ops/runbook/deploy.md` 「규약 넷 — 앱과 DB 는 따로 간다」 · ADR 0084(모양을 잠근다)
  - 프런트 — `docs/agents/code-rules/screen-copy.md` 「화면 문구」 · `docs/product/copy-ledger.md` 「01 규칙」 · ADR 0109(디자인 체계)
  - 문서 — `docs/prd.md` 의 차례에서 [그 영역 파일](../product/prd/) · `docs/product/gaps.md`
  - SRE — `docs/ops/runbook.md` 의 차례에서 [그 작업 파일](../ops/runbook/)
- `docs/architecture.md` 「무엇이 잠겨 있나 — 그리고 무엇이 아닌가」 — 잠기지 않은 자리가 볼 곳이다

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [조율자 세션](../agents/delegation/coordinator.md) — 확인한 흔적(`파일:줄` · 실행 결과)을 붙인다 · 결함 · 결정 · 문서 노후 가르기
- [결정 점검표](../agents/delegation/decisions.md) — 발견이 결정인지
- [일하는 법](../agents/delegation/working.md#일하는-법--세션마다-다시-배우던-것) — 잰 것보다 세게 말하지 않는다 · 부재로 통과하는 검사

## 하지 않는 것 · 묻는 것

- 고치지 않는다 — 등급 0 이다. 고치는 에이전트가 코드에서 다시 확인한다([권한 등급](../agents/delegation/permissions.md))
- 운영 개인정보를 조회하지 않는다. 원격 질의가 필요하면 조회문을 보고에 적는다([권한 등급](../agents/delegation/permissions.md) · ADR 0105)
- 보고 파일(`.md`)을 못 쓸 수 있다 — 보고는 메시지로 한다([조율자 세션](../agents/delegation/coordinator.md))

## 끝날 때 고치는 것

- [ ] 보고의 칸 — 발견(결함 · 결정 · 문서 노후) · 근거(`파일:줄` · 실행 결과) · 권하는 고침 · 확인 못 한 것과 그 까닭
- [ ] 역할 문서나 원본 문서가 코드와 달랐으면 그 자리를 「문서 노후」로 — 조율자가 문서 PR 로 옮긴다([선순환](../start.md#선순환--일이-문서로-돌아오는-길))

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 규모(몇 건 · 몇 %)를 보고에 적으려면 → [감사 노트의 세션 끝 상태](../notes/2026-09-28-overnight-audit.md#세션-끝-상태-2026-09-28-저녁-갱신--다음-세션은-여기서-시작) — 재는 법 · 뒤쪽 정정
