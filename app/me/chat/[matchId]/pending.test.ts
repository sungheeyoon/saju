import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './messages';
import { pendingMessage, settlePending, withPending, type Pending } from './pending';

const message = (seq: number, body: string, mine = true): ChatMessage => ({
  messageId: `m${seq}`,
  seq,
  mine,
  fromLeftPartner: false,
  body,
  createdAt: '2026-10-08T00:00:00Z',
});

const pending = (id: string, body: string, after: number): Pending => ({ id, body, after, sentAt: '2026-10-08T00:00:01Z' });

describe('보내는 중인 말 맞추기', () => {
  it('보낸 뒤 읽혀 온 내 말과 본문이 같으면 걷는다', () => {
    const left = settlePending([pending('p1', '안녕', 5)], [message(5, '앞 말'), message(6, '안녕')]);
    expect(left).toEqual([]);
  });

  it('보내기 전부터 있던 같은 본문은 짝이 아니다 — 보낼 때 가진 차례 뒤의 말만 센다', () => {
    const one = pending('p1', '네', 6);
    expect(settlePending([one], [message(6, '네')])).toEqual([one]);
  });

  it('상대의 같은 말은 짝이 아니다', () => {
    const one = pending('p1', '응', 3);
    expect(settlePending([one], [message(4, '응', false)])).toEqual([one]);
  });

  it('같은 본문을 두 번 보내면 읽혀 온 말 하나가 보내는 중 하나만 걷는다', () => {
    const first = pending('p1', 'ㅋㅋ', 2);
    const second = pending('p2', 'ㅋㅋ', 2);
    expect(settlePending([first, second], [message(3, 'ㅋㅋ')])).toEqual([second]);
    expect(settlePending([first, second], [message(3, 'ㅋㅋ'), message(4, 'ㅋㅋ')])).toEqual([]);
  });

  it('걷을 것이 없으면 같은 목록을 돌려준다 — 다시 그리지 않는다', () => {
    const list = [pending('p1', '아직', 9)];
    expect(settlePending(list, [message(9, '다른 말')])).toBe(list);
  });
});

describe('보내는 중인 말을 목록 끝에 붙이기', () => {
  it('가진 말 뒤에 보낸 차례대로 내 말로 선다', () => {
    const shown = withPending([message(1, '앞', false)], [pending('p1', '하나', 1), pending('p2', '둘', 1)]);
    expect(shown.map((one) => one.body)).toEqual(['앞', '하나', '둘']);
    expect(shown.slice(1).every((one) => one.mine && !one.fromLeftPartner)).toBe(true);
    expect(shown.slice(1).map((one) => one.messageId)).toEqual(['p1', 'p2']);
  });

  it('보내는 중이 없으면 가진 목록 그대로다', () => {
    const have = [message(1, '앞')];
    expect(withPending(have, [])).toBe(have);
  });

  it('보내는 중인 말의 차례는 가진 어느 말보다 뒤다', () => {
    const one = pendingMessage(pending('p1', '뒤', 40));
    expect(one.seq).toBeGreaterThan(40);
    expect(one.createdAt).toBe('2026-10-08T00:00:01Z');
  });
});
