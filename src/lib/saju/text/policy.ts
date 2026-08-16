import {
  BRANCH_CLASHES,
  BRANCH_DESTRUCTIONS,
  BRANCH_DIRECTIONAL_COMBINATIONS,
  BRANCH_GHOST_GATES,
  BRANCH_HARMS,
  BRANCH_INFO,
  BRANCH_PUNISHMENTS,
  BRANCH_RESENTMENTS,
  BRANCH_SIX_COMBINATIONS,
  BRANCH_TRIPLE_COMBINATIONS,
  STEM_CLASHES,
  STEM_COMBINATIONS,
} from '../constants';
import {
  ELEMENT_ROLE_KO,
  FOLLOWING_PATTERN_KIND_KO,
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_KO,
  UNRESOLVED_FACTOR_KO,
  type FollowingPatternStatus,
} from '../analysis';
import { TWELVE_SPIRIT_KO } from '../sinsal/twelveSpirits';
import { TWELVE_STAGE_KO } from '../stages';

/**
 * L3 문장 계약 — **무엇까지 말할 자격이 있는가.**
 *
 * 이 파일은 생성기가 아니다. 조각도 조립기도 없다. L2 가 낸 결과 하나하나에
 * "이 결과를 근거로 얼마나 세게 말해도 되는가"를 못박고, 그 상한을 넘는 문장을
 * 걸러내는 검사기만 둔다.
 *
 * 순서를 이렇게 잡은 이유가 있다. 이 저장소의 가장 센 규율은 **검증 수준보다
 * 강하게 말하지 않는다**이고(등급 이름 없음, 기신 안 냄, 억부는 "후보"라고만),
 * 지금까지 그 규율은 타입과 상수로 지켜졌다 — `EokbuAssessment` 는 이름부터
 * 용신이 아니고, `status: 'experimental'` 은 값으로 박혀 있어서 무시하려면
 * 무시한다고 코드에 적어야 한다. **자연어에는 그 장치가 없다.** 문장은 아무거나
 * 말할 수 있고, 틀리게 말해도 타입이 빨개지지 않는다. 그래서 계약이 먼저다.
 *
 * 여기서 정한 다섯:
 *
 * 1. **강도는 손으로 적지 않는다.** 조각이 `strength: 'fact'` 를 직접 타이핑하면
 *    막을 방법이 없다. 조각은 **어느 출처를 읽었는지**만 밝히고, 강도는
 *    `CLAIM_CEILING` 에서 유도한다. 여럿을 읽었으면 가장 낮은 것을 따른다.
 * 2. **용어는 데이터에서만 온다.** 문장 틀에 관계 이름을 타이핑할 수 없고
 *    `relation.ko` 같은 값만 슬롯으로 꽂는다. 없는 관계를 말하는 일이 생기려면
 *    없는 데이터가 먼저 있어야 한다.
 * 3. **완충 표현은 강도가 요구한다.** `fact` 가 아닌 문장은 정해진 완충 표현
 *    없이는 통과하지 못한다. 어미를 파싱하지 않는다 — "후보입니다"의 `입니다`는
 *    문제가 아니고 문제는 `후보`가 빠진 것이라, 어미보다 명사가 정확하다.
 * 4. **판정하지 않는 것은 그렇다고 말할 수 있다.** 금지 표현이라도 "기신은 내지
 *    않습니다" 같은 미판정 고지 문형 안에서는 허용한다. 귀문·원진을 신살 표에
 *    다시 적은 것과 같은 이유다 — 다른 만세력에 있는 항목이 통째로 없으면
 *    빠뜨린 것처럼 보이고, 실제로 그 질문을 받았다.
 * 5. **출처 의무는 강도가 아니라 근거에서 나온다.** 옮겨 적은 표를 읽었다는 것은
 *    근거의 **종류**이지 주장의 세기가 아니다. 사다리에서 같은 칸에 앉았다고
 *    같은 의무를 지지 않는다 — `ATTRIBUTION_PATHS` 참조.
 *
 * 이 위에 조각 스키마(`fragment.ts`) · 말뭉치(`corpus.ts`) · 조립기(`assemble.ts`)가
 * 올라앉았다. 아직 없는 것: 생성기 — 그리고 그것은 이 줄의 위가 아니라 옆이다.
 */

