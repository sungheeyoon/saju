import {
  ELEMENT_ROLE_KO,
  FOLLOWING_DIRECTION_KO,
  FOLLOWING_PATTERN_STATUS_KO,
  TEN_GOD_GROUP_KO,
  type ElementRole,
  type FollowingDirection,
  type FollowingPatternStatus,
  type TenGodGroup,
} from '../analysis';
import {
  FOLLOWING_SILENT_VERDICTS,
  ceilingFor,
  checkSentence,
  type ClaimForm,
  type ClaimPath,
  type ClaimPolarity,
  type ClaimStrength,
  type TextViolation,
  type TextViolationRule,
} from './policy';

/**
 * L3 조각 스키마 — **어떤 키로 조회되고 무엇을 입력으로 받는가.**
 *
 * 계약(`policy.ts`)이 "얼마나 세게 말해도 되는가"를 정했다면 여기는 그 계약을
 * 지키는 문장이 실제로 어떤 모양이어야 하는지를 정한다. 아직 생성기는 없다 —
 * 이 파일은 생성기에게 **무엇을 몇 개 만들어야 하는지 적어 주는 작업 지시서**다.
 * 그 지시서를 채운 문장들은 `corpus.ts` 에 따로 있다. 스키마는 내용물을 모른다.
 *
 * 정한 넷:
 *
 * 1. **근거는 조각이 아니라 주제가 적는다.** 조각이 `paths` 를 직접 들면
 *    억부 문장에 `paths: ['pillars']` 를 적어 상한을 `fact` 로 올릴 수 있다 —
 *    손으로 `strength: 'fact'` 를 적는 것과 **같은 구멍이 한 겹 위로 옮겨 온
 *    것**뿐이다. `polarity` 도 같다. 그래서 주제가 근거·방향을 못박고 조각은
 *    그 아래에서 표현만 고른다.
 * 2. **조회 키는 `주제/변종@강도`다.** 강도가 키에 있는 것은 조각이 강도를
 *    선언한다는 뜻이 **아니다.** 강도는 여전히 `ceilingFor` 가 내고, 키는 그
 *    강도에 맞는 **표현 변형을 고르는 데만** 쓰인다. 조각이 하나뿐이면 시간
 *    미상에서 한 칸 내려간 강도까지 감당해야 해서 가장 약한 표현으로 써야 하고,
 *    그러면 시각을 아는 흔한 경우까지 눌려 상한 체계가 통째로 바닥으로 무너진다.
 * 3. **변종은 유한하고 슬롯은 무한하다.** 변종은 문장이 갈리는 자리라 빌드
 *    타임에 전수로 돌 수 있어야 하고, 슬롯은 런타임에 데이터가 꽂히는 자리다.
 *    관계 이름 `자축합토` 는 변종이 아니라 슬롯이다 — 그래야 조각 안에 관계
 *    이름이 없고, 없는 관계를 말하려면 없는 데이터가 먼저 있어야 한다.
 * 4. **슬롯 뒤에 조사를 붙이지 않는다.** 이/가·을/를·은/는·(으)로는 앞 글자의
 *    받침을 따르는데 슬롯 값은 런타임에 정해진다. `{element}를` 은 화·토·수에서만
 *    맞고 목·금에서 틀린다. 검사기가 정적으로 잡는다.
 */

/** 조각이 말하는 주제 — 근거와 방향이 여기 묶인다 */
export type FragmentTopic =
  | 'rootedness.rooted'
  | 'rootedness.rootless'
  | 'strength.verdict'
  | 'eokbu.candidate'
  | 'eokbuMatch.supplied'
  | 'eokbuMatch.missing'
  | 'elementSupport.absent'
  | 'elementSupport.weakest'
  | 'johu.table'
  | 'following.verdict'
  | 'tenGods.between'
  | 'now.asOf'
  | 'now.daeun'
  | 'now.daeunPending'
  | 'now.saeun'
  | 'now.wolun'
  | 'now.coverage'
  | 'relation.present'
  | 'relation.coverage';

/**
 * 종격 변종의 좌표 — **판정 하나와 방향 하나.**
 *
 * 둘을 곱하는 것은 각각이 문장을 가르기 때문이다. 판정은 이 명식을 얼마나
 * 확신하는가이고(진종·가종·후보), 방향은 **무엇을 따르는가**다 — 밖으로 종은
 * 일간을 도울 것이 없어 따르고 안으로 종은 일간 편이 극왕해 따른다. 이름만
 * 다른 것이 아니라 일어난 일이 다르다.
 *
 * `not-following` 만 방향이 없다. 문턱 사이에 놓여 어느 쪽도 아니라는 뜻이라
 * (`direction === null`) 좌표가 판정 하나로 끝나고, 그 하나가 곧 침묵하는 변종이다.
 */
export const followingVariant = (
  verdict: FollowingPatternStatus,
  direction: FollowingDirection | null,
): string => (direction === null ? verdict : `${verdict}-${direction}`);

const FOLLOWING_VARIANTS: readonly string[] = (
  Object.keys(FOLLOWING_PATTERN_STATUS_KO) as FollowingPatternStatus[]
).flatMap((verdict) =>
  FOLLOWING_SILENT_VERDICTS.includes(verdict)
    ? [followingVariant(verdict, null)]
    : (Object.keys(FOLLOWING_DIRECTION_KO) as FollowingDirection[]).map((direction) =>
        followingVariant(verdict, direction),
      ),
);

export type TopicSpec = {
  /** 이 주제의 문장이 읽는 근거. **조각이 아니라 주제가 적는다** */
  paths: readonly ClaimPath[];
  /** 있다고 하는가, 없다고 하는가. 안전도가 다르므로 방향이 다르면 다른 주제다 */
  polarity: ClaimPolarity;
  /**
   * 산문인가 표의 한 줄인가. 기본은 산문이다(`ClaimForm`).
   *
   * **강도 사다리와 나란히 간다.** `fact` 로만 서는 주제는 여덟 글자에서 곧장
   * 세어지는 것이라 셀 수는 있어도 해석할 것이 없다 — 그런 자리에 서술어를
   * 붙이면 없는 무게가 실린다. 판정을 거친 주제(`derived` 아래)만 완충 표현이
   * 필요하고, 필요하다는 것이 곧 산문이어야 한다는 뜻이다.
   */
  form?: ClaimForm;
  /** 문장이 갈리는 자리 — 유한해야 한다. 생성기가 이 목록을 전수로 돈다 */
  variants: readonly string[];
  /**
   * 그중 **말하지 않기로 한** 변종.
   *
   * 사실이 없는 것도 아니고 조각이 없는 것도 아니다 — 값은 나왔는데 그것을
   * 결론처럼 말하지 않기로 한 자리다(`FOLLOWING_SILENT_VERDICTS`). 그래서
   * 발화는 그대로 서고 문장만 없다. 조립기가 요청을 안 내는 것으로 처리하면
   * "사실이 없다"와 구분이 사라지고, 골든에서 침묵이 침묵으로 보이지 않는다.
   *
   * 이 축이 생기기 전까지 강도는 (주제, 시각) 둘에서만 나왔다. 판정값별 침묵은
   * **변종에 걸린 강도**라 그 둘로는 표현할 길이 없었고, 그래서 계약에 함수만
   * 있고 부르는 곳이 없었다. 여기가 그 함수가 있어야 했던 자리다.
   */
  silentVariants?: readonly string[];
  /** 데이터가 꽂히는 자리 — 값은 무한해도 된다. 여기 오는 것만이 명리 용어다 */
  slots: readonly string[];
  /**
   * 슬롯 값의 **모양**을 보이는 표본 — 생성기 계약의 나머지 절반이다.
   *
   * `slots: ['positions']` 는 "positions 라는 값이 있다"까지만 말한다. 그 값이
   * `'월주·일주'` 인지 `'子, 午'` 인지 모르면 생성기가 문장 틀을 쓸 수 없고,
   * 뼈대 검사는 슬롯을 비우고 보므로 띄어쓰기도 조사도 못 본다.
   *
   * **표본은 검사용 fixture 이지 근거가 아니다.** 절대 `grounded` 로 흘려보내지
   * 않는다 — 흘리면 꽂은 값이 스스로를 근거로 삼아 "없는 관계를 말하면 걸린다"가
   * 통째로 무력해진다. 그래서 표본에는 일부러 명리 용어를 넣어 뒀고, 그것이
   * 근거 없이 렌더되면 걸린다는 것을 테스트가 잠근다.
   */
  samples: Record<string, string>;
  note: string;
};

