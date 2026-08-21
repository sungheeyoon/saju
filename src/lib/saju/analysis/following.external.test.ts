import { describe, expect, it } from 'vitest';

import { pillarOf, type Branch, type Stem } from '../constants';
import { hourPillarOf } from '../pillars/hour';
import { monthPillarOf } from '../pillars/month';
import { bureausOf } from './bureau';
import { effectiveElementsOf } from './effectiveElements';
import { FOLLOWING_PATTERN_POLICY, followingAssessmentOf } from './followingPatterns';
import { rootednessOf } from './rootedness';
import { rootQualityOf } from './rootQuality';
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

  const rootedness = rootednessOf(input);
  const effective = effectiveElementsOf(input);
  const quality = rootQualityOf(rootedness, input, bureausOf(input));

  return followingAssessmentOf(input, effective.distribution, rootedness, quality.dayMaster);
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
   * 실험 규칙 v2 가 이 자료를 얼마나 잡는지 그대로 고정한다.
   *
   * **문턱은 v1 과 같다**(자당 ≤30% · ≥70%). 달라진 것은 세는 법이다 — 세력을
   * 국(局)과 합화를 반영한 실효 분포로 재고, 뿌리를 개수가 아니라 질로 잰다.
   * 그 둘만으로 열넷에서 열일곱이 되었다. 문턱을 자료에 맞춰 내리는 것과는
   * 다른 일이고, 그 차이가 이 행렬에서 보인다 — `selfShare` 칸이 움직인 자리가
   * 세는 법이 바뀐 자리다.
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
      { id: 'kill-1', claim: 'following', engine: 'not-following', direction: null, selfShare: 31.7 },
      { id: 'kill-2', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 12.5 },
      { id: 'kill-3', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 18.8 },
      { id: 'kill-4', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 25 },
      { id: 'kill-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 26.9 },
      { id: 'kill-6', claim: 'following', engine: 'not-following', direction: null, selfShare: 31.2 },
      { id: 'kill-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 16.9 },
      { id: 'kill-8-broken', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 37.5 },
      { id: 'kill-9-similar', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 41.5 },
      { id: 'money-1', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 20.6 },
      { id: 'money-2', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 25.6 },
      { id: 'money-3', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 22.5 },
      { id: 'money-4', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 27.9 },
      { id: 'money-5-excluded', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 40.1 },
      { id: 'money-6', claim: 'following', engine: 'not-following', direction: null, selfShare: 30.2 },
      { id: 'money-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 14.7 },
      { id: 'money-8', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 17.7 },
      { id: 'money-9-excluded', claim: 'not-following', engine: 'pseudo-following', direction: 'outward', selfShare: 18.8 },
      { id: 'dtsm-following-strong', claim: 'following', engine: 'pseudo-following', direction: 'inward', selfShare: 72.9 },
      { id: 'dtsm-following-weak', claim: 'following', engine: 'not-following', direction: null, selfShare: 34.6 },
      // 從象 열 — 안으로 종하는 둘에 더해, 삼합국을 반영하자 넷째가 진종으로 올라온다.
      { id: 'dtsm-congxiang-1', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 18.8 },
      { id: 'dtsm-congxiang-2', claim: 'following', engine: 'not-following', direction: null, selfShare: 36.7 },
      { id: 'dtsm-congxiang-3', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 27.9 },
      { id: 'dtsm-congxiang-4', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 20.7 },
      { id: 'dtsm-congxiang-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 26.9 },
      { id: 'dtsm-congxiang-6-wang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 92 },
      { id: 'dtsm-congxiang-7-qiang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 85 },
      { id: 'dtsm-congxiang-8-qi', claim: 'following', engine: 'not-following', direction: null, selfShare: 41.1 },
      { id: 'dtsm-congxiang-9-shi', claim: 'following', engine: 'not-following', direction: null, selfShare: 32.9 },
      { id: 'dtsm-congxiang-10', claim: 'following', engine: 'not-following', direction: null, selfShare: 37.5 },
      // 假從 다섯 — 하나가 잡힌다. 여기(餘氣) 뿌리 둘을 정기 둘처럼 세던 것을 고친 몫이다.
      { id: 'dtsm-jiacong-1', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 23.9 },
      { id: 'dtsm-jiacong-2', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 37.9 },
      { id: 'dtsm-jiacong-3', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 34.7 },
      { id: 'dtsm-jiacong-4-misprint', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 33 },
      { id: 'dtsm-jiacong-5', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 32.1 },
    ]);
  });

  /**
   * 자료를 열다섯 건 넓히자 계통별로 성적이 갈리는 것이 드러난다. 밖으로 종하는
   * 계열은 자당 몫이 문턱 근처(25~40%)에 촘촘히 몰려 있어 ≤30% 한 줄로는 절반쯤만
   * 걸린다. 반대로 **안으로 종하는 계열은 85~92% 로 문턱에서 멀찍이 떨어져 있다** —
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
  });

  /**
   * **假從 다섯 중 하나가 잡힌다.** 넷은 여전히 못 잡는다.
   *
   * 잡힌 하나(`dtsm-jiacong-1`)가 무엇 때문에 잡혔는지가 요점이다. 문턱을
   * 내려서가 아니다 — 이 명조의 己土는 巳와 亥의 **여기(餘氣) 戊** 둘에 걸려
   * 있는데, 예전 셈은 그것을 「같은 오행 뿌리 0.5 짜리 둘 = 1.0」으로 세어
   * 가종 문턱(0.5) 밖으로 밀어냈다. 뿌리의 질로 다시 재면 0.33 이라 문턱 안이다.
   * 자당 몫은 25% 로 예전과 거의 같다 — 움직인 것은 뿌리 쪽이다.
   *
   * 남은 넷은 자당 몫이 32~38% 로 밖으로 종하는 문턱 위에 있다. 이것은 假從
   * 계열의 성질이라(「局中雖有劫印，亦自顧不暇」) 문턱을 그쪽으로 넓히면 모집단
   * 발화율이 함께 오른다. 여기서 잃는 것을 받아들인다.
   */
  it('가종은 다섯 중 하나만 잡고 나머지 넷이 어디에 걸리는지 남긴다', () => {
    const jiacong = FOLLOWING_EXTERNAL_CASES.filter((c) => c.id.startsWith('dtsm-jiacong-'));
    expect(jiacong).toHaveLength(5);

    const caught = jiacong.filter((c) => engineFollows(assess(c.pillars).verdict));
    expect(caught.map((c) => c.id)).toEqual(['dtsm-jiacong-1']);

    // 뿌리를 개수로 세면 문턱 밖, 질로 세면 문턱 안이다.
    const one = assess(jiacong[0].pillars);
    expect(one.rootScore).toBeLessThan(FOLLOWING_PATTERN_POLICY.classification.pseudoMaxRootScore * 3);
    expect(one.facts.dayMasterRootless).toBe(false);

    // 못 잡는 넷은 전부 자당 몫이 문턱 위에 있다 — 뿌리 문제가 아니다.
    for (const testCase of jiacong.slice(1)) {
      expect(assess(testCase.pillars).selfShare, testCase.id).toBeGreaterThan(
        FOLLOWING_PATTERN_POLICY.dominance.outwardMaxSelfShare,
      );
    }
  });

  /**
   * 재현율 **14/30 → 17/30.** 오검출은 그대로 1/4 이다.
   *
   * 문턱을 만지지 않고 얻은 값이다. 세는 법을 셋 고쳤다 — 국(局)과 합화를
   * 세력에 반영했고, 뿌리를 개수가 아니라 질로 재고, 충에 뽑히거나 국에 끌려간
   * 뿌리를 얕게 본다. 덜 잡는 쪽으로 틀리는 성향은 그대로다.
   */
  it('현재 재현율과 오검출을 숫자로 남긴다', () => {
    const results = SCORED.map((testCase) => ({
      claimed: claimsFollowing(testCase.claim.verdict),
      engine: engineFollows(assess(testCase.pillars).verdict),
    }));

    const claimed = results.filter((r) => r.claimed);
    const rejected = results.filter((r) => !r.claimed);

    expect(claimed).toHaveLength(30);
    expect(claimed.filter((r) => r.engine)).toHaveLength(17);
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

    expect(recall('modern-chinese')).toEqual([10, 14]);
    expect(recall('classical-chinese')).toEqual([7, 16]);
  });

  /**
   * **재현율은 이제 절반을 넘는다. 그래도 게이트는 닫아 둔다.**
   *
   * 여태 이 테스트는 「재현율이 절반 아래니 못 연다」고 적어 두었다. 그 조건이
   * 풀렸으므로 이유를 다시 적는다 — 게이트를 막고 있는 것은 재현율이 아니라
   * 남은 둘이다.
   *
   * 1. **모집단 발화율이 고전이 말하는 희소성과 자릿수가 다르다.** 《적천수천미》는
   *    격국이 진실하고 순수한 것을 「百無一二」라 했는데 여기서는 진종·가종을
   *    합쳐 10% 대다. 억부를 뒤집는 판정이 백에 열이면, 뒤집힌 쪽이 맞는지
   *    확인할 길 없이 열 명 중 한 명의 용신이 반대로 나온다.
   * 2. **오검출이 남아 있다.** 출처가 종격이 아니라고 못박은 넷 중 하나를
   *    아직 가종으로 본다.
   *
   * 재현율이 오른 것을 게이트 통과로 읽지 못하게 이 테스트가 조건을 값으로 든다.
   */
  it('재현율은 절반을 넘었지만 발화율과 오검출 때문에 억부를 덮어쓰지 않는다', () => {
    const claimed = SCORED.filter((testCase) => claimsFollowing(testCase.claim.verdict));
    const caught = claimed.filter((testCase) => engineFollows(assess(testCase.pillars).verdict));
    const rates = FOLLOWING_PATTERN_POLICY.dominance.calibration.observedRates;

    expect(caught.length / claimed.length).toBeGreaterThan(0.5);

    // 남은 조건 둘. 이 둘이 풀리기 전에는 열지 않는다.
    expect(rates['true-following'] + rates['pseudo-following']).toBeGreaterThan(0.02);
    expect(FOLLOWING_PATTERN_POLICY.dominance.externalCheck.falsePositives).toBeGreaterThan(0);

    expect(FOLLOWING_PATTERN_POLICY.eokbuOverride).toBe('disabled');
    expect(FOLLOWING_PATTERN_POLICY.dominance.externalCheck.passed).toBe(false);
  });
});
