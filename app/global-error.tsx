'use client';

import { SERVICE_NAME } from '@/src/lib/brand';

import { ErrorScreen } from './error-screen';
import './globals.css';

/**
 * **루트 레이아웃이 던졌을 때** — `app/error.tsx` 는 같은 칸의 레이아웃을 감싸지 않아서 여기로 온다.
 *
 * 지금 루트 레이아웃이 그리는 것은 머리 줄(`SiteHeader`, 클라이언트) 하나지만, 그것이 그리다 터지면
 * 이 파일이 없을 때 Next 의 영어 기본 화면이 선다. 같은 문구를 세우려고 둔다. 이 화면은 레이아웃을
 * **대신하므로** `<html>` · `<body>` 와 전역 스타일을 스스로 든다 — 머리 줄은 없다(그것이 터진 자리일 수 있다).
 */
export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <title>{SERVICE_NAME}</title>
        <ErrorScreen retry={retry} />
      </body>
    </html>
  );
}