export const FRAGMENT_TOPICS: Record<FragmentTopic, TopicSpec> = {
  /**
   * 뿌리가 있다. 여섯 글자에서 찾은 뿌리는 시주가 있어도 그대로 뿌리라
   * 시간 미상에서도 말할 수 있다(한 칸 내려서).
   */
  'rootedness.rooted': {
    paths: ['analysis.rootedness'],
    polarity: 'presence',
    // 같은 글자에 둔 뿌리와 같은 오행에만 둔 뿌리는 계통이 갈리는 자리라
    // 문장도 갈린다(`ROOTEDNESS_POLICY.rootKind: 'same-element-marked'`).
    variants: ['same-stem', 'same-element'],
    slots: ['dayMaster', 'positions'],
    samples: { dayMaster: '갑', positions: '월주·일주' },
    note: '일간이 어느 지지에 뿌리를 두는가',
  },

  /**
   * 뿌리가 없다. **시간 미상이면 이 주제는 통째로 말할 수 없다** — 시지가
   * 뿌리였다면 "무근입니다"가 그냥 틀린 문장이 된다. `producibleStrengths` 가
   * 강도 하나만 내는 유일한 주제이고, 그것이 계약이 여기서 값을 내는 자리다.
   */
  'rootedness.rootless': {
    paths: ['analysis.rootedness'],
    polarity: 'absence',
    variants: ['day-master'],
    slots: ['dayMaster'],
    samples: { dayMaster: '갑' },
    note: '일간이 어디에도 뿌리를 두지 못한다',
  },

  'strength.verdict': {
    paths: ['analysis.strength'],
    polarity: 'presence',
    variants: ['strong', 'weak'],
    // 등급 이름은 붙이지 않는다(`STRENGTH_POLICY.gradeBands: 'none'`).
    // 숫자를 그대로 꽂는 슬롯 하나뿐인 것이 그 결정의 결과다.
    slots: ['ratio'],
    samples: { ratio: '38%' },
    note: '신강·신약을 어느 쪽으로 보는가',
  },

  /**
   * 억부 후보. 근거가 둘이라 상한이 낮은 쪽(`candidate`)을 따른다 —
   * 강약을 읽지 않고는 억부 후보가 나오지 않으므로 둘 다 적어야 한다.
   */
  'eokbu.candidate': {
    paths: ['analysis.strength', 'analysis.eokbu'],
    polarity: 'presence',
    variants: Object.keys(ELEMENT_ROLE_KO) as ElementRole[],
    slots: ['role', 'element'],
    samples: { role: '재성', element: '화' },
    note: '억부 관점에서 어느 자리의 오행을 후보로 보는가',
  },

  /**
   * 내 억부 후보를 상대가 갖고 있다 — **궁합에서 처음 서는 산문이다.**
   *
   * 그 전까지 궁합이 낸 발화는 전부 `fact` 였다(관계 행 · 목록 · 십성). 완충
   * 표현이 궁합에서 한 번도 필요하지 않았다는 뜻이고, 그래서 `hourKnown` 도
   * 궁합에서는 아무 일도 하지 않는 죽은 값이었다 — 사이 관계도 십성도
   * `HOUR_SENSITIVE_PATHS` 에 없다. 이 주제가 그 분기를 처음 켠다.
   *
   * **딱지는 물려받은 것이다.** 억부는 각자의 원국에서 이미 시험값이고
   * (`COMPAT_POLICY.eokbu: 'inherits-experimental'`) 궁합으로 넘어오면서 떨어지면
   * 근거 없는 확신이 결론으로 새어 나간다. 상한이 `candidate` 인 것이 그 딱지다.
   *
   * **두 사람의 시주가 모두 걸린다.** 내 억부 후보는 내 여덟 글자에서 나오고
   * (`analysis.strength`·`analysis.eokbu`), 상대 원국에서 그 오행이 차지하는
   * 비중은 상대의 여덟 글자에서 나온다(`analysis.elements`). 셋 다 시주에 걸리는
   * 근거라 한쪽만 몰라도 문장이 드는 값이 달라진다.
   *
   * 그래서 강등된 벌은 **누구의** 시주를 뺐는지 말해야 한다. `HOUR_UNKNOWN_MARK`
   * 는 원국에서 '시주' 한 마디로 충분했지만 여기서는 그것으로 못 가린다 — 행이
   * 못 하던 말을 목록이 한 것과 같은 문제가 **문장 안에서** 다시 나오고, 같은
   * 방법으로 푼다(`{who}`).
   *
   * 뜻풀이(`ROLE_GLOSS`)를 달지 않는다. 그 자리가 일간과 무엇을 맺는지는 **원국의
   * 억부 문장이 이미 말했고**, 궁합 문장이 그 위에 얹는 것은 "상대가 갖고 있는가"
   * 하나다. 같은 뜻풀이를 두 번 하면 그것이 동어반복이다 — 십성이 뜻풀이를 다는
   * 이유가 정반대인 것에 주의할 것(일간↔일간은 원국 표에 없어 혼자 서야 한다).
   */
  'eokbuMatch.supplied': {
    paths: ['analysis.strength', 'analysis.eokbu', 'analysis.elements'],
    polarity: 'presence',
    variants: ['partner'],
    slots: ['viewer', 'partner', 'role', 'element', 'ratio', 'who'],
    samples: {
      viewer: '민수',
      partner: '지영',
      role: '인성',
      element: '수',
      ratio: '32%',
      who: '지영',
    },
    note: '내 억부 후보 오행을 상대가 얼마나 갖고 있는가',
  },

  /**
   * 상대에게 그 오행이 **없다** — 같은 근거를 읽는데 방향이 반대다.
   *
   * 위와 한 주제로 묶고 변종으로 가를 수 없다. 방향이 주제의 필드인 이유가 정확히
   * 이것이고(`ClaimPolarity`), 뿌리 있다 ↔ 무근이 두 주제인 것과 같은 자리다 —
   * 상대의 시주가 빠지면 그 자리에 그 오행이 있었을 수 있어서 "없습니다"가 그냥
   * 틀린 문장이 된다. 그래서 시간 미상에서는 한 칸 내리는 것이 아니라 입을 닫고,
   * 조각도 한 벌뿐이다.
   *
   * **궁합에서 처음으로 침묵하는 주제다.** 그 침묵은 골든에 `×` 로 찍힌다 —
   * 조립기가 요청을 걸러 버리면 "사실이 없다"와 한 덩어리가 되어 안 보인다.
   */
  'eokbuMatch.missing': {
    paths: ['analysis.strength', 'analysis.eokbu', 'analysis.elements'],
    polarity: 'absence',
    variants: ['partner'],
    slots: ['viewer', 'partner', 'role', 'element'],
    samples: { viewer: '민수', partner: '지영', role: '인성', element: '수' },
    note: '내 억부 후보 오행이 상대 원국에 아예 없다',
  },

  /**
   * 내게 없는 오행이 상대에게 있는가 — **행이다.**
   *
   * 궁합에서 "보완"이라 불리는 자리인데, 엔진이 아는 것은 **개수 둘**이다. 내
   * 원국에 그 오행이 0개이고 상대 원국에 0개가 아니다. 문턱도 계통 선택도 없다.
   *
   * 타입이 그것을 먼저 말한다 — `EokbuMatch` 에는 `status: 'experimental'` 이
   * 있는데 `ElementSupport` 에는 없다. 물려받을 판정이 없으니 상한이 `fact` 이고,
   * 완충 표현이 필요 없으면 산문일 이유가 없다(`ClaimForm`).
   *
   * **보완이라 부르지 않는다.** 없는 것을 채우는 쪽이 좋다는 읽기와 용신에 맞는
   * 오행이라야 한다는 읽기가 갈리고(`COMPAT_POLICY.elementSupport: 'facts-only'`),
   * 행에는 그 판정을 실을 서술어가 아예 없다 — 관계 행에서 "짝을 짓습니다"를 뗀
   * 것과 같은 자리다.
   *
   * **방향은 `absence` 다.** 주장의 앞머리가 "내게 그 오행이 없다"라서, 시지가 그
   * 오행이었다면 행 전체가 그냥 틀린다. 시간 미상에서는 내리는 것이 아니라 입을
   * 닫는다 — 무근·억부 부합과 같다.
   *
   * 변종 둘은 **상대가 가졌는가**로 갈린다. 그리고 둘의 낱수가 다르다 — 없는 것은
   * 사람마다지만 **둘 다 없는 것은 짝의 성질이라 한 번만 선다**(집합이 같다).
   */
  'elementSupport.absent': {
    paths: ['analysis.elements'],
    polarity: 'absence',
    form: 'row',
    variants: ['supplied', 'still-missing'],
    slots: ['viewer', 'partner', 'who', 'elements'],
    samples: { viewer: '민수', partner: '지영', who: '민수와 지영', elements: '화·토' },
    note: '내 원국에 없는 오행을 상대가 가졌는가',
  },

  /**
   * 가장 약한 오행이 상대 원국에서 얼마를 차지하는가.
   *
   * 없지는 않은 자리를 든다. 위 주제는 개수가 0일 때만 서므로 다섯 오행이 다 있는
   * 명식에서는 아무 말도 못 하는데, 그때도 **가장 얇은 자리**는 있다.
   *
   * **방향이 위와 갈린다.** "가장 약하다"는 없다는 주장이 아니라 다섯을 세어 고른
   * 값이라, 시주가 빠지면 다른 오행이 그 자리에 올 뿐 문장이 틀리지는 않는다.
   * 그래서 침묵이 아니라 한 칸 내려간다 — **행이 `fact` 아닌 강도로 서는 첫
   * 자리**이고, 계약이 "행은 강도가 옆 칸으로 선다"고 적어 둔 것이 여기서 값을
   * 낸다(면제는 완충 표현이지 강도가 아니다).
   */
  'elementSupport.weakest': {
    paths: ['analysis.elements'],
    polarity: 'presence',
    form: 'row',
    variants: ['pair'],
    slots: ['viewer', 'partner', 'element', 'ratio', 'who'],
    samples: {
      viewer: '민수',
      partner: '지영',
      element: '수',
      ratio: '12%',
      who: '지영',
    },
    note: '내 최약 오행이 상대 원국에서 차지하는 비중',
  },

  /**
   * 궁통보감 조후표에서 읽어 온 것. **출처 의무가 처음으로 문장에 걸리는 주제다**
   * (`ATTRIBUTION_PATHS` 의 유일한 원소가 `analysis.johu` 다).
   *
   * 변종 셋은 **원문이 이 칸을 어떻게 말하는가**로 갈린다. 120칸 중 여섯만
   * 상·하반월을 갈라 말하고, 그 여섯에서만 절반을 판정한다
   * (`JOHU_POLICY.conditionEvaluation: 'half-month-only'`). 갈리는 칸을
   * `whole-month` 문장으로 덮으면 원문이 갈랐다는 사실 자체가 사라지므로 —
   * 덜 말하는 것이 아니라 **원문을 요약해 버리는 것**이라 — 문장이 갈린다.
   *
   * `half-unjudged` 는 시간 미상이 만드는 칸이다. 절반은 우리가 채워 넣은
   * 정오에서 나온 값이라 그날 안에 중기가 들어 있으면 실제 시각이 뒤집을 수
   * 있다(`assemble.ts` 의 `FILLED_NOON_SPAN_MS`). 그때는 절반을 말하지 않고
   * 양쪽을 나란히 든다.
   *
   * 강도를 한 칸 내리지 않는다. 조후표를 여는 열쇠는 일간과 월지뿐이고
   * (`JOHU_POLICY.basis`) 시주 두 글자는 둘 중 어느 것도 바꾸지 않는다 —
   * 그래서 `HOUR_SENSITIVE_PATHS` 에 없고 조각도 한 벌이다.
   */
  'johu.table': {
    paths: ['analysis.johu'],
    polarity: 'presence',
    variants: ['whole-month', 'half-month', 'half-unjudged'],
    slots: ['dayMaster', 'monthBranch', 'stems', 'half', 'firstStems', 'secondStems'],
    samples: {
      dayMaster: '계',
      monthBranch: '미',
      stems: '경·신',
      half: '하반월',
      firstStems: '경·신·임·계',
      secondStems: '경·신',
    },
    note: '조후표가 이 일간·월지 칸에서 어느 천간을 드는가',
  },

  /**
   * 종격 판정. **말하지 않는 변종을 처음으로 가진 주제다.**
   *
   * 상한이 게이트에 묶여 있다(`CLAIM_CEILING['analysis.following']`). 지금은
   * 닫혀 있어 `candidate` 이고, 열리면 `derived` 로 올라가면서 이 주제의 조각
   * 키가 통째로 바뀌어 지시서에 빈칸이 생긴다 — **그 빈칸이 곧 "게이트를 열
   * 때 문장도 같이 고쳐라"는 알림이다.** 잊으면 테스트가 먼저 말한다.
   *
   * 격 이름(종재·종살…)은 슬롯에도 없다. `FOLLOWING_PATTERN_KIND_KO` 는
   * 정책이 이름을 적어 둔 분류표일 뿐 판정이 그 값을 내지 않는다
   * (`recognizedKinds` 는 목록이고 `FollowingAssessment` 에는 그 필드가 없다).
   * 없는 값을 말할 슬롯을 파 두면 언젠가 채워진다.
   */
  'following.verdict': {
    /**
     * 근거가 둘인 것은 문장이 뿌리를 말하기 때문이다. 종의 앞 조건이 무근이고
     * (`facts.dayMasterRootless`) 그것을 문장이 이유로 든다 — 읽은 것을 적지
     * 않으면 근거를 주제가 적는다는 규율이 껍데기가 된다.
     *
     * **방향이 `absence` 인 것이 이 주제의 값이다.** 계약이 `ClaimPolarity` 를
     * 만들 때부터 "종격의 앞 조건이 무근이라 이 한 줄이 종격 문장까지 함께
     * 잠근다"고 적어 두었는데, 잠글 자리가 없어 적혀만 있던 줄이다. 시지가
     * 뿌리였다면 "뿌리도 생부도 없어 밖으로 종한다"는 그냥 틀린 문장이다.
     *
     * 골든이 그것을 실제로 보였다. 같은 명식에서 시주만 지우자 판정이 `종격
     * 후보` 에서 `진종` 으로 **범주째 뒤집혔다.** 한 칸 내려 말할 일이 아니라
     * 입을 닫을 일이다. 안으로 종은 뿌리가 있어야 성립하므로 이 잠금이 조금
     * 과하지만, 뒤집히는 판정을 여섯 글자에서 말하는 것보다 과한 쪽이 낫다.
     */
    paths: ['analysis.following', 'analysis.rootedness'],
    polarity: 'absence',
    variants: FOLLOWING_VARIANTS,
    // "종격이 아니다"는 판정이 아니라 **우리가 고른 문턱 밖**이라는 뜻이다.
    // 게이트가 닫힌 채 그것을 결론처럼 말하면 실험값을 절대 기준으로 쓰게 된다.
    silentVariants: FOLLOWING_SILENT_VERDICTS,
    slots: ['verdict', 'direction', 'selfShare', 'dominant'],
    samples: { verdict: '가종', direction: '밖으로 종', selfShare: '12%', dominant: '재성' },
    note: '종격을 어느 쪽으로 얼마나 세게 보는가',
  },

  /**
   * 두 사람이 서로를 십성으로 무엇이라 보는가 — **궁합에서만 선다.**
   *
   * 원국의 십성은 이미 사주팔자 표에 여덟 자리 전부 적혀 있다. 표에 없던 것은
   * **일간과 일간 사이** 하나뿐이고, 그것이 궁합에서 처음 생기는 값이다.
   *
   * 행인 것은 강도가 정했다. 십성은 두 일간의 오행 관계와 음양을 표에서 읽은
   * 값이라 문턱도 계통 선택도 없다(`CLAIM_CEILING['analysis.tenGods'] = 'fact'`).
   * 완충 표현이 필요 없으면 산문일 이유가 없고, 그 자리에 서술어를 붙이면 없는
   * 무게가 실린다 — 관계 22칸이 2칸이 된 것과 같은 판단이다(`ClaimForm`).
   *
   * **조각이 한 벌뿐인 세 번째 자리이고 이유는 조후와 같다.** 십성을 여는 열쇠가
   * 두 일간뿐인데 일주는 시각을 몰라도 나오므로 시주 두 글자가 값을 바꾸지
   * 않는다. `HOUR_SENSITIVE_PATHS` 에 `analysis.tenGods` 가 없는 것이 그것이다.
   *
   * **방향은 변종이 아니라 슬롯이다.** 甲이 본 辛은 정관이고 辛이 본 甲은 정재라
   * 양방향이 다른데, 다른 것은 값이지 문장이 아니다 — 같은 틀에 이름과 십성만
   * 바꿔 두 번 세우면 비대칭은 두 행이 나란히 선 것으로 보인다. 방향을 변종으로
   * 가르면 `{viewer}` 를 틀에 굳히는 셈이라 누가 a 이고 b 인지를 문장이 알게 된다.
   *
   * **변종은 십성 열이 아니라 다섯 무리다.** 갈리는 것은 아래 한 마디(`ROLE_GLOSS`)
   * 이고 그것은 무리가 정한다 — 정재와 편재는 같은 말을 듣는다. 정·편의 차이는
   * `{tenGod}` 이름이 이미 들고 있으므로 변종이 아니라 슬롯이다.
   */
  'tenGods.between': {
    paths: ['analysis.tenGods'],
    polarity: 'presence',
    form: 'row',
    variants: Object.keys(TEN_GOD_GROUP_KO) as TenGodGroup[],
    slots: ['viewer', 'viewed', 'tenGod'],
    // 십성 이름은 일부러 표본에 둔다 — 근거 없이 렌더되면 걸려야 한다.
    samples: { viewer: '민수', viewed: '지영', tenGod: '정관' },
    note: '상대의 일간이 내 일간에게 어느 자리인가',
  },

  /**
   * 이 발화 묶음이 **어느 지금을 보고 났는가** — 목록 앞에 서는 한 줄.
   *
   * 현재운 문장들은 '지금'·'이번 달' 같은 상대 표현을 쓴다. 그 표현은 기준점이
   * 있을 때만 참인데, 결과 화면은 주소로 나눠 줄 수 있어서(`app/query.ts`) 받은
   * 사람이 내일 열면 '지금'이 다른 지금이다. 어제 찍은 스크린샷도 마찬가지다.
   *
   * **기준 시각을 행마다 적지 않는다.** 다섯 줄에 같은 날짜가 다섯 번 찍히면
   * 읽는 사람은 그것을 배경으로 흘려버리고, 그러면 적어 둔 값을 잃는다. 목록의
   * 조건을 목록이 드는 것 — `relation.coverage` 와 같은 판단이다. 다른 것은
   * **조건이 아니라 좌표**라서 언제나 선다는 점이다(저쪽은 시주가 빠졌을 때만).
   *
   * 근거가 `now` 하나뿐이다. 이 문장이 주장하는 것은 운에 대한 무엇이 아니라
   * **우리가 언제를 보고 셌는가**이고, 그것은 대운수가 흔들려도 흔들리지 않는다 —
   * "시주를 못 봤다"는 진술이 시주를 못 봐서 약해질 수 없는 것과 같은 자리다.
   */
  'now.asOf': {
    paths: ['now'],
    polarity: 'presence',
    variants: ['instant'],
    slots: ['at'],
    samples: { at: '2026년 8월 17일 21시' },
    note: '이 현재운을 어느 시각 기준으로 냈는가',
  },

  /**
   * 지금 도는 대운 — **현재운에서 유일한 산문이다.**
   *
   * 세운·월운 행은 `fact` 인데 이것만 `derived` 다. 갈리는 이유가 대운수에 있다 —
   * 절입까지의 거리를 사흘에 한 살로 셈한 뒤 정수로 만드는 방식이 계통마다 다르고
   * (`DaeunRounding`), 그 정수 없이는 어느 칸이 몇 살부터인지 말할 수 없다.
   * 완충 표현이 필요하다는 것이 곧 산문이어야 한다는 뜻이다(`ClaimForm`).
   *
   * **그래서 어느 계통을 골랐는지 문장이 적는다.** 조후가 "나머지 조건은 원문에
   * 있고 판정하지 않습니다"를 다는 것과 같은 의무다 — 우리가 고른 것을 밝히지
   * 않으면 독자는 그것이 하나뿐인 답인 줄 안다.
   *
   * 근거가 둘인 것이 요점이다. `daeun` 만으로는 표가 나오고 `now` 만으로는 시각이
   * 나온다. **지금이 어느 칸인가**는 둘을 겹쳐야 나오는 값이라 둘 다 적는다.
   *
   * 시간 미상이면 한 칸 내려간다. 대운수가 정오에서 재어져 반올림 경계에 걸리면
   * 칸이 하나 어긋나므로, 값이 달라지는 쪽이다 — 입을 닫을 일은 아니다(`presence`).
   */
  'now.daeun': {
    paths: ['now', 'daeun'],
    polarity: 'presence',
    variants: ['within'],
    slots: ['age', 'index', 'pillar', 'ageRange'],
    samples: { age: '36', index: '네 번째', pillar: '乙酉', ageRange: '만 36→45세' },
    note: '지금 어느 대운 안에 있는가',
  },

  /**
   * 첫 대운이 아직 오지 않았다 — **방향이 갈리면 주제가 갈린다.**
   *
   * 위와 같은 근거를 읽는데 주장이 반대다. "이 칸 안에 있다"는 대운수가 한 살
   * 어긋나도 대개 참이지만, **"아직 없다"는 대운수가 그것을 뒤집는다** — 대운수
   * 7이 6이었으면 이미 들어와 있다. 뿌리 있다 ↔ 무근, 억부 부합의 있다 ↔ 없다와
   * 같은 자리이고, 그래서 시간 미상에서는 내리지 않고 입을 닫는다.
   *
   * 표 밖으로 나간 쪽(`beyond-table`)은 여기 오지 않는다. 그것은 이 사람에 대한
   * 사실이 아니라 우리가 뽑은 칸 수의 한계라, 문장이 들면 남의 한계를 사실처럼
   * 말하게 된다(`DaeunAbsence`).
   */
  'now.daeunPending': {
    paths: ['now', 'daeun'],
    polarity: 'absence',
    variants: ['first'],
    slots: ['age', 'startAge', 'pillar'],
    samples: { age: '2', startAge: '3', pillar: '丁巳' },
    note: '첫 대운이 아직 오지 않았다',
  },

  /**
   * 지금의 세운 — **행이다.**
   *
   * 세운 간지는 그 해의 연주이고 연주 도출과 같은 함수에서 나온다(`yearPillarOf`).
   * 십성도 두 글자를 표에서 읽은 값이다. 문턱도 계통 선택도 없으니 `fact` 이고,
   * 완충 표현이 필요 없으면 산문일 이유가 없다.
   *
   * **시주에 걸리지 않는다.** 세운 간지는 해에서 나오므로 시주 두 글자가 아무것도
   * 바꾸지 않는다 — 대운과 갈리는 자리이고, 조각이 한 벌뿐인 이유다.
   *
   * 변종이 하나인 것은 갈릴 근거가 없어서다. 십성 무리로 가르고 싶어지지만 여기는
   * 십성이 **둘**이라(천간·지지) 무리 하나로 문장을 가를 수 없고, 뜻풀이를 달면 두
   * 벌이 필요해 행이 길어진다. 그 뜻풀이는 원국 십성 표가 이미 여덟 자리에 달고 있다.
   */
  'now.saeun': {
    paths: ['now', 'saeun'],
    polarity: 'presence',
    form: 'row',
    variants: ['year'],
    slots: ['year', 'pillar', 'stemTenGod', 'branchTenGod'],
    // 십성 이름을 일부러 표본에 둔다 — 근거 없이 렌더되면 걸려야 한다.
    samples: { year: '2026', pillar: '丙午', stemTenGod: '상관', branchTenGod: '식신' },
    note: '지금의 세운 간지와 일간에서 본 십성',
  },

  /**
   * 지금의 월운 — 위와 같은 모양이되 **경계가 다르다.**
   *
   * 세운은 입춘 하나로 갈리고 월운은 절입 열둘로 갈린다. 그 차이는 행이 아니라
   * 기준 시각 문장(`now.asOf`)이 든다 — 경계가 무엇인지는 이 달에 대한 사실이
   * 아니라 우리가 어떻게 짚었는가라서다.
   *
   * 달 이름을 사주월로 적는다(`미월`). 달력 월로 적으면 8월이 미월과 신월에 걸쳐
   * 있어서 어느 쪽을 말하는지가 사라진다 — 월운에서 가장 자주 어긋나는 자리다.
   */
  'now.wolun': {
    paths: ['now', 'wolun'],
    polarity: 'presence',
    form: 'row',
    variants: ['month'],
    slots: ['month', 'pillar', 'stemTenGod', 'branchTenGod'],
    samples: { month: '신월', pillar: '丙申', stemTenGod: '상관', branchTenGod: '정관' },
    note: '지금의 월운 간지와 일간에서 본 십성',
  },

  /**
   * 현재운 관계 목록이 **운끼리는 보지 않았다.**
   *
   * 시주 때문이 아니다. 시각을 다 알아도 이 목록에는 대운↔세운·대운↔월운이 없다 —
   * 세 칸이 저마다 **원국과의** 관계만 내고 월운만 세운을 함께 놓기 때문이다
   * (`UNCOVERED_NOW_FACTS`). 그래서 **언제나 선다.**
   *
   * 한동안 이 문장이 "대운이 낀 관계는 아직 세지 않았다"였다. 대운 칸이 관계를 들게
   * 되면서 **그 말이 거짓이 됐고 더 좁은 공백이 드러났다** — 대운은 원국과 걸리는
   * 것을 이제 다 내는데, 세운·월운과 걸리는 것은 여전히 아무도 안 본다. 고지가
   * 좁아지는 것이 채워졌다는 증거다.
   *
   * `relation.coverage` 와 주제를 나눈 것이 요점이다. 저쪽은 시주가 빠졌을 때만
   * 서고 빠진 것이 **입력**이며, 이쪽은 늘 서고 빠진 것이 **우리 구현**이다. 한
   * 주제로 묶으면 "시주를 알면 목록이 온전하다"가 조용히 들어온다.
   *
   * 근거에 `daeun` 을 적지 않는다. 이 문장은 대운에 대해 아무것도 주장하지 않고
   * **우리가 무엇을 세지 않았는지**만 말하므로, 대운수가 흔들려도 흔들릴 것이 없다.
   * 적으면 시간 미상에서 한 칸 내려가 "덜 확실하게 세지 않았다"가 된다.
   */
  'now.coverage': {
    paths: ['now', 'relations'],
    // 없다는 주장이 아니라 **빠뜨린 것이 있다**는 사실이다 — `relation.coverage` 와 같다.
    polarity: 'presence',
    variants: ['fortunes-not-crossed'],
    slots: [],
    samples: {},
    note: '현재운 관계 목록을 어디까지 세었는가',
  },

  /**
   * 원국에서 성립한 관계 하나 — **표의 한 줄이다.**
   *
   * 한동안 종류마다 서술어를 달았다(합은 짝을 짓고 충은 맞선다…). 그것이
   * **동어반복**이었다. '충(沖)' 이라는 글자에 이미 "맞선다"가 들어 있어서
   * 서술어가 정보를 하나도 더하지 않았고, 그러면서 나쁜 일을 둘 했다 —
   * 합에 붙인 "짝을 짓습니다"는 합화(化)를 판정한 것처럼 읽혔고(하지 않기로 한
   * 판정이다), 산문이 자리만 말하느라 **`participant.char` 를 통째로 버렸다.**
   * 어느 글자가 子고 어느 것이 午인지 문장에 없었다.
   *
   * 그래서 **열한 종류가 행을 가르지 못한다.** 종류가 행을 하나도 가르지 못하면
   * 종류는 변종이 아니라 슬롯이다 — 관계 넷이 한 문장을 나눠 쓰던 규칙
   * (`sharedWording`)을 끝까지 밀면 여기로 온다. 종류는 `{name}` 으로 들어오고
   * 글자와 자리는 `{participants}` 로 들어온다.
   *
   * 남은 변종 둘은 **종류가 아니라 성립한 방식**이 가른다. 두 사람의 글자가
   * 합쳐서 세 글자 구조를 이룬 것은 쌍 관계와 무게가 다르고, **그것을 인정할지
   * 자체가 계통 선택**이라 화면에서 섞으면 안 된다(`RelationScope`). 종류로는
   * 갈리지 않던 것이 여기서는 갈린다 — 엔진이 실제로 구분해 들고 있는 차이다.
   */
  'relation.present': {
    paths: ['relations'],
    polarity: 'presence',
    form: 'row',
    variants: ['row', 'combined'],
    slots: ['participants', 'name'],
    samples: { participants: '년지 子 · 일지 午', name: '자오충' },
    note: '어느 자리의 어느 글자끼리 어떤 관계가 성립하는가',
  },

  /**
   * 관계 목록이 **어떤 조건에서 세어졌는가** — 항목이 아니라 목록의 몫이다.
   *
   * 이 주제가 생기기 전에는 목록의 한계를 행 하나하나가 나눠 졌다. 시간 미상이면
   * 관계 행이 한 칸 내려가 `유도`가 됐는데, 그러면 **관측된 사실을 의심하는
   * 것처럼 읽힌다** — "을경합금(유도)"은 합인지 아닌지가 우리 해석이라는 뜻이
   * 아니었다. 규칙대로면 행은 `fact` 로 남아야 하고 못 본 것은 목록이 말해야
   * 한다(`INCOMPLETE_INPUT_RULE`).
   *
   * 근거가 `meta` 인 것이 요점이다. 이 문장이 주장하는 것은 관계에 대한 무엇이
   * 아니라 **우리가 무엇을 보고 셌는가**이고, 그것은 시주가 없어도 확실히 아는
   * 사실이다. 그래서 `fact` 이고 시간 미상에 내려가지도 않는다 — "시주를 못 봤다"는
   * 진술이 시주를 못 봐서 약해질 수는 없다.
   *
   * **목록이 말하니 행이 못 하던 말도 한다.** 행에는 누구의 시주가 빠졌는지 적을
   * 자리가 없었는데, 여기서는 `{who}` 가 이름을 부른다.
   */
  'relation.coverage': {
    paths: ['meta', 'relations'],
    // 없다는 주장이 아니다 — **빠뜨린 것이 있다**는 사실을 든다. `absence` 로 적으면
    // 시간 미상에서 통째로 잠겨, 정작 말해야 할 때 입을 닫는다.
    polarity: 'presence',
    variants: ['natal', 'compat'],
    slots: ['who'],
    samples: { who: '지영' },
    note: '이 관계 목록을 어떤 조건에서 셌는가',
  },
};