/**
 * 주장의 강도 — 낮을수록 조심스럽다.
 *
 * `reference` 가 `candidate` 보다 낮은 것이 뒤집혀 보일 수 있다. 조후표는
 * 궁통보감 원문 120칸과 대조했으니 **자료로서는** 억부보다 근거가 세다. 그러나
 * 문장이 하는 주장은 "이 명식에 이것이 적용된다"이고, 그 적용 조건을 우리는
 * 판정하지 않았다(`JOHU_POLICY`). 자료의 신뢰도가 아니라 **이 명식에 대한
 * 주장의 세기**로 줄을 세운 사다리다.
 */
export type ClaimStrength =
  /** 여덟 글자에서 곧장 세어진 것. 계통을 고르지 않고도 같은 값이 나온다 */
  | 'fact'
  /** 우리가 고른 규칙과 문턱을 거친 것. 다른 계통은 다르게 볼 수 있다 */
  | 'derived'
  /** 규칙은 돌았지만 보지 않은 것이 남아 있는 것 */
  | 'candidate'
  /** 외부 표를 옮겨 적기만 한 것. 출처를 함께 밝혀야 한다 */
  | 'reference'
  /** 말하지 않는다 */
  | 'silent';

/** 낮은 쪽이 먼저다. `min` 을 이 순서로 잰다 */
export const CLAIM_STRENGTH_ORDER: readonly ClaimStrength[] = [
  'silent',
  'reference',
  'candidate',
  'derived',
  'fact',
];

export const CLAIM_STRENGTH_KO: Record<ClaimStrength, string> = {
  fact: '사실',
  derived: '유도',
  candidate: '후보',
  reference: '참고',
  silent: '말하지 않음',
};

/** 두 강도 중 낮은 쪽 */
export function weakerClaim(a: ClaimStrength, b: ClaimStrength): ClaimStrength {
  return CLAIM_STRENGTH_ORDER.indexOf(a) <= CLAIM_STRENGTH_ORDER.indexOf(b) ? a : b;
}

/**
 * 문장이 근거로 삼을 수 있는 자리. `Saju` 의 키를 그대로 쓴다.
 *
 * 새 필드가 L2 에 생기면 여기에도 줄이 하나 늘어야 한다 — 테스트가 그것을
 * 강제한다. 상한을 정하지 않은 결과는 L3 가 아예 읽을 수 없다.
 */
export const CLAIM_PATHS = [
  'pillars',
  'relations',
  'stages',
  'sinsal',
  'daeun',
  'saeun',
  'wolun',
  'meta',
  'analysis.elements',
  'analysis.tenGods',
  'analysis.tenGodCounts',
  'analysis.strength',
  'analysis.eokbu',
  'analysis.johu',
  'analysis.rootedness',
  'analysis.followingCandidacy',
  'analysis.following',
] as const;

export type ClaimPath = (typeof CLAIM_PATHS)[number];

/**
 * 종격 문장의 상한은 **외부 대조 게이트에 묶여 있다.**
 *
 * 손으로 적으면 게이트를 열 때 문장 쪽을 같이 고치는 것을 잊는다. 반대로
 * 게이트를 닫아 둔 채 문장만 세게 하는 것도 막힌다. 실험 규칙이 억부를
 * 뒤집지 못하는 동안은 문장도 억부보다 세게 말할 수 없다.
 */
function followingCeiling(): ClaimStrength {
  const gateOpen =
    FOLLOWING_PATTERN_POLICY.dominance.externalCheck.passed &&
    FOLLOWING_PATTERN_POLICY.eokbuOverride !== 'disabled';

  return gateOpen ? 'derived' : 'candidate';
}

/**
 * 근거 하나가 허용하는 가장 센 말.
 *
 * 조각은 이 표를 읽기만 한다. `strength` 를 스스로 정하는 조각은 없다.
 */
