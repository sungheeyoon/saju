# 사람과 말하는 세션은 일이 하나면 역할을 바꿔 직접 하고, force push 는 어느 가지에도 하지 않는다

> **운영자 결정 2026-10-07**(대화에서, `/retro` 의 권고와 두 번째 의견을 보고) — 「조율자 규칙은 없애지 않고 역할 전환을
> 허용한다 — 단일 작업은 그 역할 문서를 읽고 워크트리에서 직접, 여럿이거나 따로 검토가 필요하면 맡긴다」 · 「force push 는 모든
> 가지에서 쓰지 않는다 — PR 가지는 main 을 merge 해 고친다」.

두 줄 모두 `docs/agents/delegation/decisions.md` 「결정 점검표」의 첫 줄 — 누가 무엇을 할 수 있는가 — 을 옮긴다. 그날 사정은
`docs/notes/2026-10-07-chat-drift-retro.md` 가 든다.

## 정한 것

- **사람과 말하는 세션이 직접 고칠 수 있다 — 일이 하나일 때.** 전에는 조율자가 직접 고치지 않고 늘 맡겼다. 이제 대화가 저장소
  일로 넘어가면 먼저 그 일의 역할 문서(`docs/start.md` 「역할 고르기」)를 읽고, 일이 하나면 그 역할로 바꿔 워크트리에서 한다.
  서로 기대지 않는 일이 여럿이거나 따로 검토가 드는 일이면 전처럼 맡긴다. 조율자의 나머지 규칙(묻는 곳은 하나 · 브리프 · 머지
  차례)은 그대로다. 원본은 `docs/agents/delegation/coordinator.md` 「조율자 세션」.
- **메인 체크아웃에 쓰려 하면 훅이 한 줄 일러 준다 — 묻지도 막지도 않는다.** `scripts/checkout-hint.mjs`(Claude Code 의
  PreToolUse). 매번 뜨는 확인 창은 일 하나에 에이전트를 띄우는 값처럼 이 실수보다 비싸다고 봤다. 원본은
  `docs/agents/delegation/permissions.md` 「훅 — 메인 체크아웃에서 일러 준다」.
- **force push 는 등급 4(안 한다)이고 main 만이 아니라 어느 가지에도다.** PR 가지를 main 위로 옮길 때는 rebase 대신 main 을
  merge 한다 — `docs/agents/delegation/permissions.md` 「잠그지 않은 것」이 이미 그 방향이었다. `.claude/settings.json` 의 `deny` 가
  꼴을 더 든다. 원본은 같은 파일 「권한 등급」의 등급 4 줄.

ADR 0093 의 「등급 4 는 main 에 force push …」 대목을 대체한다 — 그 ADR 의 나머지(등급 3 의 잠금은 공식 운영 뒤에 켠다)는
그대로 선다.

## 치르는 값

- 직접 고치는 세션은 사람과 같은 맥락을 쥐어 브리프의 차가운 시작이 주던 두 번째 눈이 없다. 따로 검토가 드는 일을 맡기는
  것으로 그 값을 줄인다 — 어느 일이 그런지는 세션이 가른다.
- 훅은 Claude Code 에서만 돈다. 다른 에이전트에게는 `docs/agents/delegation/coordinator.md` 의 문장이 전부다.
- `deny` 는 글자를 견줄 뿐이라 모든 force push 꼴을 막지 못한다 — 못 잡는 꼴은 `docs/agents/delegation/permissions.md`
  「잠그지 않은 것」 ③. 막는 것은 규약이고 잠금은 흔한 꼴만 든다.
- main 을 merge 해 올리면 PR 가지의 이력에 merge 커밋이 남는다. squash 머지라 main 에는 남지 않는다.
