import { ELEMENT_KO, type Element } from '../saju';

/**
 * `discovery-v1` — 아직 선택되지 않은 후보의 **노출 순서와 오행 첫인상**.
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
 * `discovery-v1` 은 눈에 보이는 글자 수의 합산 균형 70%와, 20% 미만 부족분에 상대
 * 오행이 닿는 정도로 잰 상호보완 30%를 쓴다. 상대 오행은 20%에서 포화해 과다 보유를
 * 추가 가점으로 만들지 않는다. 상세 궁합이나 명리의 정답이 아니라 오행 구성을 단순
 * 비교한 첫인상이다.
 *
 * **줄 세우기는 SQL 이 한다.** 여기 적힌 수는 그 셈의 선언이고, `09_discovery_board`
 * 가 같은 수로 기대값을 만든다. 그 수는 후보 카드에서 `오행 첫인상 점수`로 보인다.
 * 상세 궁합과 혼동되지 않도록 오행 구성만 단순 비교한 참고값이라고 함께 말한다.
 */
export const DISCOVERY_POLICY = {
  version: 'discovery-v1',
  status: 'beta',
  /** 정렬만 하고 사람을 지우지 않는다 */
  behavior: 'rank-only',
  hardThreshold: 'none',
  weights: {
    complement: 0.3,
    combinedBalance: 0.7,
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
  discloses: ['supplied-elements', 'balance-band', 'preview-score'] as const,
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
  ] as const,
} as const;

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
  /** 내 비율이 20%보다 낮은 오행 중 이 후보가 가진 것. 상대의 전체 구성이 아니다 */
  suppliedElements: readonly Element[];
  balanceBand: BalanceBand;
  /** 오행 보완 30% + 함께 놓은 균형 70% — 단순 비교 참고값 */
  previewScore: number;
};

/** 이 후보가 내 적은 오행 중 가지고 있는 것 */
export type CandidateHighlight = {
  element: Element;
  text: string;
};

const BALANCE_LABEL: Record<BalanceBand, string> = {
  even: '두 사람의 오행을 함께 보면 균형이 고른 편이에요.',
  mixed: '두 사람의 오행을 함께 보면 대체로 균형이 맞아요.',
  skewed: '두 사람의 오행을 함께 보면 한쪽으로 기우는 편이에요.',
};

/**
 * 점수를 말로 옮기는 문턱 — **화면에만 사는 수다.**
 *
 * `balanceBands` 와 나란히 두지 않았다. 그 두 수는 SQL 에도 한 벌 있어서 양쪽 시험이
 * 같은 수를 들고, **숫자를 안 보여주기 때문에** 문턱이 곧 사용자가 보는 차이였다.
 * 여기는 반대다 — 점수가 이미 카드에 34점으로 적혀 있고, 이 문턱은 그 수를 다시
 * 말로 적을 뿐이다. 고쳐도 줄 세우기는 한 자리도 안 움직인다.
 *
 * 경계는 **위쪽이 닫힌다**(90 이상, 80 이상 …) — 열 칸이 모두 한쪽 방향으로 읽히도록.
 * 위에서 아래로 읽으니 `find` 가 처음 걸리는 칸이 곧 그 점수의 칸이다.
 */
const PREVIEW_VERDICT: readonly (readonly [number, string])[] = [
  [90, '오행 구성이 매우 균형적인 편이에요.'],
  [80, '오행 구성이 좋은 편이에요.'],
  [70, '오행 구성이 무난한 편이에요.'],
  [60, '오행 구성이 다소 편중된 편이에요.'],
  [0, '오행 구성이 많이 편중된 편이에요.'],
];

/** 이유 문장의 뒷 절 — 균형을 **어우러짐의 말로** 옮긴다 */
const BALANCE_CLAUSE: Record<BalanceBand, string> = {
  even: '고르게 어우러져요',
  mixed: '대체로 어우러져요',
  skewed: '한쪽으로 기우는 편이에요',
};

/**
 * 점수 한 줄과 그 이유 한 줄 — **후보 카드에서만 쓴다.**
 *
 * ## 왜 균형 문장만으로는 안 됐나
 *
 * 카드는 「34점」 옆에 「균형이 고른 편이에요」를 세우고 있었다. 둘 다 참인데 같이
 * 읽으면 어긋난다 — 점수는 두 축의 합이고(보완 30% + 균형 70%), 균형 문장은 그중
 * 뒤 축 하나만 말하기 때문이다. **낮은 점수를 만든 축이 화면에 한 번도 안 나왔다.**
 *
 * 그래서 이유는 두 축을 한 문장에 접속으로 묶는다. 두 축의 방향이 같으면 「-고 …도」,
 * 다르면 「-지만 …은」 — 그 접속사가 곧 점수가 왜 그 자리인지의 설명이다.
 *
 * ## 지어내지 않는다
 *
 * 밴드마다 다른 이유를 손으로 적어 두지 않았다. 그러면 점수와 말이 따로 움직이고,
 * 어느 날 80점 문장이 「보완하는 오행이 많아요」라고 말하는데 실제로는 한 글자도 없는
 * 일이 난다. **이유는 언제나 같은 두 사실에서 나온다.**
 */
