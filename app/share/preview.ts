import type { Metadata } from 'next';

import type { ShareKind } from './path';

/**
 * 공유본 세 화면의 **미리보기** — 상수로 둔다.
 *
 * `generateMetadata` 가 아니다. Next 는 동적으로 그려지는 화면의 메타데이터를 본문과
 * 따로 흘려보내고, 카카오톡 같은 수집기는 `<head>` 만 긁어 가므로 그것을 못 받는
 * 경우가 있다. 상수로 두면 첫 HTML 에 그대로 실린다(ADR 0063).
 *
 * 상수로 둘 수 있는 것은 **미리보기에 이 글의 내용을 안 싣기 때문**이다. 닉네임도
 * 풀이 문장도 출생 정보도 안 들어간다 — 대화창 목록에, 열어 보기도 전에 남의 사주풀이
 * 한 줄이 서는 일은 없어야 한다. 갈라지는 것은 **무엇이 열리는가**까지다.
 *
 * 가로세로를 손으로 적는 값이라 흐름 검사가 **파일에서 읽은 실제 크기와 견준다** —
 * 안 맞으면 수집기가 틀린 칸을 잡아 놓고 그림을 그린다.
 */
const PREVIEW: Record<ShareKind, { title: string; description: string; image: string; alt: string }> = {
  self: {
    title: '사주풀이가 도착했어요 | 만세력',
    description: '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
    image: '/brand/reading-share-v1.jpg',
    alt: '만세력 — 사주풀이가 도착했어요',
  },
  person: {
    title: '사주풀이가 도착했어요 | 만세력',
    description: '공유된 사주풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
    image: '/brand/saju-share-v1.jpg',
    alt: '만세력 — 나를 이루는 흐름을 읽다',
  },
  private: {
    title: '두 사람의 궁합이 도착했어요 | 만세력',
    description: '공유된 궁합 풀이를 읽고, 나를 이루는 흐름도 알아보세요.',
    image: '/brand/compat-share-v1.jpg',
    alt: '만세력 — 두 사람의 궁합이 도착했어요',
  },
};

/** 그림은 셋 다 같은 칸이다 — 수집기가 잡는 자리가 갈리면 미리보기 모양도 갈린다 */
const SHAPE = { width: 1200, height: 628, type: 'image/jpeg' } as const;

export function previewFor(kind: ShareKind): Metadata {
  const said = PREVIEW[kind];

  return {
    /* `metadataBase` 는 루트 레이아웃 한 곳에서 내려온다 */
    title: said.title,
    description: said.description,
    /** 공유본은 링크를 가진 사람의 것이지 검색으로 닿을 것이 아니다 */
    robots: { index: false, follow: false },
    openGraph: {
      type: 'article',
      siteName: '만세력',
      title: said.title,
      description: said.description,
      images: [{ url: said.image, alt: said.alt, ...SHAPE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: said.title,
      description: said.description,
      images: [said.image],
    },
  };
}
