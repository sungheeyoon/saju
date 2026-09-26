import { describe, expect, it } from 'vitest';

import { STEMS, STEM_INFO } from '@/src/lib/saju';

import { elementScope } from './element-tone';
import { STEM_ELEMENT, STEM_PICTURE, StemSymbol } from './stem-symbol';

/*
  천간 그림의 표 둘은 엔진의 표를 브라우저 묶음으로 끌고 가지 않으려고 따로 적은 것이다(`stem-symbol.tsx`).
  베낀 표는 조용히 갈린다 — 그림의 색(오행)이 엔진과 다르면 얼굴 자리 · 궁합 칸 · 지도가 다른 오행을 입는다.
*/
describe('천간 그림', () => {
  it('그림의 오행은 엔진의 천간 오행과 같다', () => {
    expect(STEM_ELEMENT).toEqual(Object.fromEntries(STEMS.map((stem) => [stem, STEM_INFO[stem].element])));
  });

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
