import { SERVICE_NAME } from '@/src/lib/brand';

/**
 * **로고 — 주색 인장 한 방, 그 안에 점 둘.**
 *
 * 이름 「점점」(`SERVICE_NAME`)을 그대로 그렸다: 작은 점에서 큰 점으로 이어지는 두 점이 이름의 리듬(점 · 점)이고,
 * 비스듬히 오르는 줄이 「점점 나아진다」를 든다. 둘레는 책 끝에 찍는 낙관(落款)이다 — 사주를 적은 만세력 한 장에
 * 이 서비스가 찍는 도장(2026-10-03 시각 시안). 부드러움 때의 궤도 그림은 32px 아래에서 점선이 뭉개졌다.
 *
 * 색은 토큰에서 온다 — 인장은 `--seal`, 점은 `--on-seal`. 그래서 다크 화면에서 저절로 바뀐다. 탭의 작은 그림은
 * `app/icon.svg` 가 같은 모양을 든다.
 *
 * 늘 `aria-hidden` 이다 — 이름은 옆의 글자(`BrandMark`)나 링크의 `aria-label` 이 든다.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`${className} shrink-0`}>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--seal)" />
      <rect x="4.5" y="4.5" width="23" height="23" rx="5" fill="none" stroke="var(--on-seal)" strokeOpacity="0.45" strokeWidth="1" />
      <circle cx="11.5" cy="20.5" r="2.6" fill="var(--on-seal)" />
      <circle cx="19.5" cy="12.5" r="4.4" fill="var(--on-seal)" />
    </svg>
  );
}

/** 로고 + 이름 — 머리글 · 공개 화면의 첫 자리. 이름은 제목 서체(명조)의 굵은 벌로 선다 */
export function BrandMark({ className = '', nameClassName = '' }: { className?: string; nameClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo className="size-7" />
      <span className={`font-display text-[1.3rem] font-bold leading-none tracking-[-0.04em] text-foreground ${nameClassName}`}>
        {SERVICE_NAME}
      </span>
    </span>
  );
}
