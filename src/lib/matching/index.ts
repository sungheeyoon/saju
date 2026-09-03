import {
  ELEMENT_KO,
  TEN_GOD_KO,
  type Compatibility,
  type Element,
  type Saju,
} from '../saju';

import { combinedBalanceOf, complementOf } from './elementAxes';

/**
 * 테스터에게 보여 주는 첫 매칭 정책.
 *
 * 명리의 정답이나 관계의 좋고 나쁨을 판정하지 않는다. 현재 엔진이 사실로 낼 수 있는
 * 네 묶음을, 가중치까지 공개한 제품 탐색 지표로 바꾼다. 억부·종격·격국은 이 정책의
 * 입력이 아니므로 그 판정이 바뀌어도 match-v0 결과는 흔들리지 않는다.
 */
export const MATCH_POLICY_V0 = {
  version: 'match-v0',
  status: 'beta',
  weights: {
    complement: 0.35,
    combinedBalance: 0.3,
    connectionDensity: 0.25,
    dataCompleteness: 0.1,
  },
  excluded: ['eokbu', 'following-pattern', 'structure', 'johu-conditions'] as const,
} as const;

export type MatchDimensionKey = keyof typeof MATCH_POLICY_V0.weights;

export type MatchDimension = {
  key: MatchDimensionKey;
  label: string;
  score: number;
  description: string;
};

export type MatchPreview = {
  policyVersion: typeof MATCH_POLICY_V0.version;
  status: typeof MATCH_POLICY_V0.status;
  /** 궁합의 정답이 아니라 match-v0 안에서 비교하기 위한 제품 지표 */
  index: number;
  dimensions: MatchDimension[];
  highlights: string[];
  caveat: string;
};

const clamp = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const elementList = (elements: readonly Element[]): string =>
  elements.map((element) => `${ELEMENT_KO[element]}(${element})`).join('·');

export function buildMatchPreview(
  charts: Record<'a' | 'b', Saju>,
  compat: Compatibility,
  names: Record<'a' | 'b', string>,
): MatchPreview {
  /**
   * 두 축은 **`discovery-v0` 와 같은 자로 잰다**(`elementAxes.ts`).
   *
   * 여기서 따로 세면 같은 두 사람이 후보 화면과 궁합 화면에서 다른 보완을 갖게 되고,
   * 그 차이는 어디에도 안 적힌다. 갈라지는 것은 축이 아니라 **가중치와 하는 일**이다.
   */
  const complement = complementOf(charts.a.analysis.elements, charts.b.analysis.elements);
  const combinedBalance = combinedBalanceOf(charts.a.analysis.elements, charts.b.analysis.elements);
  const connectionDensity = clamp(
    30 + compat.relations.length * 11 + compat.combinedFormations.length * 8,
  );
  const knownHours = Number(charts.a.meta.hourKnown) + Number(charts.b.meta.hourKnown);
  const dataCompleteness = knownHours === 2 ? 100 : knownHours === 1 ? 72 : 45;

  const dimensions: MatchDimension[] = [
    {
      key: 'complement',
      label: '오행 보완',
      score: clamp(complement),
      description: '각자에게 없는 오행을 상대가 갖고 있는지 봅니다.',
    },
    {
      key: 'combinedBalance',
      label: '함께 놓은 균형',
      score: clamp(combinedBalance),
      description: '두 명식의 오행 분포를 합쳐 다섯 축의 쏠림을 봅니다.',
    },
    {
      key: 'connectionDensity',
      label: '관계 신호',
      score: connectionDensity,
      description: '두 원국 사이에서 실제로 발견된 형충회합의 밀도입니다.',
    },
    {
      key: 'dataCompleteness',
      label: '입력 완성도',
      score: dataCompleteness,
      description: '출생 시각을 알수록 시주까지 포함해 비교합니다.',
    },
  ];

  const index = clamp(
    dimensions.reduce(
      (sum, dimension) => sum + dimension.score * MATCH_POLICY_V0.weights[dimension.key],
      0,
    ),
  );

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
    policyVersion: MATCH_POLICY_V0.version,
    status: MATCH_POLICY_V0.status,
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
