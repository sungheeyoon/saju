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

  /**
   * **두 사람이 같은 숫자를 본다**(US 47).
   *
   * 공유 결과 화면은 보는 사람을 언제나 `a` 에 놓는다 — 관계 한 줄에서 어느 글자가
   * 누구 것인지를 「나」로 읽게 하려는 것이다. 그러면 같은 Match 를 두 사람이 서로
   * 뒤집힌 순서로 계산하게 되므로, **지표가 자리에 흔들리지 않아야** 두 사람이 같은
   * 값을 공유한다. 네 축이 다 자리 대칭이라는 것을 값으로 못박는다.
   */
  it('어느 쪽을 앞에 놓든 지표가 같다', () => {
    const one = chart(1990, 5, 15, 14);
    const other = chart(1992, 8, 20, null);

    const forward = buildMatchPreview(
      { a: one, b: other },
      analyzeCompatibility(one, other),
      { a: '민수', b: '지영' },
    );
    const backward = buildMatchPreview(
      { a: other, b: one },
      analyzeCompatibility(other, one),
      { a: '지영', b: '민수' },
    );

    expect(backward.index).toBe(forward.index);
    expect(backward.dimensions.map((dimension) => dimension.score)).toEqual(
      forward.dimensions.map((dimension) => dimension.score),
    );
  });
});
