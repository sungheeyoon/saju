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

모두에게 더 주려면 상한을 옮긴다 — 값이 하나뿐인 것이 이 설계의 요점이다. **한 사람에게만** 더 주는 것은 상한이 아니라
아래 「무상 풀이권 지급 · 회수」다(ADR 0043 · 0187).

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

### 무상 풀이권 지급 · 회수 (G-111 ①, ADR 0187)

**화면이 먼저다** — 회원 화면(`/ops/members?q=<계정 id>`)의 「무상 풀이권 지급」 · 「무상 지급분 회수」. 한 번에 1 ~ 10장, 지급
갈래는 장애 보상 · 운영 지급, 회수 갈래는 잘못 지급 · 중복 지급 · 기타, 메모 필수(이용자에게는 안 간다). 회수는 운영 지급분의 안
쓰고 예약도 안 된 것만이다 — 가입 무료분 · 유료 구매분은 줄지 않는다(유료분은 주문 화면의 환불). 지급마다 장애 알림 길에 한 줄,
지급 · 회수마다 이용자 소식에 한 줄이 간다.

**탈퇴 대기 계정에는 지급하지 않는다**(운영자 결정 2026-10-17, G-111 R-7 · ADR 0191) — 공통 함수가 「탈퇴 대기 계정이라 지급할 수
없습니다.」(`23514`)로 거절하고, 화면은 지급 단추를 잠근다. 회수는 받는다. **정지된 계정에는 지급한다** — 장애 보상은 정지 중에도
그 사람의 몫이다. 탈퇴를 거둔(`deletion_withdrawn`) 뒤에 준다. 거절된 지급 · 회수는 접속기록에 `refused` 로 남는다(`security.md`).

**불만 · 분쟁 처리로 준 지급은 그 처리 기록에도 남긴다** — 장애 보상처럼 이용자의 불만 · 분쟁을 처리하며 준 지급은 그 처리
기록(지금은 이메일 회신, 처리방침 v8 「소비자 불만 · 분쟁 처리 기록 3년」)에 지급 날짜 · 장수 · 사유 갈래를 적는다. 지급 장부는
탈퇴와 함께 지워지므로 증빙은 그 기록이 든다(ADR 0187 의 12). 메모 · 이메일에 이메일 주소 말고 다른 개인정보를 더하지 않는다.

`reading_credit_grant` 를 직접 고치지 않는다 — `extra` 는 지급 장부(`reading_credit_grant_entry`)의 합이고, 직접 고치면 장부와 갈린다.
화면을 못 쓸 때(break-glass)도 같은 공통 함수(`book_reading_credit_grant`)를 운영자 UUID 와 함께 부르고, moderation.md 「SQL 실행 전 확인」의
셋을 밟는다.

1. **대상을 먼저 본다** — 계정 상태와 지급 장부의 지금(메모는 안 꺼낸다). 회수면 회수할 수 있는 수도 본다(예약 정리 전의 값이라
   블록 안에서 다시 잰다).

   ```bash
   npm run db:remote -- --purpose "무상 지급 전 확인 <계정 앞 8자>" \
     "select a.id, a.status, (select g.extra from public.reading_credit_grant g where g.user_id = a.id) as extra, (select count(*) from public.reading_credit_grant_entry e where e.user_id = a.id) as 장부줄, public.reading_credit_grant_left(a.id) as 회수가능 from public.app_user a where a.id = '<계정 UUID>'"
   ```

2. **요청 번호를 먼저 하나 짓고 적어 둔다** — `select gen_random_uuid()` 로 받은 값을 대장에 적는다. 응답이 끊겨 같은 블록을 다시
   보내도 같은 번호면 한 줄만 선다(블록은 `replayed` 면 되감는다 — 이미 선 것이다).
3. **검사가 든 블록 하나로 보낸다** — 블록 안에서 부르고 예외 몫이 뜻한 만큼 바뀌었는지 재서, 어긋나면 되감는다. 따옴표 친
   heredoc 으로 넘긴다(moderation.md 「보내는 모양」).

   ```bash
   npm run db:remote -- --purpose "무상 지급 <계정 앞 8자> 3장 — 장애 보상" "$(cat <<'SQL'
   do $$
   declare
     who constant uuid := '<계정 UUID>';
     before integer := coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0);
     r record;
     after integer;
   begin
     -- 회수면 'revoke', 3 → 걷을 수, 갈래 'mistake' · 'duplicate' · 'other', 관련 신고 인자는 null
     select * into r from public.book_reading_credit_grant(
       '<운영자 UUID>', who, 'grant', 3, 'outage', '<메모 — break-glass 대장 번호>', '<2 의 요청 번호>', null);
     after := coalesce((select g.extra from public.reading_credit_grant g where g.user_id = who), 0);
     if r.replayed then raise exception '이미 선 요청 번호 — 되감는다(장부 줄 %)', r.entry_id; end if;
     if after <> before + 3 then raise exception '지급: % → % — 되감는다', before, after; end if;
   end $$;
   SQL
   )"
   ```

   회수할 수 있는 수보다 많으면 함수가 「회수할 수 있는 지급분보다 많습니다 — 지금 N장입니다.」로 거절한다(되감긴다).
