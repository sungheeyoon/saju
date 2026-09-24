import { Gowun_Dodum } from 'next/font/google';

/*
  **둥근 서체는 제목에만.** 고운돋움은 굵기가 400 하나뿐이라 본문 13~15px 에서는 획이 가늘어 흐리다.
  인사 · 인용 · 이름 · 구역 제목까지만 입고, 설명과 버튼은 Pretendard 에 남긴다.
  한글 조각은 `subsets` 에 없어 미리 받지 않는다(`preload: false`) — 쓰이는 조각만 받는다.
*/
export const rounded = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});
