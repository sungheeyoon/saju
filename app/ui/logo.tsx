import { SERVICE_NAME } from '@/src/lib/brand';

/**
 * **로고 — 궤도 지도(운영자가 고른 안 B, 2026-10-07, ADR 0149).** 가운데 큰 점이 나, 점선 궤도 위에 사람 셋이 점으로 앉고,
 * 나에게서 그 가운데 하나로 선이 하나 닿는다 — 「만날지도」의 두 뜻, 나를 가운데 둔 관계 지도와 그 지도 위에서 만날지도 모를
 * 한 사람이다. 선은 판정이 아니라 「닿았다」는 기록이다(ADR 0109 「4. 관계 지도는 판정이 아니라 기록이다」).
 *
 * 색은 토큰에서 온다 — 나는 불의 파스텔(`--fire-mid`), 셋은 물 · 나무 · 흙의 파스텔, 궤도와 선은 글자색. 그래서 다크 화면에서
 * 저절로 바뀐다. 이 부품은 32px 이상에서만 선다(머리글 · 공개 화면 머리). 탭의 작은 그림은 `app/icon.svg` 가 같은 모양을
 * 종이 판 위에 들고, 16px 판(`app/favicon.ico`)은 궤도와 흙 점을 뺀 굵은 선으로 굽는다(`scripts/brand-icons.mjs`).
 *
 * 늘 `aria-hidden` 이다 — 이름은 옆의 글자(`BrandMark`)나 링크의 `aria-label` 이 든다.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={`${className} shrink-0`}>
      <circle
        cx="32"
        cy="32"
        r="24"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.45"
        strokeWidth="2"
        strokeDasharray="0.1 4.6"
        strokeLinecap="round"
      />
      <path d="M32 32 L52.8 44" stroke="var(--foreground)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="9.5" fill="var(--fire-mid)" stroke="var(--foreground)" strokeWidth="2.4" />
      <circle cx="32" cy="8" r="4" fill="var(--water-mid)" stroke="var(--foreground)" strokeWidth="1.8" />
      <circle cx="52.8" cy="44" r="5.6" fill="var(--wood-mid)" stroke="var(--foreground)" strokeWidth="2" />
      <circle cx="13" cy="46.5" r="3.6" fill="var(--earth-mid)" stroke="var(--foreground)" strokeWidth="1.6" />
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
