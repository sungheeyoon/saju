import { Noto_Serif_KR } from 'next/font/google';

/*
  명식 글자(한자)만 명조로 세운다 — 숫자 · 라벨 · 본문은 Pretendard 그대로다.
  이 화면에서 글자는 「값」이고 숫자는 「눈금」이다. 둘의 글꼴이 갈라야 표 안에서 무엇이 값이고 무엇이
  축인지 눈이 먼저 안다. CJK 는 유니코드 범위 조각으로 나뉘어 있어 `preload: false` 면 쓰는 조각만 받는다.
*/
export const serif = Noto_Serif_KR({
  weight: ['600'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--viz-serif',
});
