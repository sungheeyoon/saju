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

/** 네 기둥 문자열을 계산판으로 — 뿌리를 따로 보는 시험도 이것을 쓴다 */
function chartOf(pillars: (typeof FOLLOWING_EXTERNAL_CASES)[number]['pillars']) {
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

function assess(pillars: (typeof FOLLOWING_EXTERNAL_CASES)[number]['pillars']) {
  const input = chartOf(pillars);
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
   *
   * **2026-09-25 에 무게가 바뀌었다**(월지 ×2 · 지장간 60:30:10, ADR 0114). 문턱은 또 그대로고
   * `selfShare` 는 거의 모든 줄에서 움직였다. 판정이 바뀐 여덟 줄에 옛 값을 적었다 — 일곱은 자당 몫이
   * 30% 문턱 밑으로 내려와 종격 쪽으로 왔고(출처가 종격이라 한 것 일곱 · 셋은 가종까지, 넷은 뿌리로 후보),
   * 하나(`qlmg-yan-father`, 출처는 종격 아님)는 28 → 30.6 으로 올라가 후보에서 빠졌다. 오검출 둘은 그대로다.
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
      // ADR 0114 전: not-following · 31.7
      { id: 'kill-1', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 29.4 },
      { id: 'kill-2', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 11.1 },
      { id: 'kill-3', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 18.9 },
      { id: 'kill-4', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 22.2 },
      { id: 'kill-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 23.3 },
      // ADR 0114 전: not-following · 31.2
      { id: 'kill-6', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 26.5 },
      { id: 'kill-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 17.8 },
      { id: 'kill-8-broken', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 33.3 },
      { id: 'kill-9-similar', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 41.7 },
      { id: 'money-1', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 16.7 },
      { id: 'money-2', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 23.9 },
      { id: 'money-3', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 21.1 },
      { id: 'money-4', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 28.9 },
      { id: 'money-5-excluded', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 40.7 },
      // ADR 0114 전: not-following · 30.2
      { id: 'money-6', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 29.4 },
      { id: 'money-7', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 16.1 },
      { id: 'money-8', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 15 },
      { id: 'money-9-excluded', claim: 'not-following', engine: 'pseudo-following', direction: 'outward', selfShare: 17.8 },
      { id: 'dtsm-following-strong', claim: 'following', engine: 'pseudo-following', direction: 'inward', selfShare: 75.3 },
      { id: 'dtsm-following-weak', claim: 'following', engine: 'not-following', direction: null, selfShare: 32.2 },
      // 從象 열 — 안으로 종하는 둘에 더해, 삼합국을 반영하자 넷째가 진종으로 올라온다.
      { id: 'dtsm-congxiang-1', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 23.3 },
      // ADR 0114 전: not-following · 36.7
      { id: 'dtsm-congxiang-2', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 27.8 },
      { id: 'dtsm-congxiang-3', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 25.6 },
      { id: 'dtsm-congxiang-4', claim: 'following', engine: 'true-following', direction: 'outward', selfShare: 17.2 },
      { id: 'dtsm-congxiang-5', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 23.3 },
      { id: 'dtsm-congxiang-6-wang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 94.7 },
      { id: 'dtsm-congxiang-7-qiang', claim: 'following', engine: 'true-following', direction: 'inward', selfShare: 83.3 },
      { id: 'dtsm-congxiang-8-qi', claim: 'following', engine: 'not-following', direction: null, selfShare: 34.2 },
      { id: 'dtsm-congxiang-9-shi', claim: 'following', engine: 'not-following', direction: null, selfShare: 33.3 },
      { id: 'dtsm-congxiang-10', claim: 'following', engine: 'not-following', direction: null, selfShare: 33.3 },
      // 假從 다섯 — 옛 무게에서는 하나가 잡혔다(여기 뿌리 둘을 정기 둘처럼 세던 것을 고친 몫). 지금은 둘.
      { id: 'dtsm-jiacong-1', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 19.3 },
      { id: 'dtsm-jiacong-2', claim: 'pseudo-following', engine: 'not-following', direction: null, selfShare: 43.2 },
      // ADR 0114 전: not-following · 34.7
      { id: 'dtsm-jiacong-3', claim: 'pseudo-following', engine: 'candidate', direction: 'outward', selfShare: 29.7 },
      // ADR 0114 전: not-following · 33
      { id: 'dtsm-jiacong-4-misprint', claim: 'pseudo-following', engine: 'pseudo-following', direction: 'outward', selfShare: 26.1 },
      // ADR 0114 전: not-following · 32.1
      { id: 'dtsm-jiacong-5', claim: 'pseudo-following', engine: 'candidate', direction: 'outward', selfShare: 26.7 },
      { id: 'qlmg-xu-shiying', claim: 'not-following', engine: 'pseudo-following', direction: 'outward', selfShare: 22.8 },
      { id: 'qlmg-qian-weng', claim: 'not-following', engine: 'candidate', direction: 'outward', selfShare: 26.1 },
      { id: 'qlmg-xuantong', claim: 'following', engine: 'pseudo-following', direction: 'outward', selfShare: 22.2 },
      // ADR 0114 전: candidate · 28
      { id: 'qlmg-yan-father', claim: 'not-following', engine: 'not-following', direction: null, selfShare: 30.6 },
      { id: 'qlmg-abandon-hurt', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 22.2 },
      { id: 'qlmg-yanfeng-2nd', claim: 'following', engine: 'candidate', direction: 'outward', selfShare: 16.1 },
    ]);
  });

  /**
   * 자료를 열다섯 건 넓히자 계통별로 성적이 갈리는 것이 드러난다. 밖으로 종하는
   * 계열은 자당 몫이 문턱 근처(25~40%)에 촘촘히 몰려 있어 ≤30% 한 줄로는 절반쯤만
   * 걸린다. 반대로 **안으로 종하는 계열은 75~95% 로 문턱에서 멀찍이 떨어져 있다**(ADR 0114 전 73~92%) —
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
   * **假從 다섯 중 둘이 잡힌다**(ADR 0114 전에는 하나). 셋은 못 잡는다.
   *
   * 아래 네 문단은 옛 무게(월지 ×1 · 사령 일수)에서 적은 것이다. 월지 ×2 · 60:30:10 에서는
   * `dtsm-jiacong-4-misprint`(판본 오배라 채점에서 빠지는 줄)가 자당 26.1% 로 가종이 되고, `-3` · `-5` 는
   * 자당이 문턱 안(29.7 · 26.7%)으로 들어왔으나 뿌리로 후보에 머문다. 문 밖에 남은 것은 `-2`(43.2%) 하나다.
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
    expect(caught.map((c) => c.id)).toEqual(['dtsm-jiacong-1', 'dtsm-jiacong-4-misprint']);

    // 뿌리를 개수로 세면 문턱 밖, 질로 세면 문턱 안이다.
    const one = assess(jiacong[0].pillars);
    expect(one.rootScore).toBeLessThan(FOLLOWING_PATTERN_POLICY.classification.pseudoMaxRootScore * 3);
    expect(one.facts.dayMasterRootless).toBe(false);

    // 못 잡는 셋 — 하나는 자당 몫이 문턱 위, 둘은 문턱 안인데 뿌리로 후보에 머문다.
    const missed = jiacong.filter((c) => !engineFollows(assess(c.pillars).verdict));
    expect(
      missed.map((c) => {
        const found = assess(c.pillars);
        return `${c.id}:${found.selfShare > FOLLOWING_PATTERN_POLICY.dominance.outwardMaxSelfShare ? 'outside' : found.verdict}`;
      }),
    ).toEqual(['dtsm-jiacong-2:outside', 'dtsm-jiacong-3:candidate', 'dtsm-jiacong-5:candidate']);
  });

  /**
   * 재현율 **14/30 → 17/30.** 오검출은 그대로 1/4 이다.
   *
   * 자료가 마흔으로 넓어진 뒤 18/33 · 오검출 2/7 이었고, 월지 ×2 · 60:30:10(ADR 0114)에서 **20/33** 이 됐다 —
   * 오검출은 2/7 그대로다(`kill-6` · `dtsm-congxiang-2` 가 가종으로 올라왔다).
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

    expect(claimed).toHaveLength(33);
    expect(claimed.filter((r) => r.engine)).toHaveLength(20);
    expect(rejected).toHaveLength(7);
    expect(rejected.filter((r) => r.engine)).toHaveLength(2);
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

    // ADR 0114 전 10/14 · 7/16 — 현대는 `kill-6`, 고전은 `dtsm-congxiang-2` 가 하나씩 더 잡혔다.
    expect(recall('modern-chinese')).toEqual([11, 14]);
    expect(recall('classical-chinese')).toEqual([8, 16]);
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

  /**
   * **놓친 열셋을 세 무리로 가른다 — 「문턱이 낮아서」가 아니다.**
   *
   * 재현율이 17/30 에 멈춘 이유를 문턱 탓으로 두면 다음 사람이 문턱부터 만진다. 그래서
   * 놓친 자리가 **무엇 때문에** 놓쳤는지를 여기서 고정한다. 지렛대 넷을 당겨 본 결과는
   * `FOLLOWING_PATTERN_POLICY.dominance.externalCheck` 위의 표에 있다 — 넷 다 재현율을
   * 발화율로 산다.
   */
  it('놓친 자리를 세 무리로 고정한다', () => {
    const missed = SCORED.filter(
      (testCase) =>
        claimsFollowing(testCase.claim.verdict) && !engineFollows(assess(testCase.pillars).verdict),
    );

    // ADR 0114 전 15 — 문 밖 11 · 뿌리 4. 월지 ×2 · 60:30:10 에서 자당 몫이 문턱 밑으로 내려온 여섯 중
    // 둘은 잡혔고(`kill-6` · `dtsm-congxiang-2`) 넷(`kill-1` · `money-6` · `dtsm-jiacong-3` · `-5`)은 뿌리 무리로 옮겼다.
    expect(missed).toHaveLength(13);

    const { outwardMaxSelfShare } = FOLLOWING_PATTERN_POLICY.dominance;

    /** 1. 자당이 문 밖 — 假從은 정의상 자당이 남아 있어 진종과 같은 문턱으로 못 담는다 */
    const outsideDoor = missed.filter(
      (testCase) => assess(testCase.pillars).selfShare > outwardMaxSelfShare,
    );

    /** 2. 문 안인데 뿌리로 후보에 머문 것 — 문턱이 아니라 뿌리 등급의 문제다 */
    const heldByRoot = missed.filter((testCase) => {
      const one = assess(testCase.pillars);
      return one.selfShare <= outwardMaxSelfShare && one.verdict === 'candidate';
    });

    expect(outsideDoor).toHaveLength(5);
    expect(heldByRoot.map((testCase) => testCase.id)).toEqual([
      'kill-1',
      'kill-3',
      'money-6',
      'dtsm-congxiang-1',
      'dtsm-jiacong-3',
      'dtsm-jiacong-5',
      // 셋째 계통이 이 무리를 둘 더 데려왔다 — 문 안인데 뿌리가 0.52·0.64 다.
      'qlmg-abandon-hurt',
      'qlmg-yanfeng-2nd',
    ]);

    // 두 무리가 열셋을 다 덮는다 — 남는 것이 있으면 무리를 하나 더 세워야 한다.
    expect(outsideDoor.length + heldByRoot.length).toBe(missed.length);

    /**
     * 문 밖 다섯 가운데 하나(`dtsm-congxiang-8-qi`)는 **從氣**다 — 기세를 따르는 것이라
     * 자당 축으로 재는 자리가 아니다. 옛 무게에서는 자당이 41.1% 로 가장 높았고, 지금은 34.2% 로
     * `dtsm-jiacong-2`(43.2%) 다음이다 — 「가장 높다」는 표시는 무게를 따라 사라졌다.
     */
    const qi = outsideDoor.find((testCase) => testCase.id === 'dtsm-congxiang-8-qi')!;
    expect(assess(qi.pillars).selfShare).toBeGreaterThan(0.34);
  });

  /**
   * **뿌리로 후보에 머문 넷이 무엇으로 버티는지 짚는다.**
   *
   * 「문턱이 낮아서」가 아니라는 것까지는 위 시험이 고정했다. 여기서는 한 칸 더 들어간다 —
   * 그 자리를 **무엇이 붙잡고 있는가**. 셋은 **충 없는 묘고(墓庫)의 중기 뿌리 하나**로
   * 버티고, 넷째는 진짜 록(祿)이라 성질이 다르다.
   *
   * 이 구성이 바뀌면 `ROOT_QUALITY_POLICY.branchClass` 의 감도 표(거기 적어 둔 sweep)가
   * 함께 낡는다. 그래서 표가 아니라 **구성**을 여기서 잠근다 — 숫자는 규칙이 바뀌면 다시
   * 재면 되지만, 「무엇 때문에 못 넘어오는가」가 달라지면 그 표를 읽는 방법 자체가 달라진다.
   */
  /*
   * 월지 ×2 · 60:30:10(ADR 0114)에서 이 무리에 넷이 더 들었다(`kill-1` · `money-6` · `dtsm-jiacong-3` · `-5`).
   * 넷 다 **충 없는 묘고의 정기 뿌리**(未 · 丑 · 辰 의 己 · 戊)로 버틴다 — 옛 넷의 중기와 다른 자리라 따로 잠근다.
   */
  it('뿌리로 막힌 자리가 무엇으로 버티는지 고정한다', () => {
    const held = [
      'kill-3',
      'dtsm-congxiang-1',
      'qlmg-abandon-hurt',
      'qlmg-yanfeng-2nd',
      'kill-1',
      'money-6',
      'dtsm-jiacong-3',
      'dtsm-jiacong-5',
    ];

    const rooted = held.map((id) => {
      const testCase = FOLLOWING_EXTERNAL_CASES.find((one) => one.id === id)!;
      const chart = chartOf(testCase.pillars);
      const quality = rootQualityOf(rootednessOf(chart), chart, bureausOf(chart)).dayMaster;

      /** 이 자리를 붙잡고 있는 가장 무거운 뿌리 하나 */
      const heaviest = [...quality.roots].sort((a, b) => b.strength - a.strength)[0];

      return {
        id,
        branchClass: heaviest.branchClass,
        role: heaviest.root.role,
        clashed: heaviest.clashed,
      };
    });

    expect(rooted).toEqual([
      { id: 'kill-3', branchClass: 'storage', role: '中氣', clashed: false },
      { id: 'dtsm-congxiang-1', branchClass: 'storage', role: '中氣', clashed: false },
      { id: 'qlmg-abandon-hurt', branchClass: 'storage', role: '中氣', clashed: false },
      // 넷째만 다르다 — 亥의 정기 壬은 壬의 녹이라 묘고 이야기가 아니다.
      { id: 'qlmg-yanfeng-2nd', branchClass: 'birth', role: '正氣', clashed: false },
      // 새로 든 넷 — 묘고의 정기.
      { id: 'kill-1', branchClass: 'storage', role: '正氣', clashed: false },
      { id: 'money-6', branchClass: 'storage', role: '正氣', clashed: false },
      { id: 'dtsm-jiacong-3', branchClass: 'storage', role: '正氣', clashed: false },
      { id: 'dtsm-jiacong-5', branchClass: 'storage', role: '正氣', clashed: false },
    ]);
  });
});
