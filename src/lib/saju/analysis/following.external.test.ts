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

/** 채점 대상 — 실재할 수 없는 명조로는 엔진을 채점하지 않는다. */
const SCORED = FOLLOWING_EXTERNAL_CASES.filter(
  ({ chartConstruction }) => chartConstruction === 'consistent',
);

describe('종격 외부 명조 대조', () => {
  it('계통이 다른 자료를 섞는다', () => {
    expect(new Set(FOLLOWING_EXTERNAL_CASES.map(({ id }) => id)).size).toBe(
      FOLLOWING_EXTERNAL_CASES.length,
    );
    expect(FOLLOWING_EXTERNAL_CASES.filter((c) => c.lineage === 'modern-chinese')).toHaveLength(18);
    expect(FOLLOWING_EXTERNAL_CASES.filter((c) => c.lineage === 'classical-chinese')).toHaveLength(
      17,
    );
  });

  /**
   * 실재 여부는 손으로 적은 값을 믿지 않고 저장소의 오호둔·오자둔으로 다시 센다.
   * 고전이라고 예외가 아니다 — 서른다섯 중 하나가 판본 오배로 걸린다.
   */
  it('네 기둥이 실재할 수 있는지 저장소 규칙으로 다시 센다', () => {
    for (const { id, pillars, chartConstruction } of FOLLOWING_EXTERNAL_CASES) {
      const derivedMonth = monthPillarOf(pillars.year[0] as Stem, pillars.month[1] as Branch);
      const derivedHour = hourPillarOf(pillars.day[0] as Stem, pillars.hour[1] as Branch);
      const realizable =
        `${derivedMonth.stem}${derivedMonth.branch}` === pillars.month &&
        `${derivedHour.stem}${derivedHour.branch}` === pillars.hour;

      expect(chartConstruction, id).toBe(realizable ? 'consistent' : 'unrealizable');
    }

    expect(
      FOLLOWING_EXTERNAL_CASES.filter((c) => c.chartConstruction === 'unrealizable').map(
        (c) => c.id,
      ),
    ).toEqual(['dtsm-jiacong-4-misprint']);
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
      // 從象 열 — 안으로 종하는 두 건(從旺·從强)만 진종으로 잡힌다.
      { id: 'dtsm-congxiang-1', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 18.8 },
      { id: 'dtsm-congxiang-2', claim: 'following', engine: 'not-following', direction: null, selfShare: 36.7 },
      { id: 'dtsm-congxiang-3', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 27.9 },
      { id: 'dtsm-congxiang-4', claim: 'following', engine: 'not-following', direction: null, selfShare: 30.4 },
      { id: 'dtsm-congxiang-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 28.8 },
      { id: 'dtsm-congxiang-6-wang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 91.3 },
      { id: 'dtsm-congxiang-7-qiang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 85 },
      { id: 'dtsm-congxiang-8-qi', claim: 'following', engine: 'not-following', direction: null, selfShare: 40.4 },
      { id: 'dtsm-congxiang-9-shi', claim: 'following', engine: 'not-following', direction: null, selfShare: 32.9 },
      { id: 'dtsm-congxiang-10', claim: 'following', engine: 'not-following', direction: null, selfShare: 37.5 },
      // 假從 다섯 — 하나도 잡지 못한다. 자당 몫이 25~39% 라 밖으로 종하는 문턱 위에 있다.
      { id: 'dtsm-jiacong-1', claim: 'pseudo-following', engine: 'candidate', direction: 'outward', selfShare: 25 },
      { id: 'dtsm-jiacong-2', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 38.3 },
      { id: 'dtsm-jiacong-3', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 35.4 },
      { id: 'dtsm-jiacong-4-misprint', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 33.8 },
      { id: 'dtsm-jiacong-5', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 39.2 },
    ]);
  });

  /**
   * 자료를 열다섯 건 넓히자 계통별로 성적이 갈리는 것이 드러난다. 밖으로 종하는
   * 계열은 자당 몫이 문턱 근처(25~40%)에 촘촘히 몰려 있어 ≤30% 한 줄로는 절반쯤만
   * 걸린다. 반대로 **안으로 종하는 계열은 85~91% 로 문턱에서 멀찍이 떨어져 있다** —
   * 축을 자당 몫 하나로 다시 세운 판단이 여기서 값을 낸다.
   */
  it('안으로 종하는 계열은 문턱에서 멀고 밖으로 종하는 계열은 붙어 있다', () => {
    // 축을 다시 세운 이유가 이 셋이다. 이전 축(`지배 ÷ (지배 + 자당)`)으로는
    // 지배 세력이 곧 자당이라 0.5 를 넘을 수 없어 구조적으로 안 잡혔다.
    const inward = ['dtsm-congxiang-6-wang', 'dtsm-congxiang-7-qiang', 'dtsm-following-strong'];
    for (const id of inward) {
      const found = assess(FOLLOWING_EXTERNAL_CASES.find((c) => c.id === id)!.pillars);
      expect(found.facts.dominant.role, id).toBe('比劫');
      expect(found.direction, id).toBe('inward');
      expect(found.selfShare, id).toBeGreaterThan(0.7);
    }

    // 假從 다섯은 정의상 비겁·인성이 남아 있어 밖으로 종하는 문턱 위에 얹힌다.
    const jiacong = FOLLOWING_EXTERNAL_CASES.filter((c) => c.id.startsWith('dtsm-jiacong-'));
    expect(jiacong).toHaveLength(5);
    for (const testCase of jiacong) {
      expect(engineFollows(assess(testCase.pillars).verdict), testCase.id).toBe(false);
    }
  });

  /**
   * 자료를 스물에서 서른다섯으로 넓히자 재현율이 10/16 에서 **14/30 으로 내려갔다.**
   * 새 자료가 어려워서가 아니라 앞의 열여덟이 밖으로 종하는 계열에 몰려 있어
   * 성적이 좋아 보였던 것이다. 덜 잡는 쪽으로 틀리는 성향은 그대로다 —
   * 아니라고 적힌 넷 중 하나만 가종으로 잘못 본다.
   */
  it('현재 재현율과 오검출을 숫자로 남긴다', () => {
    const results = SCORED.map((testCase) => ({
      claimed: claimsFollowing(testCase.claim.verdict),
      engine: engineFollows(assess(testCase.pillars).verdict),
    }));

    const claimed = results.filter((r) => r.claimed);
    const rejected = results.filter((r) => !r.claimed);

    expect(claimed).toHaveLength(30);
    expect(claimed.filter((r) => r.engine)).toHaveLength(14);
    expect(rejected).toHaveLength(4);
    expect(rejected.filter((r) => r.engine)).toHaveLength(1);
  });

  /**
   * **정책에 적힌 성적을 손으로 믿지 않는다.**
   *
   * 이 값들은 한 번 낡은 적이 있다. 축을 자당 몫으로 갈아엎고 자료를 서른다섯으로
   * 넓힌 뒤에도 `cases: 20 · caught: 4 · cannot-detect-following-the-strong` 이
   * 그대로 남아, 이미 해결된 간극을 미해결이라고 적고 있었다. 외부 사례의
   * `chartConstruction` 을 손으로 적지 않고 오호둔으로 다시 세는 것과 같은 이유다.
   */
  it('정책에 적힌 대조 성적을 테스트가 다시 센다', () => {
    const check = FOLLOWING_PATTERN_POLICY.dominance.externalCheck;
    const caught = (cases: typeof SCORED) =>
      cases.filter((testCase) => engineFollows(assess(testCase.pillars).verdict)).length;

    const claimed = SCORED.filter((testCase) => claimsFollowing(testCase.claim.verdict));
    const rejected = SCORED.filter((testCase) => !claimsFollowing(testCase.claim.verdict));

    expect(check.cases).toBe(FOLLOWING_EXTERNAL_CASES.length);
    expect(check.scored).toBe(SCORED.length);
    expect(check.lineages).toBe(new Set(FOLLOWING_EXTERNAL_CASES.map((c) => c.lineage)).size);
    expect(check.claimedFollowing).toBe(claimed.length);
    expect(check.caught).toBe(caught(claimed));
    expect(check.falsePositives).toBe(caught(rejected));

    for (const [lineage, recall] of Object.entries(check.recallByLineage)) {
      const ofLineage = claimed.filter((testCase) => testCase.lineage === lineage);
      expect(`${caught(ofLineage)}/${ofLineage.length}`, lineage).toBe(recall);
    }

    // 해결됐다고 적은 간극은 실제로 해결돼 있어야 한다 — 안으로 종을 잡는가.
    expect(
      SCORED.some((testCase) => assess(testCase.pillars).direction === 'inward'),
    ).toBe(true);
  });

  /**
   * 계통별로 나눠 보면 어디가 약한지 한눈에 보인다. 현대 정리(fatew)는 從財·從殺만
   * 실어 문턱이 맞춰진 자리이고, 고전은 從旺·從强부터 假從까지 넓어 성적이 낮다.
   * **한쪽 계통만으로 문턱을 고르면 이 차이가 안 보인다** — 그래서 섞는다.
   */
  it('계통별 재현율을 따로 센다', () => {
    const recall = (lineage: string) => {
      const claimed = SCORED.filter(
        (c) => c.lineage === lineage && claimsFollowing(c.claim.verdict),
      );
      return [claimed.filter((c) => engineFollows(assess(c.pillars).verdict)).length, claimed.length];
    };

    expect(recall('modern-chinese')).toEqual([9, 14]);
    expect(recall('classical-chinese')).toEqual([5, 16]);
  });

  /**
   * 그래서 게이트는 닫아 둔다. 이 테스트가 그 약속이다 — 재현율이 이 상태인 채로
   * `eokbuOverride` 를 켜면 여기서 걸린다.
   */
  it('대조를 통과하지 못했으므로 억부를 덮어쓰지 않는다', () => {
    const claimed = SCORED.filter((testCase) => claimsFollowing(testCase.claim.verdict));
    const caught = claimed.filter((testCase) => engineFollows(assess(testCase.pillars).verdict));

    // 재현율만으로 게이트를 열지 않는다. 모집단 발화율이 고전이 말하는 희소성보다
    // 크게 높고(약 10%), 오검출도 남아 있다.
    expect(caught.length / claimed.length).toBeLessThan(0.5);
    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
  });
});
