# 바깥 감시는 자격 없는 상태 문을 두드리고, DB 가 보내는 heartbeat 를 듣는다

> **운영자가 정했다(2026-10-24)** — 「바깥 감시를 둔다. UptimeRobot Free(uptime: `/` 와 `/api/health`, 5분) + Healthchecks.io 무료
> (heartbeat), 감시 서비스 이용료 월 $0. `/api/health` 는 자격 없이 공개한다. heartbeat 의 cron-watch 창은 25분 그대로.」
> 점검표의 「누가 무엇을 할 수 있는가」(자격을 묻지 않는 `/api` 문 하나)와 「비용 · 외부 서비스」(감시 서비스 둘 · 월 $0)에 걸린 결정이다.
> **2026-10-24 붙여 닫았다** — 배포 `3cee402` · 감시 셋 · Vault 주소 · 알림 시험(down · up 메일)까지(`docs/product/prd-changelog.md` 2026-10-24). 붙이는 차례는 `docs/ops/runbook/jobs.md` 「바깥 감시」.

## 무엇이 문제였나

알림은 전부 DB 안의 `notify_ops`(Vault `ops_alert_url`) 한 길로 나간다. `pg_cron` 이 멈추거나 · 감시기가 계속 실패하거나 · DB 가
읽기 전용이 되거나(ADR 0199) · 프로젝트가 멈추면 그 길이 함께 선다. 앱이 통째로 응답하지 않는 것은 그 길이 아예 모른다(G-118).
첫 화면(`/`)은 빌드 때 그려져 CDN 이 내므로, 바깥에서 `/` 만 두드리면 함수 · DB 가 죽어도 200 이다(2026-10-23 운영
`/api/health` 는 404 — 그런 문이 없었다).

## 정한 것

| 물음 | 답 |
| --- | --- |
| 바깥이 무엇을 두드리나 | `/`(도메인 · CDN)와 `/api/health`(함수 · 앱→DB) — 5분마다 |
| 상태 문은 무엇을 보나 | 로그인 없는 역할로 공개 문 `current_beta_schedule` 하나를 읽는다. 5초에 끊는다. 200 `{"status":"ok"}` · 503 `{"status":"unavailable"}` 뿐이고 오류 문장 · 읽은 값은 싣지 않는다 |
| 어느 서비스 · 얼마 | uptime 둘은 UptimeRobot Free, heartbeat 하나는 Healthchecks.io 무료 판(Hobbyist). 감시 서비스 이용료 월 $0 — 견준 후보는 아래 「견준 서비스」 |
| 자격 | **묻지 않는다** — 단순하고(비밀 · 교체 절차가 없다), 닿는 것이 anon 이 Supabase 에 이미 직접 할 수 있는 공개 읽기 하나뿐이다. `/api` 아래 유일한 예외이고, 그 문이 열쇠 · 쿠키 · 쓰기 · 다른 문에 닿지 않는 것을 `app/me/reading/boundary.test.ts` 가 잰다 |
| DB 안이 도는지 | 상태 문이 아니라 heartbeat — 크론 `ops-heartbeat`(10분)가 감시기가 25분 안에 성공했을 때만 Vault `ops_heartbeat_url` 로 GET 하나. 끊기면 바깥이 알린다. 주소가 없으면 아무것도 안 한다 |
| 어디로 알리나 | 바깥 서비스가 직접 — 운영자 이메일 + 지금 운영 채널. DB 를 안 지난다 |
| 언제 알게 되나 | 꼴마다 다르다. **uptime** 은 5분 주기에 서비스의 재확인 · 응답 제한시간 · 메일 전달 시간이 더해진다. **heartbeat** 는 기간 10분 + 유예 10분이라 마지막 신호를 받은 지 약 20분 뒤 down 으로 판정한다. **감시기 `cron-watch`(10분마다)만 고장 나면** heartbeat 는 마지막 성공부터 25분 창 동안 계속 나가므로, 알림은 마지막 성공부터 약 40~45분 뒤다 — 운영자가 이것을 알고 25분 창을 그대로 두었다(2026-10-24) |

차례와 확인은 `docs/ops/runbook/jobs.md` 「바깥 감시」.

## 고르지 않은 것

