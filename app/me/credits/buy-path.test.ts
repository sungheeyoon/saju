import { describe, expect, it } from 'vitest';

import { outOfCredits, saleShapeOf } from './buy-path';

describe('saleShapeOf', () => {
  it('판매가 닫힌 계정의 풀이권 창은 한 줄과 「확인」이다', () => {
    expect(saleShapeOf({ ok: true, value: false })).toBe('closed');
  });

  it('판매가 열린 계정의 풀이권 창은 「풀이권 구매」를 세운다', () => {
    expect(saleShapeOf({ ok: true, value: true })).toBe('open');
  });

  it('못 물었으면 열린 꼴이다 — 상품 화면이 다시 묻고 실패를 말한다', () => {
    expect(saleShapeOf({ ok: false, reason: '잠시 뒤 다시 시도해 주세요.' })).toBe('open');
  });
});

describe('outOfCredits', () => {
  it('남은 것도 만드는 중인 것도 없으면 0개다', () => {
    expect(outOfCredits({ available: 0, reserved: 0 })).toBe(true);
  });

  it('만드는 중이면 0개가 아니다 — 끝나기를 기다리는 자리다', () => {
    expect(outOfCredits({ available: 0, reserved: 1 })).toBe(false);
  });

  it('남은 것이 있으면 0개가 아니다', () => {
    expect(outOfCredits({ available: 2, reserved: 0 })).toBe(false);
  });

  it('못 물었으면 0개라고 하지 않는다', () => {
    expect(outOfCredits(null)).toBe(false);
  });
});
