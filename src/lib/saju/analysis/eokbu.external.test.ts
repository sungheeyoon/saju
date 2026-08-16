import { describe, expect, it } from 'vitest';
import { pillarOf, type Branch, type Stem } from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import { strengthOf } from './strength';
import { EOKBU_EXTERNAL_CASES } from './validation/eokbuExternalCases';
import { eokbuAssessmentOf } from './yongsin';
import { FOLLOWING_PATTERN_POLICY } from './followingPatterns';

function chartOf(pillars: (typeof EOKBU_EXTERNAL_CASES)[number]['pillars']) {
  const parse = (name: string) => {
    const pillar = pillarOf(name[0] as Stem, name[1] as Branch);
    if (!pillar) throw new Error(`간지가 아니다: ${name}`);
    return pillar;
  };
  const day = parse(pillars.day);

  return {
    year: parse(pillars.year),
    month: parse(pillars.month),
    day,
    hour: parse(pillars.hour),
    dayMaster: day.stem,
  };
}

describe('억부용신 외부 대조 데이터셋', () => {
  it('독립된 두 출처의 완전한 사주 네 기둥만 싣는다', () => {
    expect(new Set(EOKBU_EXTERNAL_CASES.map(({ id }) => id)).size).toBe(
      EOKBU_EXTERNAL_CASES.length,
    );
    expect(new Set(EOKBU_EXTERNAL_CASES.map(({ source }) => new URL(source.url).hostname)).size).toBe(
      2,
    );

    for (const testCase of EOKBU_EXTERNAL_CASES) {
      expect(Object.values(testCase.pillars)).toHaveLength(4);
      expect(() => chartOf(testCase.pillars)).not.toThrow();
      expect(testCase.source.locator.length).toBeGreaterThan(0);
    }
  });

  /**
   * 월간은 연간에서(오호둔), 시간은 일간에서(오자둔) 정해지므로 아무 여덟 글자나
   * 명조가 되지는 않는다. 출처가 설명하려고 지은 조합인지 실제로 태어날 수 있는
   * 사주인지는 눈으로 적지 말고 이 저장소의 규칙으로 다시 세게 한다.
   */
  it('네 기둥이 실재할 수 있는지 저장소 규칙으로 다시 센다', () => {
    for (const testCase of EOKBU_EXTERNAL_CASES) {
      const { year, month, day, hour } = testCase.pillars;
      const derivedMonth = monthPillarOf(year[0] as Stem, month[1] as Branch);
      const derivedHour = hourPillarOf(day[0] as Stem, hour[1] as Branch);
      const realizable =
        `${derivedMonth.stem}${derivedMonth.branch}` === month &&
        `${derivedHour.stem}${derivedHour.branch}` === hour;

      expect(testCase.chartConstruction, testCase.id).toBe(
        realizable ? 'consistent' : 'unrealizable',
      );
    }

    // 실재 가능한 사례의 수가 이 데이터셋의 실제 크기다 — 셋은 지어낸 조합이라 빠진다.
    expect(
      EOKBU_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'consistent').map((c) => c.id),
    ).toEqual([
      '8ja-145-weak-muto',
      '8ja-146-wealth-heavy-byeonghwa',
      '8ja-136-wealth-heavy-gapmok',
      '8ja-149-stagnant-muto',
      '8ja-157-drain-muto',
      '8ja-160-weak-jeonghwa',
    ]);
    // 실재 불가능한 셋은 전부 같은 출처다.
    expect(
      EOKBU_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'unrealizable').map((c) => c.id),
    ).toEqual(['tasko-strong-gapja', 'tasko-weak-byeonghwa', 'tasko-borderline-muto']);
  });

  it('출처 주장과 현재 엔진의 일치·불일치 행렬을 회귀 고정한다', () => {
    const comparison = EOKBU_EXTERNAL_CASES.map((testCase) => {
      const chart = chartOf(testCase.pillars);
      const strength = strengthOf(chart);
      const eokbu = eokbuAssessmentOf(chart, strength);

      return {
        id: testCase.id,
        sourceStrength: testCase.claim.strength,
        engineStrength: strength.verdict,
        strengthAgrees:
          // 중강·미명시는 이 엔진의 strong/weak 이분 판정과 맞댈 값이 아니다.
          testCase.claim.strength === 'borderline' || testCase.claim.strength === 'unstated'
            ? null
            : strength.verdict === testCase.claim.strength,
        sourceElement: testCase.claim.suggestedElement,
        engineElement: eokbu.suggestedElement,
        elementAgrees: eokbu.suggestedElement === testCase.claim.suggestedElement,
        sourceRole: testCase.claim.role ?? null,
        engineRole: eokbu.role,
        roleAgrees: testCase.claim.role ? eokbu.role === testCase.claim.role : null,
      };
    });

    expect(comparison).toEqual([
      {
        id: 'tasko-strong-gapja',
        sourceStrength: 'strong',
        engineStrength: 'strong',
        strengthAgrees: true,
        sourceElement: '金',
        engineElement: '火',
        elementAgrees: false,
        sourceRole: '官星',
        engineRole: '食傷',
        roleAgrees: false,
      },
      {
        id: 'tasko-weak-byeonghwa',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '木',
        engineElement: '火',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: 'tasko-borderline-muto',
        sourceStrength: 'borderline',
        engineStrength: 'strong',
        strengthAgrees: null,
        sourceElement: '金',
        engineElement: '木',
        elementAgrees: false,
        sourceRole: '食傷',
        engineRole: '官星',
        roleAgrees: false,
      },
      {
        id: '8ja-145-weak-muto',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '火',
        engineElement: '火',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: '8ja-146-wealth-heavy-byeonghwa',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '木',
        engineElement: '火',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: '8ja-136-wealth-heavy-gapmok',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '水',
        engineElement: '木',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: '8ja-149-stagnant-muto',
        sourceStrength: 'unstated',
        engineStrength: 'strong',
        strengthAgrees: null,
        sourceElement: '水',
        engineElement: '木',
        elementAgrees: false,
        sourceRole: '財星',
        engineRole: '官星',
        roleAgrees: false,
      },
      {
        // 출처가 "약하지 않다"고 본 명식을 엔진은 신약으로 본다 — 첫 강약 불일치다.
        id: '8ja-157-drain-muto',
        sourceStrength: 'strong',
        engineStrength: 'weak',
        strengthAgrees: false,
        sourceElement: '金',
        engineElement: '土',
        elementAgrees: false,
        sourceRole: '食傷',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: '8ja-160-weak-jeonghwa',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '木',
        engineElement: '木',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
    ]);

    // 채점은 실재 가능한 여섯 건으로만 한다 — 지어낸 조합으로 엔진을 채점할 수 없다.
    const scored = comparison.filter(({ id }) =>
      EOKBU_EXTERNAL_CASES.some(
        (testCase) => testCase.id === id && testCase.chartConstruction === 'consistent',
      ),
    );

    expect(scored).toHaveLength(6);
    // 강약은 다섯 건에서 비교 가능하고 그중 넷이 맞는다(157 이 어긋난다).
    const strengths = scored.map(({ strengthAgrees }) => strengthAgrees);
    expect(strengths.filter((agrees) => agrees === true)).toHaveLength(4);
    expect(strengths.filter((agrees) => agrees === false)).toHaveLength(1);
    expect(strengths.filter((agrees) => agrees === null)).toHaveLength(1);
    // 추천 오행은 여섯 중 둘만 맞는다.
    expect(scored.filter(({ elementAgrees }) => elementAgrees)).toHaveLength(2);
  });

  /**
   * 종격은 판정을 시작했지만(experimental v1) 억부의 답을 뒤집지는 않는다.
   * 문턱이 고전이 아니라 분포 측정에서 나온 값이고 외부 대조가 0건이기 때문이다.
   * 외부 종격 명조를 모아 대조하기 전에 이 스위치를 켜면 안 된다.
   */
  it('종격은 외부 대조 전까지 억부를 덮어쓰지 않는다', () => {
    expect(FOLLOWING_PATTERN_POLICY.status).toBe('experimental');
    expect(FOLLOWING_PATTERN_POLICY.dominance.calibration.note).toBe('not-a-classical-number');
    expect(FOLLOWING_PATTERN_POLICY.selectedLineage).toBeNull();
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
    expect(FOLLOWING_PATTERN_POLICY.blockingDecisions).toContain('hiddenSupport');
    expect(FOLLOWING_PATTERN_POLICY.blockingDecisions).toContain('trueVersusFalseFollowing');
  });
});