- **상태 문에 비밀을 건다**(`?key=` · `Authorization`) — 두드릴 수 있는 사람을 줄이지만 비밀 하나(Vercel 변수 · 감시 서비스 설정)와
  교체 절차가 는다. 지키는 것이 공개 문 하나의 읽기라 값이 대가보다 작다. 두드림이 부하가 되면 그때 건다 — 필요해지면 `?key=`
  (주소가 로그 · 감시 화면에 그대로 남는다)보다 머리글 방식을 먼저 본다.
- **상태 문이 `pg_cron` 의 마지막 실행까지 본다** — 새 DB 함수를 anon 에 열어야 하고, DB 가 읽기 전용일 때의 끊김은 heartbeat 가
  더 곧게 잡는다.
- **heartbeat 를 Vercel Cron 으로** — Hobby 의 Vercel Cron 은 하루 한 번이라 10분 주기가 안 되고, DB 안의 멈춤을 못 본다.
- **Vercel Pro 의 관측 · 알림** — 감시받는 쪽 안에서 본다. Vercel 이나 함수가 죽으면 함께 못 보고, DB 크론의 멈춤은 모른다(2026-10-24 운영자와 견줌).
- **AWS 로 직접**(Route 53 health check · CloudWatch 알람 · SNS, heartbeat 는 API Gateway · Lambda 를 지어서) — uptime 은 되지만 heartbeat 를 받는
  기성 서비스가 없어 짓고 비밀 하나를 들인다. Supabase 가 같은 AWS 서울에 있어 함께 서는 장애에서 덜 따로 논다. 계정이 늘지 않는 것이 이점이다.

## 치르는 값

- **누구나 `/api/health` 를 두드려 함수 호출 하나와 DB 읽기 하나의 비용 · 부하를 낼 수 있다.** 위험이 없는 것이 아니다 — 자주
  두드리면 Vercel 함수 호출 수와 Supabase 읽기가 그만큼 는다. 공유 화면(`/share/…`)이 이미 같은 꼴이고, 막는 것은 플랫폼의 한도 ·
  방화벽뿐이다. 부하가 보이면 위 「비밀을 건다」를 다시 본다.
- 감시 서비스 계정이 둘 는다(MFA 대상).
- 감지가 즉시가 아니다 — 위 「언제 알게 되나」. 감시기 하나만 고장 난 경우는 40분을 넘겨서야 안다.

## 견준 서비스 (2026-10-23 확인 — 간극 대장 기록에서 옮김)

| 후보 | 무료로 되는 것 | 유료 | 상업 이용 | 출처(2026-10-23 확인) |
| --- | --- | --- | --- | --- |
| **UptimeRobot** | Free — 감시 50개 · 5분 · 연동 5개. heartbeat 는 유료 판에만(회사 비교 글) | Solo $9/월(연 결제, 월 결제 $10) — 10개 · 60초 | 약관 「available for any use, including commercial and business use」(2026-05 개정). 2024 말 ~ 2026 초의 「Free 는 비상업」 안내는 3자 글에만 남은 옛 내용 | <https://uptimerobot.com/pricing/> · <https://uptimerobot.com/terms> · <https://uptimerobot.com/alternative-to-cronitor/> |
| **Healthchecks.io** | Hobbyist $0 — heartbeat 20개 · 기록 100줄. 연동에 이메일 · Slack · Discord · Telegram · 웹훅 | Supporter $5(한도 같음) · Business $20 — 100개 · SMS 50 | 약관에 무료 판의 상업 제한 없음(2018-05-09 판) | <https://healthchecks.io/pricing/> · <https://healthchecks.io/terms/> · <https://healthchecks.io/docs/http_api/> |
| **Better Stack** | 「Free for personal projects」 — 감시 · heartbeat 합쳐 10개 · 3분 · Slack · 이메일 | uptime 은 덧붙임 값만 공개(감시 50개 $21~25/월 · heartbeat 10개 $17~20/월) | 무료 판이 「personal projects」라 판매하는 서비스에 맞는지 불명 — 약관(2025-02-14)엔 무료 판 언급 없음 | <https://betterstack.com/pricing> · <https://betterstack.com/docs/uptime/check-frequency/> · <https://betterstack.com/terms> |

UptimeRobot Free 의 알림 메일은 가입 메일 하나뿐이다(2026-10-24, 공식 도움말 「Personal Notification Channels」).
