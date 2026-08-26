import { computeSaju, type Saju } from '../saju';
import { GOLDEN_CASES } from '../saju/golden/cases';

import { PROMPT_VARIANTS, type PromptVariantId } from './variants';

/**
 * **품질을 재는 고정 사례** — 골든 케이스를 *가리켜서* 쓴다.
 *
 * ## 골든 39개를 그대로 쓰지 않는 이유
 *
 * 그 파일이 사례를 고른 기준은 「여기서 틀리면 **조용히** 틀린다」다(`cases.ts` 머리말) —
 * 절입 직전·직후 1분 차이, 자시 경계 같은 계산의 갈림길이다. 2025년에 태어난 사례로
 * 「일과 돈」·「사람 관계」를 평가할 수는 없다. 계산이 갈리는 자리와 **해석이 갈리는
 * 자리는 다르다.**
 *
 * 그래서 여기서 하는 일은 **고르는 것**뿐이다. 입력을 베껴 오지 않고 id 로 가리킨다 —
 * 베끼면 골든이 고쳐졌을 때 두 벌이 조용히 갈리고, 그때 「같은 사례로 비교했다」가
 * 거짓이 된다.
 *
 * ## 무엇을 고정하는가
 *
 * 판본(`version`)과 기준 시각(`viewedAt`)을 함께 못박는다. 운은 부르는 순간으로 짚으므로
 * 시각을 안 고정하면 어제 잰 것과 오늘 잰 것이 **다른 운을 읽는다.** 프롬프트를 비교하려는
 * 자리에서 그것은 잡음이 아니라 다른 실험이다.
 *
 * ## 이것으로 「게이트를 통과했다」고 말하지 않는다
 *
 * 여기 있는 것은 **자기 풀이(self)** 뿐이고, 손으로 돌리는 예비 실험이다. PRD 가 말하는
 * 품질 게이트는 「같은 **모델 설정**으로」 비교한 것이라, 모델·provider·설정을 고정해
 * 부른 뒤에야 성립한다. 이 세트는 후보를 고르는 라운드까지다.
 */
export const SELF_QUALITY_CASE_SET = {
  version: 'self-quality-v1',
  /** 모든 사례가 같은 순간으로 운을 짚는다 */
  viewedAt: '2026-08-26T04:00:00.000Z',
  /**
   * `dimension` 은 화면이 **글자 그대로** 세운다. 마크업을 넣으면 별표가 그대로 보인다 —
   * 프롬프트에 들어가는 문자열과 화면에 서는 문자열은 다른 규칙을 따른다.
   */
  cases: [
    {
      id: 'Q01',
      golden: 'daeun-yang-female',
      dimension: '시각을 아는 보통 성인 · 관계가 비교적 적다 — 기준선',
    },
    {
      id: 'Q02',
      golden: 'dst-1988-on',
      dimension: '시각을 알고 관계가 여러 갈래인 강한 원국',
    },
    {
      id: 'Q03',
      golden: 'unknown-hour-dst-day',
      dimension: 'Q02 와 같은 날, 시각만 없다 — 무엇이 사라지고 무엇이 완충되는지',
    },
    {
      id: 'Q04',
      golden: 'dst-1957-on-830',
      dimension: '다른 세대 · 강하고 관계가 많다',
    },
    {
      id: 'Q05',
      golden: 'meridian-1961-after',
      dimension: '약하고 관계가 매우 많다 — 목록 낭독이 나오는지',
    },
  ],
} as const;

export type QualityCaseId = (typeof SELF_QUALITY_CASE_SET)['cases'][number]['id'];

/** 가리킨 골든 사례가 실제로 있는가 — 없으면 그 자리에서 멈춘다 */
export function chartForQualityCase(id: QualityCaseId): Saju {
  const chosen = SELF_QUALITY_CASE_SET.cases.find((one) => one.id === id);
  if (chosen === undefined) throw new Error(`없는 품질 사례: ${id}`);

  const golden = GOLDEN_CASES.find((one) => one.id === chosen.golden);
  if (golden === undefined) {
    throw new Error(`가리킨 골든 사례가 없다: ${chosen.golden} (${id})`);
  }

  return computeSaju(golden.input, golden.options);
}

