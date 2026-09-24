import type { Metadata } from 'next';
import { Gowun_Dodum } from 'next/font/google';

import { SERVICE_NAME, SERVICE_TAGLINE, SERVICE_TITLE_TEMPLATE } from '@/src/lib/brand';

import { SiteHeader } from './site-header';
import { siteUrl } from './site-url';
import './globals.css';

const TITLE = `${SERVICE_NAME} — ${SERVICE_TAGLINE}`;
const DESCRIPTION = "사주의 근거부터 두 사람의 궁합과 사주풀이까지 차분하게 살펴봅니다.";

/** 사이트 대표 미리보기 — 사주풀이 공유본은 전용 이미지를 사용한다 */
const PREVIEW = {
  url: "/brand/saju-share-v1.jpg",
  width: 1200,
  height: 628,
  type: "image/jpeg",
  alt: `${SERVICE_NAME} — 나를 이루는 흐름을 읽다`,
} as const;

/**
 * **미리보기는 앱 전체의 것이다.**
 *
 * 한동안 공유본 화면에만 있었다. 그러면 주소를 손으로 복사해 붙여 넣는 사람 —
 * 「이거 한번 써 봐」 하고 `saju-snowy.vercel.app` 만 보내는 사람 — 에게는 대화창에
 * **파란 주소 한 줄**만 선다. 공유 버튼으로 나간 링크만 그림이 뜨고 나머지는 안 뜨는
 * 것은, 미리보기가 기능에 붙어 있다는 뜻이고 그건 붙을 자리가 아니다.
 *
 * 여기 세우면 모든 화면이 물려받는다. 공유본 화면은 자기 제목과 설명으로 덮어쓰고
 * (`openGraph` 를 정의한 자리가 부모 것을 통째로 대신한다), 색인 거부도 거기서만 켠다.
 *
 * `metadataBase` 도 여기 한 곳이다. 상대 경로를 절대 주소로 바꾸는 값이라 아래
 * 모든 화면이 이것을 쓴다 — 두 자리에 적으면 갈리는 날 한쪽이 남의 도메인을 가리킨다.
 */
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  /*
    화면 제목은 이름만 적는다(`궁합`) — 뒤의 「— 점점」은 이 틀이 붙인다(G-58). 틀은 **아래** 화면에만
    듣고 여기 적은 `default` 는 제목을 안 적은 화면(`/`)의 것이다.
  */
  title: { default: TITLE, template: SERVICE_TITLE_TEMPLATE },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SERVICE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [PREVIEW],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [PREVIEW.url],
  },
};

/**
 * **둥근 서체는 제목에만**(`font-rounded`). 고운돋움은 굵기가 400 하나뿐이라 본문 13~15px 에서는 획이
 * 가늘어 흐리다 — 인사 · 이름 · 구역 제목까지만 입고, 설명과 버튼은 Pretendard 에 남는다.
 * 한글 조각은 `subsets` 에 없어 미리 받지 않는다(`preload: false`) — 쓰이는 조각만 받는다.
 */
const rounded = Gowun_Dodum({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-gowun-dodum',
});

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `globals.css` 가 부드러운 스크롤을 켠다 — Next 는 라우트 전환에서 그것을 끌지
    // 말지를 이 표시로 정한다. 없으면 개발 화면이 그것을 문제로 잡는다.
    <html lang="ko" data-scroll-behavior="smooth" className={`${rounded.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
