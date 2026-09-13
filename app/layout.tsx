import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import { siteUrl } from "./site-url";
import "./globals.css";

const TITLE = "만세력 — 나와 사람 사이를 이해하는 사주";
const DESCRIPTION = "명식의 근거부터 두 사람의 관계와 사주풀이까지 차분하게 살펴봅니다.";

/** 링크 미리보기에 서는 그림 — 공유본 화면과 **같은 한 장**이다 */
const PREVIEW = {
  url: "/brand/saju-share-v1.jpg",
  width: 1200,
  height: 628,
  type: "image/jpeg",
  alt: "만세력 — 나를 이루는 흐름을 읽다",
} as const;

/**
 * **미리보기는 앱 전체의 것이다.**
 *
 * 한동안 공유본 화면에만 있었다. 그러면 주소를 손으로 복사해 붙여 넣는 사람 —
 * 「만세력 한번 써 봐」 하고 `saju-snowy.vercel.app` 만 보내는 사람 — 에게는 대화창에
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
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "만세력",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `globals.css` 가 부드러운 스크롤을 켠다 — Next 는 라우트 전환에서 그것을 끌지
    // 말지를 이 표시로 정한다. 없으면 개발 화면이 그것을 문제로 잡는다.
    <html lang="ko" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
