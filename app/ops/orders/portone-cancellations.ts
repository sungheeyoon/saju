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
 * 결제 하나(가맹점 주문 번호 = PortOne 결제 번호)에 확보 뒤의 취소가 있는지 PortOne 에 묻는다 — 웹훅과 같은 단건 조회다.
 * 열쇠가 없거나 조회가 실패하면 「알 수 없음」이다 — 준비 취소는 막힌다(ADR 0184).
 */
export async function cancellationCheck(paymentId: string, heldAt: Date, deps: Deps = fromEnv()): Promise<ReleaseCheck> {
  if (deps.config === null) return { kind: 'unknown', why: 'portone lookup keys are not set' };
  try {
    return releaseCheckOf(await portonePaymentBody(paymentId, deps.config, deps.fetchImpl), heldAt);
  } catch (thrown) {
    return { kind: 'unknown', why: `lookup failed: ${String(thrown)}` };
  }
}
