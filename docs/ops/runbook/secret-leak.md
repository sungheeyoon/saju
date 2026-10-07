# 운영 절차 — 비밀이 새면

색인은 `docs/ops/runbook.md` 다.

## 비밀이 새면 — **교체가 먼저다** (G-23 ⑧)

비밀은 **서버 환경변수(Vercel)와 Supabase Vault 에만 있다.** 브라우저로 가는 파일에 비밀 이름이나
그 빌드의 비밀 값이 있으면 `npm run build` 끝의 `scripts/secret-env.mjs` 가 빌드를 세운다 — Vercel 의
운영 빌드도 진짜 값을 들고 이 검사를 지나며, 값은 찍지 않고 이름과 파일만 말한다. 코드가 읽는 이름의
갈래(비밀 · 공개 · 설정)와 비밀을 읽는 모듈의 `import 'server-only'` 는 `scripts/secret-env.test.ts` 가
잰다. **그 시험이 이 절도 읽는다** — 앱의 비밀과 마이그레이션이 Vault 에서 읽는 이름마다 아래 표에 줄이
있어야 초록이다. 새 비밀은 이 표에 줄이 서야 들어온다.

**순서는 넷이고 늘 같다.**

1. **새 값을 만든다 — 옛 값을 끄기 전에.** 둘이 함께 유효한 동안에는 아무것도 안 멈춘다.
2. **넣는다.** Vercel 은 대시보드 Settings → Environment Variables 에서 그 이름의 값을 고친다(표가
   말하는 환경 전부). **Vercel 변수는 새 배포부터 읽힌다** — Deployments 의 최신 Production 에서
   Redeploy 하고 Ready 를 본다. 값 교체는 사람이 대시보드에서 한다(에이전트에게 `vercel env rm` 은
   등급 4 다, `docs/agents/delegation/permissions.md`). Vault 는 SQL Editor 에서 고치고 재배포가 없다 — 다음 호출이 읽는다:

   ```sql
   select vault.update_secret((select id from vault.secrets where name = '<이름>'), '<새 값>');
   select name, updated_at from vault.secrets order by name;   -- 값은 안 본다
   ```

   로컬 `.env.development.local` 에 그 이름이 있으면 손으로 고친다(Secret 은 `vercel env pull` 로 안 온다).
3. **확인한다** — 표의 「확인」.
4. **옛 값을 끊는다.** 끊기 전에 3 을 본다 — 끊는 순간부터 옛 값을 든 자리는 멈춘다.

