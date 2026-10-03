# 저녁 묶음 배포 — 첫 화면 정보구조 · 처리방침 목차 · 비로그인 입력폼을 운영에 — 2026-10-03

> 운영자 「머지되면 배포해」(2026-10-03, 대상 #470 머지 뒤)로 `ops` 에이전트가 `docs/ops/runbook.md` 「묶음 배포」 0~5 를 밟았다.
> 이 노트는 요구사항이 아니다 — 그날의 사정이다. 앞 배포는 `2026-10-03-night-taste.md` 「배포」.

## 올린 것

- 앞 Production `3c28440`(10:56 서울, `saju-l110y8zkt`) 뒤에 main 에 든 것: #448(문서) · #454(첫 화면 정보구조 · `/about` · `/help` ·
  `/auth` · 열 수 없는 링크 · 42rem 한 단) · #455(처리방침 목차) · #469(안 쓰는 토큰 정리) · #470(비로그인 홈 입력폼 새 모양)
- `git diff --stat 3c28440 036c221b -- supabase/migrations` 빈칸 → DB 먼저 올릴 것 없음. `supabase migration list` 의 remote 마지막
  `20261119090000`(local 과 같다). `db push` · 실호출 · 운영 DB 쓰기 없음

## 0~3 — 본 값

| 걸음 | 값 |
| --- | --- |
| 0 | 열린 PR 0 · main `036c221b05063df09d1ed6ba4a0fe1ebff68d6cb` · verify(run 37116378420) · main-red 초록 · 24시간 창 안 배포 1번(자리 99) |
| 1 | `git worktree add --detach` 로 그 SHA 만 꺼내 `.vercel` 복사 → `vercel deploy --prod --yes` 한 번. `dpl_4NzSzXdrbrHEC7DUFoCA9jFC2R6n` |
| 2 | 배포의 `meta.gitCommitSha` = `036c221b…` = `git ls-remote origin main` |
| 3 | `● Ready` · target production · Ready **19:33:52 서울**(만든 때 19:32:51) · Aliases 에 `https://saju-snowy.vercel.app` |

Production: https://saju-5myljwe92-sungheeyoons-projects.vercel.app (별칭 https://saju-snowy.vercel.app)

## 4 — smoke (로그인 없이, Playwright chromium 390 · 1280)

| 화면 | 결과 | 근거 |
| --- | --- | --- |
| `/` | 통과 | h1 「나는 어떤 사람일까?」, 「로그인하면 더 볼 수 있어요」, 바닥글 「서비스 소개 · 자주 묻는 질문 · 처리방침」. 입력폼: 글자 칸 17px 가운데 정렬 · 48px, 단위(년 · 월 · 일 · 시 · 분)가 칸 안, 출생지 · 고급 설정 칸 |
| `/` 「궁합 보기」 탭 | 통과 | 나 · 상대 두 벌의 같은 칸, 「무료로 두 사람 궁합 보기」 |
| `/auth` | 통과 | h1 「점점 시작하기」 |
| `/about` · `/help` | 통과 | h1 「점점은 이런 곳이에요」 · 「자주 묻는 질문」 |
| `/privacy` | 통과 | 「목차」 카드 1~11 |
| `/share/readings/<없는 토큰>` | 통과 | 404 와 h1 「열 수 없는 링크입니다」 + 두 줄 설명(콘솔의 오류 한 줄은 그 404 응답) |
| `/me/people` · `/ops/reports`(비로그인) | 통과 | `/auth?next=…` 로 보냄, 500 없음 |
| 궁합(두 사람 고르는 화면) · `/me/people` · `/ops/reports`(로그인) | **운영자 확인 필요** | 운영자 계정이 든다 — 에이전트는 로그인하지 않았다 |

모든 화면에서 CSP 위반 0 · 500 0 · `pageerror` 0. 운영 헤더 `content-security-policy` 강제 그대로.

## 끝 상태

- Production `036c221b`(`saju-5myljwe92`) · DB remote `20261119090000` · 열린 PR 은 이 기록 하나
- 배포 워크트리는 걷었다
