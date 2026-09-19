import { describe, expect, it } from 'vitest';

import { SEXAGENARY, type Pillars } from '@/src/lib/saju';

import { sharedPillarChartOf, storedPillarChart } from './shared-pillar';

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

/**
 * **저장돼 있던 여덟 글자를 화면 모양으로 받는 자리** (ADR 0071).
 *
 * 앞서는 이 값이 서버에서 두 판본을 읽어 **계산한** 것이라 타입이 이미 좁아져 있었다.
 * 이제 동의 때 베껴 둔 `jsonb` 한 덩이가 들어오므로, 화면으로 나가는 경계에서 한 번
 * 본다 — 백필이 아직 안 닿은 옛 Match 는 이 칸이 비어 있다.
 */
describe('저장된 여덟 글자를 받는다', () => {
  const stored = {
    year: { stem: '甲', branch: '子' },
    month: { stem: '乙', branch: '丑' },
    day: { stem: '丙', branch: '寅' },
    hour: { stem: '丁', branch: '卯' },
    dayMaster: '丙',
  };

  it('저장된 한 벌은 그대로 지나간다', () => {
    expect(storedPillarChart(stored)).toEqual(stored);
  });

  /** 시각 미상은 **없음**이다 — 정오로 메운 시주가 아니다 */
  it('시주가 없는 한 벌도 지나간다', () => {
    const hourless = { ...stored, hour: null };

    expect(storedPillarChart(hourless)).toEqual(hourless);
  });

  /**
   * **기본값으로 메우지 않는다.** 없는 여덟 글자를 지어 세우면 두 사람이 동의한 적 없는
   * 명식이 보드에 선다 — 그래서 빈 값은 `null` 이고, 부르는 쪽이 화면을 닫는다.
   */
  it.each([
    ['비어 있음', null],
    ['정의되지 않음', undefined],
    ['글자열', '甲子'],
    ['기둥이 빠짐', { ...stored, month: undefined }],
    ['기둥이 기둥이 아님', { ...stored, day: '丙寅' }],
    ['일간이 없음', { ...stored, dayMaster: undefined }],
    ['시주가 기둥도 null 도 아님', { ...stored, hour: '丁卯' }],
  ])('%s 은 null 이다', (_label, value) => {
    expect(storedPillarChart(value)).toBeNull();
  });
});
