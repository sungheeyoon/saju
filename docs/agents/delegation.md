# 위임 규약

이 문서는 **에이전트에게 일을 맡길 때 무엇이 오가는가** 하나만 답한다 — 어떤 이슈가 맡길 만한가,
무엇을 해도 되고 무엇은 사람에게 묻는가, 끝났다는 것이 무슨 뜻인가, 그리고 세션마다 새로 배우던
것이 어디에 적혀 있는가. 어디에 놓는가는 `docs/architecture.md`, 어떻게 적는가는
`docs/agents/code-rules.md`, 무엇을 돌리는가는 `docs/agents/test-map.md` 가 답한다. **일을 여는 입구는
`docs/start.md` 다** — 역할을 고르고 그 역할 문서(`docs/roles/`)가 이 규약의 어느 절을 읽을지 가리킨다(ADR 0140).

여기 적힌 것은 **2026-09-22 에 잰 값**이다(ADR 0090). 그날까지 PR 마흔이 main 에
들었고 그중 스물다섯이 제목에 ADR 번호를 들었다. 권한을 잠그는 설정은 없었고(`.claude/` 없음, 이슈·PR 틀
없음), 세션 메모 63벌(약 500KB)이 저장소 밖에 있어 다른 에이전트가 못 봤다. 권한 등급의 표와
`.claude/settings.json` 이 같은 목록인지, 이슈 틀과 PR 틀의 칸이 이 규약에 있는지는
`scripts/code-rules.test.ts` 가 든다 — 어긋나면 **시험이 맞다.** 문서를 고친다.

## 차례

이 파일은 색인이다 — 규칙 문장은 아래 파일 하나에만 산다(2026-10-05 에 주제별로 나눴다). 필요한 절만 연다.

| 파일 | 절 | 무엇을 드나 |
| --- | --- | --- |
| `docs/agents/delegation/working.md` | 「시작하기 전에」 · 「일하는 법」 | 붉은 main 이 먼저 · 재는 법 · 사용자와 · 저장소와(워크트리 여는 순서 · 원격 DB 명령) |
| `docs/agents/delegation/issues.md` | 「맡길 이슈」 | `ready-for-agent` 이슈의 칸 아홉 — 이슈 틀과 같은 표 |
| `docs/agents/delegation/decisions.md` | 「결정 점검표」 | 무엇이 바뀌면 결정인가 · 안 정한 것은 간극 대장에만 · 반대쪽 상태까지 걷기 |
| `docs/agents/delegation/parallel.md` | 「나란히 맡길 때」 | 공유 자원 표 · 「병렬 가능」의 조건 · 충돌 영역 |
| `docs/agents/delegation/coordinator.md` | 「조율자 세션」 | 사람 하나 · 백그라운드 에이전트 여럿 — 브리프 · 묻는 곳 · 머지는 배포가 아니다 |
| `docs/agents/delegation/unattended.md` | 「무인 라운드」 | 운영자가 자는 동안 — 권한 봉투 · 자동으로 고쳐도 되는 경계 · 아침 보고 |
| `docs/agents/delegation/permissions.md` | 「권한 등급」 · 「공식 운영에 들어가면 켜는 잠금」 | 등급 0~4 표(`.claude/settings.json` 과 같은 목록) · 운영 개인정보 · main 은 PR 로만 · 마이그레이션 PR 의 예외 |
| `docs/agents/delegation/done.md` | 「끝났다는 것」 | PR 틀의 칸 여섯 · 전후 그림 · 커밋과 PR 제목 |
| `docs/agents/delegation/local-env.md` | 「로컬 환경의 함정」 | 증상 · 원인 · 하는 일 표 |
| `docs/agents/delegation/notes.md` | 「세션 기록」 | `docs/notes/` 에 무엇을 적고 무엇은 번호로만 가리키나 |
