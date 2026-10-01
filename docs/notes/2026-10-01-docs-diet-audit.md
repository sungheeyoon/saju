# 문서 다이어트 감사 — 후보를 분류만 하고, 원본에 맞출 노후만 고친 라운드 — 2026-10-01

앞 기록은 `2026-10-01-pilot-2-ci-lanes.md`. **요구사항도 규칙도 아니다** — 그날의 사정이다.

## 범위

운영자 지시: 「아직 문서를 고치거나 삭제하지 마라 … 각 후보를 삭제 · 통합 · 분할 · 유지로 분류하고 근거와 깨질 링크 · 시험 ·
스크립트를 보고하라. 먼저 제안만」. 조율자가 읽기 전용 `reviewer` 넷을 띄웠다 — A 역할별 독서 경로 실측 · B 중복 · 충돌 ·
C 낡음 · 큰 원본 · D 문서에 묶인 시험 · 스크립트 지도. 기준선은 `scripts/code-rules.test.ts` 42/42.

큰 원본(`wc -c`): runbook 169,702 · prd-changelog 129,661 · prd 127,292 · `CONTEXT.md` 80,811 · prd-archive 62,989 ·
gaps 55,386(G-23 한 줄 17,283) · delegation 50,217 · `verification-discipline.md` 47,917.

독서량: 감사 A 가 역할별로 낸 수(가리킨 그대로 docs 약 36K ~ reviewer 문서 관점 약 234K)는 **어림이고 재현 가능한 측정이 아니다 —
재측정 필요.** 운영자 검토가 짚은 것: ADR 0140 은 `.claude/agents/` 정의를 Claude Code 만 읽는다고 하는데 정의가 없는 조율자까지
공통량에 다 더했고, 런타임별 입구 · 중복 제거 · 절 범위 산정법 · 경로 목록이 없다. 재측정은 미뤘다.

## 머지

- **#401**(`8fa7c2f`) — 정책 변경 없음. PRD 접속 상태 「선다」 · 탈퇴 처분 크론(G-53) · gaps 보류 목록 G-62 · 63 · 65 · 67 ·
  delegation 하루 한도를 `reading_daily_budget()` 로 · 실호출 시험 수(CLAUDE 의 수를 빼고 test-map 이 넷을 든다) · ui.md 의 CI 설명을
  test-map 「CI」 표에 · C2(`CLAUDE.md` · ui.md — 로컬 최소는 test · typecheck · lint, 화면 변경에 e2e 를 일괄로 요구하지 않는다.
  화면 작업의 로컬 필수 검사가 줄어드는 효과를 PR 에 적었다) · C3(feature.md — 앞의 넷만 ADR, 새 문구는 운영자 승인) ·
  C7(delegation · AGENTS — 운영 베타에서도 실호출은 운영자가 직접).
- **#402**(이 노트의 PR) — 같은 결의 노후 두 줄: delegation 「끝났다는 것」 표의 「돌린 것」에서 「화면·라우트면 e2e」를 걷고 test-map 을
  따르게, ui.md 「끝날 때 고치는 것」을 「test-map 에 따라 돌린 명령 · 결과와 안 돌린 까닭」으로(운영자 답, ui.md 수정 승인 포함).

## 운영자 검토가 바로잡은 조율자 판단 — 배운 것

1. C2 · C3 · C7 은 운영자에게 물을 「충돌」이 아니라 **원본에 맞출 문서 노후**였다 — 원본이 이미 답한 것을 결정 대기로 올리지 않는다.
2. 정정 후보 6 의 범위를 잘못 잡았다 — `delegation.md:17` · `test-map.md:47` 은 맞고 노후는 `ui.md:29` 뿐이었다.
3. PRD §7.1 · §7.2 · §7.4 이동의 파급을 코드 주석만 셌다 — 추적 파일 전체로는 43 · 26 · 25회(코드 9 · 9 · 0). 시험은 gaps 의
   출처 칸만 재므로 나머지는 조용히 낡는다.
