import { describe, expect, it } from 'vitest';

import { analyzeCompatibility, computeSaju } from '../saju';
import {
  buildMatchPreview,
  MATCH_POLICY_V0,
} from '.';

const chart = (year: number, month: number, day: number, hour: number | null) =>
  computeSaju(
    hour === null
      ? { year, month, day, hour: null, gender: 'female' }
      : { year, month, day, hour, minute: 0, second: 0, gender: 'female' },
    { longitude: 126.98, useLongitude: true },
  );

describe('match-v0', () => {
  it('공개한 가중치의 합이 1이다', () => {
    expect(
      Object.values(MATCH_POLICY_V0.weights).reduce((sum, weight) => sum + weight, 0),
    ).toBeCloseTo(1);
  });

  it('사주 사실을 네 영역의 버전된 베타 지표로 바꾼다', () => {
    const charts = {
      a: chart(1990, 5, 15, 14),
      b: chart(1992, 8, 20, 9),
    };
    const preview = buildMatchPreview(charts, analyzeCompatibility(charts.a, charts.b), {
      a: '민수',
      b: '지영',
    });

    expect(preview.policyVersion).toBe('match-v0');
    expect(preview.status).toBe('beta');
    expect(preview.dimensions.map((dimension) => dimension.key)).toEqual([
      'complement',
      'combinedBalance',
      'connectionDensity',
      'dataCompleteness',
    ]);
    expect(preview.index).toBeGreaterThanOrEqual(0);
    expect(preview.index).toBeLessThanOrEqual(100);
    expect(preview.highlights).toHaveLength(3);
    expect(preview.caveat).toContain('궁합의 정답이 아니라');
  });
});
