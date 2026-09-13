/**
 * 서비스 설문 — **묻는 것과 그 말들.**
 *
 * 풀이 설문(`reading/feedback.ts`)과 나란히 선다. 갈리는 자리는 하나다 — 저것은 **그
 * 글 하나**에 대한 답이라 답이 그 글을 만든 시도에 매이고(ADR 0022), 이것은 **서비스
 * 전체**에 대한 답이라 매달릴 시도가 없다. 「무엇이 좋았나」·「얼마면 내겠나」는 저 자리에
 * 둘 수 없는 물음이다.
 *
 * ## 왜 띠를 안 세우나
 *
 * 잔액이 0이 된 사람이나 종료 3일 전에 띠를 세우는 안이 있었다. 그러면 **답할 사람을
 * 우리가 고르는** 것이 되고, 표본이 「다 써 본 사람」 쪽으로 기운다. 탭 하나를 열어 두고
 * 할 사람이 자기 때에 하게 한다.
 *
 * ## 이름은 화면에 서는 그 말이다
 *
 * 설문에만 있는 이름을 지으면 사용자가 고를 때 한 번 더 번역해야 한다. 그래서
 * 「오늘의 인연」·「함께 보는 궁합」처럼 실제 화면의 낱말을 쓴다.
 *
 * ## 값은 DB 와 두 벌이다
 *
 * 슬러그 집합이 표의 검사식과 같아야 한다(`service_survey`). 한 낱말을 두 언어에 적었으니
 * 어긋날 수 있고, 어긋나면 **새 값이 조용히 거절된다.** pgTAP 이 여기 있는 값을 다 넣어
 * 보는 것이 그 자리를 잡는 장치다 — 풀이 설문의 태그와 같은 규율이다.
 */

export const SURVEY_VERSION = 'service-survey-v1';

// ---------------------------------------------------------------------------
// 기능 — Q1 과 Q1b 가 같은 목록을 쓴다
// ---------------------------------------------------------------------------

/**
 * 지금 서 있는 기능 다섯 — **화면 이름 그대로.**
 *
 * 「인연 추천」과 「인연 궁합」을 가른다. 후보를 훑는 일과 성립한 인연의 궁합을 읽는 일은
 * 다른 경험이고, 한 낱말로 묶으면 매칭이 값어치가 있었는지를 영영 못 가른다.
 */
export const FEATURES = [
  'self_reading',
  'person_reading',
  'pair_reading',
  'discovery',
  'match_reading',
] as const;
export type Feature = (typeof FEATURES)[number];

export const FEATURE_LABEL: Record<Feature, string> = {
  self_reading: '내 사주풀이',
  person_reading: '다른 사람의 사주풀이',
  pair_reading: '궁합 (내가 고른 두 사람)',
  discovery: '오늘의 인연',
  match_reading: '함께 보는 궁합',
};

/**
 * Q1 — **직접 이용해 본 것 중** 좋았던 것.
 *
 * 이용 기록으로 목록을 걸러 세우지 않는다. 걸러 세우면 「있는지도 몰랐다」는 답을 영영
 * 못 받고, 스무 명 테스트에서 그것은 「별로였다」보다 큰 신호다. 서버가 아는 이용 현황은
 * 답 옆에 기록만 한다.
 */
export const LIKED_OPTIONS = [...FEATURES, 'none', 'not_enough'] as const;
export type LikedOption = (typeof LIKED_OPTIONS)[number];

export const LIKED_LABEL: Record<LikedOption, string> = {
  ...FEATURE_LABEL,
  none: '특별히 없었어요',
  not_enough: '아직 이용해 본 기능이 없어요',
};

/**
 * Q1b — **발견 여부는 따로 물어야 얻는다.**
 *
 * 목록을 다 세우는 것만으로는 몰랐다는 사실이 안 나온다. 고른 것과 안 고른 것 사이에
 * 「몰랐다」와 「알지만 안 썼다」가 섞여 있기 때문이다.
 */
export const UNKNOWN_OPTIONS = [...FEATURES, 'all_known', 'not_sure'] as const;
export type UnknownOption = (typeof UNKNOWN_OPTIONS)[number];

export const UNKNOWN_LABEL: Record<UnknownOption, string> = {
  ...FEATURE_LABEL,
  all_known: '모두 알고 있었어요',
  not_sure: '잘 기억나지 않아요',
};

// ---------------------------------------------------------------------------
// Q2 — 개선할 부분
// ---------------------------------------------------------------------------

