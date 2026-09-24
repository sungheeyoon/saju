import { describe, expect, it } from 'vitest';

import { coverFace, readingMinutes } from './essay';

/**
 * 에세이 보기의 셈 — **읽는 시간은 0분이 없고, 표지는 토큰으로만 칠한다.**
 */
describe('읽는 시간', () => {
  it('짧은 글도 1분이다', () => {
    expect(readingMinutes('## 지금의 핵심\n\n한 줄.')).toBe(1);
  });

  it('마크다운 기호와 공백은 세지 않는다', () => {
    const body = '가'.repeat(1500);
    expect(readingMinutes(`## 제목\n\n**${body}**\n\n- `)).toBe(readingMinutes(`제목${body}`));
    expect(readingMinutes(body)).toBe(3);
  });
});

describe('표지의 면', () => {
  it('한 사람은 제 오행의 파스텔 한 면이다', () => {
    expect(coverFace(['木'])).toEqual({ background: 'var(--wood-soft)', spine: 'var(--wood-mid)' });
  });

  it('못 읽은 사람은 회색이다 — 색을 지어 넣지 않는다', () => {
    expect(coverFace([null]).background).toBe('var(--none-soft)');
  });

  it('두 사람은 두 색이 비스듬히 만난다', () => {
    const face = coverFace(['火', null]);
    expect(face.background).toContain('var(--fire-soft) 0 52%');
    expect(face.background).toContain('var(--none-soft) 52% 100%');
  });
});