export const CLAIM_CEILING: Record<ClaimPath, ClaimStrength> = {
  // 계통을 고르지 않고 세어지는 것들 — 표를 소비하기만 한다.
  pillars: 'fact',
  relations: 'fact',
  stages: 'fact',
  sinsal: 'fact',
  daeun: 'fact',
  saeun: 'fact',
  wolun: 'fact',
  meta: 'fact',
  'analysis.elements': 'fact',
  'analysis.tenGods': 'fact',
  'analysis.tenGodCounts': 'fact',
  'analysis.rootedness': 'fact',
  'analysis.followingCandidacy': 'fact',

  /**
   * 신강·신약은 사실이 아니다. 세 기준이 서로 겹치고(득세 점수에 월지·일지가
   * 이미 들어 있다), "둘 이상이면 신강"이라는 문턱도 우리가 고른 값이다.
   * 그래서 "신약이다"가 아니라 "신약 쪽으로 본다"까지다.
   */
  'analysis.strength': 'derived',

  /** 보지 않은 것이 다섯 남아 있다(`EokbuAssessment.unresolved`) */
  'analysis.eokbu': 'candidate',

  /** 게이트에 묶인다 — 위 `followingCeiling` 참조 */
  'analysis.following': followingCeiling(),

  /** 조건을 자동 판정하지 않은 참고표다. 출처를 함께 밝힌다 */
  'analysis.johu': 'reference',
};

/**
 * 출처를 문장 안에 밝혀야 하는 **근거**.
 *
 * 전에는 강도로 걸었다(`reference` 면 출처 요구). 조각 스키마를 짜다가 그것이
 * 틀렸다는 것이 드러났다 — **시간 미상이면 억부(`candidate`)가 한 칸 내려와
 * `reference` 가 된다.** 그러면 궁통보감을 인용하지 않은 억부 문장이 통째로
 * 막히고, 억부는 조후표에서 나온 값이 아니므로 인용할 출처 자체가 없다.
 * 실질적으로 "시간을 모르면 억부를 말하지 않는다"가 되는데 그런 결정을 내린 적이
 * 없다. 종격도 같은 자리에 걸린다.
 *
 * 사다리는 **이 명식에 대한 주장의 세기**를 재는 줄이고, 출처 의무는 **무엇을
 * 읽었는가**에서 나온다. 두 축이라 한 축으로 겸해 쓸 수 없다. 같은 칸에
 * 앉았다고 같은 의무를 지지 않는다.
 */
export const ATTRIBUTION_PATHS: readonly ClaimPath[] = ['analysis.johu'];

/**
 * 종격 판정 넷 중 문장을 만들지 않는 것.
 *
 * `not-following` 은 "종격이 아니다"라는 판정처럼 보이지만, 실제로는 **우리가
 * 고른 문턱 밖**이라는 뜻이다. 게이트가 닫혀 있는 동안 그것을 결론처럼 말하면
 * 실험값을 절대 기준으로 쓰는 것이 된다. 대신 억부 문장이 이미 "종격 여부는
 * 아직 보지 않았다"를 각주로 달고 나간다(`UNRESOLVED_FACTOR_KO.followingPattern`).
 */
export const FOLLOWING_SILENT_VERDICTS: readonly FollowingPatternStatus[] = ['not-following'];

/** 종격 판정 하나가 허용하는 강도 */
export function ceilingForFollowing(verdict: FollowingPatternStatus): ClaimStrength {
  return FOLLOWING_SILENT_VERDICTS.includes(verdict) ? 'silent' : CLAIM_CEILING['analysis.following'];
}

/**
 * 문장이 무엇을 주장하는가 — 있다고 하는가, 없다고 하는가.
 *
 * 시간 미상일 때 이 둘의 안전도가 갈린다. 여섯 글자에서 찾은 뿌리는 시주가
 * 있어도 그대로 뿌리지만, **없다는 주장은 시주가 뒤집을 수 있다.** 시지가
 * 뿌리였다면 "무근입니다"는 그냥 틀린 문장이 된다. 종격의 앞 조건이 무근이라
 * 이 한 줄이 종격 문장까지 함께 잠근다.
 */
export type ClaimPolarity = 'presence' | 'absence';

/**
 * 시간 미상이면 강도를 한 칸 내리는 자리.
 *
 * 시주 두 글자가 빠진 분포·세력이라 결론이 뒤집힐 수 있다. 이미 경고로도
 * 나가지만(`meta.warnings`), 경고는 문장 옆에 붙어 있지 않는다.
 */
export const HOUR_SENSITIVE_PATHS: readonly ClaimPath[] = [
  'analysis.elements',
  'analysis.tenGodCounts',
  'analysis.strength',
  'analysis.eokbu',
  'analysis.followingCandidacy',
  'analysis.following',
  'analysis.rootedness',
  'relations',
];