export const IMPROVE_OPTIONS = [
  'content',
  'birth_input',
  'picking',
  'waiting',
  'layout',
  'discovery',
  'errors',
  'missing',
  'none',
  'unsure',
  'other',
] as const;
export type ImproveOption = (typeof IMPROVE_OPTIONS)[number];

export const IMPROVE_LABEL: Record<ImproveOption, string> = {
  content: '풀이 내용',
  birth_input: '출생 정보 입력',
  picking: '풀이를 볼 사람이나 궁합 선택',
  waiting: '결과가 나올 때까지 걸리는 시간',
  layout: '화면 구성과 글 읽기',
  discovery: '오늘의 인연',
  errors: '오류나 작동 문제',
  missing: '원하는 기능이 없음',
  none: '특별히 없어요',
  unsure: '아직 판단하기 어려워요',
  other: '기타',
};

// ---------------------------------------------------------------------------
// Q3 — 남은 풀이권
// ---------------------------------------------------------------------------

/**
 * **「왜 안 썼나」가 아니라 의향을 먼저 묻는다.**
 *
 * 아무 때나 답할 수 있게 되면 「안 쓴 이유」는 첫날 답하는 사람에게 성립하지 않는
 * 물음이다. 다섯 장을 그대로 쥔 사람에게 그것을 물으면, 그 사람의 답은 어느 칸에 넣어도
 * 거짓이 된다.
 */
export const CREDIT_INTENTS = ['will_use', 'undecided', 'not_for_now'] as const;
export type CreditIntent = (typeof CREDIT_INTENTS)[number];

export const CREDIT_INTENT_LABEL: Record<CreditIntent, string> = {
  will_use: '더 사용할 생각이에요',
  undecided: '아직 정하지 않았어요',
  not_for_now: '당분간 사용할 생각이 없어요',
};

/** 이유는 **의향이 「더 쓰겠다」가 아닐 때만** 묻는다 */
export const CREDIT_REASONS = [
  'enough',
  'no_target',
  'below_expectation',
  'no_birth_info',
  'troublesome',
  'error',
  'no_time',
  'other',
] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

export const CREDIT_REASON_LABEL: Record<CreditReason, string> = {
  enough: '지금 궁금한 내용은 충분히 봤어요',
  no_target: '더 보고 싶은 사람이나 주제가 없어요',
  below_expectation: '결과가 기대에 못 미쳤어요',
  no_birth_info: '출생 정보를 구하기 어려워요',
  troublesome: '입력하거나 이용하는 과정이 번거로워요',
  error: '오류 때문에 이용하지 못했어요',
  no_time: '아직 이용할 시간이 없었어요',
  other: '기타',
};

// ---------------------------------------------------------------------------
// Q4 — 앞으로. **있는 것과 없는 것을 갈라 세운다**
// ---------------------------------------------------------------------------

/**
 * 지금 되는 일.
 *
 * `refresh_luck` 이 여기 서는 것이 헷갈리는 자리다. 풀이를 만들 때 기준 시각을 그 자리에서
 * 새로 잡아 **그때 도는 대운·세운·월운**을 근거에 실으므로, 석 달 뒤에 다시 만들면 그때의
 * 운으로 읽힌다. 없는 것은 **옛 글과 견주는 것**이다(새 풀이가 옛 글을 통째로 교체한다,
 * ADR 0013) — 그쪽은 아래 목록에 있다.
 */
export const WANT_OPTIONS = [
  'self_deeper',
  'person_reading',
  'pair_reading',
  'discovery',
  'refresh_luck',
  'unsure',
  'none_again',
] as const;
export type WantOption = (typeof WANT_OPTIONS)[number];

export const WANT_LABEL: Record<WantOption, string> = {
  self_deeper: '내 사주를 더 자세히 보기',
  person_reading: '다른 사람의 사주 보기',
  pair_reading: '다른 사람과의 궁합 보기',
  discovery: '새로운 인연 찾기',
  refresh_luck: '시간이 지난 뒤 지금 운으로 다시 풀이받기',
  unsure: '아직 잘 모르겠어요',
  none_again: '다시 이용할 생각은 없어요',
};

/**
 * **아직 없는 것.** 배지가 아니라 목록을 갈라서 세운다.
 *
 * 「현재 제공하지 않습니다」 한 줄로는 기대를 못 막는다 — 이 저장소가 여러 번 확인한
 * 것이다. 섞어 놓으면 곧 나온다고 읽히고, 그것은 우리가 한 적 없는 약속이 된다.
 */
