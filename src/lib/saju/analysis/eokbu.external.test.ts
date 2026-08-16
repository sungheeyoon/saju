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

    // 실재 가능한 사례가 둘뿐이라는 것이 이 데이터셋의 실제 크기다.
    expect(
      EOKBU_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'consistent').map((c) => c.id),
    ).toEqual(['8ja-145-weak-muto', '8ja-146-wealth-heavy-byeonghwa']);
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
          testCase.claim.strength === 'borderline'
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
    ]);

    // 어긋난 셋이 전부 실재할 수 없는 명조라, 다섯 건을 한 줄로 세면 엔진이
    // 실제보다 나빠 보인다. 채점은 실재 가능한 둘로만 한다 — 강약 2/2, 오행 1/2.
    const scored = comparison.filter(({ id }) =>
      EOKBU_EXTERNAL_CASES.some(
        (testCase) => testCase.id === id && testCase.chartConstruction === 'consistent',
      ),
    );

    expect(scored.map(({ strengthAgrees }) => strengthAgrees)).toEqual([true, true]);
    expect(scored.map(({ elementAgrees }) => elementAgrees)).toEqual([true, false]);
  });

  it('종격은 계통을 채택하기 전까지 억부를 덮어쓰지 않는다', () => {
    expect(FOLLOWING_PATTERN_POLICY.status).toBe('documented-not-evaluated');
    expect(FOLLOWING_PATTERN_POLICY.selectedLineage).toBeNull();
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
    expect(FOLLOWING_PATTERN_POLICY.blockingDecisions).toContain('hiddenSupport');
    expect(FOLLOWING_PATTERN_POLICY.blockingDecisions).toContain('trueVersusFalseFollowing');
  });
});
