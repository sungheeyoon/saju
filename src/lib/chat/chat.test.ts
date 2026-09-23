import { describe, expect, it } from 'vitest';

import {
  CHAT_POLICY,
  CLOSED_REASONS,
  checkBody,
  closedReasonOf,
  closedRoomText,
  messageTimeLabel,
  roomTitleOf,
  sendOutcomeOf,
} from '.';

describe('닫힌 방의 이유 셋은 저마다 다른 말을 한다', () => {
  it('세 이유가 세 문장이고 서로 다르다 — 이유가 말을 정한다(PRD §7.1)', () => {
    const texts = CLOSED_REASONS.map(closedRoomText);
    expect(new Set(texts).size).toBe(3);
    for (const text of texts) expect(text.endsWith('.')).toBe(true);
  });

  it('차단은 「상대」를 말하지 않는다 — 누가 차단했는지 화면이 말하지 않는다', () => {
    expect(closedRoomText('block')).not.toContain('상대');
    expect(closedRoomText('suspension')).toContain('상대');
    expect(closedRoomText('deletion_request')).toContain('상대');
  });

  it('모르는 이유는 그리지 않는다', () => {
    expect(closedReasonOf('block')).toBe('block');
    expect(closedReasonOf('left')).toBeNull();
    expect(closedReasonOf(null)).toBeNull();
  });
});

describe('보내기 전에 앱이 막는 둘', () => {
  it('빈 본문과 공백만 있는 본문은 blank 다', () => {
    expect(checkBody('')).toBe('blank');
    expect(checkBody('   \n')).toBe('blank');
  });

  it('한도까지는 되고 한 글자 넘으면 too_long 이다 — 수는 DB 의 사본이다', () => {
    expect(checkBody('가'.repeat(CHAT_POLICY.maxLength))).toBe('ok');
    expect(checkBody('가'.repeat(CHAT_POLICY.maxLength + 1))).toBe('too_long');
  });

  it('보내는 값 셋만 안다 — 던지는 것은 문이 옮긴다', () => {
    expect(sendOutcomeOf('sent')).toBe('sent');
    expect(sendOutcomeOf('rate_limited')).toBe('rate_limited');
    expect(sendOutcomeOf('ok')).toBeNull();
  });
});

describe('화면의 글자', () => {
  it('방 제목은 닉네임 뒤에 「님」', () => {
    expect(roomTitleOf('지영')).toBe('지영 님');
  });

  /** 기계의 시간대가 무엇이든 한국 시각이다 — CI 와 Vercel 은 UTC 다 */
  it('오늘은 시각, 다른 날은 날짜 — 한국 시간대로', () => {
    const now = new Date('2026-09-23T15:24:00+09:00');
    expect(messageTimeLabel('2026-09-23T06:24:00Z', now)).toBe('오후 3:24');
    expect(messageTimeLabel('2026-09-01T06:24:00Z', now)).toBe('2026년 9월 1일');
    // UTC 로는 22일 밤이지만 한국으로는 23일 새벽 — 「오늘」이다
    expect(messageTimeLabel('2026-09-22T16:30:00Z', now)).toBe('오전 1:30');
  });
});
