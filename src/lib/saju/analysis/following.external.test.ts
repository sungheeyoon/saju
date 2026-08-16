import { describe, expect, it } from 'vitest';

import { pillarOf, type Branch, type Stem } from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import { elementDistributionOf } from './fiveElements';
import { FOLLOWING_PATTERN_POLICY, followingAssessmentOf } from './followingPatterns';
import { rootednessOf } from './rootedness';
import { FOLLOWING_EXTERNAL_CASES } from './validation/followingExternalCases';

function assess(pillars: (typeof FOLLOWING_EXTERNAL_CASES)[number]['pillars']) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };

  const day = parse(pillars.day);
  const input = {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: parse(pillars.hour),
    dayMaster: day.stem,
  };

  return followingAssessmentOf(input, elementDistributionOf(input), rootednessOf(input));
}

/** 저자가 종격이라고 본 것 — 진종·가종을 함께 센다 */
const claimsFollowing = (verdict: string) => verdict !== 'not-following';
/** 엔진이 어떤 형태로든 종격 쪽으로 본 것 */
const engineFollows = (verdict: string) => verdict === 'true-following' || verdict === 'pseudo-following';

describe('종격 외부 명조 대조', () => {
  it('열여덟 건 모두 실재할 수 있는 명조다', () => {
    for (const { id, pillars } of FOLLOWING_EXTERNAL_CASES) {
      const derivedMonth = monthPillarOf(pillars.year[0] as Stem, pillars.month[1] as Branch);
      const derivedHour = hourPillarOf(pillars.day[0] as Stem, pillars.hour[1] as Branch);

      expect(`${derivedMonth.stem}${derivedMonth.branch}`, id).toBe(pillars.month);
      expect(`${derivedHour.stem}${derivedHour.branch}`, id).toBe(pillars.hour);
    }
  });

  /**
   * 실험 규칙 v1 이 이 자료를 얼마나 잡는지 그대로 고정한다.
   *
   * **지금은 잘 못 잡는다.** 문턱을 만지면 어느 칸이 움직이는지 여기서 보이고,
   * 그것이 이 데이터셋을 만든 이유다. 숫자를 자료에 맞춰 내리는 것은 다른 문제다
   * — 저자의 판정이 우리가 안 보는 것(합화, 지장간 여기의 질)에 기대고 있어서,
   * 압도 비율만 낮추면 일반 명식까지 종격으로 쓸려 들어온다.
   */
  it('출처 판정과 엔진 판정의 행렬을 회귀 고정한다', () => {
    const matrix = FOLLOWING_EXTERNAL_CASES.map((testCase) => {
      const found = assess(testCase.pillars);
      return {
        id: testCase.id,
        claim: testCase.claim.verdict,
        engine: found.verdict,
        dominance: Math.round(found.dominanceRatio * 1000) / 10,
      };
    });

    expect(matrix).toEqual([
      { id: 'kill-1', claim: 'following', engine: 'not-following', dominance: 44.3 },
      { id: 'kill-2', claim: 'following', engine: 'true-following', dominance: 83.6 },
      { id: 'kill-3', claim: 'following', engine: 'candidate', dominance: 77.3 },
      { id: 'kill-4', claim: 'following', engine: 'pseudo-following', dominance: 68.3 },
      { id: 'kill-5', claim: 'following', engine: 'not-following', dominance: 53.4 },
      { id: 'kill-6', claim: 'following', engine: 'not-following', dominance: 45.3 },
      { id: 'kill-7', claim: 'following', engine: 'not-following', dominance: 61.7 },
      { id: 'kill-8-broken', claim: 'not-following', engine: 'not-following', dominance: 57.1 },
      { id: 'kill-9-similar', claim: 'not-following', engine: 'not-following', dominance: 42.9 },
      { id: 'money-1', claim: 'following', engine: 'not-following', dominance: 60 },
      { id: 'money-2', claim: 'following', engine: 'not-following', dominance: 58.3 },
      { id: 'money-3', claim: 'pseudo-following', engine: 'not-following', dominance: 57.1 },
      { id: 'money-4', claim: 'pseudo-following', engine: 'not-following', dominance: 58.6 },
      { id: 'money-5-excluded', claim: 'not-following', engine: 'not-following', dominance: 47.4 },
      { id: 'money-6', claim: 'following', engine: 'not-following', dominance: 57.5 },
      { id: 'money-7', claim: 'following', engine: 'true-following', dominance: 76.1 },
      { id: 'money-8', claim: 'following', engine: 'true-following', dominance: 70.3 },
      { id: 'money-9-excluded', claim: 'not-following', engine: 'pseudo-following', dominance: 65.4 },
    ]);
  });

  /**
   * 이 규칙은 **덜 잡는 쪽으로 틀린다.** 종격이라고 적힌 열넷 중 넷만 종격 쪽으로
   * 보고(따로 '후보'로 남긴 것이 하나 더 있다), 아니라고 적힌 넷 중 하나를 가종으로
   * 잘못 본다. 게이트를 열 수준이 아니다.
   */
  it('현재 재현율과 오검출을 숫자로 남긴다', () => {
    const results = FOLLOWING_EXTERNAL_CASES.map((testCase) => ({
      claimed: claimsFollowing(testCase.claim.verdict),
      engine: engineFollows(assess(testCase.pillars).verdict),
    }));

    const claimed = results.filter((r) => r.claimed);
    const rejected = results.filter((r) => !r.claimed);

    expect(claimed).toHaveLength(14);
    expect(claimed.filter((r) => r.engine)).toHaveLength(4);
    expect(rejected).toHaveLength(4);
    expect(rejected.filter((r) => r.engine)).toHaveLength(1);
  });

  /**
   * 그래서 게이트는 닫아 둔다. 이 테스트가 그 약속이다 — 재현율이 이 상태인 채로
   * `eokbuOverride` 를 켜면 여기서 걸린다.
   */
  it('대조를 통과하지 못했으므로 억부를 덮어쓰지 않는다', () => {
    const caught = FOLLOWING_EXTERNAL_CASES.filter(
      (testCase) => claimsFollowing(testCase.claim.verdict) && engineFollows(assess(testCase.pillars).verdict),
    ).length;

    // 열넷 중 열은 잡아야 게이트를 논할 수 있다고 본다. 지금은 넷이다.
    expect(caught).toBeLessThan(10);
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
  });
});