/**
 * 사례마다 변형에 붙는 **가린 이름** — `Q01-A` 처럼.
 *
 * 평가하는 사람이 「이건 control 이니까」를 알고 점수를 매기면, 재는 것이 글이 아니라
 * 기대가 된다. 그래서 채점하는 동안에는 이름을 감추고 내보낼 때 짝을 함께 적는다.
 *
 * **사례마다 순서가 달라야 한다.** 넷의 차례가 늘 같으면 첫 사례에서 짝을 한 번 알아챈
 * 뒤로는 가린 것이 아니다. 그렇다고 무작위로 섞으면 어제 채점한 `Q01-A` 와 오늘의
 * `Q01-A` 가 다른 것이 되어 기록을 이어 붙일 수 없다 — 사례 id 로 자리를 정한다.
 */
const BLIND_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * 사례 id 와 변형 id 를 섞어 만든 자리값 — **작지만 한결같아야 한다.**
 *
 * 재현되는 값이어야 어제의 `Q01-A` 와 오늘의 `Q01-A` 가 같은 것이 된다. 사람 눈에
 * 순서가 안 보이기만 하면 되므로 암호학적일 필요는 없다(FNV-1a).
 */
function hashOf(text: string): number {
  let hash = 0x811c9dc5;
  for (const letter of text) {
    hash ^= letter.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * 사례마다 변형이 서는 차례 — **돌리지 않고 섞는다.**
 *
 * 처음에는 `PROMPT_VARIANTS` 를 사례 id 만큼 **회전**시켰다. 그러면 넷의 상대 차례가
 * 늘 같아서, 한 사례에서 짝 하나만 알아채면 **그 사례의 나머지 셋이 공짜로 따라온다.**
 * 가린 것이 아니라 잠깐 덮어 둔 것이었다.
 *
 * 사례 id 와 변형 id를 함께 섞어 자리값을 짓고 그 값으로 세운다. 짝 하나가 새어도 같은
 * 사례의 다른 셋을 알려 주지 않는다.
 *
 * **차례가 사례마다 달라야 하고 같은 사례에는 늘 같아야 한다.** 늘 같으면 첫 사례에서
 * 알아챈 뒤로는 가린 것이 아니고, 무작위면 어제 채점한 기록을 오늘 것에 못 이어 붙인다.
 */
export function blindOrderFor(id: QualityCaseId): readonly PromptVariantId[] {
  return [...PROMPT_VARIANTS]
    .map((variant) => ({ id: variant.id, at: hashOf(`${id}:${variant.id}`) }))
    .sort((one, other) => one.at - other.at)
    .map((one) => one.id);
}

/** `Q01-A` → 그 자리에 선 변형 */
export function blindLabelsFor(
  id: QualityCaseId,
): readonly { readonly blind: string; readonly variant: PromptVariantId }[] {
  return blindOrderFor(id).map((variant, index) => ({
    blind: `${id}-${BLIND_LETTERS[index]}`,
    variant,
  }));
}

/**
 * 모든 사례의 짝 — **전부 채점한 뒤에만 편다.**
 *
 * 채점하는 동안 이것을 보면 재는 것이 글이 아니라 기대가 된다. 그래서 사례별 백업에는
 * 들어가지 않고, 여기서만 한 번에 열린다.
 */
export function blindKeyForAll(): readonly {
  readonly caseId: QualityCaseId;
  readonly blind: string;
  readonly variant: PromptVariantId;
}[] {
  return SELF_QUALITY_CASE_SET.cases.flatMap((one) =>
    blindLabelsFor(one.id).map((pair) => ({ caseId: one.id, ...pair })),
  );
}
