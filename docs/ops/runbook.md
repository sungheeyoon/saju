# 운영 절차

폐쇄 초대 MVP 를 운영하는 데 필요한 일들. **화면은 없다** — `prd-archive` 가 초기에는 UI 대신
감사 가능한 관리자 절차를 쓸 수 있다고 했고, 지금이 그 단계다. 이 문서가 그 「절차」다.

여기 적힌 것을 그대로 실행할 수 있어야 한다. 기억에 기대면 초대 하나를 넣는 데도
표 이름을 더듬게 되고, 급할 때 더듬는 것은 대개 제재 쪽이다.

## 어디서 실행하나

Supabase 대시보드의 SQL Editor 에서 **원격 프로젝트**에 대고 실행한다.
`xgdeguyxgkillndraonc` — 배포된 앱이 보는 곳이다. **서울(`ap-northeast-2`)에 있다.**

> **옛 ref `skxtqxajfmxiusqrgbuf` 는 이제 아니다.** 프로젝트를 서울로 옮겼고, 이 문서가
> 한동안 옛 ref 를 가리키고 있었다. 여기 적힌 SQL 을 그 프로젝트에 대고 돌리면 아무
> 사용자도 없는 곳을 고치게 된다 — 실행 전에 주소창의 ref 를 눈으로 맞춘다.

로컬에서 연습하려면 `npm run db:start` 뒤에:

```bash
docker exec -i supabase_db_saju psql -U postgres -c "<문장>"   # 워크트리면 supabase_db_saju_wtN
```

> **`supabase config push` 를 쓰지 않는다.** 원격의 구글 설정을 지운다.

### 개인정보는 화면으로만 — 원격 SQL 의 경계 (ADR 0105)

**이용자 개인정보(이메일 · 닉네임과 사람의 짝 · 메시지 본문 · 출생정보 · 풀이)를 읽는 것은 `/ops/**` 화면으로만 한다.**
화면의 문은 읽을 때마다 접속기록(`audit.operator_access`)에 한 줄을 적는다. 이 문서의 SQL 은 둘로 갈린다.

| 갈래 | 무엇 | 누가 · 어떻게 |
| --- | --- | --- |
| **보통** | 개인을 가리키지 않는 것 — 건수 · 집계 · 마이그레이션 상태 · 크론 · 설정 한 칸 · 신고 id 로 적는 검토 기록 | 사람이든 에이전트든 `npm run db:remote -- --purpose "<목적>" "<sql>"`. 목적과 SQL 의 sha256 이 접속기록에 남는다 |
| **break-glass** | 이메일 · 닉네임과 계정의 짝 · 메시지 본문 · 출생정보를 **SQL 로** 읽는 것 — 아래 「break-glass」 | **사람만.** 장애 · 수사기관의 적법한 요청처럼 화면으로 못 하는 때에만, 밖의 대장에 먼저 적고 |

**에이전트는 운영 개인정보를 예외 없이 직접 조회하지 않는다**(`docs/agents/delegation.md` 등급 3). 필요하면 질의를 써서
건네고 사람이 검토해 실행한다. 이 문서에서 `auth.users` 의 이메일이나 메시지 본문을 읽는 질의에는 **break-glass** 라고
적혀 있다. 대시보드 SQL Editor 는 접속기록이 안 남는 자리다 — 거기서 개인정보를 읽지 않는다. 빈도가 늘면 `pgaudit` 로
옮긴다.

#### break-glass — 사람만, 대장 먼저

1. **까닭을 가른다.** 화면(`/ops/reports`)으로 되는 일이면 화면으로 한다. break-glass 는 장애(화면이 안 열리는데 지금
   봐야 한다) · 수사기관의 적법한 요청(「수사기관의 요청이 오면」) · 떠난 사람의 신고(`retention.report`, 화면에 없다)뿐이다
2. **대장에 먼저 적는다** — 저장소 밖의 운영 문서(수사기관 요청 대장과 같은 자리). 칸은 다섯이다:
   **목적**(무엇을 왜) · **실행자** · **대상**(신고 id · 계정 UUID — 이메일이 아니라) · **시각**(시작 · 끝) · **결과**(무엇을
   봤고 어디에 썼나, 밖으로 나갔으면 누구에게)
3. **`npm run db:remote -- --purpose "break-glass: <대장의 번호>" "<sql>"`** 로 보낸다 — 대시보드가 아니라. 목적과 해시가
   접속기록에 남아 대장과 이어진다. **대장과 접속기록은 따로 선다** — 보통 질의의 CLI 기록(목적 · SQL 해시 · 실행자 ·
   시각 · 성공/실패)은 「무엇을 보냈나」만 들고, 대장의 다섯 칸(대상 · 사유 · 결과 · 실행자 · 시각)은 「누구 것을 왜 봤고
   어디에 썼나」를 든다. break-glass 는 **둘 다** 있어야 한 건이다 — 접속기록만 있고 대장이 없으면 그것이 이상 신호다
   (월 점검의 1 에서 `break-glass:` 목적의 줄을 대장과 맞춘다)
4. 결과를 저장소 · 이슈 · 채팅에 붙이지 않는다

### 접속값은 여섯이고 넣는 손은 하나다

서울로 옮기면서 **Vercel 마켓플레이스 통합을 끊었다.** 그 통합이 같은 값을 이름 두 벌로
넣어 주고 있었고(`NEXT_PUBLIC_` 접두사, 그리고 옛 `anon`·`service_role` 이름), 코드가
주소를 이름 둘로 찾고 있었다. 지금은 넣는 자리가 손 하나뿐이라 그 갈래가 도달할 수 없다.

| 이름 | 어디서 쓰나 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저와 서버 양쪽 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 |
| `SUPABASE_SECRET_KEY` | 서버 전용 — `definer` 함수를 부르는 자리 |
| `OPENAI_API_KEY` · `OPENAI_WEBHOOK_SECRET` | 풀이 생성과 webhook. 키는 Production · Preview, 서명 비밀은 Production 만(2026-09-24 `vercel env ls`) |
| `CRON_SECRET` | 복구기를 깨우는 자리 |

- **`NEXT_PUBLIC_` 이 붙으면 브라우저가 본다.** 열쇠를 그 접두사로 넣는 순간 공개된다.
- `POSTGRES_*` 일곱과 `SUPABASE_JWT_SECRET`, 옛 이름 키 넷은 **코드가 한 번도 안 읽어서**
  함께 지웠다. 다시 생기면 통합이 도로 붙은 것이다.
- **열쇠 쪽 이름 갈래는 로컬에만 남겼다.** `supabase status` 가 `SECRET_KEY` 를 안 내주는
  판본에서는 `SERVICE_ROLE_KEY` 뿐이라, 그 갈래가 없으면 로컬 시험이 열쇠 없는 배포와
  같은 얼굴로 실패한다(`playwright.config.ts` 가 이름 둘을 다 덮는 까닭).
- `vercel env pull` 은 **`--environment=production`** 이어야 운영 값이 온다. 그래도
  Secret 로 넣은 것은 안 내려온다 — `"[SENSITIVE]"` 자리표시자로 온다. **그대로 두지 마라** —
  값이 「있는」 것으로 세어져 `keyed-client.ts` 의 「열쇠가 없습니다」 검사를 지나가고 401 로
  떨어진다. 주석 처리해 두면 오류가 이름을 대 준다. 실호출에 드는 것은 `OPENAI_API_KEY` 한 줄이고
  손으로 붙인다.
- **CLI 로 임의 SQL 이 된다** — `npm run db:remote -- --purpose "<목적>" "<sql>"`(= 접속기록에 목적 · 해시를 적고
  `npx supabase db query --linked`, 기계 전체에서 한 번에 하나, ADR 0096 · 0105). 목적 없이는 안 돈다. 적는 함수(`audit.note_cli_query`)가
  원격에 없으면 SQL 을 안 보낸다 — 그 함수를 올리는 `db push` 앞의 확인만 `node scripts/remote-lock.mjs npx supabase db query --linked "<sql>"`
  로 직접 보냈다(2026-09-24 한 번, 함수 정의의 md5). Management API 로 붙고
  `postgres` 로 돌므로 비밀번호도 `psql` 도 필요 없다. 다만 `postgres` 라 「비운영자 당사자에게
  무엇이 보이나」는 못 잰다 — 역할별 조회는 대시보드 SQL Editor(마지막 문장의 결과만 준다 — 역할을
  바꿔 가며 잰 줄은 임시 표에 모아 끝에서 한 번에 낸다)나 `SUPABASE_SECRET_KEY` 가 필요하고, 익명
  수준은 발행 키로 REST 를 두드려 잰다(없으면 `404` PGRST202, 닫혀 있으면 `42501`). 다중 문장은
  못 받는다(`begin; … rollback;` 이 죽는다).
- **`.env.development.local` 은 이름과 달리 운영 DB 를 가리킨다.** 로컬 스택에 대고
  돌릴 것을 여기 대고 돌리지 않는다.

### 비밀이 새면 — **교체가 먼저다** (G-23 ⑧)

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
   등급 4 다, `docs/agents/delegation.md`). Vault 는 SQL Editor 에서 고치고 재배포가 없다 — 다음 호출이 읽는다:

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
| `VERCEL_OIDC_TOKEN` | **우리가 만들지 않는다** — Vercel 이 함수 호출마다 짓고 짧게 산다(반출의 기본안, 아래 「반출」). `AUDIT_EXPORT_ROLE_ARN` 은 비밀이 아니다 | 없다 — Vercel 프로젝트 Settings → Security → OIDC Federation 이 켜져 있으면 선다 | 토큰 하나가 새도 그 수명 동안만 역할의 자격이다(`s3:PutObject` 하나) | 새면 AWS IAM 역할의 신뢰 정책에서 조건(`sub`)을 좁히거나 역할의 세션을 끊는다(IAM → Roles → Revoke active sessions). 반출은 다음 호출의 새 토큰으로 이어진다 |
| `AUDIT_EXPORT_ACCESS_KEY_ID` · `AUDIT_EXPORT_SECRET_ACCESS_KEY` | **역할을 못 세운 날의 대안이다**(기본은 위 OIDC 역할). AWS IAM → 반출 사용자(`saju-audit-export`) → Security credentials → Create access key. 한 사용자에 키가 둘까지 함께 선다 | Vercel **Production** → 재배포. `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` 은 비밀이 아니다(같은 자리에 넣는다) | 그날 반출이 실패한다(500, Vercel 로그). **기록은 안 잃는다** — DB 에 남아 있고 다음 반출이 이어 올린다 | 새 배포 Ready 뒤 크론을 손으로 한 번 부르거나 다음 날 `select max(exported_at) from audit.operator_access_export` 가 오늘이면 옛 키를 Deactivate → Delete. **키가 새도 올린 객체는 못 지운다** — 권한이 `s3:PutObject` 뿐이고 Object Lock 이 잠갔다. 새 객체를 쓸 수는 있으므로 교체가 먼저다 |
| `PORTONE_WEBHOOK_SECRET` | PortOne 관리자 콘솔 → 결제 연동 → 웹훅 → 그 주소의 시크릿(`whsec_…`). 새 시크릿을 발급하면 옛 것과 함께 설 수 있는지는 가맹 때 본다(G-23 ⑥) | Vercel **Production** → 재배포 | 결제 알림이 401 이다. **돈은 들어왔는데 묶음이 안 선다** — PortOne 은 다섯 번까지(0 → 256분) 다시 보내므로 그 안에 새 값이 서면 붙는다. 넘기면 콘솔의 재전송으로 다시 보낸다(`approve_reading_order` 는 같은 알림 · 같은 거래 번호를 한 번만 적는다) | 새 배포 Ready 뒤 콘솔의 「웹훅 테스트 호출」이 200 인지 본다. 서명이 여럿이면 하나만 맞아도 되므로(`signature.ts`) 옛 시크릿은 그 뒤에 끈다 |
| `PORTONE_API_SECRET` | PortOne 관리자 콘솔 → 결제 연동 → 연동 정보 → V2 API 시크릿 재발급 | Vercel **Production** → 재배포. `PORTONE_STORE_ID` 는 비밀이 아니다(같은 자리에 넣는다) | 결제 알림이 금액을 못 받아 503 이다 — 위와 같이 PortOne 이 다시 보낸다. **키가 새면 남이 결제를 조회 · 취소할 수 있다** — 교체가 먼저다 | 새 배포 Ready 뒤 콘솔의 테스트 호출이 200 이면 옛 시크릿을 폐기한다 |
| Vault `reading_recovery_url` | 비밀이 아니다 — 공개 주소(`/api/cron/reading`). 도메인이 바뀔 때만 고친다 | Vault | — | — |
| Vault `ops_alert_url` | **주소 자체가 열쇠다** — 가진 사람은 운영 채널에 글을 넣는다. Slack 앱의 Incoming Webhooks 나 Discord 채널의 연동 → 웹후크에서 새 주소를 만든다 | Vault(재배포 없음) | 알림이 채널로 안 나간다. `ops_alert` 표에는 그대로 적힌다 | 「운영자 알림 배선」의 `notify_ops('ops-alert-test', …)` 가 닿으면 옛 웹후크를 지운다 |
| Vault `ops_alert_secret` | 넣었을 때만 있다 — 받는 쪽이 `Authorization` 을 볼 때 | Vault 와 받는 쪽을 함께 | 받는 쪽이 알림을 거절한다 | 위와 같다 |
| 구글 로그인 client secret | 코드에 없다 — Supabase Auth 가 든다. Google Cloud Console → Credentials → 그 OAuth client 에서 secret 을 더한다 | Supabase 대시보드 Authentication → Providers → Google(재배포 없음). **`supabase config push` 로 넣지 않는다**(맨 위 경고) | 구글 로그인 전부 | 새 창에서 로그인이 되면 Google 에서 옛 secret 을 끈다 |

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

---

## 테스트 시작하기 — **날짜 한 줄**

지금은 아무도 시작할 수 없다. 종료일이 없으면 안내가 만들어지지 않고, 안내가 없으면
`/signup` 에 폼이 아예 없다(ADR 0024). 배포 없이 **언제든** 넣고 옮길 수 있다.

> **일정을 옮기면 이미 가입한 사람도 다시 확인한다.** 관문이 「지금 일정 줄」을 보므로
> (ADR 0042) 그 사람들은 다음 방문에 `/signup` 으로 돌아가 확인 하나만 다시 누른다 —
> 코드와 닉네임은 다시 안 묻는다.

**두 가지를 함께 넣는다** — 언제 끝나는가와 **누가 약속하는가**. 처리자와 연락처가 없으면
열람·정정·삭제·처리정지가 적혀만 있는 권리가 되므로, 셋 중 하나라도 비면 안내가 안 선다.

```sql
-- 정한다. 파기 기한은 종료일과 여유에서 나므로 따로 적지 않는다.
insert into public.beta_schedule (
  ends_on, purge_within_days, note,
  operator_name, operator_officer, operator_contact)
values (
  '2026-10-31', 30, '고정 종료일 — 초대 시점과 무관하다',
  '<처리자 이름 또는 상호>', '<보호책임자 이름>', '<직접 닿는 이메일 또는 전화>');

-- 지금 값과 이력
select * from public.current_beta_schedule();
select id, ends_on, purge_within_days, note, set_at from public.beta_schedule order by id desc;
```

**덮어쓰지 않고 쌓는다.** 옮기려면 새 줄을 넣는다 — 이건 사용자에게 한 약속이고, 바뀐
기록이 남아야 「그때 뭐라고 했더라」에 답할 수 있다.

> **옮기면 모두가 안내를 다시 본다.** 확인 기록이 판본과 **본 날짜**를 함께 들기
> 때문이다(`notice_ends_on`). 기간이 바뀌는 것은 알린 내용이 바뀌는 것이라 그게 맞다 —
> 다시 안 물으면 11월에 지운다는 안내를 보고 확인한 사람의 자료를 이듬해까지 들게 된다.

> **연락처는 공개 화면에 그대로 실린다.** `/privacy` 는 로그인 없이 열리므로 여기 적는
> 주소는 누구나 본다. 개인 주소를 쓸지 별도 창구를 팔지는 정하고 넣는다.

**종료일은 초대와 무관하다.** 언제 몇 명을 초대하든 그날 끝난다 — 초대에서 며칠을 세는
값이 아니므로, 테스터를 늦게 넣었다고 자동으로 밀리지 않는다. 밀려면 새 줄을 넣는다.

넣고 나면 `/privacy` 를 열어 날짜가 문장 안에 서 있는지 눈으로 본 뒤 아래 「초대」로 간다.

**문구를 고쳤으면 판본도 올린다**(`NOTICE_VERSION`, 코드). 판본만 올리고 문구를 안 고치면
사람들을 이유 없이 다시 세우는 것이고, 문구만 고치고 판본을 안 올리면 아무도 새 문구를
못 본다. 날짜는 판본에 없다 — 둘은 따로 움직이고 관문이 둘 다 본다.

```sql
-- 누가 어느 판본·어느 날짜에서 무엇을 골랐나
select u.email, a.notice_version, a.notice_ends_on, a.notice_ack_at,
       a.improvement_consent as 개선활용, a.contact_consent as 후속연락
from public.app_user a join auth.users u on u.id = a.id
order by a.notice_ack_at desc nulls first;
```

---

## 초대 — **코드 한 줄** (ADR 0042)

이메일 명단은 걷었다. 지금 문을 여는 것은 **테스트 코드**다 — 운영자가 코드를 하나 만들고
그 문자열만 전하면 받은 사람이 스스로 들어온다.

> **테스트가 아닌 사람을 처음 들이기 전에 출시 단계를 옮긴다**(ADR 0093 · 0097). 실제 사용자의 자료가 운영
> DB 에 들어오는 날이 공개 뒤의 규율이 켜지는 날이다 — `docs/prd.md` §7.0 의 「(지금)」을 옮기면 머지 전 전체
> 검증(CI)과 등급 3 의 잠금이 함께 돌아온다. 잠금 쪽은 시험이 `docs/agents/delegation.md` 「공식 운영에
> 들어가면 켜는 잠금」의 걸음으로 데려간다. 코드를 먼저 건네고 나중에 옮기지 않는다.

코드에는 둘이 붙는다: **사는 기간**과 **최대 인원**. 기한 없는 코드는 새면 영원히 열린
문이고, 수 없는 코드는 한 사람이 퍼뜨리면 정원이 없다. 둘을 함께 두면 새어도 N명까지다.

**정원은 기간 전체에 누적이다**(ADR 0066). 이틀짜리 스무 명은 이틀 합쳐 스무 명이지
날마다 스무 명이 아니다 — `app_user.signup_code` 로 세므로 자리가 안 돌아온다.
**이틀을 덮겠다고 날짜만 다른 코드를 두 줄 넣지 마라.** 그러면 정원이 두 벌이 된다.

```sql
-- 오늘 하루, 열 명. 코드는 **대문자**로 넣는다(검사식이 그것만 받는다).
-- 하루의 경계는 서울 자정이다 — 「오늘」이 사용자가 읽는 오늘과 같아야 한다.
-- `valid_until` 을 안 적으면 하루짜리다.
insert into public.signup_code (code, note, valid_on, max_uses)
values ('SAJU1001', '1차 테스터 · 오픈채팅방 공지', (now() at time zone 'Asia/Seoul')::date, 10);

-- 오늘부터 내일까지, 합쳐서 스무 명.
insert into public.signup_code (code, note, valid_on, valid_until, max_uses)
values ('SAJU1002', '2차 테스터 · 오픈채팅방 공지',
        (now() at time zone 'Asia/Seoul')::date,
        (now() at time zone 'Asia/Seoul')::date + 1, 20);

-- 오늘 살아 있는 코드와 남은 자리
select c.code, c.note, c.valid_on, c.valid_until, c.max_uses,
       count(u.id) as 들어온사람,
       c.max_uses - count(u.id) as 남은자리
from public.signup_code c
left join public.app_user u on u.signup_code = c.code
where (now() at time zone 'Asia/Seoul')::date between c.valid_on and c.valid_until
group by c.code, c.note, c.valid_on, c.valid_until, c.max_uses;

-- 어느 계정이 어느 코드로 왔나
select au.email, u.signup_code, u.signed_up_at, u.nickname
from public.app_user u
join auth.users au on au.id = u.id
order by u.signed_up_at desc nulls last;
```

**`signed_up_at` 이 비어 있는 계정은 「구글 로그인만 한 사람」이다.** 코드를 못 넣었거나
안 넣은 것이고, 그 계정은 아무것도 못 한다 — 사주도 저장한 사람도 못 넣는다. 그대로 두면
된다. 다시 코드를 주면 그 자리에서 가입이 끝난다.

**코드를 지우는 것은 접근 회수가 아니다.** 이미 들어온 사람의 세션은 그대로 산다. 그리고
**누가 그 코드로 들어왔는지가 곧 기록**이라 쓰인 코드는 지워지지 않는다(FK). 막으려면
아래의 계정 중지를 쓴다.

```sql
-- 아직 아무도 안 쓴 코드만 지워진다. 쓰인 코드는 FK 가 막는다 — 그게 맞다.
delete from public.signup_code where code = 'SAJU1001';

-- 정원을 줄이거나 하루를 옮기는 편이 낫다
update public.signup_code set max_uses = 0 where code = 'SAJU1001';
```

