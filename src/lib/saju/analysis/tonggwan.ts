import { CONTROLS, ELEMENTS, GENERATES, STEM_INFO, type Element, type Stem } from '../constants';
import type { ElementDistribution } from './fiveElements';

/**
 * 통관(通關) — **맞선 두 세력 사이를 잇는 자리.**
 *
 * 용신을 잡는 네 길 중 하나인데(억부·조후·통관·병약) 이 저장소에는 여태 한 줄도
 * 없었다. 억부가 언제나 답을 하나 냈기 때문이다 — 「무엇이 가장 무거운가」로 한쪽을
 * 고르고 그 반대편을 권한다. 그런데 **두 세력이 팽팽히 맞선 명식에서는 그 물음 자체가
 * 답을 못 낸다.** 금과 목이 39% 대 38% 로 서 있으면 어느 쪽을 누르든 나머지 한쪽이
 * 그대로 남고, 고전이 그 자리에 쓰라고 한 것이 통관이다.
 *
 * ## 그런데 여기서 판정하지 않는다
 *
 * 통관은 「언제 통관으로 갈아타는가」가 먼저다 — 얼마나 맞서야 대치(相戰)인가, 대치면
 * 억부를 제치는가. **그 문턱이 계통마다 갈린다.** 종격이 같은 자리에서 먼저 겪은
 * 일이고(`followingPatterns.ts`), 거기서 택한 길을 그대로 따른다: **문턱을 고르지
 * 않고도 셀 수 있는 것은 세고, 결론만 미룬다.**
 *
 * 그래서 `status: 'facts-only'` 이고 `isTonggwan` 같은 boolean 은 없다. 나중에 계통을
 * 채택해도 이 층은 그대로 쓰인다 — 채택이 하는 일은 이 값들 위에 선을 긋는 것뿐이다.
 *
 * ## 잇는 오행은 고를 것이 없다
 *
 * 문턱은 갈려도 **통관신이 무엇인가는 표에서 곧장 나온다.** 극하는 쪽이 낳는 것이
 * 곧 극당하는 쪽을 낳는 것이기 때문이다 — 金剋木 사이에는 水가 서고(金生水, 水生木),
 * 다섯 극 관계가 전부 그렇다. 상생·상극이 같은 고리의 한 칸 건너뛰기와 두 칸
 * 건너뛰기라서 그렇지, 우리가 고른 것이 아니다. 시험이 다섯 쌍에서 그 항등을 잠근다.
 *
 * ## 다섯 쌍을 다 낸다
 *
 * 극 관계는 정확히 다섯이다(木剋土·土剋水·水剋火·火剋金·金剋木). 「대치인 것만」
 * 골라 내면 그 고르는 자리가 곧 문턱이므로, **다섯을 다 내고 순서만 매긴다.**
 * 읽는 쪽이 어디서 자를지 정한다.
 */

/**
 * 맞선 한 쌍 — 극하는 쪽, 극당하는 쪽, 그 사이.
 *
 * 몫은 전부 **실효 분포**(`ratios`)에서 온다. 강약·억부·종격·격국이 모두 그 분포에서
 * 세력을 재므로, 여기만 글자 그대로의 분포를 보면 한 화면 안에서 같은 세력을 두 번
 * 다르게 세게 된다.
 */
export type TonggwanPair = {
  /** 극하는 쪽 */
  controller: Element;
  /** 극당하는 쪽 */
  controlled: Element;
  /** 사이를 잇는 오행 — 극하는 쪽이 낳고, 그것이 극당하는 쪽을 낳는다 */
  bridge: Element;
  /** 셋의 실효 몫 */
  shares: { controller: number; controlled: number; bridge: number };
  /**
   * 맞선 둘 중 **가벼운 쪽**의 몫.
   *
   * 대치의 크기는 무거운 쪽이 아니라 가벼운 쪽이 정한다. 금이 60% 라도 목이 2% 면
   * 맞선 것이 아니라 한쪽이 없는 것이고, 그때 필요한 것은 통관이 아니다.
   */
  facing: number;
  /** 맞선 둘의 몫 차이 — 0 에 가까울수록 팽팽하다 */
  gap: number;
  /** 잇는 오행이 원국 여덟 글자에 실제로 있는가 — 없으면 이을 손이 없다 */
  bridgePresent: boolean;
  /**
   * 일간이 이 대치의 어디에 서 있는가.
   *
   * 통관은 일간을 돕는 길이라 **일간이 낀 대치인지가 다른 사실이다.** 남의 두 세력이
   * 맞선 것과 내가 그 사이에 낀 것은 같은 숫자라도 다른 이야기다.
   */
  dayMasterAt: 'controller' | 'controlled' | 'bridge' | 'outside';
};

export type TonggwanCandidacy = {
  /** 판정이 아니라 재료임을 값으로 못박는다 */
  status: 'facts-only';
  /**
   * 다섯 극 관계 전부 — **가벼운 쪽이 무거운 순.**
   *
   * 정렬은 문턱이 아니다. 자르지 않고 순서만 매긴다.
   */
  pairs: readonly TonggwanPair[];
  /** 그중 첫째. 「가장 팽팽한 쌍」이지 「이 명식은 통관이다」가 아니다 */
  tightest: TonggwanPair;
};

