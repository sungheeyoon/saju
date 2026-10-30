import type { SkippableRead } from '../../db-error';

/** 풀이권 상품 화면 — 풀이권 창의 「풀이권 구매」가 판매가 열린 계정을 보내는 자리 */
export const CREDITS_PATH = '/me/credits';

/**
 * **풀이권 창이 어느 꼴로 서나** — 판매가 이 계정에게 닫혔으면 한 줄과 「확인」, 아니면 「풀이권 구매」 · 「닫기」(ADR 0171 「덧」).
 *
 * 판정은 DB 의 `my_reading_sale_is_open()` 하나이고(`sale.ts`), 여기는 그 답을 갈래로 옮길 뿐이다. **못 물었으면 열린 꼴이다** —
 * 「풀이권 구매」가 보내는 상품 화면이 같은 문을 다시 묻고 제 실패 줄과 판매 준비 줄을 세운다. 닫힌 꼴을 세우면 판매가 열린 심사
 * 계정에게 「구매할 수 없어요」라는 거짓을 말하게 된다. 결제 단추는 어느 쪽이든 서버가 정하므로 열리는 것은 없다.
 */
export function saleShapeOf(sale: SkippableRead<boolean>): 'closed' | 'open' {
  return sale.ok && !sale.value ? 'closed' : 'open';
}

export { outOfCredits } from '@/src/lib/matching/requests';
