# 운영 절차 — 도메인 옮기기

색인은 `docs/ops/runbook.md` 다.

## 도메인을 옮길 때 — 주소를 든 자리 아홉

**새 도메인은 `mannalmap.com` 이다**(2026-10-07, 서비스 이름 「만날지도」 — ADR 0149). 아래 표의 `<새 도메인>` 은 `mannalmap.com` 이다.
**운영 주소는 `https://mannalmap.com` 이다**(운영자, 2026-10-08) — 저장소에서 운영 주소를 적는 자리는 이 줄 하나다. `www.mannalmap.com` 은 맨 도메인으로 308 이고 인증서가 섰다.
옛 별칭 `saju-snowy.vercel.app` 은 아직 넘김 없이 같은 화면을 200 으로 낸다(2026-10-08 `curl` 로 쟀다) — 8 이 남았다.

| # | 상태 (2026-10-08) |
| --- | --- |
| 1 | 했다 — 도메인 붙음 · `www` 308 → 맨 도메인 · TLS |
| 2 | 했다 — `curl -s https://mannalmap.com/` 의 `og:image` 가 `https://mannalmap.com/brand/…` |
| 3 | 했다(2026-10-08) — Site URL `https://mannalmap.com` · Redirect URLs 에 `https://mannalmap.com/**` 를 더했다(옛 셋은 6 까지 둔다) · 운영자가 새 주소에서 구글 로그인 → `/me` 를 확인했다 |
| 4 ~ 7 | 이 저장소에서 잴 수 없다 — 운영자가 각 줄의 「확인」으로 본다 |
| 8 | 안 했다 — 옛 별칭이 200 |
| 9 | 했다 — `deploy.md` 는 주소 대신 이 문서를 가리킨다(ADR 0152) |

처음 이 표를 쓸 때(2026-09-30)는 자기 도메인이 없었다. 코드는 주소를
안 적으므로(`app/site-url.ts` 가 배포판이 아는 값을 읽는다) **바꿀 것은 전부 코드 밖이다.** 2026-09-30 에 저장소에서
주소를 드는 자리를 셌다(`grep -rn "saju-snowy\|SITE_URL\|redirectTo\|vault.create_secret"`) — 아래 아홉이다.

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
| 7 | **PortOne webhook** | **지금은 꺼져 있다**(`docs/ops/runbook/credits.md` 「결제 알림」). 켜는 날 콘솔에 넣는 주소가 새 도메인이다 | — | 켤 때 그 절의 「웹훅 테스트 호출」 |
| 8 | **옛 주소를 넘김으로** | 1~6 을 새 주소로 본 뒤, Vercel Domains 에서 `saju-snowy.vercel.app` 을 새 도메인으로 308 넘긴다. **지우지 않는다** — 이미 보낸 공유 링크(`/share/…`)가 그 주소를 들고 있다 | 옛 링크가 죽는다 | `curl -sI https://saju-snowy.vercel.app/share/x` 가 308 · `location: https://<새 도메인>/share/x` |
| 9 | **`docs/ops/runbook/deploy.md`** | 「배포」의 운영 주소 · 「묶음 배포」 3 의 Aliases · 「CSP 가 화면을 막을 때」의 `curl` 이 옛 별칭을 든다. 새 도메인으로 고치는 PR 을 같은 날 넣는다. `scripts/check-share.mjs` 의 `HOST` 는 흉내 낸 값이라 그대로다 | 다음 사람이 옛 주소로 smoke 한다 | `grep -rn saju-snowy docs/ops` 가 넘김 설명 한 줄만 |

**안 바뀌는 것.** CSP(`next.config.ts`)는 `'self'` 와 Supabase 주소뿐이다. Vercel Cron(`vercel.json`)은 경로만 든다. 접속기록
반출의 AWS 역할은 Vercel OIDC 의 팀 · 프로젝트로 믿으므로 도메인과 상관없다(`docs/ops/runbook/security.md` 「반출 — 매일 S3」). 알림 주소(`ops_alert_url`)는
Slack · Discord 쪽이다.

**모두가 한 번 다시 로그인한다** — 세션 쿠키는 오리진마다다. 미리 알릴지 · 무엇이라 알릴지는 옮기는 날 운영자가 정한다
(화면 문구 — `docs/agents/delegation/decisions.md` 「결정 점검표」).