export const FRAGMENT_TOPIC_IDS = Object.keys(FRAGMENT_TOPICS) as FragmentTopic[];

export type FragmentKey = `${FragmentTopic}/${string}@${ClaimStrength}`;

/**
 * 조각 하나 — **문장 틀과 그 틀을 고르는 좌표뿐이다.**
 *
 * 근거도 방향도 여기 없다. 그것은 `topic` 이 들고 있고, 조각은 주제를 고를 수
 * 있을 뿐 주제가 무엇을 읽었는지는 고칠 수 없다.
 */
export type Fragment = {
  topic: FragmentTopic;
  variant: string;
  /**
   * 이 조각이 받아 내는 강도 — **선언이 아니라 조회 좌표다.**
   *
   * 조각이 "나는 사실이다"라고 말하는 자리가 아니라, `ceilingFor` 가 사실을
   * 냈을 때 고를 문장이 이것이라는 뜻이다. 주제가 낼 수 없는 강도를 적으면
   * `checkFragment` 가 잡는다.
   */
  strength: ClaimStrength;
  /** 슬롯만 비어 있는 문장 틀. 명리 용어를 여기 타이핑하지 않는다 */
  template: string;
};

export function fragmentKey(topic: FragmentTopic, variant: string, strength: ClaimStrength): FragmentKey {
  return `${topic}/${variant}@${strength}`;
}

