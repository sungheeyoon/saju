/**
 * 음력 ↔ 양력 변환 — 만세력 엔진 **앞**에 서는 경계.
 *
 * `computeSaju` 는 지금도 앞으로도 양력만 받는다(ADR 0002). 사용자가 아는 형식이
 * 음력이면 여기서 양력으로 바꾸고, 바뀐 값만 엔진으로 넘어간다. 그래서 이 모듈은
 * 절기도 간지도 모른다 — 아는 것은 날짜뿐이다.
 *
 * 변환은 계산이 아니라 **표를 읽는 일**이다. 표는 `scripts/generate-lunar-table.mjs`
 * 가 한국천문연구원 음력 운용지침대로 뽑아 커밋한 것이고, KASI 가 낸 표와 대조하는
 * 시험이 그 표의 근거다(`lunarTable.generated.test.ts`).
 */

import type { CivilDate } from '../civilTime';
import { LUNAR_TABLE_PROVENANCE, LUNAR_YEARS_RAW } from './lunarTable.generated';
import type { RawLunarYear } from './lunarTypes';

export { LUNAR_TABLE_PROVENANCE, NEAR_MIDNIGHT_DONGJI, NEAR_MIDNIGHT_NEW_MOONS } from './lunarTable.generated';
export type { LunarTableProvenance, NearMidnightDongji, NearMidnightNewMoon, RawLunarYear } from './lunarTypes';

/**
 * 사용자가 자기 생일을 아는 형식.
 *
 * 음력 평달과 윤달을 **한 값으로 합치지 않는다.** 「음력 1984년 10월 5일」은
 * 평달과 윤달 두 날이 실재하고(그 해는 윤10월이 있다) 서로 한 달 떨어져 있다.
 * 플래그로 두면 안 보내는 경로가 하나만 생겨도 조용히 평달로 떨어진다.
 *
 * DB 의 `person_chart_revision.calendar` 컬럼과 같은 낱말을 쓴다.
 */
export type Calendar = 'solar' | 'lunar' | 'lunar_leap';

export const CALENDARS: readonly Calendar[] = ['solar', 'lunar', 'lunar_leap'];

/**
 * 화면에 적는 말 — **`lunar` 는 그냥 「음력」이다.**
 *
 * 한동안 「음력 평달」이었다. 값이 셋인 이유(윤달은 앞 달과 같은 번호를 쓴다)를 이름에
 * 그대로 옮긴 것인데, 그러면 **음력으로 태어난 사람 대부분이 자기 것이 아닌 낱말을
 * 먼저 읽는다.** 「평달」은 윤달과 마주 세울 때만 쓰는 말이고, 사람이 아는 자기 생일은
 * 그냥 음력이다. 짝을 이루는 「음력 윤달」이 옆에 서 있으므로 무엇과 다른지는 그 자리에서
 * 이미 보인다.
 *
 * 값은 그대로 `'lunar'` 다. 바뀐 것은 **화면에 적는 글자**뿐이라 저장된 판본도 DB 의
 * 검사식도 움직이지 않는다.
 */
export const CALENDAR_KO: Record<Calendar, string> = {
  solar: '양력',
  lunar: '음력',
  lunar_leap: '음력 윤달',
};

export type LunarDate = {
  year: number;
  /** 1~12 — 윤달도 자기 앞 평달과 같은 번호를 쓴다 */
  month: number;
  /** 1~30 */
  day: number;
  /** 윤달인가 */
  leap: boolean;
};

/**
 * 변환할 수 있는 음력 연도 — 표가 덮는 범위 그대로다.
 *
 * 엔진의 `SUPPORTED_YEAR_RANGE`(1900~2100)보다 **좁다.** 표준시 이력과 절기는
 * 1900년까지 닿지만 음력은 1912년부터만 역서와 일치하기 때문이다(그 앞의
 * 여덟 건은 `validation/kasiCases.ts` 의 `KASI_PRE_1912_MISMATCHES`).
 * 두 범위를 하나로 합치면 어느 쪽이 자료의 한계인지 말할 수 없게 된다.
 */
export const LUNAR_SUPPORTED_YEAR_RANGE = {
  min: LUNAR_TABLE_PROVENANCE.firstYear,
  max: LUNAR_TABLE_PROVENANCE.lastYear,
} as const;

/**
 * 변환을 거부한 이유.
 *
 * 화면이 「변환할 수 없습니다」로 뭉개지 않게 이유를 값으로 가른다. 셋은 사용자가
 * 할 일이 서로 다르다 — 범위 밖은 포기해야 하고, 윤달 없음은 평달로 고쳐야 하고,
 * 없는 날은 날짜를 다시 봐야 한다.
 */
export type LunarRefusal =
  /** 표가 덮지 않는 해 */
  | 'out-of-range'
  /** 그 해에 그 윤달이 없다 */
  | 'no-such-leap-month'
  /** 그 달에 그 날이 없다 (29일까지인 달의 30일) */
  | 'no-such-day';

export class LunarConversionError extends Error {
  readonly reason: LunarRefusal;
  readonly value: unknown;

