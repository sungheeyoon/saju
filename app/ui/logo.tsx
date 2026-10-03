import { SERVICE_NAME } from '@/src/lib/brand';

/**
 * **로고 — 나이테.** 가운데 감물빛 점(나), 그 둘레로 고르지 않게 퍼지는 결 두 겹, 바깥으로 이어지다 끝에 작은 점 하나(곁의 사람).
 *
 * 이름 「결」(`SERVICE_NAME`)과 같은 그림이다(2026-10-03 브랜드 시안). 나무는 해마다 한 겹씩 결을 두르고, 그 간격은
 * 해마다 다르다 — 태어난 해 · 달 · 날 · 시로 사람의 결을 읽는 사주와 같은 말이다. 결의 가운데가 한쪽으로 치우친 것은 진짜
 * 나이테처럼 햇빛 쪽이 넓게 자라서이고, 바깥 결이 열린 채 점 하나에 닿는 것은 나의 결이 곁의 사람에게 이어진다는 뜻이다.
 * 동심원이라 홈 · 매칭의 관계 지도(궤도)와 한 가족으로 읽힌다.
 *
 * 색은 토큰에서 온다 — 나는 `--brand`, 결은 글자색. 그래서 다크 화면에서 저절로 바뀐다. 탭의 작은 그림은 `app/icon.svg` 가
 * 같은 모양을 든다. 공유 그림(`scripts/brand-share-images.mjs`)의 `LOGO` 도 같은 좌표다 — 여기를 바꾸면 거기도 옮긴다.
 *
 * 늘 `aria-hidden` 이다 — 이름은 옆의 글자(`BrandMark`)나 링크의 `aria-label` 이 든다.
 */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={`${className} shrink-0`} fill="none" strokeLinecap="round">
      <path d="M3.08 10.21A14.6 14.6 0 1 1 29.44 22.5" stroke="var(--foreground)" strokeOpacity="0.45" strokeWidth="1.5" />
      <path d="M26.43 19.62C25.67 22.00 22.93 24.31 20.59 25.57C18.24 26.82 14.72 27.85 12.35 27.13C9.97 26.41 7.55 23.59 6.34 21.24C5.13 18.88 4.31 15.35 5.07 13.01C5.84 10.68 8.60 8.43 10.91 7.23C13.23 6.02 16.58 5.09 18.96 5.78C21.33 6.46 23.91 9.00 25.16 11.31C26.40 13.62 27.19 17.24 26.43 19.62Z" stroke="var(--foreground)" strokeWidth="1.6" />
      <path d="M19.70 22.04C18.40 23.29 15.10 23.59 13.21 23.04C11.33 22.49 8.85 20.47 8.41 18.74C7.96 17.00 9.15 14.01 10.55 12.62C11.95 11.24 15.05 9.92 16.80 10.41C18.54 10.90 20.53 13.62 21.01 15.56C21.50 17.50 21.00 20.80 19.70 22.04Z" stroke="var(--foreground)" strokeWidth="1.6" />
      <circle cx="14.7" cy="17.2" r="3" fill="var(--brand)" />
      <circle cx="29.44" cy="22.5" r="1.7" fill="var(--foreground)" />
    </svg>
  );
}

/** 로고 + 이름 — 머리글 · 공개 화면의 첫 자리. 이름은 제목 서체의 굵은 판(고운바탕 700)으로 선다 */
export function BrandMark({ className = '', nameClassName = '' }: { className?: string; nameClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Logo />
      <span className={`font-rounded text-[1.45rem] font-bold leading-none tracking-[-0.01em] text-foreground ${nameClassName}`}>
        {SERVICE_NAME}
      </span>
    </span>
  );
}
