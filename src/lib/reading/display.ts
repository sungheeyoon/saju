/**
 * 모델 출력에는 내부 검토용 근거가 본문 뒤에 붙는다.
 *
 * 저장할 때는 그 근거까지 남겨야 품질을 되짚을 수 있지만, 사용자가 읽는 글은 여기서
 * 끝낸다. 화면마다 문자열을 따로 자르면 자기 풀이와 궁합 중 한쪽에서만 근거가 새므로
 * 자르는 규칙을 한 곳에 둔다.
 */
/** 기존 측정·검사 코드가 근거 절을 가리킬 때 쓰는 안정된 머리말. */
export const EVIDENCE_SECTION = '### 근거';

const GROUNDING_HEADING = /^###\s+근거(?:\s+\(검사용\))?\s*$/m;

/** 사용자에게 보여 줄 본문 — 내부 검토용 근거 절은 제외한다. */
export function readingBody(markdown: string): string {
  const grounding = GROUNDING_HEADING.exec(markdown);
  return (grounding === null ? markdown : markdown.slice(0, grounding.index)).trim();
}