export const TONGGWAN_POLICY = {
  ruleSet: 'tonggwan-facts-only-v1',
  /** 문턱을 고르지 않았다 — 사실만 낸다 */
  status: 'facts-only',
  /** `isTonggwan` 같은 판정은 없다. 대치인지 아닌지를 말하지 않는다 */
  verdict: 'none',
  /** 통관신은 상생 고리에서 곧장 나온다 — 여기서 고르는 자리가 아니다 */
  bridge: 'derived-from-generation-cycle',
  /** 세력은 강약·억부와 같은 실효 분포에서 잰다 */
  basis: 'effective-distribution',
  /** 다섯 쌍을 다 내고 가벼운 쪽이 무거운 순으로 세운다 */
  ordering: 'weaker-side-descending',
  /**
   * 억부를 뒤집지 않는다 — **뒤집을 판정 자체가 없다.**
   *
   * 종격·격국의 같은 이름 스위치와 값은 같지만 이유가 한 칸 앞이다. 그 둘은
   * 판정해 놓고 안 쓰는 것이고, 이쪽은 아직 판정하지 않는다.
   */
  eokbuOverride: 'disabled',
  /**
   * **문턱을 고르지 않았어도 바탕은 재어 둔다.**
   *
   * 종격이 문턱을 정할 때 겪은 일에서 배운다 — 모집단 발화율을 함께 재지 않으면
   * 「재현율이 올랐다」가 규칙이 좋아진 것인지 문턱이 헐거워진 것인지 구별할 수
   * 없었다. 통관은 아직 아무 선도 안 긋지만, 긋는 날 이 표가 없으면 그 사람은
   * 표본을 새로 만들고 여기 적힌 것과 비교할 수 없는 숫자를 얻는다.
   *
   * 같은 모집단(`population.ts`, 시드 20260821)에서 잰 「가장 팽팽한 쌍의 가벼운
   * 쪽 몫」 분포다. 0.30 에 선을 그으면 10.2% 가 걸리는데, 그것은 종격 발화율
   * (10.6%)과 자릿수가 같다 — **참고일 뿐 채택이 아니다.**
   */
  calibration: {
    sample: 3000,
    method: 'random-charts-1930-2019',
    axis: 'weaker-side share of a control pair',
    measuredAt: '2026-09-05',
    /** 가장 팽팽한 쌍의 `facing` 이 이 값 이상인 비율 */
    facingAtLeast: { 0.15: 0.896, 0.2: 0.62, 0.25: 0.378, 0.3: 0.102, 0.35: 0.022 },
    median: 0.218,
    /** 가장 팽팽한 쌍의 통관신이 원국에 아예 없는 비율 */
    bridgeAbsent: 0.203,
    note: 'no-threshold-chosen',
  },
  /** 외부 대조 — 아직 없다. 없다는 것을 값으로 남긴다 */
  externalCheck: { dataset: null, cases: 0, passed: false },
  sources: {
    doctrine: 'https://zh.wikisource.org/wiki/滴天髓',
  },
} as const;

type TonggwanInput = { dayMaster: Stem };

/** 다섯 극 관계 — 표에서 그대로 나온다 */
const CONTROL_PAIRS: readonly { controller: Element; controlled: Element }[] = ELEMENTS.map(
  (controller) => ({ controller, controlled: CONTROLS[controller] }),
);

/**
 * 맞선 다섯 쌍의 사실을 낸다.
 *
 * 판정하지 않으므로 실패할 자리가 없다 — 어떤 명식에서도 다섯 쌍이 그대로 나온다.
 * 「대치가 없다」는 결론도 여기서 내지 않는다. 다섯 쌍의 `facing` 이 전부 작다는
 * 사실이 그 자리를 대신하고, 얼마나 작아야 아닌지는 읽는 쪽이 정한다.
 */
export function tonggwanCandidacyOf(
  pillars: TonggwanInput,
  distribution: ElementDistribution,
): TonggwanCandidacy {
  const dayMasterElement = STEM_INFO[pillars.dayMaster].element;
  const { ratios, counts } = distribution;

  const pairs = CONTROL_PAIRS.map(({ controller, controlled }): TonggwanPair => {
    const bridge = GENERATES[controller];

    return {
      controller,
      controlled,
      bridge,
      shares: {
        controller: ratios[controller],
        controlled: ratios[controlled],
        bridge: ratios[bridge],
      },
      facing: Math.min(ratios[controller], ratios[controlled]),
      gap: Math.abs(ratios[controller] - ratios[controlled]),
      bridgePresent: counts[bridge] > 0,
      dayMasterAt:
        dayMasterElement === controller
          ? 'controller'
          : dayMasterElement === controlled
            ? 'controlled'
            : dayMasterElement === bridge
              ? 'bridge'
              : 'outside',
    };
  }).sort(
    // 가벼운 쪽이 무거운 순. 같으면 덜 벌어진 쪽이 앞이고, 그래도 같으면 오행 차례다 —
    // 같은 명식에서 두 번 부르면 같은 순서가 나와야 한다.
    (a, b) =>
      b.facing - a.facing ||
      a.gap - b.gap ||
      ELEMENTS.indexOf(a.controller) - ELEMENTS.indexOf(b.controller),
  );

  return { status: 'facts-only', pairs, tightest: pairs[0] };
}
