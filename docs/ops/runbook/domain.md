# 운영 절차 — 도메인 옮기기

색인은 `docs/ops/runbook.md` 다.

## 도메인을 옮길 때 — 주소를 든 자리 열

**새 도메인은 `mannalmap.com` 이다**(2026-10-07, 서비스 이름 「만날지도」 — ADR 0149). 아래 표의 `<새 도메인>` 은 `mannalmap.com` 이다.
**운영 주소는 `https://mannalmap.com` 이다**(운영자, 2026-10-08) — 저장소에서 운영 주소를 적는 자리는 이 줄 하나다. `www.mannalmap.com` 은 맨 도메인으로 308 이고 인증서가 섰다. 이 줄의 꼴을 `scripts/deploy-smoke.mjs` 가 읽는다 — 꼴을 바꾸면 그 시험(`scripts/deploy-smoke.test.ts`)이 붉어진다.
옛 별칭 `saju-snowy.vercel.app` 은 아직 넘김 없이 같은 화면을 200 으로 낸다 — 8 이 남았다.

### 확인 기록 — 도메인 걸음의 상태는 여기 한 곳이다

OAuth 되돌아옴 · 복구기 주소 · OpenAI 웹훅 · 옛 주소 넘김이 어디까지 왔는지는 **이 표만 적는다** — 다른 문서 · ADR · 이슈는 이 표를
가리킨다. 「확인 전」은 아무도 그 화면을 본 기록이 없다는 뜻이다(했다는 뜻도, 안 했다는 뜻도 아니다). 줄을 고칠 때는 날짜와 잰 방법을 함께 바꾼다.

