import type { MetadataRoute } from 'next';

import { BRAND_PAPER, SERVICE_NAME, SERVICE_TAGLINE } from '@/src/lib/brand';

/**
 * **홈 화면에 얹은 「결」** — 폰에서 「홈 화면에 추가」를 누르면 이 이름 · 아이콘 · 바탕으로 선다(2026-10-03 브랜드 시안).
 *
 * 없던 동안은 브라우저가 문서 제목(`결 — 나와 사람의 결을 읽는 사주`)을 통째로 아이콘 이름으로 썼다. 짧은 이름은 한 글자
 * 이름 그대로다. 아이콘은 탭의 나이테(`app/icon.svg`) 하나다 — 그 파일이 밝은 · 어두운 화면을 제 안에서 가른다.
 * 서비스 워커 · 오프라인은 없다 — 이 파일은 이름과 얼굴만 정한다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SERVICE_NAME} — ${SERVICE_TAGLINE}`,
    short_name: SERVICE_NAME,
    description: SERVICE_TAGLINE,
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: BRAND_PAPER.light,
    theme_color: BRAND_PAPER.light,
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
