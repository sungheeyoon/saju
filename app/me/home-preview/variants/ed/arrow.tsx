import s from './ed.module.css';

/** 단추 셋이 함께 쓰는 화살표 — 글자 「→」 대신 선으로 그려 명조 · 고딕 어디서든 같은 굵기로 선다 */
export function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={`${s.arrow} shrink-0 fill-none stroke-current`}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}
