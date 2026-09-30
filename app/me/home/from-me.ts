/**
 * **홈 탭에서 연 결과는 주소에 `from=me` 를 든다**(u2, 2026-09-29) — 결과 화면의 ← 와 머리글의 불이 그 값을 읽어 홈 탭
 * 홈으로 돌아온다. 같은 풀이를 보관함 · 궁합 탭 · 인연 탭에서 열면 다른 값을 든다(`from=shelf` · `compat` · `matching`).
 *
 * 붙이는 곳은 결과 화면 셋뿐이다 — 사주풀이(`/me/readings/…`), 직접 궁합(`/me/compat?…`), 인연 궁합(`/me/match/…`).
 * 결과가 아닌 곳(사람 상세 · 궁합 탭의 두 칸을 채우는 `/compat#…`)은 그대로 둔다 — 그 화면들은 제 탭을 안다.
 */
const RESULT_PATHS = ['/me/readings/', '/me/compat?', '/me/match/'] as const;

export function withFromMe(href: string): string {
  if (!RESULT_PATHS.some((path) => href.startsWith(path))) return href;
  return `${href}${href.includes('?') ? '&' : '?'}from=me`;
}
