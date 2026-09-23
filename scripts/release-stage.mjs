/**
 * 출시 단계 — **지금이 어느 단계이고, 그 단계에서 무엇이 잠기는가**를 한 곳에서 낸다 (ADR 0093 · 0097).
 *
 * 단계가 적힌 곳은 `docs/prd.md` §7.0 표의 「(지금)」 하나다. 여기는 그 단계마다 **공개 뒤의 규율**(등급 3 의
 * 잠금, 머지 전 전체 검증)을 켜는지만 든다 — 제품 문서에 도구의 속성을 섞지 않는다. `code-rules.test.ts` 가
 * 등급 3 을, `ci-plan.mjs` 가 CI 계획을 이 표로 정한다. PRD 에 단계를 더하면 여기에도 더한다 — 모르는 단계는
 * 시험이 붉히고, CI 는 안전 쪽(전부)으로 간다.
 */

/** 단계 → 공개 뒤의 규율을 켜는가 */
export const LAUNCHED = {
  '운영 베타': false,
  '채팅 안전 베타': false,
  '공개 출시': true,
};

/**
 * PRD 본문에서 §7.0 표의 단계와 「(지금)」 표시를 읽는다. 절을 못 찾으면 빈 목록이다.
 *
 * @param {string} prd
 * @returns {{ name: string, current: boolean }[]}
 */
export function stagesOf(prd) {
  const start = prd.indexOf('\n### 7.0 ');
  if (start === -1) return [];
  const end = prd.indexOf('\n### ', start + 1);
  return [...prd.slice(start, end === -1 ? undefined : end).matchAll(/^\| \*\*([^*]+)\*\*( \(지금\))? \|/gm)].map(
    (match) => ({ name: match[1].trim(), current: match[2] !== undefined }),
  );
}

/**
 * 지금 단계 — 「(지금)」이 정확히 하나이고 표에 있는 이름일 때만 이름을 낸다. 아니면 `null`(모른다).
 *
 * @param {string} prd
 * @returns {string | null}
 */
export function currentStageOf(prd) {
  const current = stagesOf(prd).filter((stage) => stage.current);
  if (current.length !== 1) return null;
  return current[0].name in LAUNCHED ? current[0].name : null;
}
