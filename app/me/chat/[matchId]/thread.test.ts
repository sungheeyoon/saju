import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './messages';
import { mergeMessages, needsNewer, newestSeq, oldestSeq, readAlready, readNewer, readUpTo, type ReadPage } from './thread';

const message = (seq: number, mine = false): ChatMessage => ({
  messageId: `m${seq}`,
  seq,
  mine,
  fromLeftPartner: false,
  body: `본문 ${seq}`,
  createdAt: '2026-10-08T00:00:00Z',
});

const seqs = (list: readonly ChatMessage[]) => list.map((one) => one.seq);

describe('메시지 합치기', () => {
  it('같은 메시지는 한 번만 서고 차례로 선다', () => {
    const merged = mergeMessages([message(3), message(10)], [message(12), message(10), message(5), message(12)]);
    expect(seqs(merged)).toEqual([3, 5, 10, 12]);
  });

  it('새것이 없으면 가진 것을 그대로 돌려준다 — 다시 그리지 않는다', () => {
    const have = [message(1), message(2)];
    expect(mergeMessages(have, [message(2)])).toBe(have);
    expect(mergeMessages(have, [])).toBe(have);
  });

  it('이미 가진 메시지는 가진 그대로 둔다', () => {
    const had = { ...message(1), time: '오후 1:00' };
    const merged = mergeMessages([had], [{ ...message(1), time: '다른 글자' }, { ...message(2), time: '오후 1:01' }]);
    expect(merged[0]).toBe(had);
  });

  it('가장 큰 · 작은 차례 — 비었으면 0 과 null', () => {
    expect(newestSeq([])).toBe(0);
    expect(oldestSeq([])).toBeNull();
    expect(newestSeq([message(4), message(9)])).toBe(9);
    expect(oldestSeq([message(4), message(9)])).toBe(4);
  });

  it('알림의 차례가 가진 것보다 클 때만 다시 읽고, 차례를 모르면 늘 읽는다', () => {
    const have = [message(4), message(9)];
    expect(needsNewer(have, 9)).toBe(false);
    expect(needsNewer(have, 7)).toBe(false);
    expect(needsNewer(have, 10)).toBe(true);
    expect(needsNewer(have, null)).toBe(true);
  });
});

/** 방에 있는 메시지 전부를 들고 읽는 문처럼 답하는 가짜 — 최신부터 `limit` 건을 오래된 것이 먼저 오게 */
function roomOf(all: readonly number[]): { read: ReadPage; calls: { before?: number; limit: number }[] } {
  const calls: { before?: number; limit: number }[] = [];
  const read: ReadPage = async (page) => {
    calls.push(page);
    const below = all.filter((seq) => page.before === undefined || seq < page.before).sort((a, b) => b - a);
    return below.slice(0, page.limit).reverse().map((seq) => message(seq));
  };
  return { read, calls };
}

describe('가진 것 뒤를 빠짐없이 읽기', () => {
  it('한 쪽에 다 들면 한 번만 읽는다 — 차례 사이가 떠도 빠진 것이 아니다', async () => {
    const room = roomOf([3, 7, 20, 21, 40]);
    const fresh = await readNewer(room.read, 7, 50);
    expect(seqs(fresh)).toEqual([20, 21, 40]);
    expect(room.calls).toHaveLength(1);
  });

  it('쪽이 가득 찼는데 가진 것에 아직 안 닿았으면 그 앞을 더 읽는다 — 끊긴 동안 쌓인 것이 다 온다', async () => {
    const all = Array.from({ length: 130 }, (_, index) => index + 1);
    const room = roomOf(all);
    const fresh = await readNewer(room.read, 10, 50);
    expect([...seqs(fresh)].sort((a, b) => a - b)).toEqual(all.filter((seq) => seq > 10));
    expect(room.calls.map((call) => call.before)).toEqual([undefined, 81, 31]);
  });

  it('가진 것이 가장 새것이면 새로 오는 것이 없다', async () => {
    const room = roomOf([1, 2, 3]);
    expect(await readNewer(room.read, 3, 50)).toEqual([]);
  });

  it('읽어 온 것을 합치면 중복 없이 차례대로 선다', async () => {
    const room = roomOf([1, 2, 3, 4, 5, 6]);
    const have = [message(1), message(2), message(3)];
    const fresh = await readNewer(room.read, newestSeq(have), 2);
    expect(seqs(mergeMessages(have, fresh))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('읽음을 어디까지 남기나', () => {
  it('보이는 문서에서 화면에 든 상대 말의 가장 큰 차례까지, 남긴 것보다 클 때만', () => {
    expect(readUpTo([4, 9, 6], true, 0)).toBe(9);
    expect(readUpTo([4, 9, 6], true, 9)).toBeNull();
    expect(readUpTo([4, 9, 6], true, 12)).toBeNull();
    expect(readUpTo([], true, 0)).toBeNull();
  });

  it('숨은 탭은 남기지 않는다', () => {
    expect(readUpTo([4, 9], false, 0)).toBeNull();
  });

  it('들어올 때 안 읽은 것이 없었으면 가진 상대 말 전부가 이미 읽은 것이다', () => {
    const messages = [message(1), message(2, true), message(5), message(8, true)];
    expect(readAlready(messages, 0)).toBe(5);
    expect(readAlready(messages, 2)).toBe(0);
  });
});
