import { describe, expect, it } from 'vitest';

import { InvalidSajuInputError, computeSaju, type SajuInput } from '@/src/lib/saju';
import { SEXAGENARY, STEMS, STEM_INFO, pillarIndexOf } from '@/src/lib/saju/constants';
import {
  DAYS_PER_YEAR,
  YEARS_PER_DAEUN,
  computeDaeun,
  daeunAtAge,
  daeunDirectionOf,
  type Daeun,
} from '@/src/lib/saju/daeun';
import type { SolarTerm } from '@/src/lib/saju/solarTerms';
import { daysInMonth } from '@/src/lib/saju/input';

/**
 * 대운 테스트.
 *
 * 대운은 세 결정의 곱이라 어긋나는 방식도 세 가지다 — 방향이 뒤집히거나,
 * 대운수가 한 살 밀리거나, 출발점이 월주가 아니게 되거나. 셋을 따로 못박는다.
 */

const DAY_MS = 86_400_000;

const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  gender: 'male' | 'female',
): SajuInput => ({ year, month, day, hour, minute, second: 0, gender });

const daeunOf = (input: SajuInput): Daeun => {
  const daeun = computeSaju(input).daeun;
  if (!daeun) throw new Error('대운이 없다');
  return daeun;
};

describe('대운 방향 — 양남음녀 순행, 음남양녀 역행', () => {
  it('연간의 음양과 성별이 같은 편이면 순행이다', () => {
    for (const stem of STEMS) {
      const yang = STEM_INFO[stem].yinYang === '陽';

      expect(daeunDirectionOf(stem, 'male'), `${stem} 남자`).toBe(
        yang ? 'forward' : 'backward',
      );
      expect(daeunDirectionOf(stem, 'female'), `${stem} 여자`).toBe(
        yang ? 'backward' : 'forward',
      );
    }
  });

  it('같은 사주라도 성별로 방향이 갈린다', () => {
    // 1990-05-15 은 庚午년 — 연간 庚은 양간이다.
    const male = daeunOf(at(1990, 5, 15, 14, 30, 'male'));
    const female = daeunOf(at(1990, 5, 15, 14, 30, 'female'));

    expect(male.direction).toBe('forward');
    expect(female.direction).toBe('backward');
    expect(male.directionReason).toContain('양간');
    expect(male.directionReason).toContain('순행');
  });

  it('음간 해에는 반대가 된다', () => {
    // 2025 은 乙巳년 — 연간 乙은 음간이다.
    expect(daeunOf(at(2025, 6, 15, 12, 0, 'male')).direction).toBe('backward');
    expect(daeunOf(at(2025, 6, 15, 12, 0, 'female')).direction).toBe('forward');
  });

  it('사주년으로 판정한다 — 입춘 전 출생은 전년의 연간을 쓴다', () => {
    // 2025-02-03 23:10 이 입춘. 그 직전은 아직 甲辰년(甲=양간)이다.
    const before = computeSaju(at(2025, 2, 3, 12, 0, 'male'));
    const after = computeSaju(at(2025, 2, 5, 12, 0, 'male'));

    expect(before.pillars.year.stem).toBe('甲');
    expect(after.pillars.year.stem).toBe('乙');
    expect(before.daeun!.direction).toBe('forward'); // 양간 남자
    expect(after.daeun!.direction).toBe('backward'); // 음간 남자
  });
});

