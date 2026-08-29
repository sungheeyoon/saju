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

/**
 * 잘라 낸 **뒤쪽** — 절마다 어디서 온 말인지 모델이 적어 둔 줄들.
 *
 * 이 값은 프롬프트가 시켜서 만들어졌고 DB 에 저장까지 되는데 **어디에도 안 서 있었다.**
 * 그러면 「이 문장이 왜 이렇게 나왔나」를 물을 때 답이 사람의 짐작이 된다 — 자료를
 * 다시 읽고 그럴듯한 경로를 되짚는 일은 검수가 아니라 재해석이다.
 *
 * 자르는 자리를 `readingBody` 와 **같은 정규식**으로 둔다. 두 자리에서 따로 자르면
 * 언젠가 갈리고, 갈리면 본문에서 뺀 줄이 여기에도 없는 날이 온다.
 *
 * @returns 근거 절이 없으면 `null` — 빈 문자열로 뭉개지 않는다. 모델이 안 쓴 것과
 *   비어 있는 것은 다른 사실이고, 안 썼다는 것 자체가 검수 대상이다.
 */
export function readingGrounding(markdown: string): string | null {
  const grounding = GROUNDING_HEADING.exec(markdown);
  if (grounding === null) return null;

  const from = grounding.index + grounding[0].length;
  // 제목만 있고 줄이 없으면 **안 쓴 것**이다. 제목 한 줄을 근거라고 내주지 않는다.
  return markdown.slice(from).trim() === '' ? null : markdown.slice(grounding.index).trim();
}
