# 운영 절차 — AI 생성 · 비용 한도 · 로그인 전 사주 문단

색인은 `docs/ops/runbook.md` 다.

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

## 검사 기록 보는 법 (ADR 0163)

품질 검사에 걸린 글도 저장하고 화면에 세운다 — 막는 것은 출생 원문 누출 · 동의 범위 밖 판정 · 그릴 수 없는 꼴 셋뿐이다. 걸린 검사는
시도마다 `{code, detail}` 로 적히고(`reading_run.check_findings` · `taste_artifact.check_findings`), 날짜별 수가 뷰 한 줄로 선다.
개인이 없다 — 글 원문 · 출생 원문은 기록에 안 든다.

```bash
npm run db:remote -- --purpose "검사 기록 날짜별 수" \
  "select * from public.reading_check_daily where day > current_date - 14 order by day desc, kind, total desc;"
```

- `kind` — `self` · `person` · `private` · `match` · `taste`(로그인 전 사주 문단)
- `shipped` · `blocked` — 이 코드가 걸리고도 내보낸 시도 · 막힌 시도. 막힌 시도는 같은 시도의 다른 코드가 막았을 수 있다
- `checked` — 그날 그 종류에서 검사를 적은 시도 전부(분모), `share` — 그 가운데 이 코드가 걸린 몫(%)

