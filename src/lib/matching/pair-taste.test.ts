import { describe, expect, it } from 'vitest';

import { analyzeCompatibility, computeSaju } from '../saju';

import { buildMatchPreview, matchBasisOf } from './index';
import { pairTasteOf } from './pair-taste';

const A = computeSaju({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, gender: 'male' });
const B = computeSaju({ year: 1992, month: 8, day: 20, hour: 9, minute: 0, second: 0, gender: 'female' });
const names = { a: '민수', b: '지영' };

describe('로그인 전 궁합 결과의 한 줄', () => {
  it('궁합 결과 화면의 첫 신호와 같은 문장이다 — 로그인 뒤 같은 말을 다시 만난다', () => {
    const taste = pairTasteOf({ a: A, b: B }, names);
    const preview = buildMatchPreview(
      { a: A, b: B },
      analyzeCompatibility(A, B),
      names,
      matchBasisOf(null, { matched: false, relation: null }),
    );

    expect(taste.line).toBe(preview.highlights[0]);
    expect(taste.line).toMatch(/민수|지영/);
    expect(taste.dayMasters).toEqual({ a: A.pillars.dayMaster, b: B.pillars.dayMaster });
  });

  it('점수는 넘기지 않는다 — 화면이 가린 모양만 세운다', () => {
    const taste = pairTasteOf({ a: A, b: B }, names);
    expect(Object.keys(taste).sort()).toEqual(['dayMasters', 'line']);
    expect(JSON.stringify(taste)).not.toMatch(/"index"|"score"/);
  });
});
