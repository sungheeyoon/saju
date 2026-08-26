import type { Metadata } from "next";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "만세력 — 나와 사람 사이를 이해하는 사주",
  description: "명식의 근거부터 두 사람의 관계와 AI 해석까지 차분하게 살펴봅니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
