import { supabaseInBrowser } from '../../auth/browser-client';
import type { SkippableRead } from '../../db-error';
import { readReadingCredits } from '../reading/credits';
import { outOfCredits } from './buy-path';
import { mySaleIsOpen } from './sale';

/**
 * **누를 때 브라우저에서 묻는 둘** — 풀이권 구매 길(`buy-credits.tsx`)과 인연 요청의 하트(`matching-experience.tsx`)가 쓴다.
 *
 * 화면을 그릴 때 묻지 않는다 — 머리글은 모든 화면에 서고, 누르는 사람은 드물다. 문은 서버와 같은 것이다(`sale.ts` · `credits.ts`).
 */

/** 이 계정에게 판매가 열렸나 — `my_reading_sale_is_open()` */
export function saleIsOpenNow(): Promise<SkippableRead<boolean>> {
  return mySaleIsOpen(supabaseInBrowser());
}

/** 지금 풀이권이 0개인가(`outOfCredits`) — 못 물었으면 `false` 다. 0개라고 하지 않고 DB 가 판정하게 둔다 */
export async function outOfCreditsNow(): Promise<boolean> {
  const credits = await readReadingCredits(supabaseInBrowser());
  return credits.ok && outOfCredits(credits.value);
}