> **훅은 껐다.** `[auth.hook.before_user_created]` 는 `config.toml` 에서 지웠다. **원격
> 프로젝트에서는 손으로 꺼야 하고, 그것을 마이그레이션보다 먼저 해야 한다** — 아래
> 「가입 코드 배포 — 훅을 먼저 끈다」.

---

## 풀이권

폐쇄 베타에서 한 사람이 AI 풀이를 몇 번 만들 수 있는가. **어디에도 적혀 있지 않다** —
`reading_run` 을 세는 것이 곧 잔액이다(ADR 0021). 그래서 누구의 잔액도 손으로 고칠 수
없고, 고칠 자리를 찾을 필요도 없다.

```sql
-- 누가 얼마나 썼나. `reserved` 는 지금 만들고 있는 것이 잡고 있는 자리다.
select u.email,
       count(*) filter (where r.status = 'succeeded') as 쓴것,
       count(*) filter (where r.status = 'running'
         and r.created_at > now() - public.reading_run_timeout()) as 만드는중,
       count(*) filter (where r.status = 'failed') as 실패
from auth.users u
left join public.reading_run r on r.user_id = u.id
group by u.email
order by 쓴것 desc;
```

한 사람에게 더 주려면 상한을 옮긴다. **그 사람만 올릴 수는 없다** — 값이 하나뿐인 것이
이 설계의 요점이다.

```sql
create or replace function public.reading_credit_limit()
returns integer language sql immutable as $$ select 5 $$;
```

> 옮기기 전에 **무엇을 근거로 옮기는지 적어 둔다.** 처음 다섯은 재어 보고 정한 값이
> 아니다(ADR 0021). 「달라고 해서」와 「테스터 대부분이 다섯에서 멈춰서」는 다른 근거이고,
> 뒤의 것만 다음 판을 정하는 데 쓸 수 있다.
>
> **2026-09-05 에 여덟으로 올렸다가 같은 날 다섯으로 되돌렸다.** 여덟의 근거는 셈이었다 —
> 내 사주 하나, 저장한 사람 하나, 그 둘의 궁합 하나면 셋이고, 남은 둘로 인연 요청을 띄우면
> 그 둘은 답이 올 때까지 **예약**으로 묶인다(ADR 0038). **요청 둘을 띄운 사람은 자기 풀이를
> 하나도 못 만든다.** 그 벽은 다섯에 그대로 남아 있다 — 테스터가 매칭을 한 바퀴 밟다가
> 여기서 멈추면 그때가 올릴 때다.

> **저장 자리보다 크게 올리지 않는다.** `person_limit()` 이 열이고, 풀이를 받으려면 대상이
> 저장돼 있어야 한다(ADR 0032). 이 부등식이 깨지는 순간 풀이권을 가지고도 쓸 데가 없는
> 사람이 생기고, 그때 다시 열어야 하는 것은 저장 한도가 아니라 **저장 없이 풀이 받기**다.

**전체 비용은 이 값이 안 막는다.** 사람당 상한일 뿐이라, 초대 인원이 늘면 하루 전체
상한(`reading_daily_budget()`, 아래 「AI 비용 한도」)과 OpenAI 쪽 예산을 함께 옮겨야 한다.
그리고 실패한 시도도 모델은 이미 불렸으므로 「성공 건수 × 인원」이 호출 상한이 아니다.

### 산 풀이권 — 주문 · 묶음 · 쓰임 · 환불 (G-21 ⑤ ④, ADR 0106)

**판매는 닫혀 있다**(`reading_sale_is_open()` = false) — 주문이 0건이다. 장부만 먼저 섰다. 잔액은 여전히 센다 — 한도가
`무료 + 예외 + Σ(묶음의 산 수 − 걷은 수)` 로 한 칸 늘었을 뿐이고, 쓰임 장부(`reading_credit_use`)는 **환불 셈의 입력**이다.
쓴 순서는 무료 → 예외 → 산 때가 이른 묶음이고, 자리를 잡는 순간 트리거가 정한다. 지운 대상의 시도가 셈에서 빠져
되돌아온 자리로 만든 것은 몫 밖(`outside`)이다 — 환불 대상이 아니다.

**주문 조회 — 개인을 가리키지 않는 질의만**(「개인정보는 화면으로만」). 에이전트도 돈다.

```bash
# 상태별 주문 수 · 금액 · 돌려준 금액
npm run db:remote -- --purpose "풀이권 주문 상태별 집계" \
  "select status, count(*) as 주문, sum(amount) as 금액, sum(refunded_amount) as 환불 from public.reading_order group by status order by status"

# 묶음 전체의 산 수 · 걷은 수 · 쓴 수 · 예약 중 수
npm run db:remote -- --purpose "풀이권 묶음 쓰임 집계" \
  "select sum(b.credits) as 산것, sum(b.refunded_credits) as 걷은것, count(u.id) filter (where u.state = 'confirmed') as 쓴것, count(u.id) filter (where u.state = 'reserved') as 예약중 from public.reading_bundle b left join public.reading_credit_use u on u.bundle_id = b.id"

# 몫별 쓰임 — 무료 · 예외 · 묶음 · 몫 밖 × 예약 · 확정 · 풀림
npm run db:remote -- --purpose "풀이권 몫별 쓰임 집계" \
  "select share, state, count(*) from public.reading_credit_use group by share, state order by share, state"

# 장부가 셈과 맞는가 — 살아 있는 쓰임 수와 셈(성공 · 도는 것 · 대기 요청)이 다른 계정 수. 0 이어야 한다
npm run db:remote -- --purpose "풀이권 장부와 셈의 대조" \
  "select count(*) as 어긋난_계정 from public.app_user a cross join lateral public.reading_credits_used(a.id) c where c.used + c.reserved + c.requested <> (select count(*) from public.reading_credit_use u left join public.reading_run r on r.id = u.run_id left join public.match_request q on q.id = u.request_id where u.user_id = a.id and u.state <> 'released' and (r.status = 'succeeded' or (r.status = 'running' and r.created_at > now() - public.reading_run_timeout()) or (u.run_id is null and q.status = 'pending' and q.expires_at > now())))"
```

마지막 질의는 셈이 행을 안 고치고 풀어 준 예약(유효시간을 넘긴 시도 · 기한이 지난 요청)을 셈과 같은 물음으로 걸러 센다.
0 이 아니면 트리거가 빠진 자리가 있다 — 계정을 찾지 말고(개인정보) 같은 질의를 `share` · `source` 별로 쪼개 어느 길인지 본다.

**수동 환불 — 순서.** 산식은 없다(G-25 ⑥ — 변호사 검토 뒤). 금액과 걷을 회차는 사람이 정한다.

1. 요청을 받는다 — 주문 번호(`rdo_…`)나 PG 의 거래 번호로 주문을 가리키게 한다. 이메일로 주문을 찾지 않는다
2. **환불 셈의 입력을 읽는다** — `operator_reading_refund_basis(<주문 id>)` 가 그 계정의 주문 전부를 묶음별로 낸다(산 수 ·
   걷은 수 · 쓴 수 · 예약 중 수 · 안 쓴 수 · 결제 금액 · 환불한 금액 · 결제 시각). 운영자만 부르고 읽을 때마다 접속기록에
   남는다. **화면은 판매를 여는 PR 이 `/ops/**` 에 세운다** — 그 전에는 주문이 없다
3. **예약 중인 몫은 풀릴 때까지 기다린다** — 안 쓴 것이 아니다(G-21 ③). 무료 · 예외 · 몫 밖은 어떤 경우에도 돌려주지 않는다
4. **PG 콘솔에서 먼저 환불한다** — 돈이 나간 뒤에 적는다. 적은 뒤 PG 가 거절하면 장부가 거짓말을 한다
5. **사람이 적는다** — 주문 하나를 가리키는 쓰기라 break-glass 대장에 먼저 적고, `refund_reading_order` 를 서버 열쇠
   (`service_role`) 나 운영 SQL(`postgres`)로 부른다. 사유는 분류 하나(`withdrawal` 청약철회 · `unused` 안 쓴 몫 ·
   `duplicate` 중복결제 · `failure` 미제공 · `other`)이고 자유 글을 받지 않는다. 같은 PG 환불 번호로 두 번 불러도 한 번만 적힌다.
   안 쓴 것보다 많이 걷으려 하면 거절된다

```sql
-- break-glass 대장 번호를 목적에 — 금액(원) · 걷을 회차 · 사유 · PG 환불 번호
select public.refund_reading_order('<order-id>', <amount>, <credits>, 'unused', '<pg-refund-id>');
```

6. 위 「주문 조회」의 상태별 집계로 `partially_refunded` · `refunded` 가 는 것을 본다

**떠난 사람의 결제 기록 — 5년, 앱은 못 읽는다**(G-25 ②). 떠날 때 `auth.users` 의 트리거가 승인된 적 있는 주문을
`retention.reading_payment` 로 옮긴다(묶음 · 쓰임 · 환불 · 알림은 jsonb). 승인된 적 없는 주문은 **거절한 알림이 있을 때만**
`retention.refused_reading_payment` 로 최소 칸(주문 번호 · 계정 내부 번호 · 제공자 · 가맹점 주문 번호 · 주문 금액 · 주문 시각 ·
거절 알림)만 옮긴다(`20261018090000`, ADR 0106 추기 — 법적 범위는 변호사 검토 B-8). 크론 `payment-retention-purge`(매일 04:53 UTC)의
`retention.purge_expired_payments()` 가 두 표에서 `keep_until`(앞은 마지막 승인 · 환불, 뒤는 마지막 거절 알림 + 5년)이 지난 줄을
함께 지운다. 분쟁이나 수사기관의 요청이 걸리면 보류를 건다 — 신고 기록의 보류(「떠난 사람의 신고 기록」)와 같은 모양이다.

```sql
-- 몇 줄 · 가장 이른 파기 예정 — 개인을 가리키지 않는다
select count(*), min(keep_until) from retention.reading_payment;
select count(*), min(keep_until) from retention.refused_reading_payment;

-- 건다 · 푼다 — 대상은 주문 id 로. 거절 기록이면 표 이름만 retention.refused_reading_payment 로
update retention.reading_payment set hold_reason = '<사유> <문서 번호> <받은 날>', held_at = now() where order_id = '<order-id>';
update retention.reading_payment set hold_reason = null, held_at = null where order_id = '<order-id>';
```

#### 결제 알림 — PortOne 웹훅 (G-23 ⑥)

**문은 섰고 꺼져 있다.** `POST /api/portone/webhook`(`app/api/portone/webhook/`)이 PortOne V2 의 결제 알림을 받는다. 켜는 값
셋(`PORTONE_WEBHOOK_SECRET` · `PORTONE_API_SECRET` · `PORTONE_STORE_ID`)이 없으면 503 이고, 판매가 닫혀 있는 동안에는 주문이 없어
값을 넣어도 세울 것이 없다. 한 알림에 하는 일은 넷이다.

1. **서명** — Standard Webhooks(`webhook-id` · `webhook-timestamp` · `webhook-signature`), 시각은 앞뒤 5분. 틀리면 401
2. **`Transaction.Paid` 만** — 나머지(실패 · 취소 · 환불)는 200 으로 받고 아무것도 안 한다. 실패에 주문을 닫지 않는다(같은 결제
   번호로 다시 낼 수 있다). 환불은 위 「수동 환불」이다
3. **결제를 PortOne 에서 다시 받는다** — `GET https://api.portone.io/payments/{paymentId}`. 알림 본문에는 금액이 없고, 있어도 안
   믿는다. 상태 `PAID` · 우리 상점 · `KRW` 가 아니면 승인하지 않는다(200, 기록에만)
4. **승인 문** — `approve_reading_order(주문, 거래 번호 = PortOne transactionId, 받은 금액, 알림 번호 = webhook-id)`. 주문은 결제
   번호(`rdo_…`)에서 되짚는다. 금액 대조와 「같은 알림은 한 번」은 DB 가 한다 — 금액이 다르면 `refused` 가 `payment_event` 에
   남고(200), 이미 닫힌 주문의 결제(`55000`)는 **돈이 들어왔는데 묶음이 없다** — PG 콘솔에서 환불한다

답은 다시 보내도 같을 것이면 2xx · 401 · 400, 우리 쪽이 잠깐 못 한 것(설정 · PortOne · DB)이면 503 이다 — PortOne 이 다섯 번까지
다시 보낸다. 까닭은 답에 안 싣고 Vercel 로그의 `portone webhook` 줄에만 남는다.

**켜는 날**(가맹 · 샌드박스 뒤, 사람) — ① Vercel **Production** 에 위 셋을 넣고 재배포 ② PortOne 콘솔 → 웹훅에 `https://<도메인>/api/portone/webhook`
을 넣는다(버전 V2) ③ 샌드박스 채널로 1회권 하나를 결제하고 묶음이 선 것을 본다 — 판매 스위치는 운영에서 켜지 않는다(로컬 스택 + 터널이나
별도 프로젝트에서) ④ 콘솔의 테스트
호출이 200 인지 본다. 판매를 여는 것은 `reading_sale_is_open()` 을 `true` 로 바꾸는 마이그레이션이다 — 결제 전 고지 · 철회
기준(G-25) · 탈퇴 판의 남은 수량(G-25 ⑦) · 환불 셈 화면이 먼저 선다. **샌드박스에서 볼 것** — 알림 본문과 결제 조회의 모양이
문서대로인가, 환불 번호를 주문 사이에 겹쳐 쓰는가(`20261015090000`), 거래 번호로 `transactionId` 와 `pgTxId` 중 무엇을 남길까.

---

## 지우기

**「그만두기」와 「지우기」는 다른 일이다.** 매칭 참여를 끄는 것은 상태이고(ADR 0014)
계정 중지도 상태다. 여기 적힌 것은 되돌릴 수 없는 쪽이다.

### 한 사람

```sql
select * from public.forget_user('<user uuid>');
--  people_forgotten
```

한 문장이면 된다. `auth.users` 하나가 사라지면 `app_user` 가 따라가고 거기서 서른 갈래
남짓이 FK 로 따라간다(2026-09-23 에 31) — Person 엣지·discovery·요청·결과·시도·풀이 설문·서비스
설문·알림·차단·신고·활동 시각. **Match · 대화방 · 메시지는 따라가지 않고 그 사람의 칸만 빈다**
(ADR 0094, 아래). (세어 보려면 `pg_constraint` 에서 `app_user` 를 가리키는 FK 를 센다 — `confdeltype`
이 `n` 인 여섯이 자리만 비는 칸이다.)
그다음 **이 사람이 관리하던 Person 중** 아무도 안 보게 된 것을 지운다(ADR 0023) — 출생
입력은 그 행에 있으므로 함께 사라진다.
남이 놓고 간 고아는 안 건드린다 — 그것은 종료 파기의 일이다.

무엇이 함께 사라지는지 **누르기 전에** 알아야 한다.

- **함께 보던 궁합이 상대 화면에서도 사라진다.** 그 사람의 동의 당시 여덟 글자가 비고 그 Match 의
  궁합풀이와 시도가 지워진다(트리거 둘, ADR 0094). 상대의 Match 목록과 공유 결과에는 이미 없다 —
  `visible_matches()` 가 상대가 `active` 인지 묻는다. **Match 행은 대화방의 닻으로 남는다.**
- **대화방과 메시지는 상대에게 남는다.** 그 사람의 자리(참여자 · 닫은 사람 · 보낸 사람)만 빈다.
  상대는 방을 계속 보고 이름 자리에 「탈퇴한 사용자」가 선다. 열려 있던 방은 이 순간 닫힌다
  (`deletion_request`, 지금) — 보존 90일은 닫힌 날부터다(아래 「채팅」). **둘 다 떠나면** Match 째
  사라지고 방 · 메시지가 따라간다.
- **남이 관리하는 Person 은 남는다.** 「누가 만들었나」만 비워진다.
- **신고 기록은 따로 남는다**(ADR 0098). 신고한 쪽이든 신고당한 쪽이든, 지워지기 **전에** 트리거가
  그 사람이 든 신고와 스냅샷을 `retention.report` 로 옮기고 일반 표에서는 사라진다. 처분일부터 6개월
  뒤 크론이 지운다 — 아래 「떠난 사람의 신고 기록」.

**다시 못 들어오게 하는 것은 이 문이 아니다.** 삭제는 접근 회수가 아니고(위의 초대 절과
같은 구분), 코드는 사람에 매여 있지 않다 — 지운 사람이 같은 코드를 아직 들고 있으면 그
코드가 살아 있는 동안에는 다시 들어올 수 있다. 막으려면 **그 코드를 닫는다.**

```sql
update public.signup_code set max_uses = 0 where code = '<그 사람에게 준 코드>';
```

### 종료일이 되면 — **저절로 닫힌다**

종료일이 지나면 `is_active_account()` 가 거짓이 되어 discovery·요청·수락·풀이 생성·설문이
한꺼번에 닫히고, `/me` 아래는 「비공개 테스트가 끝났습니다」로 선다. 운영자가 그날 무엇을
누르지 않아도 된다 — 날짜가 집행한다.

```sql
-- 닫혔는지 본다
select public.beta_is_over(), * from public.current_beta_schedule();
```

미루려면 새 줄을 넣는다(위 「테스트 시작하기」). 넣는 순간 다시 열리고, **모두가 안내를
다시 본다** — 기간이 바뀌는 것은 알린 내용이 바뀌는 것이다.

파기는 저절로 안 된다. 아래를 손으로 돈다.

### 베타 종료 — 전부

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select count(*) as 계정 from auth.users;
select count(*) as 사람 from public.person;
```

```sql
-- 하나씩 잊는다. **전체가 한 트랜잭션이다** — 한 명에서 실패하면 앞에서 지운 사람까지
-- 전부 되돌아간다. 그게 맞다: 절반만 지워진 상태로 끝나는 것보다 아무것도 안 지워진
-- 상태에서 이유를 보고 다시 도는 편이 낫다. 어디서 멈췄는지는 notice 가 말한다.
do $$
declare victim uuid;
begin
  for victim in select id from auth.users loop
    raise notice '잊는 중: %', victim;
    perform public.forget_user(victim);
  end loop;
end $$;
```

```sql
-- 사람마다의 삭제는 **그 사람이 관리하던 Person 만** 정리한다(ADR 0023). 아무도
-- 관리한 적 없던 고아는 그 반복으로 안 사라지므로, 여기서 한 번 쓸어 낸다.
select public.forget_orphan_people();
```

```sql
-- 남은 것이 없어야 한다. 남았다면 그것이 이 절차의 구멍이다.
--
-- **FK 로 안 따라오는 것들이 이 목록에 있다.** `reading_webhook_event` 는 어느 표에도
-- 안 매여 있고(도착을 적는 영수증이라 그렇다), 감사 로그와 flow state 는 `forget_user`
-- 가 손으로 지운다 — 둘 다 사용자에 매여 있지 않다.
select
  (select count(*) from auth.users)                  as 계정,
  (select count(*) from auth.audit_log_entries)      as 감사로그,
  (select count(*) from auth.flow_state)             as 로그인중간상태,
  (select count(*) from public.signup_code)          as 가입코드,
  (select count(*) from public.person)               as 사람,
  (select count(*) from public.reading)              as 결과,
  (select count(*) from public.reading_run)          as 시도,
  (select count(*) from public.reading_job)          as 일감,
  (select count(*) from public.reading_feedback)     as 풀이설문,
  (select count(*) from public.service_survey)       as 서비스설문,
  (select count(*) from public.notification)         as 알림,
  (select count(*) from public.match)                as 매치,
  (select count(*) from public.chat_room)            as 대화방,
  (select count(*) from public.report)               as 신고,
  (select count(*) from public.chat_message)         as 메시지,
  (select count(*) from public.chat_report_snapshot) as 신고스냅샷,
  (select count(*) from public.profile_photo)        as 프로필사진,
  (select count(*) from public.reading_webhook_event) as 영수증;

