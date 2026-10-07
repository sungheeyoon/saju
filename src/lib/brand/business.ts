/**
 * **사업자 정보 — 바닥글이 드는 값은 여기 한 곳이다**(운영자 결정 2026-10-07, ADR 0149).
 *
 * 전자상거래법의 표시 의무와 PG 심사가 보는 줄이다 — 상호 · 대표자 · 사업자등록번호 · 사업장 주소 · 연락처 · 통신판매업
 * 신고번호. 바닥글(`app/site-footer.tsx`)은 `businessInfoLines` 가 준 줄만 그린다. 같은 값을 약관 · 처리방침의 빈칸도
 * 기다린다(`docs/legal/README.md` 「비어 있는 것」) — 그쪽은 고지한 판의 글자라 이 상수를 읽지 않는다.
 *
 * **모르는 값은 `null` 이다 — 지어 넣지 않는다.** `null` 인 줄은 바닥글에서 통째로 빠진다. 「000-00-00000」 · 「홍길동」 같은
 * 자리표시가 화면에 나가면 거짓 표시가 되므로, 옆 시험이 자리표시 꼴의 값을 붉힌다. 운영자가 값을 받으면 `null` 을 그 값으로
 * 바꾸는 것이 전부다.
 */
export type BusinessInfo = {
  /** 상호 */
  readonly tradeName: string | null;
  /** 대표자 이름 */
  readonly representative: string | null;
  /** 사업자등록번호 — `123-45-67890` 꼴 */
  readonly registrationNumber: string | null;
  /** 사업장 주소 */
  readonly address: string | null;
  /** 문의 이메일 */
  readonly email: string | null;
  /** 전화번호 — 전자상거래법의 표시 항목이다. 운영자가 정하면 넣는다 */
  readonly phone: string | null;
  /** 통신판매업 신고번호 — 신고 전에는 「신고 준비 중」(운영자 2026-10-07) */
  readonly mailOrderNumber: string | null;
};

export const BUSINESS_INFO: BusinessInfo = {
  tradeName: '갑자기탐구생활',
  representative: null,
  registrationNumber: null,
  address: '인천광역시 부평구 부개로 11, 505동 1601호',
  email: null,
  phone: null,
  mailOrderNumber: '신고 준비 중',
};

export type BusinessInfoLine = {
  readonly label: string;
  readonly value: string;
};

/** 바닥글에 서는 차례와 이름 — 법이 부르는 이름을 그대로 쓴다 */
const LABELS: readonly (readonly [keyof BusinessInfo, string])[] = [
  ['tradeName', '상호'],
  ['representative', '대표자'],
  ['registrationNumber', '사업자등록번호'],
  ['address', '주소'],
  ['email', '이메일'],
  ['phone', '전화'],
  ['mailOrderNumber', '통신판매업 신고번호'],
];

/** 값이 있는 줄만, 정한 차례로 — 비었거나 공백뿐인 값은 줄째 빠진다 */
export function businessInfoLines(info: BusinessInfo = BUSINESS_INFO): readonly BusinessInfoLine[] {
  return LABELS.flatMap(([key, label]) => {
    const value = info[key]?.trim();
    return value ? [{ label, value }] : [];
  });
}