| 비밀 | 새 값은 어디서 | 넣는 자리 | 옛 값이 먼저 끊기면 멈추는 것 | 확인 · 끊기 |
| --- | --- | --- | --- | --- |
| `SUPABASE_SECRET_KEY` | Supabase 대시보드 → Project Settings → API Keys → Secret keys 에서 새 키. 여럿이 함께 선다 | Vercel **Production** · 로컬 → 재배포 | 열쇠를 쓰는 자리 전부(`app/keyed-client.ts`) — 풀이 생성의 계산 입력과 저장, webhook 영수증(503 이라 provider 가 72시간 다시 보낸다), 복구기(503 → `net-request-failed` 알림) | 새 배포에서 풀이 하나가 끝나는가. 그 뒤 옛 키를 지운다 |
| `SUPABASE_SERVICE_ROLE_KEY` | 운영에 없다 — 로컬 스택의 옛 이름 갈래이고 그 값은 `supabase status` 가 내는 개발 키다 | — | — | 운영 프로젝트의 **legacy `service_role` JWT** 가 켜져 있으면 같은 힘이다. 새면 API Keys 의 legacy 키를 끈다 — 앱은 발행 키와 새 비밀 키만 쓴다 |
| `OPENAI_API_KEY` | platform.openai.com → API keys. **같은 프로젝트**에 만든다 — 회수는 제출한 작업을 그 프로젝트에서 찾는다 | Vercel **Production · Preview** · 로컬(실호출) → 재배포 | 제출(`model-submit-failed`)과 **이미 떠난 작업의 회수** — 못 가져온 작업은 8분 deadline 에 닫히고, 토큰은 나갔는데 글은 없다 | 새 배포 Ready 뒤 `select count(*) from public.open_reading_jobs();` 가 0 일 때 옛 키를 끈다 |
| `OPENAI_WEBHOOK_SECRET` | platform.openai.com → Settings → Webhooks. 서명 비밀은 만들 때 한 번만 보이므로 **같은 주소로 endpoint 를 새로 만든다** | Vercel **Production** → 재배포 | webhook 이 401 이다. **결과는 안 잃는다** — 복구기가 1분마다 줍는다(ADR 0020). 늦어질 뿐이다. 두 endpoint 가 겹쳐 같은 결과가 두 번 와도 회수는 일감을 한 번만 집는다(`claim_reading_job`) | 새 배포 Ready 뒤 옛 endpoint 를 지운다. `CRON_SECRET` 과 같은 값을 쓰지 않는다 |
| `CRON_SECRET` = Vault `reading_recovery_secret` | 우리가 짓는다 — `openssl rand -base64 32` | **두 자리가 같은 값이다** — Vercel **Production**(Vercel Cron 이 이 값을 `Authorization: Bearer` 로 싣는다) → 재배포, 그리고 Vault `reading_recovery_secret` | 둘이 갈린 동안 1분 복구기가 403 이다 → `net-request-failed` 알림. webhook 이 살아 있으면 결과는 그대로 붙는다 | 새 배포 Ready 직후 Vault 를 바꾼다(창이 그만큼 짧다). `select status_code, created from net._http_response order by created desc limit 3;` 가 200. 두 자리를 다 바꾸면 옛 값은 끊긴 것이다 |
| `VERCEL_OIDC_TOKEN` | **우리가 만들지 않는다** — Vercel 이 함수 호출마다 짓고 짧게 산다(반출의 기본안, `docs/ops/runbook/security.md` 「반출」). `AUDIT_EXPORT_ROLE_ARN` 은 비밀이 아니다 | 없다 — Vercel 프로젝트 Settings → Security → OIDC Federation 이 켜져 있으면 선다 | 토큰 하나가 새도 그 수명 동안만 역할의 자격이다(`s3:PutObject` 하나) | 새면 AWS IAM 역할의 신뢰 정책에서 조건(`sub`)을 좁히거나 역할의 세션을 끊는다(IAM → Roles → Revoke active sessions). 반출은 다음 호출의 새 토큰으로 이어진다 |
| `AUDIT_EXPORT_ACCESS_KEY_ID` · `AUDIT_EXPORT_SECRET_ACCESS_KEY` | **역할을 못 세운 날의 대안이다**(기본은 위 OIDC 역할). AWS IAM → 반출 사용자(`saju-audit-export`) → Security credentials → Create access key. 한 사용자에 키가 둘까지 함께 선다 | Vercel **Production** → 재배포. `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` 은 비밀이 아니다(같은 자리에 넣는다) | 그날 반출이 실패한다(500, Vercel 로그). **기록은 안 잃는다** — DB 에 남아 있고 다음 반출이 이어 올린다 | 새 배포 Ready 뒤 크론을 손으로 한 번 부르거나 다음 날 `select max(exported_at) from audit.operator_access_export` 가 오늘이면 옛 키를 Deactivate → Delete. **키가 새도 올린 객체는 못 지운다** — 권한이 `s3:PutObject` 뿐이고 Object Lock 이 잠갔다. 새 객체를 쓸 수는 있으므로 교체가 먼저다 |
| `PORTONE_WEBHOOK_SECRET` | PortOne 관리자 콘솔 → 결제 연동 → 웹훅 → 그 주소의 시크릿(`whsec_…`). 새 시크릿을 발급하면 옛 것과 함께 설 수 있는지는 가맹 때 본다(G-23 ⑥) | Vercel **Production** → 재배포 | 결제 알림이 401 이다. **돈은 들어왔는데 묶음이 안 선다** — PortOne 은 다섯 번까지(0 → 256분) 다시 보내므로 그 안에 새 값이 서면 붙는다. 넘기면 콘솔의 재전송으로 다시 보낸다(`approve_reading_order` 는 같은 알림 · 같은 거래 번호를 한 번만 적는다) | 새 배포 Ready 뒤 콘솔의 「웹훅 테스트 호출」이 200 인지 본다. 서명이 여럿이면 하나만 맞아도 되므로(`signature.ts`) 옛 시크릿은 그 뒤에 끈다 |
| `PORTONE_API_SECRET` | PortOne 관리자 콘솔 → 결제 연동 → 연동 정보 → V2 API 시크릿 재발급 | Vercel **Production** → 재배포. `PORTONE_STORE_ID` 는 비밀이 아니다(같은 자리에 넣는다) | 결제 알림이 금액을 못 받아 503 이다 — 위와 같이 PortOne 이 다시 보낸다. **키가 새면 남이 결제를 조회 · 취소할 수 있다** — 교체가 먼저다 | 새 배포 Ready 뒤 콘솔의 테스트 호출이 200 이면 옛 시크릿을 폐기한다 |
| `TASTE_BROWSER_SECRET` | 우리가 짓는다 — `openssl rand -hex 32` | Vercel **Production · Preview** · 로컬 `.env.development.local`(앱을 로컬에서 돌릴 때) → 재배포 | 로그인 전 사주 문단이 닫힌다(값이 없으면). **값을 바꾸면 열린 미가입 세션의 귀속이 끊긴다** — 같은 쿠키가 다른 HMAC 이 되어 그 세션을 못 읽고 못 붙인다(`not_found`). 그 사람은 문단을 새로 받고(같은 입력이면 생성 결과를 다시 써 모델을 안 부른다) 이어쓰기 없이 가입할 수 있다. 미가입 세션은 어차피 24시간 안에 지워진다 | 새 배포 Ready 뒤 비로그인 창에서 문단 하나를 받고 새로고침해 같은 글이 서는지 본다. 옛 값은 남겨 둘 자리가 없다 — 교체가 곧 끊기다. 사람이 적은 시간에 한다 |
| `TASTE_IP_SECRET` | 우리가 짓는다 — `openssl rand -hex 32` | Vercel **Production · Preview** · 로컬 `.env.development.local` → 재배포 | 로그인 전 사주 문단이 닫힌다(값이 없으면). 이 값은 **날짜별 키의 뿌리**다 — 서버가 `HMAC(이 값, 서울 날짜)` 로 그날의 키를 짓고 그 키로 IP 를 HMAC 한다. 바꾸면 그날 IP 빗장(1분 3 · 하루 20 · 요청 1분 30)이 처음부터 다시 센다. 귀속 · 이미 만든 글에는 영향이 없다. 옛 HMAC 은 24시간 안에 지워진다 | 새 배포 Ready 뒤 문단 하나를 받고 `taste_daily` 의 오늘 줄 `call_model` 또는 `reuse_succeeded` 가 하나 는 것을 본다 |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | 우리가 짓는다 — `node scripts/push-vapid-keys.mjs`(공개 · 비밀 한 쌍). **공개 열쇠 `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` 와 함께 바꾼다** — 둘은 한 쌍이다(ADR 0157) | Vercel **Production** 에 둘 다 → 재배포 | **옛 쌍으로 맺은 구독은 새 쌍으로 못 보낸다** — 푸시 서비스가 거절하고(403) 배달은 다섯 번 뒤 접힌다. 사람마다 설정에서 알림을 껐다 다시 켜야 새 쌍으로 다시 맺는다. 그래서 「둘이 함께 유효한 창」이 없다 | 새 배포 Ready 뒤 설정에서 알림을 다시 켠 기기 하나에 다른 계정이 메시지를 보내 통보가 서는지 본다. 옛 쌍은 남겨 둘 자리가 없다 — 교체가 곧 끊기다 |
| `PUSH_DISPATCH_SECRET` = Vault `push_dispatch_secret` | 우리가 짓는다 — `openssl rand -base64 32`. `CRON_SECRET` 과 다른 값이다 | **두 자리가 같은 값이다** — Vercel **Production**(배달 문 `/api/push/dispatch` 가 `Authorization: Bearer` 로 견준다) → 재배포, 그리고 Vault `push_dispatch_secret` | 둘이 갈린 동안 DB 가 배달 문을 깨우면 403 이다 → `net-request-failed` 알림. **통보는 안 잃는다** — 배달 줄이 `pending` 으로 남고 값이 맞춰진 뒤 1분 크론(`push-dispatch`)이 보낸다(ADR 0157) | 새 배포 Ready 직후 Vault 를 바꾼다. 배달 줄이 쌓이지 않는다 — `select count(*) from public.push_delivery where status = 'pending' and due_at < now() - interval '5 minutes';` 가 0 |
| Vault `push_dispatch_url` | 비밀이 아니다 — 공개 주소(`/api/push/dispatch`). 도메인이 바뀔 때만 고친다 | Vault | — | — |
| Vault `reading_recovery_url` | 비밀이 아니다 — 공개 주소(`/api/cron/reading`). 도메인이 바뀔 때만 고친다 | Vault | — | — |
| Vault `ops_alert_url` | **주소 자체가 열쇠다** — 가진 사람은 운영 채널에 글을 넣는다. Slack 앱의 Incoming Webhooks 나 Discord 채널의 연동 → 웹후크에서 새 주소를 만든다 | Vault(재배포 없음) | 알림이 채널로 안 나간다. `ops_alert` 표에는 그대로 적힌다 | `docs/ops/runbook/ai.md` 「운영자 알림 배선」의 `notify_ops('ops-alert-test', …)` 가 닿으면 옛 웹후크를 지운다 |
| Vault `ops_alert_secret` | 넣었을 때만 있다 — 받는 쪽이 `Authorization` 을 볼 때 | Vault 와 받는 쪽을 함께 | 받는 쪽이 알림을 거절한다 | 위와 같다 |
| 구글 로그인 client secret | 코드에 없다 — Supabase Auth 가 든다. Google Cloud Console → Credentials → 그 OAuth client 에서 secret 을 더한다 | Supabase 대시보드 Authentication → Providers → Google(재배포 없음). **`supabase config push` 로 넣지 않는다**(`docs/ops/runbook/access.md` 맨 위 경고) | 구글 로그인 전부 | 새 창에서 로그인이 되면 Google 에서 옛 secret 을 끈다 |