-- **0 이 아닌 것이 맞는 자리 하나** — 떠난 사람의 신고 기록. 종료 파기도 탈퇴와 같은 문이라 처분일부터
-- 6개월 남고 크론이 지운다(ADR 0098). 크론을 끄지 않는다.
select count(*) as 따로둔_신고, min(retained_at) + retention.report_period() as 가장_이른_파기
from retention.report;
```

**프로필 사진은 손으로 안 지운다.** 바이트가 Postgres 안에 있고 `app_user` 에 cascade 로
매여 있어서, 계정이 사라지면 함께 사라진다(ADR 0040). 파일 저장소에 뒀다면 이 절차에
한 단계가 늘고 그 단계는 DB 밖에 있었을 것이다 — 위 표에 0 이 아닌 수가 남으면 그것이
이 결정이 깨졌다는 뜻이다.

**영수증은 마지막이다.** `reading_webhook_event` 는 도착을 적는 자리라 어느 FK 에도 안
매여 있다. 생성이 도는 중에 지우면 그 사이 도착한 응답을 두 번 집을 수 있다. 순서는
**생성 중단 → 재전송 창(최대 72시간) 경과 또는 webhook 폐쇄 → 영수증 삭제**다.

```sql
-- 위 검증에서 영수증만 남았을 때, 재전송 창이 지난 뒤에 지운다.
delete from public.reading_webhook_event;
```

```sql
-- 가입 코드는 사람 이름이 아니라 문자열과 운영자 메모다. 그래도 「누가 그 코드로
-- 들어왔나」가 계정과 함께 사라진 뒤에는 남길 이유가 없다.
delete from public.signup_code;
```

### DB 밖

절차가 DB 에서 끝나지 않는다. **여기 적힌 것 중 확인 안 된 것은 확인 안 됐다고 적어 둔다** —
안내에 「파기했습니다」라고 쓰려면 이 목록이 전부 닫혀 있어야 한다.

| 어디 | 무엇이 있나 | 얼마나 남나 |
| --- | --- | --- |
| Supabase Auth | 로그인 신원·세션·토큰 | `auth.users` 삭제가 identities·sessions·one_time_tokens·mfa_factors 를 cascade 로 데려간다(확인함). 감사 로그·flow state 는 FK 가 없어 `forget_user` 가 손으로 지운다 |
| Supabase 백업 | 지운 행이 스냅숏에 남는다 | **Free 플랜에는 자동 일일 백업과 PITR 이 없다.** 운영자가 손으로 dump 를 뜬 적이 없으면 남는 것이 없다. 플랜을 올리면 이 줄을 다시 쓴다 |
| Vercel 로그 | 요청 로그. 출생 원문은 안 적는다(`prd-archive` 로그 규율) | **Hobby 플랜의 런타임 로그 보존은 1시간.** 플랜을 올리면 이 줄을 다시 쓴다 |
| OpenAI | 프롬프트에 여덟 글자와 그 위의 사실이 들어간다. 정확한 생년월일시·출생지·분 단위는 안 나간다(ADR 0008) | `store: false` 로 보내되 `background: true` 라 회수용으로 **약 10분** 들고 있다. 그와 별개로 기본 abuse monitoring 로그가 **최대 30일**, 프롬프트 캐시가 마지막 사용 후 **최소 30분**이다 |

> **OpenAI 프로젝트의 ZDR·MAM 설정은 확인 안 됐다.** 별도 승인을 받은 기억이 없으면
> 기본값(최대 30일)으로 안내한다. 승인받았다면 대시보드에서 확인하고 이 줄을 고친다.
>
> 요금제 두 줄은 **지금 플랜 기준**이다. 플랜을 올리는 것은 보존 기간을 늘리는 일이고,
> 그때 처리방침도 함께 고쳐야 한다.

---

## 설문 읽기 — **화면이 있다** (ADR 0061)

운영자로 로그인해서 **`/ops/survey`** 를 연다. 메뉴에 없는 주소라 직접 친다.

화면이 드는 것 넷 — 들어온 답과 동의 분포, 판본별 평균, 아쉬운 점 태그, 적어 주신 글.
아래 SQL 과 **같은 수**를 낸다(집계가 `operator_survey_*` 넷으로 옮겨 갔다). 화면이 안
열리거나 그 수를 의심할 때만 아래로 내려간다.

### 운영자를 세우고 내린다

「이 사람이 운영자인가」에만 답하는 표가 따로 있다(`public.operator`). 앱에는 이 표에 닿는
길이 없고 `service_role` 에도 안 열려 있다 — SQL Editor 에서만 넣는다.

```sql
-- 세운다
insert into public.operator (user_id, note)
select id, '누구에게 왜 주었는지'
from auth.users where email = '<그 사람의 구글 계정>';

-- 지금 누가 있나
select u.email, o.note, o.added_at
from public.operator o join auth.users u on u.id = o.user_id;

-- 내린다 — 이 줄이 사라지면 `/ops/survey` 는 그 사람에게 없는 화면이 된다
delete from public.operator where user_id =
  (select id from auth.users where email = '<그 사람의 구글 계정>');
```

**운영자라는 이름으로 열리는 문은 그 이름을 묻는 자리의 개수다.** 지금은 설문을 읽는 함수들과
신고를 읽는 함수 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, ADR 0103)이고 전부
읽기만 한다. 풀이권 예외는 여기 안 딸려 온다 — 그것은 별개의 표다(위 「풀이권」). 이 줄이 사라지면
`/ops/reports` 도 그 사람에게 없는 화면이 된다.

### 두 설문이 한 화면에 선다

`/ops/survey` 는 **풀이 설문**(글 하나에 대한 답)과 **서비스 설문**(서비스 전체에 대한 답,
ADR 0062) 둘을 함께 든다. 아래 SQL 은 앞의 것을 손으로 세는 자리이고, 서비스 설문 쪽은
「서비스 설문 — 손으로 세는 자리」 절에 있다.

### 손으로 세는 자리

답은 **그 글을 만든 시도에 매여 있다**(ADR 0022). 그래서 프롬프트 판본과 모델이 답 옆에
이미 있고, 따로 이어 붙일 일이 없다.

```sql
-- 프롬프트 판본별로 어떻게 읽혔나. 표본이 적을 때는 평균보다 개수를 먼저 본다.
select r.prompt_version, r.model, r.kind,
       count(*) as 답,
       round(avg(f.usefulness), 2) as 도움,
       round(avg(f.perceived_fit), 2) as 체감적합성,
       count(*) filter (where f.felt_length = 'long') as 길다,
       count(*) filter (where f.felt_length = 'short') as 짧다
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
group by r.prompt_version, r.model, r.kind
order by 답 desc;
```

```sql
-- 무엇이 아쉬웠나. 태그는 여섯 이름뿐이다(`src/lib/reading/feedback.ts`).
select r.prompt_version, t as 태그, count(*)
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id,
     unnest(f.issue_tags) t
group by r.prompt_version, t
order by count(*) desc;
```

> **체감 적합성만 보고 판단하지 않는다.** 바넘 문장은 근거 없이도 「내 얘기 같다」를
> 만든다. 이 값만 오르고 근거 밀착성이 떨어지면 그것은 개선이 아니라 바넘화다(`prd-archive`).

**풀이 본문은 여기 없다.** `reading_run` 은 글을 남기지 않으므로 답 옆에 남는 것은 점수와
태그와 생성 메타데이터뿐이고, 사용자의 실제 풀이를 운영자가 읽을 일이 없다.

**설문 전체가 개선 활용 동의 뒤에 있다.** 점수도 태그도 동의한 사람의 것만 들어온다.

```sql
-- 적어 주신 글. 동의한 사람의 것만 들어온다(RPC 가 막는다).
select r.prompt_version, f.comment, f.submitted_at
from public.reading_feedback f
join public.reading_run r on r.id = f.reading_run_id
where f.comment is not null
order by f.submitted_at desc;
```

동의는 `app_user.improvement_consent` 하나다. **`null` 과 `false` 는 다르다** — `null` 은
아직 안 물어본 것이고 `false` 는 거절한 것이다. 안내 화면이 서기 전까지는 전부 `null` 이라
설문이 아무에게도 안 보인다.

값을 손으로 옮기지 않는다. `set_improvement_consent(boolean)` 이 그 문이고, **끄면 그
사람의 답이 함께 지워진다** — 한 트랜잭션이다(ADR 0022). `update` 로 값만 꺼 두면 답은
근거 없이 남는다.

```sql
-- 누가 어디에 있나
select improvement_consent as 동의, count(*) from public.app_user group by 1;
```

---

## 서비스 설문 — 손으로 세는 자리 (ADR 0062)

화면은 `/ops/survey` 의 아래쪽 절이다. 여기 SQL 은 그 화면이 안 열리거나 수를 의심할 때,
그리고 **파기 전에 합계를 뽑을 때** 쓴다.

**제출한 것만 센다.** `submitted_at` 이 비어 있는 줄은 쓰다 만 초안이고, 그 문장을 제출한
의견처럼 읽으면 안 된다.

```sql
-- 참여
select
  count(*) filter (where submitted_at is not null) as 제출,
  count(*) filter (where submitted_at is null)     as 초안,
  count(*) filter (where updated_at is not null)   as 고쳐_다시_제출
from public.service_survey;
```

```sql
-- 문항별 선택지. 이름은 코드가 말로 옮긴다(`src/lib/survey`).
select '좋았던 기능' as 문항, t as 선택, count(*)
from public.service_survey s, unnest(s.liked) t
where s.submitted_at is not null group by t
union all
select '몰랐던 기능', t, count(*)
from public.service_survey s, unnest(s.unknown_features) t
where s.submitted_at is not null group by t
union all
select '개선할 부분', t, count(*)
from public.service_survey s, unnest(s.improve) t
where s.submitted_at is not null group by t
order by 1, 3 desc;
```

```sql
-- 값 — **제시 금액 목록과 함께 본다.** 목록을 옮기고 나면 고른 값만으로는 뜻이 없다.
select price_options as 제시목록,
       price_solo as 사주풀이, price_pair as 궁합, count(*)
from public.service_survey
where submitted_at is not null
group by 1, 2, 3
order by count(*) desc;
```

> **지불 의향이지 실제 구매가 아니다.** 가격 후보를 좁히는 참고 자료로 쓰고, 판매 가격의
> 적절성은 실제 구매·이탈 결과와 함께 판단한다.

```sql
-- 적어 주신 글
select improve_text, free_text, submitted_at
from public.service_survey
where submitted_at is not null and (improve_text is not null or free_text is not null)
order by submitted_at desc;
```

### 파기 전에 뽑는다

답은 계정에 매여 있어 **베타 파기 때 함께 사라진다**(ADR 0023). 위 세 질의를 파기 **전에**
돌려 결과를 따로 보관한다 — 남기는 것은 사람을 못 가리키는 **합계뿐**이고, 자유 서술은
그대로 옮기지 않는다.

---

## 이용 정지와 해제

`status` 하나가 모든 문을 막는다 — 읽기까지 막는다(`is_active_account()`). 새 관문을
두지 않았으므로 이 값만 옮기면 discovery·요청·수락·AI 생성이 한꺼번에 닫힌다.

계정은 **UUID 로** 가리킨다 — `/ops/reports` 의 계정 이름 아래 회색 글자다. 이메일로 찾는 것은 break-glass 다(맨 위
「개인정보는 화면으로만」). **신고로 정지하는 것이면 아래 UPDATE 대신 「신고와 차단」의 검토 문을 `suspension` 으로 부른다** —
검토 기록과 정지가 한 트랜잭션이다(ADR 0107). 아래 정지 SQL 은 신고와 무관한 정지에만 쓴다. 해제는 어느 쪽이든 아래 SQL 이고,
해제해도 「이용 정지 결정」 기록은 그대로 남는다.

```sql
-- 이용 정지
update public.app_user set status = 'suspended' where id = '<계정 UUID>';

-- 해제
update public.app_user
set status = 'active', deletion_requested_at = null
where id = '<계정 UUID>';
```

> 탈퇴 대기(`deletion_requested`)를 해제할 때도 같은 문을 쓴다. 검사식이 상태와 시각을
> 함께 묶고 있으므로 `deletion_requested_at` 을 같이 비워야 한다.

```sql
-- 지금 살아 있지 않은 계정들 — 이메일 없이
select a.id, a.status, a.deletion_requested_at
from public.app_user a
where a.status <> 'active'
order by a.deletion_requested_at desc nulls last;
```

---

## 신고와 차단

신고는 **운영자가 봐야 하는 기록**이고 차단은 사용자의 개인적 결정이다. 차단 기록을
운영 근거로 쓰지 않는다 — 「보기 싫다」와 「규칙을 어겼다」는 다른 일이다.

**읽는 것은 화면이 있다 — `/ops/reports`**(ADR 0103). 운영자로 로그인해 주소를 직접 친다(메뉴에 없다).
목록은 최신부터 30건씩이고 처리 상태 · 사유 · 대화 근거로 거른다. 「신고 내용 보기」가 신고 한 건과 신고
당시의 스냅샷을 연다. **여는 것마다 접속기록에 남는다**(ADR 0105). 화면은 읽기만 한다 — **검토 기록과 처분은 아래
검토 문이다.** 화면에는 이메일이 없다 — 이메일이 필요한 일(수사기관 요청 등)과 떠난 사람의 신고는 break-glass 다(맨 위
「개인정보는 화면으로만」). 언제 보는가는 「운영 주기」.

**처리 필요 = 아직 안 봤거나 추가 확인 필요(`needs_more`)다**(ADR 0107). 정의는 `public.report_is_open` 하나이고 화면의
「처리 필요」 거르기와 아래 질의가 같은 것을 부른다. 3영업일은 **처음 접수한 시각부터** 센다 — 추가 확인 필요로 보류해도 시계는
처음으로 안 돌아간다.

```sql
-- 처리 필요 — 건수와 가장 오래된 접수. 내용은 화면(`/ops/reports?review=open`)에서 읽는다
select count(*) as 처리_필요,
       count(*) filter (where review_outcome = 'needs_more') as 그중_추가_확인_필요,
       min(created_at) at time zone 'Asia/Seoul' as 가장_오래된_접수
from public.report where public.report_is_open(reviewed_at, review_outcome);

-- 접수 뒤 3영업일을 넘긴 처리 필요(주말만 뺀 어림 — 공휴일은 눈으로). 보류해도 접수 시각부터 센다
select id, created_at at time zone 'Asia/Seoul' as 접수, reason, review_outcome
from public.report
where public.report_is_open(reviewed_at, review_outcome)
  and (select count(*) from generate_series(created_at::date + 1, current_date, interval '1 day') d
       where extract(isodow from d) < 6) > 3
order by created_at;

-- 한 계정에 쌓인 신고 — UUID 로 센다(화면의 「신고받은 계정」 아래 회색 글자). 처분을 정하는 자리
select reported_user_id, reason, count(*), max(created_at) as 마지막
from public.report
group by reported_user_id, reason
order by count(*) desc;
```

**검토를 적는다 — 문 하나, 신고 id 로**(`public.review_report`, ADR 0107). 화면에서 읽고 판단한 뒤 적는다. 표를 직접
UPDATE 하지 않는다. 결과는 넷 중 하나다 — `no_action`(조치 없음) · `warning`(경고) · `suspension`(이용 정지 결정) ·
`needs_more`(추가 확인 필요). 판단 근거는 500자 안에서 **이메일 · 실명 · 연락처 없이** 적는다. 검토한 사람은 `public.operator` 의
운영자 UUID 다 — 한 번 보고 적어 둔다(`select user_id, note, added_at from public.operator;`, 이메일 없이). 운영자 표에 없는
UUID 면 문이 `42501` 로 거절한다. 실행한 운영자는 검토한 운영자로 적힌다. 이 호출도 `npm run db:remote -- --purpose "신고 검토
<신고 id 앞 8자>" "<sql>"` 로 보낸다 — 목적과 해시가 남는다.

```sql
-- 조치 없음 · 추가 확인 필요 — 제재 대상 없이
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '<짧은 판단 근거>');     -- 'needs_more'

-- 경고 — 제재 대상(신고의 두 계정 중 하나)이 있어야 한다. 계정은 그대로다. 갈래를 안 주면 신고 사유가 갈래다(ADR 0108)
select public.review_report('<report-id>', '<운영자 UUID>', 'warning', '<짧은 판단 근거>', '<대상 계정 UUID>');
-- 경고의 갈래를 신고 사유와 다르게 — harassment · impersonation · inappropriate · other 중 하나
select public.review_report('<report-id>', '<운영자 UUID>', 'warning', '<짧은 판단 근거>', '<대상 계정 UUID>', 'inappropriate');

-- 이용 정지 결정 — 같은 트랜잭션에서 대상 계정이 정지된다. 따로 app_user 를 고치지 않는다
select public.review_report('<report-id>', '<운영자 UUID>', 'suspension', '<짧은 판단 근거>', '<대상 계정 UUID>');
```

대상은 보통 신고받은 계정(화면의 「신고받은 계정」 아래 회색 글자)이고, 신고한 쪽이 받는 드문 경우는 그 계정이다. 돌려주는 값은
적은 표다 — `report`(지금 계정의 신고) · `retention`(떠난 사람의 신고). 다시 부르면 덮어쓴다(추가 확인 필요 → 결론).
**경고의 갈래는 이용자에게 가는 말이다** — 신고한 사람이 고른 사유가 운영자가 본 위반과 다르면(제재 대상이 신고한 쪽이면 더 그렇다)
여섯째 인자로 고른다. 경고가 아닌데 갈래를 주면 `22023`. 경고로 적히면 안내번호(`W-` 와 네 글자)가 붙고 상세 화면에 선다.

틀린 모양은 거절된다 — 조치 없음 · 추가 확인 필요에 대상을 주거나, 경고 · 이용 정지 결정에 대상이 없거나, 대상이 신고의 두
계정이 아니거나, 판단 근거가 500자를 넘으면 `23514` 다. **이용 정지 결정은 기록과 정지가 함께 되거나 함께 안 된다** — 탈퇴를
신청한 계정은 계정 검사식이 정지를 거절하므로 기록도 안 남는다(탈퇴 대기는 「탈퇴 신청의 처리」). 신고한 사람은 제 신고의 원래
칸만 읽는다 — 검토 결과 · 근거 · 제재는 안 보인다. **지금** 정지인가는 여전히 `app_user.status` 가 답한다 — 해제해도 「이용 정지
결정」 기록은 그대로 남는다(해제는 「이용 정지와 해제」). 경고를 적기 전에는 아래 「경고를 적기 전에 — 셈과 무게」를 본다.

차단은 참고로만 본다. 누가 누구를 차단했는지는 사용자에게 보이지 않으며, 여기서도
집계로만 읽는다.

```sql
select b.blocked_user_id, count(*) as 차단당한_수
from public.block b
group by b.blocked_user_id
having count(*) > 1
order by count(*) desc;
```

### 경고를 적기 전에 — 셈과 무게 (ADR 0108)

경고는 **사유의 갈래만** 이용자에게 가고(앱 안 안내와 이메일), **경고가 3회째가 되는 검토부터** 이용 정지 결정을 검토한다 —
자동 정지는 없다. **중대한 위반은 횟수를 안 보고 즉시** 검토한다. 결과를 `warning` 으로 적기 전에 셋을 밟는다.

1. **무게를 본다.** 처리 필요를 볼 때 `harassment`(괴롭힘이나 위협) 사유를 먼저 연다(`/ops/reports?review=open` 에서 사유로
   거른다). 무엇이 중대한가는 운영자가 판단한다 — 신고 사유에는 무게가 없다. 보기는 약관 초안 제21조(금지 행위)에 맞춘 것이다
   (닫힌 목록이 아니다, ADR 0108 추기): 신체에 대한 위해를 알리거나 공포심 · 불안감을 반복해 일으키는 것 · 원치 않는 음란한
   내용이나 성적 괴롭힘 · 성매매 · 성적 착취의 권유나 알선 · 금전 · 투자 권유나 다른 연락처로 옮기게 하는 사기 · 다른 사람의
   출생 정보를 스토킹 · 신상 파악에 쓰거나 개인정보 · 사진을 퍼뜨리는 것 · 다른 사람의 명의로 본인확인을 하거나 계정을 넘기는 것 ·
   만 19세 미만으로 보이는 정황(이용 자격, ADR 0101). 중대하면 앞선 경고가 없어도 `suspension` 으로 가고, 까닭을 판단 근거에 적는다
2. **대상 계정의 최근 12개월 경고를 센다** — 두 표에서 UUID 로. 12개월보다 오래된 경고는 표에 남아도 셈에 안 든다(운영자 결정
   2026-09-24). 신고한 사람이 떠나 옮겨진 신고(`retention.report`)의 경고도 대상의 것이다. 이메일 · 닉네임 · 판단 근거 · 본문을
   꺼내지 않으므로 보통 질의다(`--purpose "경고 셈 <신고 id 앞 8자>"`)
3. **이번이 3회째 이상이면 이용 정지 결정을 검토한다.** 같은 일을 가리키는 신고 여럿에 적은 경고는 한 번으로 본다 — 날짜와 신고
   id 로 가른다. 검토 끝에 경고로 두는 것도 된다. 경고로 적으면 판단 근거에 「경고 N회째 — 정지 검토함」처럼 남긴다. **횟수는
   이용자에게 말하지 않는다** — 안내 · 이메일 · 답장 어디에도

```sql
-- 대상 계정의 최근 12개월 경고 — 표 · 신고 id · 안내번호 · 갈래 · 경고한 때 · 이용자가 확인했는가. 판단 근거는 안 꺼낸다
select '지금 계정' as 표, id as 신고, warning_ref as 안내번호, warning_category as 갈래,
       reviewed_at at time zone 'Asia/Seoul' as 경고한_때, warning_acknowledged_at is not null as 확인함
from public.report
where review_outcome = 'warning' and sanctioned_user_id = '<대상 계정 UUID>'
  and reviewed_at > now() - interval '12 months'
union all
select '떠난 사람의 신고', report_id, warning_ref, warning_category,
       reviewed_at at time zone 'Asia/Seoul', warning_acknowledged_at is not null
from retention.report
where review_outcome = 'warning' and sanctioned_user_id = '<대상 계정 UUID>'
  and reviewed_at > now() - interval '12 months'
order by 경고한_때;
```

