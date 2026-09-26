import type { ElementSummary } from '@/src/lib/discovery/element-axes';
import { ELEMENTS, STEM_INFO, type Element } from '@/src/lib/saju';

import { isStem } from '../../ui/stem-symbol';

/**
 * **지도의 가운데와 안쪽 궤도 — 나.** 「내 궤도로 다가오는 인연」(`orbit-map.tsx`)이 그리는 내 몫이다.
 *
 * 일간은 가운데 원의 글자와 색이고, 오행 다섯은 안쪽 궤도의 알이다. 알이 비는(점선) 문턱은 후보를 뽑는 셈과
 * 같게 **여덟 글자의 20% 미만**이다(`deficitComplementOneWay` 의 0.2) — 여기서 다른 문턱을 쓰면 지도는 「비었다」고
 * 그리는데 후보는 그 기운을 채운다는 말을 안 듣는, 그림과 글이 어긋난 화면이 된다.
 *
 * 일간을 못 읽으면(`stem: null`) 가운데는 「나」 한 글자로 선다 — 다섯 알은 요약에서 그대로 온다.
 */
export type MeMark = {
  readonly stem: string | null;
  readonly element: Element | null;
  readonly elements: readonly { readonly element: Element; readonly count: number; readonly low: boolean }[];
};

const LOW_RATIO = 0.2;

export function meMarkOf(stem: string | null, summary: Pick<ElementSummary, 'counts' | 'glyphCount'>): MeMark {
  const known = stem !== null && isStem(stem) ? stem : null;
  return {
    stem: known,
    element: known === null ? null : STEM_INFO[known].element,
    elements: ELEMENTS.map((element) => ({
      element,
      count: summary.counts[element],
      low: summary.glyphCount > 0 && summary.counts[element] / summary.glyphCount < LOW_RATIO,
    })),
  };
}