describe('대운수 — 절입까지의 거리 ÷ 3', () => {
  it('순행은 다음 절입까지, 역행은 직전 절입까지를 잰다', () => {
    const forward = daeunOf(at(1990, 5, 15, 14, 30, 'male'));
    const backward = daeunOf(at(1990, 5, 15, 14, 30, 'female'));

    expect(forward.boundaryTerm.name).toBe('망종'); // 다음 절입
    expect(backward.boundaryTerm.name).toBe('입하'); // 직전 절입

    // 두 거리를 합치면 그 절기 구간의 길이(약 30일)가 된다
    expect(forward.daysToBoundary + backward.daysToBoundary).toBeGreaterThan(29);
    expect(forward.daysToBoundary + backward.daysToBoundary).toBeLessThan(32);
  });

  it('거리를 3으로 나눈 값이 대운수다', () => {
    const daeun = daeunOf(at(1990, 5, 15, 14, 30, 'male'));

    expect(daeun.startAgeExact).toBeCloseTo(daeun.daysToBoundary / DAYS_PER_YEAR, 10);
    expect(daeun.startAge).toBe(Math.round(daeun.startAgeExact));
    expect(daeun.startAge).toBe(7); // 망종까지 21.7일 → 7.24년
  });

  it('반올림 방식을 고를 수 있다', () => {
    const input = at(1990, 5, 15, 14, 30, 'male');
    const rounded = computeSaju(input, { daeun: { rounding: 'round' } }).daeun!;
    const floored = computeSaju(input, { daeun: { rounding: 'floor' } }).daeun!;

    expect(rounded.startAge).toBe(7);
    expect(floored.startAge).toBe(7); // 7.24 라 둘이 같다

    // 소수부가 0.5를 넘는 날을 찾아 두 방식이 실제로 갈리는지 본다.
    // 날짜를 손으로 고르면 소수부가 어디에 떨어질지 알 수 없어 훑는다.
    const split = [...Array(31).keys()]
      .map((offset) => at(1990, 5, offset + 1, 14, 30, 'male'))
      .find((candidate) => {
        const exact = computeSaju(candidate).daeun.startAgeExact;
        return exact - Math.floor(exact) >= 0.5;
      });
    expect(split, '소수부 0.5 이상인 날이 한 달 안에 있어야 한다').toBeDefined();

    const a = computeSaju(split!, { daeun: { rounding: 'round' } }).daeun;
    const b = computeSaju(split!, { daeun: { rounding: 'floor' } }).daeun;
    expect(a.startAge).toBe(b.startAge + 1);
    expect(b.startAge).toBe(Math.floor(a.startAgeExact));
  });

  it('절입 직후 출생은 순행 대운수가 10에 가깝다', () => {
    // 2025 망종 = 06-05 18:56. 그 1분 뒤에 태어나면 다음 절입(소서)까지 한 달.
    const daeun = daeunOf(at(2025, 6, 5, 18, 57, 'female')); // 음간 여자 = 순행
    expect(daeun.direction).toBe('forward');
    expect(daeun.startAge).toBeGreaterThanOrEqual(10);

    // 반대로 절입 직전은 순행 대운수가 0에 가깝다
    const justBefore = daeunOf(at(2025, 6, 5, 18, 55, 'female'));
    expect(justBefore.boundaryTerm.name).toBe('망종');
    expect(justBefore.startAge).toBe(0);
  });

  it('시간 보정 옵션은 대운수를 흔들지 않는다', () => {
    // 대운수는 절대 시각으로 재므로, 시계를 어떻게 읽든 같아야 한다.
    const input = at(1988, 7, 15, 14, 0, 'male');
    const bases = [
      { useLongitude: false, useEquationOfTime: false },
      { useLongitude: true, useEquationOfTime: false },
      { useLongitude: true, useEquationOfTime: true },
    ];

    const values = bases.map((options) => computeSaju(input, options).daeun!);
    for (const daeun of values) {
      expect(daeun.daysToBoundary).toBeCloseTo(values[0].daysToBoundary, 10);
      expect(daeun.startAge).toBe(values[0].startAge);
      expect(daeun.entries[0].pillar.name).toBe(values[0].entries[0].pillar.name);
    }
  });

  it('시간 미상이면 근사임을 밝힌다', () => {
    const unknown = computeSaju({ year: 1990, month: 5, day: 15, hour: null, gender: 'male' });
    expect(unknown.daeun!.approximate).toBe(true);

    const known = computeSaju(at(1990, 5, 15, 12, 0, 'male'));
    expect(known.daeun!.approximate).toBe(false);

    // 정오로 계산하므로 실제 시각과 최대 반나절(≈0.17년) 차이다
    expect(
      Math.abs(unknown.daeun!.startAgeExact - known.daeun!.startAgeExact),
    ).toBeLessThan(0.5 / DAYS_PER_YEAR + 1e-9);
  });
});

