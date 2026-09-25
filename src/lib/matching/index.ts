import {
  ELEMENT_KO,
  TEN_GOD_KO,
  type Compatibility,
  type Element,
  type Saju,
} from '../saju';

/**
 * **점수를 짓는 자리는 `previewScoreOf` 하나다**(ADR 0113).
 *
 * 축 셋(`element-axes` · `compat-axes`)은 `discovery` 의 것이다 — 2026-09-22 까지 이 폴더에 살아
 * `discovery ↔ matching` 이 서로를 불렀다. 이제 방향은 `matching → discovery` 하나다(ADR 0085).
 */
import {
  DISCOVERY_POLICY,
  DISCOVERY_V1,
  legacyPreviewScoreOf,
  previewScoreOf,
  scoreAxesOf,
  scorePolicyOf,
  scoreSideOf,
  type ScorePolicy,
  type ScoreVersion,
} from '../discovery';
import { combinedCountBalanceOf, mutualDeficitComplementOf } from '../discovery/element-axes';

/**
 * 궁합 결과 화면의 「궁합 베타」 지표 — 점수의 축을 **무게까지** 공개해 보인다.
 *
 * 명리의 정답이나 관계의 좋고 나쁨을 판정하지 않는다. 축이 몇 개인지는 정책이 정한다 — 연인용 셋, 일반 둘,
 * 옛 판(`discovery-v1`) 둘. 화면은 받은 만큼 그린다.
 */
type MatchDimensionKey = 'dayPillar' | 'needComplement' | 'combinedBalance' | 'complement';

type MatchDimension = {
  key: MatchDimensionKey;
  label: string;
  score: number;
  /** 이 축이 점수에 들어간 몫(0~1) — 화면이 `점수 반영 40%` 로 옮긴다 */
  weight: number;
  description: string;
};

export type MatchPreview = {
  policyVersion: ScoreVersion;
  /** 어느 사이의 눈금인가 — 옛 판은 사이를 몰랐으므로 `null` */
  policy: ScorePolicy | null;
  status: typeof DISCOVERY_POLICY.status;
  /** 궁합의 정답이 아니라 같은 판 안에서 비교하기 위한 제품 지표 */
  index: number;
  dimensions: MatchDimension[];
  highlights: string[];
  caveat: string;
};

/**
 * 무슨 눈금으로 그리는가.
 *
 * `index` 는 **저장된 기준점**이다 — 풀이가 있으면 그 풀이를 만든 때의 수를 세운다(ADR 0060). 없으면 지금 잰다.
 */
export type MatchBasis =
  | { version: typeof DISCOVERY_POLICY.version; policy: ScorePolicy; index?: number }
  | { version: typeof DISCOVERY_V1.version; index?: number };

/** 풀이에 적힌 점수의 출처 — 이 열들이 생기기 전 풀이는 셋 다 `null` 이고 그것이 옛 판이다 */
export type StoredScore = {
  version: string | null;
  baseline: number | null;
  relation: string | null;
};

/**
 * 지표를 **무슨 판으로** 그릴지 — 풀이가 있으면 그 풀이의 판이다.
 *
 * **옛 풀이 옆에 새 판의 수를 세우지 않는다.** 풀이 점수는 만든 때의 기준점에서 움직인 값이라, 그 위에 새 판의
 * 지표가 서면 한 화면에 눈금이 둘이 된다(PRD 「한 화면에 점수가 둘이면」). 새 판을 지금 재는 것은 풀이가 아직
 * 없을 때뿐이다 — 새 풀이는 그 수를 기준점으로 받는다.
 *
 * 모르는 판 이름은 옛 판으로 읽는다 — 이 열이 생기기 전 풀이가 `null` 이고, 그 풀이는 옛 판으로 났다.
 */
