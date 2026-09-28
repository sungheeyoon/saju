# main 에는 관리자까지 PR 로만 든다

> **추기(2026-09-28 오후)** — 「PR 을 거쳐야 머지」(`required_pull_request_reviews`, 승인 0)도 켰다. `enforce_admins` 와 필수 검사 `gate` 만으로는 **가지에서 이미 `gate` 를 지난 커밋을 PR 없이 `git push origin HEAD:main` 으로 올리는 길**이 열려 있었다(외부 리뷰가 잡음). 승인 수가 0 이라 기다리는 걸음은 늘지 않고 `--auto` 는 그대로 돈다 — 승인 1 이상은 혼자 운영하는 저장소에서 매번 막히므로 두지 않는다. 설정 값: PR 필수(승인 0) · 관리자 포함 · `gate` strict.

> **섰다**(2026-09-28). 운영자 결정 — main 보호 규칙의 `enforce_admins` 를 켰다. ADR 0082 의 「관리자는 규칙 밖에 둔다
> (`enforce_admins: false`) — main 에 직접 미는 일이 있다」를 이 문서가 뒤집는다.

## 잰 것

- **2026-09-28 아침, 조율자의 문서 커밋이 main 을 붉혔다**(`e22ca73`, #297). 밤샘 감사 노트가 main 에 없는 ADR 번호를 적었고
  노트 차례(`docs/notes/README.md`)에 줄을 안 넣었다 — `scripts/code-rules.test.ts` 가 둘 다 잡는데, 직접 푸시라 그 시험을
  PR 에서 한 번도 안 지났다. 앞선 라운드들도 조율자 · 워크트리 에이전트가 main 에 직접 푸시했다
  (`docs/notes/2026-09-25-coordinator-round.md`, `docs/notes/2026-09-25-home-and-matching-ui.md`).
- **에이전트만 막을 방법이 없다.** 운영자와 에이전트가 같은 GitHub 계정(`gh` 의 토큰)을 쓴다 — GitHub 는 둘을 못 가른다.
  `.claude/settings.json` 은 Claude Code 만 읽고(다른 에이전트에게는 `docs/agents/delegation.md` 의 표가 전부다), 그 `deny` 도
  `cd x && git push --force-with-lease` 를 못 막은 적이 있다(`docs/agents/delegation.md` 「잠그지 않은 것」).
- 켠 뒤의 보호 규칙(`gh api repos/{owner}/{repo}/branches/main/protection`, 2026-09-28): `enforce_admins: true` ·
  필수 검사 `gate` 하나 · `strict: true` · 리뷰 요구 없음.

## 정한 것

- main 에는 **누구의 커밋도** 가지 → PR → `gate` 초록으로만 든다 — 운영자 · 조율자 · 에이전트가 같다. 문서 · 세션 기록
  (`docs/notes/`)도 PR 로 넣고 `gh pr merge --auto` 를 건다. 문서만 바뀐 PR 은 `policy` 차선(scripts 시험 · 타입 · 린트)만
  돈다(`scripts/ci-plan.mjs`).
- **비상시에는 운영자가 저장소 설정에서 보호를 잠시 끌 수 있다.** 끄면 켤 때까지 — 끈 까닭, 그 사이에 든 커밋, 다시 켠
  시각을 그날 노트에 적는다.
- 규약은 `docs/agents/delegation.md` 의 권한 등급 2 · 「main 은 PR 로만」 · 「조율자 세션」 · 「세션 기록」이 든다.

## 안 고른 것

- **에이전트에게 따로 GitHub 신원(봇 계정 · GitHub App)을 주고 그것만 막기.** 운영자는 직접 푸시를 지킬 수 있지만, 토큰 ·
  권한 · 커밋 서명을 두 벌 관리한다. 지금 운영자는 직접 푸시가 필요하지 않다 — **운영자가 직접 푸시가 필요해지면 그때
  검토한다.**
- **`.claude/settings.json` 의 `deny` 에 `git push origin main` 을 더하기.** Claude Code 만 읽고, 인자 모양을 조금만 바꿔도
  지나간다(위). 도구의 담이 아니라 GitHub 의 담이어야 모두가 같다.

## 값

- **모든 변경이 `gate` 를 기다린다** — 한 줄 문서도 PR 을 열고 `policy` 차선(1분 안팎)을 지난다. strict 라 나란히 선 PR 은
  하나 들 때마다 `BEHIND` 로 서서 다시 돈다.
- **운영자의 직접 푸시도 막힌다.** 급한 되돌림도 PR 로 가거나, 보호를 잠시 끄고 적는다.
- `gh pr merge` 의 즉시 머지(`--auto` 없음, 등급 3)도 이제 `gate` 초록 전에는 안 든다 — 관리자 우회가 없어서다.