export const keyOf = (fragment: Fragment): FragmentKey =>
  fragmentKey(fragment.topic, fragment.variant, fragment.strength);

/**
 * 이 주제가 실제로 낼 수 있는 강도들 — **생성기가 만들어야 할 벌 수**.
 *
 * 시각을 아는 명식과 모르는 명식에서 상한이 달라지므로 보통 둘이다.
 * `silent` 은 문장을 만들지 않으므로 세지 않는다 — 그래서 `rootedness.rootless`
 * 처럼 시간 미상에서 입을 닫는 주제는 한 벌만 나온다.
 */
export function producibleStrengths(topic: FragmentTopic): readonly ClaimStrength[] {
  const { paths, polarity } = FRAGMENT_TOPICS[topic];

  const strengths = [true, false].map((hourKnown) => ceilingFor({ paths, polarity, hourKnown }));

  return [...new Set(strengths)].filter((strength) => strength !== 'silent');
}

/**
 * 이 주제가 이 변종으로 **문장을 만드는가.**
 *
 * 강도를 내는 길은 하나여야 하므로(`renderFragment` 는 강도를 인자로 받지
 * 않는다) 판정값별 침묵도 스키마에서 나와야 한다. 이 술어가 그 자리다.
 */
export function speaks(topic: FragmentTopic, variant: string): boolean {
  return !FRAGMENT_TOPICS[topic].silentVariants?.includes(variant);
}