  constructor(reason: LunarRefusal, value: unknown, message: string) {
    super(message);
    this.name = 'LunarConversionError';
    this.reason = reason;
    this.value = value;
  }
}

const DAY_MS = 86_400_000;

/** 그레고리력 날짜를 1970-01-01 = 0 인 일련번호로 */
function dayNumberOf({ year, month, day }: CivilDate): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** 일련번호를 그레고리력 날짜로 — `dayNumberOf` 의 역함수 */
function civilDateOf(dayNumber: number): CivilDate {
  const at = new Date(dayNumber * DAY_MS);
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

function yearRecordOf(year: number) {
  const record = LUNAR_YEARS_RAW[year - LUNAR_SUPPORTED_YEAR_RANGE.min];
  if (!record) {
    throw new LunarConversionError(
      'out-of-range',
      year,
      `음력 ${LUNAR_SUPPORTED_YEAR_RANGE.min}~${LUNAR_SUPPORTED_YEAR_RANGE.max}년만 변환합니다: ${year}년`,
    );
  }
  return record;
}

/**
 * 한 해의 달들을 시간순으로 편다 — 표는 순서만 싣고 이름은 여기서 붙는다.
 *
 * `monthDays` 에 달 번호를 함께 싣지 않은 이유가 이것이다. 번호는 `leapMonth`
 * 하나에서 유도되므로 두 벌로 두면 어긋날 자리가 생긴다.
 */
function monthsOf(record: RawLunarYear): { month: number; leap: boolean; days: number }[] {
  const months: { month: number; leap: boolean; days: number }[] = [];

  let number = 1;
  record.monthDays.forEach((days, index) => {
    // 1월부터 `leapMonth` 월까지가 앞자리 `leapMonth` 개를 채우므로, 윤달은 그
    // 다음 자리에 온다. 윤달은 앞 달과 같은 번호를 쓰고 순번을 넘기지 않는다.
    const leap = record.leapMonth !== 0 && index === record.leapMonth;
    months.push({ month: leap ? record.leapMonth : number, leap, days });
    if (!leap) number += 1;
  });
  return months;
}

/** 음력 날짜를 양력으로. 없는 날이면 `LunarConversionError` 를 던진다. */
export function solarFromLunar(date: LunarDate): CivilDate {
  const record = yearRecordOf(date.year);
  const months = monthsOf(record);

  let offset = 0;
  for (const month of months) {
    if (month.month === date.month && month.leap === date.leap) {
      if (!Number.isInteger(date.day) || date.day < 1 || date.day > month.days) {
        throw new LunarConversionError(
          'no-such-day',
          date.day,
          `음력 ${date.year}년 ${date.leap ? '윤' : ''}${date.month}월은 ${month.days}일까지입니다: ${date.day}일`,
        );
      }
      return civilDateOf(dayNumberOf(parseIso(record.startSolar)) + offset + date.day - 1);
    }
    offset += month.days;
  }

  if (date.leap) {
    const actual = record.leapMonth;
    throw new LunarConversionError(
      'no-such-leap-month',
      date.month,
      actual === 0
        ? `음력 ${date.year}년에는 윤달이 없습니다`
        : `음력 ${date.year}년의 윤달은 윤${actual}월입니다: 윤${date.month}월`,
    );
  }

  throw new LunarConversionError('no-such-day', date.month, `음력 달이 아닙니다: ${date.month}월`);
}

/**
 * 양력 날짜를 음력으로 — 저장된 원본 형식을 되짚어 보여주는 쪽에서 쓴다.
 *
 * 표가 덮는 양력 구간은 음력 1912년 정월 초하루부터 음력 2100년 섣달 그믐까지이고,
 * 그 바깥은 거부한다. 양력 1912년 1월은 음력으로는 1911년이라 여기 들어오지 못한다.
 */
export function lunarFromSolar(date: CivilDate): LunarDate {
  const target = dayNumberOf(date);
  const first = dayNumberOf(parseIso(LUNAR_YEARS_RAW[0].startSolar));

  if (target < first) {
    throw new LunarConversionError(
      'out-of-range',
      date,
      `음력으로 읽을 수 있는 것은 ${LUNAR_YEARS_RAW[0].startSolar}부터입니다`,
    );
  }

  for (let year = LUNAR_SUPPORTED_YEAR_RANGE.min; year <= LUNAR_SUPPORTED_YEAR_RANGE.max; year += 1) {
    const record = LUNAR_YEARS_RAW[year - LUNAR_SUPPORTED_YEAR_RANGE.min];
    const start = dayNumberOf(parseIso(record.startSolar));
    const length = record.monthDays.reduce((sum, days) => sum + days, 0);
    if (target >= start + length) continue;

    let offset = start;
    for (const month of monthsOf(record)) {
      if (target < offset + month.days) {
        return { year, month: month.month, day: target - offset + 1, leap: month.leap };
      }
      offset += month.days;
    }
  }

  throw new LunarConversionError(
    'out-of-range',
    date,
    `음력 ${LUNAR_SUPPORTED_YEAR_RANGE.max}년 섣달까지만 읽습니다`,
  );
}

function parseIso(iso: string): CivilDate {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
  };
}
