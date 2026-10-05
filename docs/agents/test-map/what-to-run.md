# 시험 지도 — 무엇을 고쳤으면 무엇을 돌리나

색인은 `docs/agents/test-map.md` 다.

## 무엇을 고쳤으면 무엇을 돌리나

**공개 출시 전(지금)에는 로컬 최소가 `npm test` · `npm run typecheck` · `npm run lint` 셋이다**(#161, ADR 0097).
화면 · 흐름 · DB 는 머지 뒤 main 의 전체 검증이 재고, 붉으면 `ci-main-red` 이슈가 든다. 예외 넷은 CI 가 대신
못 하거나 머지 전에 알아야 하는 것이라 남긴다:

- **e2e · 흐름 시험 자체를 고쳤으면** 그 시험을 한 번 돌린다 — 시험이 도는지는 시험을 돌려야 안다 (CI 도 그 PR 에서 전부를 돈다, ADR 0119 — 로컬 한 번은 기다리지 않으려고)
- **새 잠금 · 계약 시험을 세웠으면** 일부러 깨뜨려 붉어지는지 본다(PR 의 「잠금이면 일부러 어긴 것」)
- **마이그레이션은** 아래 표의 줄 그대로(pgTAP · 생성 타입) — `supabase/**` PR 은 CI 도 머지 전에 전부를 돈다
- **프롬프트 본문을 바꿨으면** 실호출 한 번 — CI 는 모델을 안 부른다

아래 표는 **공개 출시 뒤의 로컬 최소**이고, 지금은 「이 자리를 고치면 무엇이 재나」를 찾는 지도다. 그때는 화면이나
라우트를 건드렸으면 커밋 전에 e2e 를 돌린다 — 단위 시험은 화면이 사라진 것을 모른다.

| 고친 것 | 돌리는 것 | 왜 그것만 |
| --- | --- | --- |
| `docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts` | `npx vitest run scripts/` · 역할 문서(`docs/roles/`)나 그것이 가리키는 원본이면 `npm run read-budget` | `code-rules.test.ts` 가 대장 · PRD · 위임 규약 · ADR · 설정을 읽는다. `read-budget` 은 시험과 같은 셈(`scripts/read-budget.mjs`)으로 역할마다 읽기량의 고정 · 동적 · 선택 묶음 · 합 · 천장을 찍는다 — `npm run read-budget -- <역할>` 은 파일과 센 절마다(ADR 0145 · 0147). CI 는 `policy` 차선이다 |
| `src/lib/saju/**` · `app/saju/**` | `npm test` → `npm run typecheck` · `npm run lint` | 로그인 뒤 화면과 흐름 검사는 같은 엔진으로 기대값을 짓는다. **예외** — `version.ts` · `pillars/index.ts` 는 DB 검사식이 보므로 전부 |
| `src/lib/*` (엔진 밖) | `npm test`, 프롬프트면 아래 「프롬프트」 | 순수 함수. 문이 부르는 모양이 바뀌면 `typecheck` 가 잡는다 |
| `app/**/*.ts` — 문 · 액션 · 라우트 | `npm test` → `npm run test:flow` | 문의 실패 셋과 액션의 값은 단위가, 실제 스택에서 문이 여는가는 흐름이 |
| 로그인 전 사주 문단(ADR 0143) — `app/actions.ts` · `app/taste-run.ts` · `app/carried-taste.ts` · `app/taste-visitor.ts` · `app/keyed-taste.ts` · `app/me/keyed-taste-claims.ts` · `app/me/reading/taste-carry.ts` · `src/lib/reading/taste-visit.ts` | `npx vitest run app/taste-run.test.ts app/taste-visitor.test.ts app/carried-taste.test.ts src/lib/reading/taste-visit.test.ts app/me/reading/pipeline.test.ts app/me/reading/reading-state.test.ts app/me/reading/collect.test.ts app/me/reading/model.test.ts` → `node scripts/check-taste.mjs` · 화면이면 `npx playwright test e2e/taste.spec.ts` 와 `signed-in.spec.ts -g "아까 보던 내용|로그인 전 사주 문단을 서버에 묻지"` · 표 · 함수면 `npm run test:db`(`80_taste_run` · `81_taste_step_once`) · `node scripts/check-db-races.mjs`(같은 입력의 예약 하나 — 두 세션 경합, `20261118090000`) | 단위는 손잡이를 가짜로 넣어 무엇이 DB · 모델로 가는지(지문은 서버가 · 원문 없음 · 갈래 · 사용량 · 이어쓰기 한 번)를 잰다. 흐름(`check-taste`)은 서버 액션을 빌드의 액션 id 로 실제로 불러 연타 · 새로고침 · 다른 브라우저 · 한도 · 회원 요청 닫힘 · 퍼널 세션당 한 번 · 귀속 탈취 · 저장된 입력으로 잰 지문 버림 · 세션 하나 = 풀이 하나 · 귀속 · 잇기 문을 잠깐 막아 `retryable` 과 `taste-link-failed` 를 DB 까지 · 「전체 풀이만 보기」(`skipTasteCarry`)가 표를 걷어 다음 누름이 보통 풀이인지 잰다 — 모델은 열쇠를 비워 실패로 두고, 성공은 artifact 를 성공으로 바꿔 친다. 시험 서버의 HMAC 비밀 둘은 시험용 값이다(`playwright.config.ts` · `check-taste.mjs`). CI 의 익명 차선에는 DB 가 없어 문단은 실패로 선다 — 글이 서는 화면은 로그인 차선이 잰다 |
| `app/api/cron/reading/**` · `app/api/cron/authorized.ts` | `npx vitest run app/api/cron` | 크론 두 주소가 함께 쓰는 자격(`cronAuthorized` — SHA-256 으로 길이를 맞춘 상수 시간 비교, `authorized.test.ts`). 복구기의 자격 — 머리 없음 · 다른 비밀 · `Basic` · 비밀이 없는 배포는 403 이고 열쇠를 안 꺼낸다, 맞는 비밀만 일감을 줍는다(`route.test.ts`). 소스를 훑는 정규식(`app/me/reading/boundary.test.ts`)은 조건이 헐거워져도 초록이었다 |
| `app/api/openai/webhook/**` · `verifyReadingWebhook`(`app/me/reading/model.ts`) | `npx vitest run app/api/openai/webhook` | OpenAI 가 두드리는 문. 진짜 서명(Standard Webhooks HMAC)을 지어 보낸다 — 다른 비밀 · 본문 바꿈 · 머리 없음 · 오래된 시각 · 서버에 비밀 없음 · `response.*` 아닌 사건은 401 이고 열쇠를 안 꺼낸다, 맞으면 영수증을 적고 204 · 회수는 응답 뒤(`after`) · 재전송은 다시 안 집는다, 못 적으면 503(`route.test.ts`, 2026-09-30). 전에는 위 정규식뿐이라 서명 판정을 버려도 초록이었다 |
| `app/**/*.tsx` — 화면 | 비로그인 화면 `npm run test:e2e`, 로그인 뒤 `npm run test:e2e:signed-in` · 요청·수락이면 `test:e2e:match` · 채팅이면 `test:e2e:chat`. 서버 페이지의 읽기를 고쳤으면 옆의 `page.test.ts` 도 | vitest 는 그리지 못한다(`docs/agents/test-map/kinds.md`). 문구만 바뀐 라운드는 안 돌린다 |
| `proxy.ts` · `src/lib/consent` | `npm test` → `npm run test:e2e:notice` | 관문은 링크를 눌러야 밟힌다 — `page.goto` 로는 못 잰다(ADR 0041) |
| `supabase/migrations/**` | `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` → `npm run test:flow` | 생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다(ADR 0078). CI 의 `authed` 중 `notice` 차선이 diff 를 본다 |
| 프롬프트(`src/lib/reading/prompt*` · `parts.ts` · `vocabulary.ts`) | `npm test`, 본문이 바뀌면 `READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` | 조립 스냅샷은 단위가 든다. **본문이 한 글자라도 바뀌면 실호출 한 번**(ADR 0073). 경로 이름이 본문에 샌 적이 있다 |
| `scripts/ci-plan.mjs` · `release-stage.mjs` · `verify.yml` · `main-red.yml` | `npm test` | `ci-plan.test.ts` 가 단계별 계획을, `main-red.test.ts` 가 이슈의 판단을 든다. YAML 에 `paths` 를 적지 않는다 |
| `vercel.json` · `scripts/vercel-ignore.mjs` | `npx vitest run scripts/vercel-ignore.test.ts` | Vercel 이 Preview 를 건너뛸지. **0 이면 건너뛰고 1 이면 빌드한다** — 시험이 그 반대 의미와 「모르면 빌드」를 든다(`docs/ops/runbook/deploy.md` 「배포」) |
| `package.json` · `package-lock.json` | `npm audit --omit=dev --audit-level=high` → `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` | CI 는 `core` 와 `audit` 만 돈다. 의존성은 화면과 DB 도구에도 닿으니 큰 판 올림이면 e2e · pgTAP 도 한 번 |
| `eslint.config.mjs` · `scripts/*.test.ts` | `npm run lint` → `npm test`, 그리고 **일부러 어긴 파일**로 걸리는지 | 「규칙을 넣었다」와 「규칙이 건다」는 다른 문장이다(ADR 0085·0086) |
| `app/api/cron/audit-export/**` · `scripts/db-remote.mjs` · `scripts/audit-verify.mjs` | `npx vitest run app/api/cron/audit-export scripts/db-remote.test.ts scripts/audit-verify.test.ts`(자격은 복구기와 같은 모양으로 `route.test.ts` 가 든다), 표 · 함수면 `npm run test:db`(`46_operator_access_log` · `50_audit_export_runs`) · `node scripts/check-db-races.mjs`(반출과 늦은 커밋 · 거절 한도 · 같은 열쇠의 주문 · 두 반출 실행 · CLI 결과 한 줄 — 두 세션 경합, `20261013090000` · `20261014090000` · `20261015090000`) | 접속기록 반출과 CLI 기록(ADR 0105). S3 는 가짜로 대신한다 — 진짜 버킷은 AWS 계정이 서는 날 `docs/ops/runbook/security.md` 「반출」의 7 이 잰다 |

**병렬 라운드의 머지 직전에는 `npm run merge:sim -- <PR 번호…>` 를 한 번 돈다** — 조율자가 머지할 PR 을 머지할 순서대로
적으면 저장소 밖 임시 워크트리에서 `origin/main` 위로 차례로 합쳐 글자 충돌을 보고, 단위(`scripts/code-rules.test.ts` ·
`scripts/layers.test.ts` 포함) · 린트 · 타입을 돈다(`scripts/merge-sim.mjs`). PR 마다 초록이어도 한 PR 의 새 잠금이 다른 PR 이
새로 들인 파일을 몰라 합치면 붉었다(2026-09-28, `docs/notes/2026-09-28-overnight-audit.md`). 스택(pgTAP · e2e · 흐름)은
안 돈다 — 각 PR 의 CI 몫이다. 머지는 안 한다(strict gate 와 `--auto`).

**운영 소스 주석의 뿌리 경로도 잠겼다** — `app/**` · `src/**` · `proxy.ts` 의 주석(시험 파일 빼고)이 백틱으로 가리키는
`app/` · `src/` · `docs/` … 경로는 있는 파일이어야 한다(`scripts/code-rules.test.ts` 「운영 소스의 주석이 가리키는 경로」).
파일을 옮기거나 지우면 그것을 말하던 주석도 지금 자리로 고친다. 옛 자리를 일부러 말하는 역사 설명은 그 시험의 허용
목록(`파일 :: 경로` 와 까닭)에 들고, 안 쓰이는 항목은 시험이 잡는다.

**워크트리에서는 제 자리의 포트다** — `npm run stack:slot -- N` 이 스택 이름 · Supabase 포트 · dev 서버(`3000+10N`) ·
흐름 검사(`3210+10N` 부터 여덟)를 함께 옮긴다(ADR 0096). 아래는 main 체크아웃(자리 0)의 이야기다.

**먼저 죽여야 하는 것** — 3000 의 dev 서버. 로그인 e2e 와 흐름 검사는 제 서버를 띄우고,
남의 서버를 재사용하면 옛 코드를 잰다. `lsof -i :3000` 로 본다.