/**
 * 채워져야 하는 키 전부 — 생성기의 작업 지시서다.
 *
 * 조합이 유한하다는 것이 L3 를 런타임 AI 없이 하겠다는 결정의 전제였다.
 * 그 전제를 값으로 셀 수 있게 만드는 것이 이 함수의 몫이다.
 *
 * 말하지 않기로 한 변종은 지시서에 오르지 않는다. 올려 두면 **아무도 조회하지
 * 못하는 칸**이 영원히 빈칸으로 남아 "채워야 할 자리"를 세는 숫자가 거짓말을 한다.
 */
export function expectedFragmentKeys(): FragmentKey[] {
  return FRAGMENT_TOPIC_IDS.flatMap((topic) =>
    FRAGMENT_TOPICS[topic].variants
      .filter((variant) => speaks(topic, variant))
      .flatMap((variant) =>
        producibleStrengths(topic).map((strength) => fragmentKey(topic, variant, strength)),
      ),
  );
}

export type FragmentViolationRule =
  | TextViolationRule
  /** 주제에 없는 변종이다 */
  | 'unknown-variant'
  /** 이 주제가 낼 수 없는 강도다 */
  | 'unproducible-strength'
  /** 말하지 않기로 한 변종에 문장을 썼다 */
  | 'silent-variant'
  /** 주제가 선언하지 않은 슬롯을 썼다 */
  | 'undeclared-slot'
  /** 조사를 슬롯 뒤에 붙였다 — 받침에 따라 갈린다 */
  | 'slot-particle'
  /** 주제가 이 슬롯의 표본 값을 적지 않았다 */
  | 'missing-sample'
  /** 표본으로 렌더하면 문장의 형태가 어긋난다 */
  | 'malformed-sample'
  /** 채우지 않은 슬롯이 남았다 */
  | 'unfilled-slot';

