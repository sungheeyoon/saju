import { readingBody } from './display';
import { selfSectionCount, type PromptAssembly } from './prompt';

export { EVIDENCE_SECTION } from './display';

/**
 * 출력에서 **셀 수 있는 것**을 센다.
 *
 * 이 계산은 채점 화면(`'use client'`) 안에 있었다. 그 자리에 있는 동안 두 가지가
 * 따라왔다.
 *
 * 1. **시험이 한 줄도 안 닿는다.** 브라우저에서 처음 도는 계산이라, 근거 칸을 빼고
 *    세는지 첫 절을 어디서 끊는지가 전부 「열어 봐야 아는 것」이 된다.
 * 2. **실호출 검사가 같은 자를 못 쓴다.** 그러면 변형이 계약한 분량과 절 수를 지켰는지
 *    아무도 안 재게 된다 — 자기 풀이 저장 계약(400~12000자)만 통과하면 초록이라,
 *    절을 넷만 시킨 변형이 여덟 절을 내도 시험은 아무 말도 안 한다.
 *
 * 채점 화면은 걷혔지만(ADR 0015) 자는 남는다. 지금 이 값을 읽는 것은 실호출
 * 검사(`call.live.test.ts`)다 — 변형이 시킨 대로 냈는지를 거기서 계약에 댄다.
 */

/** 아직 안 본 것과 보고 나서 아니었던 것은 다르다 */
export type Answered = 'unknown' | 'yes' | 'no';

/**
 * 근거 칸이 시작하는 자리 — `CLOSING` 이 세우는 제목이다.
 *
 * 프롬프트는 **「근거 칸은 분량에 넣지 않는다」**고 적는다. 그런데 세는 쪽이 통째로
 * 세면 분량을 재려는 바로 그 값이 오염된다 — 근거 칸이 길게 나온 글이 본문을 길게 쓴
 * 글로 보인다. 잘라서 센다.
 */
export type Measured = {
  /** 붙여 넣은 것에서 뽑아낸 본문 */
  readonly markdown: string;
  /**
   * 무언가 받기는 했는가 — **「안 받았다」와 「0자로 나왔다」는 다르다.**
   *
   * 이것이 없으면 안 돌린 칸이 기록에 `0자`로 실리고, 나중에 그 줄이 실패인지 공백인지
   * 가릴 방법이 없다.
   */
  readonly received: boolean;
  /** 근거 칸을 뺀 길이 — 프롬프트가 계약한 것이 이것이다 */
  readonly length: number;
  /** 근거 칸까지 넣은 길이 — 근거 칸이 아예 없으면 둘이 같다 */
  readonly whole: number;
  /**
   * 첫 절의 길이 — **「답까지 얼마나 읽는가」의 기계로 셀 수 있는 몫.**
   *
   * 첫 문장이 결론인지는 사람이 판단한다. 여기서 세는 것은 훨씬 좁은 것 하나뿐이다 —
   * 첫 소제목 아래가 얼마나 긴가. 이 값을 「답까지 읽는 양」이라고 부르지 않는 이유가
   * 그것이다. **세는 것보다 세게 말하지 않는다.**
   */
  readonly lead: number;
  /** 본문 소제목 수 — `### 근거` 는 여기 안 걸린다 */
  readonly headings: number;
  readonly scoreIsNull: Answered;
};

const HEADING = /^##\s.*$/gm;

/** 첫 `##` 부터 다음 `##` 까지. 소제목이 없으면 0 — 「못 셌다」를 0자로 적지 않는다 */
function leadLengthOf(body: string): number {
  const heads = [...body.matchAll(HEADING)];
  if (heads.length === 0) return 0;

  const from = (heads[0].index ?? 0) + heads[0][0].length;
  const to = heads.length > 1 ? heads[1].index : body.length;

  return body.slice(from, to).trim().length;
}

/** 본문 하나를 잰다 — 모델이 계약한 모양으로 낸 뒤의 `markdown` */
export function measureMarkdown(markdown: string, scoreIsNull: Answered = 'unknown'): Measured {
  const body = readingBody(markdown);

  return {
    markdown,
    received: markdown.trim() !== '',
    length: body.trim().length,
    whole: markdown.length,
    lead: leadLengthOf(body),
    headings: (markdown.match(/^##\s/gm) ?? []).length,
    scoreIsNull,
  };
}

/**
 * 그 조립이 **시킨 대로 나왔는가.**
 *
 * `checkReading` 은 저장해도 되는지를 본다 — 그 문턱은 kind 하나에 하나뿐이라
 * (400~12000자) 변형마다 다른 지시를 재지 못한다. 여기서 재는 것은 다른 물음이다:
 * **이 변형이 시킨 대로 나왔는가.** 「지금만」이 여덟 절을 냈다면 그 글은 저장해도
 * 되는 글이지만, 그것으로 「좁힌 출력」을 채점할 수는 없다.
 *
 * ## 어긋남에는 **두 종류**가 있고 그 구별이 여기 있다
 *
 * 절 수는 **계약**이다. 넷을 시켰는데 여덟이 나오면 그 글은 다른 변형의 글이고, 그것으로
 * 무엇을 채점하든 재려던 것을 안 재게 된다.
 *
 * 분량은 **목표**다. 첫 실측에서 다섯 변형이 전부 자기 밴드를 8~30% 넘겼다 — 기준판까지.
 * 1800~2600 은 모델에 대고 검증한 적이 없는 숫자이고, 검증된 사실이 미검증 숫자 하나
 * 때문에 영영 빨간 것은 거꾸로 선 것이다. 그래서 재되 막지 않는다.
 *
 * **이 구별을 부르는 쪽마다 다시 짓지 않는다.** 어느 코드가 막는 것인지 호출부가
 * 기억해야 하면 자리가 늘어난 만큼 갈린다. 값이 스스로 말한다(`kind`).
 */
export type DeviationKind = 'contract' | 'target';

export type OutputDeviation = {
  readonly code: 'length-off-target' | 'section-count-mismatch';
  /** `contract` 는 막는다. `target` 은 적는다 */
  readonly kind: DeviationKind;
  readonly detail: string;
};

export function outputDeviations(
  measured: Measured,
  assembly: PromptAssembly,
): readonly OutputDeviation[] {
  const deviations: OutputDeviation[] = [];

  const wanted = selfSectionCount(assembly);
  if (measured.headings !== wanted) {
    deviations.push({
      code: 'section-count-mismatch',
      kind: 'contract',
      detail: `소제목 ${measured.headings}개 (${wanted}개)`,
    });
  }

  const { min, max } = assembly.selfLength;
  if (measured.length < min || measured.length > max) {
    deviations.push({
      code: 'length-off-target',
      kind: 'target',
      detail: `본문 ${measured.length}자 (${min}~${max})`,
    });
  }

  return deviations;
}
