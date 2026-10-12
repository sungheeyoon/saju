import { describe, expect, it } from 'vitest';

import { type RawBusinessInfo, businessInfoFrom, businessInfoLines, contactPlace } from './business';
import type { LegalDocument } from './legal-text';
import { refundPolicyFor } from './refund';
import { termsFor } from './terms';

/** 시험용 값 — 실제 사업자 값이 아니다(저장소에 실제 값을 적지 않는다, ADR 0151) */
const FULL: RawBusinessInfo = {
  tradeName: '시험상호',
  representative: '시험대표',
  registrationNumber: '123-45-67890',
  address: '시험시 시험구 시험로 1',
  phone: '070-0000-1234',
  email: 'help@example.com',
  mailOrderNumber: '제2026-시험-0001호',
  hostingProvider: 'Vercel Inc.',
  disclosureUrl: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=1234567890',
};

/** 문서의 모든 글자 — 항 · 점 · 표 · 제목까지 */
const textsOf = (document: LegalDocument): string[] =>
  document.parts.flatMap((part) => [
    part.title ?? '',
    ...part.sections.flatMap((section) => [
      section.title,
      ...section.blocks.flatMap((block) => {
        if (block.kind === 'para') return [block.text];
        if (block.kind === 'bullets') return [...block.items];
        if (block.kind === 'table') return [...block.table.head, ...block.table.rows.flat()];
        return block.items.flatMap((item) => [
          item.text,
          ...(item.bullets ?? []),
          ...(item.table ? [...item.table.head, ...item.table.rows.flat()] : []),
          item.after ?? '',
        ]);
      }),
    ]),
  ]);

/** 초안의 빈칸 · 검토 표지 · 비어 새는 값 — 화면에 나가면 안 되는 꼴 */
const LEAK = /［|］|기입|변호사 검토|표준 제\d|운영자 결정|undefined|null/;

describe('사업자 정보 — 환경변수에서 고른다 (ADR 0172)', () => {
  it('비면 모든 줄이 null 이고 줄이 하나도 안 선다', () => {
    const info = businessInfoFrom({});
    expect(Object.values(info).every((value) => value === null)).toBe(true);
    expect(businessInfoLines(info)).toEqual([]);
  });

  it('공백은 걷고, 공백뿐인 값은 빈 값이다', () => {
    const info = businessInfoFrom({ tradeName: '  시험상호  ', representative: '   ' });
    expect(info.tradeName).toBe('시험상호');
    expect(info.representative).toBeNull();
  });

  it('자리표시와 꼴이 틀린 값은 빈 값으로 본다 — 화면에 거짓 표시를 내지 않는다', () => {
    const info = businessInfoFrom({
      representative: '홍길동',
      registrationNumber: '000-00-00000',
      address: '［상세 주소 — 기입］',
      phone: 'TODO',
      email: 'not-an-email',
      disclosureUrl: 'http://www.ftc.go.kr/',
      mailOrderNumber: '［통신판매업 신고 후 기입］',
    });
    expect(Object.values(info).every((value) => value === null)).toBe(true);
    expect(businessInfoFrom({ registrationNumber: '1234567890' }).registrationNumber).toBeNull();
  });

  it('값이 있는 줄만 정한 차례로 선다 — 공개 페이지 주소는 줄이 아니다', () => {
    expect(businessInfoLines(businessInfoFrom(FULL)).map((line) => line.label)).toEqual([
      '상호',
      '대표자',
      '사업자등록번호',
      '사업장 주소',
      '전화',
      '이메일',
      '통신판매업 신고번호',
      '호스팅서비스 제공자',
    ]);
    expect(businessInfoLines(businessInfoFrom({ phone: '070-0000-1234' }))).toEqual([
      { key: 'phone', label: '전화', value: '070-0000-1234' },
    ]);
  });

  it('알릴 곳 — 이메일, 없으면 전화를 가리키는 말, 둘 다 없으면 「이메일」', () => {
    expect(contactPlace(businessInfoFrom(FULL), '제3조의 연락처')).toBe('이메일(help@example.com)');
    expect(contactPlace(businessInfoFrom({ phone: '070-0000-1234' }), '제3조의 연락처')).toBe('제3조의 연락처');
    expect(contactPlace(businessInfoFrom({}), '제3조의 연락처')).toBe('이메일');
  });
});

const SITE = 'https://example.com';

describe.each([
  ['이용약관', (info: Parameters<typeof refundPolicyFor>[0]) => termsFor(info, SITE)],
  ['환불정책', refundPolicyFor],
] as const)('%s — 빈칸 표지를 화면에 내지 않는다', (_, build) => {
  it('값이 다 있으면 사업자 값이 글에 서고, 표지는 없다', () => {
    const texts = textsOf(build(businessInfoFrom(FULL)));
    expect(texts.filter((text) => LEAK.test(text))).toEqual([]);
    expect(texts.some((text) => text.includes('시험상호'))).toBe(true);
    expect(texts.some((text) => text.includes('help@example.com'))).toBe(true);
  });

  it('값이 하나도 없어도 표지 · 빈 값이 새지 않는다', () => {
    const texts = textsOf(build(businessInfoFrom({})));
    expect(texts.filter((text) => LEAK.test(text))).toEqual([]);
    expect(texts.some((text) => text.includes('시험상호'))).toBe(false);
  });
});

describe('사업자 정보 묶음의 자리', () => {
  it('약관 제3조는 값이 있는 줄만 든다', () => {
    const terms = termsFor(businessInfoFrom({ tradeName: '시험상호', phone: '070-0000-1234' }), SITE);
    const article3 = terms.parts[0].sections.find((section) => section.title.startsWith('제3조'));
    expect(article3?.blocks).toContainEqual({ kind: 'bullets', items: ['상호: 시험상호', '전화: 070-0000-1234'] });
  });

  it('환불정책의 판매자 정보는 값이 없으면 절째 안 선다', () => {
    const titles = (raw: RawBusinessInfo) =>
      refundPolicyFor(businessInfoFrom(raw)).parts.flatMap((part) => part.sections.map((section) => section.title));
    expect(titles({})).not.toContain('판매자 정보');
    expect(titles({ tradeName: '시험상호' })).toContain('판매자 정보');
  });
});