describe('대운 간지 — 월주에서 한 칸씩', () => {
  it('첫 대운은 월주의 바로 다음(순행)·바로 앞(역행) 칸이다', () => {
    const saju = computeSaju(at(1990, 5, 15, 14, 30, 'male'));
    const monthIndex = saju.pillars.month.index;

    expect(saju.pillars.month.name).toBe('辛巳');
    expect(saju.daeun!.entries[0].pillar.index).toBe((monthIndex + 1) % 60);
    expect(saju.daeun!.entries[0].pillar.name).toBe('壬午');

    const backward = computeSaju(at(1990, 5, 15, 14, 30, 'female'));
    expect(backward.daeun!.entries[0].pillar.index).toBe((monthIndex - 1 + 60) % 60);
    expect(backward.daeun!.entries[0].pillar.name).toBe('庚辰');
  });

  it('한 칸이 10년을 맡고 나이가 끊기지 않는다', () => {
    const daeun = daeunOf(at(1990, 5, 15, 14, 30, 'male'));

    for (const [i, entry] of daeun.entries.entries()) {
      expect(entry.index).toBe(i + 1);
      expect(entry.startAge).toBe(daeun.startAge + i * YEARS_PER_DAEUN);
      expect(entry.endAge - entry.startAge).toBe(YEARS_PER_DAEUN - 1);
      expect(entry.startYear).toBe(1990 + entry.startAge);

      if (i > 0) {
        // 앞 대운이 끝난 바로 다음 해에 시작한다
        expect(entry.startAge).toBe(daeun.entries[i - 1].endAge + 1);
      }
    }
  });

  it('간지가 방향대로 한 칸씩 움직이고 60갑자로 성립한다', () => {
    for (const gender of ['male', 'female'] as const) {
      const daeun = daeunOf(at(1990, 5, 15, 14, 30, gender));
      const step = daeun.direction === 'forward' ? 1 : -1;

      for (const [i, entry] of daeun.entries.entries()) {
        expect(
          pillarIndexOf(entry.pillar.stem, entry.pillar.branch),
          `${gender} ${i}`,
        ).toBe(entry.pillar.index);

        if (i > 0) {
          const previous = daeun.entries[i - 1].pillar.index;
          expect(entry.pillar.index).toBe((previous + step + 60) % 60);
        }
      }
    }
  });

  it('개수를 고를 수 있다', () => {
    const input = at(1990, 5, 15, 14, 30, 'male');
    expect(computeSaju(input).daeun!.entries).toHaveLength(9);
    expect(computeSaju(input, { daeun: { count: 12 } }).daeun!.entries).toHaveLength(12);
  });

  it('나이로 대운을 찾는다', () => {
    const daeun = daeunOf(at(1990, 5, 15, 14, 30, 'male')); // 대운수 7

    expect(daeunAtAge(daeun, 6)).toBeNull(); // 첫 대운 전
    expect(daeunAtAge(daeun, 7)!.pillar.name).toBe('壬午');
    expect(daeunAtAge(daeun, 16)!.pillar.name).toBe('壬午');
    expect(daeunAtAge(daeun, 17)!.pillar.name).toBe('癸未');
    expect(daeunAtAge(daeun, 200)).toBeNull(); // 마지막 대운 밖
  });

  it('해를 반쯤 지난 나이도 대운 안에 있다', () => {
    // 만 16.5세는 7세 대운의 한가운데다. 구간을 endAge 로 닫으면 여기가
    // 어느 대운에도 속하지 않는 구멍이 된다.
    const daeun = daeunOf(at(1990, 5, 15, 14, 30, 'male'));

    expect(daeunAtAge(daeun, 7.1)!.pillar.name).toBe('壬午');
    expect(daeunAtAge(daeun, 16.5)!.pillar.name).toBe('壬午');
    expect(daeunAtAge(daeun, 16.999)!.pillar.name).toBe('壬午');
    expect(daeunAtAge(daeun, 17.0)!.pillar.name).toBe('癸未');
    expect(daeunAtAge(daeun, 6.9)).toBeNull();
  });

  it('60갑자 끝에서 되감는다', () => {
    // 월주가 甲子(0)면 역행 첫 대운은 癸亥(59)로 넘어가야 한다.
    // 실제 출생으로는 드물게 걸리는 자리라 직접 만들어 확인한다.
    const term = (name: string, iso: string): SolarTerm => ({
      name,
      longitude: 315,
      branch: '寅',
      date: new Date(iso),
    });

    const base = {
      monthTerm: term('입춘', '1904-02-05T00:00:00Z'),
      nextTerm: term('경칩', '1904-03-06T00:00:00Z'),
      instant: new Date('1904-02-20T00:00:00Z'),
      birthYear: 1904,
    };

    const backward = computeDaeun({
      ...base,
      yearStem: '甲', // 양간 + 여자 = 역행
      monthPillar: SEXAGENARY[0], // 甲子
      gender: 'female',
    });
    expect(backward.direction).toBe('backward');
    expect(backward.entries.map((entry) => entry.pillar.name).slice(0, 3)).toEqual([
      '癸亥',
      '壬戌',
      '辛酉',
    ]);

    const forward = computeDaeun({
      ...base,
      yearStem: '甲',
      monthPillar: SEXAGENARY[59], // 癸亥
      gender: 'male',
    });
    expect(forward.direction).toBe('forward');
    expect(forward.entries.map((entry) => entry.pillar.name).slice(0, 3)).toEqual([
      '甲子',
      '乙丑',
      '丙寅',
    ]);
  });

  it('자시 규칙은 대운을 흔들지 않는다', () => {
    // 조자시는 일주만 다음 날로 넘긴다. 대운은 연간·월주·절대 시각으로만
    // 정해지므로 그대로여야 한다.
    const input = at(2025, 6, 15, 23, 30, 'male');
    const jo = computeSaju(input, { lateNightRule: 'jo', useLongitude: false });
    const ya = computeSaju(input, { lateNightRule: 'ya', useLongitude: false });

    expect(jo.pillars.day.name).not.toBe(ya.pillars.day.name); // 일주는 갈린다
    expect(jo.daeun).toEqual(ya.daeun); // 대운은 같다
  });
});

