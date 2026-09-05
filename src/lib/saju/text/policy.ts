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
  BUREAU_NAMES,
  ELEMENT_ROLE_KO,
  STRUCTURE_FACTOR_NAMES,
  FOLLOWING_PATTERN_KIND_KO,
  FOLLOWING_PATTERN_POLICY,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_KO,
  UNRESOLVED_FACTOR_KO,
  type FollowingPatternStatus,
} from '../analysis';
import type { Compatibility } from '../compat';
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
 * 6. **불완전한 명식이 제한하는 것은 주장의 종류마다 다르다** — 아래
 *    `INCOMPLETE_INPUT_RULE`. 이 한 줄이 시간 미상 분기를 거의 전부 설명한다.
 *
 * 이 위에 조각 스키마(`fragment.ts`) · 말뭉치(`corpus.ts`) · 조립기(`assemble.ts`)가
 * 올라앉았다. 아직 없는 것: 생성기 — 그리고 그것은 이 줄의 위가 아니라 옆이다.
 */

/**
 * 시주가 없을 때 무엇이 제한되는가 — **이 엔진의 인식 규칙.**
 *
 * > 관측 가능한 사실은 누락된 시주 때문에 거짓이 되지 않는다.
 * > 다만 **전체성에 대한 주장**과 **부재에 대한 주장**은 제한될 수 있다.
 *
 * 주제마다 따로 예외 처리를 한 것이 아니라, **주장의 종류가 같으면 같은 규칙으로
 * 갈린다.** 시간 미상 분기가 전부 이 표에서 나온다.
 *
 * | 주장 | 시주가 빠지면 | 예 |
 * | --- | --- | --- |
 * | "이것이 있다" | 여전히 참. 값이 흔들리면 한 칸 내린다 | 관계 행 · 강약 · 억부 |
 * | "이것이 없다" | **틀린 문장이 된다 → 침묵** | 무근 · 종격 |
 * | "이것이 전부다" | **목록이 따로 말한다** | `relation.coverage` |
 * | 시주와 무관 | 그대로 | 조후(일간·월지만 본다) |
 *
 * 셋째 줄이 이 규칙에서 가장 늦게 제자리를 찾은 칸이다. 한동안 목록의 한계를
 * **행 하나하나가 나눠 지고 있었다** — 관계 행이 시간 미상에서 한 칸 내려갔는데,
 * 그러면 관측된 사실을 의심하는 것처럼 읽힌다("을경합금(유도)"). 규칙대로면 행은
 * `fact` 로 남아야 하고, 못 본 것은 목록이 스스로 말해야 한다. 지금은 그렇다.
 *
 * 목록이 말하면 **행이 못 하던 말도 할 수 있다.** 행에는 누구의 시주가 빠졌는지
 * 적을 자리가 없었는데, 목록은 "지영의 시주를 빼고 센 목록"이라고 이름을 부른다.
 */
export const INCOMPLETE_INPUT_RULE =
  'observable-facts-survive · completeness-and-absence-do-not';

/**
 * 주장의 강도 — 낮을수록 조심스럽다.
 *
 * `reference` 가 `candidate` 보다 낮은 것이 뒤집혀 보일 수 있다. 조후표는
 * 궁통보감 원문 120칸과 대조했으니 **자료로서는** 억부보다 근거가 세다. 그러나
 * 문장이 하는 주장은 "이 명식에 이것이 적용된다"이고, 그 적용 조건을 우리는
 * 판정하지 않았다(`JOHU_POLICY`). 자료의 신뢰도가 아니라 **이 명식에 대한
 * 주장의 세기**로 줄을 세운 사다리다.
 *
 * **눈금은 출처가 아니라 자격이다.** 아래 설명이 "이 값이 어디서 왔는가"로
 * 읽히기 쉬운데, 재는 것은 **얼마나 세게 말해도 되는가**다. 그래서 서로 다른
 * 이유가 같은 칸에 도달하고, 그것이 정상이다 — 한 칸에 오는 길이 둘이다.
 *
 * - **규칙을 거쳐서**: 강약은 우리가 고른 문턱을 지나 `derived` 에 선다.
 * - **강등돼서**: 억부는 시간 미상에서 `candidate` 에서 `reference` 로 내려온다.
 *   조후표를 읽어서가 아니라 시주 두 글자가 빠져서다 — 그래서 같은 칸에 앉고도
 *   출처를 요구받지 않는다(`ATTRIBUTION_PATHS`).
 *
 * 관계 행이 한동안 그렇게 내려와 있었는데 **되돌렸다.** 시주가 빠져도 그 합이
 * 성립한다는 것은 그대로 참이고, 흔들리는 것은 목록의 전체성이라 목록이 따로
 * 말한다(`INCOMPLETE_INPUT_RULE`).
 */
export type ClaimStrength =
  /** 여덟 글자에서 곧장 세어진 것. 계통을 고르지 않고도 같은 값이 나온다 */
  | 'fact'
  /**
   * 여기 오는 길이 둘이다 — **우리가 고른 규칙과 문턱을 거쳤거나**(다른 계통은
   * 다르게 볼 수 있다), **입력이 일부 빠져 한 칸 내려왔거나**(값 자체는 여전히
   * 관측된 것이다).
   */
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
 * 문장이 근거로 삼을 수 있는 자리. 대개 `Saju` 의 키를 그대로 쓴다.
 *
 * 새 필드가 L2 에 생기면 여기에도 줄이 하나 늘어야 한다 — 테스트가 그것을
 * 강제한다. 상한을 정하지 않은 결과는 L3 가 아예 읽을 수 없다.
 *
 * **`now` 만 `Saju` 의 키가 아니다** — 아래 `OFF_CHART_PATHS` 참조.
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
  'now',
  'analysis.elements',
  'analysis.effectiveElements',
  'analysis.bureaus',
  'analysis.tenGods',
  'analysis.tenGodCounts',
  'analysis.strength',
  'analysis.eokbu',
  'analysis.johu',
  'analysis.rootedness',
  'analysis.rootQuality',
  'analysis.hiddenCombinations',
  'analysis.followingCandidacy',
  'analysis.following',
  'analysis.tonggwan',
  'analysis.yongsinAgreement',
  'analysis.precedence',
  'analysis.structure',
  'analysis.favorability',
] as const;

