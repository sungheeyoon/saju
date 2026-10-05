# 역할 — 운영 (배포 · 운영 확인 · 크론 · 절차)

운영 DB 와 Vercel 에 닿는 일이다. 대개 조율자가 라운드 끝에 겸한다.

## 먼저 읽는 것

- `docs/ops/runbook/access.md` 「어디서 실행하나」 — 접속값 · 비밀 · 개인정보의 경계
- `docs/ops/runbook/deploy.md` 「배포」 — 특히 「묶음 배포」와 「규약 넷 — 앱과 DB 는 따로 간다」
- `docs/ops/runbook/jobs.md` 「도는 잡이 정말 도나」
- `docs/agents/delegation/permissions.md` 「권한 등급」 · 「공식 운영에 들어가면 켜는 잠금」
- `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」 — 키체인 창 · `BEHIND` · 운영 확인용 계정

## 이 저장소의 방식

규칙은 아래 원본에만 있다 — 여기는 어디를 열지만 말한다(ADR 0145).

- [배포](../ops/runbook/deploy.md#배포) — 머지는 배포가 아니다 · 묶음 배포 · 앱과 DB 는 따로 간다(ADR 0110)
- [권한 등급](../agents/delegation/permissions.md) — 등급 3 을 밟은 뒤 적을 값 · 운영 개인정보 · 공식 운영의 잠금
- [개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) — 원격 질의의 경계와 `db:remote` 의 목적
- [로컬 환경의 함정](../agents/delegation/local-env.md) — 프로덕션 확인용 시험 계정 · 키체인 · `BEHIND`

## 하지 않는 것 · 묻는 것

- 「배포」 답 없이 Production 에 올리지 않는다([권한 등급](../agents/delegation/permissions.md))
- 등급 4 — force push · `supabase config push` · Vercel 변수 삭제 · main 가지 삭제([권한 등급](../agents/delegation/permissions.md))
- 운영 개인정보를 직접 조회하지 않는다 — break-glass 는 사람이 돈다([개인정보는 화면으로만](../ops/runbook/access.md#개인정보는-화면으로만--원격-sql-의-경계-adr-0105) · ADR 0105)
- 운영자가 미룬 것(간극 대장의 `보류`)을 다시 권하지 않는다([조율자 세션](../agents/delegation/coordinator.md))

## 끝날 때 고치는 것

- [ ] 배포 · DB 의 끝 상태는 [묶음 배포](../ops/runbook/deploy.md#묶음-배포--최신-main-을-production-으로-한-번) 5 의 이슈나 그 PR 에 — 노트는 [세션 기록](../agents/delegation/notes.md) 기준만
- [ ] 절차가 바뀌었거나 틀렸으면 → `docs/ops/runbook/` 의 그 작업 파일(새 파일이면 색인에 한 줄)
- [ ] 운영자만 할 수 있는 새 일 → 운영자 할 일 이슈(#304)

## 닿을 때 여는 것

손대기 전에 다 읽지 않는다 — 일이 그 자리에 닿을 때 연다(ADR 0147).

- 보안 점검(advisor · 접속기록)을 맡았으면 → [보안 점검](../ops/runbook/security.md#보안-점검--advisor-와-접속기록-g-23-⑩-⑪) — 증거는 [간극 대장](../product/gaps.md)의 G-23 줄에
