import { describe, expect, it } from 'vitest';

import { answerCount, bellCount, NOTIFICATION_KINDS } from './index';

/**
 * 요청 하나가 **한 딱지만** 켠다(ADR 0129) — 종은 지나간 일, 인연 탭은 답할 일.
 */
describe('머리글의 두 딱지', () => {
  it('요청이 왔다는 소식은 종이 안 세고, 그 요청은 인연 탭이 센다', () => {
    const notifications = [{ kind: 'request_received', unread: true }];
    const requests = [{ direction: 'received', status: 'pending' }];

    expect(bellCount(notifications)).toBe(0);
    expect(answerCount(requests)).toBe(1);
  });

  it('답이 난 뒤의 소식과 풀이 소식은 종이 센다 — 읽은 것은 안 센다', () => {
    const counted = NOTIFICATION_KINDS.filter((kind) => kind !== 'request_received');
    expect(bellCount(counted.map((kind) => ({ kind, unread: true })))).toBe(counted.length);
    expect(bellCount(counted.map((kind) => ({ kind, unread: false })))).toBe(0);
  });

  it('인연 탭은 받은 요청 중 답하지 않은 것만 센다 — 보낸 요청과 끝난 요청은 아니다', () => {
    expect(
      answerCount([
        { direction: 'received', status: 'pending' },
        { direction: 'received', status: 'pending' },
        { direction: 'sent', status: 'pending' },
        { direction: 'received', status: 'accepted' },
        { direction: 'received', status: 'expired' },
      ]),
    ).toBe(2);
  });
});