describe('대운 — 외부 대조', () => {
  /**
   * 위키백과 '대운(사주팔자)' 문서의 예시 두 건.
   *
   * 규칙 설명이 아니라 **완성된 결과**를 대조하는 것이 목적이다. 방향·출발
   * 간지·대운수가 한꺼번에 맞아야 통과한다. 출생 시각이 적혀 있지 않아
   * 하루 안의 모든 시각에서 같은 답이 나오는지도 함께 본다.
   */
  it('1945-08-15 남자 — 을유년(음간) 남자라 역행, 갑신월 → 계미', () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      const saju = computeSaju(at(1945, 8, 15, hour, 0, 'male'));

      expect(saju.pillars.year.name, `${hour}시`).toBe('乙酉');
      expect(saju.pillars.month.name, `${hour}시`).toBe('甲申');
      expect(saju.daeun.direction, `${hour}시`).toBe('backward');
      expect(saju.daeun.entries[0].pillar.name, `${hour}시`).toBe('癸未');
    }
  });

  it('1950-06-25 남자 — 경인년(양간) 남자라 순행, 임오월 → 계미, 대운수 4', () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      const saju = computeSaju(at(1950, 6, 25, hour, 0, 'male'));

      expect(saju.pillars.year.name, `${hour}시`).toBe('庚寅');
      expect(saju.pillars.month.name, `${hour}시`).toBe('壬午');
      expect(saju.daeun.direction, `${hour}시`).toBe('forward');
      expect(saju.daeun.entries[0].pillar.name, `${hour}시`).toBe('癸未');
      // 출생 시각이 하루 안에서 달라져도 대운수는 4로 유지된다
      expect(saju.daeun.startAge, `${hour}시`).toBe(4);
    }
  });
});

describe('대운수 0 — 만 나이라 성립한다', () => {
  // 2025 망종 = 06-05 18:56:40. 그 직전 출생 + 순행이면 절입이 코앞이다.
  const justBeforeTerm = at(2025, 6, 5, 18, 55, 'female'); // 음간 여자 = 순행

  it('기본값은 0을 그대로 둔다', () => {
    const daeun = daeunOf(justBeforeTerm);
    expect(daeun.direction).toBe('forward');
    expect(daeun.startAge).toBe(0);
    expect(daeun.entries[0].startAge).toBe(0);
  });

  it('세는나이 표기에 맞추려면 1로 올릴 수 있다', () => {
    // "0이라는 나이는 없다"며 1로 적는 표가 흔하다. 그것은 0세가 없는
    // 세는나이의 관행이라 기본값으로 삼지 않았다.
    const raised = computeSaju(justBeforeTerm, {
      daeun: { zeroStartAge: 'raiseToOne' },
    }).daeun;

    expect(raised.startAge).toBe(1);
    expect(raised.entries[0].startAge).toBe(1);
    expect(raised.entries[1].startAge).toBe(11);
    // 정확한 값은 그대로 남는다
    expect(raised.startAgeExact).toBeCloseTo(daeunOf(justBeforeTerm).startAgeExact, 10);
  });

  it('0이 아닌 대운수는 올림 정책에 흔들리지 않는다', () => {
    const input = at(1990, 5, 15, 14, 30, 'male'); // 대운수 7
    expect(computeSaju(input, { daeun: { zeroStartAge: 'raiseToOne' } }).daeun.startAge).toBe(7);
  });
});

