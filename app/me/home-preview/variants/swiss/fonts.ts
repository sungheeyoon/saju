import { Inter, Noto_Sans_KR } from 'next/font/google';

/*
  **두 벌만 부른다.** 숫자와 라벨은 Inter(탭 숫자 · 좁은 자간), 한자 명식은 Noto Sans KR 의 두 굵기.

  본문 한글은 `globals.css` 의 Pretendard 그대로다 — Inter 에는 한글이 없어 글자마다 Pretendard 로 내려간다.
  Pretendard 에는 한자가 없어 명식 글자가 시스템 글꼴(맥은 PingFang · Hiragino)로 떨어지고 900 을 흉내만 낸다.
  거대한 활자 블록이 이 시안의 주인공이라 그 한 자리만 Noto Sans KR 로 고정한다. 한글 글꼴은 무거우니
  미리 싣지 않고(`preload: false`) 굵기는 둘로 좁혔다 — 브라우저는 unicode-range 조각 중 쓰인 것만 받는다.
*/
export const latin = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--sw-latin',
});

export const han = Noto_Sans_KR({
  weight: ['500', '900'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--sw-han',
});
