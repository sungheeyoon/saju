import {
  BRANCHES,
  SEXAGENARY,
  type FragmentTopic,
  type Pillars,
  type Utterance,
} from '../saju';

/**
 * 로그인 전 첫 화면의 **로그인 전 사주 문단** — 열쇠와, 표가 비었을 때 대신 서는 문장(ADR 0131).
 *
 * ## 왜 열쇠가 「일주-월지」인가
 *
 * 로그인 전 사주 문단은 방문마다 모델이 쓰지 않는다 — 방문자의 생년월일시가 모델 제공자에게 나가고 비용이 방문 수를 따라 는다.
 * 그래서 미리 만들어 둔 표(`taste_passage`)를 읽는데, 표의 칸 수가 곧 비용 상한이다. 일주(60) × 월지(12) = 720칸이면
 * 한 번 채우는 데 720 부름이고, 한 칸에는 같은 일주 · 같은 절기 달에 난 사람 모두가 든다 — 누구 한 사람을 가리키지 않는다.
 * 태어난 시각은 열쇠에 안 든다. 그래서 「시간 모름」도 같은 칸을 읽는다.
 *
 * ## 화면은 이제 이 표를 안 읽는다 (ADR 0143)
 *
 * 로그인 전 첫 화면은 사람마다 서버가 쓰는 글로 바뀌었고(`app/taste-run.ts`), 이 표를 읽던 브라우저의 문과 엔진 문장으로
 * 바꿔 세우던 길은 걷었다. 표 · 만들기 스크립트 · 이 파일은 좁히기(간극 대장 G-69)까지 남는다. 여기는 엔진만
 * 부른다. 글을 만드는 쪽(프롬프트 · 규칙 검사)은 `taste-maker.ts` 에 따로 산다 — 그것이 브라우저 번들에 실리지 않게
 * (`scripts/layers.test.ts` 가 `reading/index` · `prompt` 로 가는 길을 막는다).
 */

/** `丙午-卯` — 일주 두 글자, 하이픈, 월지 한 글자. DB 의 `taste_passage_key_shape` 와 같은 꼴 */
export type TasteKey = `${string}-${string}`;

export const tasteKeyOf = (pillars: Pick<Pillars, 'day' | 'month'>): TasteKey =>
  `${pillars.day.stem}${pillars.day.branch}-${pillars.month.branch}`;

/** 720칸 전부 — 만들기 스크립트가 도는 차례. 일주(甲子 → 癸亥) 안에서 월지(子 → 亥) */
export const TASTE_KEYS: readonly TasteKey[] = SEXAGENARY.flatMap((day) =>
  BRANCHES.map((month): TasteKey => `${day.name}-${month}`),
);

/**
 * 표가 비어 있는 동안 대신 서는 문장 — **엔진이 이 사주에서 낸 정해진 문장(L3 발화)에서 고른다.**
 *
 * 비용이 0 이고 밖으로 아무것도 안 나간다. 고르는 차례는 처음 보는 사람이 가장 덜 어렵게 읽는 쪽부터다 — 뿌리
 * (일간이 어디에 발을 딛고 있나) → 강약 → 가장 무거운 오행. 셋 다 이 사주에 대해 **참인** 문장이고, 없으면 그 자리를
 * 건너뛴다(엔진은 사실이 없으면 말하지 않는다).
 */
const FALLBACK_TOPICS: readonly (readonly FragmentTopic[])[] = [
  ['rootedness.rooted', 'rootedness.rootless'],
  ['strength.verdict'],
  ['elements.heaviest'],
];

const TASTE_FALLBACK_LIMIT = 3;

export function fallbackTasteOf(utterances: readonly Utterance[]): readonly string[] {
  return FALLBACK_TOPICS.flatMap((topics) => {
    const found = utterances.find((one) => topics.includes(one.request.topic) && one.text !== null);
    return found?.text == null ? [] : [found.text];
  }).slice(0, TASTE_FALLBACK_LIMIT);
}
