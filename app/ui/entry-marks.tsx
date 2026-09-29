/**
 * 첫 화면 두 입구의 그림 — 「내 사주 보기」는 해, 「궁합 보기」는 태극.
 *
 * 입구에는 오행 그림(`element-symbol`)이 서 있었다(火 · 水). 그런데 입구는 오행을 뜻하지 않아서, 색과 모양이
 * 무엇을 말하는지 물을 까닭만 만들었다. 입력 폼 시안 n 「설정 목록」(운영자 2026-09-29, ADR 0132)이 흑백 그림 둘로
 * 바꿨다 — 선 굵기 1.5 와 `currentColor` · 흰 면뿐이라 판의 색을 안 입는다.
 *
 * 장식이다(`aria-hidden`) — 이름은 입구의 글자가 든다.
 */

/** 해 — 가운데 원(테두리)과 짧은 빛살 여덟. 태극과 같은 선 굵기 */
export function SunMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      {RAYS.map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.75"
          x2="12"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** 태극 — 흰 바탕 원에 먹색 반, 테두리 1.5 */
export function TaijiMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9Z" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="16.5" r="1.4" fill="var(--surface)" />
    </svg>
  );
}
