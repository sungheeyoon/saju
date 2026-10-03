import { describe, expect, it } from 'vitest';

import { CITY_LONGITUDES, type CityName } from '@/src/lib/saju';
import { calculateChart } from '@/src/lib/input/chart';
import { DEFAULT_QUERY, TIME_BASES, type Query } from '@/src/lib/input/query';

import { birthPreviewOf, hourSlotsOf, lateNightChoicesOf, slotOfTime } from './birth-hour';

const base: Query = { ...DEFAULT_QUERY, name: '민수', date: '1990-05-15', time: '14:30' };

/**
 * **시진을 고르면 그 시진의 시주가 선다** — 폼이 내보내는 시각을 엔진에 다시 넣어 본다.
 *
 * 칸의 범위는 출생지 · 날짜 · 시간 기준으로 옮긴 시계 시각이라, 옮기는 셈이 틀리면 「인시」를 골랐는데 묘시가 선다.
 * 서머타임이 있던 해(1988) · 표준자오선이 127.5° 이던 해(1958) · 균시차가 큰 철(2월 · 11월)을 다 지난다.
 */
describe('시진 칸의 시각은 그 시진의 시주를 세운다', () => {
  const dates = ['1990-05-15', '1988-06-01', '1958-02-11', '1975-11-03', '2001-12-31', '1954-07-20'];
  const cities = Object.keys(CITY_LONGITUDES) as CityName[];

  for (const date of dates) {
    for (const basis of TIME_BASES) {
      it(`${date} · ${basis}`, () => {
        for (const city of cities) {
          const query = { ...base, date, basis, city };
          const slots = hourSlotsOf(query);
          // 열두 시진이 다 선다 — 자정을 가로지르는 하나만 둘로 나뉜다
          expect(new Set(slots.map((slot) => slot.branch)).size).toBe(12);
          for (const slot of slots) {
            const chart = calculateChart({ ...query, time: slot.time });
            expect(chart.ok && chart.saju.pillars.hour?.branch, `${city} ${slot.key} ${slot.time}`).toBe(slot.branch);
          }
        }
      });
    }
  }

  it('서울 · 진태양시에서는 子시가 자정 앞뒤 두 칸이고, 칸은 시계 시각 차례다', () => {
    const slots = hourSlotsOf(base);
    expect(slots).toHaveLength(13);
    expect(slots[0]).toMatchObject({ branch: '子', part: 'afterMidnight', from: 0 });
    expect(slots.at(-1)).toMatchObject({ branch: '子', part: 'beforeMidnight', to: 24 * 60 });
    // 경도 −32분 · 5월 균시차 +3.7분 → 시계로는 28분쯤 늦게 바뀐다
    const yin = slots.find((slot) => slot.branch === '寅')!;
    expect(Math.round(yin.from)).toBe(3 * 60 + 28);
  });

  it('보정 없이 읽으면 시진은 정시에 바뀐다', () => {
    const slots = hourSlotsOf({ ...base, basis: 'record' });
    const yin = slots.find((slot) => slot.branch === '寅')!;
    expect(yin.from).toBe(3 * 60);
    expect(slotOfTime(slots, '04:59')?.branch).toBe('寅');
    expect(slotOfTime(slots, '05:00')?.branch).toBe('卯');
  });

  it('날짜가 덜 적혀도 칸은 선다 — 경도 보정만으로 가늠한다', () => {
    const slots = hourSlotsOf({ ...base, date: '' });
    expect(new Set(slots.map((slot) => slot.branch)).size).toBe(12);
  });
});

describe('자시 규칙은 일주가 갈릴 때만 묻는다', () => {
  it('자정 전 자시는 조자시와 야자시의 일주가 다르다', () => {
    const choices = lateNightChoicesOf({ ...base, time: '23:50' });
    expect(choices).not.toBeNull();
    expect(choices!.jo.day.name).not.toBe(choices!.ya.day.name);
  });

  it('자정을 넘은 자시와 낮 시각은 묻지 않는다', () => {
    expect(lateNightChoicesOf({ ...base, time: '00:50' })).toBeNull();
    expect(lateNightChoicesOf({ ...base, time: '14:30' })).toBeNull();
  });

  it('시각을 모르면 묻지 않는다', () => {
    expect(lateNightChoicesOf({ ...base, hourKnown: false, time: '' })).toBeNull();
  });
});

describe('미리보기는 결과와 같은 여덟 글자다', () => {
  it('계산과 같은 함수로 선다', () => {
    const preview = birthPreviewOf(base)!;
    const chart = calculateChart(base);
    expect(chart.ok && chart.saju.pillars.day.name).toBe(preview.saju.pillars.day.name);
    expect(preview.clock).toMatchObject({ written: '14:30', solar: '14:01', dayShift: null });
  });

  it('입춘 전이면 년주가 전해다', () => {
    expect(birthPreviewOf({ ...base, date: '1990-01-20' })!.beforeIpchun).toMatchObject({ sajuYear: 1989 });
    expect(birthPreviewOf(base)!.beforeIpchun).toBeNull();
  });

  it('보정으로 날짜가 넘어가면 그렇다고 적는다', () => {
    expect(birthPreviewOf({ ...base, time: '00:10' })!.clock?.dayShift).toBe('previous');
  });

  it('덜 찬 입력에는 서지 않는다', () => {
    expect(birthPreviewOf({ ...base, date: '' })).toBeNull();
    expect(birthPreviewOf({ ...base, time: '' })).toBeNull();
  });

  it('시각을 모르면 시주 없이 서고 시계 줄이 없다', () => {
    const preview = birthPreviewOf({ ...base, hourKnown: false, time: '' })!;
    expect(preview.saju.pillars.hour).toBeNull();
    expect(preview.clock).toBeNull();
  });
});
