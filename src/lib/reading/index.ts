import { DISCOVERY_POLICY, previewScoreOf, scorePolicyOf, scoreSideOf, type ScorePolicy } from '../discovery';
import type { Relation } from '../people';
import { evidenceOf, type Evidence } from '../saju/evidence';
import { redactEvidence, type RedactedEvidence } from '../saju/evidence/redacted';
import {
  DEFAULT_MATCH_INPUT,
  shareEvidence,
  type MatchInput,
  type SharedEvidence,
} from '../saju/evidence/shared';
import type { Saju } from '../saju';

import { isSolo, type ReadingKind } from './policy';

/**
 * kind 마다 모델에 넘기는 자료를 **여기서 자른다.**
 *
 * 계약은 `policy.ts` 가 들고, 프롬프트는 `prompt.ts` 가, 검사는 `check.ts` 가 한다.
 * 이 파일은 그 셋을 다시 내보내는 입구이기도 하다.
 */

/**
 * kind 마다 모델에 넘기는 자료 — **타입이 범위를 먼저 말한다.**
 *
 * `match` 만 다른 모양인 것이 요점이다. 같은 타입으로 두면 상대 원국 전체 판정이
 * 실린 자료를 Match 프롬프트에 넘기는 코드가 컴파일된다.
 */
export type ReadingEvidence =
  | { kind: 'self'; evidence: RedactedEvidence }
  | { kind: 'person'; evidence: RedactedEvidence }
  /**
   * 궁합 kind 에는 **기준점이 딸려 온다** — 타입이 그것을 강제한다(ADR 0060).
   *
   * 선택값으로 두면 안 실은 자리가 컴파일되고, 그 자리에서 나간 프롬프트는 눈금 없이
   * 0~100 을 요구한다 — 옛 판으로 조용히 돌아가는 길이 열린다.
   *
   * `evidence` 안이 아니라 **옆에** 선다. 안에 넣으면 `evidenceText` 에 실려서 경로 유출
   * 검사가 이 수를 자료로 세고, 엔진이 점수를 낸 것처럼 읽힌다.
   */
  | { kind: 'private'; evidence: RedactedEvidence; baseline: number; scoring: ReadingScoring }
  | { kind: 'match'; evidence: SharedEvidence; baseline: number; scoring: ReadingScoring };

/**
 * 기준점을 **무슨 자로** 쟀는가 — 풀이와 함께 저장된다(ADR 0113).
 *
 * 판(`v2-beta`)과 그때 쓴 사이를 남겨야, 나중에 그 풀이를 다시 여는 화면이 **만든 때의 눈금**으로 지표를 그린다.
 * 정책은 판과 사이에서 다시 나오지만 함께 든다 — 되짚는 사람이 매핑을 다시 풀지 않게.
 */
export type ReadingScoring = {
  version: typeof DISCOVERY_POLICY.version;
  policy: ScorePolicy;
  /** 기준점을 고를 때 쓴 사이 — 모르면 `null`. 인연 궁합은 사이를 안 묻는다 */
  relation: Relation | null;
};

/** 두 사람이 필요한 kind 에 한 사람만 왔다 — 지어낼 수 없으므로 멈춘다 */
export class ReadingEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadingEvidenceError';
  }
}

/**
 * 그 kind 가 받을 자료를 만든다 — **자르는 자리가 여기 하나다.**
 *
 * 셋 다 `redactEvidence` 를 지난다(ADR 0008: 모든 Reading 에 적용한다). `match` 는
 * 그 위에 동의 범위 컷을 한 번 더 지난다(ADR 0012).
 *
 * @throws {ReadingEvidenceError} 궁합 kind 인데 두 번째 사람이 없을 때.
 */
export function readingEvidenceOf(
  kind: ReadingKind,
  charts: { a: Saju; b?: Saju },
  viewedAt: Date,
  /**
   * 인연 궁합에 어느 판의 입력을 넣는가 — **다른 kind 는 이 값을 안 본다.**
   *
   * 기본값은 운영 기준인 제한형이다. 확장형은 견주는 실험에서만 넘긴다(ADR 0067).
   * 프롬프트도 같은 값을 들고 와야 한다 — `readingPromptOf` 가 둘이 어긋나면 멈춘다.
   */
  matchInput: MatchInput = DEFAULT_MATCH_INPUT,
  /**
   * 두 사람이 무슨 사이인가 — **기준점의 눈금을 고른다**(ADR 0113). 모르면 `null` 이고 일반 눈금이다.
   * 인연 궁합은 이 값과 상관없이 연인용이다(`scorePolicyOf`).
   */
  relation: Relation | null = null,
): ReadingEvidence {
  const full: Evidence = evidenceOf(charts, viewedAt);
  const redacted = redactEvidence(full);

  /* `self` 와 `person` 은 같은 자료를 받는다 — 갈리는 것은 접근 판정 하나뿐이다 */
  if (isSolo(kind)) {
    if (charts.b !== undefined) {
      throw new ReadingEvidenceError('한 사람의 풀이는 한 사람의 자료로만 만듭니다.');
    }
    return { kind, evidence: redacted };
  }

  if (charts.b === undefined) {
    throw new ReadingEvidenceError('궁합 결과는 두 사람의 자료가 있어야 만듭니다.');
  }

  /**
   * **기준점은 넘겨받지 않고 여기서 다시 잰다**(ADR 0060).
   *
   * 후보 카드의 스냅샷을 파이프로 넘기는 길도 있었는데 안 된다. `private` 는 카드를 아예
   * 안 거쳐서 그 수가 없고, `match` 도 그 수는 하루짜리라 풀이 시각과 다를 수 있다. 넘기면
   * **한 kind 만 기준점을 갖는다.**
   *
   * 눈금은 사이가 고른다 — 연인 · 배우자와 인연 궁합은 연인용, 나머지는 일반(ADR 0113).
   */
  const scoring: ReadingScoring = {
    version: DISCOVERY_POLICY.version,
    policy: scorePolicyOf({ matched: kind === 'match', relation }),
    relation,
  };
  const baseline = previewScoreOf(scoreSideOf(charts.a), scoreSideOf(charts.b), {
    policy: scoring.policy,
  });

  if (kind === 'private') return { kind, evidence: redacted, baseline, scoring };

  const shared = shareEvidence(redacted, matchInput);
  if (shared === null) {
    throw new ReadingEvidenceError('공유 결과의 자료를 만들지 못했습니다.');
  }

  return { kind, evidence: shared, baseline, scoring };
}

export { COMPARED_MATCH_INPUTS, MATCH_INPUT_FIELDS } from '../saju/evidence/shared';
export * from './policy';
export * from './feedback';
export * from './notes';
export {
  baselineIn,
  CONTROL,
  FALLBACK_NAMES,
  LEGACY_PAIR_ASSEMBLY,
  NOTHING_KNOWN,
  READING_PROMPTS,
  readingPromptOf,
  writesSummaryLast,
  pairSectionTexts,
  promptSlotsOf,
  selfSectionCount,
  selfSectionTexts,
  type PromptSlot,
  type PromptAssembly,
  type ReadingAbout,
} from './prompt';
export {
  measureMarkdown,
  outputDeviations,
  pairOutputDeviations,
  type OutputDeviation,
} from './measure';
export {
  MATCH_INPUT_VARIANTS,
  PAIR_VARIANTS,
  PROMPT_VARIANTS,
  type PairVariant,
} from './variants';
export { checkReading, plainTermsIn, type BirthSecret } from './check';
export { positionSlips } from './position-check';