4. **사유 · 실행자** — 함수가 장부 줄에 갈래 · 메모 · 실행자 UUID · 시각을 남기고, `db:remote` 의 목적이 접속기록에 남는다.

**매일 크론이 같은 것을 잰다**(G-111 R-8, ADR 0191) — `credit-grant-watch`(매일 05:41 UTC)가 `watch_reading_credit_grants()` 로
계정마다 장부 합과 예외 몫을 견주고, 다른 계정마다 장애 알림 `credit-grant-mismatch:<계정 id>`(하루 한 번, 계정 id 와 두 수만)를
보낸다. **아무것도 고치지 않는다.** 알림이 오면: 그 계정의 장부 줄과 `extra` 를 위 1 의 질의로 보고(메모는 안 꺼낸다), `extra` 를
누가 직접 고쳤는지(접속기록의 `cli.query` · 같은 날의 `account-status` · 배포)를 찾는다. 장부가 원본이다 — `extra` 를 장부 합으로
되돌리는 것은 사람 자물쇠 안의 `public.sync_reading_credit_grant` 다 — `do $$ begin perform pg_advisory_xact_lock(hashtext('reading:user:' ||
'<계정 UUID>')); perform public.sync_reading_credit_grant('<계정 UUID>'); end $$;` 를 moderation.md 「SQL 실행 전 확인」의 셋을 밟아
보내고, 그 전에 무엇이 어긋났는지 대장에 적는다. 장부 쪽이 틀렸으면
(지급이 빠졌다 등) 공통 함수로 지급 · 회수 한 줄을 더한다 — 장부 줄은 고치지 않는다. 손으로 볼 때는 아래 질의다.

```bash
# 장부 합 = 예외 몫인가 — 어긋난 계정 수. 0 이어야 한다
npm run db:remote -- --purpose "무상 지급 장부와 예외 몫의 대조" \
  "select count(*) as 어긋난_계정 from public.reading_credit_grant g full join (select user_id, sum(case kind when 'grant' then credits else -credits end) as total from public.reading_credit_grant_entry group by user_id) e on e.user_id = g.user_id where coalesce(g.extra, 0) <> coalesce(e.total, 0)"
```

### 산 풀이권 — 주문 · 묶음 · 쓰임 · 환불 (G-21 ⑤ ④, ADR 0106)

**판매는 닫혀 있다**(`reading_sale_is_open()` = false) — 주문이 0건이다. 장부만 먼저 섰다. 잔액은 여전히 센다 — 한도가
`무료 + 예외 + Σ(묶음의 산 수 − 걷은 수)` 로 한 칸 늘었을 뿐이고, 쓰임 장부(`reading_credit_use`)는 **환불 셈의 입력**이다.
쓴 순서는 무료 → 예외 → 산 때가 이른 묶음이고, 자리를 잡는 순간 트리거가 정한다. 이 순서는 몫의 출처 순이다(G-111 R-9,
ADR 0191 — 운영 판단). 소멸일 순(무료 · 예외는 받은 날부터 1년, 산 몫은 5년, ADR 0173)과 하나가 어긋난다: 산 지 4년이 넘은 묶음이 남은 계정에 운영
지급을 하면 그 지급이 묶음보다 늦게 소멸한다. 판매가 닫혀 있어 아직 생기지 않는다 — 유효기간을 DB 가 걷을 때(G-25) 소멸일 순으로
고르고, 몫마다 소멸일과 「유효기간 임박」 안내를 함께 세우기로 정했다(아직 안 했다). 지운 대상의 시도가 셈에서 빠져
되돌아온 자리로 만든 것은 몫 밖(`outside`)이다 — 환불 대상이 아니다.