export type FragmentViolation = {
  rule: FragmentViolationRule;
  slot?: string;
  term?: string;
  detail: string;
};

/**
 * 앞 글자의 받침에 따라 갈리는 조사.
 *
 * `{element}를` 은 화·토·수에서만 맞고 목·금에서 틀린다. 슬롯 값은 런타임에
 * 정해지므로 문장 틀이 미리 고를 수 없다. 조사를 붙여 쓰려면 슬롯 뒤에 다른
 * 낱말을 한 번 놓고(`{name} 관계가`) 그 낱말에 붙인다.
 */
export const VARIABLE_PARTICLES: readonly string[] = ['이', '가', '은', '는', '을', '를', '과', '와', '로', '으로'];

const SLOT_PATTERN = /\{([a-zA-Z]+)\}/g;

/** 문장 틀이 쓴 슬롯 이름들 */
export function slotsUsedBy(template: string): string[] {
  return [...template.matchAll(SLOT_PATTERN)].map(([, name]) => name);
}

/** 슬롯을 비운 문장 — 정적 검사는 이 뼈대를 본다 */
export function skeletonOf(template: string): string {
  return template.replace(SLOT_PATTERN, '');
}

/**
 * 표본 값으로 렌더한 문장 — **읽어 볼 수 있는 예문이자 형태 검사의 입력이다.**
 *
 * 이 문장을 계약 검사기에 다시 넣지 않는다. 표본은 근거가 아니라서 넣으면
 * 명리 용어가 전부 `ungrounded-term` 으로 걸린다 — 그것을 피하려고 표본을
 * 근거로 넘기는 순간 검사가 통째로 무력해진다. 여기서 보는 것은 **형태**다.
 */