코드가 어느 갈래인지는 ADR 0163 의 갈래 표가 든다. 몫이 큰 품질 코드가 프롬프트를 고칠 자리다 — 고치면 실호출로 다시 잰다
(`docs/agents/test-map/what-to-run.md` 의 프롬프트 줄). 한 시도의 설명까지 볼 때(문의 응대 · G-92)는 그 시도 id 하나로만 읽는다 —
`select check_findings from public.reading_run where id = '<시도 id>';` `reading_run` 은 이용자의 시도라 일상 집계에 열지 않는다
(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 뷰는 `service_role` 에도 닫혀 있다 — `db:remote` 로만 본다.


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

## 로그인 전 사주 문단 — 비밀 둘 · 상한 · 비용 (ADR 0143)

로그인 전 첫 화면의 사주 문단은 사람마다 모델이 쓴다. 계정이 없으므로 빗장은 브라우저와 IP 에 걸고, 칸은 모델을 **부르기 전에**
`reserve_taste` 가 한 트랜잭션으로 예약한다. 앱은 main 에 들었고(#441 · #443) DB 둘(`20261118090000` · `20261119090000`)은 운영에
올라 있다 — 「배포」 답 뒤 운영 배포 전까지(G-68) 이 절의 표와 뷰는 비어 있다. 회원에게는 이 문단을 만들지 않는다(로그인한 요청은
서버가 닫는다).

### 비밀 둘 — 없으면 문단이 닫힌다

| 이름 | 하는 일 | 바꾸면 |
| --- | --- | --- |
| `TASTE_BROWSER_SECRET` | httpOnly 쿠키 원문을 HMAC 해 브라우저 묶음을 짓는다 — 날짜별로 돌리지 않는 **안정 비밀**이다(자정을 넘겨 가입한 사람이 다른 브라우저가 되지 않게) | 열린 미가입 세션의 귀속이 끊긴다 |
| `TASTE_IP_SECRET` | 날짜별 키의 뿌리 — `HMAC(이 값, 서울 날짜)` 가 그날의 키이고 그 키로 IP 를 HMAC 한다. DB 에는 그 HMAC 만 24시간 간다 | 그날 IP 빗장이 처음부터 다시 센다 |

1. **만든다** — 값마다 따로 `openssl rand -hex 32`. 둘을 같은 값으로 두지 않고, 다른 비밀(`CRON_SECRET` 들)과도 나누지 않는다.
2. **넣는다** — Vercel 대시보드 Settings → Environment Variables 에 **Production · Preview** 둘 다, Sensitive 로. 새 배포부터 읽힌다
   (Redeploy → Ready). 앱을 로컬에서 돌릴 때만 `.env.development.local` 에 손으로 붙인다(Secret 은 `vercel env pull` 로 안 온다).
   값 교체 · 지우기는 사람이 대시보드에서 한다(에이전트의 `vercel env rm` 은 등급 4).
3. **교체** — `docs/ops/runbook/secret-leak.md` 「비밀이 새면」 표의 두 줄. 둘 다 옛 값과 새 값이 함께 설 자리가 없다 — 교체가 곧 끊기다.
4. **없으면** 로그인 전 사주 문단이 닫힌다. 배포 전에 둘이 있는지 `vercel env ls` 로 이름만 본다.

**지금(2026-10-03)** — 조율자가 둘을 무작위 값으로 **Production · Preview 둘 다** 넣었다(`vercel env ls` 의 environments 칸에
이름마다 `Production` 줄과 `Preview` 줄이 하나씩). Preview 는 처음에 Vercel CLI 54.0.0 의 `vercel env add … preview` 가
`git_branch_required` 로 거절했고, **최신 CLI 의 `vercel env add <NAME> preview --value … --yes`** 로 들었다(가지를 안 적으면 모든
Preview 가지). 대시보드라면 Settings → Environment Variables 에서 Preview 를 고르고 가지는 비워 둔다.

### 이어쓰기가 막힌 시도 — `taste-link-failed` · `wrong_run` 경보

가입 뒤 첫 누름이 맛보기를 시도에 잇지 못하면 그 시도는 보내지 않고 `taste-link-failed` 로 닫힌다 — 풀이권은 안 나가고 다음
누름이 다시 잇는다(ADR 0143 「덧」). 순간 장애(문이 답하지 않음 · 귀속 표를 다시 못 맞춤 · `run_taken`)면 다음 누름이 지나간다.
**`wrong_run`** 은 다르다 — 방금 `self` 로 연 시도가 그 회원의 자기 풀이가 아니라는 답이라 정상에서는 날 수 없다. 앱이 그
시도를 같은 코드로 닫고 **서버 오류 알림 문으로 운영자에게 알린다** — 종류 `request-error:action:/taste/wrong-run`, 하루 한 줄
(`app/me/reading/pipeline.ts` 의 `TASTE_WRONG_RUN_ALERT`, Production 에서만). 그 알림을 받으면 수와 날짜만 본다:

```bash
npm run db:remote -- --purpose "이어쓰기가 막힌 시도 수" \
  "select date_trunc('day', finished_at) as day, failure_detail like 'wrong_run%' as wrong_run, count(*)
     from public.reading_run where failure_code = 'taste-link-failed' and finished_at > now() - interval '7 days'
    group by 1, 2 order by 1 desc;"
```

`wrong_run` 줄이 서면 그 시도를 연 `start_reading_run` 과 `link_taste_reading_run` 의 판정이 어긋난 것이다 — 막힌 사용자는 실패한
풀이 화면의 「전체 풀이만 보기」로 귀속 표를 걷고 보통 풀이를 받는다(사람 · 본문은 위 질의에 안 나온다).

### 상한 — 값이 사는 자리

| 값 | 수 | 함수 |
| --- | --- | --- |
| 전체 하루(서울 날짜) 모델 생성 — 실패도 든다 | 2,000 · 80%(1,600)에 `taste-budget-warning`, 닿으면 `taste-budget-reached` | `taste_daily_model_calls()` |
| 브라우저 하나의 새 근거 지문 / 1시간 | 5 | `taste_browser_new_per_hour()` |
| IP 하나의 모델 생성 | 1분 3 · 하루 20 | `taste_ip_calls_per_minute()` · `taste_ip_calls_per_day()` |
| IP 하나의 요청 — 캐시 적중도 센다 | 1분 30 | `taste_ip_requests_per_minute()` |
| 같은 입력의 모델 시도 | 3 | `taste_attempt_limit()` |
| 도는 시도를 죽은 것으로 보는 때 | 60초 | `taste_call_timeout()` |
| 미가입 세션 · 생성 결과 · 사건 기록 | 24시간, 연장 없음 | `taste_keep_for()` |

값은 위 함수 하나씩에 산다(`supabase/migrations/20261118090000_a_taste_is_made_for_each_visitor_and_reserved_before_the_call.sql`).
바꾸는 것은 그 함수를 `create or replace` 하는 마이그레이션이고 결정이다(PRD §2). 경보 두 이름은 `notify_ops` 로 하루 한 줄씩
`ops_alert` 와 운영 채널에 간다(위 「운영자 알림 배선」). 80% 는 상한 함수에서 바로 세므로 상한만 고치면 경보도 따라온다.

### 관측 — 개인 없는 날짜별 한 줄

```bash
npm run db:remote -- --purpose "로그인 전 사주 문단 날짜별 수" \
  "select * from public.taste_daily order by day desc limit 14;"
```

`taste_daily` 에는 사람이 없다 — 날짜 × 수뿐이다. 칸은 넷으로 읽는다.

- **예산** — `model_calls`(상한이 보는 수) · 갈래(`call_model` · `reuse_succeeded` · `wait_running` · `retries_exhausted`) · 빗장
  (`limited_request` · `limited_browser` · `limited_ip` · `limited_global`)
- **결과** — `calls_succeeded` · `calls_failed` · `calls_timed_out` · `calls_late`(시간을 넘긴 뒤 온 결과 — 토큰은 나갔다) ·
  `avg_response_ms` · `max_response_ms`
- **토큰** — `input_tokens` · `cache_read_tokens` · `cache_write_tokens` · `output_tokens` · `reasoning_tokens`
- **퍼널 다섯 단계** — `preview_shown` → `signup_started` → `signup_completed` · `session_claimed` →
  `reading_started` → `reading_succeeded`. 가입 완료와 귀속은 칸이 따로다(앞은 앱이, 뒤는 DB 가 센다).
  앱이 세는 둘(`signup_started` · `signup_completed`)은 **세션 하나에 단계마다 한 번**이다 —
  `count_taste_step_once` 가 세션 id 와 브라우저 HMAC 이 함께 맞을 때만 센다(`20261119090000`). 「로그인하고 전체 풀이 받기」도
  `signup_started` 다. `signup_completed` 는 **가입을 마치고 그 세션을 들고 돌아온 것**이다 — 귀속 결과가 `claimed` · `discarded` ·
  `expired` · `not_ready` 어느 것이든 센다(`session_claimed` 는 그중 붙은 것만). `reading_succeeded` 는 회수 경로가 옛
  `count_taste_step` 으로 센다 — 옛 문은 그 하나만 받는다(G-91, `20261129090000`). **#443 을 배포한 날 전의 줄은 누름 수였다** — 그 앞뒤를 견주지 않는다.
  **「더보기」(`more_clicked`)는 걷었다**(G-85, `20261128090000`) — 「더보기」를 걷은 화면(ADR 0143 의 2026-10-09 덧)을 배포한 날부터
  화면이 안 불렀고, 2026-10-10 에 단계 · 칸 · 셈 문의 그 값을 함께 걷었다. 운영에서 그 단계로 센 줄은 한 번도 없다. 가입 시작은 문단
  생성 성공(`preview_shown`) 바로 다음 단계다

뷰는 `service_role` 에도 닫혀 있다 — `db:remote`(`postgres`)로만 본다. 원본 행(`taste_session` · `taste_artifact`)은 미가입 방문자의
글과 지문을 들므로 `docs/ops/runbook/access.md` 「개인정보는 화면으로만」의 경계대로 일상 질의에 열지 않는다.

### 비용 — 토큰 × 공식 단가

DB 는 금액을 내지 않는다. 공식 단가(gpt-5.6-luna, https://developers.openai.com/api/docs/models/gpt-5.6-luna, 2026-10-03 확인) —
입력 $0.20 · 캐시 입력 $0.02 · **캐시 쓰기는 입력의 1.25배($0.25)** · 출력 $1.20 /1M 토큰. 추론 토큰은 출력에 이미 든다(따로
곱하지 않는다).

```
캐시 아닌 입력 = input_tokens − cache_read_tokens − cache_write_tokens
하루 $ = (캐시 아닌 입력 × 0.20 + cache_read_tokens × 0.02 + cache_write_tokens × 0.25 + output_tokens × 1.20) / 1,000,000
```

`input_tokens` 는 캐시 읽기 · 쓰기를 **포함한** 입력 전체이고, `output_tokens` 는 추론을 **포함한** 출력 전체다
(`reasoning_tokens` 는 그 안의 몫이라 따로 곱하지 않는다). 근거는 앱이 받는 사용량의 변환 —
`@ai-sdk/openai` 의 `convertOpenAIResponsesUsage` 가 `inputTokens.total = usage.input_tokens` 로 두고 캐시 읽기 · 쓰기를 그 안의
몫(`cacheRead` · `cacheWrite`, `noCache` 는 둘을 뺀 값)으로, `outputTokens.total = usage.output_tokens` 에 추론을 그 안의 몫으로
나눈다. 앱은 그 `total` 을 `finish_taste` 에 넘긴다(#441). 실측(2026-10-03 실호출)은 한 번 약 4원 · 4~6초였고, 하루 2,000 을 다 써도 하루 약 8천원
이하다. 청구의 원본은 OpenAI 대시보드이고 바깥 벽(월 예산)도 거기다 — 위 「AI 비용 한도」.

### 가용성 — Vercel WAF 속도 제한은 운영자 몫

돈은 DB 의 하루 2,000 이 막는다. 남는 것은 가용성이다 — IP 를 많이 쥔 쪽(IPv6 는 /56 하나를 한 IP 로 센다)이 전체 하루 상한을
먼저 채우면 그날 문단이 닫히고 가입 안내만 선다(ADR 0143 「덧」의 받아들인 위험). 꼴만 맞춘 가짜 쿠키로 다시 묻는 서버 액션
(`readTaste`)도 한도 없이 DB 읽기 한 번까지 간다. 앱 · DB 는 이것을 더 막지 않는다.

- **권고** — Vercel 대시보드 Firewall 에 사용자 규칙 하나: 경로 `/` · 방법 `POST`(서버 액션은 그 화면 주소로 POST 한다)에 IP 당
  속도 제한. 값은 앱의 IP 빗장(요청 1분 30)보다 넉넉하게 두어 정상 방문자를 안 막는다. 넣고 고치는 것은 운영자가 대시보드에서
  한다 — 에이전트는 안 만진다.
- **볼 것** — `taste_daily` 의 `limited_global` 이 이른 시각에 서거나 `taste-budget-warning` 이 평소보다 이르면 이 길을 의심한다.
  `limited_ip` 가 꾸준히 늘면 CGNAT 로 IP 하나를 나누는 사람들이 하루 20 에 걸리는 것일 수 있다 — 값을 다시 보는 근거다(PRD §2).

### 크론 `taste-sweep`

5분마다(매시 1 · 6 · 11 … 분) `retention.sweep_taste()` 가 60초를 넘긴 시도를 실패(`timeout`)로 닫고, 24시간 지난 미가입 세션 ·
생성 결과 · 사건 기록을 지운다. 귀속된 세션은 안 지운다(탈퇴 때 cascade). 도는지는 `docs/ops/runbook/jobs.md` 「도는 잡이 정말 도나」의 질의에
`taste-sweep` 줄이 `succeeded` 로 서는지로 본다 — 실패하면 `cron-watch` 가 `cron-failed:taste-sweep` 으로 알린다.

```bash
npm run db:remote -- --purpose "taste-sweep 일정 확인" \
  "select jobname, schedule, active from cron.job where jobname = 'taste-sweep';"
```
