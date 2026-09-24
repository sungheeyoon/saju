import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../reading/current';
import { bookOf } from './book';
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
  dayMasterA: null,
  dayMasterB: null,
  ...over,
});

const wood: DayMaster = { stem: '甲', element: '木' };
const water: DayMaster = { stem: '壬', element: '水' };
const metal: DayMaster = { stem: '庚', element: '金' };

describe('표지의 주인', () => {
  it('내 사주는 내 일간을 입는다', () => {
    const book = bookOf(entry({ kind: 'self', dayMasterA: '甲' }));
    expect(book.single).toBe(true);
    expect(book.subjects).toEqual([wood]);
    expect(book.href).toBe('/me/readings/self');
  });

  it('저장한 사람은 그 사람의 일간을 입는다', () => {
    const book = bookOf(entry({ kind: 'person', personA: 'mom', labelA: '엄마', dayMasterA: '壬' }));
    expect(book.subjects).toEqual([water]);
  });

  it('한 사람짜리는 뒷자리 값이 와도 한 색이다', () => {
    const book = bookOf(entry({ kind: 'person', personA: 'mom', dayMasterA: '壬', dayMasterB: '甲' }));
    expect(book.subjects).toEqual([water]);
  });

  it('두 사람 궁합은 두 색이고, 모르는 사람은 비워 둔다', () => {
    const book = bookOf(
      entry({ kind: 'private', personA: 'mom', personB: 'dad', labelA: '엄마', labelB: '아빠', dayMasterA: '壬' }),
    );
    expect(book.single).toBe(false);
    expect(book.subjects).toEqual([water, null]);
  });

  /** 앞자리가 나이고 뒷자리가 상대라는 차례는 문이 정한다(`58_readings_cover`) — 화면은 그대로 옮긴다 */
  it('인연 궁합은 문이 준 두 일간을 입는다', () => {
    const book = bookOf(
      entry({ kind: 'match', matchId: 'm1', labelA: '서하', score: 81, dayMasterA: '甲', dayMasterB: '庚' }),
    );
    expect(book.subjects).toEqual([wood, metal]);
    expect(book.score).toBe(81);
  });

  it('동의 당시 사본이 없는 옛 인연 궁합은 두 자리 다 회색이다', () => {
    expect(bookOf(entry({ kind: 'match', matchId: 'm1' })).subjects).toEqual([null, null]);
  });

  it('지금 명식이 아니면 수정 전으로 표시한다', () => {
    expect(bookOf(entry({ fromCurrentChart: false })).stale).toBe(true);
  });
});
