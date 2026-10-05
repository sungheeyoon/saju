# 운영 절차 — 풀이권 · 산 풀이권

색인은 `docs/ops/runbook.md` 다.

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
returns integer language sql immutable set search_path = '' as $$ select 5 $$;
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
상한(`reading_daily_budget()`, `docs/ops/runbook/ai.md` 「AI 비용 한도」)과 OpenAI 쪽 예산을 함께 옮겨야 한다.
그리고 실패한 시도도 모델은 이미 불렸으므로 「성공 건수 × 인원」이 호출 상한이 아니다.

### 산 풀이권 — 주문 · 묶음 · 쓰임 · 환불 (G-21 ⑤ ④, ADR 0106)

**판매는 닫혀 있다**(`reading_sale_is_open()` = false) — 주문이 0건이다. 장부만 먼저 섰다. 잔액은 여전히 센다 — 한도가
`무료 + 예외 + Σ(묶음의 산 수 − 걷은 수)` 로 한 칸 늘었을 뿐이고, 쓰임 장부(`reading_credit_use`)는 **환불 셈의 입력**이다.
쓴 순서는 무료 → 예외 → 산 때가 이른 묶음이고, 자리를 잡는 순간 트리거가 정한다. 지운 대상의 시도가 셈에서 빠져
되돌아온 자리로 만든 것은 몫 밖(`outside`)이다 — 환불 대상이 아니다.

**주문 조회 — 개인을 가리키지 않는 질의만**(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 에이전트도 돈다.

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
함께 지운다. 분쟁이나 수사기관의 요청이 걸리면 보류를 건다 — 신고 기록의 보류(`docs/ops/runbook/erasure.md` 「떠난 사람의 신고 기록」)와 같은 모양이다.

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
