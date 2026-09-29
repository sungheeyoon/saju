/**
 * 첫 화면 두 입구의 그림 — 「내 사주 보기」는 해, 「궁합 보기」는 태극.
 *
 * 입구에는 오행 그림(`element-symbol`)이 서 있었다(火 · 水). 그런데 입구는 오행을 뜻하지 않아서, 색과 모양이
 * 무엇을 말하는지 물을 까닭만 만들었다. 입력 폼 시안 s 「부드러움」(운영자 2026-09-29 「s 로 하고 제품에 적용해」,
 * ADR 0132)이 흑백 그림 둘로 바꿨다 — 선 굵기 1.6 과 `currentColor` · 흰 면뿐이라 판의 색을 안 입는다.
 *
 * 장식이다(`aria-hidden`) — 이름은 입구의 글자가 든다.
 */

/** 해 — 가운데 원과 빛살 여덟. 태극과 같은 선 굵기 */
export function SunMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="4.4" fill="currentColor" />
      {RAYS.map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.6"
          x2="12"
          y2="5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/** 태극 — 먹 반 · 흰 반, 테두리 1.6 */
export function TaijiMark({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9.2" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 2.8a9.2 9.2 0 0 1 0 18.4 4.6 4.6 0 0 1 0-9.2 4.6 4.6 0 0 0 0-9.2Z" fill="currentColor" />
      <circle cx="12" cy="7.4" r="1.4" fill="currentColor" />
      <circle cx="12" cy="16.6" r="1.4" fill="var(--color-surface)" />
    </svg>
  );
}