- **운영자 자격**(Supabase access token · DB 비밀번호 · Vercel · GitHub 토큰)은 코드에 없다. 각 대시보드에서
  폐기하고 다시 만든다. MFA 는 G-23 ⑨ 가 든다.
- **무료 지급 HMAC 키는 아직 코드에 없다**(G-20 이 만든다). 들어오는 PR 이 이 표에 줄을 더한다. 미리 적어 둘
  사실 하나 — **키를 바꾸면 저장된 식별값 전부와 대조가 끊긴다.** 원문(CI)을 안 남기므로 새 키로 옮길 길이
  없다(ADR 0101). 끊기면 그날 전에 떠난 사람이 다시 들어와 무료 몫을 또 받는다. 새었을 때 교체할지와 옛
  식별값의 처분은 그 PR 이 G-25 ⑧ 과 함께 정한다. **CI 의 HMAC 식별값도 개인정보로 다룬다**(2026-09-24 확인) —
  같은 사람을 다시 알아보는 값이라 키가 새면 식별값이 곧 그 사람을 가리킨다. 그래서 식별값은 서버 열쇠의 문만
  읽고(API 역할에 닫는다), 운영자는 SQL 로 읽지 않으며(읽어야 하면 break-glass), 키는 서버 환경변수 · Vault 에만 둔다.
  교체는 위 순서 넷을 따르되 옛 키로 지은 식별값을 새 키로 옮길 길이 없다는 것을 먼저 정한다.
