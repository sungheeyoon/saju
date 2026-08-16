import { STEM_INFO, principalStem, type Element, type Stem } from '../constants';
import type { Pillars } from '../pillars';
import { PILLAR_POSITIONS, type PillarPosition } from '../position';
import type { ElementDistribution } from './fiveElements';
import type { Rootedness } from './rootedness';
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
  ruleSet: 'following-patterns-experimental-v1',
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
  /** 무근은 뿌리 개수가 0인가 — 가중치를 들이지 않는다 */
  rootless: { requiredForTrueFollowing: true, byWeightedScore: false },
  /** 뿌리 가중치. 진종·가종을 가르는 데만 쓴다 */
  roots: { sameStemWeight: 1, sameElementWeight: 0.5, tombStorageSpecialCase: false },
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
      note: 'not-a-classical-number',
      /**
       * 이 문턱으로 실제로 나온 판정 비율(같은 3000건 표본).
       *
       * **고전이 말하는 희소성보다 크게 높다.** 《적천수천미》는 격국이 진실하고
       * 순수한 것이 "百無一二"라 했는데 여기서는 진종·가종을 합쳐 약 10% 다.
       * 문턱을 더 조여도 6% 아래로는 잘 안 내려간다 — 자당 몫이 낮은 명식 자체가
       * 그만큼 있고, 고전은 그것들을 합충과 여기의 질로 걸러내는데 우리는 그 둘을
       * 보지 않기 때문이다. 그래서 이 판정은 억부를 뒤집지 않는다.
       */
      observedRates: {
        'true-following': 0.0457,
        'pseudo-following': 0.057,
        candidate: 0.073,
        note: 'looser-than-classical-rarity',
      },
    },
    /**
     * 외부 명조와의 대조 결과 — **아직 통과하지 못했다.**
     *
     * 종격이라고 적힌 서른 중 열넷만 종격 쪽으로 본다. 문턱을 낮추면 재현율은
     * 오르지만, 저자의 판정이 우리가 보지 않는 것(합화, 지장간 여기의 질)에
     * 기대고 있어 압도 비율만 내리면 일반 명식까지 쓸려 들어온다. 그래서
     * 숫자를 자료에 맞추지 않고 못 잡는다는 사실을 남긴다.
     * 자세한 행렬은 `following.external.test.ts`.
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
      caught: 14,
      falsePositives: 1,
      /**
       * 계통별로 성적이 갈린다 — 한쪽만 보면 문턱이 맞아 보인다. 앞서 열여덟
       * 건이 밖으로 종하는 계열에 몰려 있어 10/16 이던 것이, 고전을 섞자
       * 14/30 으로 내려갔다.
       */
      recallByLineage: { 'modern-chinese': '9/14', 'classical-chinese': '5/16' },
      passed: false,
      /**
       * 여기 있던 `cannot-detect-following-the-strong` 은 **해결됐다.** 축을
       * 자당 몫 하나로 다시 세우면서 從旺·從强 을 85%·91% 로 잡는다(문턱 70%).
       *
       * 지금 남은 둘은 성질이 다르다. 假從 은 정의상 비겁·인성이 남아 자당 몫이
       * 25~39% 로 밖으로 종하는 문턱 바로 위에 얹힌다 — 계열의 성질이라 문턱을
       * 넓히면 모집단 발화율이 함께 오른다. 나머지는 합화·삼합국·공협처럼
       * 우리가 일부러 안 보기로 한 입력에 기대고 있어 문턱 문제가 아니다.
       */
      remainingGaps: {
        falseFollowing: 'self-camp-share-25-to-39-sits-above-outward-threshold',
        skippedInputs: 'transformation, triple-combination, hidden-span',
      },
    },
  },
  /** 합충으로 인한 뿌리 손상·파격은 판정하지 않는다 */
  relationships: { rootDamageByCombination: false, breakPatternByClash: false },
  /** 약한 뿌리 하나까지는 가종 쪽으로 본다 */
  classification: { pseudoMaxRootScore: 0.5, pseudoMaxSupportStems: 1 },
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
   */
  selfShare: number;
  /** 어느 쪽으로 종할 자리인가. 문턱 사이에 있으면 `null` 이고 종격이 아니다 */
  direction: FollowingDirection | null;
  /**
   * 일간 뿌리의 가중 합 — 같은 글자 1, 같은 오행 0.5.
   *
   * **무근 판정에는 쓰지 않는다.** 무근은 뿌리 개수가 0인가라는 사실이고,
   * 가중치를 거기까지 들이면 "0.5짜리 뿌리 하나는 무근인가"라는 문턱이 하나
   * 더 생긴다. 이 값은 진종과 가종을 가르는 데만 쓴다.
   */
  rootScore: number;
  /** 지배 세력이 월령을 잡았거나 천간에 드러났는가 — 진종의 구조적 증거 */
  structuralEvidence: boolean;
  /** 판정의 재료가 된 사실들 */
  facts: FollowingCandidacy;
};

/**
 * 종격을 판정한다 — **실험 규칙 v1.**
 *
 * 문턱은 고전에서 온 숫자가 아니라 이 엔진의 세력 분포를 재고 정한 값이다
 * (`FOLLOWING_PATTERN_POLICY.dominance.calibration`). 그래서 억부를 뒤집지
 * 않는다(`eokbuOverride: 'disabled'`) — 억부는 외부 사례를 대조하고도 시험값에
 * 머물러 있는데, 그 답을 정반대로 뒤집는 판정이 외부 대조 0건으로 상위에 설 수는
 * 없다. 종격이라고 명시된 외부 명조를 모아 이 규칙이 그것을 잡는지 확인한 뒤에야
 * 그 스위치를 켠다.
 */
export function followingAssessmentOf(
  pillars: CandidacyInput,
  elements: ElementDistribution,
  rootedness: Rootedness,
): FollowingAssessment {
  const facts = followingCandidacyOf(pillars, elements, rootedness);
  const roles = elementRolesOf(STEM_INFO[pillars.dayMaster].element);

  // 오행 비율의 합이 1 이므로 자당 몫이 곧 축이다.
  const selfShare = elements.ratios[roles['比劫']] + elements.ratios[roles['印星']];

  const { sameStemWeight, sameElementWeight } = FOLLOWING_PATTERN_POLICY.roots;
  const rootScore = rootedness.dayMaster.roots.reduce(
    (sum, root) => sum + (root.kind === 'same-stem' ? sameStemWeight : sameElementWeight),
    0,
  );

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
        ? facts.dayMasterRootless && facts.supportStems.length === 0 && structuralEvidence
          ? 'true-following'
          : rootScore <= pseudoMaxRootScore && facts.supportStems.length <= pseudoMaxSupportStems
            ? 'pseudo-following'
            : 'candidate'
        : !facts.dayMasterRootless && facts.opposingStems.length === 0
          ? 'true-following'
          : !facts.dayMasterRootless && facts.opposingStems.length <= pseudoMaxSupportStems
            ? 'pseudo-following'
            : 'candidate';

  return {
    status: 'experimental',
    verdict,
    selfShare,
    direction,
    rootScore,
    structuralEvidence,
    facts,
  };
}
