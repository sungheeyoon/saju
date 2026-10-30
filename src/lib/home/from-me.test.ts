import { describe, expect, it } from 'vitest';

import { withFromMe } from './from-me';

describe('withFromMe', () => {
  it('결과 화면 셋의 주소에 from=me 를 붙인다', () => {
    expect(withFromMe('/me/readings/self')).toBe('/me/readings/self?from=me');
    expect(withFromMe('/me/readings/abc')).toBe('/me/readings/abc?from=me');
    expect(withFromMe('/me/match/m1')).toBe('/me/match/m1?from=me');
  });

  it('이미 물음표가 있는 주소는 & 로 잇는다', () => {
    expect(withFromMe('/me/compat?a=1&b=2')).toBe('/me/compat?a=1&b=2&from=me');
  });

  it('결과가 아닌 곳은 그대로 둔다', () => {
    expect(withFromMe('/compat#a.person=1&b.person=2')).toBe('/compat#a.person=1&b.person=2');
    expect(withFromMe('/me/people/p1')).toBe('/me/people/p1');
    expect(withFromMe('/me/readings')).toBe('/me/readings');
  });
});
