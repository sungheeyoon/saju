import { ELEMENT_KO, type Element } from '../saju';

/**
 * `discovery-v0` — 아직 선택되지 않은 후보의 **노출 순서**.
 *
 * `match-v0` 와 **다른 정책이고 다른 일을 한다**(ADR 0003). 같은 숫자를 두 일에 쓰면
 * 한쪽이 만든 편향이 다른 쪽의 신뢰로 세탁된다. 그래서 네 축 중 둘을 일부러 뺐다.
 *
 * - `dataCompleteness` — 사람의 적합성이 아니라 **우리 자료의 완성도**다. 순위에
 *   넣으면 출생시간을 모르는 사람이 사주가 안 맞아서가 아니라 입력이 덜 차서 덜
 *   노출된다.
 * - `connectionDensity` — 관계 신호의 **양**이지 좋은 관계라는 뜻이 아니다. 위에 뜬
 *   사람은 사용자에게 「추천」으로 읽힌다.
 *
 * **정렬만 한다.** 사주 계산값에 문턱을 두어 사람을 지우지 않는다 — 안 보여준 사람은
 * 사용자가 존재조차 모르므로 틀렸다는 피드백이 영영 오지 않는다.
 *
 * ## 이 모듈이 **하지 않는** 일
 *
 * 줄 세우기도, 탐색 배치도, 노출 기록도 여기 없다. 셋 다 `discovery_board()` 안에서
 * 한 번에 일어난다 — 나눠 두면 「무엇을 보여줄까」와 「무엇을 보여줬다고 적을까」가 서로
 * 다른 신뢰 경계에 놓이고, 뒤의 것은 브라우저에서 그대로 부를 수 있는 자리가 된다.
 * 자리·탐색 여부·후보 목록을 손으로 적을 자리가 **아예 없어야** 위조가 불가능하다.
 *
 * 여기 남은 것은 **정책의 선언**과 **말**이다. 값(가중치·밴드 경계)은 SQL 에도 하나씩
 * 있으므로 양쪽 시험이 같은 수를 든다 — 한쪽만 고치면 다른 쪽이 깨진다.
 *
 * ## 후보 카드는 **맛보기**다
 *
 * 추천 이유는 적극적으로 말한다 — 어느 오행이 무엇을 채우는지까지. 그것을 감추면
 * 「왜 이 사람인가」에 답하지 못하고, 답하지 못하는 추천은 궁금해지지도 않는다.
 * 감추는 것은 **상세 궁합과 원문**이다: 여덟 글자, 천간·지지, 십성·신살·형충회합,
 * 운, 상대의 전체 오행 구성, 그리고 생년월일시·출생지. 형충회합과 상세 근거는
 * **서로 동의한 뒤**에 열린다.
 */

/**
 * 정책 — **축·가중치·탐색 비율·버전을 값으로 선언한다**(`prd-archive`).
 *
 * 가중치는 `match-v0` 의 두 축(0.35 · 0.30)을 남기고 합이 1이 되게 다시 나눈 값이다
 * (0.35/0.65 ≈ 0.54, 0.30/0.65 ≈ 0.46). **거기서 왔을 뿐 지금부터는 따로 산다** —
 * `match-v0` 의 가중치를 고쳐도 이 값은 움직이지 않는다. 움직이면 `discovery-v0` 라는
 * 이름이 가리키는 것이 조용히 바뀐다.
 *
 * **줄 세우기는 SQL 이 한다.** 여기 적힌 수는 그 셈의 선언이고, `09_discovery_board`
 * 가 같은 수로 기대값을 만든다.
 */
export const DISCOVERY_POLICY_V0 = {
  version: 'discovery-v0',
  status: 'beta',
  /** 정렬만 하고 사람을 지우지 않는다 */
  behavior: 'rank-only',
  hardThreshold: 'none',
  weights: {
    complement: 0.54,
    combinedBalance: 0.46,
  },
  /** 순위에 쓰지 않는 것 — 뺀 이유는 위 주석과 ADR 0003 에 있다 */
  excluded: [
    'dataCompleteness',
    'connectionDensity',
    'eokbu',
    'following-pattern',
    'structure',
    'johu-conditions',
  ] as const,
  /** 목록의 이만큼은 상위가 아닌 자리에서 뽑아 섞는다 */
  explorationRatio: 0.2,
  /** 한 번에 보여주는 후보 수 */
  pageSize: 10,

  /**
   * 균형 값을 말로 바꾸는 문턱.
   *
   * **숫자를 보여주지 않으므로 이 두 수가 곧 사용자가 보는 차이다.** 82점과 79점은
   * 절대적인 궁합 차이로 읽히지만 「고른 편」과 「대체로 고른 편」은 그렇지 않다.
   */
  balanceBands: { even: 70, mixed: 50 },

  /**
   * 후보 카드가 **말해도 되는 것**과 **말하지 않는 것**.
   *
   * 경계를 값으로 든다. 주석으로 적으면 아무것도 잠그지 않고, 화면마다 조금씩
   * 넓어진다. 오른쪽은 서로 동의한 뒤에 열리는 것들이고, 생년월일시와 출생지는
   * 그때도 열리지 않는다(ADR 0008).
   */
  discloses: ['supplied-elements', 'element-meaning', 'balance-band'] as const,
  withholds: [
    'birth-input',
    'birth-place',
    'pillars',
    'stems-and-branches',
    'ten-gods',
    'sinsal',
    'relations',
    'luck',
    'evidence',
    'element-counts',
    'score',
  ] as const,
} as const;

