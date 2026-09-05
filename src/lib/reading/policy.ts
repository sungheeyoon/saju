
/**
 * **현재 AI 결과의 계약** — kind 와 판본과 상한.
 *
 * 자료를 만드는 일(`index.ts`)·프롬프트를 짓는 일(`prompt.ts`)·검사하는 일(`check.ts`)이
 * 다 이 값을 읽는다. 한 자리에 두는 것은 셋이 서로를 부르지 않게 하기 위해서다 —
 * 서로 부르면 불러오는 차례에 기대게 되고, 그때 상수 하나가 `undefined` 로 선다.
 *
 * 아래는 이 파이프라인 전체에 대한 설명이다.
 *
 * **현재 AI 결과를 만드는 파이프라인의 순수한 절반.**
 *
 * 근거를 자르고 · 프롬프트를 짓고 · 나온 것을 검사하는 데까지가 여기다. 부르는 일과
 * 저장하는 일은 서버가 한다(`app/me/reading`). 갈라 두는 까닭은 이 절반이 **DB 도
 * 네트워크도 없이 그대로 시험되는 자리**이기 때문이다 — 검사 규칙이 실제 호출 없이
 * 돌지 않으면 hard fail 이 한 번도 안 걸린 채 배포된다.
 *
 * ## 세 kind 는 **한 파이프라인**이다
 *
 * `self`(내 명식 하나) · `person`(내가 관리하는 저장된 사람 하나) ·
 * `private`(내가 접근 가능한 두 사람) · `match`(성립한 Match).
 * 갈리는 것은 **근거 범위와 접근 판정 둘뿐**이고 나머지는 같은 길을 지난다. kind 마다
 * 파이프라인을 따로 만들면 출력 검사가 한 갈래에서만 도는 일이 생긴다(`prd-archive`).
 *
 * ## 엔진과 AI 의 경계는 **여기서 정하지 않는다**
 *
 * 9단계는 그 경계를 실험하는 단계다(`prd-archive`·ADR 0003). 첫 기준선은 **근거만 넘기고 점수도
 * AI 가 낸다** — `match-v0` 는 프롬프트에 들어가지 않는다. 그 지표를 함께 넘긴 판본은
 * 견줄 짝으로 나중에 붙이고, 무엇을 넘겼는지는 판본 이름이 든다(`promptVersion`).
 */

export const READING_KINDS = ['self', 'person', 'private', 'match'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

/**
 * 한 사람의 명식으로 나는 kind — **`self` 와 `person` 은 같은 계열이다.**
 *
 * 자료도 프롬프트도 검사도 같다. 갈리는 것은 접근 판정 하나뿐이다 — `self` 는 부른
 * 사람의 selfPerson 을 스스로 찾고, `person` 은 `user_person_access` 에 있는 Person
 * 하나를 받는다.
 *
 * **그렇다고 한 낱말로 합치지 않는다.** 합치면 「누구 것을 모델에 넘겼는가」가 기록에서
 * 사라진다 — 내 명식을 넘긴 것과 남의 명식을 넘긴 것은 동의 범위가 다른 일이다.
 *
 * `kind === 'self'` 라고 적힌 자리를 이 술어로 바꾼 것이 이 갈래를 넣는 일의 절반이었다.
 * 「자기 풀이인가」를 물어야 할 자리와 「한 사람짜리인가」를 물어야 할 자리가 그동안
 * 같은 문장이었기 때문이다.
 */
export const SOLO_KINDS = ['self', 'person'] as const;
export type SoloKind = (typeof SOLO_KINDS)[number];
export const isSolo = (kind: ReadingKind): kind is SoloKind =>
  (SOLO_KINDS as readonly string[]).includes(kind);

/** 두 사람 사이를 읽는 kind — 점수가 나는 쪽이다 */
export type PairKind = Exclude<ReadingKind, SoloKind>;

/** 점수를 내는 kind — 한 사람짜리 풀이에는 궁합 점수를 억지로 붙이지 않는다 */
export const SCORED_KINDS: readonly ReadingKind[] = ['private', 'match'];
export const isScored = (kind: ReadingKind): boolean => SCORED_KINDS.includes(kind);

export const READING_POLICY = {
  /**
   * 프롬프트 판본 — **바뀌면 이름이 바뀐다.**
   *
   * 저장된 결과가 무엇으로 만들어졌는지 되짚는 유일한 값이다. 사용자에게는 보이지
   * 않는다(`prd-archive`: 내부 엔진·prompt·모델 버전은 노출하지 않는다).
   */
  version: 'reading-prompt-v6',
  /**
   * 엔진과 AI 의 경계 — **첫 기준선.**
   *
   * 근거만 넘기고 최종 점수도 모델이 낸다. `match-v0` 는 프롬프트에 넣지 않는다 —
   * 넣으면 모델 점수가 그 지표를 거의 따라가고, 그러면 「AI 가 스스로 종합하면 무엇이
   * 나오는가」를 한 번도 재지 못한다.
   */
  boundary: 'model-synthesizes-including-the-score',
  index: 'match-v0-not-in-prompt',
  /** 출력은 한 생성 건에서 점수와 글이 함께 나온다 — 따로 갱신하지 않는다 */
  output: 'score-and-markdown-from-one-generation',
  /** 점수의 범위. 검사가 이 값을 읽는다 */
  scoreRange: { min: 0, max: 100 },
  /** 글의 길이 — 너무 짧으면 근거를 안 읽은 것이고, 너무 길면 읽히지 않는다 */
  markdownLength: { min: 400, max: 12000 },
} as const;

/** 모델이 내야 하는 것 — 화면은 이 둘만 안다 */
export type ReadingOutput = {
  /** 궁합만. 자기 풀이는 `null` */
  score: number | null;
  /** 원문 Markdown. 화면은 절 구조를 알지 않는다 */
  markdown: string;
};
