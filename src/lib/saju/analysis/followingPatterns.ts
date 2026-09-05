import { STEM_INFO, principalStem, type Element, type Stem } from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';
import type { ElementDistribution } from './fiveElements';
import type { Rootedness } from './rootedness';
import { EFFECTIVE_ROOT_FLOOR, type RootQuality } from './rootQuality';
import { elementRolesOf, type ElementRole } from './yongsin';

/**
 * 종격(從格) 조사 정책.
 *
 * 이 파일은 판정기가 아니다. 종격은 억부와 반대 방향의 용신을 낼 수 있으므로,
 * 어느 계통의 어떤 문턱을 채택할지 정하기 전에 boolean 하나로 축약하지 않는다.
 * 고전에서 확인한 공통분모와 아직 결정하지 않은 쟁점을 먼저 데이터로 고정한다.
 */

export type FollowingPatternKind =
  | 'followWealth'
  | 'followOfficerKill'
  | 'followProsperous'
  | 'followStrong'
  | 'followQi'
  | 'followMomentum';

export const FOLLOWING_PATTERN_KIND_KO: Record<FollowingPatternKind, string> = {
  followWealth: '종재',
  followOfficerKill: '종관살',
  followProsperous: '종왕',
  followStrong: '종강',
  followQi: '종기',
  followMomentum: '종세',
};

/**
 * 종격 후보의 조건이 되는 **사실**.
 *
 * 어느 계통이든 종(從)을 말하려면 이 넷을 먼저 본다 — 일간이 뿌리가 없는가,
 * 어느 세력이 얼마나 무거운가, 월령을 그 세력이 잡았는가, 천간에 생부가 드러나
 * 있는가. 계통마다 갈리는 것은 **여기에 어디서 선을 긋느냐**지 이 값들이 아니다.
 *
 * 그래서 판정하지 않는다. `isFollowing` 같은 boolean 은 없고, 종재격인지
 * 종관살격인지도 말하지 않는다. 문턱을 채택하면 이 값들 위에서 바로 나온다.
 */
export type FollowingCandidacy = {
  /** 판정이 아니라 재료임을 값으로 못박는다 */
  status: 'facts-only';
  /** 일간이 지지 어디에도 통근하지 않았는가 — 종의 가장 앞 조건이다 */
  dayMasterRootless: boolean;
  /** 일간을 돕는 세력(비겁+인성)의 비중 */
  supportRatio: number;
  /** 가장 무거운 세력과 그 비중 */
  dominant: { role: ElementRole; element: Element; ratio: number };
  /** 월령(월지 정기)이 그 세력에 속하는가 */
  monthCommandsDominant: boolean;
  /**
   * 천간에 드러난 생부 — 비겁·인성이 투간해 있는가.
   *
   * 일간 자신은 세지 않는다. 생부가 드러나 있으면 종이 어려워진다는 것이 계통
   * 공통분모지만, "몇 자까지 봐주는가"가 가종(假從) 문턱이라 세기만 한다.
   */
  supportStems: { position: PillarPosition; stem: Stem; role: ElementRole }[];
  /**
   * 천간에 드러난 이당 — 식상·재성·관성이 투간해 있는가.
   *
   * 안으로 종(從强·從旺)에서 생부와 같은 구실을 한다. 일간이 극왕해도 천간에
   * 관살이 버티고 있으면 따를 것이 아니라 싸울 것이 있다는 뜻이다.
   */
  opposingStems: { position: PillarPosition; stem: Stem; role: ElementRole }[];
};

export type FollowingPatternDecision =
  | 'hiddenSupport'
  | 'storageRoot'
  | 'neutralizedSupport'
  | 'combinationTransformationOrder'
  | 'dominanceThreshold'
  | 'monthCommandRequirement'
  | 'trueVersusFalseFollowing';

/**
 * 출처와 미결정 사항까지 포함한 종격 정책. UI/엔진이 `status` 를 확인하지 않고
 * 종격 성립값처럼 쓰지 못하도록 상태를 명시한다.
 */