/**
 * 오행 한 글자가 사람에게 무엇으로 읽히는가 — **관습적 의미이지 계산 결과가 아니다.**
 *
 * 엔진이 낸 사실이 아니므로 강도 딱지가 붙지 않는다. 후보 카드가 「왜 이 사람인가」를
 * 사람 말로 옮길 때만 쓰고, 사실을 말하는 자리에서는 쓰지 않는다.
 */
export const ELEMENT_MEANING: Record<Element, string> = {
  木: '성장과 확장',
  火: '열정과 표현',
  土: '중심과 포용',
  金: '안정감과 결단력',
  水: '유연함과 통찰',
};

/** 함께 놓은 균형을 세 칸으로 — 경계는 `balanceBands`, 판정은 `discovery_balance_band` */
export type BalanceBand = 'even' | 'mixed' | 'skewed';

/** `discovery_board()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
export type BoardRow = {
  candidateUserId: string;
  nickname: string;
  intro: string | null;
  hasPhoto: boolean;
  /** 0부터 — 화면의 차례이자 노출 기록이 든 자리 */
  seat: number;
  exploration: boolean;
  /** 내게 없는 오행 중 이 후보가 가진 것. 상대의 전체 구성이 아니다 */
  suppliedElements: readonly Element[];
  balanceBand: BalanceBand;
};

/** 이 후보가 내게 채우는 오행 하나와 그 뜻, 그리고 그것을 사람 말로 옮긴 한 줄 */
export type CandidateHighlight = {
  element: Element;
  meaning: string;
  text: string;
};

const BALANCE_LABEL: Record<BalanceBand, string> = {
  even: '함께 놓으면 오행 균형이 고르게 잡히는 편입니다.',
  mixed: '함께 놓으면 오행이 대체로 고른 편입니다.',
  skewed: '함께 놓아도 오행이 한쪽으로 기우는 편입니다.',
};

export const DISCOVERY_CAVEAT =
  '추천 순서는 궁합의 좋고 나쁨이 아닙니다. 오행 보완과 함께 놓았을 때의 균형을 살펴볼 뿐이고, 사주 점수가 낮다는 이유로 누군가를 숨기지 않습니다.';

/** 여기서 멈추는 이유와 다음 — **상세 궁합은 서로 동의한 뒤에 열린다** */
export const DISCOVERY_TEASER =
  '서로 동의하면 형충회합과 상세 궁합을 확인할 수 있습니다. 지금 보이는 것은 오행으로 본 맛보기이고, 여덟 글자와 구체적인 근거는 아직 열리지 않습니다.';

export const EXPLORATION_NOTE =
  '새로운 추천은 비슷한 유형만 반복해서 보여드리지 않기 위해 일부러 섞은 인연입니다.';

export const NO_MISSING_NOTICE =
  '당신의 원국에는 빠진 오행이 없어 보완으로 견줄 것이 없습니다. 아래 순서는 함께 놓았을 때의 오행 균형으로 섰습니다.';

/**
 * 참여를 켜기 전에 읽히는 말 — **화면과 ADR 과 `prd-archive` 가 같은 문장을 든다.**
 *
 * 무엇이 나가고 무엇이 안 나가는지를 세 곳에 따로 적으면 한 곳만 고쳐지고, 그때
 * 사용자가 읽은 약속과 실제 동작이 갈린다. 문장을 여기 한 벌 두고 화면이 그대로 쓴다.
 */
export const DISCOVERY_DISCLOSURE = {
  shown: [
    '닉네임과 프로필 사진, 그리고 소개 — 사진은 올린 사람만 서고, 없으면 이름의 첫 글자가 섭니다.',
    '나에게 부족한 오행 중 소개받은 사람이 채우는 오행의 이름과 그 뜻 — 상대의 카드에도 같은 방식으로 내 오행이 몇 글자 나타납니다.',
    '함께 놓았을 때의 오행 균형을 말로 옮긴 설명.',
  ],
  hidden: [
    '생년월일시와 출생지.',
    '전체 명식과 전체 오행 개수표.',
    '숫자 점수 — 순서를 정하는 데만 쓰고 누구에게도 보여주지 않습니다.',
  ],
} as const;

/**
 * 후보 한 줄을 사람 말로 — **어느 오행이 무엇을 채우는지까지 말한다.**
 *
 * 이름을 감추면 「왜 이 사람인가」에 답할 수 없고, 답 못 하는 추천은 궁금해지지도
 * 않는다. 여기서 부르는 것은 **내게 없는 오행 중 상대가 가진 것**뿐이다 — 상대의
 * 전체 구성도, 개수표도, 여덟 글자도 아니다.
 */
export function cardTextFor(row: Pick<BoardRow, 'suppliedElements' | 'balanceBand'>): {
  highlights: CandidateHighlight[];
  balanceLabel: string;
} {
  return {
    highlights: row.suppliedElements.map((element) => ({
      element,
      meaning: ELEMENT_MEANING[element],
      text: `당신에게 부족한 ${ELEMENT_KO[element]}(${element}) 기운을 채워 ${ELEMENT_MEANING[element]}을 돕는 조합입니다.`,
    })),
    balanceLabel: BALANCE_LABEL[row.balanceBand],
  };
}

/**
 * 목록이 함께 드는 말 — **없는 것은 설명하지 않는다.**
 *
 * 탐색 후보가 한 자리도 없는 날 「탐색 후보란…」이 서 있으면 사용자는 없는 것을 찾게 된다.
 */
export function boardNotes({
  viewerMissingCount,
  hasExploration,
}: {
  viewerMissingCount: number;
  hasExploration: boolean;
}): { notice: string | null; explorationNote: string | null } {
  return {
    notice: viewerMissingCount === 0 ? NO_MISSING_NOTICE : null,
    explorationNote: hasExploration ? EXPLORATION_NOTE : null,
  };
}
