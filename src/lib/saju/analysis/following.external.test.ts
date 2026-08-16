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
  it('스무 건 모두 실재할 수 있는 명조다', () => {
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
        direction: found.direction,
        selfShare: Math.round(found.selfShare * 1000) / 10,
      };
    });

    expect(matrix).toEqual([
      { id: 'kill-1', claim: 'following', engine: 'not-following', direction: null, selfShare: 45 },
      { id: 'kill-2', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 12.5 },
      { id: 'kill-3', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 18.8 },
      { id: 'kill-4', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 25 },
      { id: 'kill-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 28.8 },
      { id: 'kill-6', claim: 'following', engine: 'not-following', direction: null, selfShare: 31.7 },
      { id: 'kill-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 18.3 },
      { id: 'kill-8-broken', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 37.5 },
      { id: 'kill-9-similar', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 50.4 },
      { id: 'money-1', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 25.8 },
      { id: 'money-2', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 26.3 },
      { id: 'money-3', claim: 'pseudo-following', engine: 'candidate', direction: 'outward', selfShare: 22.5 },
      { id: 'money-4', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 27.9 },
      { id: 'money-5-excluded', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 37.9 },
      { id: 'money-6', claim: 'following', engine: 'not-following', direction: null, selfShare: 35.4 },
      { id: 'money-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 15.4 },
      { id: 'money-8', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 22.9 },
      { id: 'money-9-excluded', claim: 'not-following', engine: 'pseudo-following', direction: 'outward', selfShare: 22.1 },
      { id: 'dtsm-following-strong', claim: 'following', engine: 'pseudo-following', direction: 'inward', selfShare: 71.3 },
      { id: 'dtsm-following-weak', claim: 'following', engine: 'not-following', direction: null, selfShare: 34.6 },
    ]);
  });

  /**
   * 축을 다시 세운 뒤 넷에서 열로 올랐다. 그래도 **덜 잡는 쪽으로 틀린다** —
   * 종격이라고 적힌 열여섯 중 열을 종격 쪽으로 보고, 아니라고 적힌 넷 중 하나를
   * 가종으로 잘못 본다. 게이트를 열 수준은 아직 아니다.
   */
  it('현재 재현율과 오검출을 숫자로 남긴다', () => {
    const results = FOLLOWING_EXTERNAL_CASES.map((testCase) => ({
      claimed: claimsFollowing(testCase.claim.verdict),
      engine: engineFollows(assess(testCase.pillars).verdict),
    }));

    const claimed = results.filter((r) => r.claimed);
    const rejected = results.filter((r) => !r.claimed);

    expect(claimed).toHaveLength(16);
    expect(claimed.filter((r) => r.engine)).toHaveLength(10);
    expect(rejected).toHaveLength(4);
    expect(rejected.filter((r) => r.engine)).toHaveLength(1);
  });

  /**
   * 그래서 게이트는 닫아 둔다. 이 테스트가 그 약속이다 — 재현율이 이 상태인 채로
   * `eokbuOverride` 를 켜면 여기서 걸린다.
   */
  /**
   * 從强(일간 편이 극왕해 그쪽을 따름)은 지배 세력이 곧 일간 편이라, 압도 비율을
   * `지배 ÷ (지배 + 일간편)` 으로 재는 한 0.5 를 넘을 수 없다. 문턱을 낮춰도
   * 이 계열은 잡히지 않는다 — 분모를 다시 설계해야 하는 문제라 여기에 못박는다.
   */
  /**
   * 축을 다시 세운 이유가 이 한 건이다. 從强 은 지배 세력이 곧 일간 편이라
   * 이전 축(`지배 ÷ (지배 + 일간편)`)으로는 0.5 를 넘을 수 없어 구조적으로
   * 잡히지 않았다. 자당 몫 하나를 축으로 삼으니 반대쪽 끝에서 잡힌다.
   */
  it('從强 계열이 반대쪽 끝에서 잡힌다', () => {
    const strong = FOLLOWING_EXTERNAL_CASES.find((c) => c.id === 'dtsm-following-strong');
    const found = assess(strong!.pillars);

    expect(found.facts.dominant.role).toBe('比劫');
    expect(found.direction).toBe('inward');
    expect(found.verdict).not.toBe('not-following');
  });

  it('대조를 통과하지 못했으므로 억부를 덮어쓰지 않는다', () => {
    const caught = FOLLOWING_EXTERNAL_CASES.filter(
      (testCase) => claimsFollowing(testCase.claim.verdict) && engineFollows(assess(testCase.pillars).verdict),
    ).length;

    // 재현율만으로 게이트를 열지 않는다. 모집단 발화율이 고전이 말하는 희소성보다
    // 크게 높고(약 10%), 오검출도 남아 있다.
    expect(caught).toBeLessThanOrEqual(10);
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
  });
});
