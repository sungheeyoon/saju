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
  ruleSet: 'following-patterns-research-v1',
  status: 'documented-not-evaluated',
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

