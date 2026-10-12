/**
 * **PortOne 브라우저 SDK V2 를 부르는 자리** (G-21, ADR 0171).
 *
 * 패키지(`@portone/browser-sdk`)를 들이지 않고 SDK 가 내는 스크립트를 결제 단추를 누른 때 한 번 싣는다 — 그 패키지도 안에서 같은
 * 스크립트를 내려받고, 운영 의존성이 하나 늘면 `audit` 차선이 그것까지 잰다(ADR 0104). 스크립트가 PG 의 결제 모듈을 다시 부르므로
 * 이 화면의 CSP 는 따로 넓혔다(`next.config.ts` 의 `checkoutPolicy`).
 *
 * 여기 적은 타입은 이 화면이 쓰는 칸뿐이다. 응답의 `code` 가 있으면 실패(사용자의 취소 포함)이고, 폰에서는 함수가 답하지 않고
 * 페이지가 `redirectUrl` 로 옮긴다.
 */

export const PORTONE_SDK_URL = 'https://cdn.portone.io/v2/browser-sdk.js';

export type PaymentRequest = {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: 'CURRENCY_KRW';
  payMethod: 'CARD';
  redirectUrl: string;
};

export type PaymentResponse = { code?: string; message?: string; paymentId?: string } | undefined;

type PortOne = { requestPayment: (request: PaymentRequest) => Promise<PaymentResponse> };

/** SDK 가 스크립트를 실으면 전역에 `PortOne` 을 둔다 */
const sdk = (): PortOne | undefined => {
  const global: unknown = Reflect.get(window, 'PortOne');
  return typeof global === 'object' && global !== null && 'requestPayment' in global ? (global as PortOne) : undefined;
};

let loading: Promise<PortOne> | null = null;

/** 스크립트를 한 번만 싣는다. 못 실으면 다음 누름이 다시 싣는다 */
export function loadPortOne(): Promise<PortOne> {
  const ready = sdk();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<PortOne>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PORTONE_SDK_URL;
    script.async = true;
    script.onload = () => {
      const loaded = sdk();
      if (loaded) resolve(loaded);
      else reject(new Error('portone sdk: no global'));
    };
    script.onerror = () => reject(new Error('portone sdk: not loaded'));
    document.head.appendChild(script);
  }).catch((thrown: unknown) => {
    loading = null;
    throw thrown;
  });
  return loading;
}
