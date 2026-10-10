import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SEND_DEADLINE_MS, droppable, type Pending, type SendResult } from './pending';
import { heard, sendLine, type LineReport } from './send-line';

/**
 * Next 의 액션 줄을 흉내 낸다 — 한 클라이언트의 부름은 차례로 하나씩 서버에 간다. `departed` 는 서버로 떠난 차례이고,
 * 맨 앞 부름이 답을 받아야 다음 부름이 떠난다.
 */
function nextActionQueue() {
  const calls: { id: string; resolve: (answer: SendResult) => void }[] = [];
  const departed: string[] = [];
  let head: Promise<unknown> = Promise.resolve();
  const transmit = (id: string) =>
    new Promise<SendResult>((resolve) => {
      head = head.then(
        () =>
          new Promise<void>((done) => {
            departed.push(id);
            calls.push({
              id,
              resolve: (answer) => {
                resolve(answer);
                done();
              },
            });
          }),
      );
    });
  return { transmit, departed, calls };
}

/** 줄과 보낼 말 목록을 함께 — 방이 하는 것과 같다(`use-outbox.ts`) */
function room() {
  const queue = nextActionQueue();
  let pending: readonly Pending[] = [];
  const reports: [string, LineReport['kind']][] = [];
  const line = sendLine(queue.transmit, (id, outcome) => {
    reports.push([id, outcome.kind]);
    pending = heard(pending, id, outcome);
  });
  return {
    queue,
    reports,
    send(id: string) {
      pending = [...pending, { id, body: id, sentAt: '2026-10-11T00:00:00Z', state: 'sending', mightBeKept: false }];
      line.enqueue(id, id);
    },
    retry(id: string) {
      pending = pending.map((one) => (one.id === id ? { ...one, state: 'sending' } : one));
      line.enqueue(id, id);
    },
    /** 화면의 「삭제」 — 서는 말만 지운다(`room.tsx`) */
    drop(id: string) {
      const one = pending.find((each) => each.id === id);
      if (one !== undefined && droppable(one)) pending = pending.filter((each) => each.id !== id);
    },
    get pending() {
      return pending;
    },
    state(id: string) {
      return pending.find((one) => one.id === id);
    },
  };
}

const sent: SendResult = { ok: true, outcome: 'sent' };
const limited: SendResult = { ok: true, outcome: 'rate_limited' };
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('보내기 줄 — 한 번에 한 말만 떠나고 시한은 떠난 말에만 센다', () => {
  it('앞의 말이 늦어도 뒤에 선 말은 실패로 서지 않고 보내는 중 그대로다', async () => {
    const r = room();
    r.send('A');
    r.send('B');
    r.send('C');
    await flush();
    expect(r.queue.departed).toEqual(['A']);

    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS * 3);
    expect(r.reports).toEqual([['A', 'overdue']]);
    expect(r.state('B')?.state).toBe('sending');
    expect(r.state('C')?.state).toBe('sending');
    expect(r.queue.departed).toEqual(['A']);
  });

  it('시한을 넘긴 말은 서버에 남았을 수 있어 「삭제」가 서지 않는다 — 늦게 저장돼도 지운 말이 상대에게 가는 일이 없다', async () => {
    const r = room();
    r.send('A');
    r.send('B');
    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS);
    expect(r.state('A')).toMatchObject({ state: 'failed', mightBeKept: true });

    r.drop('A');
    r.drop('B');
    expect(r.pending.map((one) => one.id)).toEqual(['A', 'B']);

    // A 가 늦게 저장됐다 — 받았다고 바뀌고, 그제야 B 가 떠난다.
    r.queue.calls[0].resolve(sent);
    await flush();
    expect(r.state('A')?.state).toBe('accepted');
    expect(r.queue.departed).toEqual(['A', 'B']);
  });

  it('「삭제」가 서는 말은 서버가 이미 거절했고 줄에 다시 서지 않았다 — 지운 뒤 다시 떠나지 않는다', async () => {
    const r = room();
    r.send('A');
    r.send('B');
    await flush();
    r.queue.calls[0].resolve(limited);
    await flush();
    expect(r.state('A')).toMatchObject({ state: 'failed', mightBeKept: false });
    r.drop('A');
    expect(r.state('A')).toBeUndefined();

    r.queue.calls[1].resolve(sent);
    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS * 2);
    expect(r.queue.departed).toEqual(['A', 'B']);
  });

  it('부름이 닿지 못했거나 코드 없는 실패면 「다시 보내기」만 선다', async () => {
    const r = room();
    r.send('A');
    r.send('B');
    await flush();
    r.queue.calls[0].resolve({ ok: false, message: '', refused: false });
    await flush();
    r.queue.calls[1].resolve({ ok: false, message: '잠시 후 다시 시도해 주세요.', refused: false });
    await flush();
    expect(r.pending.map((one) => [one.state, droppable(one)])).toEqual([
      ['failed', false],
      ['failed', false],
    ]);
  });

  it('시한을 넘긴 말을 다시 보내면 늦은 부름이 끝난 뒤에 같은 id 로 떠나고, 늦은 실패는 새 시도를 덮지 않는다', async () => {
    const r = room();
    r.send('A');
    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS);
    r.retry('A');
    await flush();
    expect(r.queue.departed).toEqual(['A']);

    r.queue.calls[0].resolve({ ok: false, message: '', refused: false });
    await flush();
    expect(r.state('A')?.state).toBe('sending');
    expect(r.queue.departed).toEqual(['A', 'A']);

    r.queue.calls[1].resolve(sent);
    await flush();
    expect(r.state('A')?.state).toBe('accepted');
  });

  it('시한 안의 답은 시한 알림을 남기지 않는다', async () => {
    const r = room();
    r.send('A');
    await flush();
    r.queue.calls[0].resolve(sent);
    await vi.advanceTimersByTimeAsync(SEND_DEADLINE_MS * 2);
    expect(r.reports).toEqual([['A', 'accepted']]);
  });

  it('부름이 던지면 닿지 못한 것으로 받고 다음 말이 떠난다', async () => {
    const reports: [string, LineReport][] = [];
    const departed: string[] = [];
    const line = sendLine(
      (id) => {
        departed.push(id);
        return id === 'A' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(sent);
      },
      (id, outcome) => reports.push([id, outcome]),
    );
    line.enqueue('A', 'a');
    line.enqueue('B', 'b');
    await flush();
    expect(departed).toEqual(['A', 'B']);
    expect(reports).toEqual([
      ['A', { kind: 'failed', message: null, mightBeKept: true }],
      ['B', { kind: 'accepted' }],
    ]);
  });
});
