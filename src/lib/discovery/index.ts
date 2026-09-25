import {
  combinedCountBalanceOf,
  mutualDeficitComplementOf,
  type ElementSummary,
} from './element-axes';
import { dayPillarAxisOf, needComplementSymmetric, needTargetsFor, type NeedTargets } from './compat-axes';
import { ELEMENTS, ELEMENT_KO, type Element, type Pillars } from '../saju';

/**
 * 인연 찾기 — 아직 선택되지 않은 후보의 **노출 순서와 예측 궁합 점수**.
 *
 * 옛 `match-v0` 의 네 축 중 둘을 **일부러 뺐다**(ADR 0003) — 까닭은 아래 둘이다. 점수는
 * 궁합풀이의 기준점으로도 쓰인다(ADR 0060). 지금 판은 `v2-beta` 다(ADR 0113).
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
 * 점수 정책 — 사이에 따라 둘로 나뉜다(ADR 0113).
 *
 * - `romantic`(연인용): 후보 카드 · 성립한 인연 궁합 · 사이가 연인 · 배우자인 궁합
 * - `general`(일반): 가족 · 친구 · 동료 · 모름
 *
 * 둘 중 무엇을 쓸지는 `scorePolicyOf` 가 정한다.
 */
export const SCORE_POLICIES = ['romantic', 'general'] as const;
export type ScorePolicy = (typeof SCORE_POLICIES)[number];

/**
 * 정책 — **축·가중치·탐색 비율·버전을 값으로 선언한다**(`prd-archive`).
 *
 * `v2-beta`(ADR 0113)는 사이로 가른 두 공식이다. 무게는 근거가 아니라 **가설**이다 — 조사가 받친 것은
 * 서열(일주 · 일지 > 필요한 기운 보완 > 오행 균형)이고 수가 아니다. 비교기(`src/lib/matching/formula-comparison`)가
 * 분포를 재고 사후에 고친다.
 *
 * - **연인용** — 일주 · 일지 관계 40 · 필요한 기운 보완(양방향) 40 · 오행 균형 20
 * - **일반** — 필요한 기운 보완 60 · 오행 균형 40(운영자가 2026-09-25 에 70 · 30 에서 고쳤다). 일주 · 일지는 풀이 글에서만 쓴다
 *
 * 세 축의 셈은 `compat-axes.ts`(일주 · 일지 · 필요한 기운 보완)와 `element-axes.ts`(오행 균형)에 있다.
 * 옛 `discovery-v1`(균형 70 · 개수 보완 30)은 저장된 옛 풀이를 읽는 자리에만 남는다(`DISCOVERY_V1`).
 *
 * **줄 세우기는 SQL 이 한다.** 그 셈은 후보 카드에서 `예측 궁합 점수`로 보인다.
 *
 * **이름은 세게 쓰고 면책은 작게 붙인다.** 「오행 첫인상 점수」라고 부르면 사용자가
 * 「그래서 이게 궁합 점수인가 아닌가」에서 멈춘다 — 이름이 제품을 설명하지 못하면
 * 카드 전체가 무엇을 위한 것인지 읽히지 않는다. 대신 목록 머리에 `DISCOVERY_TEASER`
 * 한 줄이 참고 점수라고 밝힌다. 정확성은 그 한 줄이 들고, 이름은 무엇인지 말하는 일만 한다.
 */
