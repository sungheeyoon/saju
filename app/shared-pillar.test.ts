import { describe, expect, it } from 'vitest';

import { SEXAGENARY, type Pillars } from '@/src/lib/saju';

import { sharedPillarChartOf } from './shared-pillar';

describe('공유하는 사주팔자', () => {
  it('여덟 글자만 복사하고 정확한 시각과 계산 메타는 내보내지 않는다', () => {
    const source = {
      year: SEXAGENARY[0],
      month: SEXAGENARY[1],
      day: SEXAGENARY[2],
      hour: SEXAGENARY[3],
      dayMaster: SEXAGENARY[2].stem,
      meta: {
        civilTime: '1990-05-15 13:27',
        birthplace: '서울',
      },
    } as unknown as Pillars;

    const shared = sharedPillarChartOf(source);

    expect(shared).toEqual({
      year: { stem: SEXAGENARY[0].stem, branch: SEXAGENARY[0].branch },
      month: { stem: SEXAGENARY[1].stem, branch: SEXAGENARY[1].branch },
      day: { stem: SEXAGENARY[2].stem, branch: SEXAGENARY[2].branch },
      hour: { stem: SEXAGENARY[3].stem, branch: SEXAGENARY[3].branch },
      dayMaster: SEXAGENARY[2].stem,
    });
    expect(JSON.stringify(shared)).not.toContain('1990-05-15');
    expect(JSON.stringify(shared)).not.toContain('서울');
    expect(shared).not.toHaveProperty('meta');
  });
});