/** 강도를 한 칸 내린다. `silent` 아래는 없다 */
export function downgrade(strength: ClaimStrength): ClaimStrength {
  const index = CLAIM_STRENGTH_ORDER.indexOf(strength);
  return CLAIM_STRENGTH_ORDER[Math.max(0, index - 1)];
}

export type CeilingQuery = {
  /** 이 문장이 읽은 출처들 */
  paths: readonly ClaimPath[];
  /** 있다고 하는가, 없다고 하는가 */
  polarity?: ClaimPolarity;
  /** 시각을 알고 계산했는가 */
  hourKnown?: boolean;
};

/**
 * 문장 하나가 말할 수 있는 가장 센 강도.
 *
 * 여럿을 읽었으면 가장 낮은 것을 따른다 — 억부 후보를 뿌리로 설명하는 문장은
 * 뿌리가 사실이어도 억부보다 세게 말할 수 없다.
 */
export function ceilingFor({ paths, polarity = 'presence', hourKnown = true }: CeilingQuery): ClaimStrength {
  if (paths.length === 0) return 'silent';

  let ceiling = paths
    .map((path) => CLAIM_CEILING[path])
    .reduce((weakest, strength) => weakerClaim(weakest, strength));

  if (!hourKnown) {
    const sensitive = paths.some((path) => HOUR_SENSITIVE_PATHS.includes(path));

    // 없다는 주장은 시주가 통째로 뒤집을 수 있다 — 내리는 것으로는 부족하다.
    if (sensitive && polarity === 'absence') return 'silent';
    if (sensitive) ceiling = downgrade(ceiling);
  }

  return ceiling;
}

/**
 * 강도별로 문장이 반드시 품어야 하는 완충 표현.
 *
 * 어미를 파싱하지 않는다. "후보입니다"에서 `입니다` 는 문제가 아니고 문제는
 * `후보` 가 빠진 것이다 — 한국어에서 확신의 세기는 어미보다 명사가 나른다.
 */
export const REQUIRED_HEDGES: Record<Exclude<ClaimStrength, 'fact' | 'silent'>, readonly string[]> = {
  derived: ['로 본다', '로 봅니다', '으로 본다', '으로 봅니다', '쪽으로', '기준으로는', '봅니다'],
  candidate: ['후보', '여지', '가능성', '검토', '아직', '확정하지 않'],
  reference: ['참고', '고전', '표는', '원문', '출처'],
};

/** 표를 옮겨 적은 문장이 밝혀야 하는 출처의 이름 */
export const ATTRIBUTION_TERMS: readonly string[] = ['궁통보감', '적천수', '자평진전', '삼명통회', '천리명고'];

export type ForbiddenClaim = {
  id: string;
  /** 문장에 나오면 걸리는 표현 */
  terms: readonly string[];
  /** 왜 못 쓰는가 */
  why: string;
  /** 그 결정이 어느 정책에 이미 적혀 있는가 */
  source: string;
};

/**
 * 어느 강도로도 쓸 수 없는 표현.
 *
 * 이 목록은 **백스톱이다.** 주된 장치는 `CLAIM_CEILING`(근거보다 세게 말하지
 * 않는다)과 데이터에서만 오는 용어이고, 여기 적힌 것은 그 둘을 빠져나온 표현을
 * 마지막에 잡는다. 어휘 금지만으로 규율을 세우려 들면 띄어쓰기 하나로 우회된다.
 *
 * 전부 이미 다른 정책이 내린 결정이다. 새로 만든 규칙은 하나도 없다 —
 * `source` 가 그 자리를 가리킨다. 문장 계약이 하는 일은 그 결정들이 산문에서
 * 조용히 풀리지 않게 하는 것뿐이다.
 */
