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
  ruleSet: 'following-patterns-research-v2',
  status: 'documented-not-evaluated',
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
  eokbuOverride: 'disabled',
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
