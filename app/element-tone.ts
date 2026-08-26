import type { Element } from '@/src/lib/saju';

/**
 * 오행 하나가 화면에서 입는 색 한 벌.
 *
 * 토큰은 `app/globals.css` 가 든다(`--wood`·`--fire`…). 밝기·어두운 화면 두 벌이
 * 거기 있으므로 여기 서는 것은 **어느 자리에 어느 토큰이 오는가**뿐이다.
 *
 * 한 곳에 모아 둔 이유는 색이 화면마다 갈리지 않게 하기 위해서다. 히어로의 다섯
 * 원, 여덟 글자 칸, 오행 막대, 로그인한 사람의 명식 카드가 같은 木을 같은 초록으로
 * 칠해야 색이 뜻을 얻는다 — 화면마다 적으면 한 곳만 고쳐지고, 그때 색은 아무것도
 * 가리키지 않는 장식이 된다.
 *
 * **색은 정보를 혼자 지지 않는다.** 이 한 벌이 서는 자리에는 오행 이름이 늘 함께
 * 있다(`ELEMENT_KO`). 그래야 색을 못 가르는 사람에게 사라지는 것이 없고, 그것이
 * 전통색 대신 이 팔레트를 고른 조건이기도 하다(`app/saju-calculator.tsx` 머리말).
 */
export const ELEMENT_TONE: Record<
  Element,
  { readonly text: string; readonly surface: string; readonly border: string; readonly bar: string }
> = {
  木: { text: 'text-wood', surface: 'bg-wood-soft', border: 'border-wood/30', bar: 'bg-wood' },
  火: { text: 'text-fire', surface: 'bg-fire-soft', border: 'border-fire/30', bar: 'bg-fire' },
  土: { text: 'text-earth', surface: 'bg-earth-soft', border: 'border-earth/30', bar: 'bg-earth' },
  金: { text: 'text-metal', surface: 'bg-metal-soft', border: 'border-metal/30', bar: 'bg-metal' },
  水: { text: 'text-water', surface: 'bg-water-soft', border: 'border-water/30', bar: 'bg-water' },
};