**이용자에게 알리는 길 — 앱 안 안내는 섰고, 이메일은 아직이다(G-57 · G-26).** 경고를 적으면 대상 계정이 다음에 로그인한 화면의
머리 아래에 안내가 선다 — 갈래 · 경고한 날 · 이의 제기의 길 · 안내번호뿐이고, 「확인했습니다」를 누르면 확인한 때가 남는다. 이용이
정지된 계정 · 탈퇴 대기에는 안 서고, 신고한 사람이 떠나 옮겨진 경고도 안 선다(ADR 0108 추기). **이메일은 안 간다** — 발송 칸
(`warning_emailed_at` · `warning_email_result`)은 G-26 의 잡을 기다리며 비어 있고, 운영자가 이메일 주소를 SQL 로 꺼내 손으로
보내지 않는다(이메일 열람은 break-glass 다 — 맨 위 「개인정보는 화면으로만」). 3회째의 검토에서는 위 질의의 「확인함」을 보고
**앞선 경고가 이용자에게 닿았는가**를 판단에 넣는다. 안내가 서기 전(2026-09-24 전)에 적힌 경고는 없다(그날 운영 DB 는 0줄).

「알렸는가」를 셀 때 — 개인을 가리키지 않는 집계다.

```sql
select count(*) filter (where warning_acknowledged_at is not null) as 확인함,
       count(*) filter (where warning_acknowledged_at is null) as 확인_전,
       count(*) filter (where warning_email_result = 'sent') as 이메일_보냄,
       count(*) filter (where warning_email_result = 'failed') as 이메일_실패
from public.report
where review_outcome = 'warning';
```

**이의 제기 · 이용 정지의 소명 — 고객 문의 이메일로 받는다**(G-25 ④ · ㉤, 첫 답 3영업일 안 · 주소는 사업자등록 뒤). 안내와
이메일이 **안내번호**(`W-7K3F` 꼴)를 함께 적어 달라고 말한다 — 받으면 `/ops/reports?ref=<안내번호>` 로 그 경고를 연다(소문자 ·
앞뒤 빈칸은 괜찮다). 보낸 주소로 계정을 찾지 않는다(break-glass). 번호가 없으면 답장으로 안내번호를 묻는다. 목록에 없으면 신고한
사람이 떠나 옮겨진 경고다 — 아래 질의로 신고 id 를 얻는다. 안내번호는 두 표를 합쳐 한 경고의 것이라 두 곳에서 둘이 나오는 일은 없다. 두 표 어디에도 없는데 대장(`public.warning_reference`)에 있으면 파기된 경고다 — 번호는 다시 쓰지 않는다(ADR 0108 추기). 받아들이면 같은 문을 다시 불러 결과를 덮어쓴다 — 그 경고는 셈에서
빠지고, 아직 확인 전이었으면 안내도 사라진다. 안내번호는 남아 나중에도 그 번호로 찾는다. 답장에도 판단 근거 · 신고한 사람 · 고른
메시지 · 경고 횟수를 옮기지 않는다.

```sql
-- 안내번호로 떠난 사람의 신고에서 찾는다 — 신고 id 와 경고한 때만
select report_id, review_outcome, reviewed_at at time zone 'Asia/Seoul' as 경고한_때
from retention.report where warning_ref = upper('<안내번호>');
```

```sql
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '이의 제기 인정 — <짧은 까닭>');
```

### 신고 열람대의 운영 검증 — G-24 를 닫는 열네 걸음 (ADR 0103 · 0105)

`/ops/reports` 가 프로덕션에서 실제로 신고 한 건을 끝까지 보여 주는지 **누구나 그대로 따라 밟을 수 있게** 적었다.
결과는 이슈 하나에 모은다 — 틀은 `.github/ISSUE_TEMPLATE/ops-verification.md`. 열넷을 다 채웠을 때만 G-24 를 닫는다.

**전제 넷 — 하나라도 거짓이면 시작하지 않는다.**

1. **마이그레이션이 운영에 올라 있다** — 적어도 `20261009090000`(운영자 문 셋) · `20261010090000`(검토 기록) ·
   `20261010100000`(접속기록) · `20261010110000`(가입 닫기). `npx supabase migration list` 의 remote 칸이 이 넷에서 비지 않는다
2. **최신 main 이 Production 에서 Ready 다** — 아래 「배포」의 「묶음 배포 — 최신 main 을 Production 으로 한 번」을 먼저
   밟는다. 배포 커밋이 main HEAD 가 아니면 옛 화면을 재는 것이다
3. **실제 개인정보가 없는 전용 테스트 계정** — 주소는 `@example.com`, 닉네임은 `검증A-<날짜>` 처럼 누가 봐도 시험인 것.
   운영자 계정(구글)은 제 것을 쓴다
4. **테스트 메시지 · 신고 설명에도 실제 이름 · 연락처 · 출생정보를 쓰지 않는다** — 스냅샷은 불변이고 접속기록은 지울 수
   없다. 출생정보는 가짜(예: 1990-05-15 14:30 서울)로 넣는다

SQL 은 전부 `npm run db:remote -- --purpose "G-24 검증 <걸음 번호>" "<sql>"` 로 보낸다(목적과 해시가 접속기록에 남는다).
**아래 질의는 테스트 계정 둘의 UUID 와 신고 id 로만 좁혀 두었다** — 그래도 메시지 본문이 나오는 ⑦ 은 break-glass 규율로
사람이 돈다. 에이전트는 질의를 건네기만 한다(`docs/agents/delegation.md`, ADR 0105).

| # | 걸음 | 어떻게 | 통과 |
| --- | --- | --- | --- |
| ① | 테스트 계정 A · B 준비 | `auth.admin.createUser({ email: 'g24-a-<날짜>@example.com', password, email_confirm: true })` 로 둘을 만들고(비밀 키 `SUPABASE_SECRET_KEY`), 「초대」의 SQL 로 **전용 코드**(`max_uses = 2`, 오늘 하루)를 넣어 `complete_signup` 을 지난다. 둘을 「운영 검증 계정」 표에 넣는다 — 수락하면 궁합풀이가 자동으로 만들어져 토큰이 나간다. 로그인은 구글이 아니라 비밀번호 세션이다(`scripts/check-chat.mjs` 의 `person` · `cookieFor` 와 같은 모양) | ⓐ 아래 질의가 둘 다 `active` · 가입 완료 ⓑ `verification_account` 에 둘 |
| ② | 둘 사이의 테스트 대화 | 둘 다 자기 사주를 저장하고 닉네임을 세운 뒤(인연 찾기에 든다) A 가 `request_match(B)`, B 가 `respond_to_match_request(요청, true)`. 방이 열리면 서로 세 줄 넘게 보낸다(`send_chat_message`) — 신고할 줄 하나는 「G-24 검증용 신고 대상 메시지」처럼 누가 봐도 시험인 글 | 1 번 질의의 `closed_reason` 이 비고 메시지 수가 보낸 수와 같다 |
| ③ | 신고 1건 | B 가 ② 의 「신고 대상」 메시지를 골라 신고한다 — 화면(방의 신고)이나 `report_chat_message(메시지 id, 'other', 'G-24 검증')`. 돌아온 신고 id 를 적는다 | 2 번 질의에 신고 한 줄 · 스냅샷 한 줄 |
| ④ | 목록에서 보인다 | 운영자 계정으로 `/ops/reports` 를 연다(메뉴에 없다 — 주소를 친다) | 맨 위 근처에 그 신고가 서고, 신고한 사용자 · 신고받은 사용자가 두 테스트 닉네임이다. 이메일 · 출생정보가 화면 어디에도 없다 |
| ⑤ | 거르기 셋 | `?review=open`(처리 필요) · `?reason=other` · `?evidence=chat` 을 하나씩 연다(화면의 거르기 링크와 같다). 그리고 `?review=done`(처리 완료) · `?evidence=none` | 앞의 셋에서는 그 신고가 보이고, 뒤의 둘에서는 안 보인다 |
| ⑥ | 상세 — 신고 내용과 스냅샷 | 「신고 내용 보기」로 `/ops/reports/<신고 id>` 를 연다 | 사유 · 설명 · 접수 시각이 ③ 과 같고, 대화 근거 절이 선다 |
| ⑦ | 고른 메시지와 앞뒤의 차례 | 화면의 스냅샷을 위에서 아래로 읽고 3 번 질의(**break-glass — 사람이**)와 견준다 | 「신고한 메시지」로 강조된 줄이 **하나**이고 ③ 에서 고른 글이다. 앞뒤 줄이 보낸 차례(`seq`)대로 서고 앞 · 뒤 각각 최대 다섯이다. 보낸 쪽이 「신고한 사용자」 · 「신고받은 사용자」로 맞게 붙는다 |
| ⑧ | 접속기록에 셋이 남는다 | 4 번 질의 | ④ ⑤ 의 `reports.list`(거른 조건이 `filter_summary` 에), ⑥ 의 `reports.detail` 과 `reports.snapshot` 이 **각각** `allowed` 로, 운영자 UUID 와 그 신고 id(목록은 비어 있다)로 선다. 줄 id 를 적는다 |
| ⑨ | 검토를 적는다 | 「신고와 차단」의 검토 문 — `select public.review_report('<신고 id>', '<운영자 UUID>', 'no_action', 'G-24 운영 검증 — 테스트 신고')`. 처리 필요에 남는 것을 보려면 먼저 `needs_more` 로 한 번 부르고 목록의 `?review=open` 에 그대로 서는지 본 뒤 `no_action` 으로 다시 부른다. 이용 정지 결정을 시험하려면 `suspension` 과 대상 A 의 UUID 까지(같은 트랜잭션에서 A 가 정지되고 방이 닫힌다 — 「이용 정지와 해제」로 푼다) | 돌려준 값 `report`. 정지를 시험했으면 1 번 질의에서 A 가 `suspended` |
| ⑩ | 화면과 DB 가 같다 | 상세를 새로 고치고 5 번 질의와 견준다 | 처리 상태 · 검토 결과(`no_action` → 「조치 없음」, `suspension` → 「이용 정지 결정」) · 검토한 운영자(닉네임) · 판단 근거 · 당시 제재 대상(없으면 항목 없음)이 DB 값과 한 글자도 다르지 않다. 목록의 `?review=done` 에 그 신고가 옮겨 서고 배지가 `처리 완료 · 조치 없음` 이다 |
| ⑪ | 비운영자는 못 읽는다 | A(또는 B)의 세션으로 `/ops/reports` 와 `/ops/reports/<신고 id>` 를 연다 | 둘 다 404 이고 자료가 한 줄도 안 선다. 6 번 질의에 그 계정의 `denied` 줄이 `reports.list` · `reports.detail` 로 선다 |
| ⑫ | 이슈에 적는다 | `ops-verification` 틀로 이슈를 연다 | 배포 SHA · Production URL · Ready 시각 · 신고 id · 실행 시각 · 접속기록 줄 id(⑧ ⑪) · 검토 결과(⑨) · 화면 확인 결과(④ ~ ⑦ ⑩ ⑪ 각각 통과/실패)가 다 있다. **이메일 · 메시지 본문은 적지 않는다** |
| ⑬ | 테스트 자료를 정리하거나 보존 방식을 적는다 | 아래 「정리」 | 이슈에 무엇을 지웠고 무엇이 왜 남는지(아래) 적혀 있다 |
| ⑭ | 닫는다 | 위 열셋이 전부 통과일 때만 | G-24 줄을 gaps 에서 지우고 changelog 에 날짜 · 이슈 번호와 함께 옮긴다. 하나라도 실패면 이슈에 실패한 걸음을 적고 **닫지 않는다** |

```sql
-- 1. 두 계정의 상태 · 가입 완료 · 방 (① ②) — 이메일을 찍지 않는다
select u.id, u.status, u.nickname is not null as 닉네임, u.notice_version,
       exists (select 1 from public.verification_account v where v.user_id = u.id) as 검증계정
from public.app_user u where u.id in ('<A>', '<B>');
select r.match_id, r.closed_reason, count(m.id) as 메시지
from public.chat_room r left join public.chat_message m on m.room_id = r.id
where r.user_low = least('<A>'::uuid, '<B>'::uuid) and r.user_high = greatest('<A>'::uuid, '<B>'::uuid)
group by r.match_id, r.closed_reason;

-- 2. 신고와 스냅샷이 한 줄씩 (③)
select r.id, r.reason, r.created_at, r.reviewed_at,
       s.context_before, s.context_after, jsonb_array_length(s.messages) as 스냅샷_줄
from public.report r left join public.chat_report_snapshot s on s.report_id = r.id
where r.reporter_user_id = '<B>' and r.reported_user_id = '<A>' order by r.created_at desc;

-- 3. break-glass(사람이, 대장 먼저) — 스냅샷의 차례. 테스트 계정의 시험 글만 든다 (⑦)
select (e ->> 'seq')::bigint as 차례, (e ->> 'chosen')::boolean as 고른_것,
       case e ->> 'sender_user_id' when '<B>' then '신고한 사용자' when '<A>' then '신고받은 사용자' end as 보낸_쪽,
       e ->> 'body' as 본문
from public.chat_report_snapshot s cross join lateral jsonb_array_elements(s.messages) e
where s.report_id = '<신고 id>' order by 차례;

-- 4. 운영자의 열람이 셋 다 남았나 (⑧)
select id, at at time zone 'Asia/Seoul' as 서울, action, target_report_id, filter_summary, outcome
from audit.operator_access
where channel = 'app' and actor_user_id = '<운영자 UUID>' and at > now() - interval '2 hours'
order by id;

-- 5. 검토 기록 — 화면과 견줄 값 (⑩)
select reviewed_at at time zone 'Asia/Seoul' as 검토, reviewed_by, review_outcome, review_note,
       sanctioned_user_id, sanctioned_by, public.report_is_open(reviewed_at, review_outcome) as 처리_필요
from public.report where id = '<신고 id>';

-- 6. 비운영자의 거절이 남았나 (⑪)
select id, at at time zone 'Asia/Seoul' as 서울, action, target_report_id, outcome
from audit.operator_access
where actor_user_id = '<A>' and outcome = 'denied' and at > now() - interval '2 hours' order by id;
```

**정리(⑬) — 무엇이 지워지고 무엇이 남나.** 두 테스트 계정을 「지우기」의 `forget_user` 로 **둘 다** 지우고 전용 코드를 닫는다
(`update public.signup_code set max_uses = 0 where code = '<코드>'`). 그러면 방 · 메시지 · 궁합은 사라진다. 남는 것은 둘이다.

- **신고와 스냅샷** — 지우기 전에 트리거가 `retention.report` 로 옮긴다(ADR 0098). 처분일부터 6개월 뒤 크론이 지운다.
  테스트 자료라 그 전에 지워도 되지만, 그 표를 손으로 지우는 길은 문서에 두지 않았다 — **6개월 뒤 자동 파기에 맡기고**
  신고 id 와 「테스트 — 6개월 뒤 자동 파기」를 이슈에 적는 것을 기본으로 한다
- **접속기록 줄** — 추가만 되는 표라 지울 수 없고(ADR 0105), AWS 가 켜져 있으면 S3 에도 나간다. 줄 id 를 이슈에 「G-24 운영
  검증」으로 적어 월 점검에서 이상 접근으로 읽히지 않게 한다

`verification_account` 의 줄은 계정을 따라 사라진다.

## 떠난 사람의 신고 기록 — **처분일부터 6개월, 운영자만** (ADR 0098)

신고한 쪽이든 당한 쪽이든 떠나면, 그 사람이 든 신고는 지워지기 **전에** `retention.report` 로 옮겨진다
(`auth.users` 의 트리거 `reports_outlive_the_leaver` — 크론의 처분이든 `forget_user` 든 같다). 처리방침의 절
「신고 기록은 따로 둡니다」가 이것을 알린다(`notice-v6`).

- **남는 것** — 사유와 상세 · 신고 시각과 검토 상태 · 불변 스냅샷(jsonb) · 두 계정의 UUID · 옮긴 순간의 로그인
  이메일 · 가입일(`auth.users.created_at`) · 탈퇴일. **IP · 실명 · 주민등록번호 · 전화번호 · 주소는 없다** —
  받은 적이 없다
- **누가 읽나** — 이 SQL 을 도는 운영자(`postgres`)뿐이다. `retention` 스키마는 API 에 안 나가고 `anon` ·
  `authenticated` · `service_role` 이 못 쓴다 — 앱 서버의 비밀 열쇠로도 못 읽는다. **신고한 사람이 요구해도
  상대의 신원을 알려 주지 않는다**
- **언제 사라지나** — 먼저 떠난 쪽의 처분일(`retained_at`)부터 6개월. 크론 `report-retention-purge`(매시 47분)가
  지운다. 남은 쪽이 나중에 떠나면 그 사람의 탈퇴일만 채워지고 시계는 그대로다. 실패는 `cron-watch` 가
  `cron-failed:report-retention-purge` 로 알린다
- **증거는 못 고친다** — 적을 수 있는 것은 검토 기록(시각 · 누가 · 결과 · 근거 · 제재 둘, ADR 0105 — 검토 문으로, ADR 0107)과 보류 두 칸뿐이다.
  나머지는 `55000` 으로 막힌다
- **읽는 것은 break-glass 다** — 화면에 없고 이메일과 본문이 든다. 맨 위 「개인정보는 화면으로만」의 대장을 먼저 적고
  사람이 돈다. 이메일 · 본문이 안 드는 첫 질의(파기 예정과 보류)는 보통 질의다

```sql
-- 따로 둔 신고 — 파기 예정일과 보류(이메일 없이)
select report_id, reported_at, reason, reviewed_at, review_outcome,
       reporter_left_at, reported_left_at,
       retained_at, retained_at + retention.report_period() as 파기_예정,
       hold_reason, held_at
from retention.report
order by retained_at desc;

-- break-glass — 두 계정의 당시 이메일
select report_id, reporter_email, reported_email from retention.report where report_id = '<report-id>';

-- break-glass — 한 건의 스냅샷을 편다(본문이 든다)
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       e ->> 'sender_user_id' as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from retention.report k
cross join lateral jsonb_array_elements(k.snapshot -> 'messages') e
where k.report_id = '<report-id>'
order by 차례;

-- 검토를 적는다 — 떠난 뒤에도 검토는 이어진다. 「신고와 차단」의 검토 문 그대로다(돌려준 값이 `retention`).
-- 같은 제약이 걸린다(ADR 0107). 이용 정지 결정은 남은 쪽에만 된다 — 떠난 계정에는 정지할 계정이 없어 거절된다
select public.review_report('<report-id>', '<운영자 UUID>', 'no_action', '<짧은 판단 근거>');

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'report-retention-purge';
```

### 수사기관의 요청이 오면

주는 것은 **확인된 수사기관의 적법한 요청**에만, **가진 범위 안에서**다(ADR 0098 「정한 것」). 근거는
전기통신사업법 제83조③ · 형사소송법의 영장이고, 개인정보 보호법 제18조②2 가 제3자 제공을 연다.

1. **서면을 받는다.** 제83조④ — 요청사유 · 가입자와의 연관성 · 필요한 자료의 범위를 적은 서면. 긴급해서 서면
   없이 왔으면 사유가 끝나는 대로 서면을 받는다. 서면이 없으면 주지 않는다
2. **기관을 확인한다.** 공문의 발신 기관 대표 번호로 되걸어 요청자를 확인한다 — 전화나 메일로 온 요청의 번호로
   되걸지 않는다
3. **범위를 좁힌다.** 요청서가 가리키는 계정 · 신고만 뽑는다. 줄 수 있는 것은 위 「남는 것」뿐이고, 그중
   요청서가 적은 항목만이다. 살아 있는 계정의 것이면 `public.report` · `auth.users` 에서, 떠난 사람의 것이면
   `retention.report` 에서 뽑는다
4. **대장에 적는다.** 제83조⑤ — 제공한 날 · 요청 기관 · 요청서 번호 · 제공한 자료의 범위를 적고 요청서를 함께
   보관한다. 대장은 이 DB 밖의 운영 문서에 둔다(요청서가 종이이거나 PDF 다)
5. **반기마다 보고한다.** 제83조⑥ — 제공 현황을 연 2회 과기정통부에 보고한다. 제공이 없던 반기에는 할 것이 없다

### 보존 요청 — 보류를 걸고 푼다

6개월 안에 수사기관이 **보존**을 요청하면(적법한 서면) 그 줄에 보류를 건다. 걸린 줄은 크론이 안 지운다.
보류는 요청서가 가리킨 줄에만 건다 — 한 사람의 신고 전부에 거는 것이 아니다.

```sql
-- 건다 — 무엇을 근거로 걸었는지 남긴다: 기관 · 문서 번호 · 받은 날
update retention.report
set hold_reason = '<기관> <문서 번호> <받은 날> 보존 요청', held_at = now()
where report_id = '<report-id>';

-- 걸린 줄
select report_id, hold_reason, held_at, retained_at + retention.report_period() as 원래_파기_예정
from retention.report where hold_reason is not null;

-- 푼다 — 사유가 끝났을 때(수사 종결 통보 · 요청 철회). 6개월이 이미 지났으면 다음 실행(매시 47분)이 지운다
update retention.report set hold_reason = null, held_at = null where report_id = '<report-id>';
```

**보류는 연장이 아니라 미룸이다.** 풀면 원래 처분일부터 센 6개월로 돌아간다. 보류를 걸어 둔 채 잊지 않도록
분기마다 위 「걸린 줄」 질의를 한 번 돈다.

---

## 탈퇴 신청의 처리

