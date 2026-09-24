import { describe, expect, it } from 'vitest';

import {
  SUPPORT_EMAIL,
  WARNING_ACKNOWLEDGE_LABEL,
  WARNING_NOTICE_TITLE,
  warningDateLabel,
  warningNoticeLines,
  warningRefOf,
} from '.';

const notice = { ref: 'W-7K3F', category: 'harassment', warnedOn: '2026-09-24' };

describe('경고 안내 — 표 승인 그대로의 줄 넷', () => {
  it('제목 · 확인 버튼', () => {
    expect(WARNING_NOTICE_TITLE).toBe('운영정책 위반으로 경고를 받았습니다');
    expect(WARNING_ACKNOWLEDGE_LABEL).toBe('확인했습니다');
  });

  it('갈래 · 날짜 · 둘째 줄 · 이의 제기 · 안내번호가 차례대로 선다', () => {
    expect(warningNoticeLines(notice, 'help@example.com')).toEqual([
      '2026년 9월 24일에 괴롭힘이나 위협에 해당하는 이용이 확인되어 경고를 드립니다.',
      '같은 일이 반복되면 이용이 제한될 수 있습니다.',
      '이 경고에 이의가 있으면 help@example.com로 알려 주세요. 3영업일 안에 답을 드립니다.',
      '문의하실 때 안내번호 W-7K3F를 함께 적어 주세요.',
    ]);
  });

  it.each([
    ['impersonation', '사칭이나 거짓 정보에 해당하는'],
    ['inappropriate', '부적절한 내용에 해당하는'],
    ['other', '운영정책에 어긋나는'],
    ['모르는 값', '운영정책에 어긋나는'],
  ])('갈래 %s 는 「%s 이용」으로 말한다', (category, phrase) => {
    expect(warningNoticeLines({ ...notice, category })[0]).toBe(
      `2026년 9월 24일에 ${phrase} 이용이 확인되어 경고를 드립니다.`,
    );
  });

  it('고객 문의 이메일을 안 주면 서버 상수를 쓴다', () => {
    expect(warningNoticeLines(notice)[2]).toContain(SUPPORT_EMAIL);
  });

  it('경고 횟수 · 판단 근거 · 신고를 말하는 줄이 없다', () => {
    expect(warningNoticeLines(notice).join(' ')).not.toMatch(/번째|회째|근거|신고/);
  });

  it('날짜는 문이 준 한국 날짜 그대로다 — 자정 언저리에 밀리지 않는다', () => {
    expect(warningDateLabel('2026-01-01')).toBe('2026년 1월 1일');
    expect(warningDateLabel('2026-12-31')).toBe('2026년 12월 31일');
  });
});

describe('안내번호 — 운영자가 친 모양을 받는다', () => {
  it.each([
    ['W-7K3F', 'W-7K3F'],
    [' w-7k3f ', 'W-7K3F'],
    ['w7k3f', 'W-7K3F'],
    ['7K3F', 'W-7K3F'],
    ['W 7K3F', 'W-7K3F'],
  ])('%s → %s', (typed, ref) => {
    expect(warningRefOf(typed)).toBe(ref);
  });

  it.each(['', 'W-', 'W-7K3', 'W-7K3FF', 'W-0OIL', 'W-7K3U', '가나다라'])('%s 는 안내번호가 아니다', (typed) => {
    expect(warningRefOf(typed)).toBeNull();
  });
});
