import { SUPPORT_EMAIL } from '@/src/lib/brand';
import { type BusinessInfo, businessInfoFrom } from '@/src/lib/brand/business';

/**
 * **사업자 정보를 환경변수에서 읽는 자리는 여기 하나다**(운영자 결정 2026-10-12, ADR 0172).
 *
 * 값은 저장소에 적지 않는다 — 저장소가 공개이고 사업장 주소가 아직 운영자의 집이다(ADR 0151 「정한 것」 2). 비밀이 아니라
 * 설정이라 `scripts/secret-env.mjs` 의 `CONFIG_ENV` 에 선다. `NEXT_PUBLIC_` 이 아니므로 서버에서만 읽힌다 — 바닥글(클라이언트)은
 * 뿌리 레이아웃이 읽어 넘긴 줄만 받는다. 미리 그리는 화면은 빌드 때의 값을 든다 — 값을 바꾸면 다시 배포한다.
 *
 * **이메일만은 환경변수가 아니다** — 모든 화면에 공개되는 고객 문의 주소라 `SUPPORT_EMAIL`(`src/lib/brand`) 상수를 읽는다
 * (운영자 지시 2026-10-16, ADR 0172 덧). 나머지 여덟은 그대로 환경변수다.
 *
 * 비었거나 꼴이 틀린 값은 `businessInfoFrom` 이 `null` 로 고르고, 그 줄은 화면에 안 선다.
 */
export function currentBusinessInfo(): BusinessInfo {
  return businessInfoFrom({
    tradeName: process.env.BUSINESS_TRADE_NAME,
    representative: process.env.BUSINESS_REPRESENTATIVE,
    registrationNumber: process.env.BUSINESS_REGISTRATION_NUMBER,
    address: process.env.BUSINESS_ADDRESS,
    phone: process.env.BUSINESS_PHONE,
    email: SUPPORT_EMAIL,
    mailOrderNumber: process.env.BUSINESS_MAIL_ORDER_NUMBER,
    hostingProvider: process.env.BUSINESS_HOSTING_PROVIDER,
    disclosureUrl: process.env.BUSINESS_DISCLOSURE_URL,
  });
}
