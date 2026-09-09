
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
const SCORED_KINDS: readonly ReadingKind[] = ['private', 'match'];
export const isScored = (kind: ReadingKind): boolean => SCORED_KINDS.includes(kind);

export const READING_POLICY = {
  /**
   * 프롬프트 판본 — **바뀌면 이름이 바뀐다.**
   *
   * 저장된 결과가 무엇으로 만들어졌는지 되짚는 유일한 값이다. 사용자에게는 보이지
   * 않는다(`prd-archive`: 내부 엔진·prompt·모델 버전은 노출하지 않는다).
   */
  version: 'reading-prompt-v8',
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
  /**
   * 비유 한 문장의 길이 — **시키는 값과 막는 값이 다르다.**
   *
   * 프로덕션에서 자기 풀이가 이것 때문에 떨어졌다(`63자 (60 이하)`). 까닭은 길이가
   * 아니라 **프롬프트가 길이를 한 번도 말하지 않은 것**이었다 — 모델이 지킬 방법이 없는
   * 계약을 검사만 들고 있었다. 토큰은 나가고 글은 버려졌다.
   *
   * 그래서 둘로 가른다.
   *
   * - `target` — 프롬프트가 **시키는** 값. 여기서 읽어다 지시문에 꽂으므로 두 벌이 안 된다.
   * - `max` — 검사가 **막는** 값. 「내 취향보다 길다」가 아니라 **「이건 한 문장이
   *   아니다」**를 막는 자리다. 화면이 점수 위에 한 줄로 세우는데 문단이 오면 그 배치가
   *   깨진다 — 막는 값은 그 경계에 둔다.
   *
   * 「재어 보고 안 켠 것을 값으로 남긴다」의 반대 실수를 했다: **재보지도 않은 수를 켰다.**
   */
  metaphorLength: { target: 40, max: 120 },
} as const;

/** 모델이 내야 하는 것 — 화면은 이 둘만 안다 */
export type ReadingOutput = {
  /** 궁합만. 자기 풀이는 `null` */
  score: number | null;
  /**
   * **한 문장 비유** — 점수가 못 하는 일을 이것이 한다.
   *
   * 실호출 산출물을 세어 보니 궁합 점수 열한 번이 전부 62~68 이었다. 0~100 이라고
   * 말하면서 실제로 쓰는 폭이 7 점이고, **같은 짝을 다시 불렀을 때의 흔들림(±3)이 다른
   * 짝과의 차이만큼 크다.** 그 숫자로는 두 관계를 구별할 수 없다.
   *
   * 눈금을 고치는 대신 **숫자에서 의미를 내렸다.** 66 과 68 을 구별하라고 안 시키고,
   * 이 둘이 어떤 사이인지는 비유 한 문장이 진다 — 같은 62~68 안에서도 전혀 다른 두
   * 관계를 말할 수 있는 자리다.
   *
   * 자기 풀이에는 점수가 없지만 비유는 있다. 「이 사람을 한마디로」가 그 자리다.
   */
  metaphor: string;
  /** 원문 Markdown. 화면은 절 구조를 알지 않는다 */
  markdown: string;
};
