import { Gowun_Batang, Noto_Serif_KR } from 'next/font/google';

/*
  **붓의 결은 제목과 한자에만 든다** — 본문 · 단추 · 숫자는 `globals.css` 의 Pretendard 그대로다.

  고운바탕은 한글 제목(이름 · 섹션 제목 · 비유 한 줄)을, 본명조(Noto Serif KR)는 명식 한자를 든다.
  나눔명조를 먼저 대 보았는데 구글 판에 한자가 없어 고딕으로 떨어졌다 — 본명조의 900 이 먹을 눌러 쓴 획에
  가깝다. 한글 글꼴은 무거우니 굵기를 둘씩만 받고 미리 싣지 않는다(`preload: false`) — 빌드가 자체
  호스팅해 CSP `font-src 'self'` 를 지난다.
*/
export const titleFont = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--ink-font-title',
});

export const hanjaFont = Noto_Serif_KR({
  weight: ['700', '900'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--ink-font-hanja',
});