export const FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  {
    id: 'unfavorable-element',
    terms: ['기신', '忌神', '희신', '喜神'],
    why: '용신을 극하는 오행이 곧 기신이 아니다. 명식 전체에서 용신 작용을 방해하는 것을 봐야 정해진다.',
    source: 'YONGSIN_POLICY.unfavorable = not-judged',
  },
  {
    id: 'yongsin-fixed',
    terms: ['용신은', '용신이다', '용신입니다', '용신으로 삼', '확정 용신', '용신을 정하'],
    why: '억부는 용신을 잡는 네 길 중 하나이고 나머지 셋을 보지 않았다. "억부 관점의 후보"까지다.',
    source: 'YONGSIN_POLICY.status = experimental',
  },
  {
    id: 'strength-grade',
    terms: ['태약', '태왕', '중화', '극신약', '극신강', '신왕', '신강신약 등급'],
    why: '20%씩 끊은 값에 전통 판정 이름을 달면 없는 근거를 만드는 것이다. 근거 있는 구간 경계가 없다.',
    source: 'STRENGTH_POLICY.gradeBands = none',
  },
  {
    id: 'structure-pattern',
    terms: ['재다신약', '財多身弱', '살중용인', '식신제살', '군겁쟁재', '관인상생', '격국은 ', '격을 이루'],
    why: '격국의 성패를 판정하지 않는다. 억부 후보가 나왔다고 격국 이름이 따라 나오지 않는다.',
    source: 'EokbuAssessment.unresolved = structure',
  },
  {
    id: 'transformation',
    terms: ['합화', '化하여', '로 변한다', '로 바뀐다', '목으로 화', '화(化)한'],
    why: '글자가 모인 것과 합화한 것은 다르다. 합의 오행은 `result` 가 아니라 `targetElement` 다.',
    source: 'RELATION_POLICY (targetElement)',
  },
  {
    id: 'combination-resolved',
    terms: ['합이 깨', '합이 풀', '충이 합을', '파격', '해합', '합을 방해하여'],
    why: '쟁합·투합은 검출만 하고 승패를 가리지 않는다. 학파 갈림이 가장 심한 자리다.',
    source: 'RELATION_POLICY.interactionResolution = contest-only',
  },
  {
    id: 'root-damage',
    terms: ['뿌리가 상', '뿌리가 깨', '뿌리가 끊', '통근이 무너'],
    why: '합충으로 뿌리가 바뀌는지 보지 않는다. 뿌리 목록과 관계 목록을 함께 읽어야 한다.',
    source: 'ROOTEDNESS_POLICY.combinationEffects = not-judged',
  },
  {
    id: 'compat-score',
    terms: ['궁합 점수', '총점', '상성 점수', '점 만점'],
    why: '궁합은 맞춰 볼 외부 정답이 없다. 점수를 내려면 가중치 표를 화면에 전부 드러내야 한다.',
    source: 'COMPAT_POLICY.scoring = not-scored',
  },
  {
    id: 'certainty',
    terms: ['반드시', '틀림없이', '확실히', '분명히', '무조건', '단언'],
    why: '이 엔진의 어떤 결과도 이 세기를 지탱하지 못한다. 가장 센 강도인 사실조차 계통 선택 위에 있다.',
    source: 'TEXT_POLICY.ruleSet',
  },
  {
    id: 'prediction',
    terms: ['하게 됩니다', '일어납니다', '겪게 됩니다', '오게 됩니다'],
    why: '이 저장소는 사주를 계산하지 일을 예언하지 않는다. 세운·월운도 간지와 관계만 낸다.',
    source: 'TEXT_POLICY.ruleSet',
  },
];

/**
 * 금지 표현이라도 "판정하지 않는다"고 말하는 문형에서는 허용한다.
 *
 * 이 통로가 없으면 "기신은 내지 않습니다" 같은 고지가 함께 막힌다. 다른
 * 만세력에 있는 항목이 통째로 없으면 빠뜨린 것처럼 보인다는 것을 귀문·원진에서
 * 이미 배웠다.
 */
export const DISCLOSURE_PATTERNS: readonly string[] = [
  '판정하지 않',
  '내지 않',
  '보지 않',
  '다루지 않',
  '정하지 않',
  '말하지 않',
  '쓰지 않',
];

/** 미판정 고지에 쓸 수 있는 항목 — 화면·문장 양쪽에서 같은 이름을 쓴다 */
export const DISCLOSABLE = {
  ...UNRESOLVED_FACTOR_KO,
  unfavorableElement: '기신',
  compatScore: '궁합 점수',
  strengthGrade: '강약 등급',
} as const;

