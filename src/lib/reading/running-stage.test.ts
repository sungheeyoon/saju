import { describe, expect, it } from 'vitest';

import { selfSectionTitlesOf } from './prompt';
import { SELF_SECTION_TITLES } from './running-stage';

describe('만드는 중 줄의 절 이름', () => {
  it('프롬프트가 시키는 절 이름과 같다', () => {
    expect(SELF_SECTION_TITLES).toEqual(selfSectionTitlesOf());
  });
});
