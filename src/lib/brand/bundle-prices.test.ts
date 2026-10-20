import { describe, expect, it } from 'vitest';

import { bundlePrice, bundlePriceRows, exactDiscounts, refundOf, won } from './bundle-prices';
import { businessInfoFrom } from './business';
import type { LegalDocument, LegalTable } from './legal-text';
import { refundPolicyFor } from './refund';
import { termsFor } from './terms';

/** 제목이 `title` 로 시작하는 절의 표 하나 — 머리 줄부터 */
const tableRows = (doc: LegalDocument, title: string): string[][] => {
  const section = doc.parts.flatMap((part) => part.sections).find((one) => one.title.startsWith(title));
  const tables: LegalTable[] = (section?.blocks ?? []).flatMap((block) =>
    block.kind === 'table' ? [block.table] : block.kind === 'numbered' ? block.items.flatMap((item) => (item.table ? [item.table] : [])) : [],
  );
  expect(tables).toHaveLength(1);
  return [tables[0].head, ...tables[0].rows].map((row) => [...row]);
};

const INFO = businessInfoFrom({});

/**
 * 약관 · 환불정책의 숫자는 `READING_BUNDLES` 에서 끼운다(ADR 0176). 아래 기대값은 끼우기 전에 글에 적혀 있던 글자 그대로다 —
 * 가격을 바꾸면 여기가 붉고, 그때 약관 · 환불정책의 개정(시행일 · 고지)을 함께 연다. 단위만 「회」에서 「장」으로 고친 것(2026-10-12)은
 * 시행 전 게시본의 표기 정정이라 고지 없이 기대값도 함께 고쳤다(ADR 0176 「덧」).
 */
describe('약관 · 환불정책의 묶음 숫자', () => {
  it('제12조 가격표가 끼우기 전 글자와 같다', () => {
    expect(bundlePriceRows()).toEqual([
      ['1장', '4,900원', '4,900원', '—'],
      ['3장', '12,900원', '4,300원', '12%'],
      ['5장', '19,900원', '3,980원', '18%'],
      ['20장', '59,000원', '2,950원', '39%'],
    ]);
    expect(tableRows(termsFor(INFO, 'https://x.example'), '제12조')).toEqual([
      ['묶음', '가격', '1장당', '1장 대비 할인'],
      ...bundlePriceRows(),
    ]);
  });

  it('제12조의 실제 할인율 문장이 끼우기 전 글자와 같다', () => {
    expect(exactDiscounts()).toBe('12.2 · 18.8 · 39.8');
    expect(JSON.stringify(termsFor(INFO, 'https://x.example'))).toContain(
      '할인율은 1장 묶음을 같은 장수만큼 살 때와 견준 값을 정수로 내린 것입니다(실제 12.2 · 18.8 · 39.8%).',
    );
  });

  it('제16조 환불 예시가 청약철회 기간 내 · 기간 경과 후 단순 변심 두 칸이다 (ADR 0192)', () => {
    expect(tableRows(termsFor(INFO, 'https://x.example'), '제16조')).toEqual([
      ['경우', '청약철회 기간 내', '기간 경과 후 단순 변심'],
      ['20장(59,000원)에서 3장 씀', '50,150원', '45,135원'],
      ['20장(59,000원)에서 12장 씀', '23,600원', '21,240원'],
      ['5장(19,900원)에서 1장 씀', '15,920원', '14,328원'],
      ['3장(12,900원)에서 1장 씀', '8,600원', '7,740원'],
      ['1장(4,900원)을 쓰지 않음', '4,900원', '4,410원'],
    ]);
  });

  it('환불정책 「얼마를 돌려받나요」 예시가 청약철회 기간 내 · 기간 경과 후 단순 변심 두 칸이다 (ADR 0192)', () => {
    expect(tableRows(refundPolicyFor(INFO), '얼마를 돌려받나요')).toEqual([
      ['이런 경우', '청약철회 기간 내', '기간 경과 후 단순 변심'],
      ['20장 묶음(59,000원)에서 3장 썼어요', '50,150원', '45,135원'],
      ['20장 묶음(59,000원)에서 12장 썼어요', '23,600원', '21,240원'],
      ['5장 묶음(19,900원)에서 1장 썼어요', '15,920원', '14,328원'],
      ['3장 묶음(12,900원)에서 1장 썼어요', '8,600원', '7,740원'],
      ['1장 묶음(4,900원)을 안 썼어요', '4,900원', '4,410원'],
    ]);
  });

  it('환불 금액은 낸 돈 × 안 쓴 장수 ÷ 산 장수에서 원 아래를 버리고, 7일이 지났으면 10% 를 뺀다', () => {
    expect(refundOf(3, 1, false)).toBe(8600);
    expect(refundOf(3, 1, true)).toBe(7740);
    expect(refundOf(20, 20, false)).toBe(0);
    expect(refundOf(20, 20, true)).toBe(0);
    expect(refundOf(5, 0, false)).toBe(bundlePrice(5));
    expect([3, 10, 15].map((used) => [refundOf(20, used, false), refundOf(20, used, true)])).toEqual([
      [50150, 45135],
      [29500, 26550],
      [14750, 13275],
    ]);
    expect(won(1234567)).toBe('1,234,567원');
  });
});