export const DISCOVERY_POLICY = {
  version: 'v2-beta',
  status: 'beta',
  /** 정렬만 하고 사람을 지우지 않는다 */
  behavior: 'rank-only',
  hardThreshold: 'none',
  /** 정책마다 합이 1 인 무게 — 화면이 축 옆에 `점수 반영 40%` 로 그대로 옮긴다 */
  weights: {
    romantic: { dayPillar: 0.4, needComplement: 0.4, combinedBalance: 0.2 },
    general: { needComplement: 0.6, combinedBalance: 0.4 },
  },
  /** 순위에 쓰지 않는 것 — 뺀 이유는 위 주석과 ADR 0003 에 있다 */
  excluded: [
    'dataCompleteness',
    'connectionDensity',
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
   * 그때도 열리지 않는다(ADR 0008). 일주 · 일지는 점수 계산에 쓰지만 원문은 내지 않는다(ADR 0113).
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

/**
 * **옛 판 `discovery-v1`** — 오행 균형 70 · 개수 보완 30.
 *
 * ADR 0113 이 근거가 잘못됐다고 보고 내렸다. 남은 자리는 **이 판으로 만든 궁합풀이를 다시 여는 화면** 하나다 —
 * 풀이는 만든 때의 점수를 들고 있고(ADR 0060), 그 옆에 새 판의 수를 세우면 같은 화면에 점수가 둘이 된다.
 * 새 점수를 이것으로 내지 않는다.
 */
export const DISCOVERY_V1 = {
  version: 'discovery-v1',
  weights: {
    complement: 0.3,
    combinedBalance: 0.7,
  },
} as const;

/** 점수 판의 이름 — 풀이에 적힌 값을 읽는 자리가 모르는 이름을 옛 판으로 눕힌다 */
export type ScoreVersion = typeof DISCOVERY_POLICY.version | typeof DISCOVERY_V1.version;

/**
 * 한 사람 몫 — 점수가 읽는 셋.
 *
 * 일주(일주 · 일지 관계) · 오행 요약(드러난 글자 수 — 공급과 균형) · 필요 대상(억부 1순위와 가장 무거운 오행).
 */
export type ScoreSide = {
  pillars: Pick<Pillars, 'day'>;
  summary: ElementSummary;
  need: NeedTargets;
};

/** 명식 하나에서 점수가 읽는 몫을 꺼낸다 — 필요 대상은 엔진 기본 세기로 잰다 */
export const scoreSideOf = (saju: {
  pillars: Pillars;
  analysis: { elements: ElementSummary };
}): ScoreSide => ({
  pillars: saju.pillars,
  summary: saju.analysis.elements,
  need: needTargetsFor(saju.pillars),
});

/** 세 축, 0~100 — 반올림하지 않은 값 */
export type ScoreAxes = { dayPillar: number; needComplement: number; combinedBalance: number };

export const scoreAxesOf = (a: ScoreSide, b: ScoreSide): ScoreAxes => ({
  dayPillar: dayPillarAxisOf(a.pillars, b.pillars),
  needComplement: needComplementSymmetric(
    { targets: a.need, summary: a.summary },
    { targets: b.need, summary: b.summary },
  ),
  combinedBalance: combinedCountBalanceOf(a.summary, b.summary),
});

/**
 * 사이 → 점수 정책 — **이 한 자리에서만 정한다**(ADR 0113).
 *
 * 성립한 인연(`matched`)은 사이를 묻지 않고 연인용이다 — 「아직 서로 모르는 두 사람」을 성별 조건으로 이은
 * 자리라서다. 직접 고른 사이는 연인 · 배우자만 연인용이고, 가족 · 친구 · 동료 · 모름(`null`)은 일반이다.
 * 모르는 이름도 일반으로 눕힌다 — 연인 근거를 모든 관계에 쓰지 않는다.
 */
const POLICY_OF_RELATION: Readonly<Record<string, ScorePolicy>> = {
  partner: 'romantic',
  family: 'general',
  friend: 'general',
};

export const scorePolicyOf = (pair: { matched: boolean; relation: string | null }): ScorePolicy =>
  pair.matched ? 'romantic' : (POLICY_OF_RELATION[pair.relation ?? ''] ?? 'general');

/**
 * 예측 궁합 점수 — **카드와 풀이가 같은 자를 쓰게 하는 자리.** 진입점은 이것 하나다(ADR 0113).
 *
 * 사이로 가른 두 공식을 둘로 흩지 않고 정책을 받는다. 후보 카드의 줄 세우기는 SQL 이 하고, 이 함수는
 * **SQL 이 못 서는 자리** — 궁합풀이의 기준점과 궁합 화면의 지표 — 에서 그 셈을 TS 로 한 번 더 한다.
 * `private`(내가 저장한 두 사람)에는 카드 스냅샷이 아예 없고, 있는 `match` 도 그 값은 하루짜리라 풀이
 * 시각과 다를 수 있다. 그래서 넘겨받지 않고 **두 명식에서 그 자리에서 다시 잰다**(ADR 0060).
 *
 * 가중치는 `DISCOVERY_POLICY.weights` 에서 읽는다 — 손으로 옮겨 적으면 정책만 바뀌고 이 함수가 안
 * 따라오는 날이 온다.
 */
export function previewScoreOf(
  a: ScoreSide,
  b: ScoreSide,
  { policy }: { policy: ScorePolicy },
): number {
  const axes = scoreAxesOf(a, b);
  const weights: Partial<Record<keyof ScoreAxes, number>> = DISCOVERY_POLICY.weights[policy];
  return Math.round(
    (Object.keys(axes) as (keyof ScoreAxes)[]).reduce(
      (sum, key) => sum + (weights[key] ?? 0) * axes[key],
      0,
    ),
  );
}

/**
 * 옛 판(`discovery-v1`)의 수 — **저장된 옛 풀이를 다시 여는 자리만 부른다.**
 *
 * 두 축이 `counts` 와 `glyphCount` 만 본다. 새 점수를 이것으로 내지 않는다.
 */
export function legacyPreviewScoreOf(a: ElementSummary, b: ElementSummary): number {
  const { complement, combinedBalance } = DISCOVERY_V1.weights;

  return Math.round(
    combinedBalance * combinedCountBalanceOf(a, b) + complement * mutualDeficitComplementOf(a, b),
  );
}

/** 함께 놓은 균형을 세 칸으로 — 경계는 `balanceBands`, 판정은 `discovery_balance_band` */
export type BalanceBand = 'even' | 'mixed' | 'skewed';

const BALANCE_BANDS: readonly BalanceBand[] = ['even', 'mixed', 'skewed'];

/**
 * DB 가 준 밴드 이름을 읽는다 — **못 알아보면 가장 낮은 칸이다.**
 *
 * 모르는 값을 좋은 쪽으로 눕히지 않는다. 후보 카드·요청함·인연 결과 세 자리가 이 읽기를
 * 한 벌씩 적고 있었다.
 */
const balanceBandOf = (raw: string): BalanceBand =>
  BALANCE_BANDS.find((band) => band === raw) ?? 'skewed';

/** DB 가 준 오행 글자를 읽는다 — 모르는 글자는 버린다. 그럴듯한 것으로 눕히지 않는다 */
export const knownElementsOf = (raw: readonly string[] | null): Element[] =>
  (raw ?? []).filter((element): element is Element =>
    (ELEMENTS as readonly string[]).includes(element),
  );

/** `discovery_board()` 가 내주는 한 줄 — **여기 없는 것이 안 나가는 것이다** */
type BoardRow = {
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
  /** 예측 궁합 점수 — 연인용 정책(ADR 0113)의 참고값 */
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
 * 여기는 반대다 — 점수가 이미 카드에 65점으로 적혀 있고, 이 문턱은 그 수를 다시
 * 말로 적을 뿐이다. 고쳐도 줄 세우기는 한 자리도 안 움직인다.
 *
 * ## 경계는 분포를 일곱으로 나눈 자리다
 *
 * **좋은 궁합의 객관적인 경계가 아니다.** 이 점수는 100점이 만점인 시험이 아니라 세 축의 가중합이고,
 * 실제로 나는 값이 가운데에 몰린다. 90·80·70 을 그으면 위의 두 칸은 영영 안 뜬다. 그래서 경계는 **분포에서**
 * 왔다 — 일곱 칸이 저마다 대략 같은 몫의 쌍을 받도록 자른 자리다.
 *
 * `discovery-v1`(중앙값 64 · sd 8.8)에서 잰 옛 경계 78·72·66·60·54·46 은 위에서부터
 * 4.4% · 15.7% · 24.7% · 24.8% · 17.8% · 9.8% · 2.8% 를 받았다. `v2-beta` 연인용(중앙값 56 · sd 11.3 — 카드의
 * 점수다)에 그 몫을 그대로 옮기면 75·66·58·50·43·33 이고, 받는 몫은 4.4% · 15.3% · 24.5% · 26.4% · 16.6% ·
 * 10.3% · 2.5% 다. 잰 곳은 비교기의 `adults` 시나리오 5000 쌍(시드 20260925), 세기는 엔진 기본과
 * 월지 ×2 · 지장간 60:30:10 두 벌이 같은 경계를 냈다(`docs/notes/2026-09-25-compat-formula-comparison.md`).
 * **점수 계산을 고치면 이 일곱 수도 다시 잰다** — 말이 분포를 따라가지 못하면 같은 카드에서 수와 문장이
 * 서로 다른 말을 한다. 문장은 그대로다.
 *
 * 문장은 모두 「-일 수 있어요 / -에 가까워요 / -편이에요」로 닫는다. 88점이 객관적인
 * 최고 궁합이라는 확정 판정은 이 제품이 낼 수 있는 말이 아니다.
 *
 * 경계는 **위쪽이 닫힌다**(75 이상, 66 이상 …) — 일곱 칸이 모두 한쪽 방향으로 읽히도록.
 * 위에서 아래로 읽으니 `find` 가 처음 걸리는 칸이 곧 그 점수의 칸이다.
 */
const PREVIEW_VERDICT: readonly (readonly [number, string])[] = [
  [75, '아주 좋은 궁합일 수 있어요.'],
  [66, '좋은 궁합에 가까워요.'],
  [58, '꽤 잘 맞는 편이에요.'],
  [50, '무난하게 어울리는 편이에요.'],
  [43, '조금 엇갈리는 부분이 있어요.'],
  [33, '잘 맞지 않는 부분이 있는 편이에요.'],
  [0, '서로 다른 부분이 많은 편이에요.'],
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
 * 읽으면 어긋난다 — 점수는 여러 축의 합이고(그때는 보완 30% + 균형 70%), 균형 문장은 그중
 * 한 축만 말하기 때문이다. **낮은 점수를 만든 축이 화면에 한 번도 안 나왔다.**
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
  '두 사람의 오행 구성을 바탕으로 계산한 참고 점수예요. 상세 궁합 요청하기를 누르면 두 사람의 자세한 궁합을 함께 확인할 수 있어요.';

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
  /** 제목이라 마침표가 없다(`CONTEXT.md` 의 문구 규칙) */
  title: '소개해 드릴 인연이 없습니다',
  line: '지금은 새로운 인연을 찾지 못했어요.',
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
    '두 사람의 태어난 날 기둥 사이 관계, 서로 채우는 기운, 오행 균형을 반영한 예측 궁합 점수. 계산에 사용한 사주팔자 글자는 수락 전에는 공개되지 않습니다.',
  ],
  hidden: [
    '생년월일시와 출생지.',
    '전체 명식과 전체 오행 개수표.',
  ],
} as const;

/**
 * 함께 놓았을 때의 균형 한 줄 — **카드를 짓지 않고 꺼낸다.**
 *
 * 요청함·인연 결과 세 자리가 `cardTextFor({ suppliedElements: [], … })` 로 **빈 카드를
 * 지어** 그 결과에서 `balanceLabel` 하나만 꺼내고 나머지는 버리고 있었다. 빈 배열이
 * 「채우는 오행이 없다」라는 뜻이 아니라 「그건 안 물었다」라는 뜻이라, 읽는 사람이
 * 그 자리에서 카드의 규칙을 한 번 더 확인해야 했다.
 *
 * 밴드를 읽는 일까지 여기서 한다 — 못 알아보는 값이 가장 낮은 칸으로 눕는 규칙
 * (`balanceBandOf`)을 부르는 쪽이 다시 적지 않게.
 */
export const balanceLabelOf = (raw: string): string => BALANCE_LABEL[balanceBandOf(raw)];

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
            ? `내게 부족한 ${label} 기운을 채워줘요.`
            : count === undefined
              ? `내게 적은 ${label} 기운을 보완해 줘요.`
              : `내 사주에서 적은 ${label} 기운을 보완해 줘요.`,
      };
    }),
    balanceLabel: BALANCE_LABEL[row.balanceBand],
  };
}