export const WANT_NEW_OPTIONS = [
  'followup_question',
  'compare_readings',
  'chat',
  'luck_notice',
  'none',
] as const;
export type WantNewOption = (typeof WANT_NEW_OPTIONS)[number];

export const WANT_NEW_LABEL: Record<WantNewOption, string> = {
  followup_question: '받은 풀이에 이어서 추가 질문하기',
  compare_readings: '지난 풀이와 지금 풀이를 나란히 비교하기',
  chat: '인연과 앱 안에서 이야기 나누기',
  luck_notice: '운이 바뀌는 때를 알려 주기',
  none: '특별히 없어요',
};

export const WANT_NEW_NOTE = '아래 기능은 현재 제공하지 않으며, 개발 여부도 정해지지 않았습니다.';

// ---------------------------------------------------------------------------
// Q5 — 값
// ---------------------------------------------------------------------------

/**
 * 값 — **사다리가 아니라 한 화면이다.**
 *
 * 두 단 사다리(4,900 → 9,900/2,900)를 접었다. 스무 명이면 갈래 여섯으로 흩어져 어느
 * 칸도 수가 안 되고, 최대 금액 하나면 **한 축으로 줄이 서서** 오히려 읽힌다.
 *
 * **눈금을 보기 좋게 맞추려고 실제로 검토하지 않는 금액을 넣지 않는다.** 간격이 고른 것은
 * 목록의 성질이지 값의 성질이 아니다.
 */
export const PRICE_OPTIONS = [
  'free',
  '990',
  '1990',
  '4900',
  '9900',
  '12000',
  'over_12000',
  'unsure',
] as const;
export type PriceOption = (typeof PRICE_OPTIONS)[number];

export const PRICE_LABEL: Record<PriceOption, string> = {
  free: '무료로만 이용하고 싶어요',
  '990': '990원',
  '1990': '1,990원',
  '4900': '4,900원',
  '9900': '9,900원',
  '12000': '12,000원',
  over_12000: '12,000원보다 높아도 고려할 수 있어요',
  unsure: '아직 판단하기 어려워요',
};

/** 값을 묻는 상품 — **읽어 본 종류만** 선다 */
export const PRICE_SUBJECTS = ['solo', 'pair'] as const;
export type PriceSubject = (typeof PRICE_SUBJECTS)[number];

export const PRICE_QUESTION: Record<PriceSubject, string> = {
  solo: '지금 읽은 것과 같은 구성과 분량의 새로운 사주풀이 1회에, 지불할 의향이 있는 최대 금액은 얼마인가요?',
  pair: '지금 읽은 것과 같은 구성과 분량의 새로운 궁합 풀이 1회에, 지불할 의향이 있는 최대 금액은 얼마인가요?',
};

export const PRICE_NOTE =
  '아래 금액 중 하나를 골라주세요. 이미 받은 결과를 다시 열어보는 비용은 아닙니다. 실제 결제는 진행되지 않습니다.';

/**
 * 값을 고를 때 고려한 점 — **두 상품을 합쳐 한 번만 묻는다.**
 *
 * 상품마다 물으면 문항이 두 벌이 되어 끝까지 채울 분량이 아니게 된다. 대신 **그 이유가
 * 사주풀이 값에 대한 것인지 궁합 값에 대한 것인지는 가를 수 없다** — 그 한계를 안고 간다.
 */
export const PRICE_FACTORS = [
  'depth',
  'answered',
  'trust',
  'fun',
  'difference',
  'free_alternatives',
  'budget',
  'future_need',
  'willingness',
  'other',
] as const;
export type PriceFactor = (typeof PRICE_FACTORS)[number];

export const PRICE_FACTOR_LABEL: Record<PriceFactor, string> = {
  depth: '풀이의 구체성과 분량',
  answered: '궁금했던 내용에 답을 얻었는지',
  trust: '풀이를 얼마나 믿을 수 있는지',
  fun: '읽는 재미',
  difference: '다른 서비스와의 차이',
  free_alternatives: '무료로 이용할 수 있는 대안',
  budget: '내 지출 여유',
  future_need: '앞으로 더 볼 필요가 있는지',
  willingness: '사주·궁합에 돈을 쓰고 싶은지',
  other: '기타',
};

// ---------------------------------------------------------------------------
// 단독 선택 — **다른 답과 양립하지 않는 항목**
// ---------------------------------------------------------------------------

