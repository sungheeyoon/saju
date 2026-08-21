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
  it('계통이 다른 세 자료의 완전한 사주 네 기둥만 싣는다', () => {
    expect(new Set(EOKBU_EXTERNAL_CASES.map(({ id }) => id)).size).toBe(
      EOKBU_EXTERNAL_CASES.length,
    );
    // 계통이 다른 자료를 섞는다 — 한쪽 계통에만 맞는 규칙을 만들지 않기 위해서다.
    // 호스트 이름으로 세면 안 된다: 《적천수천미》와 《천리명고》가 같은 사이트에 있어
    // 셋이 둘로 줄어든다.
    expect(new Set(EOKBU_EXTERNAL_CASES.map(({ lineage }) => lineage))).toEqual(
      new Set(['korean-modern', 'classical-chinese', 'republican-chinese']),
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
      EOKBU_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'consistent'),
    ).toHaveLength(20);
    // 실재 불가능한 셋은 전부 같은 출처다.
    expect(
      EOKBU_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'unrealizable').map((c) => c.id),
    ).toEqual(['tasko-strong-gapja', 'tasko-weak-byeonghwa', 'tasko-borderline-muto']);
    // 그 셋은 모두 한국 현대 자료다. 중국 계통 열넷은 하나도 걸리지 않는다.
    expect(
      EOKBU_EXTERNAL_CASES.filter(
        (c) => c.lineage !== 'korean-modern' && c.chartConstruction === 'unrealizable',
      ),
    ).toHaveLength(0);
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
      // 계통이 다른 자료 — 《적천수천미》 임철초 주석 명례 셋은 모두 맞는다.
      {
        id: 'dtsm-8gyeok-inbu-1',
        sourceStrength: 'unstated',
        engineStrength: 'weak',
        strengthAgrees: null,
        sourceElement: '金',
        engineElement: '金',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: 'dtsm-8gyeok-inbu-2',
        sourceStrength: 'unstated',
        engineStrength: 'weak',
        strengthAgrees: null,
        sourceElement: '金',
        engineElement: '金',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: 'dtsm-8gyeok-sanggwan',
        sourceStrength: 'unstated',
        engineStrength: 'strong',
        strengthAgrees: null,
        sourceElement: '土',
        engineElement: '土',
        elementAgrees: true,
        sourceRole: '食傷',
        engineRole: '食傷',
        roleAgrees: true,
      },
      // 세 번째 계통 — 《천리명고》 위천리. 강약을 먼저 정하고 그 반대편에서 용신을
      // 고르는 절차가 이 엔진과 같아서, 강약은 비교 가능한 일곱 건이 전부 일치한다.
      {
        id: 'qlmg-lu-weak-byeonghwa',
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
      {
        // 신약에 재성을 쓰는 드문 처방이라 엔진과 갈린다 — 출처도 그 약점을 적는다.
        id: 'qlmg-pan-weak-geumgeum',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '木',
        engineElement: '土',
        elementAgrees: false,
        sourceRole: '財星',
        engineRole: '印星',
        roleAgrees: false,
      },
      {
        id: 'qlmg-wang-borderline-gapmok',
        sourceStrength: 'borderline',
        engineStrength: 'weak',
        strengthAgrees: null,
        sourceElement: '金',
        engineElement: '木',
        elementAgrees: false,
        sourceRole: '官星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: 'qlmg-zhan-borderline-gapmok',
        sourceStrength: 'borderline',
        engineStrength: 'weak',
        strengthAgrees: null,
        sourceElement: '水',
        engineElement: '木',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        id: 'qlmg-chen-weak-gyesu',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '水',
        engineElement: '水',
        elementAgrees: true,
        sourceRole: '比劫',
        engineRole: '比劫',
        roleAgrees: true,
      },
      {
        id: 'qlmg-yu-weak-geumgeum',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '土',
        engineElement: '土',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: 'qlmg-xian-weak-geumgeum',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '土',
        engineElement: '土',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: 'qlmg-yan-weak-eulmok',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '水',
        engineElement: '水',
        elementAgrees: true,
        sourceRole: '印星',
        engineRole: '印星',
        roleAgrees: true,
      },
      {
        id: 'qlmg-song-weak-geumgeum',
        sourceStrength: 'weak',
        engineStrength: 'weak',
        strengthAgrees: true,
        sourceElement: '土',
        engineElement: '金',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
      {
        // 상관패인은 강약이 아니라 구조를 보고 고르는 자리다 — 억부와 엇갈린다.
        id: 'qlmg-jiang-unstated-gito',
        sourceStrength: 'unstated',
        engineStrength: 'strong',
        strengthAgrees: null,
        sourceElement: '火',
        engineElement: '水',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '財星',
        roleAgrees: false,
      },
      {
        /**
         * **강약이 국(局)을 보게 되면서 어긋난 자리다.** 전에는 억부가 조후와
         * 우연히 같은 답을 냈다.
         *
         * 출처가 든 근거는 「己見亥子丑」 — 亥子丑이 모여 水가 되었다는 것이다.
         * 우리 강약이 여태 그것을 안 보고 있었고, 이제 본다. 세력을 저자와 같이
         * 읽게 되자 억부 규칙이 「재성이 가장 무거우니 비겁으로 나눈다」로 가고,
         * 저자는 거기서 한습을 병으로 보아 火로 간다. **어긋난 것은 세력 읽기가
         * 아니라 그다음 규칙이다** — 억부와 조후의 갈림이고, `caveats` 가 처음부터
         * 그렇게 적어 두었다.
         */
        id: 'qlmg-ma-unstated-gito',
        sourceStrength: 'unstated',
        engineStrength: 'weak',
        strengthAgrees: null,
        sourceElement: '火',
        engineElement: '土',
        elementAgrees: false,
        sourceRole: '印星',
        engineRole: '比劫',
        roleAgrees: false,
      },
    ]);

    // 채점은 실재 가능한 여섯 건으로만 한다 — 지어낸 조합으로 엔진을 채점할 수 없다.
    const scored = comparison.filter(({ id }) =>
      EOKBU_EXTERNAL_CASES.some(
        (testCase) => testCase.id === id && testCase.chartConstruction === 'consistent',
      ),
    );

    expect(scored).toHaveLength(20);
    // 강약은 열두 건에서 비교 가능하고 그중 열하나가 맞는다(8ja-157 하나만 어긋난다).
    const strengths = scored.map(({ strengthAgrees }) => strengthAgrees);
    expect(strengths.filter((agrees) => agrees === true)).toHaveLength(11);
    expect(strengths.filter((agrees) => agrees === false)).toHaveLength(1);
    expect(strengths.filter((agrees) => agrees === null)).toHaveLength(8);

    // 추천 오행은 스물 중 열하나가 맞는다.
    // 11 → 10. 잃은 한 칸은 조후로 용신을 고른 명조이고, 그 명조에서 세력을
    // 읽는 방식은 오히려 저자와 같아졌다(「己見亥子丑」).
    expect(scored.filter(({ elementAgrees }) => elementAgrees)).toHaveLength(10);
  });

  /**
   * **계통별로 성적이 갈리는 것이 이 데이터셋의 요점이다.** 중국 계통 열넷 중
   * 여덟이 맞고 한국 현대 상담 사례는 여섯 중 둘이다. 자료를 넓혀도 이 차이는
   * 그대로였다 — 우리 억부가 "강약을 먼저 정하고 그 반대편을 고른다"는 자평
   * 절차에 가깝고, 한국 상담 글은 조후·격국·물상을 함께 섞기 때문이다.
   *
   * 그러니 **성적이 낮은 쪽에 맞춰 규칙을 흔들면 안 된다.** 어긋난 자리마다 왜
   * 갈렸는지가 `caveats` 에 적혀 있고, 대부분 우리가 일부러 안 보기로 한 것
   * (합화·공협·조후·격국)에 기대고 있다.
   */
  it('계통별 오행 일치를 따로 센다', () => {
    const agreementBy = (lineage: string) => {
      const cases = EOKBU_EXTERNAL_CASES.filter(
        (c) => c.lineage === lineage && c.chartConstruction === 'consistent',
      );
      const agreed = cases.filter((testCase) => {
        const chart = chartOf(testCase.pillars);
        return (
          eokbuAssessmentOf(chart, strengthOf(chart)).suggestedElement ===
          testCase.claim.suggestedElement
        );
      });
      return [agreed.length, cases.length];
    };

    expect(agreementBy('korean-modern')).toEqual([2, 6]);
    expect(agreementBy('classical-chinese')).toEqual([3, 3]);
    expect(agreementBy('republican-chinese')).toEqual([5, 11]);
  });

  /**
   * 종격은 판정을 시작했지만(experimental v2) 억부의 답을 뒤집지는 않는다.
   * 외부 대조는 이제 서른다섯 건이고 재현율도 절반을 넘었지만, 모집단 발화율이
   * 고전이 말하는 희소성과 자릿수가 다르고 오검출이 남아 있다
   * (`following.external.test.ts`).
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