사용자가 `/me/settings` 의 「탈퇴」에서 신청하면 상태가 **탈퇴 대기**(`deletion_requested`)로 옮겨지고,
그 순간 후보 노출이 꺼지고 살아 있던 요청이 정리된다. **처분은 크론이 한다**(2026-09-23, G-53, ADR 0094 덧) —
처분이 끝난 계정이 **탈퇴**다(PRD §5.3).

- **기한은 신청 뒤 3일이다** — 달력의 날이고 주말 · 공휴일을 안 가른다. 시계는 앱이 적은
  `deletion_requested_at` 하나다. **연락처로 요청하는 경로는 없다.**
- 크론 `account-disposal`(매시 23분)이 **신청 뒤 하루가 지난** 대기를 집어 `forget_user` 를 돌리고, 바로
  흔적을 잰다(`account_residue`). 흔적이 남으면 처분째 되감기고 계정은 대기에 남아 다음 시간에 다시 집힌다.
  하루를 두는 것은 되돌릴 틈이고, 남은 이틀은 다시 시도할 여유다.
- **운영자가 할 일은 알림이 왔을 때뿐이다.** `account-disposal-failed`(실패) · `account-disposal-overdue`
  (신청 뒤 3일이 지난 대기가 있다). 성공은 안 알린다.

```sql
-- 기다리는 계정과 그 시도 — 실패한 줄만 id 를 든다
select a.id, a.deletion_requested_at, d.attempts, d.last_attempt_at, d.last_error
from public.app_user a
left join public.account_disposal d on d.user_id = a.id
where a.status = 'deletion_requested'
order by a.deletion_requested_at;

-- 처분된 것 — 누구였는지는 안 남는다. 신청 · 처분 시각과 시도 수만
select requested_at, disposed_at, attempts from public.account_disposal
where disposed_at is not null order by disposed_at desc limit 20;

-- 크론이 도는가
select jobname, schedule, active from cron.job where jobname = 'account-disposal';
```

**실패했을 때.** `last_error` 가 원인을 든다 — 「처분 뒤 흔적이 남았다: <자리>」면 그 자리가
`forget_user` 가 모르는 새 흔적이다. 그 자리를 `forget_user` 에 더하는 마이그레이션이 해법이고, 그때까지는
크론이 한 시간마다 다시 실패하고 알린다(같은 종류는 하루 한 번). 손으로 급히 처분해야 하면 아래 한 줄과
흔적 질의를 그대로 쓴다 — 크론과 같은 문이다.

**무엇이 지워지고 무엇이 남는가**(2026-09-23, ADR 0094 · PRD §5.3). 처분은 아래 한 줄이고, 무엇을
지우고 남기는지는 FK 와 트리거가 든다 — 운영자가 표마다 지우지 않는다.

| 무엇 | 처분 |
| --- | --- |
| 계정 · 닉네임 · 사진 · 활동 · Person 과 입력 · 풀이 · 설문 · 동의 · 요청 · 소식 · 차단 · 공유 링크 | **지운다.** 남이 함께 관리하는 Person 은 남는다(ADR 0023) |
| 함께 보던 궁합 — 그 사람의 동의 당시 여덟 글자, 그 Match 의 궁합풀이와 시도 | **지운다.** 상대 화면에서는 신청 때부터 내려가 있었다 |
| 대화방 · 메시지 | **남는다.** 그 사람의 자리만 비고 상대가 닫힌 날부터 90일까지 본다. 상대 화면의 이름은 「탈퇴한 사용자」 |
| Match 행 | **남는다** — 대화방을 매단 자리로만. 상대도 떠나면 방째 사라진다 |
| 신고 · 신고 스냅샷 | **따로 6개월 남는다.** 지워지기 전에 `retention.report` 로 옮겨지고 일반 표에서는 사라진다 — 위 「떠난 사람의 신고 기록」(ADR 0098) |

- **처리 기한은 신청 뒤 3일이고 크론이 센다**(위). 화면과 처리방침의 「영업일 3일」 문장은 #165 가
  `notice-v6` 으로 한 번에 고친다 — 그 사이에는 약속보다 빨리 지우는 쪽이다.
- **되돌리려면 처분 전에** 상태를 `active` 로 되돌린다 — 닫힌 대화방은 다시 안 열린다(ADR 0091).
  처분 뒤에는 되돌릴 길이 없다.

```sql
-- **`delete from auth.users` 를 직접 쓰지 않는다.**
--
-- 그 문장은 FK 가 닿는 것만 데려간다. 감사 로그(모든 행이 이메일을 든다)와 flow state 는
-- 사용자에 안 매여 있어 그대로 남는다(ADR 0023). 위의 「지우기」 절과 같은 문을 쓴다 —
-- 절차가 둘이면 하나는 낡는다.
select * from public.forget_user('<user-id>');
```

지운 뒤에는 **위 「베타 종료 — 전부」의 검증 질의를 그대로** 돌려 그 사람의 흔적이
없는지 본다. 한 사람을 지운 뒤라 전체가 0일 수는 없으므로, 그 사람의 이메일과 id 로
좁혀 본다. 대화방이 남았는지와 그 사람의 여덟 글자가 비었는지도 함께 본다.

```sql
select
  (select count(*) from auth.users where id = '<user-id>') as 계정,
  -- **두 조건을 다 본다.** `forget_user` 가 그 둘로 지운다 — id 로만 세면 이메일만
  -- 든 행(로그인 시도 등)이 남아도 0으로 보인다.
  (select count(*) from auth.audit_log_entries
   where payload ->> 'actor_id' = '<user-id>'
      or payload ->> 'actor_username' = '<지운 주소>') as 감사로그,
  (select count(*) from auth.flow_state where user_id = '<user-id>') as 로그인중간상태;

-- 남는 것 — 처분 전에 적어 둔 Match id 들로 본다. 상대의 칸과 여덟 글자는 그대로, 그 사람의
-- 칸 · 여덟 글자 · 궁합풀이는 비고, 방은 닫힌 채 남는다.
select m.id, m.user_low, m.user_high,
       m.chart_low is not null as 낮은쪽_여덟글자, m.chart_high is not null as 높은쪽_여덟글자,
       (select count(*) from public.reading r where r.match_id = m.id) as 궁합풀이,
       r.closed_reason, r.closed_at,
       (select count(*) from public.chat_message x where x.room_id = r.id and x.sender_user_id is null) as 떠난쪽_메시지
from public.match m join public.chat_room r on r.match_id = m.id
where m.id in ('<match-id>');
```

---

## 채팅 (ADR 0091)

채팅 안전 베타의 운영자 수단은 **화면이 아니라 여기 SQL 이다**(PRD §7.0). 방은 Match 에 1:1 이고
차단 · 이용 정지 · 탈퇴 신청이 트리거로 닫는다. 운영자가 누를 것은 없다 — 이용 정지는 위 「이용 정지와
해제」의 그 한 줄이 방까지 닫는다.

**대화방 전체를 여는 열쇠는 없다.** 운영자가 읽는 것은 신고에 붙은 스냅샷뿐이다. 아래 질의는
전부 SQL Editor(`postgres`)에서 돈다 — 앱 역할에는 이 표들이 닫혀 있다.

### 신고 스냅샷을 읽는다

**화면이 먼저다 — `/ops/reports/<report-id>`**(ADR 0103). 스냅샷을 차례대로 펴고, 고른 메시지에 「신고한
메시지」가 서고, 보낸 쪽을 「신고한 사용자」 · 「신고받은 사용자」로 적는다. 목록에서 「대화 근거 있음」으로
거르면 스냅샷이 붙은 신고만 남는다. 여는 것마다 접속기록에 남는다(ADR 0105). **아래 SQL 은 break-glass 다** — 메시지
본문과 이메일이 든다. 화면이 안 열리는 장애나 수사기관의 요청일 때만, 맨 위 「개인정보는 화면으로만」의 대장을 먼저 적고
사람이 돈다. 검토를 적는 것은 「신고와 차단」의 검토 문이다.

```sql
-- break-glass — 한 신고의 스냅샷을 차례대로 편다. `chosen` 이 참인 줄이 고른 메시지다.
-- 보낸 사람은 UUID 로 둔다 — 이메일이 필요하면 그것도 대장에 적은 목적 안에서만 푼다.
select (e ->> 'seq')::bigint as 차례,
       (e ->> 'created_at')::timestamptz at time zone 'Asia/Seoul' as 보낸_시각,
       e ->> 'sender_user_id' as 보낸_사람,
       (e ->> 'chosen')::boolean as 고른_것,
       e ->> 'body' as 본문
from public.chat_report_snapshot s
cross join lateral jsonb_array_elements(s.messages) e
where s.report_id = '<report-id>'
order by 차례;
```

스냅샷은 **불변**이다 — `update` 는 소유자에게도 막힌다(`55000`). 지워지는 길은 신고가 사라질
때뿐이고, 신고는 계정을 따라간다(「지우기」). 그 전에 트리거가 신고째 `retention.report` 로 옮긴다 —
떠난 사람의 신고는 위 「떠난 사람의 신고 기록」에서 읽는다.

### 닫힌 지 90일 지난 방의 메시지를 지운다 — **손으로**

크론이 아니다(PRD §7.1). 배포한 날이나 달마다 한 번 돈다. 기간은 DB 의 `chat_retention()` 이
들고(90일), 이 함수와 pgTAP 이 같은 문을 돌린다.

```sql
-- 무엇을 지울 것인지 먼저 본다. 세어 보지 않고 지우지 않는다.
select r.match_id, r.closed_reason, r.closed_at, count(m.id) as 메시지
from public.chat_room r
join public.chat_message m on m.room_id = r.id
where r.closed_at < now() - public.chat_retention()
group by r.match_id, r.closed_reason, r.closed_at
order by r.closed_at;

-- 지운다. 지우는 것은 메시지뿐이다 — 방은 남아 닫힌 이유를 계속 말하고, 스냅샷은 신고를 따른다.
select public.purge_closed_chat_messages();  -- 지운 메시지 수
```

### 한도에 걸린 건수를 본다

전송 한도는 계정당 1분 30건이고(`chat_policy()`), 걸린 전송은 거절되며 **한 건 한 줄**로 남는다.
거절이 값으로 돌아오기 때문에 트랜잭션이 남는다(ADR 0091).

```sql
-- 최근 7일, 날짜 × 사람
select (h.created_at at time zone 'Asia/Seoul')::date as 날짜, u.email, count(*) as 거절
from public.chat_rate_limit_hit h
join auth.users u on u.id = h.user_id
where h.created_at > now() - interval '7 days'
group by 1, 2
order by 1 desc, 3 desc;

-- 지금 정책의 수 다섯 — 앱의 lib 이 같은 수를 들어야 한다
select * from public.chat_policy();
```

### 접속 상태 — 구간만 나간다 (ADR 0092)

로그인된 요청마다 `proxy.ts` 가 `touch_activity()` 를 부르고, 그 문은 **1분에 한 번**만
`user_activity.last_active_at` 을 적는다. 상대에게 나가는 것은 구간 셋(`now` 5분 미만 · `day` 24시간
미만 · `earlier`)뿐이고 시각은 어느 읽는 문에도 없다. 표는 앱 역할에 닫혀 있어 여기서만 읽는다.

```sql
-- 지금 정책의 수 셋(초) — 앱의 lib 이 같은 수를 들어야 한다
select * from public.presence_policy();

-- 한 사람의 마지막 활동과 구간
select a.last_active_at, public.activity_band_of(a.user_id) as 구간
from public.user_activity a where a.user_id = '<user uuid>';

-- 프로덕션 확인 — 구간을 바꿔 본다(#121 의 끝났다고 말할 조건 2)
update public.user_activity set last_active_at = now() - interval '25 hours' where user_id = '<B>';

-- 읽는 문 둘의 반환에 활동 시각이 없다(pgTAP 35 와 같은 질의 — 0 이어야 한다)
select count(*) from pg_proc p
cross join lateral unnest(p.proargnames, p.proargmodes) as a(name, mode)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('my_chat_rooms', 'my_discovery_board')
  and a.mode = 't' and a.name like '%active_at%';
```

### 완료 조건 여섯을 프로덕션에서 밟는 순서

§7.0 의 여섯을 **운영자가 지정한 테스트 계정 둘**(A · B)로 한 번씩 밟는다. 화면은 `/me/chat`(탭 「채팅」)
이고 방은 함께 보는 궁합의 「채팅」으로도 연다. 확인은 SQL 로 한다.

1. **주고받는다.** A 와 B 를 매칭시키고(요청 → 수락) 서로 한 줄씩 보낸다.
   ```sql
   select r.match_id, r.closed_reason, count(m.id) as 메시지
   from public.chat_room r left join public.chat_message m on m.room_id = r.id
   where r.user_low = least('<A>', '<B>') and r.user_high = greatest('<A>', '<B>')
   group by r.match_id, r.closed_reason;   -- closed_reason 이 null, 메시지 2
   ```
2. **한도 거절.** A 가 1분 안에 31건을 보낸다(화면에서든 `send_chat_message` 를 31번 부르든).
   31번째가 거절되고 `chat_rate_limit_hit` 에 A 의 줄이 하나 선다(위 「한도에 걸린 건수」).
3. **신고 스냅샷.** B 가 A 의 메시지 하나를 골라 신고한다. 위 「신고 스냅샷을 읽는다」로 고른
   메시지와 앞뒤가 베껴졌는지 본다. 이때 방은 그대로 열려 있어야 한다(신고는 닫지 않는다).
4. **차단.** A 가 B 를 차단한다. 방의 `closed_reason` 이 `block` 이고, **둘 다** 이전 대화를 보며
   둘 다 입력이 안 된다. 그리고 매칭 목록에서는 내려간다(§6.5).
5. **이용 정지.** 다른 쌍(A · C)을 세우고 C 를 정지한다(「이용 정지와 해제」의 한 줄). 방의 `closed_reason`
   이 `suspension`, `closed_by_user_id` 가 C. A 는 방과 대화를 보고 C 는 아무것도 못 본다.
   ```sql
   update public.app_user set status = 'suspended' where id = '<C>';
   select closed_reason, closed_by_user_id, closed_at from public.chat_room
   where user_low = least('<A>', '<C>') and user_high = greatest('<A>', '<C>');
   ```
6. **삭제 요청.** 또 다른 쌍(A · D)을 세우고 D 가 `/me/settings` 의 「탈퇴」→「탈퇴를 신청합니다」로 신청한다. `closed_reason` 이
   `deletion_request`, `closed_at` 이 D 의 `deletion_requested_at` 과 같다. A 는 보고 D 는 못 본다.

끝나면 테스트 계정을 「지우기」로 정리한다 — **쌍의 두 계정을 다** 지운다. 한쪽만 지우면 방과 메시지는
남는 쪽에 남는다(ADR 0094). 둘 다 지우면 Match 째 사라지고, 신고 · 스냅샷은 신고를 따라 사라진다.
지우기 전에 위 검증의 결과를 이슈 #115 에 적는다.

---

## AI 생성 — 호출량 · 실패 · 지연

한 번의 생성 요청이 `reading_run` 에 한 줄이다. **본문은 남지 않는다**(ADR 0013) —
여기서 볼 수 있는 것은 언제·무엇으로·어떻게 끝났나뿐이다.

```sql
-- 최근 24시간: 얼마나 불렀고 얼마나 실패했나
select date_trunc('hour', created_at) as 시각,
       count(*) as 시도,
       count(*) filter (where status = 'succeeded') as 성공,
       count(*) filter (where status = 'failed') as 실패,
       round(avg(extract(epoch from (finished_at - created_at))) filter
             (where finished_at is not null)::numeric, 1) as 평균_초
from public.reading_run
where created_at > now() - interval '24 hours'
group by 1 order by 1 desc;

-- 무엇이 막고 있나 — 검사에 걸린 것과 모델이 못 낸 것을 가른다
select failure_code, count(*), max(created_at) as 마지막
from public.reading_run
where status = 'failed' and created_at > now() - interval '7 days'
group by failure_code order by count(*) desc;

-- 도는 채로 남은 시도 (서버가 죽은 자리). DB 가 10분 뒤 만료로 닫지만 세어 둔다.
select id, kind, user_id, created_at
from public.reading_run
where status = 'running' and created_at < now() - interval '10 minutes';

-- 지금 어떤 모델·프롬프트 판본으로 서 있나
select model, prompt_version, count(*), max(created_at) as 마지막
from public.reading_run group by 1, 2 order by 4 desc;
```

**여기서는 호출 수만 센다.** 쓴 토큰과 하루 상한은 아래 「AI 비용 한도」가 들고, 금액은
provider 쪽에 있다.

> **게이트웨이가 아니라 OpenAI 를 직접 부른다.** 이 문단은 「Vercel AI Gateway 에
> 예산 한도를 걸어 둔다」라고 적혀 있었는데, 게이트웨이가 카드 없음으로 거절하는
> 동안 `@ai-sdk/openai` 로 옮겼다(`app/me/reading/model.ts`). 한도를 걸 자리도
> 함께 옮겨 갔다.

바깥 한도는 **OpenAI 대시보드**에 건다 — Settings → Organization → Limits 의 월 예산과
경고선, 그리고 자동 충전 끄기. 안쪽 한도는 앱에 있다(아래).

지금 서 있는 값은 `GENERATION` 이 든다. 무엇으로 얼마나 불렀는지는 위의
`reading_run` 질의가 세고, **그것에 값을 곱해 보는 일은 대시보드에서 한다.**

---

## AI 비용 한도 — **안쪽 벽과 바깥 벽** (ADR 0039)

벽이 둘이고 **안쪽이 먼저 닿아야 한다.** 앱 상한에 닿은 사용자는 「오늘은 여기까지,
내일 다시 열립니다」를 읽는다. 대시보드 한도에 먼저 닿으면 읽는 것은 「실패했습니다」뿐이다.

| | 값 | 어디 |
|---|---|---|
| 사람당 풀이권 | 5 | `reading_credit_limit()` |
| 사람당 시간당 | 20 (실패한 시도도 든다) | `reading_rate_limit()` |
| **전체 하루** | **500**(2026-09-23 에 100 → 500, G-03) | `reading_daily_budget()` |
| 운영자 경고 | 상한의 80% — 400 | `reading_budget_warning()` |
| 운영 검증 계정 | 세되 따로 낸다 | `verification_account` 표 · `reading_spend_daily` 의 `verification_*` 칸 |
| 바깥 벽 | 월 예산·자동 충전 끔 | OpenAI 대시보드 |

### 얼마나 썼나

```sql
-- 날짜·종류별 시도와 토큰. `usage_unknown` 이 크면 토큰 합이 실제보다 작다는 뜻이다.
select * from public.reading_spend_daily order by day desc, kind;

-- 실제 사용자의 수 — 운영 검증 계정의 시도를 뺀다(상한은 둘 다 센다)
select day, sum(attempts - verification_attempts) as 사용자_시도,
       sum(verification_attempts) as 검증_시도
from public.reading_spend_daily group by day order by day desc;

-- 오늘 몇 번 썼나 (상한이 보는 바로 그 수)
select public.reading_spend_today() as 오늘, public.reading_daily_budget() as 상한;
```

**금액은 여기 없다.** 단가는 provider 가 정하므로 토큰까지만 낸다 — 원 단위는 대시보드다.

### 운영 검증 계정 — 누구의 시도를 따로 세나

제품을 확인하려고 누르는 계정이다. **세는 것은 그대로이고**(토큰은 누가 눌렀든 나간다) 지출 표가
그 계정의 수를 `verification_*` 칸에 따로 낸다. 주소는 저장소에 안 적는다 — 운영 DB 에만 둔다.

```sql
insert into public.verification_account (user_id, note)
select id, '운영 검증 — <누가 언제>' from auth.users where email = '<주소>';

-- 지금 몇이 서 있나 (주소는 찍지 않는다)
select count(*) from public.verification_account;
```

### 막혔을 때 — **하루 봉쇄를 푸는 한 줄**

OpenAI 장애로 실패가 쌓여 상한이 찼는데 사람들이 아직 못 쓴 경우다. 실패도 그 수에
들므로 **아무도 글 하나 못 받고 하루가 닫힐 수 있다.** 그때 상한을 임시로 올린다:

```sql
create or replace function public.reading_daily_budget()
returns integer language sql immutable set search_path = '' as $$ select 800 $$;
```

**올리기 전에 셋을 본다.**

1. `select * from public.reading_spend_daily where day = (now() at time zone 'Asia/Seoul')::date;`
   — 실패가 대부분인가. 성공이 쌓여 찬 것이면 그것은 사고가 아니라 정상 사용이고,
   그때 올리는 것은 **비용을 쓰겠다는 결정**이다
2. **바깥 벽이 위에 있는가.** 새 값 × 한 번 비용이 대시보드 월 예산 안에 드는가.
   안쪽을 바깥보다 높이 올리면 이 문서의 첫 줄이 거짓이 된다
3. 장애가 끝났는가. 실패가 계속 나는 중에 올리면 **새는 구멍을 넓히는 것**이다

**그날 안에 되돌린다.** 되돌리는 것도 같은 한 줄이고, 값만 500 이다. 안 되돌리면 다음
사고 때 이 벽은 없는 것과 같다.

### 운영자 알림 배선

