import {
  ELEMENT_KO,
  TEN_GOD_KO,
  type Compatibility,
  type Element,
  type Saju,
} from '../saju';

/**
 * **점수를 짓는 자리는 `discovery-v1` 하나다.**
 *
 * `matching → discovery → matching/elementAxes` 로 들어가므로 돌지 않는다. 저쪽이
 * 가리키는 것은 축 파일이지 이 파일이 아니다.
 */
import { DISCOVERY_POLICY, previewScoreOf } from '../discovery';
import { combinedCountBalanceOf, mutualDeficitComplementOf } from './elementAxes';

/**
 * 궁합 결과 화면의 「궁합 베타」 지표 — `discovery-v1` 두 축을 가중치까지 공개해 보인다.
 *
 * 명리의 정답이나 관계의 좋고 나쁨을 판정하지 않는다. 억부·종격·격국은 이 지표의
 * 입력이 아니므로 그 판정이 바뀌어도 수는 흔들리지 않는다.
 */
export type MatchDimensionKey = keyof typeof DISCOVERY_POLICY.weights;

export type MatchDimension = {
  key: MatchDimensionKey;
  label: string;
  score: number;
  description: string;
};

export type MatchPreview = {
  policyVersion: typeof DISCOVERY_POLICY.version;
  status: typeof DISCOVERY_POLICY.status;
  /** 궁합의 정답이 아니라 `discovery-v1` 안에서 비교하기 위한 제품 지표 */
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
  const complement = mutualDeficitComplementOf(
    charts.a.analysis.elements,
    charts.b.analysis.elements,
  );
  const combinedBalance = combinedCountBalanceOf(
    charts.a.analysis.elements,
    charts.b.analysis.elements,
  );

  const dimensions: MatchDimension[] = [
    {
      key: 'complement',
      label: '오행 보완',
      score: clamp(complement),
      description: '한쪽에 부족한 오행을 상대가 얼마나 채우는지 봅니다.',
    },
    {
      key: 'combinedBalance',
      label: '함께 놓은 균형',
      score: clamp(combinedBalance),
      description: '두 사람의 글자를 합쳐 오행 다섯이 고른지 봅니다.',
    },
  ];

  /**
   * **여기서 가중합을 다시 짓지 않는다.** 막대는 반올림된 값이라 그것으로 합하면
   * 후보 카드의 수와 1점씩 어긋난다 — 같은 두 사람이 두 화면에서 다른 수를 갖는
   * 것이 이 고침이 없애려던 바로 그 일이다.
   */
  const index = previewScoreOf(charts.a.analysis.elements, charts.b.analysis.elements);

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
    policyVersion: DISCOVERY_POLICY.version,
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
