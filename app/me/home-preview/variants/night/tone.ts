import { Noto_Serif_KR } from 'next/font/google';

import type { Element } from '@/src/lib/saju';

/*
  **밤하늘 시안의 글꼴과 오행 색.**

  명식 글자와 제목은 명조(Noto Serif KR)로 세운다 — 한자는 굴림체보다 명조에서 획이 살고, 어두운 면에서 금빛
  그림자를 받아도 뭉개지지 않는다. 한글 글꼴이 무거우니 굵기는 둘(400 · 600)만 받는다. 한글 · 한자 조각은
  구간(unicode-range)으로 나뉘어 필요한 것만 내려오므로 미리 받기는 끈다. 본문은 그대로 Pretendard 다.

  오행 색은 `ELEMENT_TONE` 이 밝은 면 · 어두운 면 두 벌을 오가는 것과 달리 이 면의 한 벌(`night.module.css`)을 쓴다.
*/
export const serif = Noto_Serif_KR({
  weight: ['400', '600'],
  subsets: ['latin'],
  display: 'swap',
  preload: false,
});

export const NIGHT_TONE: Record<Element, { text: string; bar: string }> = {
  木: { text: 'text-[color:var(--n-wood)]', bar: 'bg-[var(--n-wood)]' },
  火: { text: 'text-[color:var(--n-fire)]', bar: 'bg-[var(--n-fire)]' },
  土: { text: 'text-[color:var(--n-earth)]', bar: 'bg-[var(--n-earth)]' },
  金: { text: 'text-[color:var(--n-metal)]', bar: 'bg-[var(--n-metal)]' },
  水: { text: 'text-[color:var(--n-water)]', bar: 'bg-[var(--n-water)]' },
};

/** 오행마다 SVG 가 칠할 색 — 선 그래프의 점 */
export const NIGHT_FILL: Record<Element, string> = {
  木: 'var(--n-wood)',
  火: 'var(--n-fire)',
  土: 'var(--n-earth)',
  金: 'var(--n-metal)',
  水: 'var(--n-water)',
};
