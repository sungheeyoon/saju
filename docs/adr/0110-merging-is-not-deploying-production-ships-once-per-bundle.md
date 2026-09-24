# 머지는 배포가 아니다 — 운영은 묶음마다 손으로 한 번 올린다

2026-09-25 품질 점검 라운드에서 PR 열둘(#221~#232)이 main 에 들었다. Git 배포가 켜져 있어 가지의 푸시 하나가 Preview
하나, 머지 하나가 Production 하나였고, Vercel Hobby 의 한도(**24시간 이동 창에 100번** — 건너뛴 · 실패한 · 취소된 배포도
센다)에 그날 두 번 닿았다. 닿은 동안 머지된 커밋은 `Deployment rate limited` 로 서고 **저절로 다시 배포되지 않아**,
사용자에게 필요한 수정(#231)이 main 에 있는데 운영에 없는 채로 남았다. 코드보다 배포 횟수가 먼저 바닥났다.

2026-09-24 에는 반대로 정했었다 — 운영 베타 동안은 Preview 편의를 우선해 `git.deploymentEnabled` 로 가지별 배포를 끄지
않고 `ignoreCommand` 만 둔다(runbook 「배포」, G-24). `ignoreCommand` 는 빌드만 건너뛰고 배포 수는 줄이지 못한다는 것을
그때도 알았다. 이 ADR 은 그 결정을 뒤집는다.

## 운영자 결정 (2026-09-25)

1. **Git 자동 배포를 끈다.** `vercel.json` 에 `"git": { "deploymentEnabled": false }` — 가지 · `main` 의 푸시가 배포를
   만들지 않는다(Vercel 「Git configuration」).
2. **PR 은 지금처럼 작게, CI 를 지나면 main 에 머지한다.** 머지할 때마다 운영에 올리지 않는다.
3. **기능 묶음이 끝났을 때 `main` 의 정확한 SHA 를 손으로 한 번 올린다** — 머지 대기 PR 없음 · main CI 초록 · 마이그레이션이
   있으면 DB 먼저 · SHA 기록 · Production 배포 · 배포 SHA = main SHA · 스모크 · 기록(runbook 「묶음 배포」).
4. **화면 확인은 로컬 e2e 와 스크린샷으로.** 밖에서 열 주소가 꼭 필요할 때만 Preview 를 손으로 하나 만든다.
5. **긴급 장애 수정만 곧바로 올린다.**

## 정한 것

- **운영 배포는 등급 3 이다**(`docs/agents/delegation.md`). 머지(`gh pr merge --auto`)는 등급 2 그대로다 — 이제 운영에 아무것도
  안 올린다. 에이전트는 Ready 를 기다리지 않고, 묶음 배포는 사람이 답한 뒤에 조율자가 밟는다.
- **마이그레이션이 든 PR 의 머지 예외는 남긴다.** 머지가 곧 배포이던 때의 까닭(앱이 DB 보다 먼저 나간다)은 사라졌지만, 그 main 을
  올리는 다음 묶음 배포가 DB 보다 먼저 나가지 않게 순서를 머지에서부터 지킨다.
- **`ignoreCommand` 는 남긴다.** 손으로 만든 Preview 도 앱이 안 바뀐 커밋은 빌드를 건너뛴다. Production 은 늘 빌드한다.
- **잠금:** `scripts/vercel-ignore.test.ts` 가 `vercel.json` 의 `git.deploymentEnabled` 가 `false` 인지, runbook 과
  위임 문서가 「머지 = 배포」를 다시 말하지 않는지 든다.

## 고른 것과 버린 것

- **Vercel Pro(한도 6,000)** — PR 마다 Preview 를 둘 수 있지만 운영 베타 단계에서 비용을 올릴 까닭이 없다. 공개 출시 뒤에 다시 본다.
- **자동 도메인 연결만 끄기** — 배포는 여전히 생겨 한도를 쓴다. 문제를 안 푼다.
- **`ignoreCommand` 를 넓히기** — 건너뛴 배포도 센다. 문제를 안 푼다.

## 결과

- 한 라운드의 머지 열 개가 운영 배포 한 번이다. 머지된 것이 운영에 있는지는 「main HEAD = Production 배포 SHA」 한 줄로 본다.
- 대가: PR 마다 붙던 Preview 주소가 없다. main 과 운영 사이에 늘 간격이 있고, 그 간격은 묶음 배포 전까지 사용자에게 안 닿는다.
