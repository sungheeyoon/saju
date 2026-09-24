import type { Element } from '@/src/lib/saju';

/**
 * 풀이를 **에세이처럼** 세우는 데 드는 셈 둘 — 읽는 시간과 표지의 색.
 *
 * 화면(`.tsx`)은 vitest 가 안 닿으므로 판단을 여기로 내린다(`docs/agents/test-map.md`).
 */

/**
 * 한국어 본문을 1분에 읽는 글자 수. 성인 묵독이 분당 500~600 음절 안팎이라 **느린 쪽**을 잡았다 —
 * 풀이는 제 이야기라 천천히 읽힌다. 마크다운 기호와 공백은 세지 않는다.
 */
const CHARACTERS_PER_MINUTE = 500;

/** 「읽는 데 약 N분」의 N — 한 줄짜리 글도 1분이다(0분이라고 적지 않는다) */
export function readingMinutes(markdown: string): number {
  const letters = markdown.replace(/[#*`\-\s]/g, '').length;
  return Math.max(1, Math.round(letters / CHARACTERS_PER_MINUTE));
}

/** 오행 → 토큰 이름(`--wood-soft` · `--wood-mid`). 모르는 사람은 회색 한 벌 */
const TOKEN: Record<Element, string> = { 木: 'wood', 火: 'fire', 土: 'earth', 金: 'metal', 水: 'water' };

const tokenOf = (element: Element | null) => (element === null ? 'none' : TOKEN[element]);

/**
 * 표지의 면 — **한 사람은 제 색 한 면, 두 사람은 두 색이 비스듬히 만난다.**
 *
 * 색은 토큰으로만 짓는다(다크 짝이 거기 있다). 두 사람 표지의 사선 150° · 52% 는 시안의 값이다 —
 * 가운데보다 조금 오른쪽에서 갈려야 왼쪽 위의 제목 줄이 한 색 위에 온전히 선다.
 */
export function coverFace(elements: readonly (Element | null)[]): { background: string; spine: string } {
  const [a, b] = elements;
  if (elements.length < 2) {
    return { background: `var(--${tokenOf(a ?? null)}-soft)`, spine: `var(--${tokenOf(a ?? null)}-mid)` };
  }
  const left = tokenOf(a ?? null);
  const right = tokenOf(b ?? null);
  return {
    background: `linear-gradient(150deg, var(--${left}-soft) 0 52%, var(--${right}-soft) 52% 100%)`,
    spine: `linear-gradient(180deg, var(--${left}-mid) 0 50%, var(--${right}-mid) 50% 100%)`,
  };
}
