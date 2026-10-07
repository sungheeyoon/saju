import { describe, expect, it } from 'vitest';

import { SERVICE_NAME, SERVICE_NAME_OBJECT, SERVICE_NAME_TOPIC } from '.';
import { BUSINESS_INFO, businessInfoLines, type BusinessInfo } from './business';

/** 마지막 음절에 받침이 있는가 — `src/lib/saju/text/batchim.ts` 와 같은 셈이다. brand 는 saju 를 부르지 않는다(lib 방향) */
const endsWithBatchim = (word: string) => {
  const last = word.charCodeAt(word.length - 1) - 0xac00;
  return last >= 0 && last <= 11171 && last % 28 !== 0;
};

describe('서비스 이름', () => {
  it('조사가 이름의 받침을 따른다', () => {
    const batchim = endsWithBatchim(SERVICE_NAME);
    expect(SERVICE_NAME_TOPIC).toBe(`${SERVICE_NAME}${batchim ? '은' : '는'}`);
    expect(SERVICE_NAME_OBJECT).toBe(`${SERVICE_NAME}${batchim ? '을' : '를'}`);
  });
});

/**
 * 자리표시가 화면에 나가면 거짓 표시다 — 값을 모르면 `null` 로 두고 줄째 뺀다.
 * 「신고 준비 중」은 운영자가 정한 값이라 자리표시가 아니다.
 */
const PLACEHOLDER = /TODO|TBD|FIXME|XXX|x{3}|0{3}-0{2}|123-45|홍길동|example|\?\?|미정|입력|채워|placeholder|\[|\]|\{|\}/i;

describe('사업자 정보', () => {
  it('지금 값에 자리표시가 없다', () => {
    for (const line of businessInfoLines()) expect(line.value).not.toMatch(PLACEHOLDER);
  });

  it('값이 있으면 제 꼴이다 — 지어낸 꼴의 값을 막는다', () => {
    const { registrationNumber, email } = BUSINESS_INFO;
    if (registrationNumber !== null) expect(registrationNumber).toMatch(/^\d{3}-\d{2}-\d{5}$/);
    if (email !== null) expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('비어 있는 값은 줄째 빠지고, 남은 줄은 정한 차례다', () => {
    const info: BusinessInfo = {
      tradeName: '상호값',
      representative: null,
      registrationNumber: '  ',
      address: '주소값',
      email: null,
      phone: null,
      mailOrderNumber: '신고 준비 중',
    };
    expect(businessInfoLines(info)).toEqual([
      { label: '상호', value: '상호값' },
      { label: '주소', value: '주소값' },
      { label: '통신판매업 신고번호', value: '신고 준비 중' },
    ]);
  });
});