export type ClaimPath = (typeof CLAIM_PATHS)[number];

/**
 * 명식 밖에서 오는 근거 — **계약이 여태 없다고 전제하던 것.**
 *
 * `CLAIM_PATHS` 는 `Saju` 의 키를 그대로 쓴다고 적혀 있었고 테스트가 양방향으로
 * 그것을 잠갔다(없어진 필드를 가리키는 상한도, 상한 없는 필드도 걸린다). 궁합이
 * 그 전제를 깨지 않은 것은 **남의 근거를 빌려 썼기** 때문이다 — 궁합 문장이 읽는
 * 억부·오행·십성은 전부 각자의 원국에서 나온 값이라 `analysis.*` 로 적힌다.
 *
 * 현재운이 처음으로 명식 밖의 것을 근거로 든다. "지금은 네 번째 대운 안에 있다"는
 * 대운 표만으로 나오지 않는다 — **보는 시각**이 있어야 한다. 그것을 `daeun` 하나로
 * 적으면 문장이 명식 밖의 무엇에 기대고 있다는 사실이 근거 목록에서 사라지고,
 * 이 저장소에서 그것은 강도를 손으로 적는 것과 같은 종류의 구멍이다.
 *
 * 상한은 `fact` 다. 보는 시각은 흔들리지 않는다 — 브라우저가 알려 준 값이고,
 * 엔진이 스스로 묻지 않기로 한 이유가 오히려 그 확실성을 지킨다
 * (`NOW_POLICY.viewingInstant`).
 */
export const OFF_CHART_PATHS: readonly ClaimPath[] = ['now'];

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
/**
 * 억부의 상한. 오신 배정이 이 값을 그대로 물려받으므로 이름을 준다 —
 * 두 곳에 `'candidate'` 를 손으로 적으면 한쪽만 고치는 날이 온다.
 */
const CLAIM_CEILING_EOKBU: ClaimStrength = 'candidate';

