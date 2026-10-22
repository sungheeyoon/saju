# PG 는 포트원을 거치지 않고 PG사와 직접 계약한다

> 후속 결정: ADR 0194(운영자 결정 2026-10-22) — 이 결정을 통째로 거뒀다. PG 와 연동 방식은 다시 미정이고 PortOne 경유 · KG파이낸셜 · KPN 셋 다 후보다. 아래 본문은 2026-10-20 의 기록으로 둔다
>
> **운영자 결정 2026-10-20**(조율자 세션에서 전함, 원문 「포트원으로안하고직접제출할거야 명심해」) — PG 는 포트원(PortOne)을 거치지
> 않는다. 운영자가 PG사에 직접 신청하고 계약한다. 문의 차례는 그대로 **KG파이낸셜 → KPN** 이다 — 토스페이먼츠는 사주 업종을 받지
> 않는다(운영자 확인, 2026-10-16).
>
> 이 결정이 닫는 것 — G-21 이 미정으로 둔 「PG 와 연동 방식(PortOne 경유 · 직접)」 가운데 **연동 방식**이다. 어느 PG 와 맺는지는 아직
> 정하지 않았다(심사 결과에 달렸다).

## 정한 것

| 물음 | 답 |
| --- | --- |
| 연동 층 | 없다 — 포트원 같은 연동 대행사를 두지 않는다. 결제창 · 결과 통지 · 취소는 계약한 PG사의 규격으로 직접 짓는다 |
| 누가 신청하나 | 운영자가 PG사에 직접 낸다. 계약 상대는 PG사 그대로다(G-21 기록 「PG 조사」 ①). 수수료 · 가입비는 문의 거리다 — 포트원 묶음 상품의 가입비 지원은 빠질 수 있다 |
| PG 차례 | KG파이낸셜 → KPN(2026-10-16 그대로). 둘 다 PortOne 가이드의 조건부 수용 목록에 있다 — 직접 계약에서도 그런지는 문의로 확인한다 |
| 코드 | **이번에는 바꾸지 않는다.** 계약한 PG사의 직접 연동 규격(결제창 · 웹훅이나 결과 통지 · 취소 API)을 받은 뒤 다시 짓는다 |
| 본인확인(G-20) | 이 결정의 밖이다 — 본인확인의 연동 경로는 G-20 이 따로 정한다 |

## 까닭

운영자의 결정이다. 포트원은 PG 가 아니라 연동 층이라(G-21 기록 「PG 조사」 ①) 거치지 않아도 계약 상대는 같다. 거치지 않으면 연동 층의
요금 · 콘솔 · 계정이 하나 줄고, 처리방침의 받는 곳 표에서 연동 대행사 줄의 결제 몫이 빠진다(본인확인 후보 PortOne 줄은 남는다, `docs/legal/privacy-v8-draft.md`). 대신 PG사마다 다른 연동 규격을 우리가 직접
따른다.

## 치르는 값 — 지금 결제 연동은 PortOne V2 전제다

2026-10-20 에 `grep -ri portone` 으로 잰 자리다. 계약한 PG사의 규격을 받은 뒤 이 목록을 다시 짓고, 그때 런북 · 시험 · 이 표를 함께 고친다.

| 자리 | PortOne 에 기댄 것 |
| --- | --- |
| `app/me/credits/portone-sdk.ts` · `checkout.tsx` · `payment.ts` · `page.tsx` · `actions.ts` | 결제창 — PortOne 브라우저 SDK V2(`cdn.portone.io`) · 상점 번호 · 채널 키(ADR 0171), 주문의 제공자 이름 `portone` |
| `app/me/credits/done/*` | 결제창이 돌려보내는 주소의 모양(`paymentReturnOf`) · PortOne 웹훅의 재전송 간격에 맞춘 기다림 |
| `app/api/portone/webhook/*` | 결과 통지 — Standard Webhooks 서명 · `Transaction.Paid` · 결제 단건 조회(`GET https://api.portone.io/payments/{paymentId}`) · 결제 이상 알림의 까닭(G-23 ⑥) |
| `app/ops/orders/portone-cancellations.ts` · `actions.ts` · `release-check.ts` | 환불의 준비 취소 — PortOne 결제 조회로 취소 상태 · 금액을 장부와 견준다(ADR 0184) |
| `app/keyed-client.ts` · `eslint.config.mjs` · `docs/architecture.md` | 서버 열쇠를 부르는 파일 목록의 웹훅 경로 |
| `next.config.ts` | `/me/credits/**` 에서만 `https:` 를 연 CSP — 좁힐 출처를 PortOne 기준으로 적어 두었다(G-23 ②) |
| `scripts/secret-env.mjs` | `PORTONE_WEBHOOK_SECRET` · `PORTONE_API_SECRET` · `PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY` |
| 런북 | `docs/ops/runbook/credits.md` 「결제 알림」 · 「심사 계정」 · 환불의 「PortOne 콘솔」 걸음, `secret-leak.md` 의 PG 키 두 줄, `domain.md` 의 웹훅 주소 줄 |

**PG 에 중립인 것은 그대로 쓴다** — 장부의 표 다섯(ADR 0106)은 제공자를 `provider` 이름으로만 들고(`portone` 은 값이다), 심사 계정
(ADR 0171) · 환불 세 걸음의 확보 · 확정(ADR 0184) · 결제 이상 알림의 DB 문은 PG 를 모른다. 바뀌는 것은 결제창 · 통지 · 취소 조회의
바깥 쪽이다.

그동안 지금 코드는 그대로 서 있다 — 결제창 값(`PORTONE_STORE_ID` · `PORTONE_CHANNEL_KEY`)이 없는 배포에서는 심사 계정에게도
「결제하기」가 안 서고(「풀이권 판매 준비 중이에요.」), 켜는 값이 없는 웹훅은 503 이다. **운영자는 포트원 가입 · 채널 키 · 포트원 콘솔
걸음을 밟지 않는다** — 그 값을 넣을 일이 없다.

## 앞선 결정과의 관계

- ADR 0171 — 심사 계정만 결제창을 여는 결정은 그대로다. 「PortOne 경유를 전제로」 · PortOne SDK 를 스크립트로 싣는다(결정 6)는 PG사
  규격을 받은 뒤 다시 짓는다.
- ADR 0184 — 확보 → 취소 → 확정 세 걸음은 그대로다. 「PortOne 콘솔에서 취소」는 「PG사 관리자 화면에서 취소」로, 준비 취소의 PortOne
  조회는 그 PG사의 조회로 다시 짓는다.
- G-112(보류)의 PortOne 조사는 이 결정으로 그대로 쓰이지 않는다 — 다시 꺼낼 때 그 PG사의 조회 규격으로 다시 잰다.
