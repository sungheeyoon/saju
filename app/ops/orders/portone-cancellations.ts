import 'server-only';

import {
  portoneLookupConfigOf,
  portonePaymentBody,
  type PortoneLookupConfig,
} from '../../api/portone/webhook/payment';
import { releaseCheckOf, type ReleaseCheck } from './release-check';

type Deps = {
  readonly config: PortoneLookupConfig | null;
  readonly fetchImpl: typeof fetch;
};

const fromEnv = (): Deps => ({
  config: portoneLookupConfigOf({
    PORTONE_API_SECRET: process.env.PORTONE_API_SECRET,
    PORTONE_STORE_ID: process.env.PORTONE_STORE_ID,
  }),
  fetchImpl: fetch,
});

/**
 * 결제 하나(가맹점 주문 번호 = PortOne 결제 번호)의 취소 상태 · 금액을 PortOne 에 묻고 장부의 환불액과 견준다 — 웹훅과 같은
 * 단건 조회다. 열쇠가 없거나 조회가 실패하면 「알 수 없음」이다 — 준비 취소는 막힌다(ADR 0184).
 *
 * @param bookedRefund 장부에 적힌 그 주문의 환불액(원) — `operator_reading_refund_hold` 가 낸다
 */
export async function cancellationCheck(
  paymentId: string,
  bookedRefund: number,
  deps: Deps = fromEnv(),
): Promise<ReleaseCheck> {
  if (deps.config === null) return { kind: 'unknown', why: 'portone lookup keys are not set' };
  try {
    return releaseCheckOf(await portonePaymentBody(paymentId, deps.config, deps.fetchImpl), bookedRefund);
  } catch (thrown) {
    return { kind: 'unknown', why: `lookup failed: ${String(thrown)}` };
  }
}
