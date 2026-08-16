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
    candidateRatio: 0.65,
    /**
     * 이 숫자가 어느 스케일에서 나왔는지 값으로 남긴다.
     *
     * 분모가 바뀌면 0.65 는 뜻을 잃는다. 실제로 다섯 오행 정규화 비율에
     * 그대로 걸면 무근과 함께 한 번도 발화하지 않았다(3000건 중 0건).
     */
    calibration: {
      sample: 3000,
      method: 'random-charts-1930-2019',
      denominator: 'dominant / (dominant + day-master-side)',
      dayMasterSide: ['比劫', '印星'],
      measuredAt: '2026-08-16',
      note: 'not-a-classical-number',
      /** 같은 표본에서 이 규칙이 실제로 낸 판정 비율 — 문턱을 바꾸면 함께 갱신한다 */
      observedRates: {
        'true-following': 0.0087,
        'pseudo-following': 0.0107,
        candidate: 0.0163,
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

export type FollowingAssessment = {
  /** 고전이 정한 값이 아니라 이 엔진의 실험 규칙이라는 것을 값으로 못박는다 */
  status: 'experimental';
  verdict: FollowingPatternStatus;
  /**
   * 지배 세력이 **일간 편과 견줘** 차지하는 몫.
   *
   * 다섯 오행 정규화 비율(`candidacy.dominant.ratio`)이 아니다. 그 스케일에서는
   * 65%가 3000건 표본에서 무근과 함께 한 번도 나오지 않는다 — 여덟 글자를
   * 지장간까지 펴면 한 오행이 전체의 2/3을 갖는 일이 사실상 없기 때문이다.
   * 고전이 말하는 "압도"는 5분할 점유율이 아니라 "일간을 도울 것이 없고
   * 반대편이 다 가져갔다"이므로 분모를 2분으로 잡는다.
   */
  dominanceRatio: number;
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

  const mine = elements.ratios[roles['比劫']] + elements.ratios[roles['印星']];
  const dominant = facts.dominant.ratio;
  // 둘 다 0 이 되는 원국은 없다(합이 1 이다) — 그래도 0 나눗셈을 열어두지 않는다.
  const dominanceRatio = dominant + mine === 0 ? 0 : dominant / (dominant + mine);

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

  const { candidateRatio } = FOLLOWING_PATTERN_POLICY.dominance;
  const { pseudoMaxRootScore, pseudoMaxSupportStems } = FOLLOWING_PATTERN_POLICY.classification;

  const verdict: FollowingPatternStatus =
    dominanceRatio < candidateRatio
      ? 'not-following'
      : facts.dayMasterRootless && facts.supportStems.length === 0 && structuralEvidence
        ? 'true-following'
        : rootScore <= pseudoMaxRootScore && facts.supportStems.length <= pseudoMaxSupportStems
          ? 'pseudo-following'
          : 'candidate';

  return { status: 'experimental', verdict, dominanceRatio, rootScore, structuralEvidence, facts };
}
