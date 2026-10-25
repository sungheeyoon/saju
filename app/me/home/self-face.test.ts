import { describe, expect, it } from 'vitest';

import { NO_FACE, homeFaceOf } from './self-face';

describe('홈의 내 얼굴', () => {
  it('대표 사진(자리 1)의 보일 자리를 든다 — 줄의 차례가 섞여 와도', () => {
    expect(
      homeFaceOf([
        { position: 2, focus_x: 30, focus_y: 40 },
        { position: 1, focus_x: 50, focus_y: 20 },
      ]),
    ).toEqual({ hasPhoto: true, focus: { x: 50, y: 20 } });
  });

  it('사진이 없으면 사진 없는 나다 — 카드는 일간 그림을 원에 세운다', () => {
    expect(homeFaceOf([])).toEqual(NO_FACE);
  });
});