export const CLAIM_CEILING: Record<ClaimPath, ClaimStrength> = {
  // 계통을 고르지 않고 세어지는 것들 — 표를 소비하기만 한다.
  pillars: 'fact',
  relations: 'fact',
  stages: 'fact',
  sinsal: 'fact',
  saeun: 'fact',
  wolun: 'fact',
  meta: 'fact',
  /** 보는 시각. 브라우저가 알려 준 값이라 흔들리지 않는다 — 위 `OFF_CHART_PATHS` */
  now: 'fact',

  /**
   * 대운은 여덟 글자에서 곧장 세어지지 **않는다.**
   *
   * 간지 순서는 사실이다(월주에서 한 칸씩, 양남음녀 순역). 사실이 아닌 것은
   * **대운수**다 — 절입까지의 거리를 사흘에 한 살로 셈한 뒤 정수로 만드는데,
   * 그 정수화가 반올림인지 버림인지는 "어느 쪽도 표준이 아니라서 옵션으로 둔다"고
   * 대운 모듈이 스스로 적어 두었다(`DaeunRounding`). 0 을 1 로 올리는 관행도 그렇다.
   *
   * 상한은 그 근거가 **받쳐 줄 수 있는 가장 약한 주장**을 따른다. 대운수 없이는
   * 어느 칸이 몇 살부터인지 말할 수 없으므로 이 자리는 `derived` 다 — 강약이
   * 문턱을 우리가 골랐다는 이유로 `derived` 인 것과 같은 종류다.
   *
   * 한동안 `fact` 로 적혀 있었고 **아무도 이 근거를 읽지 않아서 아무도 안 봤다.**
   * 계약이 죽은 값을 들고 있으면 그 값은 검증되지 않는다(`ceilingForFollowing` ·
   * `ATTRIBUTION_PATHS` 와 같은 자리다).
   */
  daeun: 'derived',
  'analysis.elements': 'fact',
  'analysis.tenGods': 'fact',
  'analysis.tenGodCounts': 'fact',
  'analysis.rootedness': 'fact',
  'analysis.followingCandidacy': 'fact',

  /**
   * 국(局)과 합화를 반영한 실효 분포는 **사실이 아니다.**
   *
   * 바탕 분포(`analysis.elements`)는 글자를 세기만 하므로 사실이다. 여기서
   * 달라지는 것은 「亥卯未가 모였으니 未의 무게 절반이 木으로 간다」인데, 절반은
   * 우리가 고른 값이고 「모였으니 간다」도 계통이 갈리는 판정이다. 옮긴 몫을
   * 0 으로 두면 바탕으로 정확히 돌아간다는 것이 그 증거다.
   */
  'analysis.effectiveElements': 'derived',
  /** 국이 섰다는 판정과 그 무게 — 위와 같은 이유다 */
  'analysis.bureaus': 'derived',

  /**
   * 뿌리의 질은 배수 다섯을 곱해 나온다 — 자리·역할·글자·지지의 갈래·충.
   * 다섯 다 우리가 고른 값이라 사실 층인 `analysis.rootedness` 와 강도가 다르다.
   * 같은 뿌리를 한쪽은 세고 다른 쪽은 재는데, 재는 쪽이 더 세게 말할 수는 없다.
   */
  'analysis.rootQuality': 'derived',

  /**
   * 암합은 **사실이다.** 지장간 표와 천간합 표를 겹쳐 세기만 한다 — 계통을
   * 고르는 자리가 없다. 성립 여부를 말하지 않기 때문에 그렇게 설 수 있다.
   * 「그래서 합이 되었다」는 순간 이 칸은 내려가야 한다.
   */
  'analysis.hiddenCombinations': 'fact',

  /**
   * 신강·신약은 사실이 아니다. 세 기준이 서로 겹치고(득세 점수에 월지·일지가
   * 이미 들어 있다), "둘 이상이면 신강"이라는 문턱도 우리가 고른 값이다.
   * 그래서 "신약이다"가 아니라 "신약 쪽으로 본다"까지다.
   */
  'analysis.strength': 'derived',

  /** 보지 않은 것이 다섯 남아 있다(`EokbuAssessment.unresolved`) */
  'analysis.eokbu': CLAIM_CEILING_EOKBU,

  /** 게이트에 묶인다 — 위 `followingCeiling` 참조 */
  'analysis.following': followingCeiling(),

  /**
   * 격국은 **종격보다 한 칸 아래도 아니고 같은 칸이다.** 다만 이유가 다르다.
   *
   * 종격은 외부 대조 서른다섯 건을 놓고 게이트를 못 열었고, 격국은 **대조가
   * 아직 0건**이다. 사다리에는 「재어 봤는데 모자란다」와 「아직 안 재 봤다」를
   * 가르는 칸이 없다. 그래서 같은 `candidate` 에 앉히고, 왜 앉았는지는
   * `STRUCTURE_POLICY.externalCheck.cases` 가 값으로 든다.
   */
  'analysis.structure': 'candidate',

  /**
   * 오신 배정은 **용신보다 셀 수 없다.** 표 조회라 그 자체는 갈리지 않지만,
   * 무엇을 용신으로 놓았는가가 갈리면 다섯 자리가 통째로 갈린다. 그래서 억부와
   * 같은 칸에 둔다 — 근거를 물려받은 결론이 근거보다 세게 말할 수는 없다.
   */
  'analysis.favorability': CLAIM_CEILING_EOKBU,

  /**
   * 통관 재료는 **실효 분포보다 셀 수 없다.**
   *
   * 잇는 오행이 무엇인지는 상생 고리에서 곧장 나오는 표라 갈릴 자리가 없다. 그런데
   * 몫은 전부 실효 분포에서 오고, 그 분포는 「亥卯未가 모였으니 未의 무게 절반이
   * 木으로 간다」는 우리가 고른 값을 이미 품고 있다(`analysis.effectiveElements` 가
   * `derived` 인 이유). **근거를 물려받은 값이 근거보다 세게 말할 수는 없다.**
   *
   * 옆칸의 `analysis.followingCandidacy` 는 같은 분포를 쓰면서 `fact` 로 앉아 있다.
   * 그 자리를 여기서 흔들지는 않되 이쪽이 그 칸을 근거로 올라가지도 않는다 — 둘 중
   * 하나가 잘못 앉았다면 옮기는 일은 그 값을 재는 자리에서 해야 한다.
   */
  'analysis.tonggwan': 'derived',

  /** 조건을 자동 판정하지 않은 참고표다. 출처를 함께 밝힌다 */
  'analysis.johu': 'reference',

  /**
   * 억부·조후 대조는 **둘 중 약한 쪽을 따른다.**
   *
   * 대조 자체는 오행 표라 갈릴 자리가 없지만, 견주는 두 값이 각각 `candidate` 와
   * `reference` 다. 「이 둘이 어긋난다」는 문장은 조후 후보가 맞아야 참이므로 조후가
   * 든 상한을 넘을 수 없다 — 오신 배정이 억부보다 셀 수 없는 것과 같은 자리다.
   */
  'analysis.yongsinAgreement': 'reference',

  /**
   * 서열 표는 **가장 약한 줄을 따른다.**
   *
   * 서열 자체(무엇이 이기는가)는 우리가 정한 것을 옮겨 적기만 하므로 갈릴 자리가
   * 없다. 그런데 줄마다 「지금 어긋나는가」를 함께 들고, 그 값은 조후 대조와 종격
   * 판정에서 온다. 조후가 `reference` 이므로 이 표가 그보다 세게 말할 수는 없다.
   *
   * **서열과 어긋남을 두 자리로 가르지 않는다.** 가르면 서열만 읽고 어긋남을 안 읽는
   * 쪽이 생기고, 그것은 이 값을 만든 까닭(둘을 함께 받게 한다)을 되돌리는 일이다.
   */
  'analysis.precedence': 'reference',
};