export function previewSummaryFor(row: {
  previewScore: number;
  suppliedElements: readonly Element[];
  balanceBand: BalanceBand;
}): { verdict: string; reason: string } {
  const hasSupply = row.suppliedElements.length > 0;
  // 균형이 받쳐 주는가 — `skewed` 하나만 아쉬운 쪽이다
  const supportive = row.balanceBand !== 'skewed';
  // 두 축이 같은 말을 하는가. 접속사와 조사가 여기서 갈린다
  const agree = hasSupply === supportive;

  const supply = hasSupply
    ? agree
      ? '내게 적은 오행을 보완하는 데 보탬이 되고'
      : '내게 적은 오행을 보완하는 데 보탬이 되지만'
    : agree
      ? '내게 적은 오행을 크게 보완하지 않고'
      : '내게 적은 오행을 크게 보완하지는 않지만';

  return {
    // 못 알아보는 수가 와도 마지막 칸이 받는다 — 모르는 값을 좋은 쪽으로 눕히지 않는다
    verdict: (PREVIEW_VERDICT.find(([floor]) => row.previewScore >= floor) ??
      PREVIEW_VERDICT[PREVIEW_VERDICT.length - 1])[1],
    reason: `${supply}, 두 사람의 오행${agree ? '도' : '은'} ${BALANCE_CLAUSE[row.balanceBand]}.`,
  };
}

/** 여기서 멈추는 이유와 다음 — **상세 궁합은 서로 동의한 뒤에 열린다** */
export const DISCOVERY_TEASER =
  '이 점수는 두 사람의 오행 구성을 단순 비교한 참고값입니다. 상세 궁합 보기를 선택하면 두 사람의 자세한 궁합을 함께 확인할 수 있어요.';

/**
 * 목록이 **빈 자리**에 서는 말 — 첫 주에는 이것이 기본 상태다.
 *
 * 「아직 소개할 인연이 없습니다」 한 줄이 있었다. 맞는 말인데 그 옆에 목록이 있을 때
 * 쓰는 문구가 전부 그대로 서 있었다 — 맛보기 안내, 순서에 대한 유의, 「하루가 지나면
 * 저절로 새로 만들어집니다」까지. **없는 것을 설명하는 문장 다섯이 없는 목록을 둘러싸고
 * 있었고**, 그중 하나는 거짓에 가까웠다: 하루가 지나도 참여자가 없으면 그대로다.
 *
 * 빈 자리에 필요한 것은 셋이다.
 *
 * 1. **왜 비었나** — 내 잘못도 고장도 아니고 아직 사람이 적다
 * 2. **그래도 참인 것** — 내 자리는 이미 남의 목록에 서 있다. 이걸 안 말하면 참여를
 *    켠 것이 아무 일도 안 한 것처럼 읽힌다
 * 3. **그동안 할 수 있는 것** — 이 제품에는 인연 말고도 할 일이 있다
 *
 * 「참여하면 …」이라고 권하지 않는다. 이 사람은 이미 참여 중이다 — 안 켠 사람에게 서는
 * 자리는 따로 있다(`Resting`).
 */
export const DISCOVERY_EMPTY = {
  title: '소개해 드릴 인연이 없습니다.',
} as const;

const EXPLORATION_NOTE =
  '색다른 인연도 만나볼 수 있도록 일부 후보는 추천 순서와 관계없이 섞어 보여드려요.';

const NO_MISSING_NOTICE =
  '내 사주에는 빠진 오행은 없지만, 20%보다 적은 오행까지 함께 살펴봤어요.';

/**
 * 참여를 켜기 전에 읽히는 말 — **화면과 ADR 과 `prd-archive` 가 같은 문장을 든다.**
 *
 * 무엇이 나가고 무엇이 안 나가는지를 세 곳에 따로 적으면 한 곳만 고쳐지고, 그때
 * 사용자가 읽은 약속과 실제 동작이 갈린다. 문장을 여기 한 벌 두고 화면이 그대로 쓴다.
 */
export const DISCOVERY_DISCLOSURE = {
  shown: [
    '닉네임, 프로필 사진, 소개 — 사진을 등록하지 않으면 닉네임의 첫 글자가 표시됩니다.',
    '나에게 20%보다 적은 오행 중 소개받은 사람이 가지고 있는 오행의 이름.',
    '함께 놓았을 때의 오행 균형을 말로 옮긴 설명.',
    '오행의 보완과 두 사람의 균형을 합친 오행 첫인상 점수.',
  ],
  hidden: [
    '생년월일시와 출생지.',
    '전체 명식과 전체 오행 개수표.',
  ],
} as const;

/**
 * 후보 한 줄을 사람 말로 — **어느 오행의 보완에 보탬이 되는지 말한다.**
 *
 * 이름을 감추면 「왜 이 사람인가」에 답할 수 없고, 답 못 하는 추천은 궁금해지지도
 * 않는다. 여기서 부르는 것은 **내게 20%보다 적은 오행 중 상대가 가진 것**뿐이다 — 상대의
 * 전체 구성도, 개수표도, 여덟 글자도 아니다.
 */
export function cardTextFor(
  row: Pick<BoardRow, 'suppliedElements' | 'balanceBand'> & {
    /** 내 개수는 문구 강도만 가른다. 카드로 내려보내지는 않는다. */
    viewerCounts?: Readonly<Record<Element, number>>;
  },
): {
  highlights: CandidateHighlight[];
  balanceLabel: string;
} {
  return {
    highlights: row.suppliedElements.map((element) => {
      const label = `${ELEMENT_KO[element]}(${element})`;
      const count = row.viewerCounts?.[element];
      return {
        element,
        text:
          count === 0
            ? `내 사주에 없는 ${label} 기운을 이 사람이 가지고 있어요.`
            : count === undefined
              ? `내게 적은 ${label} 기운을 이 사람이 가지고 있어 보완에 보탬이 돼요.`
              : `내 사주에서 적은 ${label} 기운을 이 사람이 가지고 있어 보완에 보탬이 돼요.`,
      };
    }),
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
