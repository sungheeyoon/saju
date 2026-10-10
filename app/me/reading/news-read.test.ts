import { describe, expect, it, vi } from 'vitest';

import type { ReadingNewsRead } from './actions';
import { markAndAnnounce, newsKeyOf, readNewsWhenSeen } from './news-read';
import type { PageVisibility } from './watch-run';

/** 손으로 드는 탭 — 숨김을 바꾸고 바뀜을 알린다 */
function fakeTab(hidden: boolean) {
  let state = hidden;
  const listeners = new Set<() => void>();
  const visibility: PageVisibility = {
    hidden: () => state,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    visibility,
    listening: () => listeners.size,
    set(next: boolean) {
      state = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe('결과 화면이 완성 소식을 읽음으로 바꾸는 열쇠', () => {
  it('글이 없으면 바꿀 것이 없다', () => {
    expect(newsKeyOf(null)).toBeNull();
  });

  it('같은 글은 몇 번 그려도 같은 열쇠다', () => {
    const reading = { id: 'r-1', createdAt: '2026-10-10T01:00:00.000Z' };
    expect(newsKeyOf(reading)).toBe(newsKeyOf({ ...reading }));
  });

  it('다시 받아 같은 행이 덮이면 열쇠가 바뀐다 — 새 글의 완성 소식도 한 번 처리한다', () => {
    const first = newsKeyOf({ id: 'r-1', createdAt: '2026-10-10T01:00:00.000Z' });
    const again = newsKeyOf({ id: 'r-1', createdAt: '2026-10-10T01:04:00.000Z' });
    expect(again).not.toBe(first);
  });
});

describe('탭이 보일 때 한 번', () => {
  it('보이는 탭에서는 곧바로 한 번 부르고 더 듣지 않는다', () => {
    const tab = fakeTab(false);
    const send = vi.fn();

    readNewsWhenSeen({ visibility: tab.visibility, send });
    tab.set(true);
    tab.set(false);

    expect(send).toHaveBeenCalledTimes(1);
    expect(tab.listening()).toBe(0);
  });

  it('숨긴 탭에서 열린 화면은 보일 때까지 안 부른다 — 아무도 안 본 글이다', () => {
    const tab = fakeTab(true);
    const send = vi.fn();

    readNewsWhenSeen({ visibility: tab.visibility, send });
    expect(send).not.toHaveBeenCalled();

    tab.set(false);
    tab.set(true);
    tab.set(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('보이기 전에 떠나면 부르지 않는다', () => {
    const tab = fakeTab(true);
    const send = vi.fn();

    const stop = readNewsWhenSeen({ visibility: tab.visibility, send });
    stop();
    tab.set(false);

    expect(send).not.toHaveBeenCalled();
    expect(tab.listening()).toBe(0);
  });
});

describe('읽음으로 바꾼 뒤 종', () => {
  const answering = (answer: ReadingNewsRead) => vi.fn(async () => answer);

  it('그 풀이의 id 로 부른다', async () => {
    const mark = answering({ ok: true, marked: 1 });
    await markAndAnnounce('r-1', mark, () => {});
    expect(mark).toHaveBeenCalledWith('r-1');
  });

  it('바뀐 소식이 있으면 머리글의 종을 다시 세게 한다', async () => {
    const announce = vi.fn();
    await markAndAnnounce('r-1', answering({ ok: true, marked: 1 }), announce);
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('바뀐 것이 없으면(이미 읽었다 · 소식이 없다) 종을 건드리지 않는다', async () => {
    const announce = vi.fn();
    await markAndAnnounce('r-1', answering({ ok: true, marked: 0 }), announce);
    expect(announce).not.toHaveBeenCalled();
  });

  it('못 바꿨거나 왕복이 끊겨도 조용하다 — 부속이다', async () => {
    const announce = vi.fn();
    await markAndAnnounce('r-1', answering({ ok: false, message: '실패' }), announce);
    await expect(
      markAndAnnounce('r-1', vi.fn(async () => Promise.reject(new Error('끊김'))), announce),
    ).resolves.toBeUndefined();
    expect(announce).not.toHaveBeenCalled();
  });
});
