import { describe, expect, it } from 'vitest';

import type { ReadingEntry } from '../me/reading/current';
import { COMPAT_SHELF_HREF, compatSummary, pairOf } from './archive';

/**
 * **궁합 탭의 궁합풀이 한 줄은 직접 본 궁합만 센다**(「2026-09-29 u2」).
 *
 * 인연 궁합은 인연 탭이 들고, 한 사람 풀이는 홈 탭이 든다. 누르면 풀이 보관함의 궁합풀이 칸으로 가고, 그 목록의 ← 는
 * 궁합 탭이다(`from=compat`).
 */

const entry = (kind: ReadingEntry['kind'], at: string): ReadingEntry => ({
  kind,
  personA: kind === 'match' ? null : `a-${at}`,
  personB: kind === 'private' ? `b-${at}` : null,
  matchId: kind === 'match' ? `m-${at}` : null,
  labelA: `가${at}`,
  labelB: kind === 'self' || kind === 'person' ? null : `나${at}`,
  score: null,
  metaphor: null,
  createdAt: at,
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
});

describe('궁합풀이 한 줄', () => {
  it('인연 궁합과 한 사람 풀이는 빼고 직접 궁합만 세며, 최근 것은 DB 의 차례로 첫째다', () => {
    const readings = [
      entry('match', '9'),
      entry('self', '8'),
      entry('private', '7'),
      entry('person', '6'),
      entry('private', '5'),
      entry('private', '4'),
      entry('private', '3'),
    ];

    const summary = compatSummary(readings);

    expect(summary?.count).toBe(4);
    expect(summary?.latest.createdAt).toBe('7');
    expect(pairOf(summary!.latest)).toBe('가7 × 나7');
  });

  it('직접 본 궁합이 없으면 줄이 안 선다', () => {
    expect(compatSummary([entry('match', '1'), entry('self', '2')])).toBeNull();
    expect(compatSummary([])).toBeNull();
  });

  it('누르면 풀이 보관함의 궁합풀이 칸으로 가고 궁합 탭에서 왔다고 싣는다', () => {
    expect(COMPAT_SHELF_HREF).toBe('/me/readings?kind=compat&from=compat');
  });
});