export const FOLLOWING_PATTERN_POLICY = {
  ruleSet: 'following-patterns-experimental-v2',
  /**
   * 판정을 시작한다. 다만 **고전이 정한 문턱이 아니라 이 엔진의 실험값**이다 —
   * 아래 `dominance.calibration` 이 그 숫자가 어디서 나왔는지 적는다.
   */
  status: 'experimental',
  /**
   * 판정은 안 하되 **조건이 되는 사실은 낸다**(`followingCandidacyOf`).
   *
   * 문턱을 고르지 않고도 "일간이 무근인가, 어느 세력이 몇 %인가, 월령을 누가
   * 잡았는가"는 셀 수 있다. 계통마다 다른 것은 그 사실에 어디서 선을 긋느냐지
   * 사실 자체가 아니다. 그래서 재료는 내고 결론만 미룬다 — 나중에 계통을
   * 채택해도 이 층은 그대로 쓰인다.
   */
  candidacy: 'facts-only-no-verdict',
  selectedLineage: null,
  /**
   * **억부를 뒤집지 않는다.** 외부 종격 명조를 모아 이 규칙이 그것을 잡는지
   * 확인하기 전까지는 켜지 않는다. 억부는 외부 사례를 대조하고도 시험값에
   * 머물러 있는데, 그 답을 정반대로 뒤집는 판정이 외부 대조 0건으로 상위에
   * 설 수는 없다.
   */
  eokbuOverride: 'disabled',
  /**
   * 무근은 **남은 것이 있는가**로 본다 — 개수가 아니다.
   *
   * 예전에는 뿌리 개수가 0인가만 물었다. 그러면 《적천수천미》가 「丙火之根已拔」
   * 이라 적은 명조를 「寅에 통근함」으로 세게 된다 — 寅이 申 셋에게 충을 맞아
   * 뽑힌 것을 안 보았기 때문이다. 세어진 뿌리와 남은 뿌리는 다르다.
   */
  rootless: { requiredForTrueFollowing: true, by: 'root-quality-strength' },
  /**
   * 뿌리의 무게는 `ROOT_QUALITY_POLICY` 가 매긴다 — 여기서 다시 정하지 않는다.
   *
   * 같은 글자 1 · 같은 오행 0.5 로 세던 표를 걷어냈다. 그 표는 뿌리가 **어디에**
   * 걸렸는지를 보지 않아, 월지 정기에 걸린 뿌리와 시지 고지의 여기에 걸린 뿌리를
   * 같은 무게로 세었다. 假從 명조가 여기(餘氣) 뿌리 둘로 「뿌리 1.0」이 되어
   * 가종 문턱 밖으로 밀려나던 것이 그 때문이다.
   */
  roots: 'graded-by-root-quality',
  /** 세력은 국(局)과 합화를 반영한 실효 분포로 잰다 */
  distribution: 'effective-elements',
  /** 월령은 필수가 아니고 점수도 아니다 — 진종의 구조적 증거 둘 중 하나다 */
  month: { required: false, supportIsEvidence: true },
  dominance: {
    /**
     * 축은 **자당(비겁+인성) 몫 하나**다. 두 비율이 아니라 한 축의 양끝이다.
     *
     * 종(從)에는 방향이 둘 있다. 從財·從殺은 일간을 도울 것이 없어 **밖으로**
     * 따르고, 從强·從旺은 일간 편이 극왕해 **안으로** 따른다. 앞서 쓰던
     * `지배 ÷ (지배 + 일간편)` 은 밖으로 종만 잴 수 있었다 — 안으로 종은 지배
     * 세력이 곧 일간 편이라 그 비율이 0.5 를 넘을 수 없기 때문이다(고전 명례로
     * 확인했다). 자당과 이당은 합이 1 이므로 축 하나로 양쪽을 다 잰다.
     *
     * 지배 역할(종재냐 종살이냐)은 이름을 붙이는 데만 쓰고 문턱에는 쓰지 않는다.
     * 이당이 식상·재성·관성으로 쪼개져 있어도 일간에게는 다 같이 이당이다.
     */
    axis: 'self-camp-share',
    /** 자당이 이 아래면 밖으로 종(從財·從殺) 후보 */
    outwardMaxSelfShare: 0.3,
    /** 자당이 이 위면 안으로 종(從强·從旺) 후보 */
    inwardMinSelfShare: 0.7,
    /**
     * 이 숫자들이 어디서 나왔는지 값으로 남긴다.
     *
     * 축이 바뀌면 문턱은 뜻을 잃는다 — 실제로 앞선 축에서 쓰던 0.65 는 지금
     * 축에서 아무 뜻이 없다.
     */
    calibration: {
      sample: 3000,
      method: 'random-charts-1930-2019',
      axis: 'self-camp share = (比劫 + 印星) / all',
      dayMasterSide: ['比劫', '印星'],
      measuredAt: '2026-08-16',
      remeasuredAt: '2026-08-21',
      note: 'not-a-classical-number',
      /**
       * 이 문턱으로 실제로 나온 판정 비율(같은 3000건 표본).
       *
       * **고전이 말하는 희소성보다 크게 높다.** 《적천수천미》는 격국이 진실하고
       * 순수한 것이 "百無一二"라 했는데 여기서는 진종·가종을 합쳐 10% 대다.
       *
       * v2 에서 입력을 셋 고쳤는데도 이 값은 10.9% 에서 10.6% 로 거의 그대로다.
       * 그것이 오히려 v2 의 근거다 — 재현율이 14/30 에서 17/30 으로 오른 것이
       * 문턱을 헐겁게 해서가 아니라는 뜻이기 때문이다. 발화율을 함께 재지 않으면
       * 두 가지를 구별할 수 없다.
       *
       * 그래도 자릿수가 고전과 다르므로 이 판정은 억부를 뒤집지 않는다.
       */
      observedRates: {
        'true-following': 0.0537,
        'pseudo-following': 0.0573,
        candidate: 0.0793,
        note: 'looser-than-classical-rarity',
        /**
         * 2026-09-05 에 다시 쟀다. 앞의 값(5.2 · 5.43 · 7.7)은 왕지 월령을 정기 하나로
         * 보게 고치기 전의 것이라 낡아 있었다 — 격을 잡는 규칙이 바뀌면 국·뿌리를 거쳐
         * 이 값도 움직인다. **재는 값은 규칙이 바뀔 때마다 다시 재야 한다.**
         */
        remeasuredAt: '2026-09-05',
      },
    },
    /**
     * **재현율을 올리려면 무엇을 팔아야 하는지 재어 봤다 — 그리고 안 팔기로 했다.**
     *
     * 17/30 에서 멈춘 이유를 문턱 탓으로 두지 않고, 지렛대 넷을 같은 3000건에서
     * 재현율·오검출·발화율을 함께 재며 하나씩 당겨 봤다(2026-09-05).
     *
     * | 당긴 것 | 재현 | 오검출 | 발화율 |
     * | --- | ---: | ---: | ---: |
     * | 지금 (자당 ≤0.3) | 17/30 | 1/4 | **11.10%** |
     * | 무근이면 문을 연다 | — | 2/4 | 문 열림 19.0 → 28.5% |
     * | 문을 둘로 (진종 ≤0.35 · 가종 ≤0.3) | 18/30 | 1/4 | 12.83% |
     * | 문을 둘로 (진종 ≤0.4 · 가종 ≤0.35) | 19/30 | 1/4 | 14.27% |
     *
     * **공짜가 없다.** 재현율 한 건이 발화율 1.7~2.3%p 다. 고전은 격국이 진실하고 순수한
     * 것을 「百無一二」라 하는데 우리는 이미 11.1% 이고, 그 자릿수 차이가 게이트를 닫아 둔
     * 이유다. 그 이유를 더 나쁘게 만들면서 재현율을 사지 않는다.
     *
     * 문턱이 아닌 지렛대도 하나 재 봤다. **생부 천간이 충·합에 묶였으면 안 세는** 것 —
     * 적천수가 가종을 「남은 생부가 무력화된」 자리로 보기 때문이다. 놓친 열셋 중 다섯만
     * 그 자리이고, 모집단에서는 **34.3%** 가 걸린다. 병목이 아닌 데다 값이 너무 헐겁다.
     *
     * 놓친 열셋은 세 무리다(`following.external.test.ts` 가 고정한다).
     *
     * 1. **자당이 문 밖** 열 건 — 32~38%. 假從은 정의상 자당이 남아 있는 자리라 진종과
     *    같은 문턱으로는 못 담는다.
     * 2. **문 안인데 뿌리로 후보에 머문** 둘 — 자당 18.8% 인데 뿌리가 0.37·0.45 다.
     *    문턱이 아니라 **뿌리 등급**의 문제라 다른 축이다.
     * 3. **다른 계통** 한 건 — 從氣(기세를 따름)는 자당 축으로 재는 것이 아니다.
     *
     * 올리려면 축을 바꾸거나 자료를 늘려야 한다. 문턱으로는 못 산다.
     */
    /**
     * 외부 명조와의 대조 결과 — **아직 통과하지 못했다.**
     *
     * 종격이라고 적힌 서른 중 열일곱을 종격 쪽으로 본다(v1 은 열넷이었다).
     * 올라간 셋은 문턱을 내려서 얻은 것이 아니다 — 문턱은 그대로 두고 세는 법을
     * 고쳤다. 같은 3000건 표본의 발화율이 10.9% 에서 10.6% 로 오히려 내려간 것이
     * 그 증거다.
     *
     * 그런데도 `passed` 는 여전히 `false` 다. 재현율은 절반을 넘었지만 발화율이
     * 고전이 말하는 희소성과 자릿수가 다르고, 아니라고 적힌 넷 중 하나를 아직
     * 종격으로 본다. 자세한 행렬은 `following.external.test.ts`.
     */
    externalCheck: {
      dataset: 'followingExternalCases',
      cases: 35,
      /** 실재할 수 없는 한 건(판본 오배)은 채점에서 뺀다 */
      scored: 34,
      /**
       * 계통은 **호스트가 아니라 `lineage` 필드로 센다.** 적천수천미와 천리명고가
       * 같은 사이트라 호스트로 세면 둘이 하나가 된다.
       */
      lineages: 2,
      claimedFollowing: 30,
      caught: 17,
      falsePositives: 1,
      /**
       * 계통별로 성적이 갈린다 — 한쪽만 보면 문턱이 맞아 보인다. 고전 쪽이
       * 5/16 에서 7/16 으로 오른 것이 v2 에서 가장 크게 달라진 자리다. 삼합국과
       * 뿌리의 질은 고전 주석이 판정의 근거로 대놓고 쓰는 것들이라, 그것을 안
       * 보는 동안 고전 쪽 성적만 낮게 나오고 있었다.
       */
      recallByLineage: { 'modern-chinese': '10/14', 'classical-chinese': '7/16' },
      passed: false,
      /**
       * `skippedInputs` 도 **해결됐다** — 합화·삼합국·공협을 이제 본다
       * (`transformation.ts` · `bureau.ts` · `effectiveElements.ts`). 그 셋에
       * 기대고 있던 명조 중 `dtsm-congxiang-4` 가 진종으로 올라왔다.
       *
       * 남은 것 둘.
       *
       * `falseFollowing` 은 다섯 중 하나까지 좁혔다. 잡힌 하나는 여기(餘氣)에
       * 걸린 뿌리 둘을 정기 둘처럼 세던 것을 고쳐서 들어왔고, 남은 넷은 자당
       * 몫이 32~38% 라 문턱 자체가 막는다 — 계열의 성질이라(「局中雖有劫印，
       * 亦自顧不暇」) 문턱을 넓히면 발화율이 함께 오른다.
       *
       * `qiAndMomentum` 은 새로 이름을 붙인 것이다. 從氣·從勢는 자당 몫 하나를
       * 축으로 삼는 이 규칙이 겨눈 형태가 아니다 — 자당과 이당의 갈림이 아니라
       * 두세 오행에 몰린 기세를 따르는 것이라, 문턱이 아니라 축이 다르다.
       */
      remainingGaps: {
        falseFollowing: 'four-of-five-sit-above-outward-threshold-by-nature',
        qiAndMomentum: 'self-camp-share-is-the-wrong-axis-for-cong-qi-and-cong-shi',
      },
    },
  },
  /**
   * 합충이 뿌리에 미치는 영향은 **뿌리 질에서** 본다(`ROOT_QUALITY_POLICY`).
   *
   * 파격(破格)은 여전히 판정하지 않는다 — 「충이 격을 깬다」는 결론과 「충을 맞은
   * 지지는 뿌리 노릇을 덜 한다」는 감쇠는 다른 주장이다. 뒤엣것만 채택했다.
   */
  relationships: { rootDamageByCombination: 'via-root-quality', breakPatternByClash: false },
  /**
   * 약한 뿌리 하나까지는 가종 쪽으로 본다.
   *
   * 「약한 뿌리 하나」가 뿌리 질 눈금으로 얼마인지가 이 숫자다. 여기(餘氣)에
   * 음양만 같은 오행으로 걸린 뿌리 하나가 0.10~0.15 이므로 0.15 로 둔다.
   * 중기에 걸리면 0.3 을 넘어 여기서 빠진다 — 그 선이 가종과 후보를 가른다.
   */
  classification: { pseudoMaxRootScore: 0.15, pseudoMaxSupportStems: 1 },
  classicalSources: {
    strictFollowing: 'https://zh.wikisource.org/zh/滴天髓/07',
    expandedAndFalseFollowing: 'https://zh.wikisource.org/zh-hant/滴天髓闡微',
  },
  modernTaxonomySource: 'https://doc.8-codes.com/docs/origin/yongsin/',
  strictCommonGround: {
    dayMaster: 'rootless-and-without-effective-support',
    dominantSide: 'wealth-or-officer-kill-overwhelming',
    useDirection: 'follow-the-dominant-side',
  },
  recognizedKinds: [
    'followWealth',
    'followOfficerKill',
    'followProsperous',
    'followStrong',
    'followQi',
    'followMomentum',
  ] as const satisfies readonly FollowingPatternKind[],
  falseFollowing: 'documented-but-threshold-not-selected',
  blockingDecisions: [
    'hiddenSupport',
    'storageRoot',
    'neutralizedSupport',
    'combinationTransformationOrder',
    'dominanceThreshold',
    'monthCommandRequirement',
    'trueVersusFalseFollowing',
  ] as const satisfies readonly FollowingPatternDecision[],
} as const;


type CandidacyInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

/**
 * 종격 후보의 조건이 되는 사실을 센다 — **판정하지 않는다.**
 *
 * 세력의 무게는 오행 분포(`elements.ratios`)를 그대로 쓴다. 여기서 따로 세면
 * 강약 화면과 다른 숫자가 나와 어느 쪽이 맞는지 알 수 없게 된다.
 */
export function followingCandidacyOf(
  pillars: CandidacyInput,
  elements: ElementDistribution,
  rootedness: Rootedness,
): FollowingCandidacy {
  const roles = elementRolesOf(STEM_INFO[pillars.dayMaster].element);
  const ratioOf = (role: ElementRole) => elements.ratios[roles[role]];

  const dominantRole = (Object.keys(roles) as ElementRole[]).reduce((best, role) =>
    ratioOf(role) > ratioOf(best) ? role : best,
  );

  // 월령은 월지의 정기가 무엇인가로 본다 — 사령 일수까지 보는 것은 강약의 몫이다.
  const monthElement = STEM_INFO[principalStem(pillars.month.branch)].element;

  return {
    status: 'facts-only',
    dayMasterRootless: !rootedness.dayMaster.rooted,
    supportRatio: ratioOf('比劫') + ratioOf('印星'),
    dominant: {
      role: dominantRole,
      element: roles[dominantRole],
      ratio: ratioOf(dominantRole),
    },
    monthCommandsDominant: monthElement === roles[dominantRole],
    supportStems: PILLAR_POSITIONS.flatMap((position) => {
      // 일간 자신은 세지 않는다 — 종의 대상이지 생부가 아니다.
      const pillar = position === 'day' ? null : pillars[position];
      if (!pillar) return [];

      const element = STEM_INFO[pillar.stem].element;
      const role = (Object.keys(roles) as ElementRole[]).find((key) => roles[key] === element);

      return role === '比劫' || role === '印星' ? [{ position, stem: pillar.stem, role }] : [];
    }),
    opposingStems: PILLAR_POSITIONS.flatMap((position) => {
      const pillar = position === 'day' ? null : pillars[position];
      if (!pillar) return [];

      const element = STEM_INFO[pillar.stem].element;
      const role = (Object.keys(roles) as ElementRole[]).find((key) => roles[key] === element);

      return role && role !== '比劫' && role !== '印星'
        ? [{ position, stem: pillar.stem, role }]
        : [];
    }),
  };
}