describe('대운 옵션 — 잘못된 값은 거부한다', () => {
  const input = at(1990, 5, 15, 14, 30, 'male');

  it('개수는 1 이상의 정수여야 한다', () => {
    // 0·음수를 넘기면 빈 표가 조용히 나오고, 소수는 반내림되어 사라진다.
    for (const count of [0, -3, 2.5, NaN, Infinity, '9']) {
      expect(
        () => computeSaju(input, { daeun: { count: count as number } }),
        String(count),
      ).toThrow(InvalidSajuInputError);
    }
    expect(computeSaju(input, { daeun: { count: 1 } }).daeun.entries).toHaveLength(1);
  });

  it('반올림·0 처리 방식의 오타를 거부한다', () => {
    expect(() =>
      computeSaju(input, { daeun: { rounding: 'ROUND' as never } }),
    ).toThrow(InvalidSajuInputError);
    expect(() =>
      computeSaju(input, { daeun: { zeroStartAge: 'raise' as never } }),
    ).toThrow(InvalidSajuInputError);
  });
});

describe('대운 — 성별은 필수다', () => {
  it('성별이 빠지면 계산 자체를 거부한다', () => {
    // 성별 없는 대운은 존재하지 않는다. null 을 돌려주는 대신 입구에서 막아
    // 계산·타입·화면 세 곳의 분기를 없앴다.
    const noGender = { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0 };
    expect(() => computeSaju(noGender as never)).toThrow(InvalidSajuInputError);
    expect(() => computeSaju({ ...noGender, gender: null } as never)).toThrow(
      InvalidSajuInputError,
    );
  });

  it('성별은 대운만 바꾸고 여덟 글자는 건드리지 않는다', () => {
    const male = computeSaju(at(1990, 5, 15, 14, 30, 'male'));
    const female = computeSaju(at(1990, 5, 15, 14, 30, 'female'));

    expect(male.pillars).toEqual(female.pillars);
    expect(male.analysis).toEqual(female.analysis);
    expect(male.daeun!.direction).not.toBe(female.daeun!.direction);
  });
});

describe('대운 — 무작위 500건 속성', () => {
  function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const random = mulberry32(20260815);
  const pick = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  it('언제나 방향·대운수·간지가 서로 맞는다', () => {
    for (let i = 0; i < 500; i += 1) {
      const year = pick(1900, 2090);
      const month = pick(1, 12);
      const gender = random() < 0.5 ? ('male' as const) : ('female' as const);
      const input = at(year, month, pick(1, daysInMonth(year, month)!), pick(0, 23), pick(0, 59), gender);

      const saju = computeSaju(input);
      const daeun = saju.daeun!;
      const label = `${year}-${month} ${gender}`;

      // 방향은 사주년 연간과 성별이 정한다
      expect(daeun.direction, label).toBe(daeunDirectionOf(saju.pillars.year.stem, gender));

      // 기준 절기는 방향에 따라 갈리고, 출생은 언제나 두 절입 사이에 있다
      const expectedTerm =
        daeun.direction === 'forward'
          ? saju.pillars.meta.nextTerm
          : saju.pillars.meta.monthTerm;
      expect(daeun.boundaryTerm.name, label).toBe(expectedTerm.name);

      // 절기 구간은 약 30일이므로 거리는 그 안에 든다
      expect(daeun.daysToBoundary, label).toBeGreaterThanOrEqual(0);
      expect(daeun.daysToBoundary, label).toBeLessThan(32);
      expect(daeun.startAge, label).toBeLessThanOrEqual(11);

      // 대운수는 거리에서 곧장 나온다
      expect(daeun.startAgeExact, label).toBeCloseTo(daeun.daysToBoundary / DAYS_PER_YEAR, 9);

      // 첫 대운은 월주에서 한 칸, 이후 방향대로 이어진다
      const step = daeun.direction === 'forward' ? 1 : -1;
      expect(daeun.entries[0].pillar.index, label).toBe(
        (saju.pillars.month.index + step + 60) % 60,
      );
      for (const entry of daeun.entries) {
        expect(pillarIndexOf(entry.pillar.stem, entry.pillar.branch), label).toBe(
          entry.pillar.index,
        );
      }

      // 기준 절기와 출생 사이에 다른 절입이 끼어들지 않는다
      const gapDays =
        Math.abs(daeun.boundaryTerm.date.getTime() - saju.meta.instant.getTime()) / DAY_MS;
      expect(gapDays, label).toBeCloseTo(daeun.daysToBoundary, 9);
    }
  });
});