export function sampleSentence(fragment: Fragment): string {
  return fillTemplate(fragment.template, FRAGMENT_TOPICS[fragment.topic].samples);
}

function fillTemplate(template: string, slots: Record<string, string>): string {
  return template.replace(SLOT_PATTERN, (whole, name: string) => slots[name] ?? whole);
}

/**
 * 조각 하나를 스키마와 계약에 비춰 본다 — **명식 없이 돈다.**
 *
 * 핵심은 마지막 줄이다. **슬롯을 비운 뼈대를 근거 하나 없이 검사기에 넣는다.**
 * 뼈대에 명리 용어가 하나라도 있으면 근거 목록이 비었으니 `ungrounded-term` 으로
 * 걸린다 — 그것이 곧 "용어는 데이터에서만 온다"를 정적으로 강제하는 자리다.
 * 완충 표현과 금지 표현도 같은 호출에서 함께 본다. 규칙을 두 번 쓰지 않는다.
 */
export function checkFragment(fragment: Fragment): FragmentViolation[] {
  const violations: FragmentViolation[] = [];
  const spec = FRAGMENT_TOPICS[fragment.topic];

  if (!spec.variants.includes(fragment.variant)) {
    violations.push({
      rule: 'unknown-variant',
      term: fragment.variant,
      detail: `${fragment.topic} 에 없는 변종이다. 변종은 유한해야 생성기가 전수로 돈다.`,
    });
  }

  if (!speaks(fragment.topic, fragment.variant)) {
    violations.push({
      rule: 'silent-variant',
      term: fragment.variant,
      detail: `${fragment.topic} 은 ${fragment.variant} 를 말하지 않기로 했다 — 아무도 조회하지 못하는 조각이다.`,
    });
  }

  if (!producibleStrengths(fragment.topic).includes(fragment.strength)) {
    violations.push({
      rule: 'unproducible-strength',
      detail: `${fragment.topic} 은 ${fragment.strength} 를 내지 않는다 — 아무도 조회하지 못하는 조각이다.`,
    });
  }

  for (const slot of slotsUsedBy(fragment.template)) {
    if (spec.slots.includes(slot)) continue;

    violations.push({
      rule: 'undeclared-slot',
      slot,
      detail: `${fragment.topic} 이 선언하지 않은 슬롯이다. 채울 값이 어디서 오는지 아무도 모른다.`,
    });
  }

  for (const match of fragment.template.matchAll(SLOT_PATTERN)) {
    const after = fragment.template.slice((match.index ?? 0) + match[0].length);
    const particle = VARIABLE_PARTICLES.find((p) => after.startsWith(p));
    if (!particle) continue;

    violations.push({
      rule: 'slot-particle',
      slot: match[1],
      term: particle,
      detail: `조사 '${particle}' 는 앞 글자의 받침을 따르는데 슬롯 값은 런타임에 정해진다.`,
    });
  }

  const sample = sampleSentence(fragment);

  for (const slot of slotsUsedBy(sample)) {
    violations.push({
      rule: 'missing-sample',
      slot,
      detail: `${fragment.topic} 이 ${slot} 의 표본 값을 적지 않았다 — 생성기가 값의 모양을 모른다.`,
    });
  }

  // 뼈대 검사는 슬롯을 비우고 보므로 띄어쓰기도 문장 끝도 못 본다.
  // 행은 마침표로 끝나지 않는다 — 문장이 아니라 표의 한 줄이다.
  const closed = spec.form === 'row' ? !/[.\s]$/.test(sample) : sample.endsWith('.') && !/ \.$/.test(sample);

  if (sample !== sample.trim() || /\s{2}/.test(sample) || !closed) {
    violations.push({
      rule: 'malformed-sample',
      detail: `표본으로 렌더하면 형태가 어긋난다: "${sample}"`,
    });
  }

  // 뼈대는 근거가 하나도 없는 상태로 계약을 통과해야 한다.
  violations.push(
    ...checkSentence({
      text: skeletonOf(fragment.template),
      paths: spec.paths,
      strength: fragment.strength,
      form: spec.form,
      grounded: [],
    }),
  );

  return violations;
}