4. gaps 의 닫힌 하위 항목을 changelog 로 옮기자는 제안 — gaps 가 지금 상태 · 종료 조건의 원본이라 완료 증거를 잃을 수 있다.
   짧은 체크리스트는 남기고 긴 경위만 옮기는 전후안이 먼저다.
5. 「코드 주석 약 3,000곳이 ADR 을 가리킨다」는 틀렸다 — 저장소 전체 출현 3,193, 코드 범위 약 1,750~1,770.

## 결정 대기 · 미룬 것 — 별도 승인 대상, 이번에 안 함

- 후보 7 delegation 「조율자 세션」 · 「무인 라운드」 h3→h2 · 8 delegation 의 Claude Code 호출법 중복 · 9 delegation 의 사건 서술
  약 3~4K 를 노트로 · 10 gaps 진행 서술 정리(전후안 먼저) · 11 PRD §7.1/7.2/7.4 이동과 §8 축약(참조 전수표 먼저. §7.0 표는 CI 단계가
  읽으니 남긴다) · 12 changelog 옛 기록 분할 · 13 runbook 「한 번만」 절 둘
- 역할 문서 가리킴 좁히기 R1~R6 — reviewer 의 prd · gaps 통째 · reading 의 `verification-discipline.md` · 노트를 원본으로 삼음 ·
  coordinator 「gaps 특히 보류 줄」 · ops 의 runbook 큰 절 · `.claude/agents/reviewer.md` 의 PR 문서 칸 줄
- 남은 충돌 — C1(`start.md:12` 와 `delegation.md:213,215` 의 운영 베타 등급 3 범위) · C4(무인 라운드 표의 「화면 흐름 · 메뉴 구조」와
  결정 점검표 다섯) · C8(vercel env)
- 그 밖 운영자 결정 후보 — 파일럿 1 교훈을 delegation 으로 올릴지 · prd-archive 의 지위 · changelog 형식 하나로 · gaps 하위 항목
  규약 · 「(지금) 운영 베타」 단계 표시

**유지를 권한 것:** ADR 삭제 · 번호 변경 안 함(연속 번호 시험). prd-archive 유지(코드 57곳 + US 32곳, 시험이 못 잰다). runbook 파일
분할 대신 가리킴 좁히기 — `ENTRY_DOCS`(`scripts/code-rules.test.ts:525`)가 파일 이름으로 박혀 있어 새 파일은 조용히 검사 밖으로 빠진다.

**시험이 못 잡는 자리:** 코드 주석 · ADR · 노트 · test-map 이 「…」로 가리킨 절, 역할 문서의 따옴표 가리킴 여덟(시험 정규식 밖, 지금은
실재), 닫힌 G 를 가리키는 코드 참조. `scripts/layers.test.ts:225` 는 `docs/architecture.md` 를 읽지 않는다.

## 헤맨 것 — 역할 문서는 이번에 ui.md 한 줄만 고친다(운영자)

- `docs/roles/reviewer.md` 가 문서를 기계로 재는 원본(`scripts/code-rules.test.ts`)을 가리키지 않는다
- `.claude/agents/reviewer.md:9` 가 읽기 전용 역할에 PR 「문서」 칸을 시킨다
- 「먼저 읽는 것」의 범위 규칙이 없다 — 「특히 ○○」가 절 전체인가
- 워크트리에서 복합 셸 명령이 거절돼 임시 파일을 Write 로 썼다. 워크트리의 `.tmp/` 는 gitignore 가 아니다

## 끝 상태

- DB remote: 이번 라운드에 DB 걸음 없음.
- Production: 배포 없음(문서만). 앞 노트의 `1951137` 그대로로 알고 있다 — **이 세션에서 다시 조회하지 않았다.**
- 워크트리: #401 에이전트 워크트리는 운영자 확인 뒤 걷었다.
