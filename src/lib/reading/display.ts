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

/**
 * 공개 이름을 받기 전에 만든 공유 궁합의 자리 호칭을 현재 화면의 두 이름으로 바꾼다.
 * 새 풀이에는 자리 호칭이 없으므로 그대로 돌아간다.
 */
export function namedMatchBody(
  markdown: string,
  viewerIsFirst: boolean,
  names: { readonly me: string; readonly partner: string },
): string {
  const first = viewerIsFirst ? names.me : names.partner;
  const second = viewerIsFirst ? names.partner : names.me;
  const replace = (source: string, seat: '첫 번째' | '두 번째', name: string) => {
    const called = name === '나' ? name : `${name}님`;
    const particle: Record<string, string> =
      name === '나' ? { 은: '는', 이: '가', 을: '를', 과: '와' } : {};

    return source.replace(
      new RegExp(`${seat} 분(에게|은|이|을|과|의|도|만)?`, 'g'),
      (_, suffix: string | undefined) => `${called}${suffix === undefined ? '' : (particle[suffix] ?? suffix)}`,
    );
  };

  return replace(replace(markdown, '첫 번째', first), '두 번째', second);
}