/**
 * 문장에서 찾아 근거와 대조할 명리 용어.
 *
 * **한 글자 용어는 걸러낸다.** 오행 목·화·토·금·수가 '목적'·'화면'에 걸리고,
 * 12운성 열둘 중 일곱(쇠·병·사·묘·절·태·양)도 한 글자라 '병화'의 '병'에 걸린다.
 * 한 번 오검출이 나오면 검사기 자체를 끄게 되므로 그물에서 뺀다.
 *
 * 뺀 자리는 `vocabulary: 'data-only'` 가 맡는다 — 조각이 용어를 타이핑할 수 없고
 * `ELEMENT_KO[...]`·`TWELVE_STAGE_KO[...]` 만 슬롯으로 꽂는다. 그물은 그 규율을
 * 빠져나온 것을 잡는 백스톱이지 유일한 장치가 아니다.
 *
 * 신살 이름도 아직 빠져 있다(`TEXT_POLICY.lexiconCoverage`). `stars.ts` 가
 * 이름을 함수 안에서 만들어 정적 목록이 없다.
 */
export const MYEONGRI_LEXICON: ReadonlySet<string> = new Set<string>(
  [
  ...Object.values(TEN_GOD_KO),
  ...Object.values(ELEMENT_ROLE_KO),
  ...Object.values(TWELVE_STAGE_KO),
  ...Object.values(TWELVE_SPIRIT_KO),
  ...Object.values(FOLLOWING_PATTERN_KIND_KO),
  ...Object.values(FOLLOWING_PATTERN_STATUS_KO),
  ...STEM_COMBINATIONS.map((c) => c.ko),
  ...STEM_CLASHES.map((c) => c.ko),
  ...BRANCH_SIX_COMBINATIONS.map((c) => c.ko),
  ...BRANCH_TRIPLE_COMBINATIONS.map((c) => c.ko),
  ...BRANCH_DIRECTIONAL_COMBINATIONS.map((c) => c.ko),
  ...BRANCH_CLASHES.map((c) => c.ko),
  ...BRANCH_PUNISHMENTS.map((p) => p.ko),
  ...BRANCH_HARMS.map((h) => h.ko),
  ...BRANCH_DESTRUCTIONS.map((d) => d.ko),
  ...BRANCH_RESENTMENTS.map((r) => r.ko),
  ...BRANCH_GHOST_GATES.map((g) => g.ko),
  // 두 글자만 모인 형은 이름이 그 자리에서 조합된다(申刑寅 → '신인형').
  // 표에 없는 이름이라 여기서 같은 방식으로 만들어 둔다 — 이것이 빠지면
  // "인신형으로 인해…" 같은 문장이 그물을 그냥 통과한다.
  ...BRANCH_PUNISHMENTS.flatMap((punishment) => {
    if (punishment.kind === 'self') return [];

    return punishment.branches.flatMap((from) =>
      punishment.branches
        .filter((to) => to !== from)
        .map((to) => `${BRANCH_INFO[from].ko}${BRANCH_INFO[to].ko}형`),
    );
  }),
  ].filter((term) => term.length > 1),
);

export type TextViolationRule =
  /** 어느 강도로도 쓸 수 없는 표현이다 */
  | 'forbidden-claim'
  /** 근거가 허용한 것보다 세게 말했다 */
  | 'missing-hedge'
  /** 말하지 않기로 한 것을 말했다 */
  | 'must-be-silent'
  /** 출처를 밝히지 않았다 */
  | 'missing-attribution'
  /** 근거에 없는 관계·용어를 말했다 */
  | 'ungrounded-term';

export type TextViolation = {
  rule: TextViolationRule;
  /** 걸린 표현 */
  term?: string;
  detail: string;
};

export type SentenceCheck = {
  text: string;
  /**
   * 이 문장이 읽은 근거들 — **옵셔널이 아니다.**
   *
   * 무엇을 읽고 한 말인지 모르면 자격을 따질 수 없다. 강도만 받으면 검사기가
   * 근거를 강도에서 되짚어야 하는데 그 되짚기가 불가능하다는 것이
   * `ATTRIBUTION_PATHS` 에 적힌 사고다 — 같은 `reference` 가 조후에서도 오고
   * 시간 미상의 억부에서도 온다.
   */
  paths: readonly ClaimPath[];
  /** `ceilingFor`(종격이면 `ceilingForFollowing`)가 낸 값을 그대로 넣는다 */
  strength: ClaimStrength;
  /**
   * 이 문장이 근거로 쥔 용어들 — `relation.ko`, `TEN_GOD_KO[...]` 처럼
   * 데이터에서 나온 값만. 여기 없는 명리 용어가 문장에 있으면 걸린다.
   */
  grounded?: Iterable<string>;
};