export function matchBasisOf(
  stored: StoredScore | null,
  pair: { matched: boolean; relation: string | null },
): MatchBasis {
  if (stored === null) {
    return { version: DISCOVERY_POLICY.version, policy: scorePolicyOf(pair) };
  }
  if (stored.version === DISCOVERY_POLICY.version) {
    return {
      version: DISCOVERY_POLICY.version,
      policy: scorePolicyOf({ matched: pair.matched, relation: stored.relation }),
      ...(stored.baseline === null ? {} : { index: stored.baseline }),
    };
  }
  return { version: DISCOVERY_V1.version };
}

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const elementList = (elements: readonly Element[]): string =>
  elements.map((element) => `${ELEMENT_KO[element]}(${element})`).join('·');

/** 축의 이름과 설명 — 운영자 확정 문구(2026-09-25, `docs/notes/2026-09-25-compat-score-direction.md`) */
const DIMENSION_TEXT: Record<MatchDimensionKey, { label: string; description: string }> = {
  dayPillar: {
    label: '생활의 맞물림',
    description: '가까이 지낼 때 두 사람의 결이 맞물리는지 봅니다.',
  },
  needComplement: {
    label: '서로 채우는 기운',
    description: '각자에게 필요한 기운을 상대가 뚜렷하게 가졌는지 양쪽으로 봅니다.',
  },
  combinedBalance: {
    label: '함께 놓은 균형',
    description: '두 사람의 글자를 합쳐 오행 다섯이 고른지 봅니다.',
  },
  /** 옛 판의 축 — 옛 풀이를 다시 여는 자리에만 선다 */
  complement: {
    label: '오행 보완',
    description: '한쪽에 부족한 오행을 상대가 얼마나 채우는지 봅니다.',
  },
};

const dimensionOf = (key: MatchDimensionKey, score: number, weight: number): MatchDimension => ({
  key,
  ...DIMENSION_TEXT[key],
  score: clamp(score),
  weight,
});

/**
 * 판과 정책에 맞는 축과 지표.
 *
 * **여기서 가중합을 다시 짓지 않는다.** 막대는 반올림된 값이라 그것으로 합하면 후보 카드의 수와 1점씩 어긋난다 —
 * 지표는 늘 `previewScoreOf`(옛 판은 `legacyPreviewScoreOf`)가 낸다.
 */
function scaleOf(
  charts: Record<'a' | 'b', Saju>,
  basis: MatchBasis,
): { index: number; dimensions: MatchDimension[] } {
  if (basis.version === DISCOVERY_V1.version) {
    const x = charts.a.analysis.elements;
    const y = charts.b.analysis.elements;
    const { complement, combinedBalance } = DISCOVERY_V1.weights;
    return {
      index: basis.index ?? legacyPreviewScoreOf(x, y),
      dimensions: [
        dimensionOf('complement', mutualDeficitComplementOf(x, y), complement),
        dimensionOf('combinedBalance', combinedCountBalanceOf(x, y), combinedBalance),
      ],
    };
  }

  const a = scoreSideOf(charts.a);
  const b = scoreSideOf(charts.b);
  const axes = scoreAxesOf(a, b);
  const weights: Partial<Record<MatchDimensionKey, number>> = DISCOVERY_POLICY.weights[basis.policy];
  const order: readonly (keyof typeof axes)[] = ['dayPillar', 'needComplement', 'combinedBalance'];

  return {
    index: basis.index ?? previewScoreOf(a, b, { policy: basis.policy }),
    dimensions: order.flatMap((key) => {
      const weight = weights[key];
      return weight === undefined ? [] : [dimensionOf(key, axes[key], weight)];
    }),
  };
}

