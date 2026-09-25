import { describe, expect, it } from 'vitest';

import { elementOf, photosOf, supplyOf, type DeckCard } from './deck-card';

const card = (patch: Partial<DeckCard> = {}): DeckCard => ({
  candidateUserId: 'u1',
  nickname: '하린',
  intro: null,
  hasPhoto: false,
  avatarElement: null,
  exploration: false,
  previewScore: 70,
  verdict: '',
  reason: '',
  balanceLabel: '',
  highlights: [],
  ...patch,
});

describe('photosOf — 카드의 사진 주소들', () => {
  it('목록이 오면 그 목록이 그대로다 — 첫 장이 대표다', () => {
    expect(photosOf(card({ photoUrls: ['/me/photo/u1/1', '/me/photo/u1/2'] }))).toEqual(['/me/photo/u1/1', '/me/photo/u1/2']);
  });

  it('목록이 없고 사진이 있으면 대표 주소 한 장이다', () => {
    expect(photosOf(card({ hasPhoto: true }))).toEqual(['/me/photo/u1']);
  });

  it('둘 다 없으면 비어 첫 글자가 선다', () => {
    expect(photosOf(card())).toEqual([]);
  });
});

describe('supplyOf · elementOf — 채워 주는 기운', () => {
  it('서버가 준 첫 기운이 카드의 색이다', () => {
    expect(supplyOf(card({ highlights: [{ element: '水', text: '' }, { element: '木', text: '' }] }))).toBe('水');
  });

  it('오행 다섯 밖의 이름이나 빈 목록은 모르는 기운이다', () => {
    expect(supplyOf(card({ highlights: [{ element: '물', text: '' }] }))).toBeNull();
    expect(supplyOf(card())).toBeNull();
    expect(elementOf(undefined)).toBeNull();
  });
});
