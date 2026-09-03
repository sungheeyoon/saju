/**
 * 풀이 하나에 대해 **묻는 것**과 그 말들.
 *
 * `notes.ts` 와 같은 자리에 선다 — 정책이 문장을 들고 화면은 세우기만 한다. 세 kind 가
 * 같은 설문을 쓰므로 화면마다 적으면 한 곳만 고쳐지고, 그때 같은 열에 다른 질문의 답이
 * 쌓인다.
 *
 * ## 왜 항목별인가
 *
 * 총평만 받으면 오행 보완 공식의 문제인지, 관계 신호의 해석 문제인지, 문장 표현의
 * 문제인지 구분할 수 없다(`matching-beta.md`). 별 몇 개는 무엇을 고칠지 안 알려 준다.
 *
 * ## 왜 「정확도」라고 안 묻는가
 *
 * 사주 해석의 객관적 정확도를 우리가 잰 적이 없다. 그 낱말로 물으면 잰 적 없는 것을
 * 쟀다고 말하는 셈이고, 답한 사람도 자기가 무엇을 매겼는지 오해한다. 묻는 것은
 * **체감 적합성** — 읽고서 실제와 맞는다고 느낀 정도다(`prd-archive`).
 */

/** 눈금 하나의 폭 — 양 끝의 말이 함께 서야 무엇을 매기는지가 정해진다 */
export const FEEDBACK_SCALE = [1, 2, 3, 4, 5] as const;
export type FeedbackScore = (typeof FEEDBACK_SCALE)[number];

export const FEEDBACK_QUESTIONS = {
  usefulness: {
    label: '이 풀이가 나를 이해하는 데 도움이 됐나요?',
    low: '도움이 안 됐어요',
    high: '많이 됐어요',
  },
  /** 「정확한가」가 아니라 「비슷한가」다 — 위 주석이 그 까닭을 든다 */
  perceivedFit: {
    label: '실제 경험과 얼마나 비슷했나요?',
    low: '많이 달라요',
    high: '많이 비슷해요',
  },
} as const;

/** 분량 — 짧다도 길다도 고칠 거리다 */
export const FELT_LENGTHS = ['short', 'right', 'long'] as const;
export type FeltLength = (typeof FELT_LENGTHS)[number];

export const FELT_LENGTH_LABEL: Record<FeltLength, string> = {
  short: '짧아요',
  right: '적당해요',
  long: '길어요',
};

/**
 * 아쉬운 점 — **DB 의 `tags_are_known` 과 같은 집합이어야 한다.**
 *
 * 한 낱말을 두 언어에 적었으므로 어긋날 수 있다. 흐름 검사가 여섯을 **다 넣어 보고**,
 * DB 쪽이 좁아지면 그 자리에서 걸린다.
 *
 * 「바넘 같다」를 「너무 추상적」과 「반복됨」 둘로 나눠 받는다. 한 낱말로 합치면 글이
 * 왜 헐거운지가 안 갈린다 — 근거를 안 쓴 것과 같은 근거를 되풀이한 것은 다른 고장이다.
 */
export const ISSUE_TAGS = [
  'abstract',
  'repetitive',
  'assertive',
  'jargon',
  'mismatch',
  'ui',
] as const;
export type IssueTag = (typeof ISSUE_TAGS)[number];

export const ISSUE_TAG_LABEL: Record<IssueTag, string> = {
  abstract: '너무 추상적이에요',
  repetitive: '같은 말이 반복돼요',
  assertive: '너무 단정적이에요',
  jargon: '용어가 어려워요',
  mismatch: '실제와 달라요',
  ui: '화면이 불편해요',
};

/**
 * 자유 입력 — **좁게 묻는다.**
 *
 * 「특히 맞거나 틀린 부분이 있다면」처럼 넓게 물으면 사람들은 사연을 쓴다. 사연에는
 * 남의 생년월일이 들어오고, 그 사람은 동의한 적이 없다. 이 저장소는 출생 원문이
 * 모델·주소·로그로 새지 않게 막아 왔는데(`redacted.ts`), 넓은 칸은 사용자가 그것을
 * 손으로 되돌려 놓는 문이다.
 *
 * **경고 문장이 그 문을 막지는 못한다.** 프롬프트 규칙으로 막는 것과 똑같이 약하다.
 * 실제로 막는 것은 셋이다 — 대목을 가리키게 하는 **좁은 질문**, 사연이 안 들어가는
 * **200자**, 그리고 사람이 읽는 칸이라 **동의 뒤에만 열리는 것**. 문장은 그래도 한 줄
 * 남기되, 그것이 통제라고 믿지 않는 자리에 둔다.
 */
export const FEEDBACK_COMMENT = {
  label: '어느 대목이 맞았고 어느 대목이 달랐나요?',
  hint: '풀이의 문장을 가리켜 주시면 가장 도움이 됩니다. 다른 사람의 생년월일은 적지 말아 주세요.',
  limit: 200,
} as const;

/** 답을 받은 뒤 — 고맙다고 말하고, 고칠 수 있다고 말한다 */
export const FEEDBACK_THANKS = '답해 주셔서 고맙습니다. 다음 풀이를 만들 때 참고합니다.';

/**
 * 이 설문이 무엇에 쓰이는지 — **한 줄로.**
 *
 * 「서비스 개선에 활용됩니다」는 넓어서 아무것도 안 알린다. 여기서 말하는 것은 답이
 * **어느 글에 매이는가**이고, 그것이 사용자가 알아야 하는 유일한 구조다: 지금 읽은
 * 글에 매인다. 다시 만들면 새 글에 새로 묻는다.
 */
export const FEEDBACK_SCOPE_NOTE = '지금 읽은 이 풀이에 대한 답입니다. 새로 만들면 다시 여쭤봐요.';

/**
 * 이미 남긴 답 — **고치는 화면이 이 값으로 열린다.**
 *
 * 「답했는가」만 알고 열면 칸이 전부 비어 있고, 거기서 다시 보내면 적어 두었던 글까지
 * 지워진다. 고치는 것과 지우는 것을 화면이 구별하지 못하는 것이다.
 */
export type ReadingAnswer = {
  readonly usefulness: FeedbackScore;
  readonly perceivedFit: FeedbackScore;
  readonly feltLength: FeltLength;
  readonly issueTags: readonly IssueTag[];
  readonly comment: string | null;
};