/**
 * 후보 카드가 드는 말 한 벌 — **DB 가 준 날값에서 곧장 짓는다.**
 *
 * 날값을 읽고(`knownElementsOf` · `balanceBandOf`) 점수를 0~100 정수로 묶은 뒤
 * `cardTextFor` 와 `previewSummaryFor` 를 차례로 부르는 넷째 걸음까지가 한 벌이다.
 * 2026-09-23 까지 그 한 벌이 `app/me/candidates.ts` 와 미리보기 예시(`examples.ts`)에
 * 따로 적혀 있었다(G-46) — 예시가 실데이터와 같은 말을 한다는 약속을 손으로 지키고
 * 있었던 셈이다. 이제 둘 다 이것을 부른다.
 */
export function candidateCardText(row: {
  suppliedElements: readonly string[] | null;
  balanceBand: string;
  previewScore: number;
  /** 내 개수는 문구 강도만 가른다. 예시처럼 모르면 비운다 */
  viewerCounts?: Readonly<Record<Element, number>>;
}): {
  previewScore: number;
  highlights: CandidateHighlight[];
  balanceLabel: string;
  verdict: string;
  reason: string;
} {
  const suppliedElements = knownElementsOf(row.suppliedElements);
  const balanceBand = balanceBandOf(row.balanceBand);
  const previewScore = Math.max(0, Math.min(100, Math.round(row.previewScore)));
  return {
    previewScore,
    ...cardTextFor({ suppliedElements, balanceBand, viewerCounts: row.viewerCounts }),
    ...previewSummaryFor({ previewScore, suppliedElements, balanceBand }),
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

// -----------------------------------------------------------------------------
// DiscoveryProfile — 매칭 참여에 관한 한 벌 (CONTEXT.md)
// -----------------------------------------------------------------------------

/** 만나볼 상대의 성별 — 저장되는 값의 목록이라 차례를 바꿀 수 없다(화면의 차례는 `PREFER_GENDER_ORDER`) */
export const PREFER_GENDERS = ['any', 'female', 'male'] as const;
export type PreferGender = (typeof PREFER_GENDERS)[number];

/** 모르는 값은 가장 넓은 쪽으로 읽는다 — 좁은 쪽으로 눕히면 조용히 사람이 빠진다 */
export function preferGenderOf(value: string | null | undefined): PreferGender {
  return (PREFER_GENDERS as readonly string[]).includes(value ?? '')
    ? (value as PreferGender)
    : 'any';
}

/**
 * **DiscoveryProfile** — `discovery_profile` 표 한 줄 중 앱이 읽는 것.
 *
 * 참여 상태와 사주와 무관한 명시적 조건이다. **이름과 소개는 여기 없다** — 계정의 것이다.
 * 내놓은 **오행 요약**(`element_summary`)도 표에는 있지만 앱이 읽지 않는다 — 후보를 뽑는
 * SQL 만 읽으므로 여기 싣지 않는다. 읽는 문은 `app/me/discovery/discovery-profile.ts` 하나다.
 */
export type DiscoveryProfile = {
  readonly preferGender: PreferGender;
  /** 직접 끈 사람인가 — 참여는 기본으로 켜지므로 남은 상태는 「껐다」 하나다(PRD §4.1) */
  readonly optedOut: boolean;
};
