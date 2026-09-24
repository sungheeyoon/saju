import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../reading/current';
import { bookOf, coverPersonIds } from './book';
import type { DayMaster } from './subject';

/**
 * 책 한 권 — **표지의 주인이 누구인가**를 kind 넷이 가른다.
 */
const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'self',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: null,
  createdAt: '2026-09-03T00:00:00Z',
  fromCurrentChart: true,
  ...over,
});

const wood: DayMaster = { stem: '甲', element: '木' };
const water: DayMaster = { stem: '壬', element: '水' };
const known = new Map([
  ['me', wood],
  ['mom', water],
]);

describe('표지의 주인', () => {
  it('내 사주는 내 일간을 입는다', () => {
    const book = bookOf(entry({ kind: 'self' }), known, 'me');
    expect(book.single).toBe(true);
    expect(book.subjects).toEqual([wood]);
    expect(book.href).toBe('/me/readings/self');
  });

  it('저장한 사람은 그 사람의 일간을 입는다', () => {
    const book = bookOf(entry({ kind: 'person', personA: 'mom', labelA: '엄마' }), known, 'me');
    expect(book.subjects).toEqual([water]);
  });

  it('두 사람 궁합은 두 색이고, 못 읽은 사람은 비워 둔다', () => {
    const book = bookOf(
      entry({ kind: 'private', personA: 'mom', personB: 'dad', labelA: '엄마', labelB: '아빠' }),
      known,
      'me',
    );
    expect(book.single).toBe(false);
    expect(book.subjects).toEqual([water, null]);
  });

  it('인연 궁합은 앞자리가 나이고 상대는 읽지 않는다', () => {
    const book = bookOf(entry({ kind: 'match', matchId: 'm1', labelA: '서하', score: 81 }), known, 'me');
    expect(book.subjects).toEqual([wood, null]);
    expect(book.score).toBe(81);
  });

  it('지금 명식이 아니면 이전 명식으로 표시한다', () => {
    expect(bookOf(entry({ fromCurrentChart: false }), known, 'me').stale).toBe(true);
  });
});

describe('명식을 읽을 사람', () => {
  it('목록에 선 사람만, 한 번씩', () => {
    const ids = coverPersonIds(
      [
        entry({ kind: 'self' }),
        entry({ kind: 'match', matchId: 'm1' }),
        entry({ kind: 'person', personA: 'mom' }),
        entry({ kind: 'private', personA: 'mom', personB: 'dad' }),
      ],
      'me',
    );
    expect(ids.sort()).toEqual(['dad', 'me', 'mom']);
  });

  it('내 사주가 없으면 나를 안 읽는다', () => {
    expect(coverPersonIds([entry({ kind: 'match', matchId: 'm1' })], null)).toEqual([]);
  });
});