export type FragmentIndex = ReadonlyMap<FragmentKey, Fragment>;

/** 같은 키가 둘이면 어느 쪽이 나갔는지 알 수 없다 — 세우는 자리에서 막는다 */
export function indexFragments(fragments: readonly Fragment[]): FragmentIndex {
  const index = new Map<FragmentKey, Fragment>();

  for (const fragment of fragments) {
    const key = keyOf(fragment);
    if (index.has(key)) throw new Error(`조각 키가 겹친다: ${key}`);
    index.set(key, fragment);
  }

  return index;
}

export type FragmentRequest = {
  topic: FragmentTopic;
  variant: string;
  /** 슬롯에 꽂을 값 — 전부 L2 가 낸 것이어야 한다 */
  slots: Record<string, string>;
  /**
   * 이 명식이 실제로 낸 용어들.
   *
   * 슬롯 값을 여기에 자동으로 넣지 않는다. 넣으면 꽂은 값이 스스로를 근거로
   * 삼는 셈이라 검사가 언제나 통과한다 — 조회하는 쪽이 명식에서 읽어 온 것을
   * 그대로 적어야 대조가 성립한다.
   */
  grounded: readonly string[];
  /** 시각을 알고 계산했는가 */
  hourKnown?: boolean;
};

export type RenderedFragment = {
  /** `silent` 이면 조회조차 하지 않으므로 null */
  key: FragmentKey | null;
  strength: ClaimStrength;
  /** 말하지 않기로 했거나 조각이 아직 없으면 null */
  text: string | null;
  violations: FragmentViolation[];
};

/**
 * 조회 → 조립 한 번.
 *
 * **강도를 받지 않는다.** 주제의 근거와 명식의 시각 여부만으로 여기서 계산한다.
 * 부르는 쪽이 강도를 건네게 두면 `paths` 를 주제로 옮겨 막은 구멍이 호출부에서
 * 그대로 다시 열린다.
 *
 * 조각이 없으면 말하지 않는다. 비어 있는 자리를 억지로 다른 강도의 조각으로
 * 메우지 않는다 — 그 순간 강도는 조회 좌표가 아니라 장식이 된다.
 */
export function renderFragment(request: FragmentRequest, index: FragmentIndex): RenderedFragment {
  const { topic, variant, slots, grounded, hourKnown = true } = request;
  const spec = FRAGMENT_TOPICS[topic];

  // 판정값별 침묵이 먼저다. 근거가 허용하는 강도와 무관하게 말하지 않기로 한
  // 자리라, 근거에서 강도를 내고 나서 지우면 순서가 거꾸로다.
  if (!speaks(topic, variant)) return { key: null, strength: 'silent', text: null, violations: [] };

  const strength = ceilingFor({ paths: spec.paths, polarity: spec.polarity, hourKnown });
  if (strength === 'silent') return { key: null, strength, text: null, violations: [] };

  const key = fragmentKey(topic, variant, strength);
  const fragment = index.get(key);
  if (!fragment) return { key, strength, text: null, violations: [] };

  const text = fillTemplate(fragment.template, slots);
  const violations: FragmentViolation[] = slotsUsedBy(text).map((slot) => ({
    rule: 'unfilled-slot' as const,
    slot,
    detail: `${key} 가 요구하는 값이 요청에 없다.`,
  }));

  const sentence: TextViolation[] = checkSentence({
    text,
    paths: spec.paths,
    strength,
    form: spec.form,
    grounded,
  });

  return { key, strength, text, violations: [...violations, ...sentence] };
}

/**
 * 채운 자리 / 채워야 할 자리.
 *
 * 말뭉치를 인자로 **받는다**. 기본값으로 `corpus.ts` 를 끌어오면 스키마가
 * 내용물을 알게 되고, 그러면 "몇 칸이 비었는가"를 세는 쪽과 그 칸을 채우는 쪽이
 * 서로를 부르게 된다. 세는 도구는 무엇을 세는지 몰라야 한다.
 */
export function fragmentCoverage(index: FragmentIndex) {
  const expected = expectedFragmentKeys();

  return {
    filled: expected.filter((key) => index.has(key)).length,
    expected: expected.length,
    missing: expected.filter((key) => !index.has(key)),
  };
}

/**
 * 채택한 조각 규칙. 다른 `*_POLICY` 와 같은 구실을 한다 — 골든 스냅샷이 찍는다.
 */
export const FRAGMENT_POLICY = {
  ruleSet: 'text-fragment-schema-v1',
  /** 스키마와 검사기뿐이다 — 문장은 `corpus.ts`, 생성기는 아직 없다 */
  status: 'schema-only',
  /** 조회 좌표 */
  key: 'topic/variant@strength',
  /** 강도는 표현을 고르는 좌표이지 조각이 선언하는 속성이 아니다 */
  claimStrength: 'selects-wording-never-declared',
  /** 근거는 주제가 적는다 — 조각이 적으면 상한을 스스로 올릴 수 있다 */
  evidence: 'declared-by-topic',
  /** 방향도 주제가 적는다 — 있다와 없다는 안전도가 달라 다른 주제다 */
  polarity: 'declared-by-topic',
  /** 변종은 빌드 타임에 전수로 도는 유한 목록이다 */
  variants: 'finite-enumerated',
  /** 슬롯 값은 런타임에 L2 에서 온다 — 명리 용어는 전부 이 길로만 들어온다 */
  slots: 'runtime-values-from-l2',
  /** 슬롯 값은 스스로를 근거로 삼지 못한다 */
  grounding: 'evidence-supplied-by-caller',
  /** 슬롯 표본은 값의 모양을 보이는 fixture 다 — 근거로 흘려보내지 않는다 */
  samples: 'fixture-not-evidence',
  /** 받침에 따라 갈리는 조사를 슬롯 뒤에 붙이지 않는다 */
  particles: 'no-variable-particle-after-slot',
  /** 슬롯을 비운 뼈대가 근거 없이 계약을 통과해야 한다 */
  staticCheck: 'skeleton-passes-contract-with-no-evidence',
  /** 조각이 없으면 말하지 않는다 — 다른 강도의 조각으로 메우지 않는다 */
  missingFragment: 'silent',
  /** 판정값별 침묵은 변종에 걸린다 — 강도를 내는 길은 그래도 하나다 */
  silentVariants: 'declared-by-topic',
  /** 세어지기만 하는 사실은 행이다 — 서술어가 없고 강도는 옆 칸이 든다 */
  form: 'declared-by-topic',
} as const;