/**
 * 「없어요」·「모르겠어요」는 다른 답과 함께 설 수 없다.
 *
 * 화면이 서로를 풀어 주고, **서버도 같은 것을 지킨다** — 함께 들어오면 거절한다. 화면이
 * 이미 막으므로 그 거절은 사람에게 안 보이고, 보이면 그것은 화면이 깨졌다는 뜻이다.
 */
export const SOLE_CHOICES = {
  liked: ['none', 'not_enough'],
  unknown: ['all_known', 'not_sure'],
  improve: ['none', 'unsure'],
  wants: ['unsure', 'none_again'],
  wantsNew: ['none'],
} as const satisfies Record<string, readonly string[]>;

/** 고른 것에서 **단독 항목의 규칙**을 적용한다 — 마지막에 누른 것이 이긴다 */
export function afterPicking<T extends string>(
  picked: readonly T[],
  choice: T,
  sole: readonly string[],
): T[] {
  const has = picked.includes(choice);
  if (has) return picked.filter((one) => one !== choice);
  if (sole.includes(choice)) return [choice];
  return [...picked.filter((one) => !sole.includes(one)), choice];
}

// ---------------------------------------------------------------------------
// 화면이 쓰는 말
// ---------------------------------------------------------------------------

export const SURVEY_COPY = {
  tab: '서비스 설문',
  title: '이용해 보니 어떠셨나요?',
  intro:
    '지금까지 이용하면서 좋았던 점과 아쉬웠던 점을 알려주세요. 풀이권을 모두 사용하지 않아도 참여할 수 있습니다. 답변은 서비스 개선에 활용합니다. 설문에 참여하지 않아도 서비스는 계속 이용할 수 있습니다.',
  editable: '답변은 나중에 수정할 수 있습니다.',
  drafting:
    '작성 중인 답변은 자동으로 임시 저장됩니다. 다음에 이어서 작성할 수 있습니다. 운영자는 제출한 답변만 확인합니다.',
  draftSaved: '임시 저장됨',
  draftFailed: '임시 저장하지 못했습니다.',
  submit: '답변 제출하기',
  resubmit: '수정한 답변 제출하기',
  thanks: '답변을 보내주셔서 감사합니다. 서비스 개선에 참고하겠습니다.',
  multiple: '여러 개 선택할 수 있어요.',
  optional: '선택 응답',
  /** 동의가 없으면 여기서 켤 수 있다 — 탭만 감추면 헤더가 동의를 물어야 한다 */
  consentNeeded:
    '이 설문은 풀이 개선에 활용하는 데 동의하신 분께 받습니다. 아래에서 켜시면 바로 답하실 수 있습니다.',
} as const;

export const QUESTION = {
  liked: '직접 이용해 본 기능 중 좋았던 것은 무엇인가요?',
  unknown: '이 설문을 보기 전까지, 있는 줄 몰랐던 기능이 있나요?',
  improve: '개선했으면 하는 부분은 무엇인가요?',
  improveText: '어떤 점이 어떻게 바뀌면 좋을까요?',
  creditIntent: '남은 풀이권을 더 사용할 생각이 있나요?',
  creditReasons: '어떤 이유인가요?',
  wants: '현재 기능 중 앞으로 이용하고 싶은 것은 무엇인가요?',
  wantsNew: '새로 생긴다면 이용해 보고 싶은 기능이 있나요?',
  priceFactors: '금액을 선택할 때 어떤 점을 고려했나요?',
  freeText: '그 밖에 전하고 싶은 말이 있나요?',
} as const;

/** 자유 입력은 **둘뿐이다** — 문항마다 칸을 달면 끝까지 채울 분량이 아니게 된다 */
export const TEXT_LIMIT = { improve: 500, free: 1000 } as const;

// ---------------------------------------------------------------------------
// 답 한 벌
// ---------------------------------------------------------------------------

export type SurveyAnswers = {
  readonly liked: readonly LikedOption[];
  readonly unknown: readonly UnknownOption[];
  readonly improve: readonly ImproveOption[];
  readonly improveText: string;
  readonly creditIntent: CreditIntent | null;
  readonly creditReasons: readonly CreditReason[];
  readonly wants: readonly WantOption[];
  readonly wantsNew: readonly WantNewOption[];
  readonly priceSolo: PriceOption | null;
  readonly pricePair: PriceOption | null;
  readonly priceFactors: readonly PriceFactor[];
  readonly freeText: string;
};