/**
 * 항목 이름과 "판정하지 않는다" 사이에 허용하는 거리.
 *
 * 넓히면 "기신은 화이고, 이런 것은 보통 판정하지 않습니다" 같은 문장이 고지로
 * 통과한다 — 금지 표현을 먼저 쓰고 뒤에 부인을 붙이면 되는 셈이라 계약이 통째로
 * 새어 나간다. 실제 고지는 "기신은 내지 않습니다"처럼 짧다.
 */
const DISCLOSURE_WINDOW = 12;

/** 문장 안에서 어떤 표현이 나온 자리들 */
function occurrencesOf(text: string, term: string): number[] {
  const at: number[] = [];
  for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + 1)) at.push(i);
  return at;
}

/** 금지 표현이 미판정 고지 문형 안에 있는가 */
function withinDisclosure(text: string, term: string, at: number): boolean {
  const tail = text.slice(at, at + term.length + DISCLOSURE_WINDOW);
  return DISCLOSURE_PATTERNS.some((pattern) => tail.includes(pattern));
}

/**
 * 금지 표현이 **데이터에서 온 이름 안에** 들어 있는가.
 *
 * 육합 午未合火 의 이름이 '오미합화'다. 화(化) 판정을 금지하려고 '합화'를
 * 막았더니 이 관계 이름이 통째로 걸렸다 — 한글로는 合火 와 合化 가 같은 글자다.
 *
 * 그래서 근거가 이긴다. 엔진이 낸 이름은 금지 표현일 수 없다. 뒤집으면
 * 검사기가 정상 문장을 계속 걸어서 결국 꺼지게 된다.
 */
function insideGroundedTerm(text: string, at: number, length: number, evidence: Set<string>): boolean {
  for (const term of evidence) {
    if (!term.includes(text.slice(at, at + length))) continue;

    if (occurrencesOf(text, term).some((start) => start <= at && at + length <= start + term.length)) {
      return true;
    }
  }
  return false;
}

/**
 * 문장 하나를 계약에 비춰 본다.
 *
 * 통과했다고 문장이 옳은 것은 아니다 — 이 검사기는 **말할 자격**만 본다.
 * 명리적으로 맞는지는 L2 가 이미 답했거나 아직 답하지 않은 것이고, 그 둘의
 * 구분이 곧 `strength` 다.
 */
export function checkSentence({ text, paths, strength, grounded = [] }: SentenceCheck): TextViolation[] {
  const violations: TextViolation[] = [];

  if (strength === 'silent') {
    violations.push({
      rule: 'must-be-silent',
      detail: '말하지 않기로 한 근거로 문장을 만들었다.',
    });
    return violations;
  }

  const evidence = new Set(grounded);

  for (const forbidden of FORBIDDEN_CLAIMS) {
    for (const term of forbidden.terms) {
      const bare = occurrencesOf(text, term).filter(
        (at) =>
          !withinDisclosure(text, term, at) && !insideGroundedTerm(text, at, term.length, evidence),
      );
      if (bare.length === 0) continue;

      violations.push({
        rule: 'forbidden-claim',
        term,
        detail: `${forbidden.id}: ${forbidden.why} (${forbidden.source})`,
      });
    }
  }

  if (strength !== 'fact') {
    const hedges = REQUIRED_HEDGES[strength];
    if (!hedges.some((hedge) => text.includes(hedge))) {
      violations.push({
        rule: 'missing-hedge',
        detail: `강도 ${strength}(${CLAIM_STRENGTH_KO[strength]}) 문장은 ${hedges.join('·')} 중 하나를 품어야 한다.`,
      });
    }
  }

  const copiesTable = paths.some((path) => ATTRIBUTION_PATHS.includes(path));
  if (copiesTable && !ATTRIBUTION_TERMS.some((s) => text.includes(s))) {
    violations.push({
      rule: 'missing-attribution',
      detail: `옮겨 적은 표는 출처를 밝혀야 한다 — ${ATTRIBUTION_TERMS.join('·')}.`,
    });
  }

  for (const term of MYEONGRI_LEXICON) {
    if (text.includes(term) && !evidence.has(term)) {
      violations.push({
        rule: 'ungrounded-term',
        term,
        detail: `근거 목록에 없는 용어다. 이 명식에서 나오지 않은 것을 말했거나, 데이터가 아니라 문장 틀에 타이핑했다.`,
      });
    }
  }

  return violations;
}