/**
 * 종격 판정의 네 가지 상태.
 *
 * 셋이 아니라 넷인 이유가 있다. 압도적이긴 한데 진종·가종 어느 쪽으로도 밀기
 * 어려운 명식이 실제로 나온다. 셋으로 두면 그런 명식을 억지로 한쪽에 밀어
 * 넣게 되고, 그 순간 판정이 아니라 반올림이 된다.
 */
export type FollowingPatternStatus =
  /** 지배 세력이 문턱에 못 미친다 */
  | 'not-following'
  /** 압도적이지만 진종·가종 어느 쪽으로도 판정하지 않는다 */
  | 'candidate'
  /** 일간에 약한 뿌리나 약한 반증이 남아 있다 */
  | 'pseudo-following'
  /** 무근이고 투간한 생부가 없으며 구조적 증거가 있다 */
  | 'true-following';

export const FOLLOWING_PATTERN_STATUS_KO: Record<FollowingPatternStatus, string> = {
  'not-following': '종격 아님',
  candidate: '종격 후보',
  'pseudo-following': '가종',
  'true-following': '진종',
};

/** 종의 방향 — 밖으로 따르는가(從財·從殺), 안으로 따르는가(從强·從旺) */
export type FollowingDirection = 'outward' | 'inward';

export const FOLLOWING_DIRECTION_KO: Record<FollowingDirection, string> = {
  outward: '밖으로 종',
  inward: '안으로 종',
};