/**
 * 궁합 결과 하나하나가 **누구의 근거를 읽는가.**
 *
 * `CLAIM_PATHS` 는 `Saju` 의 키를 그대로 쓴다고 적혀 있고 테스트가 양방향으로
 * 그것을 잠근다 — 상한 없는 결과도, 아무것도 가리키지 않는 상한도 걸린다.
 * **궁합은 그 잠금 밖에 있었다.** 계약이 그 사정을 문장으로 적어 두기는 했다:
 * 궁합은 남의 근거를 빌려 쓰므로 새 칸이 필요 없다고. 맞는 말이었지만 **주석이라
 * 아무것도 강제하지 않았다.** `Compatibility` 에 필드가 하나 늘어도 걸리는 곳이
 * 없고, 그러면 근거를 안 정한 값이 조용히 밖으로 나간다.
 *
 * 이 표가 그 문장을 값으로 만든다. `Record<keyof Compatibility, ...>` 라 필드가
 * 늘면 타입이 먼저 걸리고, 없어진 필드를 가리키는 줄은 테스트가 걸린다.
 *
 * **여기서 새 `ClaimPath` 를 만들지 않는다.** 궁합이 내는 값은 전부 두 원국에서
 * 온 것이라 가리킬 자리가 이미 있다. 새 칸이 필요해지는 날은 궁합이 **자기만의
 * 판정**을 내기 시작하는 날이고, 그때는 이 표가 아니라 `CLAIM_CEILING` 에 줄이
 * 늘어야 한다 — 그것이 지금 `COMPAT_POLICY.scoring: 'not-scored'` 로 막혀 있는 것이다.
 */