**주문 조회 — 개인을 가리키지 않는 질의만**(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 에이전트도 돈다. 오늘 · 이번 주의
주문 · 매출 · 환불 수는 운영 화면 `/ops/today` 가 낸다(ADR 0183) — 아래 SQL 은 상태별 전체 합이다.

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

**환불 — 주문 화면 `/ops/orders` (G-110 ②, ADR 0184).** 운영 머리의 「주문」에서 주문 번호(`rdo_…`)로 찾는다. 금액의 기준은
**결제액 × 걷을 안 쓴 유료 회차 ÷ 그 묶음의 산 회차**다(ADR 0148 · 약관 초안 제16조②). **청약철회 기간(약관 제15조① — 계약내용을 받은
날부터 7일)이 지난 뒤의 단순 변심 환불은 그 금액에서 10% 를 환불수수료로 공제한다**(제16조③, ADR 0192). 같은 묶음을 나눠 돌려주면 누적으로 셈한다 —
`⌊결제액 × 지금까지 걷은 회차 합 ÷ 산 회차⌋ − ⌊결제액 × 환불수수료를 공제한 회차 합 ÷ (산 회차 × 10)⌋` 에서 이미 돌려준 금액을 뺀다.
**DB 가 이 셈을 한다** — 사람이 셈하지 않는다.

**사유가 환불수수료를 가른다 — 청약철회 기간(7일)은 사람이 본다.** DB 는 날짜를 세지 않는다(기점인 계약내용 전자우편이 아직 없다, G-21).
**계약내용을 받은 날을 기준으로 판단한다. 풀이권 제공이 더 늦으면 제공받은 날을 기준으로 한다. 기점을 확인할 수 없으면 공제하지 않는다.**(약관 제15조① · 환불정책 「한눈에」) 판의 「결제」 시각은 기점이 아니다 — 계약내용을 받은 날을 확인할 수 없으면 청약철회로 고른다.

| 경우 | 사유 | 환불수수료 |
| --- | --- | --- |
| 청약철회 기간 안의 요청 · 기점을 확인할 수 없는 요청 | 청약철회(기간 내) `withdrawal` | 없음 |
| 청약철회 기간이 지난 뒤의 단순 변심 요청(탈퇴 전) | 안 쓴 몫 환불(청약철회 기간 경과 후 · 10% 공제) `unused` | 10% |
| 자진 탈퇴 뒤의 청구 | 주문이 지워져 이 화면으로 확보하지 못한다 — 길이 아직 없다(G-21, [기록](../../product/gaps/records/g-21.md) 「판매를 열 때 남은 것」). 금액 규칙은 위 줄과 같다 | 10% |
| 중복 결제 | `duplicate` | 없음 |
| 생성 실패 · 계약과 다른 제공 | 미제공(장애) `failure` — 쓴 회차까지면 아래 SQL 차례 | 없음 |
| 심사 결제 · 회사의 이용 정지 · 해지 · 서비스 종료 | 그 밖 `other` | 없음 |

기간 안인지 애매하면 환불수수료가 없는 쪽(청약철회)으로 고른다 — 이용자에게 더 가는 쪽이다.

**이 셈을 올리는 `db push`(`20261221090000`) 전에 한 번** — 셈은 그 주문의 `unused` 줄을 「이미 공제한 회차」로 센다. 옛 규칙으로 적힌
`unused` 환불이나 진행 중인 `unused` 확보가 있으면 그 주문의 다음 금액이 틀린다. **둘 다 0 일 때만 올린다** — 아니면 멈추고 조율자에게
올린다(개인을 가리키지 않는 수다):

```bash
npm run db:remote -- --purpose "환불수수료 셈 전 unused 환불 수" \
  "select count(*) from public.reading_order_refund where reason = 'unused'"
npm run db:remote -- --purpose "환불수수료 셈 전 진행 중인 unused 확보 수" \
  "select count(*) from public.reading_refund_hold where state = 'held' and reason = 'unused'"
```

세 걸음이다.

1. **준비** — 걷을 회차 · 사유를 고르고 「환불 준비」 → 확인창의 대상(주문 번호 · 닉네임 · 계정 앞자리) · 회차 · 금액을 보고 「N장 · …원 환불 준비」. 창에 보인 금액이 지금 셈과 다르면 DB 가 거절한다. 그 회차가 잠겨 이용자가 못 쓰고(한도에서 빠진다), 금액이 정해져 「환불 진행
   중」 판이 선다(`operator_hold_reading_refund`, 접속기록 `credits.refund_hold`). 주문 하나에 진행 중인 것은 하나다
2. **PortOne 콘솔에서 그 판의 「취소할 금액」을 취소한다** — 판의 결제 번호 · 거래 번호로 결제를 찾는다. 화면은 PG 취소를 부르지 않는다
3. **확정** — 콘솔이 준 취소 번호를 적고 「장부에 확정」(`operator_book_reading_refund`, `credits.refund_book`). 같은 번호로 다시 눌러도
   한 번만 적힌다

콘솔 취소 전에 멈추려면 「준비 취소」(`operator_release_reading_refund`, `credits.refund_release`)로 잠근 회차를 푼다. **콘솔에서 취소한
뒤에는 준비 취소하지 않는다** — 확정한다. 화면의 준비 취소는 풀기 전에 PortOne 결제 조회로 취소 상태 · 금액을 장부와 견주고, 요청 중인
취소가 있거나 성공한 취소액이 장부보다 크면 「취소 번호로 확정」을, 조회가 안 되면(열쇠 없음 · 실패 · 결과 불명 · 장부보다 작음)
「확인하지 못해 막았다」를 세운다 — 그때는 아래 「준비 취소를
손으로」. 화면을 닫아도 진행 중인 것은 남고, 주문을 다시 찾으면 그 판이 다시 선다. **산 사람이 탈퇴해도 진행 중인 확보는 남는다** —
주문 번호로 찾으면 「탈퇴한 계정의 주문」 판이 서고 같은 방법으로 확정 · 준비 취소한다(아래 「떠난 사람의 결제 기록」). 진행 중인 확보가
있는 동안 그 주문에는 SQL 환불(`refund_reading_order`)도 막힌다. 진행 중으로 오래 남은 것이 있는지는 아래로 본다(개인을 가리키지 않는다):

```bash
npm run db:remote -- --purpose "진행 중인 환불 수" \
  "select count(*), min(held_at) from public.reading_refund_hold where state = 'held'"
```

**준비 취소를 손으로**(화면이 PortOne 을 조회하지 못할 때만 — break-glass). 화면과 같은 규칙으로 본다 — **시각이 아니라 상태와
금액이다**(ADR 0184 결정 6).

1. PortOne 콘솔에서 그 결제(판의 결제 번호 `rdo_…`)의 취소 내역을 연다. **`요청`(REQUESTED) 등 성공 · 실패 밖의 취소가 하나라도 있으면
   풀지 않는다** — 언제 요청했든 돈이 나가는 중이다. 끝날 때까지 기다렸다가 다시 본다.
2. **성공한 취소액의 합**(콘솔의 「취소 금액」)을 아래 실행 전 확인의 `장부_환불액` 과 견준다. **정확히 같을 때만** 푼다. 크면 장부에
   안 적힌 취소가 있다 — 풀지 말고 그 취소 번호로 화면에서 확정한다. 작으면 장부가 PG 보다 많이 적었다 — 멈추고 조율자에게 올린다.
3. 같으면 break-glass 대장에 적고 아래 차례로 푼다 — 무엇을 확인했는지 · 누가 했는지가 사유다(10자 이상, 확보 줄의 `release_note` 에
   「by hand: 」를 붙여 남는다). 사유 · 실행자가 남는 이 함수만 쓴다 — 확보 줄을 `update` 로 고치지 않는다.

```sql
-- 실행 전 확인 — 대상 · 금액을 먼저 본다(회원은 계정 앞 8자만, 닉네임은 /ops/orders 의 판에서). 닫힌 확보면 0줄이다
select hold_id, provider_order_id, owner_ref, credits, amount, booked_refund, held_at, departed
from public.reading_refund_hold h
cross join lateral (select left(h.user_id::text, 8) as owner_ref, h.id as hold_id,
  coalesce((select o.refunded_amount from public.reading_order o where o.id = h.order_id),
           (select k.refunded_amount from retention.reading_payment k where k.order_id = h.order_id)) as booked_refund,
  not exists (select 1 from public.reading_order o where o.id = h.order_id) as departed) x
where h.id = '<hold-id>' and h.state = 'held';

begin;
select public.release_reading_refund_by_hand('<hold-id>', '<이름> PortOne 콘솔 <YYYY-MM-DD HH:MM> 확인 — 요청 중 없음, 성공 취소 합 <N>원 = 장부');
-- 결과 확인 — state = released · release_note 가 위 사유면 commit, 아니면 rollback
select state, closed_at, release_note from public.reading_refund_hold where id = '<hold-id>';
commit;
```

떠난 사람의 결제는 `booked_refund` 에 떠난 뒤의 환불 합(`retention.reading_refund_after_leave`)도 더해야 한다 — 화면의 판이 그 합을 쓴다.

화면이 못 하는 것 둘만 아래 SQL 차례로 한다 — **쓴 회차까지 돌려주는 경우**(생성 실패 · 계약과 다른 제공, `failure`)와 **금액이 산식과
다른 경우**(중복결제 일부 등). 이 길도 진행 중인 환불이 잠근 회차는 걷지 못한다. 정상 제공한 회차는 단순 변심으로 돌려주지 않는다.
SQL 차례의 금액은 사람이 넣는다 — 이 길로 `unused` 를 적으면 그 회차가 다음 화면 셈의 공제 회차에 들므로, 금액도 위 식(환불수수료를 공제한
누적)으로 셈해 넣는다. 공제가 없는 경우는 `unused` 로 적지 않는다.

**수동 환불 — SQL 차례(화면이 못 하는 것만).**

1. 요청을 받는다 — 주문 번호(`rdo_…`)나 PG 의 거래 번호로 주문을 가리키게 한다. 이메일로 주문을 찾지 않는다. 그 계정이 산 회차 ·
   쓴 회차는 `/ops/members` 에서 닉네임이나 계정 id 로 본다(ADR 0185)
2. **환불 셈의 입력을 읽는다** — `operator_reading_refund_basis(<주문 id>)` 가 그 계정의 주문 전부를 묶음별로 낸다(산 수 ·
   걷은 수 · 쓴 수 · 예약 중 수 · 안 쓴 수 · 결제 금액 · 환불한 금액 · 결제 시각). 운영자만 부르고 읽을 때마다 접속기록에
   남는다. 같은 값을 `/ops/orders` 가 보인다
3. **예약 중인 몫은 풀릴 때까지 기다린다** — 안 쓴 것이 아니다(G-21 ③). 무료 · 예외 · 몫 밖은 어떤 경우에도 돌려주지 않는다
4. **PG 콘솔에서 먼저 환불한다** — 돈이 나간 뒤에 적는다. 적은 뒤 PG 가 거절하면 장부가 거짓말을 한다
5. **사람이 적는다** — 주문 하나를 가리키는 쓰기라 break-glass 대장에 먼저 적고, `refund_reading_order` 를 서버 열쇠
   (`service_role`) 나 운영 SQL(`postgres`)로 부른다. 사유는 분류 하나(`withdrawal` 청약철회 · `unused` 안 쓴 몫 ·
   `duplicate` 중복결제 · `failure` 미제공 · `other`)이고 자유 글을 받지 않는다. 같은 PG 환불 번호로 두 번 불러도 한 번만 적힌다.
   안 쓴 것보다 많이 걷으려 하면 거절된다

**실행 전 확인** — 영향받는 주문 · 회원(계정 앞 8자) · 금액을 먼저 select 로 보고, 트랜잭션 안에서 부른 뒤 결과를 select 로 본다.
맞으면 commit, 아니면 rollback. 사유는 분류 하나로 남고 실행자는 break-glass 대장과 PG 환불 번호로 잇는다 — 이 함수는 실행자 칸이 없다.

```sql
-- 실행 전 확인 — 대상 주문 · 회원 · 금액 · 진행 중인 확보(있으면 이 환불은 거절된다)
select o.provider_order_id, left(o.user_id::text, 8) as owner_ref, o.status, o.amount, o.refunded_amount,
       b.credits, b.refunded_credits,
       exists (select 1 from public.reading_refund_hold h where h.order_id = o.id and h.state = 'held') as hold_open
from public.reading_order o join public.reading_bundle b on b.order_id = o.id
where o.id = '<order-id>';

begin;
-- break-glass 대장 번호를 목적에 — 금액(원) · 걷을 회차 · 사유 · PG 환불 번호
select public.refund_reading_order('<order-id>', <amount>, <credits>, 'unused', '<pg-refund-id>');
-- 결과 확인 — refunded_amount 가 <amount> 만큼, refunded_credits 가 <credits> 만큼 늘었으면 commit, 아니면 rollback
select o.status, o.refunded_amount, b.refunded_credits
from public.reading_order o join public.reading_bundle b on b.order_id = o.id
where o.id = '<order-id>';
commit;
```

6. 위 「주문 조회」의 상태별 집계로 `partially_refunded` · `refunded` 가 는 것을 본다

**떠난 사람의 결제 기록 — 5년, 앱은 못 읽는다**(G-25 ②). 떠날 때 `auth.users` 의 트리거가 승인된 적 있는 주문을
`retention.reading_payment` 로 옮긴다(묶음 · 쓰임 · 환불 · 알림은 jsonb). 승인된 적 없는 주문은 **거절한 알림이 있을 때만**
`retention.refused_reading_payment` 로 최소 칸(주문 번호 · 계정 내부 번호 · 제공자 · 가맹점 주문 번호 · 주문 금액 · 주문 시각 ·
거절 알림)만 옮긴다(`20261018090000`, ADR 0106 추기 — 법적 범위는 변호사 검토 B-8). 크론 `payment-retention-purge`(매일 04:53 UTC)의
`retention.purge_expired_payments()` 가 두 표에서 `keep_until`(앞은 마지막 승인 · 환불, 뒤는 마지막 거절 알림 + 5년)이 지난 줄을
함께 지운다. **탈퇴 뒤에 확정한 환불**(진행 중인 확보가 탈퇴를 넘어 남았던 것)은 고칠 수 없는 `retention.reading_payment` 대신
`retention.reading_refund_after_leave` 에 한 줄로 남고(확보 번호 · 주문 · 계정 내부 번호 · 가맹점 주문 번호 · 금액 · 회차 · 사유 · PG 취소
번호, ADR 0184), 같은 크론이 환불 + 5년 뒤 지운다. 탈퇴 뒤 닫힌 확보 줄도 그 크론이 걷는다. 분쟁이나 수사기관의 요청이 걸리면 보류를 건다 — 신고 기록의 보류(`docs/ops/runbook/erasure.md` 「떠난 사람의 신고 기록」)와 같은 모양이다.

```sql
-- 몇 줄 · 가장 이른 파기 예정 — 개인을 가리키지 않는다
select count(*), min(keep_until) from retention.reading_payment;
select count(*), min(keep_until) from retention.refused_reading_payment;
select count(*), min(keep_until) from retention.reading_refund_after_leave;

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
다시 보낸다. 까닭은 답에 안 싣고 Vercel 로그의 `portone webhook` 줄에 남는다 — 결제 이상이면 알림도 온다(아래 「결제 이상 알림」).

**켜는 날**(가맹 · 샌드박스 뒤, 사람) — ① Vercel **Production** 에 위 셋을 넣고 재배포 ② PortOne 콘솔 → 웹훅에 `https://<도메인>/api/portone/webhook`
을 넣는다(버전 V2) ③ 샌드박스 채널로 1회권 하나를 결제하고 묶음이 선 것을 본다 — 판매 스위치는 운영에서 켜지 않는다. 운영에서 밟을 때는 아래
「심사 계정」에 제 계정을 넣고 `/me/credits` 에서 결제한다 ④ 콘솔의 테스트
호출이 200 인지 본다. 판매를 여는 것은 `reading_sale_is_open()` 을 `true` 로 바꾸는 마이그레이션이다 — 결제 전 고지 · 철회
기준(G-25) · 탈퇴 판의 남은 수량(G-25 ⑦) · 환불 셈 화면이 먼저 선다. **샌드박스에서 볼 것** — 알림 본문과 결제 조회의 모양이
문서대로인가, 환불 번호를 주문 사이에 겹쳐 쓰는가(`20261015090000`), 거래 번호로 `transactionId` 와 `pgTxId` 중 무엇을 남길까.

#### 결제 이상 알림 — 알림이 오면 (G-110 ④)

결제 알림의 문이 **서명이 맞은 알림**에서 이상을 보면 장애 알림과 같은 주소(Vault `ops_alert_url`)로 한 줄이 온다 —
`report_payment_trouble`(`20261213090000`) → `notify_ops`, **결제 하나 · 갈래 하나에 하루 한 줄**이고 Production 에서만 보낸다. 알림의
`kind` 는 `payment-<갈래>:<결제 번호 rdo_…>`, 본문은 머리말 · 결제 번호 · 까닭(Vercel 로그의 `portone webhook` 줄과 같은 글)이다.
알림에는 사람이 없고, 아래 질의도 계정을 읽지 않는다 — 결제 번호 · 상태 · 금액 · 환불액 · 시각만이라 보통 질의다
(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」). 누가 낸 결제인지가 필요하면 PortOne 콘솔에서 본다.

**취소하기 전에 반드시 이 질의로 결제 번호를 세 자리에서 찾는다** — 지금 주문 → 보관된 승인 결제(`retention.reading_payment`) →
보관된 거절 결제(`retention.refused_reading_payment`). 떠난 사람의 주문은 지금 주문 표에 없어서 승인 문이 `no such order` 로 답한다 —
정상 결제로 풀이를 다 쓰고 떠난 뒤 PortOne 이 결제완료 알림을 다시 보내도 `payment-paid-without-bundle` 이 온다. 보관 표는 앱이 못
읽으므로(ADR 0106) 알림 쪽에서 가르지 못하고 여기서 사람이 가른다.

```bash
# 결제 번호(rdo_…)를 지금 주문 · 보관된 승인 결제 · 보관된 거절 결제에서 — 계정 칸은 안 읽는다
npm run db:remote -- --purpose "결제 이상 알림 <rdo_…>" \
  "select 'current' as found_in, o.status, o.amount, o.refunded_amount, o.provider_payment_id, o.created_at as ordered_at, o.approved_at, (select b.credits from public.reading_bundle b where b.order_id = o.id) as bundle_credits, (select json_agg(json_build_object('outcome', e.outcome, 'amount', e.amount, 'at', e.received_at) order by e.received_at) from public.payment_event e where e.order_id = o.id) as events from public.reading_order o where o.provider_order_id = '<rdo_…>' union all select 'retained', r.status, r.amount, r.refunded_amount, r.provider_payment_id, r.ordered_at, r.approved_at, r.bundle_credits, null from retention.reading_payment r where r.provider_order_id = '<rdo_…>' union all select 'refused-retained', null, f.amount, null, null, f.ordered_at, null, null, (select json_agg(json_build_object('outcome', x->>'outcome', 'amount', x->'amount', 'at', x->>'received_at')) from jsonb_array_elements(f.events) x) from retention.refused_reading_payment f where f.provider_order_id = '<rdo_…>'"
```

`found_in` 으로 가른다 — 갈래 이름은 G-112 의 대조 설계(`paid-retained` · `paid-refused-retained` · `paid-no-record`)와 같다.

| `found_in` | 갈래 | 하는 일 |
| --- | --- | --- |
| `current` | 지금 주문 | 아래 표의 갈래대로 |
| `retained` | `paid-retained` — 떠난 사람의 승인된 결제 | PortOne 콘솔의 그 결제와 **상태 · 금액(`amount`) · 취소액(`refunded_amount`)만** 견준다. 맞으면 **취소하지 않는다** — 정상 제공한 결제에 재전송이 남긴 알림이다. 끝. 어긋나면 취소하지 말고 사람이 본다(G-112 의 `retained-mismatch`) |
| `refused-retained` | `paid-refused-retained` — 떠난 사람의 승인 안 된 결제에 돈 | 바로 취소하지 않는다 — 거절 알림(`events` 의 `outcome` · `amount`)과 PortOne 콘솔의 결제를 견주고 사람이 정한다(이용자는 떠났다) |
| 줄 없음 | `paid-no-record` — 어느 장부에도 없다 | **그때만** PortOne 콘솔에서 결제 번호 · 시각 · 금액이 정말 `PAID` 인지 확인하고, 사람이 정한 뒤 PG 콘솔에서 취소한다 |

| 갈래(`kind`) | 무엇이 일어났나 | 하는 일 |
| --- | --- | --- |
| `payment-amount-mismatch` | PortOne 의 결제 금액이 주문 금액과 달라 승인 문이 거절했다(`payment_event.outcome = 'refused'`). 묶음은 없다 | ① PortOne 콘솔에서 그 결제의 금액 · 상태를 본다 ② 위 질의의 `amount` 와 견준다 ③ **받은 돈 전부를 PG 콘솔에서 취소한다** — 주문은 `pending` 그대로라 장부에 적을 환불이 없다 ④ 같은 일이 둘 이상이면 결제창이 금액을 어떻게 싣는지(`app/me/credits/`)부터 본다 |
| `payment-paid-without-bundle` | 돈은 들어왔는데 묶음을 세우지 않았고, 다시 와도 같다. 까닭으로 가른다 — `no such order`(떠난 사람의 주문 — 정상 결제의 재전송일 수 있다 · 우리 주문 아님) · `order already closed - refund by hand`(이미 승인된 주문에 다른 거래로 또 냄) · `event id belongs to another request` · `currency …` · `paid without transactionId` · `not a reading order`(우리 상점에 `rdo_` 가 아닌 결제 — 콘솔의 시험 결제 등) | ① **먼저 위 질의로 세 자리를 찾는다** — `retained` · `refused-retained` · 줄 없음이면 위 갈래 표대로 하고 여기서 끝(`no such order` 는 대개 이 셋이다) ② `current` 이고 이미 승인된 주문의 두 번째 결제(`order already closed …`)면 **두 번째 거래만** PG 콘솔에서 취소한다 — 첫 거래의 묶음은 그대로 ③ `current` 의 그 밖(`currency …` · `paid without transactionId` · `event id …`)은 PortOne 콘솔에서 결제가 정말 `PAID` 인지 본 뒤 받은 돈을 PG 콘솔에서 취소한다. 장부(`refund_reading_order`)는 승인된 주문의 환불만 받으므로 여기서는 적지 않는다 ④ `event id …` · `paid without transactionId` · `currency …` 는 PortOne 의 모양이 바뀐 신호다 — 둘 이상이면 `app/api/portone/webhook/` 을 고칠 일로 올린다 |
| `payment-webhook-failed` | 서명은 맞았는데 처리하지 못했다 — `payment lookup: …`(PortOne 에 못 닿음) · `approve: …`(DB 에 못 닿음 · 열쇠 없음 · 모르는 코드) · `payment not found at portone` · `unreadable body` · `paid notice without paymentId` | ① **503 갈래(`payment lookup` · `approve`)는 PortOne 이 다섯 번까지 다시 보낸다** — 한 시간 뒤 위 질의로 묶음이 섰는지 본다. 섰으면 끝 ② 안 섰으면 PortOne 콘솔 → 웹훅 내역에서 그 알림을 다시 보낸다(재발송 단추가 있는지는 켜는 날 샌드박스에서 본다) ③ 다시 보내도 안 서면 Vercel 로그의 `portone webhook` 줄로 까닭을 보고 고친 뒤 ② ④ `unreadable body` · `paid notice without paymentId` · `payment not found` 는 PortOne 의 모양 · 상점 설정이 어긋난 신호다 — 콘솔의 상점 아이디 · API 비밀이 Vercel 의 셋과 같은지 본다 |

**이 알림이 못 잡는 것.** 서명 앞의 실패(설정 셋이 빠짐 · 웹훅 비밀이 어긋남 → 503 · 401)는 아무나 일으킬 수 있어 알리지 않는다 —
PortOne 콘솔의 웹훅 내역에 실패가 쌓인다. DB 가 내려가 승인이 실패한 갈래는 이 알림도 같이 실패한다(Vercel 로그에만 남는다).
웹훅이 아예 안 온 결제는 우리 쪽에 흔적이 없다 — PortOne 콘솔의 결제 목록과 위 「주문 조회」의 승인 수를 견주는 것은 아직 손이다.

#### 심사 계정 — 카드사 심사 때만 결제창이 선다 (G-21, ADR 0171)

**판매는 닫힌 채다.** `reading_sale_reviewer` 에 든 계정만 `/me/credits` 에서 「결제하기」가 서고 주문이 열린다 — 다른 계정은 가격과 결제 전
고지만 보고 「풀이권 판매 준비 중이에요.」를 본다. 결제 단추는 Vercel **Production** 에 `PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY`(PortOne 콘솔 →
결제 연동 → 연동 정보의 상점 아이디 · 채널 키 — 비밀이 아니다)가 둘 다 있어야 선다. 결제가 끝나 묶음이 서는 것은 위 「결제 알림」의
웹훅이 하므로 그 셋도 함께 넣는다. 메뉴는 없다 — 심사 계정에게 `https://<도메인>/me/credits` 주소를 건넨다.

1. **계정을 만든다** — 심사 담당이 구글로 로그인하고 가입(테스트 코드 · 닉네임 · 안내 확인)을 마친다. 코드는 `docs/ops/runbook/signup.md` 「초대」대로 따로 낸다
2. **넣는다 — break-glass**(이메일로 계정을 찾는다, `docs/ops/runbook/access.md`). 대장에 먼저 적고 운영 SQL Editor 에서:

```sql
-- 메모에 누구 · 왜 · 언제를 — 걷을 때 이 메모로 찾는다
insert into public.reading_sale_reviewer (user_id, note)
select id, '<카드사> 심사 <YYYY-MM>' from auth.users where email = '<심사 계정 이메일>';
```

3. **본다** — 그 계정으로 `/me/credits` 에 「4,900원 결제하기」가 서는지, 다른 계정에는 안 서는지. 결제가 승인되면 결과 화면의 「결제 내역 보기」
   (`/me/credits/history`, ADR 0174)에 그 주문 번호(`rdo_…`) · 남은 회차가 서는지 — 환불을 신청하는 사람이 알려 주는 번호가 이것이다. 몇 계정이 들었는지는 개인을 안 가리킨다:

```bash
npm run db:remote -- --purpose "심사 계정 수" "select count(*), min(added_at) from public.reading_sale_reviewer"
```

4. **심사가 끝나면 걷는다** — 걷지 않으면 그 계정은 판매가 닫힌 동안에도 계속 산다. 심사 결제로 선 묶음은 PG 콘솔에서 돌려준 뒤 위
   「수동 환불」 차례로 적는다(사유 `other`)

```sql
delete from public.reading_sale_reviewer where note = '<카드사> 심사 <YYYY-MM>';
```