export type FollowingAssessment = {
  /** 고전이 정한 값이 아니라 이 엔진의 실험 규칙이라는 것을 값으로 못박는다 */
  status: 'experimental';
  verdict: FollowingPatternStatus;
  /**
   * 자당(비겁 + 인성)이 여덟 글자에서 차지하는 몫.
   *
   * 이 하나가 축이다. 낮으면 일간을 도울 것이 없어 밖으로 종하고, 높으면
   * 일간 편이 극왕해 안으로 종한다. 자당과 이당은 합이 1 이라 두 방향을
   * 같은 축의 양끝으로 잰다.
   *
   * 국(局)과 합화를 반영한 실효 분포에서 잰다 — 亥卯未가 木局을 이루면 未는
   * 土로 논하지 않는다는 말을 세력에 반영한 값이다.
   */
  selfShare: number;
  /** 어느 쪽으로 종할 자리인가. 문턱 사이에 있으면 `null` 이고 종격이 아니다 */
  direction: FollowingDirection | null;
  /**
   * 일간 뿌리의 **질** 합 — `ROOT_QUALITY_POLICY` 가 매긴다.
   *
   * 예전에는 같은 글자 1 · 같은 오행 0.5 로 세었다. 그 셈은 뿌리가 어디에
   * 걸렸는지를 보지 않아, 여기(餘氣)에 걸린 뿌리 둘을 정기 둘과 같이 세었다.
   * 지금은 자리·역할·지지의 갈래·충·국까지 곱한 값이라 눈금 자체가 다르다 —
   * 옛 문턱 0.5 를 그대로 두면 뜻이 달라진다.
   */
  rootScore: number;
  /**
   * 세어진 뿌리가 아니라 **남은 뿌리**로 본 무근.
   *
   * `facts.dayMasterRootless` 는 「지장간에 같은 오행이 하나도 없는가」라는
   * 사실이고 이쪽은 「그래서 쓸 것이 남았는가」라는 판정이다. 충에 뽑히거나
   * 국에 끌려가면 둘이 갈리고, 고전이 「根已拔」이라 적은 자리가 바로 거기다.
   */
  effectivelyRootless: boolean;
  /** 지배 세력이 월령을 잡았거나 천간에 드러났는가 — 진종의 구조적 증거 */
  structuralEvidence: boolean;
  /** 판정의 재료가 된 사실들 */
  facts: FollowingCandidacy;
};

