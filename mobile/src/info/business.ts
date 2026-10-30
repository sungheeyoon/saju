import { SUPPORT_EMAIL } from '@brand';
import { businessInfoFrom, type BusinessInfo } from '@brand/business';

/**
 * 사업자 정보 — 웹의 `app/business-info.ts` 와 같은 값 한 벌이고 앱은 빌드에 실린 공개 값으로 받는다. 웹처럼 비면 그 줄이 안 선다.
 * `process.env.EXPO_PUBLIC_*` 는 빌드 때 글자 그대로 갈아 끼워지므로 이름을 하나씩 적는다.
 */
export function appBusinessInfo(): BusinessInfo {
  return businessInfoFrom({
    tradeName: process.env.EXPO_PUBLIC_BUSINESS_TRADE_NAME,
    representative: process.env.EXPO_PUBLIC_BUSINESS_REPRESENTATIVE,
    registrationNumber: process.env.EXPO_PUBLIC_BUSINESS_REGISTRATION_NUMBER,
    address: process.env.EXPO_PUBLIC_BUSINESS_ADDRESS,
    phone: process.env.EXPO_PUBLIC_BUSINESS_PHONE,
    email: SUPPORT_EMAIL,
    mailOrderNumber: process.env.EXPO_PUBLIC_BUSINESS_MAIL_ORDER_NUMBER,
    hostingProvider: process.env.EXPO_PUBLIC_BUSINESS_HOSTING_PROVIDER,
    disclosureUrl: process.env.EXPO_PUBLIC_BUSINESS_DISCLOSURE_URL,
  });
}