/**
 * L2 가 **이미 내보내고 있는** 문장 중 이 계약을 어기는 것.
 *
 * 지우지 않고 표시한다 — 외부 사례를 `unrealizable` 로 표시하되 지우지 않은 것과
 * 같은 취급이다. 고치면 골든 스냅샷과 화면 문구가 함께 움직이므로 문장 계약을
 * 세우는 커밋에서 같이 하지 않는다.
 *
 * `EokbuAssessment.reason` 은 "신약한데 재성(火)이 가장 무겁습니다"로 시작한다.
 * 근거는 `analysis.strength`(derived) 와 `analysis.eokbu`(candidate) 인데 문장은
 * 단정형이다. 계약대로면 "신약 쪽으로 보는데" 여야 한다.
 */
export const KNOWN_UNCONTRACTED_TEXT = [
  {
    id: 'legacy-eokbu-reason',
    where: 'EokbuAssessment.reason',
    paths: ['analysis.strength', 'analysis.eokbu'] as readonly ClaimPath[],
    violates: 'missing-hedge' as TextViolationRule,
    note: '강약을 단정형으로 적는다. 고치면 골든 스냅샷과 화면 문구가 함께 바뀐다.',
  },
] as const;

/**
 * 채택한 문장 규칙. 다른 `*_POLICY` 와 같은 구실을 한다 — 골든 스냅샷이 찍으므로
 * 규칙이 바뀌면 diff 맨 위에서 먼저 드러난다.
 *
 * 값이 전부 납작한 문자열인 것은 스냅샷이 `Object.entries` 로 찍기 때문이다.
 */
export const TEXT_POLICY = {
  ruleSet: 'text-claim-contract-v1',
  /** 계약·스키마·말뭉치·조립기까지 있다. 생성기는 아직 없다 */
  status: 'contract-schema-corpus-assembler',
  /** 런타임에 AI 를 부르지 않는다. 생성은 빌드 타임에 한 번뿐이다 */
  runtimeAi: 'none',
  /** 강도는 조각이 적는 것이 아니라 읽은 출처에서 나온다. 여럿이면 가장 낮은 것 */
  claimStrength: 'derived-from-sources-min',
  /** 명리 용어는 상수 표에서 온 값만 슬롯으로 꽂는다 — 문장 틀에 타이핑하지 않는다 */
  vocabulary: 'data-only',
  /** 문장에 나온 용어는 근거 목록에 있어야 한다 */
  grounding: 'terms-must-appear-in-evidence',
  /** 사실이 아닌 강도는 완충 표현 없이 통과하지 못한다 */
  hedge: 'required-below-fact',
  /** 옮겨 적은 표는 출처를 밝힌다 — 강도가 아니라 읽은 근거로 건다 */
  attribution: 'required-for-copied-tables',
  /** 판정하지 않는 것은 "판정하지 않는다"고 말할 수 있다 */
  disclosure: 'allowed-for-not-evaluated',
  /** 종격 문장의 상한은 외부 대조 게이트를 따라간다 */
  followingPattern: 'gated-by-external-check',
  /** 종격 아님은 문장을 만들지 않는다 — 억부 각주가 이미 말한다 */
  followingNegative: 'silent',
  /** 시간 미상이면 한 칸 내리고, 없다는 주장은 아예 막는다 */
  hourUnknown: 'downgrade-and-silence-absence',
  /** 억부가 먼저다. 게이트가 닫힌 동안 종격은 억부를 반박하지 못한다 */
  precedence: 'eokbu-before-following-while-gate-closed',
  /** 등급 이름·기신·궁합 점수는 여기서도 그대로 금지다 */
  inheritedBans: 'grade-bands, unfavorable-element, compat-score',
  /** 한 글자 용어는 그물에 넣지 않는다. 신살 이름은 아직 목록이 없다 */
  lexiconCoverage: 'ten-gods, roles, stages, spirits, relations, following — stars pending',
} as const;