export function buildMatchPreview(
  charts: Record<'a' | 'b', Saju>,
  compat: Compatibility,
  names: Record<'a' | 'b', string>,
  basis: MatchBasis,
): MatchPreview {
  /**
   * **후보 카드·궁합풀이와 같은 함수로 잰다**(`previewScoreOf`).
   *
   * 여기 `match-v0` 이라는 옛 판이 서 있었다. 축이 둘 더 있고(관계 신호·입력 완성도)
   * 가중치도 달랐으며, 두 오행 축조차 다른 함수였다 — 「0개인 오행을 상대가 채우는
   * 비율」과 「비율 평균의 쏠림」이었다.
   *
   * 그래서 **한 화면에 서로 다른 축의 점수가 둘 서 있었다.** 이 카드의 수와, 바로
   * 아래 궁합풀이가 내는 수. PRD §1.4 가 그러면 안 된다고 적어 두었는데
   * (「한 화면에 점수가 둘이면 무엇을 믿을지 사용자가 정해야 한다」) 코드가 안
   * 따라온 자리였다. 카드에서 74를 보고 풀이권을 쓴 사람이 65를 받는 그 어긋남이다.
   *
   * 이제 이 수는 **풀이 점수의 기준점 그 자체**다. 풀이는 여기서 ±15 안으로 움직인다
   * (ADR 0060).
   *
   * 뺀 두 축은 `DISCOVERY_POLICY.excluded` 가 이미 「순위에 쓰지 않는 것」으로 들고
   * 있었다 — 새로 정한 것이 아니라 정해져 있던 것을 이 화면이 안 따르고 있었다.
   */
  const { index, dimensions } = scaleOf(charts, basis);

  const highlights: string[] = [];
  for (const side of ['a', 'b'] as const) {
    const supplied = compat.elementSupport[side].supplied;
    if (supplied.length > 0) {
      const partner = side === 'a' ? names.b : names.a;
      highlights.push(
        `${partner}님이 ${names[side]}님에게 없는 ${elementList(supplied)} 기운을 갖고 있어요.`,
      );
    }
  }

  highlights.push(
    `${names.a}님은 ${names.b}님을 ${TEN_GOD_KO[compat.tenGods.aSeesB]}, ${names.b}님은 ${names.a}님을 ${TEN_GOD_KO[compat.tenGods.bSeesA]} 관점으로 봅니다.`,
  );

  if (compat.relations.length > 0) {
    highlights.push(`두 원국 사이에서 관계 신호 ${compat.relations.length}개를 찾았어요.`);
  } else {
    highlights.push('현재 입력에서 두 원국 사이의 직접 관계 신호는 발견되지 않았어요.');
  }

  /*
    신호가 셋에 못 미치면 「억부·종격·격국처럼 검증 중인 판정은 이번 지표에서
    제외했어요」로 자리를 메우고 있었다. **빈 자리를 안내문으로 채운 것**이고, 그래서
    같은 카드가 같은 말을 세 번 했다 — 머리 딱지 · 이 줄 · 각주.

    지운다. 「먼저 보이는 신호」는 이 두 사람에 대해 실제로 나온 것만 서는 자리이고,
    둘밖에 없으면 둘이 맞다. 제외한다는 사실은 딱지가 든다.
  */

  return {
    policyVersion: basis.version,
    policy: basis.version === DISCOVERY_POLICY.version ? basis.policy : null,
    status: DISCOVERY_POLICY.status,
    index,
    dimensions,
    highlights: highlights.slice(0, 3),
    /*
      뒷문장(「억부·종격·격국처럼 검증 중인 판정은 포함하지 않았습니다」)을 뺐다.
      카드 머리의 딱지가 같은 말을 이미 하고 있다. 각주가 답하는 물음은 다르다 —
      **이 숫자가 무엇인가**이고, 그건 딱지가 답하지 않는다.
    */
    /*
      **`match-v0` 은 각주에도 안 적는다.** 용어집이 이미 「내부 버전은 사용자에게
      보이지 않는다」로 정해 두었는데(CONTEXT.md 의 「기존 실험 지표」), 카드 딱지에서
      빼면서 이 줄은 그대로 두었다. 사용자에게 그 문자열은 답이 아니라 물음이 된다.

      각주가 답하는 것은 **이 숫자가 무엇인가**이고, 그건 판본 이름 없이 말할 수 있다.
    */
    caveat: '이 수치는 궁합의 정답이 아니라 서로 견주어 보라고 만든 실험값입니다.',
  };
}
