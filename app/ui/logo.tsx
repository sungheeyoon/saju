import { SERVICE_NAME } from '@/src/lib/brand';

/**
 * **로고 — 가운데 큰 점(나), 점선 궤도, 궤도 위에서 점점 커지는 작은 점 둘.**
 *
 * 이름 「점점」(`SERVICE_NAME`)과 같은 그림이다. 나를 가운데 두고 사람들이 둘레에 점으로 앉는 관계 지도를
 * 가장 작게 줄였고, 궤도 위의 두 점이 작은 것에서 큰 것으로 이어져 이름의 리듬(점 · 점)을 든다. 색은 토큰에서
 * 온다 — 나는 불의 파스텔(`--fire-mid`), 두 점은 물 · 나무의 파스텔, 궤도는 글자색을 옅게. 그래서 다크 화면에서
 * 저절로 바뀐다. 탭의 작은 그림은 `app/icon.svg` 가 같은 모양을 든다.
 *
 * 늘 `aria-hidden` 이다 — 이름은 옆의 글자(`BrandMark`)나 링크의 `aria-label` 이 든다.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`${className} shrink-0`}>
      <circle
        cx="16"
        cy="16"
        r="12.5"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.42"
        strokeWidth="1.6"
        strokeDasharray="0.1 3.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="6.5" fill="var(--fire-mid)" stroke="var(--foreground)" strokeWidth="1.5" />
      <circle cx="17.6" cy="3.6" r="2.1" fill="var(--water-mid)" stroke="var(--foreground)" strokeWidth="1.2" />
      <circle cx="26.2" cy="8.9" r="3.3" fill="var(--wood-mid)" stroke="var(--foreground)" strokeWidth="1.4" />
    </svg>
  );
}

/** 로고 + 이름 — 머리글 · 공개 화면의 첫 자리. 이름은 둥근 서체로 선다 */
export function BrandMark({ className = '', nameClassName = '' }: { className?: string; nameClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo />
      <span className={`font-rounded text-[1.3rem] leading-none tracking-[-0.02em] text-foreground ${nameClassName}`}>
        {SERVICE_NAME}
      </span>
    </span>
  );
}
