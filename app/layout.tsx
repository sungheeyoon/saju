import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "만세력 — 나와 사람 사이를 이해하는 사주",
  description: "명식의 근거부터 두 사람의 관계와 사주풀이까지 차분하게 살펴봅니다.",
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