경고(80%)와 도달은 `ops_alert` 에 적히고, **주소가 있으면** 거기로도 던진다. Slack·Discord
Incoming Webhook 둘 다 그대로 받는다.

```sql
-- 넣기 (한 번)
select vault.create_secret('https://hooks.slack.com/services/…', 'ops_alert_url');

-- 들어갔나 — 값은 안 본다
select count(*) from vault.decrypted_secrets where name = 'ops_alert_url';

-- 실제로 나가는지 한 번 쏴 본다
select public.notify_ops('ops-alert-test', '배선 확인');

-- 나갔나 — 200 이면 닿았다
select status_code, created from net._http_response order by created desc limit 3;
```

> `notify_ops` 는 **하루에 한 종류당 한 줄**이다. 같은 이름으로 두 번 쏘면 두 번째는
> `false` 를 내고 아무것도 안 던진다. 다시 시험하려면 이름을 바꾸거나
> `delete from public.ops_alert where kind = 'ops-alert-test';` 로 지운다.

```sql
-- 무엇이 언제 울렸나
select kind, detail, created_at from public.ops_alert order by created_at desc limit 20;
```

---

## 도는 잡이 정말 도나 — **실패는 여기에만 남는다**

`pg_cron` 이 돌리는 것은 앱 로그에 안 남고 `cron.job_run_details` 에만 남는다. 그래서
**실패해도 아무도 모른다.** 실제로 그랬다: 복구기가 2026-09-01 부터 **4,542번 연속
실패**하고 있었고(`extensions.http_get` 은 없다 — `pg_net` 은 `net` 에 산다), 알림 배선을
쏴 보다가 같은 착각을 발견해서야 드러났다(ADR 0039).

**이제 감시기가 본다**(2026-09-23, G-42). 크론 `cron-watch`(10분마다)가 `watch_cron()` 으로 지난 한 시간을
보고, 셋 중 하나면 `notify_ops` 로 한 줄을 보낸다 — 정상 실행은 아무것도 안 적는다. 같은 종류는 하루 한 번이다.

| 종류 | 뜻 | 할 일 |
| --- | --- | --- |
| `cron-failed:<잡>` | 그 잡의 SQL 이 실패했다. 알림에 마지막 오류가 붙는다 | 아래 질의로 `return_message` 를 보고 함수를 고친다 |
| `net-request-failed` | 크론이 밖으로 부른 요청이 2xx 가 아니었다 — 대부분 복구기다. 잡은 초록이어도 이것이 온다 | 403 이면 `CRON_SECRET` 과 Vault 의 `reading_recovery_secret` 이 갈렸다, 503 이면 Vercel 쪽 열쇠 · DB 문 |
| `cron-inactive:<잡>` | 잡이 꺼져 있다 | 일부러 끈 것이 아니면 `select cron.alter_job(<jobid>, active := true)` |

재시도 소진은 잡이 스스로 알린다 — `account-disposal-overdue`(G-53) · `reading-budget-reached`.

**감시기가 못 보는 것 둘** — 감시기 자신이 계속 실패하는 것, `pg_cron` 이 통째로 멈춘 것. 그래서
**배포한 날과, 잡을 건드린 날에 한 번씩은 여전히 본다.**

```sql
select j.jobname, d.status, count(*) as 횟수,
       min(d.start_time) as 처음, max(d.start_time) as 마지막,
       max(d.return_message) filter (where d.status = 'failed') as 마지막_실패
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where d.start_time > now() - interval '24 hours'
group by 1, 2 order by 1, 2;
```

지금 서 있는 잡은 넷이다 — `reading-recovery`(1분) · `match-request-expiry`(매시 7분) ·
`account-disposal`(매시 23분, G-53) · `cron-watch`(10분, G-42).
Vercel Cron 은 둘이다(`vercel.json`) — 복구기의 하루 청소(`/api/cron/reading`)와 접속기록 반출(`/api/cron/audit-export`,
ADR 0105). 둘은 `cron-watch` 가 못 본다 — 반출은 월 점검이 본다.
**`failed` 가 한 줄이라도 있으면 그 잡은 지금 안 도는 것이다.**

---

## 제품 지표

`prd-archive` 의 「제품 분석 지표」를 SQL 로 읽는 자리. 성장 목표 숫자는 아직 두지 않았다 —
먼저 분포를 본다.

```sql
-- 온보딩: 가입한 사람 중 자기 사주를 저장한 비율
select count(*) as 계정,
       count(self_person_id) as selfPerson_저장,
       round(100.0 * count(self_person_id) / nullif(count(*), 0), 1) as 비율
from public.app_user where status = 'active';

-- 참여 · 노출 · 요청 · 수락
select
  (select count(*) from public.discovery_profile where opted_in_at is not null) as 참여중,
  (select count(*) from public.discovery_impression) as 노출,
  (select count(*) from public.match_request) as 요청,
  (select count(*) from public.match_request where status = 'accepted') as 수락,
  (select count(*) from public.match_request where status = 'rejected') as 거절,
  (select count(*) from public.match_request where status = 'pending') as 미응답;

-- 자리와 탐색 여부에 따라 요청률이 다른가 — `discovery-v0` 를 평가하는 근거
select i.position, i.exploration, count(*) as 노출,
       count(r.id) as 요청,
       round(100.0 * count(r.id) / nullif(count(*), 0), 1) as 요청률
from public.discovery_impression i
left join public.match_request r
  on r.requester_user_id = i.viewer_user_id
 and r.addressee_user_id = i.candidate_user_id
group by i.position, i.exploration
order by i.position, i.exploration;

-- 출생시간 유무에 따른 노출 격차 (고정 표본 측정은 `src/lib/discovery/exposure.test.ts`)
select per.birth_time is not null as 시각_있음,
       count(distinct p.user_id) as 사람,
       count(i.candidate_user_id) as 노출
from public.discovery_profile p
join public.app_user a on a.id = p.user_id
join public.person per on per.id = a.self_person_id
left join public.discovery_impression i on i.candidate_user_id = p.user_id
where p.opted_in_at is not null
group by 1;
```

### 풀이 재사용 — 최소 측정 (G-37)

로그인 사용자의 풀이 생성만 센다 — 외부 분석 도구 · 쿠키 · 익명 식별자는 없다(2026-09-23 사람의 결정).
읽는 것은 `reading_run` 의 **사용자 ID · 상태 · 시각뿐**이고, 이메일 · 닉네임 · 출생정보 · 풀이 본문은 안 읽는다.
복사해 두는 표도 없다 — 매번 이 질의가 센다. 운영 검증 계정(`verification_account`)은 뺀다.

- **요청**은 시도 행 하나다 — 상한(G-03)이 세는 것과 같다. 개인 · 저장한 사람 · 직접 궁합 · 수락 뒤 자동 궁합 · 다시 받기가
  다 들고, 자동 궁합은 그 행의 사용자에게 센다
- **성공률**은 끝난 시도(성공 + 실패) 중 성공이다 — 도는 중인 것은 분모에 안 넣는다
- **재사용률**은 첫 성공 뒤 30일이 **다 지난** 사람만 분모에 든다. 창이 아직 열린 사람은 따로 센다 — 섞으면 막 온
  사람이 「안 돌아왔다」로 세어져 비율이 낮게 읽힌다
- **탈퇴하면 빠진다.** `reading_run.user_id` 가 `on delete cascade` 라 처분 때 그 사람의 행이 지워진다(ADR 0094) —
  비율은 남은 사용자의 것이다. 사용자별 화면은 만들지 않는다

```sql
with runs as (
  select r.user_id, r.status, r.created_at
  from public.reading_run r
  where not exists (select 1 from public.verification_account v where v.user_id = r.user_id)
),
firsts as (
  select user_id, min(created_at) as first_success
  from runs where status = 'succeeded' group by user_id
),
again as (
  select f.first_success,
         exists (select 1 from runs r
                 where r.user_id = f.user_id and r.status = 'succeeded'
                   and r.created_at > f.first_success
                   and r.created_at <= f.first_success + interval '30 days') as reused
  from firsts f
)
select
  (select count(*) from runs) as 요청,
  (select count(*) from runs where status = 'succeeded') as 성공,
  (select count(*) from runs where status = 'failed') as 실패,
  round(100.0 * (select count(*) from runs where status = 'succeeded')
        / nullif((select count(*) from runs where status <> 'running'), 0), 1) as 성공률,
  (select count(*) from again where first_success <= now() - interval '30 days') as 창_닫힌_사람,
  (select count(*) from again where first_success <= now() - interval '30 days' and reused) as 그중_다시_성공,
  round(100.0 * (select count(*) from again where first_success <= now() - interval '30 days' and reused)
        / nullif((select count(*) from again where first_success <= now() - interval '30 days'), 0), 1) as 재사용률,
  (select count(*) from again where first_success > now() - interval '30 days') as 창_열린_사람,
  (select count(*) from again where first_success > now() - interval '30 days' and reused) as 그중_이미_다시_성공;
```

2026-09-23 에 운영에서 한 번 돌린 값: 요청 29 · 성공 28 · 실패 1 · 성공률 96.6% · 창이 닫힌 사람 0(재사용률은 아직 없다) ·
창이 열린 사람 12 중 이미 다시 성공한 사람 10. 검증 계정 1개를 뺀 수다.

---

## 보안 점검 — advisor 와 접속기록 (G-23 ⑩ ⑪)

### 보안 advisor — **부르는 명령 하나** (G-23 ⑪)

Supabase 가 스키마와 인증 설정을 훑어 내는 경고다(splinter). 다시 잴 때는 이 한 줄이다 — 원격에 닿으므로
잠금을 지난다(ADR 0096).

```bash
node scripts/remote-lock.mjs npx supabase db advisors --linked --type security --level info --output-format json \
  | jq -r '.results | group_by(.name) | .[] | "\(.[0].level) \(.[0].name) \(length)"'
```

같은 것을 Management API 로도 받는다 — `GET /v1/projects/xgdeguyxgkillndraonc/advisors/security`(열쇠는 CLI 가
macOS 키체인에 둔 것, 문서에 적지 않는다). **로컬 스택의 `--local` 은 0028 · 0029 와 인증 경고를 안 낸다** —
판본이 다르다. 운영에 대고 잰다.

**2026-09-24 에 잰 값(운영).** 합계 WARN 87 → 71, INFO 26 → 26. 고친 뒤 값은 `20261009120000` 을 올린 다음 다시 불러 쟀고, 발행 키로 `rpc/beta_is_over` 를 부르면 `42501` 이다.

| lint | 고치기 전 | 고친 뒤 | 무엇을 했나 |
| --- | --- | --- | --- |
| WARN `function_search_path_mutable`(0011) | 15 | 0 | 상수 함수 열다섯에 `search_path = ''` — `20261009120000` |
| WARN `anon_security_definer_function_executable`(0028) | 3 | 2 | `beta_is_over()` 를 닫았다 — 화면이 안 부르고 definer 안에서만 불린다 |
| WARN `authenticated_security_definer_function_executable`(0029) | 68 | 68 → 69(ADR 0105 의 `note_operator_denial`, 2026-09-24 운영에서 잼) | `claimed_by` · `may_edit_person_input`(남의 claim · 편집권을 묻는 신탁) · `beta_is_over` 를 닫아 65 가 됐고, 같은 날 G-24 가 `/ops/reports` 의 운영자 문 셋(`operator_reports` · `operator_report` · `operator_report_snapshot`, `is_operator()` 검사)을 더했다 |
| WARN `auth_leaked_password_protection` | 1 | 1 | **남긴다 — Pro 플랜부터다**(아래) |
| INFO `rls_enabled_no_policy` | 26 | 26 → 29(ADR 0105 의 `audit.operator_access` · `audit.operator_access_export` · `signup_pause`, 운영에서 잼) | **남긴다 — 의도다**(아래) |

잠금은 pgTAP `44_advisor_lints`(invoker 까지 search_path · 닫은 셋) 와 `33_function_shape`(anon 에 열린 문은
둘 — `current_beta_schedule()` · `shared_reading(text)`).

**남긴 것과 까닭.**

- **0028 둘 · 0029 예순여덟은 앱이 부르라고 연 문이다.** 이 저장소의 쓰기와 읽기는 `security definer` RPC 가
  들고(`docs/notes/rpc-and-exposure-rules.md`), 각 문은 `auth.uid()` 나 그것을 묻는 범위 함수(`reading_scope` · `is_operator` ·
  `visible_notifications` · `may_see_photo`)로 좁힌다 — 2026-09-24 에 `auth.uid()` 를 직접 안 묻는 열여섯의
  몸을 열어 범위 함수 · 운영자 검사 · 상수 · 공유 토큰임을 봤다.
  advisor 문서도 「일부러 연 문이면 그 대상에 대해 무시해도 된다」고 적는다(lint 0029 의 세 번째 길). 대상별로
  끄는 장치는 없고, 규칙째 끄면 **의도하지 않은 새 문도 함께 숨는다** — 끄지 않는다. 이 중 다섯은 정책 · invoker
  함수 · 흐름 검사가 사용자 역할로 불러 닫을 수 없다: `is_active_account` · `chat_room_readable`(RLS 정책) ·
  `set_person_listed`(invoker `create_pair_for_reading`) · `chat_policy` · `presence_policy`(흐름 검사가
  사용자 열쇠로 수를 대조한다). **글자 그대로 0 으로 만드는 길**은 definer 몸을 노출 안 된 스키마로 옮기고
  `public` 에 invoker 껍데기를 두는 것인데, 열리는 문이 같아 막는 것이 없다 — 하지 않았다.
- **유출 비밀번호 검사(HaveIBeenPwned)는 Pro 플랜부터다**(<https://supabase.com/docs/guides/auth/password-security>,
  2026-09-24). 조직 플랜은 `free`(Management API `GET /v1/organizations/{id}` 의 `plan`). 앱의 로그인은 구글
  하나지만 이메일 공급자가 켜져 있다(`external_email_enabled: true`, 확인 메일 필요) — e2e 와 운영 확인 계정이
  비밀번호로 들어오는 길이다. 끌지는 G-23 줄에 남겼다.
- **정책 없는 RLS 표 스물여섯은 의도다** — 앱은 표를 직접 읽지 않고 definer 문으로만 닿는다. 정책이 없으면
  anon · authenticated 는 한 줄도 못 본다. 등급이 INFO 라 경고가 아니다.

**인증 설정 — 바꾼 것 없음(2026-09-24).** 운영 값: OTP 만료 3600초(`mailer_otp_exp`, advisor 의 한도 안),
TOTP MFA 켜짐, 전화 공급자 꺼짐, 익명 로그인 꺼짐, refresh 회전 켜짐. `supabase/config.toml` 은 advisor 가
보는 값과 어긋남이 없다.

### 성능 advisor — 외래키 인덱스와 안 쓰인 인덱스 (G-23 ⑪ 곁)

같은 명령에서 `--type performance` 로 바꿔 부른다.

```bash
node scripts/remote-lock.mjs npx supabase db advisors --linked --type performance --level info --output-format json \
  | jq -r '.results | group_by(.name) | .[] | "\(.[0].level) \(.[0].name) \(length)"'
```

**2026-09-24 에 잰 값(운영).** 전 값은 G-23 ⑪ 때 적은 23 · 7 에서 `20261010100000`(접속기록) · `20261011090000`(결제 표)이
하나 · 다섯을 더한 것이다. 후 값은 `20261012090000` 을 올린 다음 다시 불렀다.

| lint | 고치기 전 | 고친 뒤 | 무엇을 했나 |
| --- | --- | --- | --- |
| INFO `unindexed_foreign_keys` | 24 | 1 | 외래키 스물셋에 인덱스 — `20261012090000` |
| INFO `unused_index` | 12 | 35 | 하나도 안 지웠다. 새로 세운 스물셋이 아직 안 쓰여 더해졌다 — 탈퇴 처분 · 사람 지우기가 한 번 돌면 준다 |

**더한 스물셋 — 탈퇴 처분의 사슬.** `forget_user` 가 `auth.users` 를 지우면 `app_user` 를 거쳐 매칭 · 신청 · 노출 ·
채팅 · 주문이 cascade/`set null` 로 따라 지워지고, 같은 함수가 지우는 `person` 은 접근 · 풀이 · 시도 · 관계를,
`match_without_its_pair_is_cleared` 가 지우는 `match` · `reading_run` 은 알림 · 시도를 끌고 간다. 외래키에 인덱스가
없으면 부모 한 줄마다 자식 표를 통째로 훑는다. 스물셋 대부분은 그 칼럼으로 거르는 문도 있다(`forget_orphan_people` 의
`person_id`, `visible_matches` 의 `user_high`, `reading_scope_for` 의 `blocked_user_id`, `keep_payments_of_leaver` 의
`order_id`). 기존 복합 인덱스의 앞 칼럼으로 덮인 것은 없었다 — advisor 가 잘못 본 것은 없다. 로컬에서 `user_person_access`
에 2만 줄을 넣고 `delete … where person_id = …` 가 `user_person_access_by_person` 으로 도는 것, `match` 의
`user_low = … or user_high = …` 가 두 인덱스의 `BitmapOr` 로 도는 것을 `EXPLAIN` 으로 봤다.

**건너뛴 하나 — `app_user.notice_schedule_id`.** 부모 `beta_schedule` 은 운영자가 손으로 넣는 표(운영 2줄)이고 지우는
코드가 없다. 지울 때 `app_user` 를 한 번 훑는 값이 쓰기마다 인덱스를 고치는 값보다 싸다.

**`concurrently` 를 안 쓴 까닭.** `db push` 는 마이그레이션을 트랜잭션 안에서 돌리고 `create index concurrently` 는
트랜잭션 안에서 못 돈다. 대상 표는 운영에서 가장 큰 것이 수백 줄 · 2MB 아래라 SHARE 잠금이 밀리초로 끝났다. 표가 커진
뒤 같은 일을 하면 `concurrently` 로 먼저 세우고 마이그레이션에는 `if not exists` 로 적는다.

잠금은 pgTAP `49_foreign_key_indexes` — advisor 와 같은 셈(외래키 칼럼이 어느 인덱스의 앞 칼럼들과 같은 집합)으로
덮이지 않은 외래키를 이름으로 내고, 목록이 건너뛴 하나와 같은지 잰다. 새 외래키를 인덱스 없이 들이면 붉다.

**안 쓰인 인덱스 열둘 — 지우지 않았다.** 통계가 한 달치(2026-08-25 초기화)이고 결제는 아직 운영에 안 들었다. 다른
인덱스 · 제약과 완전히 겹치는 것(같은 앞 칼럼들)은 없었다. 무엇을 위해 있나:

| 인덱스 | 받치는 질의 |
| --- | --- |
| `report_by_reporter` | 신고 하루 한도 — 신고한 사람의 오늘 건수(`report_user` · `report_chat_message`) |
| `report_by_pair` | 처리 필요인 같은 대상 · 같은 사유의 중복 신고(같은 두 문, `report_is_open`) — `20261017090000` 이 `reviewed_at is null` 부분 인덱스 `report_unreviewed_by_pair` 를 술어 없는 것으로 바꿨다(ADR 0107 정정) |
| `report_unreviewed` | 안 본 신고(`reviewed_at is null`) — 운영자 목록의 처리 필요는 추가 확인 필요까지라(ADR 0107) 이것만으로 다 짚지는 않는다(`operator_reports`) |
| `chat_report_snapshot_by_message` | 같은 메시지의 중복 신고 |
| `chat_room_closed` | 닫힌 지 90일 지난 방의 메시지 지우기(`purge_closed_chat_messages`) |
| `chat_rate_limit_hit_by_time` | 「한도에 걸린 건수를 본다」의 기간 집계 |
| `reading_job_open_idx` | 복구기가 못 끝낸 일감을 오래된 차례로 집기(`open_reading_jobs`) |
| `operator_access_by_actor` | 운영자 거절 기록의 시간당 빗장(`note_operator_denial`) |
| `operator_access_by_time` | 접속기록의 시각 범위 조회 · 1년 보존 뒤 정리. 반출은 번호로 돈다 |
| `reading_order_by_user` | 한 사람의 주문 차례(판매 스위치가 꺼져 아직 부르는 문이 없다). `user_id` 만의 찾기는 유일 제약 `(user_id, idempotency_key)` 가 받는다 — 판매가 켜진 뒤에도 `created_at` 차례로 읽는 문이 없으면 그때 지운다 |
| `reading_credit_use_by_bundle` | 묶음별 쓰임(환불 셈 `operator_reading_refund_basis`) · 묶음 지울 때 |
| `retention_payment_expiry` | 5년 지난 결제 기록 지우기(`retention.purge_expired_payments`) |

### 운영자 접속기록 — **어디에 며칠 남나** (G-23 ⑩ · G-25 ③ · ADR 0105)

G-25 ③ 이 운영자의 개인정보처리시스템 접속기록을 **1년 이상** 두기로 했다(「개인정보의 안전성 확보조치 기준」 제8조 —
원칙 1년, 정보주체 5만 명 이상 · 고유식별정보 · 민감정보 처리 등은 2년. CI 가 고유식별정보인지와 2년 여부는 G-25 변호사
확인 목록이다). 2026-09-24 에 자리마다 잰 값이다. 플랜은 CLI · API 로 읽었다 — Supabase 조직 `free`, Vercel 팀
`sungheeyoons-projects` `hobby`, GitHub 개인 계정(`User`, 저장소 공개).

