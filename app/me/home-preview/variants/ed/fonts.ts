import { Fraunces, Noto_Serif_KR } from 'next/font/google';

/*
  **활자 둘 — 명조 제목과 숫자용 라틴 세리프.** 본문은 `globals.css` 의 Pretendard 그대로다.

  Noto Serif KR 은 한글 · 한자를 unicode-range 조각으로 나눠 내서 쓰는 글자만 받는다. 굵기는 표지 글자(700) ·
  제목(600) · 인용(400) 셋으로 좁혔다. Fraunces 는 번호(01 · 02)와 점수 · 개수에만 쓴다 — 라틴만.
  둘 다 빌드 때 자체 호스팅돼 CSP `font-src 'self'` 를 지난다.
*/
export const serifKr = Noto_Serif_KR({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--ed-serif',
});

export const figures = Fraunces({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--ed-figure',
});
