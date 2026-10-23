# 2026-10-23 밤 라운드 — 일감 임대 · 사진 저장소 · 반출 마법사 · 바깥 감시

> **세션 기록이다.** 요구사항도 규칙도 아니다 — 코드와 어긋나면 코드가 맞다. 무엇을 고쳤는지는 각 PR 본문, 배포 SHA 와
> smoke 값은 #770 의 댓글, 남은 틈은 `docs/product/gaps.md` 가 원본이고 이 노트는 번호로만 가리킨다. 앞 라운드는
> `2026-10-22-read-audit-round.md` 다.

## 권한 봉투

운영자 인계는 저장소 밖 `/home/torushy/handoff/night-2026-10-23.md` 다. 그 안에서 허락된 것 — 결정이 아닌 PR 의 머지와
A 의 `--auto`, A 의 `db push`, 라운드 끝 묶음 배포 한 번. 실호출은 하지 않았다.

## 조율자의 판단과 까닭

- **에이전트 넷을 나란히** — A(#809, 일감 임대 · ADR 0201) · B(#810 · #811, 사진 저장소 · ADR 0202 · G-120) · C(#808, 반출 마법사 ·
  G-23 ⑩) · E1(#806 · #807, 바깥 감시 G-118 과 도메인 기록). E1 의 상태 문 #804 는 결정 대기, heartbeat #805 는 draft 로 남았다.
- **검토 지적 「4xx 조회 예외는 닫는다」는 결정으로 올리지 않았다** — 4xx 는 일시 장애가 아니라 고쳐야 다시 되는 실패라, 일시
  장애만 놓는 ADR 0201 의 갈래 안이라고 봤다.
- **#813 을 먼저 넣었다** — 라운드 중 `next` 의 critical 권고 둘(GHSA-2464-fhr4-w9xw · GHSA-p3m5-59mp-jv5r)로 main 의 `audit` 이
  붉었다(#814). 조율자 보고는 「모든 PR 도 붉혔다」였으나, PR 의 `audit` 은 의존성 목록을 바꾼 PR 에만 돈다(`scripts/ci-plan.mjs` 의
  `audits`) — 이 노트를 쓸 때 #806 · #808 · #809 · #810 · #811 의 마지막 run 은 `audit` 이 skipping 이었다. 앞 run 들은 재지 않았다.
- **#810 의 첫 마이그레이션이 사진 문 넷을 `authenticated` 에 연 채 운영에 올랐다** — 고침 마이그레이션 `20261227120000` 으로
  걷었고, 그 사이에 생긴 줄은 0 이었다. 오른 파일은 고치지 않고 새 마이그레이션으로 낸 것이 규칙이 됐다(아래 e).
- **복구기의 Vault 주소가 옛 별칭인 것**(`docs/ops/runbook/domain.md` 「확인 기록」 5)은 지금 200 이라 이번에 바꾸지 않았다.
- **주인 모를 워크트리 `.claude/worktrees/agent-ac8edfcf60f92ff29`**(가지 `feat/photo-etag-304`, 커밋 안 된
  `20261225090000` 마이그레이션)는 손대지 않았다 — #812 와 `photo_at` 에서 부딪힌다.

## 헤맨 것 → retro

같은 PR 에서 원본을 고친 것과 노트에만 남긴 것을 가른다.

| # | 헤맨 것 | 어떻게 했나 |
| --- | --- | --- |
| a | 조율자가 브리프 넷에 같은 「다음 ADR 번호 0201」을 알려 셋이 0201 을 썼다(#809 · #811 · #804) — 같은 번호 겹침은 10-12 · 10-14 노트에도 있다 | **고침** — `docs/agents/delegation/parallel.md` 「나란히 맡길 때」의 「ADR 번호」 줄: 조율자가 브리프마다 다른 번호를 미리 나눠 준다 |
| b | 같은 번호의 ADR 파일 둘을 잡는 시험이 없었다 — 번호를 집합으로 세어 「빈틈없이 이어진다」가 초록이었다 | **고침** — `scripts/code-rules.test.ts` 「ADR 번호는 한 파일에만 있다」. 가짜 겹친 파일 하나로 붉는 것을 봤다 |
| c | 워크트리 격리 가드가 heredoc · `for` · `gh -q '<jq>'` · 파이프 낀 `git` · `gh` 를 거절해 에이전트 모두가 우회했다 | **고침** — `docs/agents/delegation/local-env.md` 「로컬 환경의 함정」의 격리 줄에 `gh -q` 와 heredoc 으로 넘긴 스크립트를 더하고, `jq` 줄에 `-q` 가 막힐 때를 적었다. 우회(파일로 쓰고 한 명령씩)는 그 줄이 이미 든다. 이 노트의 세션에서도 heredoc 은 막혔고 `gh -q` 는 통과했다 |
| d | Docker 가 없어 pgTAP · `db:types` 는 CI 에서만 돈다. 생성기는 grant 를 다 걷은 함수도 타입에 싣는다 — A 의 첫 CI 가 이것으로 붉었고, 그 run 에서 pgTAP 이 건너뛰어져 한 바퀴 더 돌았다 | Docker 줄은 이미 있다(`local-env.md` 의 `LegacyDockerLifecycleInspectError`). 생성기 줄만 **고침** — `docs/agents/test-map/what-to-run.md` 의 `supabase/migrations/**` 줄(`docs/roles/db.md` 가 가리키는 원본). pgTAP 이 왜 건너뛰어졌는지는 재지 않아 노트에만 |
| e | 운영에 오른 마이그레이션은 고치지 않고 두 번째 마이그레이션으로 고친다 — 원본에 없었다 | **고침** — `docs/ops/runbook/deploy.md` 「규약 넷」 끝 문단 |
| f | `/api` 라우트는 모두 자격을 묻는다는 잠금(`app/me/reading/boundary.test.ts`)이 역할 문서에 없어, 새 공개 문(#804)이 결정이란 걸 시험이 붉은 뒤 알았다 | **고침** — 원본은 `docs/agents/delegation/decisions.md` 「결정 점검표」의 「누가 무엇을」 줄에 잠금을 가리키는 문장, `docs/roles/feature.md` · `docs/roles/ops.md` 의 「하지 않는 것 · 묻는 것」에 그 절을 가리키는 한 줄 |
| g | 문서 PR 이 아직 main 에 없는 경로 · ADR 번호를 적으면 참조 시험이 붉다 | **고침** — `docs/agents/delegation/notes.md` 「세션 기록」: PR 번호로 가리킨다 |
| h | ops 역할에 `scripts/*.sh` 와 그 시험 자리 안내가 없다 · 검토자가 같은 함수의 마지막 정의를 찾는 법 · pgTAP 결과가 `authed (notice)` job 에 있다는 것 · 도는 run 의 `--log` 가 빈다는 것 | 셋 **고침** — 마지막 정의 grep 은 `deploy.md` 「규약 넷」(살아 있는 정의에서 뜨는 문단 곁), 도는 run 의 기록은 `docs/agents/test-map/ci.md` 「CI」의 job 기록 문단. pgTAP 이 `notice` 차선에 있다는 것은 같은 파일에 이미 있다. `scripts/*.sh` 는 노트만 — 지금 `aws-wizard.sh` 하나이고 그 시험 자리는 `what-to-run.md` 의 반출 줄이 이미 든다. 둘째 셸 스크립트가 서면 그때 규칙으로 올린다 |
| i | 바깥 권고(npm audit)가 `audit` 차선으로 main 을 한꺼번에 붉힌다 | 노트만 — `ci.md` 「CI」의 `audit` 문단이 이미 든다(새 advisory 는 main 푸시와 일정이 잡고 `ci-main-red` 가 「`audit` 만 붉다」고 적는다). 붉은 main 의 원인을 모은 표는 따로 없다 |

## 정리

걷지 않은 워크트리 — 에이전트 A · B · C · E1, `next` 올림(#813), 이 노트의 워크트리, 그리고 위의 주인 모를 하나. 운영자가
확인한 뒤 걷는다. E1 은 #804 · #805 를 main 위로 올리는 중이라 그 가지와 #812 의 가지는 이 PR 이 건드리지 않았다.
