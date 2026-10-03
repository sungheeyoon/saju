import type { MetadataRoute } from 'next';

import { SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';

/**
 * **홈 화면에 올린 점점** — 폰의 「홈 화면에 추가」가 읽는 한 장.
 *
 * 없을 때는 홈 화면에 올려도 브라우저 탭 하나가 열렸다 — 주소창이 남고, 하단 독 아래에 브라우저 막대가 한 줄 더
 * 섰다. `standalone` 이면 주소창 없이 앱처럼 열리고, 뿌리 레이아웃의 `viewport-fit=cover` 와 안전 영역 여백이 그대로
 * 듣는다.
 *
 * 색은 `globals.css` 의 `--background`(밝은 화면) 값을 그대로 적는다 — 이 파일은 CSS 를 못 읽는다. 아이콘은
 * `app/icon.svg` 를 밝은 색으로 구운 것이다(`public/app/`). 시작 주소는 홈 탭(`/me`) — 홈 화면에서 여는 사람은 다시 오는
 * 사람이다. 로그인이 풀렸으면 관문(`proxy.ts`)이 로그인 화면으로 보내고, 거기 「사주로 돌아가기」가 첫 화면으로 간다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SERVICE_NAME} — ${SERVICE_TAGLINE}`,
    short_name: SERVICE_NAME,
    description: SERVICE_TAGLINE,
    lang: 'ko',
    start_url: '/me',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf6ef',
    theme_color: '#faf6ef',
    icons: [
      { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
