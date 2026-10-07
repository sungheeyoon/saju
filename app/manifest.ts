import type { MetadataRoute } from 'next';

import { SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';

/**
 * 웹 앱 매니페스트 — **홈 화면에 추가한 앱이 웹 푸시를 받을 자격**이다(ADR 0156).
 *
 * iOS · iPadOS 는 16.4 부터, 매니페스트의 `display` 가 `standalone` · `fullscreen` 인 사이트를 홈 화면에 추가해 연
 * 때만 `PushManager` 를 낸다. 브라우저 탭으로 열면 푸시가 없다 — 설정 줄이 그 안내를 세운다.
 *
 * 아이콘은 이미 있는 둘이다 — 탭 그림(`app/icon.svg`, 크기 무관)과 홈 화면 그림(`app/apple-icon.png`, 180px).
 * 안드로이드의 설치 요건(192 · 512 PNG 또는 SVG)은 SVG 가 채운다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SERVICE_NAME,
    short_name: SERVICE_NAME,
    description: SERVICE_TAGLINE,
    id: '/',
    start_url: '/me',
    scope: '/',
    display: 'standalone',
    background_color: '#faf6ef',
    theme_color: '#faf6ef',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