export const EMPTY_ANSWERS: SurveyAnswers = {
  liked: [],
  unknown: [],
  improve: [],
  improveText: '',
  creditIntent: null,
  creditReasons: [],
  wants: [],
  wantsNew: [],
  priceSolo: null,
  pricePair: null,
  priceFactors: [],
  freeText: '',
};

/**
 * 한 칸이라도 답했나 — **제출 버튼이 이 값으로 열린다.**
 *
 * 빈 줄을 제출로 받으면 「참여했다」에 아무 말도 없는 줄이 섞이고, 그 줄은 나중에 「불만이
 * 없다」로 잘못 읽힌다.
 */
export function isAnswered(answers: SurveyAnswers): boolean {
  return (
    answers.liked.length > 0 ||
    answers.unknown.length > 0 ||
    answers.improve.length > 0 ||
    answers.improveText.trim() !== '' ||
    answers.creditIntent !== null ||
    answers.creditReasons.length > 0 ||
    answers.wants.length > 0 ||
    answers.wantsNew.length > 0 ||
    answers.priceSolo !== null ||
    answers.pricePair !== null ||
    answers.priceFactors.length > 0 ||
    answers.freeText.trim() !== ''
  );
}

/**
 * 숨은 문항의 답을 **비운다** — 서버도 같은 것을 하고, 여기서는 보내기 전에 한다.
 *
 * 화면을 열어 둔 사이에 마지막 풀이권을 쓰면 Q3 이 사라진다. 그때 남아 있던 값을 그대로
 * 보내면 「안 물어본 문항의 답」이 저장된다.
 */
export function withoutHidden(
  answers: SurveyAnswers,
  shown: { creditsLeft: number; readSolo: boolean; readPair: boolean },
): SurveyAnswers {
  return {
    ...answers,
    creditIntent: shown.creditsLeft > 0 ? answers.creditIntent : null,
    creditReasons:
      shown.creditsLeft > 0 && answers.creditIntent !== null && answers.creditIntent !== 'will_use'
        ? answers.creditReasons
        : [],
    priceSolo: shown.readSolo ? answers.priceSolo : null,
    pricePair: shown.readPair ? answers.pricePair : null,
    priceFactors: shown.readSolo || shown.readPair ? answers.priceFactors : [],
  };
}

// ---------------------------------------------------------------------------
// 운영자가 읽는 자리에서 쓰는 말
// ---------------------------------------------------------------------------

/**
 * 집계표의 문항 이름 — **DB 는 열쇠만 내준다**(`operator_service_survey_counts`).
 *
 * 말을 DB 반환값에 섞으면 문구를 고칠 때마다 마이그레이션이 필요해진다. 사용자 앞에
 * 서는 문장(`QUESTION`)과 표의 머리말이 갈리는 것도 이 자리에서 정한다 — 표에서는
 * 「개선했으면 하는 부분은 무엇인가요?」가 아니라 「개선할 부분」이 읽기 쉽다.
 */
export const SURVEY_QUESTION_TITLE: Record<string, string> = {
  liked: '좋았던 기능',
  unknown: '몰랐던 기능',
  improve: '개선할 부분',
  creditIntent: '남은 풀이권',
  creditReasons: '더 안 쓰는 이유',
  wants: '앞으로 이용하고 싶은 것 (지금 있는 기능)',
  wantsNew: '새로 생긴다면',
  priceSolo: '사주풀이 값',
  pricePair: '궁합 값',
  priceFactors: '값을 고를 때 고려한 점',
};

const CHOICE_LABELS: Record<string, Record<string, string>> = {
  liked: LIKED_LABEL,
  unknown: UNKNOWN_LABEL,
  improve: IMPROVE_LABEL,
  creditIntent: CREDIT_INTENT_LABEL,
  creditReasons: CREDIT_REASON_LABEL,
  wants: WANT_LABEL,
  wantsNew: WANT_NEW_LABEL,
  priceSolo: PRICE_LABEL,
  pricePair: PRICE_LABEL,
  priceFactors: PRICE_FACTOR_LABEL,
};

/**
 * 열쇠를 말로 — **모르는 값은 열쇠 그대로 세운다.**
 *
 * 목록에서 뺀 선택지가 옛 답에 남아 있을 수 있다. 그때 빈 칸을 세우면 그 답이 사라진
 * 것처럼 보이므로, 번역하지 못한 것은 번역하지 않은 채로 보인다.
 */
export function choiceLabel(question: string, choice: string): string {
  return CHOICE_LABELS[question]?.[choice] ?? choice;
}
