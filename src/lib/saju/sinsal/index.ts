import type { Pillars } from '../pillars';
import { findEmptiness, type Emptiness } from './emptiness';
import { findStars, type Star, type StarOptions } from './stars';
import { findTwelveSpirits, type SpiritChart } from './twelveSpirits';

export * from './emptiness';
export * from './stars';
export * from './twelveSpirits';

/**
 * 신살(神殺) 묶음 — 공망 · 12신살 · 핵심 신살 여덟.
 *
 * 셋을 한 자리에 모으는 이유는 만세력 화면에서 함께 읽히기 때문이다.
 * 계산은 서로 독립이고, 역마·도화·화개만 12신살에서 신살 쪽으로 흐른다.
 *
 * 12운성은 여기 넣지 않는다. 살(殺)이 아니라 천간의 왕쇠라 성질이 다르고,
 * 뽑는 축도 다르다(지지 기준이 아니라 천간 기준). `../stages` 를 쓴다.
 */

export type Sinsal = {
  /** 일주 기준과 년주 기준 — 순서 그대로 둘 다 나온다 */
  emptiness: Emptiness[];
  /** 년지 기준과 일지 기준 — 순서 그대로 둘 다 나온다 */
  twelveSpirits: SpiritChart[];
  /** 걸린 신살만. 하나도 없으면 빈 배열이다 */
  stars: Star[];
};

export type SinsalOptions = StarOptions;

type SinsalInput = Pick<Pillars, 'year' | 'month' | 'day' | 'hour' | 'dayMaster'>;

export function analyzeSinsal(pillars: SinsalInput, options: SinsalOptions = {}): Sinsal {
  return {
    emptiness: findEmptiness(pillars),
    twelveSpirits: findTwelveSpirits(pillars),
    stars: findStars(pillars, options),
  };
}