| # | 상태 | 언제 · 어떻게 쟀나 | 남은 걸음 · 누가 |
| --- | --- | --- | --- |
| 1 | 했다 | 2026-10-23 `curl` — 맨 도메인 `/` 200 · `www` 308 → 맨 도메인 | — |
| 2 | 했다 | 2026-10-23 `curl` — `og:image` 가 새 도메인의 `/brand/…` | — |
| 3 | 했다 | 2026-10-08 운영자 — Site URL 을 새 주소로, Redirect URLs 에 새 도메인의 `/**` 를 더함, 새 주소에서 구글 로그인 → `/me` | 옛 주소의 Redirect URLs 셋은 8 뒤에 걷는다. 지금 남아 있는지는 **확인 전**(대시보드를 안 봤다) |
| 4 | **확인 전** | 저장소에서 못 잰다 | 운영자 — Google Cloud Console → OAuth consent screen 의 승인된 도메인 · 앱 홈 · 처리방침 링크가 새 도메인인지 본다(#304) |
| 5 | **안 했다** | 2026-10-23 `db:remote` — Vault `reading_recovery_url` 의 호스트가 **옛 별칭**이다(호스트만 읽었다 — 비밀이 아닌 공개 주소). 지난 한 시간 복구기 부름 60번이 모두 200 — 옛 별칭이 200 이라 지금은 돈다 | 8 **전에** 아래 5 의 한 줄. 운영 SQL 이라 운영 베타에서는 에이전트가 밟고 값을 적는다(`docs/agents/delegation/permissions.md` 「권한 등급」) |
| 6 | **확인 전** | 저장소에서 못 잰다 — 결과가 웹훅으로 왔는지 복구기로 왔는지 DB 에 남지 않는다 | 운영자 — platform.openai.com → Settings → Webhooks 의 endpoint 호스트가 새 도메인인지 본다(#304). 옛 별칭이면 아래 6 |
| 7 | 해당 없음 | 결제 알림이 꺼져 있다(`docs/ops/runbook/credits.md` 「결제 알림」) | 켜는 날 새 도메인으로 |
| 8 | 안 했다 | 2026-10-23 `curl` — 옛 별칭 `/` 200 | 5 · 6 이 새 도메인으로 선 뒤 |
| 9 | 했다 | `deploy.md` 는 주소 대신 이 문서를 가리킨다(ADR 0152) | — |
| 10 | 해당 없음 | 2026-10-23 `db:remote` — Vault `push_dispatch_url` 이 없다(웹 푸시는 G-71 보류) | 켜는 날 새 도메인으로 넣는다(`docs/ops/runbook/push.md`) |
| 11 | 해당 없음 | 2026-10-23 — Vault `photo_sweep_url` 은 `20261229090000` 이 처음 쓰는 이름이고 사진 저장소가 꺼져 있다(G-120) | 켜는 날 새 도메인으로 넣는다(`docs/ops/runbook/photo-store.md` 「사진 저장소를 켠다」 6) |

처음 이 표를 쓸 때(2026-09-30)는 자기 도메인이 없었다. 코드는 주소를
안 적으므로(`app/site-url.ts` 가 배포판이 아는 값을 읽는다) **바꿀 것은 전부 코드 밖이다.** 2026-09-30 에 저장소에서
주소를 드는 자리를 셌다(`grep -rn "saju-snowy\|SITE_URL\|redirectTo\|vault.create_secret"`) — 아래 아홉이다. 2026-10-08 에
웹 푸시의 배달 주소(Vault `push_dispatch_url`, ADR 0156)가 더해져 열이다 — 2026-10-23 에 다시 세며 찾았다. 같은 날 사진 청소의
주소(Vault `photo_sweep_url`, ADR 0205)가 더해져 열하나다.

**순서가 뜻을 갖는다 — 옛 주소를 끝까지 살려 둔다.** 밖에서 우리를 부르는 것(복구기 · OpenAI 의 webhook · 구글 로그인의
되돌아옴)은 `POST` 나 한 번뿐인 되돌림이라 **308 넘김을 믿을 수 없다.** 새 주소가 서고, 부르는 쪽을 다 옮기고, 새 주소로
하나씩 닿는 것을 본 **뒤에** 옛 주소를 넘김으로 바꾼다. 두 주소가 함께 서는 동안은 아무것도 안 끊긴다.

| # | 자리 | 무엇을 하나 | 안 하면 | 확인 |
| --- | --- | --- | --- | --- |
| 1 | **Vercel 도메인** | Project → Settings → Domains 에 더하고 DNS(A · CNAME)를 건다. 이 단계에서는 옛 별칭을 **넘김으로 바꾸지 않는다** | — | `curl -sI https://<새 도메인>/` 가 200 이고 인증서가 선다 |
| 2 | **다시 배포** | `docs/ops/runbook/deploy.md` 「묶음 배포」를 한 번. `VERCEL_PROJECT_PRODUCTION_URL` 은 배포마다 채워지는 값이라 도메인을 붙인 뒤의 배포부터 새 주소를 든다. 대표 주소를 못박고 싶으면 Vercel **Production** 에 `SITE_URL=https://<새 도메인>` 을 넣는다(`app/site-url.ts` 가 맨 앞에 읽는다) | 링크 미리보기의 그림 주소(`metadataBase`)가 옛 별칭을 가리킨다 — 옛 별칭이 살아 있는 동안은 보이지만, 넘김으로 바꾼 뒤 수집기가 못 따라가면 그림이 빈다 | `curl -s https://<새 도메인>/ \| grep -o 'og:image" content="[^"]*'` 가 새 도메인이다 |
| 3 | **Supabase Auth URL** | 대시보드 Authentication → URL Configuration 의 Site URL 을 새 주소로, Redirect URLs 에 `https://<새 도메인>/**` 를 더한다(`/auth/callback` 을 덮는다)(옛 것은 6 까지 둔다). **`supabase config push` 로 넣지 않는다**(`docs/ops/runbook/access.md` 맨 위 경고) | `redirectTo`(`app/auth/sign-in-button.tsx`)가 목록에 없으면 Supabase 가 **Site URL 로 돌려보낸다** — 새 주소에서 로그인한 사람이 옛 주소에 떨어지고, 세션 쿠키는 오리진마다라 새 주소에서는 로그아웃 상태다 | 새 주소의 새 창에서 구글 로그인 → 새 주소의 `/me` 에 선다 |
| 4 | **구글 OAuth 동의 화면** | Google Cloud Console → OAuth consent screen 의 승인된 도메인 · 앱 홈 · 처리방침 링크가 있으면 새 도메인으로. 승인된 리디렉션 URI 는 **Supabase 의 `…supabase.co/auth/v1/callback`** 이라 그대로다 | 브랜드 확인을 받은 뒤라면 동의 화면이 경고를 띄울 수 있다 | 3 과 같은 로그인이 경고 없이 지난다 |
| 5 | **Vault `reading_recovery_url`** | `select vault.update_secret((select id from vault.secrets where name = 'reading_recovery_url'), 'https://<새 도메인>/api/cron/reading');` — 1분 복구기가 `pg_net` 으로 부르는 주소(`docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표) | 넘김으로 바꾼 뒤 복구기가 308 을 받는다 → `cron-watch` 가 `net-request-failed` 를 보낸다. 결과는 webhook 이 살아 있으면 붙지만 멈춘 풀이를 아무도 안 줍는다 | 2분 뒤 `select status_code, created from net._http_response order by created desc limit 3;` 가 200 |
| 6 | **OpenAI webhook** | platform.openai.com → Settings → Webhooks 의 endpoint 를 `https://<새 도메인>/api/openai/webhook` 으로. 주소를 고칠 수 없어 새로 만들면 **서명 비밀이 바뀐다** — `docs/ops/runbook/secret-leak.md` 「비밀이 새면」의 `OPENAI_WEBHOOK_SECRET` 줄을 그대로 밟는다 | 결과가 1분 늦게 복구기로만 붙는다(ADR 0020). 비밀만 바뀌고 Vercel 에 안 넣으면 401 | 새 풀이 하나가 끝나고 `reading_run` 의 그 줄이 1분 안에 `succeeded` |
| 7 | **PG 결과 통지(웹훅)** | **지금은 꺼져 있다**(`docs/ops/runbook/credits.md` 「결제 알림」). 지금 문은 PortOne 전제이고, PG 와 연동 방식은 미정이다(ADR 0194 — PortOne 경유 · KG파이낸셜 · KPN · 갤럭시아머니트리 후보) — 켜는 날 PortOne 콘솔(또는 직접 맺은 PG사)에 넣는 주소가 새 도메인이다 | — | 켤 때 그 절의 「웹훅 테스트 호출」 |
| 8 | **옛 주소를 넘김으로** | 1~6 을 새 주소로 본 뒤, Vercel Domains 에서 `saju-snowy.vercel.app` 을 새 도메인으로 308 넘긴다. **지우지 않는다** — 이미 보낸 공유 링크(`/share/…`)가 그 주소를 들고 있다 | 옛 링크가 죽는다 | `curl -sI https://saju-snowy.vercel.app/share/x` 가 308 · `location: https://<새 도메인>/share/x` |
| 9 | **`docs/ops/runbook/deploy.md`** | 「배포」의 운영 주소 · 「묶음 배포」 3 의 Aliases · 「CSP 가 화면을 막을 때」의 `curl` 이 옛 별칭을 든다. 새 도메인으로 고치는 PR 을 같은 날 넣는다. `scripts/check-share.mjs` 의 `HOST` 는 흉내 낸 값이라 그대로다 | 다음 사람이 옛 주소로 smoke 한다 | `grep -rn saju-snowy docs/ops` 가 넘김 설명 한 줄만 |
| 10 | **Vault `push_dispatch_url`** | 웹 푸시를 켰으면(G-71) **8 전에** `select vault.update_secret((select id from vault.secrets where name = 'push_dispatch_url'), 'https://<새 도메인>/api/push/dispatch');` — 배달 줄이 생길 때와 1분마다 `pg_net` 이 부르는 주소(`docs/ops/runbook/push.md`). 켜지 않았으면 켜는 날 새 도메인으로 넣는다 | 넘김으로 바꾼 뒤 배달 깨움이 308 을 받는다 → `net-request-failed` · 새 메시지 알림이 안 간다 | 2분 뒤 `net._http_response` 에 200 |
| 11 | **Vault `photo_sweep_url`** | 사진 저장소를 켰으면(G-120) **8 전에** `select vault.update_secret((select id from vault.secrets where name = 'photo_sweep_url'), 'https://<새 도메인>/api/cron/photo-sweep');` — 매시 33분 `pg_net` 이 부르는 사진 청소 주소(ADR 0205, `docs/ops/runbook/photo-store.md`). 켜지 않았으면 켜는 날 새 도메인으로 넣는다 | 넘김으로 바꾼 뒤 청소가 308 을 받는다 → `net-request-failed`, 세 시간 뒤 `photo-sweep-stale` — 예비인 Vercel 의 하루 한 번만 돈다 | 다음 매시 33분 뒤 `photo_sweep_state.last_finished_at` 이 방금 |

**안 바뀌는 것.** CSP(`next.config.ts`)는 `'self'` 와 Supabase 주소뿐이다. Vercel Cron(`vercel.json`)은 경로만 든다. 접속기록
반출의 AWS 역할은 Vercel OIDC 의 팀 · 프로젝트로 믿으므로 도메인과 상관없다(`docs/ops/runbook/security.md` 「반출 — 매일 S3」). 알림 주소(`ops_alert_url`)는
Slack · Discord 쪽이다.

**모두가 한 번 다시 로그인한다** — 세션 쿠키는 오리진마다다. 미리 알릴지 · 무엇이라 알릴지는 옮기는 날 운영자가 정한다
(화면 문구 — `docs/agents/delegation/decisions.md` 「결정 점검표」).
