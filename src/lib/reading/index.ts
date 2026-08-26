import { evidenceOf, type Evidence } from '../saju/evidence';
import { redactEvidence, type RedactedEvidence } from '../saju/evidence/redacted';
import { shareEvidence, type SharedEvidence } from '../saju/evidence/shared';
import type { Saju } from '../saju';

import type { ReadingKind } from './policy';

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
  | { kind: 'private'; evidence: RedactedEvidence }
  | { kind: 'match'; evidence: SharedEvidence };

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
): ReadingEvidence {
  const full: Evidence = evidenceOf(charts, viewedAt);
  const redacted = redactEvidence(full);

  if (kind === 'self') {
    if (charts.b !== undefined) {
      throw new ReadingEvidenceError('자기 풀이는 한 사람의 자료로만 만듭니다.');
    }
    return { kind, evidence: redacted };
  }

  if (charts.b === undefined) {
    throw new ReadingEvidenceError('궁합 결과는 두 사람의 자료가 있어야 만듭니다.');
  }

  if (kind === 'private') return { kind, evidence: redacted };

  const shared = shareEvidence(redacted);
  if (shared === null) {
    throw new ReadingEvidenceError('공유 결과의 자료를 만들지 못했습니다.');
  }

  return { kind, evidence: shared };
}

export * from './policy';
export * from './notes';
export { CONTROL, READING_PROMPTS, readingPromptOf, type PromptAssembly } from './prompt';
export { PROMPT_VARIANTS, type PromptVariant, type PromptVariantId } from './variants';
export {
  SELF_QUALITY_CASE_SET,
  blindKeyForAll,
  blindLabelsFor,
  blindOrderFor,
  chartForQualityCase,
  type QualityCaseId,
} from './quality-cases';
export {
  checkReading,
  secretForms,
  OUT_OF_SCOPE_TERMS,
  READING_FAILURES,
  type BirthSecret,
  type ReadingCheck,
  type ReadingFailure,
  type ReadingFailureCode,
} from './check';