export const COMPAT_CLAIM_PATHS: Record<keyof Compatibility, readonly ClaimPath[]> = {
  /** 두 원국 사이의 형충회합 — 원국 관계와 같은 규칙, 같은 표에서 나온다 */
  relations: ['relations'],
  /** 같은 목록에서 골라낸 것이라 근거도 같다 */
  combinedFormations: ['relations'],
  /** 두 사람의 오행 분포를 맞대 본 것 */
  elementSupport: ['analysis.elements'],
  /** 두 일간을 맞대 본 것 */
  tenGods: ['analysis.tenGods'],
  /** 억부 판정을 딱지째 물려받고, 상대에게 있는지는 분포에서 센다 */
  eokbuMatch: ['analysis.strength', 'analysis.eokbu', 'analysis.elements'],
  /**
   * 시각을 알았는가 — 명식이 아니라 **입력**에 대한 사실이라 `meta` 다.
   *
   * 이 줄이 이 표의 첫 소득이다. 필드를 늘리자마자 "그래서 이건 무엇을 근거로
   * 하는가"를 묻게 됐고, 물어 보니 답이 `analysis.*` 가 아니었다.
   */
  hourKnown: ['meta'],
  /** 좁게 읽어야 하는 사정 — 입력이 무엇을 못 채웠는가 */
  warnings: ['meta'],
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
 *
 * **이 목록을 강도로 옮기는 함수는 여기 없다.** 한동안 `ceilingForFollowing` 이
 * 있었는데 부르는 곳이 테스트뿐이었다 — `renderFragment` 는 강도를 인자로 받지
 * 않기로 했고(그래야 `paths` 를 주제로 옮겨 막은 구멍이 호출부에서 다시 열리지
 * 않는다), 그래서 판정값별 침묵은 계약이 혼자 낼 수 없는 값이었다. 지금은 주제가
 * 이 목록을 `silentVariants` 로 읽어 스키마에서 값이 난다(`fragment.ts` 의
 * `speaks`). 규칙은 여기 한 번만 적혀 있고 강도를 내는 길은 하나다.
 */
export const FOLLOWING_SILENT_VERDICTS: readonly FollowingPatternStatus[] = ['not-following'];

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
 * 이미 경고로도 나가지만(`meta.warnings`), 경고는 문장 옆에 붙어 있지 않는다.
 *
 * **한 목록이지만 걸리는 이유는 셋이다**(`INCOMPLETE_INPUT_RULE`). 어느 쪽이든
 * 한 칸 내린다는 결과가 같아서 한 목록에 있을 뿐, 같은 일이 일어나는 것은 아니다.
 *
 * 1. **값이 달라진다** — 강약 16% 가 시주를 빼면 0% 가 된다. 억부·종격도 그 위에
 *    올라앉아 있다. 문장이 드는 숫자 자체가 다른 숫자가 된다.
 * 2. **없다는 주장이 뒤집힌다** — 무근·종격. 이쪽은 내리는 것으로 부족해서
 *    `polarity: 'absence'` 가 통째로 잠근다(아래 `ceilingFor`).
 *
 * **`relations` 는 여기 없다.** 한동안 있었는데, 그것이 규칙과 어긋났다 — 관계는
 * 적힌 한 줄 한 줄이 시주와 무관하게 참이고 흔들리는 것은 항목이 아니라 목록의
 * **전체성**이다. 목록의 한계를 항목마다 나눠 지우는 것은 관측된 사실을 의심하는
 * 것처럼 보이게 만든다. 지금은 목록이 제 몫을 따로 든다(`relation.coverage`),
 * 그리고 「없다」는 `LIST_COMPLETENESS_PATHS` 가 잠근다.
 *
 * **한 갈래는 예외였다.** 여기에는 「480 쌍에서 시주가 붙어 사라진 관계는 0건」이라고
 * 적혀 있었는데 틀린 말이었다 — 그 시험이 열두 날만 훑어 반례를 못 만났을 뿐이고,
 * 무작위 표본에서는 2961건 중 129건(4.4%)에서 사라진다. 사라지는 것은 `full: false`
 * 인 삼합·방합뿐이다(`absorbedPairs` 가 흡수한다). 그 갈래도 **행을 내리지 않고**
 * 그 행만 흡수될 수 있다고 함께 말한다 — `absorbableByUnknownHour` 와
 * `relation.present/row-absorbable`, 그리고 `docs/text/claim-policy.md`.
 */
export const HOUR_SENSITIVE_PATHS: readonly ClaimPath[] = [
  /**
   * 대운수는 절입까지의 거리에서 나오고, 시각을 모르면 그 거리가 **채워 넣은
   * 정오에서** 재어진다. ±0.5일 ÷ 3 ≈ ±2개월이 흔들리므로 반올림 경계에 걸리면
   * 한 살 차이로 나타나고, 그러면 **지금이 어느 대운인지가 한 칸 어긋난다.**
   * 위 1번(값이 달라진다)의 자리다.
   *
   * 계약은 한동안 대운을 "시주와 무관한 근거"로 적고 테스트까지 그렇게 단정했다.
   * 대운 모듈은 처음부터 `approximate` 로 흔들린다고 말하고 있었는데 — 그 값이
   * `!hourKnown` 과 정확히 같다 — 계약이 그 근거를 읽는 주제가 없어서 어긋난
   * 채로 남아 있었다.
   *
   * **세운·월운은 여기 없다.** 그 간지는 해와 달에서 나오므로 시주 두 글자가
   * 아무것도 바꾸지 않는다. 흔들리는 것은 그것들이 원국과 맺는 **관계 목록의
   * 전체성**이고, 그 몫은 목록이 따로 든다(`relation.coverage`).
   */
  'daeun',
  'analysis.elements',
  'analysis.tenGodCounts',
  'analysis.strength',
  'analysis.eokbu',
  'analysis.followingCandidacy',
  'analysis.following',
  'analysis.rootedness',

  /**
   * 2026-08-21 에 들어온 판정들 — **재고 넣었다.**
   *
   * 이 목록이 손으로 적는 것이라 엔진이 자랄 때 따라오지 않았다. 일곱이 들어오는
   * 동안 목록은 그대로였고, 아무 주제도 이 자리들을 읽지 않아서 아무도 안 봤다
   * (`daeun` 이 `fact` 로 잘못 앉아 있던 것과 같은 자리다).
   *
   * 세 기둥이 같은 표본에서 시주 두 글자만 지우고 재면 — 뿌리의 질 64.6%,
   * 국 39.7%, 실효 분포 31.4%, 격국 성패 26.5%, 오신 배정 25.4%, 격국 종류 8.7%
   * 가 뒤집힌다. `analysis/hourSensitivity.test.ts` 가 그 값을 잠근다.
   *
   * **암합은 여기 없다.** 같은 표본에서 짝이 뒤집힌 것은 0건이고 98.9% 는 짝이
   * 줄기만 한다 — 흔들리는 것은 「이것이 전부다」이지 「이것이 있다」가 아니라,
   * 인식 규칙의 셋째 줄로 간다(`INCOMPLETE_INPUT_RULE`).
   */
  'analysis.structure',
  'analysis.favorability',
  'analysis.rootQuality',
  'analysis.bureaus',
  'analysis.effectiveElements',
  /**
   * 통관 재료 — **맞선 쌍이 바뀐다.** 시주 두 글자를 지우면 가장 팽팽한 쌍이
   * 42.2% 에서 다른 쌍으로 갈린다. 실효 분포에서 재는 값이라 그 분포(31.4%)보다
   * 더 흔들리는 것이 자연스럽다: 분포는 「가장 무거운 오행」 하나가 바뀔 때만
   * 세는데, 이쪽은 다섯 쌍의 **순서**가 바뀌면 센다.
   */
  'analysis.tonggwan',
  /**
   * 억부·조후 대조 — **양쪽이 다 흔들려서 대조도 흔들린다.** 억부 후보가 바뀌거나
   * 조후의 상·하반월이 뒤집히면 「같은 것을 가리키는가」의 답이 갈린다: 16.3%.
   */
  'analysis.yongsinAgreement',
  /**
   * 서열 표 — **서열은 안 흔들리고 어긋남이 흔들린다.** 조후 대조와 종격 판정을
   * 함께 읽으므로 둘 중 하나만 뒤집혀도 표가 달라진다: 34.2%.
   */
  'analysis.precedence',
];

/**
 * 시주가 붙으면 **목록이 길어질 수 있는** 자리 — 인식 규칙의 셋째 줄.
 *
 * 여태 이 줄에는 **계약이 없었다.** 표는 「"이것이 전부다"는 목록이 따로 말한다」고
 * 적어 두었고 그 목록은 `relation.coverage` 인데, 그것은 **L3 문장 층에만 있다.**
 * AI 에 넘기는 자료에는 그런 값이 없어서, 계약은 시간 미상에도 「관계가 없다」를
 * `fact` 로 말해도 된다고 적고 있었다 — 문장 층이 들던 몫을 자료 층에서는 아무도
 * 안 들고 있었던 것이다.
 *
 * **`HOUR_SENSITIVE_PATHS` 로는 못 고친다.** 저쪽은 「있다」까지 한 칸 내리는데,
 * 여기서 흔들리는 것은 항목이 아니라 목록의 끝이다. 거의 전부가 **늘어나는** 쪽이라,
 * 적힌 한 줄은 시주를 몰라도 그대로 참이다. 내리면 관측된 사실을 의심하는 것처럼
 * 읽힌다 — 관계 행을 `fact` 로 되돌린 그 판단이다.
 *
 * 그래서 **「있다」는 그대로 두고 「없다」만 잠근다.**
 *
 * **한 갈래는 늘어나기만 하지 않는다.** 반쪽 삼합·방합은 시주가 셋째 글자를 들고
 * 오면 완전한 것에 흡수돼 사라진다(4.4%). 그 갈래도 「있다」를 내리지 않고 그 행이
 * 스스로 단서를 든다 — 위 `absorbableByUnknownHour` 자리를 보라.
 *
 * 재어 본 값(2000건, 세 기둥이 같은 표본이 아니라 시각만 지운 짝):
 * 시주를 지우면 자리 색인이 **일주 칸에서 57.9%, 세 칸 중 하나라도면 85.3%**
 * 달라진다. 거의 전부가 늘어난 것이고, 그래서 「없다」만 위험하다.
 */
export const LIST_COMPLETENESS_PATHS: readonly ClaimPath[] = [
  /** 관계 목록 — 시주 두 글자가 새 형충회합을 만든다 */
  'relations',
  /**
   * 암합. `HOUR_SENSITIVE_PATHS` 의 주석이 「짝이 뒤집힌 것은 0건이고 98.9% 는
   * 짝이 줄기만 한다 — 흔들리는 것은 「이것이 전부다」」라고 적고 그 줄로 보냈는데,
   * 보낸 곳에 아무것도 없었다. 이제 여기가 그 줄이다.
   */
  'analysis.hiddenCombinations',

  /**
   * 아래 일곱은 **전수 감사에서 나왔다**(`completeness.test.ts`).
   *
   * 처음에는 「재지 않았으니 넣지 않는다」고 두었는데, 그것이 판정 기준을 잘못
   * 고른 것이었다. **발생률은 심각도를 말하고, 「없다」를 말해도 되는가는 반례
   * 하나가 정한다.** 시주를 붙여 항목이 한 번이라도 늘어나면 그 자리에서
   * 「없다」는 틀릴 수 있는 문장이다.
   *
   * 그래서 목록을 손으로 채우지 않는다. 시험이 자리마다 항목을 뽑아 시주 있는
   * 짝과 맞대고, 늘어나는 자리인데 「없다」가 잠기지 않았으면 거기서 걸린다.
   * 새 근거가 들어오면 「목록인가 아닌가」부터 정하게 되어 있다.
   */
  /** 여덟 글자 — 시주 두 글자가 없으면 「이 글자가 없다」를 말할 수 없다 */
  'pillars',
  /** 12운성 — 시지에서 새 운성이 선다 */
  'stages',
  /** 공망·12신살·신살 — 시주에서만 걸리는 신살이 있다 */
  'sinsal',
  /** 십성 — 시간·시지의 십성이 더해진다 */
  'analysis.tenGods',
  /**
   * 세운·월운·현재운. `HOUR_SENSITIVE_PATHS` 의 주석이 「그 몫은 목록이 따로
   * 든다(`relation.coverage`)」로 넘겼는데, 그 목록은 **L3 문장 층에만 있다.**
   * 자료 층에는 넘겨받은 곳이 없었다.
   */
  'saeun',
  'wolun',
  'now',
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

    // 목록이 길어질 수 있는 자리 — 적힌 항목은 그대로 참이라 「있다」는 내리지
    // 않고, 「없다」만 잠근다(`LIST_COMPLETENESS_PATHS`).
    if (polarity === 'absence' && paths.some((path) => LIST_COMPLETENESS_PATHS.includes(path))) {
      return 'silent';
    }
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
  /**
   * 이 표현이 서도 되는 **유일한 모양** — 바로 뒤에 이 낱말이 오면 통과한다.
   *
   * `DISCLOSURE_PATTERNS` 와 같은 종류의 통로인데 반대편에서 연다. 저쪽은 그
   * 표현을 **부인하는** 문형을 열고("기신은 내지 않습니다"), 이쪽은 그 표현이
   * **판정이 아닌 뜻으로** 쓰이는 문형을 연다("금이 기신 자리에 옵니다").
   *
   * 창이 한 낱말인 것이 요점이다. 넓히면 "기신 쪽이 무겁습니다"가 그대로
   * 통과하는데, 자리 이름을 부르는 것과 그 자리에 온 오행을 이 명식의 병이라고
   * 말하는 것 사이가 정확히 그 한 낱말이다.
   */
  onlyBefore?: readonly string[];
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
  /**
   * **자리 이름으로는 부를 수 있다.**
   *
   * `source` 가 한동안 `YONGSIN_POLICY.unfavorable = not-judged` 를 가리키고
   * 있었는데 그 값은 이미 없어졌다 — 오신 배정이 들어오면서
   * `five-role-seating-not-disease` 로 바뀌었고, 계약은 따라오지 않았다. 엔진이
   * 자란 자리를 계약이 모르면 그 금지는 **무엇을 막는 것인지를 스스로 모르는**
   * 채로 서 있게 된다.
   *
   * 막는 것은 여전히 **동일시**다. 「기신은 금이다」는 명식 전체에서 용신 작용을
   * 방해하는 것이 무엇인지 봐야 나오는 말이고 우리는 그것을 판정하지 않는다
   * (`FAVORABILITY_POLICY.disease`). 「금이 기신 자리에 온다」는 다른 말이다 —
   * 고른 용신 하나에서 상생상극으로 곧장 나오는 배정이라 계통이 갈리지 않는다.
   *
   * 낱말째 막던 동안은 그 둘이 한 덩어리였고, 그래서 오신을 화면에 세우는 길이
   * 통째로 닫혀 있었다. `yongsin-fixed` 는 처음부터 이 모양이다 — '용신' 을
   * 막는 것이 아니라 '용신은'·'용신이다' 를 막는다.
   */
  {
    id: 'unfavorable-element',
    terms: ['기신', '忌神', '희신', '喜神'],
    onlyBefore: ['자리'],
    why: '용신을 극하는 오행이 곧 기신이 아니다. 명식 전체에서 용신 작용을 방해하는 것을 봐야 정해진다 — 자리 이름을 부르는 것까지다.',
    source: 'FAVORABILITY_POLICY.disease = not-judged',
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
  /**
   * **성패는 판정한다 — 다만 조건까지다.**
   *
   * `why` 가 「성패를 판정하지 않는다」라고 적혀 있었는데 그 말은 이미 틀렸다.
   * `structureOf` 는 이루는 조건과 깨는 조건을 하나씩 내고, 참·거짓으로 접지
   * 않는 것이 오히려 그 모듈의 결정이다(`STRUCTURE_POLICY.outcome`).
   * 세 번째 낡은 금지이고 앞의 둘과 고치는 방법도 같다.
   *
   * 스무 개 조건 이름 중 둘이 여기 걸려 있었다 — `식신제살` 과 `관인상생`. 그
   * 조건이 걸린 명식에서 문장을 세우면 조각이 통째로 위반을 냈다(3000건의 13%).
   * 합화와 같은 통로로 연다 — `groundedTermsOf` 가 **그 명식이 실제로 낸 조건
   * 이름**을 담고, 안 담긴 명식에서 그 낱말을 쓰면 그대로 걸린다.
   *
   * 남는 것이 이 금지의 본론이다. `재다신약`·`살중용인`·`군겁쟁재` 는 엔진이
   * **내지 않는 이름**이라 문장에 나오면 지어낸 것이고, `격국은 `·`격을 이루` 는
   * 조건까지만 말하기로 한 선을 넘는 단정이다. 우리는 조건이 걸렸다고만 말한다.
   */
  {
    id: 'structure-pattern',
    terms: ['재다신약', '財多身弱', '살중용인', '식신제살', '군겁쟁재', '관인상생', '격국은 ', '격을 이루'],
    why: '성패는 조건의 목록으로만 낸다. 엔진이 내지 않는 격 이름을 지어내거나 조건을 결론으로 접으면 안 되고, 억부 후보가 나왔다고 격국 이름이 따라 나오지도 않는다.',
    source: 'STRUCTURE_POLICY.outcome = conditions-listed · EokbuAssessment.unresolved = structure',
  },
  /**
   * **판정한 자리만 그 이름을 쓴다 — 통로는 이미 있었다.**
   *
   * `unfavorable-element` 와 겉모습이 같다. 엔진이 자라서 化를 실제로 판정하게
   * 됐는데(`transformation.ts`, 세 등급) 금지는 그 전에 적힌 것이다. 그런데 여는
   * 방법이 다르다 — 저쪽은 자리 이름이 **언제나** 나오므로 근거로 열면 금지가 죽어
   * `onlyBefore` 로 문형을 좁혔다. 이쪽은 판정 이름이 **化한 명식에서만** 근거가
   * 되므로(무작위 3000건의 1.1%) `insideGroundedTerm` 이 제 몫을 한다.
   *
   * 그래서 새로 낸 통로가 없다. `groundedTermsOf` 가 그 명식이 실제로 낸
   * `TRANSFORMATION_VERDICT_KO` 를 담고, 담기지 않은 명식에서 '합화'라고 쓰면
   * 그대로 걸린다. 「합했다」와 「化했다」를 가르라는 원래의 요구가 오히려
   * **판정을 통해 지켜진다.**
   *
   * '합이불화'는 금지에 안 걸린다 — '합화'가 이어져 있지 않다. 고전이 이름으로
   * 이미 갈라 둔 것이 여기서 값을 낸다.
   */
  {
    id: 'transformation',
    terms: ['합화', '化하여', '로 변한다', '로 바뀐다', '목으로 화', '화(化)한'],
    why: '글자가 모인 것과 합화한 것은 다르다. 합의 오행은 `result` 가 아니라 `targetElement` 이고, 化를 판정한 자리(`StemTransformation.verdict`)만 그 이름을 쓸 수 있다.',
    source: 'Relation.targetElement · TRANSFORMATION_POLICY',
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
 *
 * **오신 이름(`FAVOR_ROLE_KO`)은 일부러 없다.** 넣으면 근거 목록에도 넣어야
 * 하는데(`groundedTermsOf`), 그 순간 `insideGroundedTerm` 이 '기신'을 엔진이 낸
 * 이름으로 보고 `unfavorable-element` 를 통째로 풀어 버린다 — 오미합화를 살리려고
 * 낸 통로가 정작 막아야 할 것을 여는 셈이다. 자리 이름을 지키는 것은 그물이 아니라
 * 금지 목록이고, 그쪽이 「자리로만 부른다」를 이미 값으로 들고 있다(`onlyBefore`).
 */
export const MYEONGRI_LEXICON: ReadonlySet<string> = new Set<string>(
  [
  ...Object.values(TEN_GOD_KO),
  ...Object.values(ELEMENT_ROLE_KO),
  ...Object.values(TWELVE_STAGE_KO),
  ...Object.values(TWELVE_SPIRIT_KO),
  ...Object.values(FOLLOWING_PATTERN_KIND_KO),
  ...Object.values(FOLLOWING_PATTERN_STATUS_KO),
  // 완성된 삼합·방합 이름은 아래 관계 표에도 있지만 **반합·반방합·공협은 없다** —
  // `partialName` 이 그 자리에서 조합하는 이름이라 정적 표에 안 실린다. 그물이
  // 그냥 지나치고 있었고, 공협은 관계 목록에도 없어서 **어느 쪽으로도 안 잡혔다.**
  ...BUREAU_NAMES,
  // 성패의 조건 이름 스물. `structureOf` 의 `switch` 안에 흩어져 있어 정적으로는
  // 어디에도 모여 있지 않았다 — 국 이름과 같은 구멍이다.
  ...STRUCTURE_FACTOR_NAMES,
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

/**
 * 이 글이 **문장인가 행인가.**
 *
 * 완충 표현은 산문이 근거보다 세게 말하는 것을 막는 장치다. 그런데 세어지기만
 * 하는 사실(관계 목록·십성 개수·12운성)에 산문을 입히면 서술어가 **없는 무게를
 * 싣는다.** "자오충 관계로 서로 맞섭니다"의 '맞섭니다'는 충(沖)이라는 글자를
 * 한국어로 풀어 쓴 것뿐이라 정보를 하나도 더하지 않는데, 합에 "짝을 짓습니다"를
 * 붙이면 합화(化)를 판정한 것처럼 읽힌다 — 우리가 하지 않기로 한 판정이다.
 *
 * 행에는 단정할 서술어가 아예 없다. 그래서 완충 표현을 요구하지 않고, 대신
 * **강도가 행 옆의 칸으로 선다**(`Utterance.strength`). 사다리가 문장 속 어휘가
 * 아니라 표의 한 열로 보이므로 오히려 더 잘 읽힌다.
 *
 * 면제이지 예외가 아니다 — 금지 표현도 근거 대조도 행에 그대로 적용된다.
 * 행이 행으로 남는지는 말뭉치가 지킨다(강도 표지를 품으면 그건 행이 아니다).
 */
export type ClaimForm =
  /** 산문. 강도에 맞는 완충 표현을 품어야 한다 */
  | 'sentence'
  /** 표의 한 줄. 서술어가 없고 강도는 옆 칸이 든다 */
  | 'row';

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
  /** `ceilingFor`(주제를 거치면 `renderFragment`)가 낸 값을 그대로 넣는다 */
  strength: ClaimStrength;
  /** 산문인가 표의 한 줄인가. 주제가 적는다 — 위 `ClaimForm` 참조 */
  form?: ClaimForm;
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
 * 금지 표현이 **판정이 아닌 뜻으로** 서 있는가 — 바로 뒤 한 낱말만 본다.
 *
 * `withinDisclosure` 가 창을 열두 글자로 잡은 것과 달리 여기는 붙어 있는 것만
 * 본다. 저쪽은 부인하는 절이 뒤따르는 것이라 사이에 조사와 서술어가 들어오지만,
 * 이쪽은 **한 낱말짜리 어구**라 띄어쓰기 하나 말고는 낄 것이 없다.
 */
function withinAllowedForm(
  text: string,
  term: string,
  at: number,
  forms: readonly string[],
): boolean {
  const after = text.slice(at + term.length).trimStart();

  return forms.some((form) => after.startsWith(form));
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
export function checkSentence({
  text,
  paths,
  strength,
  form = 'sentence',
  grounded = [],
}: SentenceCheck): TextViolation[] {
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
          !withinDisclosure(text, term, at) &&
          !insideGroundedTerm(text, at, term.length, evidence) &&
          !(forbidden.onlyBefore && withinAllowedForm(text, term, at, forbidden.onlyBefore)),
      );
      if (bare.length === 0) continue;

      violations.push({
        rule: 'forbidden-claim',
        term,
        detail: `${forbidden.id}: ${forbidden.why} (${forbidden.source})`,
      });
    }
  }

  // 행은 서술어가 없어 세게 말할 수단 자체가 없다 — 강도는 옆 칸이 든다.
  if (strength !== 'fact' && form === 'sentence') {
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
    if (evidence.has(term)) continue;

    // **금지 표현과 같은 규칙이다.** 오미합화를 살리려고 낸 통로가 여태 금지
    // 목록에만 걸려 있었는데, 그물에도 정확히 같은 일이 일어난다 — '식상생재'
    // 라는 조건 이름 안의 '식상'이 근거 없는 용어로 잡혔다. 근거가 이긴다:
    // 엔진이 낸 이름 **안에** 있는 낱말은 따로 말한 것이 아니다.
    //
    // 이름 밖에 서면 여전히 걸린다. 자리를 견주므로 같은 낱말이 한 문장에서
    // 한 번은 통과하고 한 번은 걸릴 수 있고, 그것이 맞다.
    const bare = occurrencesOf(text, term).filter(
      (at) => !insideGroundedTerm(text, at, term.length, evidence),
    );
    if (bare.length === 0) continue;

    violations.push({
      rule: 'ungrounded-term',
      term,
      detail: `근거 목록에 없는 용어다. 이 명식에서 나오지 않은 것을 말했거나, 데이터가 아니라 문장 틀에 타이핑했다.`,
    });
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
  /** 사실이 아닌 강도는 완충 표현 없이 통과하지 못한다 — 산문일 때만 */
  hedge: 'required-below-fact-in-prose',
  /** 세어지기만 하는 사실은 행으로 적는다. 서술어가 없고 강도는 옆 칸이 든다 */
  form: 'rows-for-counted-facts',
  /** 옮겨 적은 표는 출처를 밝힌다 — 강도가 아니라 읽은 근거로 건다 */
  attribution: 'required-for-copied-tables',
  /** 관측된 사실은 시주가 없어도 참이다. 제한되는 것은 전체성과 부재다 */
  incompleteInput: INCOMPLETE_INPUT_RULE,
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
  /** 오신 이름은 자리로만 부른다 — 「기신은 X다」는 여전히 막힌다 */
  seatNames: 'named-only-as-a-seat',
  /** 한 글자 용어는 그물에 넣지 않는다. 신살 이름은 아직 목록이 없다 */
  lexiconCoverage:
    'ten-gods, roles, stages, spirits, relations, following, bureaus, structure — stars pending',
} as const;