/**
 * 종격을 판정한다 — **실험 규칙 v2.**
 *
 * v1 에서 달라진 것은 문턱이 아니라 **입력**이다. 자당 몫의 문턱(30% · 70%)은
 * 그대로 두고, 그 몫을 재는 분포와 뿌리를 바꿨다.
 *
 *   세력  국(局)과 합화를 반영한 실효 분포로 잰다
 *   뿌리  개수가 아니라 질로 잰다 — 자리·역할·지지의 갈래·충·국
 *
 * 문턱을 자료에 맞춰 내리지 않은 것이 요점이다. 못 잡던 명조들이 「문턱 바로
 * 위」에 있었던 것이 아니라 **우리가 잘못 세고 있었다**는 쪽이었고, 세는 법을
 * 고치자 문턱을 그대로 둔 채로 재현율이 14/30 에서 17/30 으로 올랐다. 같은
 * 3000건 표본의 발화율은 10.9% 에서 10.6% 로 오히려 내려갔다.
 *
 * 그래도 **억부를 뒤집지 않는다**(`eokbuOverride: 'disabled'`). 재현율은 절반을
 * 넘었지만 발화율이 고전이 말하는 희소성(百無一二)보다 여전히 크게 높고,
 * 아니라고 적힌 넷 중 하나를 아직 종격으로 본다.
 */
