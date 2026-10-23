# 시험 지도 — 무엇을 고쳤으면 무엇을 돌리나

색인은 `docs/agents/test-map.md` 다.

## 무엇을 고쳤으면 무엇을 돌리나

**공개 출시 전(지금)에는 로컬 최소가 `npm test` · `npm run typecheck` · `npm run lint` 셋이다**(#161, ADR 0097).
화면 · 흐름 · DB 는 머지 뒤 main 의 전체 검증이 재고, 붉으면 `ci-main-red` 이슈가 든다. 예외 넷은 CI 가 대신
못 하거나 머지 전에 알아야 하는 것이라 남긴다:

- **e2e · 흐름 시험 자체를 고쳤으면** 그 시험을 한 번 돌린다 — 시험이 도는지는 시험을 돌려야 안다 (CI 는 `core` 와 그 시험의 차선만 돈다 — spec 은 그것을 부르는 차선, 흐름 검사는 `flow`. spec 이 아닌 `e2e/**` 는 전부다, `docs/agents/test-map/ci.md` 판정 표 — 로컬 한 번은 기다리지 않으려고)
- **새 잠금 · 계약 시험을 세웠으면** 일부러 깨뜨려 붉어지는지 본다(PR 의 「잠금이면 일부러 어긴 것」)
- **마이그레이션은** 아래 표의 줄 그대로(pgTAP · 생성 타입) — `supabase/**` PR 은 CI 도 머지 전에 전부를 돈다
- **프롬프트 본문을 바꿨으면** 실호출 한 번 — CI 는 모델을 안 부른다

아래 표는 **공개 출시 뒤의 로컬 최소**이고, 지금은 「이 자리를 고치면 무엇이 재나」를 찾는 지도다. 그때는 화면이나
라우트를 건드렸으면 커밋 전에 e2e 를 돌린다 — 단위 시험은 화면이 사라진 것을 모른다.

| 고친 것 | 돌리는 것 | 왜 그것만 |
| --- | --- | --- |
| `docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts` | `npx vitest run scripts/` · 역할 문서(`docs/roles/`)나 그것이 가리키는 원본이면 `npm run read-budget` | `code-rules.test.ts` 가 대장 · PRD · 위임 규약 · ADR · 설정을 읽는다. `read-budget` 은 시험과 같은 셈(`scripts/read-budget.mjs`)으로 역할마다 읽기량의 고정 · 동적 · 선택 묶음 · 예상치를 천장 없는 보고 표로 찍는다 — 막는 값이 아니고, 가리킴을 바꾼 PR 은 전후 예상치를 「잰 값」에 적는다. `npm run read-budget -- <역할>` 은 파일과 센 절마다(ADR 0145 · 0147 · 0177). CI 는 `policy` 차선이다 |
| `src/lib/saju/**` · `app/saju/**` | `npm test` → `npm run typecheck` · `npm run lint` | 로그인 뒤 화면과 흐름 검사는 같은 엔진으로 기대값을 짓는다. **예외** — `version.ts` · `pillars/index.ts` 는 DB 검사식이 보므로 전부(CI 도 어느 단계든 전부다 — 공용 위험 「엔진의 DB 쪽」, ADR 0195) |
| `src/lib/*` (엔진 밖) | `npm test`, 프롬프트면 아래 「프롬프트」 | 순수 함수. 문이 부르는 모양이 바뀌면 `typecheck` 가 잡는다 |
| `app/**/*.ts` — 문 · 액션 · 라우트 | **지금(운영 베타)은 로컬 최소 셋** — 흐름은 CI 계획이 고른다(서버 액션 · `route.ts` 는 전부, ADR 0119). 공개 출시 뒤에는 `npm test` → `npm run test:flow` | 문의 실패 셋과 액션의 값은 단위가, 실제 스택에서 문이 여는가는 흐름이 |
| 로그인 전 사주 문단(ADR 0143) — `app/taste/actions.ts` · `app/taste/taste-run.ts` · `app/taste/carried-taste.ts` · `app/taste/taste-visitor.ts` · `app/taste/keyed-taste.ts` · `app/taste/keyed-taste-claims.ts` · `app/taste/taste-carry.ts` · `src/lib/reading/taste-visit.ts` | `npx vitest run app/taste/taste-run.test.ts app/taste/taste-visitor.test.ts app/taste/carried-taste.test.ts src/lib/reading/taste-visit.test.ts app/me/reading/pipeline.test.ts app/me/reading/reading-state.test.ts app/me/reading/collect.test.ts app/me/reading/model.test.ts` → `node scripts/check-taste.mjs` · 화면이면 `npx playwright test e2e/taste.spec.ts` 와 `signed-in.spec.ts -g "아까 보던 내용|로그인 전 사주 문단을 서버에 묻지"` · 표 · 함수면 `npm run test:db`(`80_taste_run` · `81_taste_step_once`) · `node scripts/check-db-races.mjs`(같은 입력의 예약 하나 — 두 세션 경합, `20261118090000`) | 단위는 손잡이를 가짜로 넣어 무엇이 DB · 모델로 가는지(지문은 서버가 · 원문 없음 · 갈래 · 사용량 · 이어쓰기 한 번)를 잰다. 흐름(`check-taste`)은 서버 액션을 빌드의 액션 id 로 실제로 불러 연타 · 새로고침 · 다른 브라우저 · 한도 · 회원 요청 닫힘 · 퍼널 세션당 한 번 · 귀속 탈취 · 저장된 입력으로 잰 지문 버림 · 세션 하나 = 풀이 하나 · 귀속 · 잇기 문을 잠깐 막아 `retryable` 과 `taste-link-failed` 를 DB 까지 · 「전체 풀이만 보기」(`skipTasteCarry`)가 표를 걷어 다음 누름이 보통 풀이인지 잰다 — 모델은 열쇠를 비워 실패로 두고, 성공은 artifact 를 성공으로 바꿔 친다. 시험 서버의 HMAC 비밀 둘은 시험용 값이다(`playwright.config.ts` · `check-taste.mjs`). CI 의 익명 차선에는 DB 가 없어 문단은 실패로 선다 — 글이 서는 화면은 로그인 차선이 잰다 |
| 새 메시지 웹 푸시(ADR 0156) — `src/lib/push/**` · `app/api/push/**` · `app/me/push/**` · `app/me/settings/push-row.tsx` · `public/sw.js` · `app/manifest.ts` | `npx vitest run src/lib/push app/api/push app/sw.test.ts` → `node scripts/check-push.mjs` · 화면이면 `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=<공개 열쇠> npx playwright test --project=desktop-chromium e2e/push.spec.ts` · 표 · 함수면 `npm run test:db`(`83`) · `node scripts/check-push-race.mjs`(보낸 뒤 60초 — 닫기와 새 메시지의 두 세션 경합) | 흐름은 일회용 VAPID 열쇠와 가짜 푸시 서비스(`scripts/fake-push-service.mjs`)로 메시지 → `pg_net` → 배달 문 → 송신 → 닫기를 끝까지 잰다. 실제 푸시 서비스에는 아무것도 안 간다. e2e 는 `pushManager.subscribe` 만 가짜다(헤드리스는 FCM 구독을 못 맺는다) |
| `app/api/cron/reading/**` · `app/api/cron/authorized.ts` | `npx vitest run app/api/cron` | 크론 두 주소가 함께 쓰는 자격(`cronAuthorized` — SHA-256 으로 길이를 맞춘 상수 시간 비교, `authorized.test.ts`). 복구기의 자격 — 머리 없음 · 다른 비밀 · `Basic` · 비밀이 없는 배포는 403 이고 열쇠를 안 꺼낸다, 맞는 비밀만 일감을 줍는다(`route.test.ts`). 소스를 훑는 정규식(`app/me/reading/boundary.test.ts`)은 조건이 헐거워져도 초록이었다 |
| `app/api/openai/webhook/**` · `verifyReadingWebhook`(`app/me/reading/model.ts`) | `npx vitest run app/api/openai/webhook` | OpenAI 가 두드리는 문. 진짜 서명(Standard Webhooks HMAC)을 지어 보낸다 — 다른 비밀 · 본문 바꿈 · 머리 없음 · 오래된 시각 · 서버에 비밀 없음 · `response.*` 아닌 사건은 401 이고 열쇠를 안 꺼낸다, 맞으면 영수증을 적고 204 · 회수는 응답 뒤(`after`) · 재전송은 다시 안 집는다, 못 적으면 503(`route.test.ts`, 2026-09-30). 전에는 위 정규식뿐이라 서명 판정을 버려도 초록이었다 |
| `app/**/*.tsx` · `app/**/*.module.css` — 화면 | **지금(운영 베타)은 로컬 최소 셋 + 전후 스크린샷** — e2e 는 로컬에서 안 돌리고 CI 계획이 그 주소에 닿는 차선을 고른다 — 입구가 아닌 컴포넌트와 css module 은 그것을 쓰는 입구의 주소로(`docs/agents/test-map/ci.md`, ADR 0178 · 0195). 서버 페이지의 읽기를 고쳤으면 옆의 `page.test.ts` 도. 공개 출시 뒤에는 비로그인 화면 `npm run test:e2e`, 로그인 뒤 `npm run test:e2e:signed-in` · 요청·수락이면 `test:e2e:match` · 채팅이면 `test:e2e:chat` · 실시간이면 `test:e2e:live`. **모양은 그대로 두고 클래스 이름만 바꾸는 리팩터**(토큰 치환 등)는 셋으로 잰다(#691, ADR 0109 「글자 크기 · 모서리도 토큰이다」) — ① 앞(main)과 뒤의 `app/globals.css` 를 `@tailwindcss/postcss` 로 짓고, 뒤 이름을 앞 이름으로 되돌려 utilities 규칙의 선언이 모두 같은지 본다 ② 이름이 바뀌면 Tailwind 가 규칙 차례를 다시 정한다 — 같은 media · 같은 속성에서 차례가 뒤바뀐 짝을 뽑고, 요소마다(className 식 하나, 같은 파일 상수와 들여온 상수를 풀어서) 그 짝이 함께 붙는 자리를 센다(0 이어야 한다) ③ 요소마다 앞뒤 클래스를 크로뮴(Playwright)에 입혀 여러 폭에서 바뀐 속성의 계산값(예: `font-size` · 네 모서리)을 견준다. 도구는 저장소에 두지 않는다 — 스크래치패드에서 짓고 셈을 PR 「잰 값」에 적는다 | vitest 는 그리지 못한다(`docs/agents/test-map/kinds.md`). 화면은 스크린샷으로 보고, 누름 · 흐름은 CI 의 e2e 가 잰다. 이름만 바뀐 리팩터는 화면이 수백 곳이라 그림보다 계산값 비교가 빠짐없다 |
| `proxy.ts` · `src/lib/consent` | `npm test` → `npm run test:e2e:notice` | 관문은 링크를 눌러야 밟힌다 — `page.goto` 로는 못 잰다(ADR 0041) |
| `supabase/migrations/**` | `npm run db:reset` → `npm run test:db` → `npm run db:types` → `npm run typecheck` → `npm run test:flow` | 생성 타입을 다시 안 지으면 앱은 없는 열을 있다고 믿은 채 컴파일된다(ADR 0078). CI 의 `authed` 중 `notice` 차선이 diff 를 본다. 생성기는 grant 를 다 걷은(`revoke`) 함수도 타입에 싣는다 — Docker 가 없어 손으로 고칠 때 그 함수를 빼면 이 diff 가 붉다(2026-10-23 #809) |
| 계정마다 비공개 채널 · 웹 푸시(ADR 0155 · 0156) — `realtime.messages` 정책 · `tell_*` 트리거 · `mark_chat_read` · `push_*` 표와 문 | `npm run test:db`(`82_live_channel` · `83_push_delivery`) → `node scripts/check-live-channel.mjs`(`db:start` 가 realtime 을 띄운 스택) | pgTAP 은 역할과 `realtime.topic` 을 갈아입어 정책을, 트리거가 남긴 줄로 area · 주제 · 본문 없음을 잰다. 서버가 남의 주제를 거절하는지 · 2초 안에 닿는지는 흐름 검사가 두 계정 소켓으로 잰다 |
| 실험 · 평가(`src/lab/**` — 프롬프트 변형 · 출력 재기 · 인연 입력 두 판의 자 · 궁합 공식 비교기, ADR 0179) | `npm test` · `npm run typecheck` · `npm run lint`. 변형 본문이 바뀌면 `READING_VARIANTS_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` 는 사람이 돌린다 | 앱이 안 부르는 자리라 단위가 전부다. 변형(`src/lab/reading/variants.ts`)만 e2e 가 부르므로 CI 계획의 시험 도구(`HARNESS`)다 |
| 프롬프트(`src/lib/reading/prompt*` · `parts.ts` · `vocabulary.ts`) | `npm test`, 본문이 바뀌면 `READING_LIVE=1 npx vitest run app/me/reading/call.live.test.ts` | 조립 스냅샷은 단위가 든다. **본문이 한 글자라도 바뀌면 실호출 한 번**(ADR 0073). 경로 이름이 본문에 샌 적이 있다 |
| `scripts/ci-plan.mjs` · `release-stage.mjs` · `verify.yml` · `main-red.yml` | `npm test` | `ci-plan.test.ts` 가 단계별 계획을, `main-red.test.ts` 가 이슈의 판단을 든다. YAML 에 `paths` 를 적지 않는다. 워크플로(`.github/workflows/**`)와 `.nvmrc` 를 바꾼 PR 은 CI 가 전부를 돈다(「CI 자체」, ADR 0195) — 로컬에서 따로 돌릴 것은 없다 |
| `vercel.json` · `scripts/vercel-ignore.mjs` | `npx vitest run scripts/vercel-ignore.test.ts` | Vercel 이 Preview 를 건너뛸지. **0 이면 건너뛰고 1 이면 빌드한다** — 시험이 그 반대 의미와 「모르면 빌드」를 든다(`docs/ops/runbook/deploy.md` 「배포」) |
| `package.json` · `package-lock.json` | `npm audit --omit=dev --audit-level=high` → `npm test` · `npm run typecheck` · `npm run lint` · `npm run build` | CI 는 `core` 와 `audit` 만 돈다 — 시험 실행 의존성(Playwright · Supabase CLI 의 판, 차선 job 이 부르는 `test:e2e*` · `test:flow` · `test:db` · `db:start` · `db:types` 스크립트)이 바뀌었으면 전부다(ADR 0195). 의존성은 화면과 DB 도구에도 닿으니 큰 판 올림이면 e2e · pgTAP 도 한 번 |
| `eslint.config.mjs` · `scripts/*.test.ts` | `npm run lint` → `npm test`, 그리고 **일부러 어긴 파일**로 걸리는지 | 「규칙을 넣었다」와 「규칙이 건다」는 다른 문장이다(ADR 0085·0086) |
| 사진 저장소(G-120, ADR 0202 · 0203) — `app/me/photo/store*.ts` · `app/me/photo/s3-store.ts` · `app/me/photo/photo-response.ts` · `app/me/profile/stored-photo.ts` · `app/me/profile/photo-upload-mode.ts` · `app/api/cron/photo-sweep/**` · `src/lib/profile/photo-variants.ts` · `src/lib/profile/photo-upload-mode.ts` · `scripts/photo-verify.mjs` | `npx vitest run src/lib/profile app/me/profile app/api/cron/photo-sweep app/me/photo scripts/photo-verify.test.ts`, 표 · 함수면 `npm run test:db`(`99_photo_object_store` · `99_photo_upload_switch` · `74` · `75`) | S3 는 메모리 저장소(`memoryPhotoStore`)로 대신한다 — MinIO 같은 가짜 서버는 안 띄운다. 진짜 버킷은 여는 날 `docs/ops/runbook/photo-store.md` 「사진 저장소로 바꾼다」 5 가 잰다 |
| `app/api/cron/audit-export/**` · `scripts/db-remote.mjs` · `scripts/audit-verify.mjs` · `scripts/aws-wizard.sh` | `npx vitest run app/api/cron/audit-export scripts/db-remote.test.ts scripts/audit-verify.test.ts scripts/aws-wizard.test.ts`(자격은 복구기와 같은 모양으로 `route.test.ts` 가 든다), 표 · 함수면 `npm run test:db`(`46_operator_access_log` · `50_audit_export_runs`) · `node scripts/check-db-races.mjs`(반출과 늦은 커밋 · 거절 한도 · 같은 열쇠의 주문 · 두 반출 실행 · CLI 결과 한 줄 — 두 세션 경합, `20261013090000` · `20261014090000` · `20261015090000`) | 접속기록 반출과 CLI 기록(ADR 0105). S3 는 가짜로 대신한다 — 진짜 버킷은 AWS 계정이 서는 날 `docs/ops/runbook/security.md` 「반출」의 7 이 잰다. 마법사는 가짜 `aws` · `vercel` · `npm` 을 PATH 앞에 두고 처음 · 재실행 · 부분 실패 · 재사용 · Governance → Compliance 의 순서와, 끝이라 말하는 문(짧은 Compliance · 설정이 바뀐 뒤의 지난 검증 · Vercel 의 실제 값 — 가짜 `vercel env pull`)을 잰다 — 마법사 도서관(`STAGES` 표시 위)은 손대지 않는다 |

**병렬 라운드의 머지 직전에는 `npm run merge:sim -- <PR 번호…>` 를 한 번 돈다** — 조율자가 머지할 PR 을 머지할 순서대로
적으면 저장소 밖 임시 워크트리에서 `origin/main` 위로 차례로 합쳐 글자 충돌을 보고, 단위(`scripts/code-rules.test.ts` ·
`scripts/layers.test.ts` 포함) · 린트 · 타입을 돈다(`scripts/merge-sim.mjs`). PR 마다 초록이어도 한 PR 의 새 잠금이 다른 PR 이
새로 들인 파일을 몰라 합치면 붉었다(2026-09-28, `docs/notes/2026-09-28-overnight-audit.md`). 스택(pgTAP · e2e · 흐름)은
안 돈다 — 각 PR 의 CI 몫이다. 머지는 안 한다(`gate` 와 `--auto` 몫이다). 보호 규칙의 strict 는 2026-10-12 에 껐다 — 가지를 최신
main 으로 올리지 않아도 들고, 합친 뒤의 깨짐은 머지 뒤 main 의 전체와 `ci-main-red` 가 잡는다(ADR 0178).

**운영 소스 주석의 뿌리 경로도 잠겼다** — `app/**` · `src/**` · `proxy.ts` 의 주석(시험 파일 빼고)이 백틱으로 가리키는
`app/` · `src/` · `docs/` … 경로는 있는 파일이어야 한다(`scripts/code-rules.test.ts` 「운영 소스의 주석이 가리키는 경로」).
파일을 옮기거나 지우면 그것을 말하던 주석도 지금 자리로 고친다. 옛 자리를 일부러 말하는 역사 설명은 그 시험의 허용
목록(`파일 :: 경로` 와 까닭)에 들고, 안 쓰이는 항목은 시험이 잡는다.

**워크트리에서는 제 자리의 포트다** — `npm run stack:slot -- N` 이 스택 이름 · Supabase 포트 · dev 서버(`3000+10N`) ·
흐름 검사(`3210+10N` 부터 여덟)를 함께 옮긴다(ADR 0096). 아래는 main 체크아웃(자리 0)의 이야기다.

**먼저 죽여야 하는 것** — 3000 의 dev 서버. 로그인 e2e 와 흐름 검사는 제 서버를 띄우고,
남의 서버를 재사용하면 옛 코드를 잰다. `lsof -i :3000` 로 본다.
