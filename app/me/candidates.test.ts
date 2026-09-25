import { describe, expect, it, vi } from 'vitest';

vi.mock('../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { photoUrlsOf, publicCardFromRow } from './candidates';

const summary = {
  glyphCount: 8,
  counts: { 木: 2, 火: 2, 土: 2, 金: 1, 水: 1 },
  ratios: { 木: 0.25, 火: 0.25, 土: 0.25, 金: 0.125, 水: 0.125 },
};

const row = {
  candidate_user_id: 'u-1',
  nickname: '하린',
  intro: '',
  has_photo: true,
  supplied_elements: [],
  balance_band: 'even',
  preview_score: 70,
};

/**
 * **카드의 사진 주소는 자리 번호다**(G-60) — `/me/photo/{id}/{n}`, 1 이 대표.
 *
 * 카드(G60-B)는 이 배열만 읽는다. 장 수를 어디서 세는지는 여기서 끝난다.
 */
describe('후보 카드의 사진 주소', () => {
  it('장 수만큼 1부터 센 주소가 선다', () => {
    expect(photoUrlsOf('u-1', 3)).toEqual(['/me/photo/u-1/1', '/me/photo/u-1/2', '/me/photo/u-1/3']);
  });

  it('사진이 없으면 빈 배열이다', () => {
    expect(photoUrlsOf('u-1', 0)).toEqual([]);
  });

  it('여섯 칸 밖의 수는 여섯에서 자른다', () => {
    expect(photoUrlsOf('u-1', 9)).toHaveLength(6);
  });

  it('목록의 `photo_count` 로 센다', () => {
    expect(publicCardFromRow({ ...row, photo_count: 2 }, summary).photoUrls)
      .toEqual(['/me/photo/u-1/1', '/me/photo/u-1/2']);
  });

  it('옛 DB 라 `photo_count` 가 없으면 `has_photo` 로 대표 한 장을 센다', () => {
    expect(publicCardFromRow(row, summary).photoUrls).toEqual(['/me/photo/u-1/1']);
    expect(publicCardFromRow({ ...row, has_photo: false }, summary).photoUrls).toEqual([]);
  });
});
