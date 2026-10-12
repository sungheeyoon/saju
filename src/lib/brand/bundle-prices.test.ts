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
 * 가격을 바꾸면 여기가 붉고, 그때 약관 · 환불정책의 개정(시행일 · 고지)을 함께 연다.
 */
describe('약관 · 환불정책의 묶음 숫자', () => {
  it('제12조 가격표가 끼우기 전 글자와 같다', () => {
    expect(bundlePriceRows()).toEqual([
      ['1회', '4,900원', '4,900원', '—'],
      ['3회', '12,900원', '4,300원', '12%'],
      ['5회', '19,900원', '3,980원', '18%'],
      ['20회', '59,000원', '2,950원', '39%'],
    ]);
    expect(tableRows(termsFor(INFO, 'https://x.example'), '제12조')).toEqual([
      ['묶음', '가격', '1회당', '1회권 대비 할인'],
      ...bundlePriceRows(),
    ]);
  });

  it('제12조의 실제 할인율 문장이 끼우기 전 글자와 같다', () => {
    expect(exactDiscounts()).toBe('12.2 · 18.8 · 39.8');
    expect(JSON.stringify(termsFor(INFO, 'https://x.example'))).toContain(
      '할인율은 1회권을 같은 횟수만큼 살 때와 견준 값을 정수로 내린 것입니다(실제 12.2 · 18.8 · 39.8%).',
    );
  });

  it('제16조 환불 예시가 끼우기 전 글자와 같다', () => {
    expect(tableRows(termsFor(INFO, 'https://x.example'), '제16조')).toEqual([
      ['경우', '돌려드리는 금액'],
      ['20회(59,000원)에서 3회 씀', '50,150원'],
      ['20회(59,000원)에서 12회 씀', '23,600원'],
      ['5회(19,900원)에서 1회 씀', '15,920원'],
      ['3회(12,900원)에서 1회 씀', '8,600원'],
      ['1회(4,900원)를 쓰지 않음', '4,900원'],
    ]);
  });

  it('환불정책 「얼마를 돌려받나요」 예시가 끼우기 전 글자와 같다', () => {
    expect(tableRows(refundPolicyFor(INFO), '얼마를 돌려받나요')).toEqual([
      ['이런 경우', '돌려드리는 돈'],
      ['20회권(59,000원)에서 3회 썼어요', '50,150원'],
      ['20회권(59,000원)에서 12회 썼어요', '23,600원'],
      ['5회권(19,900원)에서 1회 썼어요', '15,920원'],
      ['3회권(12,900원)에서 1회 썼어요', '8,600원'],
      ['1회권(4,900원)을 안 썼어요', '4,900원'],
    ]);
  });

  it('환불 금액은 낸 돈 × 안 쓴 횟수 ÷ 산 횟수에서 원 아래를 버린다', () => {
    expect(refundOf(3, 1)).toBe(8600);
    expect(refundOf(20, 20)).toBe(0);
    expect(refundOf(5, 0)).toBe(bundlePrice(5));
    expect(won(1234567)).toBe('1,234,567원');
  });
});