export function followingAssessmentOf(
  pillars: CandidacyInput,
  elements: ElementDistribution,
  rootedness: Rootedness,
  dayMasterRootQuality: RootQuality,
): FollowingAssessment {
  const facts = followingCandidacyOf(pillars, elements, rootedness);
  const roles = elementRolesOf(STEM_INFO[pillars.dayMaster].element);

  // 오행 비율의 합이 1 이므로 자당 몫이 곧 축이다.
  const selfShare = elements.ratios[roles['比劫']] + elements.ratios[roles['印星']];

  const rootScore = dayMasterRootQuality.strength;
  const effectivelyRootless = rootScore < EFFECTIVE_ROOT_FLOOR;

  // 지배 세력이 월령을 잡았거나 천간에 드러났는가. 월령을 필수로 걸지 않는 대신
  // 둘 중 하나는 있어야 진종으로 본다 — 점수를 매기지 않고도 같은 구실을 한다.
  const dominantRevealed = PILLAR_POSITIONS.some((position) => {
    const pillar = pillars[position];
    return pillar !== null && STEM_INFO[pillar.stem].element === facts.dominant.element;
  });
  const structuralEvidence = facts.monthCommandsDominant || dominantRevealed;

  const { outwardMaxSelfShare, inwardMinSelfShare } = FOLLOWING_PATTERN_POLICY.dominance;
  const { pseudoMaxRootScore, pseudoMaxSupportStems } = FOLLOWING_PATTERN_POLICY.classification;

  const direction: FollowingDirection | null =
    selfShare <= outwardMaxSelfShare ? 'outward' : selfShare >= inwardMinSelfShare ? 'inward' : null;

  // 두 방향은 조건이 거울처럼 뒤집힌다. 밖으로 종은 일간이 뿌리가 없어야 하고,
  // 안으로 종은 뿌리가 있어야 한다 — 따를 것이 자기 자신이기 때문이다.
  const verdict: FollowingPatternStatus =
    direction === null
      ? 'not-following'
      : direction === 'outward'
        ? effectivelyRootless && facts.supportStems.length === 0 && structuralEvidence
          ? 'true-following'
          : rootScore <= pseudoMaxRootScore && facts.supportStems.length <= pseudoMaxSupportStems
            ? 'pseudo-following'
            : 'candidate'
        : !effectivelyRootless && facts.opposingStems.length === 0
          ? 'true-following'
          : !effectivelyRootless && facts.opposingStems.length <= pseudoMaxSupportStems
            ? 'pseudo-following'
            : 'candidate';

  return {
    status: 'experimental',
    verdict,
    selfShare,
    direction,
    rootScore,
    effectivelyRootless,
    structuralEvidence,
    facts,
  };
}
