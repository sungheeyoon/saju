/**
 * 줄인 움직임을 고른 사람인가 — 덱의 카드 · 사진 튕김 · ⓘ 시트가 움직이기 전에 묻는다.
 *
 * CSS 의 `motion-reduce:` 가 못 닿는 자리(`element.animate` · 타이머로 늦춘 이동)만 이것을 부른다. 세 파일이
 * 같은 줄을 저마다 적고 있었다(2026-09-25).
 */
export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
