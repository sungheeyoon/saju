import { describe, expect, it } from 'vitest';

import { REQUEST_STATUSES, REQUEST_STATUS_TEXT } from '@/src/lib/consent';

import { cancelledNote } from './cancel-answer';

describe('보낸 요청을 취소한 뒤의 한 줄', () => {
  it('취소됐으면 「보낸 요청을 취소했어요.」', () => {
    expect(cancelledNote('cancelled')).toBe('보낸 요청을 취소했어요.');
  });

  it('그 사이 다른 끝이 났으면 취소했다고 하지 않고 그 끝을 말한다', () => {
    for (const status of REQUEST_STATUSES) {
      if (status === 'cancelled' || status === 'pending') continue;
      expect(cancelledNote(status)).toBe(REQUEST_STATUS_TEXT[status].sent);
      expect(cancelledNote(status)).not.toContain('취소했');
    }
  });

  it('아직 기다리는 중이면 아무 말도 안 한다', () => {
    expect(cancelledNote('pending')).toBeNull();
  });
});