| 자리 | 기록 종류 — 누가 · 언제 · 무엇 | 보존 | 근거 · 확인 날짜 |
| --- | --- | --- | --- |
| 앱의 운영자 화면 `/ops/reports` | **DB 의 `audit.operator_access`** — 운영자 id · 시각 · 동작(목록 · 상세 · 스냅샷) · 대상 신고 id(목록이면 거른 조건) · 성공/거절. 문이 읽을 때 같은 트랜잭션에서 적고, 거절은 앱의 문이 따로 적는다 | DB 에 쌓이고 **매일 S3 로 반출, Object Lock 400일** — 아래 「반출」. AWS 가 켜지기 전에는 DB 에만 있다 | ADR 0105 · pgTAP `46_operator_access_log` |
| `npm run db:remote` | **같은 표** — 실행자(git 이름, 에이전트면 `(agent)`) · 시각 · **목적 · SQL 의 sha256**. 원문은 안 적는다. 끝난 뒤 **결과 줄 하나**(`cli.result` — 앞 줄의 번호 · 성공/실패 · 오류 분류 `sql` · `connection` · `unknown`, `20261014090000`)가 더해진다 | 위와 같다 | `scripts/db-remote.mjs` · `db-remote.test.ts` |
| `/ops/survey` | 안 적는다 — 집계뿐이고 누가 썼는지와 본문이 안 실린다(ADR 0061) | — | |
| Supabase SQL Editor · Table Editor · `db query --linked` 를 직접 부르는 것 | Postgres 로그. **`log_statement = ddl` 이라 읽기(select)는 안 남는다**, `pgaudit` 은 설치 안 됨 | **읽기 0일** · DDL 1일 | 운영에서 `current_setting('log_statement')` · `pg_extension`(2026-09-24) · 로그 보존 Free 1일 <https://supabase.com/pricing>. **그래서 여기서 개인정보를 읽지 않는다**(맨 위 「개인정보는 화면으로만」) |
| Supabase 조직 · 프로젝트 설정(Management API 행위 포함) | Platform Audit Logs | **없음** — Team · Enterprise 만 | <https://supabase.com/docs/guides/security/platform-audit-logs>(2026-09-24) |
| Supabase 계정 | Account Audit Logs(<https://supabase.com/dashboard/account/audit>) — 제 계정의 행위 | **모름** — 문서에 일수가 없고 API(PAT)로는 못 읽는다(`401`) | 같은 문서(2026-09-24). 사람이 화면에서 가장 오래된 줄을 본다 |
| Vercel 팀 | Activity Log — 환경변수 복호화(`env-variable-read`, 사용자 이름) · 배포 · 설정 변경. **로그인은 안 남는다**(SSO 만) | **1년 넘음** — 2025-08-09 줄이 보인다(13달+) | <https://vercel.com/docs/activity-log> 「since its creation」 · `vercel activity -a --until 2026-01-01`(2026-09-24). Audit Log 는 Enterprise |
| GitHub 개인 계정 | Security log — 로그인 · 토큰 · 설정 | **90일** — JSON · CSV 로 내보내기는 화면에서만 | <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/reviewing-your-security-log>(2026-09-24). **개인정보처리시스템이 아니다** — 저장소에 이용자 자료가 없고 Actions 비밀값도 0(`gh secret list`) |
| AWS(반출 버킷) | CloudTrail 관리 이벤트(버킷 · IAM 변경) — 기본 90일. 객체 읽기(데이터 이벤트)는 켜야 남는다 | 90일 | 계정을 연 뒤 잰다 |
| PortOne 관리자 콘솔 | — | **계약 전이라 못 잼** | G-21 에서 가맹할 때 콘솔 접속기록 보존 기간을 묻는다 |

**기록이 추가만 되는 것** — 모든 역할(소유자 `postgres` 포함)에서 `update` · `delete` · `truncate` 를 걷었고 트리거가 한
번 더 막는다. 소유자는 트리거를 끌 수 있다 — DB 안에서는 그 이상 못 지키고, 그래서 **밖의 사본(Object Lock)이 지워지지
않는 기록**이다. 월 점검의 「반출이 이어지는가」가 끊긴 자리를 드러낸다.

#### 반출 — 매일 S3, 한 번에 하나, 결과는 DB 에

Vercel Cron `/api/cron/audit-export`(`vercel.json`, 매일 18:37 UTC = 서울 03:37 전후 — Hobby 는 ±59분)가 지난 반출 뒤의
줄을 번호 차례로 읽어 한 파일로 올리고, **올린 뒤에** 범위를 `audit.operator_access_export` 에 적는다. 적는 문은 앞 반출에서
이어지지 않거나 범위 안의 행 수가 틀리면 거절한다 — 빠짐도 겹침도 없다. **같은 범위를 그대로 두 번 적으면 조용히 받는다** —
적고 응답을 잃은 실행의 자리(`20261014090000`). 방금 적힌 줄도 나간다 — 반출은 쓰기와 같은 advisory 자물쇠를 배타로 쥔 뒤에
읽으므로(쓰기는 번호를 받기 전에 공유로 쥔다) 늦게 커밋된 낮은 번호를 건너뛰지 않는다(`20261013090000`).

- **한 번에 하나** — 실행은 시작할 때 `audit.operator_access_export_attempt` 에 한 줄을 적고 5분 임대를 건다. 임대가 살아 있는
  실행이 있으면 뒤 실행은 **「도는 중」(`busy`)으로 적히고 아무것도 안 올린 채 200 `{"busy":true}`** 로 끝난다. 죽은 실행의
  임대는 5분 뒤 풀린다
- **결과는 DB 에** — 실행마다 `audit.operator_access_export_result` 에 한 줄: `succeeded` · `failed` · `not_configured` ·
  `misconfigured` · `busy`, 끝난 시각, 행 수 · 객체 수 · 번호 범위, 실패면 **분류**(`upload:accessdenied` ·
  `batch:57014` · `missing:region` 처럼 걸음과 이름뿐 — 오류 문장은 열쇠 · 버킷 · ARN 이 섞일 수 있어 안 적는다). 추가만 된다
- **알림** — 실패 · 설정 오류로 끝나면 그 자리에서 `audit-export-failed`(연속 실패 수 · 분류). 매일 06:29 UTC 의 감시
  `audit-export-watch` 가 **이틀 넘게 시도가 없으면** `audit-export-silent`(Vercel Cron 이 멈췄다), **설정이 켜졌는데 이틀 넘게
  성공이 없으면** `audit-export-no-success`. 길은 `notify_ops`(Vault `ops_alert_url`, 하루 한 종류 한 번)다. 설정이 없는
  동안과 시도가 한 번도 없는 동안은 조용하다
- **상태를 본다** — 개인을 가리키는 값이 없는 보통 질의다:

  ```bash
  npm run db:remote -- --purpose "접속기록 반출 상태" "select * from audit.export_status()"
  ```

  마지막 시도 · 결과 · 분류, **마지막 성공 시각 · 연속 실패 수 · 밀린 행 수**, 7일의 시도와 실패. 운영자 화면이 서면
  `public.operator_audit_export_status()`(운영자만, 읽으면 접속기록에 남는다)를 부른다
- **파일** — `operator-access/<첫 줄의 서울 날짜 YYYY/MM/DD>/<첫 번호 12자리>-<마지막 번호 12자리>.jsonl`. 첫 줄이 머리
  (`version` 2 · `rows` · `first_id` · `last_id` · `after_id` · 본문 `sha256` · `exported_at`), 그 뒤가 한 줄에 한 행이다.
  해시는 머리를 뗀 나머지의 sha256 이다. 올릴 때 본문 전체의 `ChecksumSHA256` 을 싣는다(Object Lock 버킷이 요구한다).
  `version` 1 은 CLI 결과 칸(`result_of` · `result` · `error_class`)이 서기 전의 파일이다
- **담기는 것** — 운영자 id · 시각 · 채널 · 동작 · 대상 신고 id · 거른 조건 · CLI 의 목적 · 해시 · 실행자 이름 · 성공/거절 ·
  CLI 결과. **이용자 닉네임 · 메시지 본문 · 이메일은 없다** — Compliance 는 되돌릴 수 없다. 저장소에도 로그 원문을 넣지 않는다.
  **반출 파일의 운영자 UUID · 신고 id 도 개인정보에 준해 다룬다** — 다른 표와 이으면 사람을 가리킨다. 그래서 파일을 저장소 ·
  이슈 · 채팅에 붙이지 않고, 버킷의 읽기는 검증 역할 하나에만 연다(아래 9)
- **켜는 값 — 셋으로 갈린다**(Vercel Production)

  | 상태 | 값 | 크론 | DB 의 결과 |
  | --- | --- | --- | --- |
  | **꺼짐** | 다섯이 **모두** 비었다 | 200 `{"configured":false}` | `not_configured`, 알림 없음 |
  | **켜짐 — 역할(기본안)** | `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` · `AUDIT_EXPORT_ROLE_ARN` | 올린다 | `succeeded` / `failed` |
  | **켜짐 — 접근 키(대안)** | `AUDIT_EXPORT_BUCKET` · `AUDIT_EXPORT_REGION` · `AUDIT_EXPORT_ACCESS_KEY_ID` · `AUDIT_EXPORT_SECRET_ACCESS_KEY` | 올린다 | 같다 |
  | **오설정** | 그 밖 전부 — 하나라도 넣었는데 모자라거나, 역할과 접근 키를 함께 넣었다 | 500 | `misconfigured` + 분류(`missing:region` · `conflict:credentials`), 알림 |

  **2026-09-24 에는 AWS 계정이 없어 꺼져 있다**
- **실패** — 500 이고, Vercel 로그(1시간)만이 아니라 위 결과 표 · 알림 · 상태 질의에 선다. 기록은 DB 에 남아 다음 실행이
  이어 올린다

**사람이 켜는 걸음 — AWS (한 번)**

1. **계정을 연다.** 루트 사용자에 MFA 를 건다(G-23 ⑨ 목록에 AWS 가 있다). 루트로는 아래 2 ~ 4 만 하고 그 뒤로 안 쓴다
2. **버킷을 만든다 — 서울 `ap-northeast-2`**, 이름 예 `saju-audit-<무작위 몇 자>`. 만들 때 **Object Lock 을 켠다**(켜면
   Versioning 이 함께 켜지고 끌 수 없다). Block Public Access 넷 다 켠다. 암호화는 기본(SSE-S3)
3. **Governance 로 잰다.** 버킷 → Properties → Object Lock → Default retention: **Governance, 1일.** 반출을 켜고(아래 5 ·
   6) 하루 돌려 객체가 서는지, 아래 9 의 검증이 초록인지, 지우기가 막히는지(`DeleteObject` 에 버전 id → AccessDenied)를
   본다. Governance 는 `s3:BypassGovernanceRetention` 권한으로 풀 수 있다 — 잘못 올린 시험 객체는 이때 지운다
4. **Compliance 400일로 옮긴다 — 3 의 검증이 끝난 뒤에만.** Default retention: **Compliance, 400 days.** 이 뒤에 올라온
   객체는 루트도 못 지우고 400일 전에는 못 줄인다. **Governance 동안 올라간 객체는 Governance 그대로다** — 필요하면 객체마다
   보존을 Compliance 로 올린다(늘리기만 된다). G-25 가 2년이라 하면 만료 전에 이미 있는 객체의 보존일을 늘리고
   (`PutObjectRetention`) 기본값을 730일로 바꾼다
5. **반출 역할을 만든다 — 기본안: Vercel OIDC → IAM 역할(단기 자격).** 오래 사는 키가 어디에도 없다.
   1. Vercel 프로젝트 Settings → Security → **OIDC Federation** 을 켠다(Team 발급자 `https://oidc.vercel.com/<팀 슬러그>`)
   2. AWS IAM → Identity providers → OpenID Connect 로 그 발급자를 더한다. Audience 는 `https://vercel.com/<팀 슬러그>`
   3. IAM → Roles → `saju-audit-export` 를 만든다. **신뢰 정책**은 그 발급자의 이 프로젝트 · Production 만 믿는다:

      ```json
      {
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": { "Federated": "arn:aws:iam::<계정>:oidc-provider/oidc.vercel.com/<팀 슬러그>" },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "oidc.vercel.com/<팀 슬러그>:aud": "https://vercel.com/<팀 슬러그>",
              "oidc.vercel.com/<팀 슬러그>:sub": "owner:<팀 슬러그>:project:<프로젝트 이름>:environment:production"
            }
          }
        }]
      }
      ```

   4. **권한 정책은 그 버킷의 그 prefix 에 넣기 하나다:**

      ```json
      {
        "Version": "2012-10-17",
        "Statement": [
          { "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::<버킷>/operator-access/*" }
        ]
      }
      ```

      읽기 · 지우기 · 보존 변경 권한이 없다 — 자격이 새도 올린 객체를 못 지우고 못 읽는다
   5. 발급자 · audience · `sub` 의 정확한 모양은 켜는 날 Vercel 문서(<https://vercel.com/docs/oidc/aws>)로 다시 본다 —
      2026-09-24 에는 계정이 없어 못 쟀다. 코드는 `@vercel/oidc` 의 토큰을 `AssumeRoleWithWebIdentity`(세션 이름
      `saju-audit-export`)로 바꾼다(`app/api/cron/audit-export/s3.ts`)

   **대안 — 접근 키.** 역할을 못 세운 날만. IAM → Users → `saju-audit-export`(콘솔 접근 없음)에 위 4 의 정책을 인라인으로
   걸고 Access key 를 하나 만든다. 90일마다 바꾼다(「비밀이 새면」 표의 `AUDIT_EXPORT_*` 줄)
6. **Vercel 에 넣는다** — Settings → Environment Variables → **Production**: 기본안은 `AUDIT_EXPORT_BUCKET` ·
   `AUDIT_EXPORT_REGION`(`ap-northeast-2`) · `AUDIT_EXPORT_ROLE_ARN` 셋, 대안은 역할 대신 접근 키 둘(Sensitive). **둘을 함께
   넣으면 오설정이다.** Deployments 의 최신 Production 을 Redeploy 하고 Ready 를 본다. 넣는 값은 문서 · 채팅 · 커밋에 적지 않는다
7. **확인한다** — 다음 날 위 상태 질의의 `last_outcome` 이 `succeeded` 이고 `pending_rows` 가 작으며, S3 콘솔에 같은 키의
   객체가 있고 Object Lock 이 걸려 있다
8. **교체** — 역할은 교체할 열쇠가 없다. 접근 키면 「비밀이 새면」 표의 `AUDIT_EXPORT_*` 줄
9. **검증 역할과 검증** — 반출의 쓰기 역할과 **따로** 읽기 역할 `saju-audit-verify` 를 둔다: `s3:GetObject` ·
   `s3:ListBucket` 을 그 버킷의 `operator-access/*` 에만, 사람의 AWS 프로필(SSO 나 MFA 가 걸린 사용자)에서만 받는다. Vercel 에는
   넣지 않는다. 그리고 **월 점검마다 한 번**(그리고 3 의 Governance 확인 때):

   ```bash
   AWS_PROFILE=saju-audit-verify AUDIT_VERIFY_BUCKET=<버킷> AUDIT_VERIFY_REGION=ap-northeast-2 npm run audit:verify
   ```

   `scripts/audit-verify.mjs` 가 `npm run db:remote` 로 반출 기록(범위 · 행 수 · sha256 · 객체 키)을 읽고, 객체마다 내려받아
   머리와 기록 · 본문 해시 · 줄 수 · 번호 차례 · 범위 이음을 견준다. 어긋나면 키와 어긋남의 이름만 찍고 1 로 끝난다(본문은 안
   찍는다). `-- --since <첫 번호>` 로 그 뒤만 본다

**사람이 할 걸음(그 밖).**

1. Supabase <https://supabase.com/dashboard/account/audit> 에서 가장 오래된 줄의 날짜를 보고 위 표의 「모름」을
   값으로 바꾼다
2. GitHub 보안 로그는 90일이라 **분기마다 한 번** <https://github.com/settings/security-log> → Export → JSON 을
   저장소 밖(개인 보관소)에 쌓는다 — 개인정보처리시스템은 아니지만 비밀값이 생기는 날 필요해진다
3. PortOne 가맹 때 콘솔 접속기록 보존 기간을 묻는다(G-21)

## 운영 주기 — 신고 · 접속기록 · 부재 (ADR 0105)

**내부 운영 목표다 — 이용자에게 약속한 것이 아니다.** 화면과 처리방침은 이 주기를 말하지 않는다.

| 무엇 | 언제 | 어떻게 |
| --- | --- | --- |
| 신고 | **영업일마다** 처리 필요(안 봤거나 추가 확인 필요) 목록을 본다. **접수 뒤** 늦어도 3영업일 안에 1차 판단 — 추가 확인 필요로 보류해도 시계는 접수부터다(ADR 0107) | `/ops/reports?review=open` → 판단 → 「신고와 차단」의 검토 문. 3영업일 넘긴 것은 같은 절의 둘째 질의 |
| 접속기록 | **매월 1회 이상** | 아래 「월 점검」 |
| 자리를 비울 때 | **3영업일을 넘기면 새 가입을 닫는다** — 신고를 볼 사람이 없는 동안 새 사람을 들이지 않는다 | 아래 「가입을 닫고 연다」 |

### 월 점검 — 개인정보 없이

넷을 본다 — 이상 접근 · 대량 열람 · 업무시간 밖 열람 · 연속 거절. 그리고 **반출이 이어지는가** — 「반출」의 상태 질의
(`audit.export_status()` — 마지막 성공 · 연속 실패 · 밀린 행 수)와, AWS 가 켜진 뒤에는 검증(`npm run audit:verify`).
CLI 질의 가운데 결과 줄(`cli.result`)이 없는 `cli.query` 는 중간에 끊긴 실행이다. 질의는 전부 **보통 질의**다(id · 수 · 시각뿐, 이메일과
본문이 없다). `npm run db:remote -- --purpose "접속기록 월 점검 <YYYY-MM>" "<sql>"` 로 부른다. 결과는 저장소 밖 점검 기록에
날짜 · 본 사람 · 이상 여부 · 조치를 한 줄씩 적는다.

```sql
-- 1. 누가 얼마나 — 운영자 id(또는 CLI 실행자)별 지난달 동작 수와 성공/거절
select coalesce(actor_user_id::text, actor_name) as 누구, channel, action, outcome, count(*)
from audit.operator_access
where at >= date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month'
  and at <  date_trunc('month', now() at time zone 'Asia/Seoul')
group by 1, 2, 3, 4 order by 5 desc;

-- 2. 대량 열람 — 한 사람이 한 시간에 상세 · 스냅샷을 서른 건 넘게 연 때
select coalesce(actor_user_id::text, actor_name) as 누구, date_trunc('hour', at) as 시각,
       count(distinct target_report_id) as 연_신고
from audit.operator_access
where action in ('reports.detail', 'reports.snapshot') and at > now() - interval '31 days'
group by 1, 2 having count(distinct target_report_id) > 30 order by 3 desc;

-- 3. 업무시간 밖 — 서울 22시 ~ 07시 · 주말의 열람
select coalesce(actor_user_id::text, actor_name) as 누구, at at time zone 'Asia/Seoul' as 서울, action, target_report_id
from audit.operator_access
where at > now() - interval '31 days'
  and (extract(hour from at at time zone 'Asia/Seoul') not between 7 and 21
       or extract(isodow from at at time zone 'Asia/Seoul') > 5)
order by at;

-- 4. 연속 거절 — 운영자가 아닌 계정이 운영자 문을 두드린 흔적
select actor_user_id, count(*) as 거절, min(at) as 처음, max(at) as 마지막
from audit.operator_access
where outcome = 'denied' and at > now() - interval '31 days'
group by 1 order by 2 desc;

-- 5. 반출이 이어지는가 — 마지막 반출 시각, 범위의 틈, 아직 안 나간 줄
select max(exported_at) as 마지막_반출,
       (select count(*) from audit.operator_access a
        where a.id > coalesce((select max(last_id) from audit.operator_access_export), 0)) as 안_나간_줄
from audit.operator_access_export;
select e.first_id, lag(e.last_id) over (order by e.first_id) as 앞_끝
from audit.operator_access_export e order by e.first_id;   -- 앞_끝보다 한참 큰 first_id 는 되감긴 번호다 — 행 수는 반출 때 견줬다

-- 6. 신고가 밀렸나 — 처리 필요와 그중 접수 뒤 3영업일을 넘긴 수(ADR 0107). 0 이 아니면 「신고와 차단」의 둘째 질의로 본다
select count(*) as 처리_필요,
       count(*) filter (where (select count(*) from generate_series(created_at::date + 1, current_date, interval '1 day') d
                               where extract(isodow from d) < 6) > 3) as 삼영업일_넘김
from public.report where public.report_is_open(reviewed_at, review_outcome);
```

**이상이면** — 운영자 본인이 한 것이 아니면 곧 「비밀이 새면」으로 간다(Supabase · 구글 계정 세션 끊기, 운영자 표에서 그
계정 내리기). 4 에 같은 계정이 여럿이면 그 UUID 로 신고 · 이용 정지를 본다. 5 의 마지막 반출이 이틀보다 오래면 Vercel 의
Cron 실행 기록과 환경변수를 본다. 처리 결과를 점검 기록에 적는다.

### 가입을 닫고 연다

운영자가 **3영업일을 넘게** 자리를 비우면 떠나기 전에 닫는다. 닫힌 동안 새 사람은 코드가 살아 있어도 가입이 안 끝나고
「지금 쓸 수 있는 코드가 아닙니다.」를 본다(기존 문장). 이미 가입한 사람은 그대로 쓴다 — 바뀐 안내의 재확인도 된다.

```bash
# 닫는다 — 까닭에 이용자 개인정보를 적지 않는다
npm run db:remote -- --purpose "가입 닫기 — 운영자 부재" \
  "insert into public.signup_pause (reason) values ('운영자 부재 <시작일>~<돌아올 날>')"

# 지금 닫혀 있나
npm run db:remote -- --purpose "가입 닫힘 확인" \
  "select id, paused_at, reason, resumed_at from public.signup_pause order by id desc limit 3"

# 연다 — 돌아와서 밀린 신고를 본 뒤에
npm run db:remote -- --purpose "가입 열기 — 운영자 복귀" \
  "update public.signup_pause set resumed_at = now() where resumed_at is null"
```

열린 줄은 하나뿐이다 — 이미 닫혀 있는데 또 닫으면 `23505` 다. 줄은 지우지 않고 쌓는다(언제 · 왜 닫았는지가 남는다).

## 배포

**`main` 에 머지해도 배포되지 않는다**(ADR 0110). `vercel.json` 의 `git.deploymentEnabled: false` 가 가지 · `main` 의 푸시로
생기는 배포를 전부 끈다 — Preview 도 Production 도 없다. 운영(https://saju-snowy.vercel.app)에는 **기능 묶음이 끝났을 때
`main` 의 정확한 SHA 를 손으로 한 번** 올린다(아래 「묶음 배포」). 화면 확인은 로컬 e2e 와 스크린샷으로 하고, 밖에서 열어 볼
주소가 꼭 필요할 때만 Preview 를 손으로 하나 만든다(`vercel deploy`, `--prod` 없이).

**손으로 만든 배포도 앱이 바뀐 커밋만 빌드한다**(2026-09-24 운영자 결정 — Git 배포를 끈 뒤에도 남겨 둔다). `vercel.json` 의 `ignoreCommand` 가
`scripts/vercel-ignore.mjs` 를 부르고, 지난 성공 배포(`VERCEL_GIT_PREVIOUS_SHA`, 가지의 첫 배포면 `main` 과의 갈림점)
뒤에 바뀐 파일이 **전부** 문서(`docs/**` · `*.md`) · 마이그레이션 · pgTAP · `src`/`scripts` 의 단위 시험이면 건너뛴다.
Production 은 늘 빌드하고, 기준을 못 찾거나 git 이 실패하면 빌드한다. Vercel 은 **0 이면 건너뛰고 1 이면 빌드한다** —
`scripts/vercel-ignore.test.ts` 가 그 반대 의미를 든다. 건너뛴 배포는 `CANCELED` 로 서고 **하루 배포 수에는 여전히
센다**(Vercel 문서 「Ignored Build Step」의 note) — 아끼는 것은 빌드 시간과 동시 빌드 자리다. 건너뛴 가지를 굳이
빌드하려면 Deployments → Redeploy 에서 「Use project's Ignore Build Step」을 끈다.

마이그레이션은 따로 올린다.

```bash
npx supabase migration list   # remote 칸이 빈 줄이 밀린 것이다 — 먼저 본다
npm run db:push               # 밀린 것 전부를 원격에 적용한다 — 잠금 하나를 잡고 돈다(ADR 0096)
```

**`ignoreCommand` 는 빌드만 건너뛰고 배포 횟수는 줄이지 못한다.** Hobby 의 한도는 **24시간 이동 창에 100번**(그 밖에 한 시간
100 · 5분 60)이고 건너뛴 · 실패한 · 취소된 배포도 센다(Vercel 「Limits」). 2026-09-24 에는 Preview 편의를 우선해 Git 배포를
켜 두었는데(가지의 푸시 하나가 Preview 하나, 머지 하나가 Production 하나), 2026-09-25 에 하루 두 번 한도에 닿아 머지된 수정이
운영에 못 들었다. 그래서 끄고 **여러 PR 머지 → 운영 배포 한 번**으로 옮겼다(ADR 0110). 긴급 장애 수정만 곧바로 올린다.

#### 묶음 배포 — 최신 main 을 Production 으로 한 번

머지는 운영에 아무것도 안 올린다. 묶음이 끝났을 때(하루 한 번, 또는 한 라운드를 닫을 때) 한 번 올린다.

0. **올리기 전에.** 머지를 기다리는 PR 이 없는지(`gh pr list`), 최신 `main` 의 CI(`verify` · `main-red`)가 초록인지, 지난
   배포 뒤 `supabase/migrations/**` 가 바뀌었으면 **DB 를 먼저** 올리고 확인했는지(아래 규약 넷의 2 · 4) 본다. 올릴
   `main` 의 SHA 를 적는다. 한도 창의 남은 자리를 본다 — 모자라면 기다린다
1. **최신 main 을 Production 으로 올린다.** 깨끗한 `main` 체크아웃(또는 그 SHA 의 워크트리)에서 `vercel deploy --prod`, 아니면
   Vercel → Deployments → 「Create Deployment」에 `main` 을 넣는다. Production 은 `ignoreCommand` 가 건너뛰지 않는다. 빈 커밋을
   밀어 깨우지 않는다 — Git 배포는 꺼져 있어 아무 일도 안 일어난다
   **CLI 는 폴더를 통째로 올린다** — 쓰던 체크아웃에는 `.next` · `.next-check` 같은 빌드 캐시가 수백 MB 쌓여 `File size limit
   exceeded (100 MB)` 로 멈춘다(`.vercelignore` 가 없다, 2026-09-25). `git worktree add --detach <임시 폴더> <SHA>` 로 그 SHA 만
   꺼내고 `.vercel` 만 복사해 거기서 `vercel deploy --prod --yes` 를 부른다(12MB). 출력이 잘려 실패처럼 보여도 `vercel ls` 를 먼저
   본다 — 이미 올라갔을 수 있고, 다시 부르면 한도를 하나 더 쓴다
2. **배포 커밋 = main HEAD 인지 본다** — `git ls-remote origin main` 의 SHA 와 대시보드의 Source 커밋(또는
   `vercel inspect <배포 URL>`)이 같아야 한다. 다르면 옛 코드가 Production 이다 — 1 로 돌아간다
3. **Ready 를 본다** — `vercel ls saju` 에서 그 배포가 `● Ready` · `Production` 이고, `vercel inspect` 의 Aliases 에
   `https://saju-snowy.vercel.app` 이 선다
4. **smoke — 다섯 화면.** 홈(`/`) · 로그인(`/auth`) · 궁합(두 사람을 고르는 칸이 서는 화면) · 사람 목록(`/me/people`) ·
   운영자 신고 화면(`/ops/reports`). 로그인이 드는 셋은 운영자 계정으로 본다. 각각 제 제목이 서고 500 · 빈 화면 ·
   브라우저 콘솔의 CSP 위반이 없어야 통과다
5. **적는다** — 배포 SHA · Production URL · Ready 시각(서울) · smoke 다섯의 통과/실패를 그 일의 이슈에(G-24 검증이면
   `ops-verification` 이슈). 실패가 있으면 「CSP 가 화면을 막을 때」의 1 처럼 앞 배포를 Promote 해 되돌린다

한도에 걸려 올리지 못했으면 창이 비는 시각(가장 오래된 배포 + 24시간)을 적고 그 뒤에 0 부터 다시 밟는다.

### 규약 넷 — 앱과 DB 는 따로 간다 (ADR 0090)

세션 메모에만 있던 것을 2026-09-22 에 옮겼다. 에이전트가 이 절을 밟는 걸음은 공식 운영에 들어간 뒤에는
사람이 답한 뒤고, 운영 베타에서는 직접 밟고 본 값을 적는다(`docs/agents/delegation.md` 권한 등급 3,
ADR 0093).

1. **앱 배포 ≠ DB 마이그레이션.** main 머지는 아무것도 내보내지 않고, 묶음 배포는 앱만 내보낸다. 마이그레이션이 든 PR 이
   머지돼도 원격 DB 는 그대로다 — 2026-09-12 에 마이그레이션 넷이 안 오른 채 최신 앱이 돌아 후보 카드의
   점수는 SQL 이, 궁합풀이의 기준점은 TS 가 서로 다른 셈으로 냈다. 그리고 **마이그레이션을 쓴 그
   순간부터 이 기계의 dev 화면은 깨져 있다** — dev 서버가 `.env.development.local` 로 운영 DB 를
   보므로 새 함수를 부르는 화면이 `PGRST202` 로 죽는다. pgTAP 도 CI 도 못 잡는다(둘 다 로컬 DB 다).
2. **마이그레이션이 먼저, 앱이 나중.** 새 앱이 없는 함수를 부르는 창을 안 만든다. 그러려면
   마이그레이션이 **옛 앱에도 안전**해야 한다 — 새 열은 기본값을 들고, 새 인자는 `default` 를 든다.
   가입 훅처럼 **되돌릴 수 없는 걸음이 끼면 그 순서가 곧 안전이다**(아래 「가입 코드 배포」).
3. **넓히고, 재고, 좁힌다.** RPC 의 인자를 바꾸면 그것은 고친 함수가 아니라 새 함수다. 옛 서명을
   같은 마이그레이션에서 지우면 어느 순서로 배포해도 창이 생긴다 — 마이그레이션 먼저면 떠 있는
   앱이 없어진 함수를 부르고, 배포 먼저면 새 앱이 아직 없는 함수를 부른다. 이 저장소에서 그 창에
   든 호출은 **모델이 이미 돌아 토큰은 나가고 글은 안 남는다.** 새 서명을 세우고 옛 것을 남긴 채
   올리고(넓히기, ADR 0071 A 단계), 프로덕션에서 새 값이 실제로 실리는가 · 도는 시도가 0 인가 ·
   마지막 시도가 성공했는가를 본 뒤(재기), 옛 서명을 지운다(좁히기, #60). **두 벌인 동안은 시험이
   그 상태를 값으로 든다** — 열쇠에 열린 함수 목록에 같은 이름을 두 번 적어 두었다가 좁히는 날 한
   줄을 뺀다. 반환 열이 느는 쪽은 안전하다(옛 앱은 아는 필드만 집는다) — 위험한 것은 **인자**다.
4. **올린 뒤 무엇을 보나.** 등록은 `migration list` 의 remote 칸, 캐시는 발행 키로 RPC 를 불러
   `PGRST202`(못 찾음)인지 `42501`(권한 거절)인지 — 뒤엣것이면 PostgREST 가 함수를 찾은 것이다.
   잡을 건드렸으면 `cron.job_run_details`(「도는 잡이 정말 도나」). 앱은 Vercel 의 Ready.

**`db push` 뒤에 새 함수를 손으로 다시 적을 때는 프로덕션의 살아 있는 정의에서 뜬다** — 옮겨
적으면 그 사이에 바뀐 것을 되돌린다(ADR 0043 의 풀이권 함수가 그랬다).

### CSP 가 화면을 막을 때 — **보고만 하는 정책으로 되돌린다** (G-23 ②)

CSP 는 2026-09-23 부터 강제다(`next.config.ts` 의 `contentSecurityPolicy`). 강제에서 어긴 것은 곧 깨진
화면이다 — 스크립트 · 요청 · 이미지가 막히고, 브라우저 콘솔에 `Refused to …because it violates the
following Content Security Policy directive` 가 선다. 받는 서버(`report-uri`)는 두지 않았으므로 **운영에서
알 길은 사용자의 제보와 콘솔뿐이다.**

1. **먼저 되돌린다.** 이 커밋 앞의 배포를 Vercel 에서 **Promote** 하거나(가장 빠르다, 코드 안 바꿈), `next.config.ts`
   의 헤더 키 `Content-Security-Policy` 를 `Content-Security-Policy-Report-Only` 로 바꾸고 `frame-ancestors 'none'`
   한 줄짜리 강제 헤더를 다시 세워 main 에 민다 — `frame-ancestors` 는 보고만 하는 정책에서 무시된다.
2. **원인을 본다.** 콘솔 문장의 지시어(`connect-src` · `img-src` …)와 막힌 주소가 답이다. 새 외부 출처면
   그 지시어에 **그 출처 하나만** 더한다 — `*` 이나 `https:` 로 넓히지 않는다. 우리 코드가 인라인 `eval`
   이나 `data:` 스크립트를 새로 부른 것이면 코드를 고친다.
3. **다시 강제한다.** 고친 가지에서 e2e 전부를 돌린다 — 자동 손잡이(`e2e/csp.ts`)가 어긴 자리 0 을 든다.
   `curl -sI https://saju-snowy.vercel.app/ | grep -i content-security` 로 운영 헤더를 확인한다.

### 카드 점수 `v2-beta` 배포 — **마이그레이션 → 백필 → 앱** (ADR 0113 · 0114, 한 번만)

`20261025160000_the_card_score_reads_the_day_pillars_and_the_needs.sql` 부터 후보 카드의 점수는 **필요한 기운 요약**
(`discovery_profile.need_summary`)을 읽고, 요약이 없거나 지금 셈 이름(`discovery_need_rule()`)의 것이 아닌 참여자는
**풀에서 빠진다** — 가운데 값을 넣지 않는다. 그래서 앱보다 먼저 기존 참여자를 채운다.

1. **마이그레이션.** 위 「묶음 배포」의 0 처럼 `npx supabase migration list` → `npm run db:push`. 이 순간부터 앱이 새 것으로
   가기 전까지 **요약이 없는 참여자는 후보 목록에서 안 보인다** — 2 를 바로 잇는다. 옛 앱은 참여 문을 두 인자로 부르고,
   새 인자(`p_need`)는 `default null` 이라 그대로 돈다(있던 요약을 안 지운다).
2. **백필 — 셈만 먼저.** 운영 접속값을 **환경변수로만** 준다(스크립트는 `.env.*` 를 스스로 안 읽는다).

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<운영 URL> SUPABASE_SECRET_KEY=<운영 secret> npx jiti scripts/backfill-need-summary.ts
   ```

   찍는 것은 `targets` · `would-update` · `skipped` · `failed` 수뿐이다. `failed` 가 0 이 아니면 멈추고 본다.
3. **백필 — 적는다.** 같은 줄 끝에 `--apply`. 한 번 더 `--apply` 로 돌려 `targets: 0` 인지 본다(멱등이다 — 다 채운
   뒤에는 대상이 없다). `skipped` 는 읽은 뒤 그 사람이 입력을 고쳐 안 적은 수다 — 그 사람은 앱을 열 때 채운다.
4. **값으로 적는다.** `npm run db:remote -- --purpose "v2-beta 백필 확인" "select count(*) filter (where need_summary is null) as missing, count(*) filter (where need_summary ->> 'rule' is distinct from public.discovery_need_rule()) as stale, count(*) as participants from public.discovery_profile where opted_in_at is not null"`
   — `missing` · `stale` 이 0 이어야 한다. 셋을 그 일의 이슈에 적는다.
5. **앱.** 위 「묶음 배포」. 새 앱은 참여 문을 부를 때마다 요약을 새로 짓는다.
6. **두 문은 남긴다**(운영자 결정 2026-09-25). `need_summary_backfill_targets` · `set_discovery_need_summary` 는 `service_role`
   에만 열린 운영 문이고 `set_person_chart` 처럼 영구히 선다 — 아래처럼 규칙이 바뀔 때마다 백필이 다시 지난다.

**엔진이 억부 규칙이나 오행 무게를 올리는 날에도 같은 순서다** — `discovery_need_rule()` 을 새 이름으로 올리는
마이그레이션 → 백필(옛 이름의 요약이 대상이 된다) → 앱. 두 이름이 어긋나면 `scripts/card-score-sql.test.ts` 가 깨진다.

### 가입 코드 배포 — **훅을 먼저 끈다** (ADR 0042, 한 번만)

`20260911090000_the_code_opens_the_signup.sql` 이 `gate_signup_by_invite` 를 지운다.
원격의 훅이 **그 함수를 가리킨 채로** 남아 있으면 GoTrue 가 없는 함수를 부르고,
그때 **아무도 로그인하지 못한다.** 로컬에서 실제로 그 상태를 봤다.

    Error running hook URI: pg-functions://postgres/public/gate_signup_by_invite

순서가 곧 안전이다.

**1. 훅을 끈다 (대시보드)**

<https://supabase.com/dashboard/project/xgdeguyxgkillndraonc/auth/hooks>

메뉴로 가면 왼쪽 사이드바의 **Authentication** → 그 안의 **Hooks** 다. 그 화면에 훅
종류가 카드로 서 있고 우리 것은 **Before User Created** 하나다 — 값에
`pg-functions://postgres/public/gate_signup_by_invite` 가 적혀 있는 그 카드다. 거기서
훅을 **끄거나 지운다**(활성 토글을 내리거나, 지정된 Postgres 함수를 비운다).

저장한 뒤 **화면을 새로 고쳐 실제로 꺼졌는지 눈으로 확인한다.** 이 한 걸음이 안 되면
다음 걸음이 서비스를 닫는다.

> `supabase config push` 로 대신하지 않는다. **원격의 구글 설정을 지운다**(맨 위 경고).

**2. 마이그레이션을 올린다**

```bash
npm run db:push
```

**3. 앱을 배포한다** — `main` 에 머지하면 자동으로 나간다.

**4. 첫 코드를 넣는다** — 위 「초대」의 `insert into public.signup_code …`.

**5. 확인한다** — 로그인이 되는가(훅이 안 남았는가), 코드 없이 `/me` 로 가면 `/signup`
이 서는가, 넣은 코드로 가입이 끝나는가.

```sql
-- 오늘 코드와 남은 자리
select c.code, c.max_uses, count(u.id) as 들어온사람
from public.signup_code c
left join public.app_user u on u.signup_code = c.code
where c.valid_on = (now() at time zone 'Asia/Seoul')::date
group by c.code, c.max_uses;

-- 가입이 안 끝난 계정 — 코드를 못 넣었거나 안 넣은 사람이다. 그대로 둬도 된다.
select au.email, u.signed_up_at
from public.app_user u join auth.users au on au.id = u.id
where u.signed_up_at is null;
```

**되돌려야 하면** 훅을 다시 켤 수는 없다 — 가리킬 함수가 없어졌기 때문이다. 되돌리는
길은 마이그레이션을 되돌리는 것 하나다. 그래서 **1번을 눈으로 확인한 뒤에만 2번으로 간다.**

배포 전 확인은 `npm run verify` 와 네 층 전부:

```bash
npm test && npm run test:db && npm run test:flow
npm run test:e2e          # 백엔드 없이 돈다
npm run test:e2e:authed   # `npm run db:start` 를 요구한다
```

**e2e 가 두 명령인 것은 계약이다.** 로그인하지 않은 사람을 돌려보내는 데 백엔드가
필요하면 그것부터 잘못이라, 그쪽은 CI 의 껍데기 접속값으로도 돈다. 로그인 흐름만
로컬 스택을 요구한다.

## 운영 의존성 취약점 — CI 의 `audit` 이 붉을 때 (G-23 ①, ADR 0104)

`audit` 차선은 `npm audit --omit=dev --audit-level=high` 다. **의존성 목록을 바꾼 PR** 과 **main 푸시 · 하루 한 번의
일정**에서 돈다. PR 에서 붉으면 그 PR 이 들인 것이고, main 에서 붉으면 `ci-main-red` 이슈가 「붉은 차선」을 적는다 —
`audit` 만이면 커밋이 아니라 새로 뜬 advisory 다. 어느 쪽이든 새 작업보다 먼저 한다.

```bash
npm audit --omit=dev                 # 무엇이 · 어느 판에서 · 고친 판이 있나
npm ls <패키지>                       # 누가 끌어왔나 — 직접 의존이면 package.json, 아니면 부모
npm install <패키지>@<고친 판>        # 직접 의존. 간접이면 부모를 올리거나 package.json 의 overrides
npm audit --omit=dev --audit-level=high ; echo $?   # 0 이어야 한다
```

1. **올린다.** 같은 메이저 안이면 올리고 끝이다. 메이저를 넘거나 `overrides` 로 누르면 그 판이 부모와 맞는지
   `npm run build` 와 e2e 로 본다 — `next` 가 그런 자리다(`1e1f6c8` 은 16.3.1 → 16.3.6).
2. **PR 은 `fix(deps): ...`** 로 낸다. 잠금 파일이 바뀌므로 그 PR 에서 `audit` 이 다시 돌아 0 을 잰다.
3. **고친 판이 아직 없으면** 막을 자리를 본다 — 그 경로를 우리가 부르나(`npm audit` 의 advisory 본문). 안 부르면
   간극 대장 G-23 ① 에 패키지 · advisory · 까닭 · 다시 볼 날을 적고, 그동안 붉은 main 은 이슈가 들고 있다.
   `--audit-level` 을 critical 로 올리거나 차선을 끄지 않는다.

개발 의존성(`npm audit` 전체)은 CI 가 안 막는다 — 운영에 안 실린다. 같은 절차로 손으로 정리한다(G-23 ⑫).
