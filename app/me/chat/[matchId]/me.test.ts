import { describe, expect, it } from 'vitest';

import { myRoomFaceOf } from './me';

describe('방에서 보는 내 모습', () => {
  it('자리 순서로 서고 주소에 판본이 붙는다 — 대표가 먼저다', () => {
    const face = myRoomFaceOf('u1', [
      { position: 2, version: 20, focus_x: 30, focus_y: 40 },
      { position: 1, version: 10, focus_x: 50, focus_y: 50 },
    ]);
    expect(face.photoUrls).toEqual(['/me/photo/u1/1?v=10', '/me/photo/u1/2?v=20']);
    expect(face.photoFocus).toEqual([
      { x: 50, y: 50 },
      { x: 30, y: 40 },
    ]);
  });

  it('사진이 없으면 빈 목록이다 — 시트는 첫 글자 동그라미로 선다', () => {
    expect(myRoomFaceOf('u1', [])).toEqual({ photoUrls: [], photoFocus: [] });
  });
});
