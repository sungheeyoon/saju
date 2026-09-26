import { describe, expect, it } from 'vitest';

import { STEMS } from '@/src/lib/saju';

import { elementScope } from './element-tone';
import { STEM_PICTURE, StemSymbol } from './stem-symbol';

/* 천간 그림 — 그림 이름이 화면의 딱지이고(책장 · 글 머리), 모르는 글자는 빈 그림을 세우지 않는다 */
describe('천간 그림', () => {
  it('열 천간이 저마다 다른 그림 이름을 든다 — 이름이 곧 화면의 딱지다', () => {
    expect(Object.keys(STEM_PICTURE).toSorted()).toEqual([...STEMS].toSorted());
    expect(new Set(Object.values(STEM_PICTURE)).size).toBe(STEMS.length);
  });

  it('천간이 아닌 글자는 그리지 않는다 — 빈 그림 대신 아무것도 안 선다', () => {
    expect(StemSymbol({ stem: '子' })).toBeNull();
    expect(StemSymbol({ stem: '' })).toBeNull();
  });

  it('그림은 제 오행의 색 범위를 입고 보조기기에는 숨는다 — 뜻은 옆의 글이 말한다', () => {
    const drawn = StemSymbol({ stem: '丙' });
    expect(drawn?.props['aria-hidden']).toBe('true');
    expect(drawn?.props.className).toContain(elementScope('火'));
  });
});
