import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../me/reading/current';
import { COMPAT_SHELF_HREF, recentCompat } from './archive';

/**
 * **궁합 탭의 최근 궁합풀이는 직접 본 궁합만, 최근 것 셋이다**(ADR 0129 「2026-09-29 e+」).
 *
 * 인연 궁합은 인연 탭이 들고, 한 사람 풀이는 나 탭이 든다. 넷째부터는 풀이 보관함의 궁합풀이 필터가 든다.
 */

const entry = (kind: ReadingEntry['kind'], at: string): ReadingEntry => ({
  kind,
  personA: kind === 'match' ? null : `a-${at}`,
  personB: kind === 'private' ? `b-${at}` : null,
  matchId: kind === 'match' ? `m-${at}` : null,
  labelA: 'a',
  labelB: kind === 'self' || kind === 'person' ? null : 'b',
  score: null,
  metaphor: null,
  createdAt: at,
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
});

describe('최근 궁합풀이', () => {
  it('인연 궁합과 한 사람 풀이는 빼고 직접 궁합만 DB 의 차례대로 셋까지 든다', () => {
    const readings = [
      entry('match', '9'),
      entry('private', '8'),
      entry('self', '7'),
      entry('private', '6'),
      entry('person', '5'),
      entry('private', '4'),
      entry('private', '3'),
    ];

    const { recent, more } = recentCompat(readings);

    expect(recent.map((one) => one.createdAt)).toEqual(['8', '6', '4']);
    expect(more).toBe(true);
  });

  it('셋 이하면 모두 보기가 서지 않는다', () => {
    expect(recentCompat([entry('private', '2'), entry('match', '1')])).toEqual({
      recent: [entry('private', '2')],
      more: false,
    });
    expect(recentCompat([entry('match', '1')]).recent).toEqual([]);
  });

  it('모두 보기는 풀이 보관함의 궁합풀이 필터로 간다', () => {
    expect(COMPAT_SHELF_HREF).toBe('/me/readings?kind=compat');
  });
});
