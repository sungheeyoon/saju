# 워크트리마다 제 스택을 쥐고, 원격 DB 는 한 번에 하나다

한 기계에서 세션 여럿이 워크트리 하나씩을 들고 일하자 **원인을 모르는 빨간불**이 났다(#144). 워크트리는
소스만 가른다 — 로컬 Supabase 는 `project_id = "saju"` 와 고정 포트(54321 · 54322 …)로 **한 벌**이었고,
Playwright 는 3000 에서 **이미 떠 있는 서버를 재사용했고**, 흐름 검사의 포트는 3210~3216 으로 박혀
있었다(`check-chat` 과 `check-share` 는 둘 다 3216). 운영 DB 는 격리할 방법이 애초에 없다.

## 재어 본 것

- **고치기 전**: 두 워크트리에서 `supabase status` 가 같은 `API_URL` · `DB_URL`(54321 · 54322)을 냈다 —
  한쪽의 `db:reset` 이 다른 쪽이 재던 행을 지우고, `db:types` 는 마지막으로 reset 한 가지의 모양을 찍는다.
- **CLI 는 `config.toml` 의 `project_id` 와 포트에 `env()` 를 받는다**(v2.115.0). 값은 셸 환경 →
  `supabase/.env.local` → `supabase/.env` 차례로 찾는다. 값이 없으면 설정 파싱이 실패한다 — 그래서 기본값
  파일이 추적돼야 한다.
- **컨테이너 이름을 부르는 자리가 다섯**이었다(`scripts/checks.mjs` · `notice.mjs` · `ui-seed.mjs` ·
  `e2e/session.ts` · live 시험 둘). 접속 주소와 열쇠는 이미 `supabase status` 에서 읽고 있어 포트를 몰랐다.
- **고친 뒤**: 자리 1 · 2 의 두 워크트리에서 **동시에** `db:reset && test:db`(1,021 · 1,021 통과),
  `test:flow`(426 · 426), `test:e2e:signed-in:desktop`(37 · 37). main 체크아웃의 `saju` 스택은 그대로 떠 있었다.
- **워크트리의 `node_modules` 는 복제여야 한다.** 심볼릭 링크면 `next build` 가 「Symlink … points out of
  the filesystem root」로 죽는다(Turbopack). `cp -Rc` 는 APFS 복제라 자리를 거의 안 먹는다.

## 정한 것

- **자리 번호 하나가 전부를 옮긴다.** `npm run stack:slot -- N`(1~9)이 `supabase/.env.local` 에 스택 이름
  (`saju_wtN`) · Supabase 포트 묶음 전체(`+100N`) · dev 서버(`3000+10N`) · 흐름 검사의 첫 포트(`3210+10N`)를
  쓴다. 포트 몇 개만 옮기면 남은 하나를 두고 부딪힌다 — 시험(`scripts/worktree-stack.test.ts`)이 자리 0~9 의
  포트가 안 겹치는지, `config.toml` 의 `env()` 이름이 전부 기본값을 갖는지 잰다.
- **기본값은 추적되는 `supabase/.env`** 다. main 체크아웃과 CI 는 그 값(`saju` · 54321 · 3000)으로 전과 같이
  선다. 비밀이 아니라서 추적하고, 비밀은 전처럼 `.env.local` 로 간다.
- **읽는 차례는 한 곳이다** — `src/lib/local-env.ts` 의 `worktreeStack()`. 도구가 CLI 와 다른 차례로 읽으면
  CLI 가 띄운 것과 다른 컨테이너에 `psql` 을 보낸다. 새 파일로 두지 않은 까닭은 `local-env.ts` 가 이미
  「로컬에서만 쓰는 환경 읽기」의 예외이기 때문이다(ADR 0085) — 예외를 하나 더 열지 않았다.
- **원격 DB 는 기계 전체에서 한 번에 하나다.** `npm run db:push` · `npm run db:remote -- "<sql>"` 는
  `~/.cache/saju/remote.lock` 을 잡고 돈다. 잡은 쪽이 있으면 누가 어디서 무엇을 하는지 찍고 기다리고, 잡은
  pid 가 죽어 있으면 걷는다. 도구(`deny`)로 `npx supabase db push` 를 막지는 않았다 — 공개 출시 뒤 그 이름은
  `ask` 로 가야 하는데(ADR 0093) 같은 규칙이 두 등급에 설 수 없다. 규약과 켤 목록(`npm run db:push` · `db:remote`
  를 더했다)이 든다.

## 안 한 것

- **CI.** 러너는 job 마다 새 기계라 이미 갈라져 있다.
- **`ui-*` 도구의 3100.** 사람이 화면을 훑을 때 쓰는 도구라 나란히 돌 일이 없다. `UI_PORT` 로 비킨다.
- **자리 번호를 자동으로 고르기.** 도는 스택을 보고 빈 번호를 고를 수 있지만, 번호를 사람이 읽을 수 있는
  편이 「누가 어느 스택을 쥐었나」를 묻기 쉽다.