- **PG 키는 위 두 줄이다**(PortOne V2, 2026-09-24 — 코드는 섰고 값은 가맹 뒤에 넣는다). **본인확인 키는 아직 없다** — 들어올 때 이 표에 줄을 더한다.

**git 기록에 새었을 때.** 푸시된 순간 샌 것으로 본다 — 클론 · 포크 · CI 로그가 이미 들고 있다.

1. **교체가 먼저다** — 위 표대로. 기록을 먼저 지우면 그동안 값은 살아 있다.
2. 어디에 있는지 찾는다 — 값을 화면에 찍지 않도록 앞 몇 글자로 센다:
   `git log --all -S '<앞 8글자>' --oneline`
3. 기록 정리(`git filter-repo` · main force push)는 **사람이 한다** — 에이전트에게 등급 4 다. 교체가 끝났으면
   남은 것은 끊긴 값이라 정리는 급하지 않다.

로그 · 에러 응답에 새었을 때도 교체가 먼저다. 2026-09-24 에 잰 값 — git 역사 전체에 비밀 모양의 문자열
(`sk-` · `sb_secret_` · `whsec_` · JWT · Slack · Discord 웹후크)은 없다(CI 의 껍데기 발행 키
`sb_publishable_ci_placeholder` 뿐). `.env*` 는 `.gitignore` 가 막고 추적되는 것은 `supabase/.env`(포트,
비밀 아님) 하나다. 앱의 `console.error` 넷 중 환경변수를 싣는 것은 없고, webhook 의 401 은 SDK 오류 문장을
답에 싣지 않는다(그날 고쳤다 — 「서명 비밀이 비었다」가 아무에게나 갔다).
