/**
 * **사업자 정보 — 바닥글과 이용약관 · 환불정책이 같은 값 한 벌을 읽는다**(운영자 결정 2026-10-12, ADR 0172).
 *
 * 전자상거래법 제10조의 사이버몰 표시와 PG(포트원 필수 구축요건) 심사가 결제 페이지까지 상시 보는 줄이다. **값은 저장소에 적지
 * 않는다** — 저장소가 공개이고 사업장 주소가 아직 운영자의 집이다(ADR 0151 「정한 것」 2). 값은 배포의 환경변수에서 온다
 * (`app/business-info.ts` 가 이름으로 읽어 여기로 넘긴다). 이메일만은 `SUPPORT_EMAIL` 상수다(ADR 0172 덧, 2026-10-16). 이 모듈은 환경을 모른다 — 받은 값을 고르고 줄로 짓기만 한다.
 *
 * **빈 값은 줄째 안 선다.** 「000-00-00000」 · 「홍길동」 · 「［기입］」 같은 자리표시나 꼴이 틀린 사업자등록번호 · 전화 · 이메일 · 공개 페이지 주소(https 가 아닌 것)도 빈 값으로
 * 본다 — 화면에 나가면 거짓 표시다.
 */
export type BusinessInfo = {
  /** 상호 */
  readonly tradeName: string | null;
  /** 대표자 성명 */
  readonly representative: string | null;
  /** 사업자등록번호 — `123-45-67890` 꼴 */
  readonly registrationNumber: string | null;
  /** 사업장 주소 */
  readonly address: string | null;
  /** 전화번호 — 휴대폰 번호를 받지 않는 PG 가 있다(070 예정, G-21 기록 ⑤) */
  readonly phone: string | null;
  /** 전자우편 주소 — 문의 · 환불 신청을 받는 곳 */
  readonly email: string | null;
  /** 통신판매업 신고번호 */
  readonly mailOrderNumber: string | null;
  /** 호스팅서비스를 제공하는 자의 상호 */
  readonly hostingProvider: string | null;
  /** 공정거래위원회 사업자정보 공개 페이지 — 사업자등록번호로 가는 주소(https) */
  readonly disclosureUrl: string | null;
};

export type BusinessKey = keyof BusinessInfo;

/** 환경에서 받은 날 값 — 이름으로 읽는 자리는 `app/business-info.ts` 하나다 */
export type RawBusinessInfo = { readonly [K in BusinessKey]?: string | undefined };

const PLACEHOLDER = /［|\[|기입|TODO|TBD|홍길동|^0{3}-0{2}-0{5}$|^x+$/i;

const VALID: Partial<Record<BusinessKey, RegExp>> = {
  registrationNumber: /^\d{3}-\d{2}-\d{5}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[0-9][0-9-]{7,}$/,
  disclosureUrl: /^https:\/\/\S+$/,
};

const KEYS: readonly BusinessKey[] = [
  'tradeName',
  'representative',
  'registrationNumber',
  'address',
  'phone',
  'email',
  'mailOrderNumber',
  'hostingProvider',
  'disclosureUrl',
];

/** 날 값을 고른다 — 비었거나 자리표시이거나 꼴이 틀리면 `null` */
export function businessInfoFrom(raw: RawBusinessInfo): BusinessInfo {
  const pick = (key: BusinessKey) => {
    const value = raw[key]?.trim();
    if (!value || PLACEHOLDER.test(value)) return null;
    const shape = VALID[key];
    return shape && !shape.test(value) ? null : value;
  };
  return Object.fromEntries(KEYS.map((key) => [key, pick(key)])) as BusinessInfo;
}

export type BusinessInfoLine = {
  readonly key: BusinessKey;
  readonly label: string;
  readonly value: string;
};

/**
 * 줄의 차례와 이름 — 바닥글 · 약관 제3조 · 환불정책 「판매자 정보」가 같은 이름을 쓴다. 공개 페이지 주소는 줄이 아니라
 * 사업자등록번호 곁의 링크라 여기 없다(`BUSINESS_DISCLOSURE_LINK`).
 */
const LABELS: readonly (readonly [Exclude<BusinessKey, 'disclosureUrl'>, string])[] = [
  ['tradeName', '상호'],
  ['representative', '대표자'],
  ['registrationNumber', '사업자등록번호'],
  ['address', '사업장 주소'],
  ['phone', '대표전화'],
  ['email', '이메일'],
  ['mailOrderNumber', '통신판매업 신고번호'],
  ['hostingProvider', '호스팅서비스 제공자'],
];

/** 사업자등록번호 곁에 서는 공정위 공개 페이지 링크의 글자 */
export const BUSINESS_DISCLOSURE_LINK = '사업자 정보 확인';

/** 값이 있는 줄만, 정한 차례로 */
export function businessInfoLines(info: BusinessInfo): readonly BusinessInfoLine[] {
  return LABELS.flatMap(([key, label]) => {
    const value = info[key];
    return value ? [{ key, label, value }] : [];
  });
}

/**
 * 약관 · 환불정책이 「여기로 알려 주세요」라고 적는 자리 — 이메일이 있으면 그 주소, 없고 전화만 있으면 `toPhone`(「제3조의 연락처」처럼
 * 같은 글 안의 사업자 정보를 가리키는 말), 둘 다 없으면 초안이 빈칸 없이 쓴 말 「이메일」. 「［고객 문의 이메일 — 기입］」 같은
 * 빈칸 표지를 화면에 내지 않는다.
 */
export function contactPlace(info: BusinessInfo, toPhone: string): string {
  if (info.email) return `이메일(${info.email})`;
  return info.phone ? toPhone : '이메일';
}
