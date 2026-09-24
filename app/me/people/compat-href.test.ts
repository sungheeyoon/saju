import { describe, expect, it } from 'vitest';

import { compatHrefFor } from './compat-href';

const SELF = '11111111-1111-4111-8111-111111111111';
const MOM = '22222222-2222-4222-8222-222222222222';

describe('compatHrefFor', () => {
  it('내 사주가 있으면 나와 그 사람으로 두 칸이 찬다', () => {
    expect(compatHrefFor(SELF, MOM)).toBe(`/compat#a.person=${SELF}&b.person=${MOM}`);
  });

  it('내 사주가 없으면 그 사람만 첫 칸에 앉는다', () => {
    expect(compatHrefFor(null, MOM)).toBe(`/compat#a.person=${MOM}`);
  });

  it('그 사람이 나면 같은 사람을 두 칸에 앉히지 않는다', () => {
    expect(compatHrefFor(SELF, SELF)).toBe(`/compat#a.person=${SELF}`);
  });

  it('주소에는 person id 말고 아무것도 안 실린다', () => {
    const params = new URLSearchParams(compatHrefFor(SELF, MOM).split('#')[1]);
    expect([...params.keys()]).toEqual(['a.person', 'b.person']);
  });
});
