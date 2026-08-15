import type { CivilDate, CivilDateTime } from './civilTime';

/**
 * 엔진 입력의 계약 — 무엇을 받고 무엇을 거부하는가.
 *
 * 계산 코어는 순수 함수라 아무 숫자나 받으면 아무 답이나 낸다. 2월 30일은
 * JavaScript `Date` 규칙대로 3월 2일로 조용히 흘러가고, 1899년은 표준시 표의
 * 첫 구간이 무한히 과거로 열려 있어 그럴듯한 사주가 나온다.
 *
 * 조용히 틀린 답보다 거부가 낫다. 그 경계를 여기 한 곳에 모은다.
 */

/**
 * 지원 연도 범위.
 *
 * 상한과 하한 모두 자료의 한계다. 표준시 이력표(`zoneHistory.generated.ts`)가
 * IANA tz 데이터의 1900~2100 구간에서 생성되었고, 절기 계산이 쓰는
 * astronomy-engine 도 이 바깥에서는 정밀도를 보장하지 않는다.
 */
export const SUPPORTED_YEAR_RANGE = { min: 1900, max: 2100 } as const;

/**
 * 시각을 모르는 출생 입력 — `hour: null`.
 *
 * 관례대로 정오를 넣어 계산하면 시주가 午시로 **나와 버린다**. 모르는 값을
 * 아는 값처럼 보여주는 셈이라, 아예 시주를 뽑지 않는 경로를 따로 둔다.
 */
export type UnknownHourInput = CivilDate & {
  hour: null;
  minute?: undefined;
  second?: undefined;
};

/**
 * 성별 — **필수 입력**이다.
 *
 * 여덟 글자는 성별로 달라지지 않지만 대운(大運)은 달라진다. 연간의 음양과
 * 성별을 함께 봐서 순행·역행을 정하기 때문이다(양남음녀 순행, 음남양녀 역행).
 *
 * 없어도 되게 열어두면 "성별을 모를 때의 대운"이라는 분기가 계산·타입·화면
 * 세 곳에 생긴다. 그런 대운은 존재하지 않으므로 입구에서 요구하고, 대신
 * 결과에서는 `daeun` 이 항상 나온다.
 */
export type Gender = 'male' | 'female';

export const GENDERS: readonly Gender[] = ['female', 'male'];

export const GENDER_KO: Record<Gender, string> = {
  female: '여자',
  male: '남자',
};

/**
 * `computeSaju` 의 입력 — 출생 기록 한 건.
 *
 * `hour: null` 이면 시간 미상이다. `gender` 는 대운에 필요하므로 필수다.
 */
export type SajuInput = (CivilDateTime | UnknownHourInput) & {
  gender: Gender;
};

export type SajuInputField =
  | 'input'
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'gender'
  | 'longitude'
  | 'daeun';

const FIELD_KO: Record<SajuInputField, string> = {
  input: '생년월일시',
  year: '연도',
  month: '월',
  day: '일',
  hour: '시',
  minute: '분',
  second: '초',
  gender: '성별',
  longitude: '경도',
  daeun: '대운 옵션',
};

/**
 * 계산을 시작하기 전에 거부한 입력.
 *
 * `InvalidLocalTimeError`(서머타임 전환의 모호·부재 시각)와는 층이 다르다.
 * 저쪽은 실재하는 시계를 어떻게 해석할지의 문제고, 이쪽은 애초에 존재하지
 * 않는 날짜·시각이다.
 */
export class InvalidSajuInputError extends Error {
  readonly field: SajuInputField;
  readonly value: unknown;

  constructor(field: SajuInputField, value: unknown, reason: string) {
    super(`${FIELD_KO[field]} 입력이 올바르지 않습니다 — ${reason}`);
    this.name = 'InvalidSajuInputError';
    this.field = field;
    this.value = value;
  }
}

/** 그레고리력 윤년 — 지원 범위 안에서는 율리우스력을 고려하지 않는다. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 그 해 그 달의 마지막 날. 월이 1~12 밖이면 `null`. */
export function daysInMonth(year: number, month: number): number | null {
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (month === 2 && isLeapYear(year)) return 29;
  return MONTH_DAYS[month - 1];
}

function assertInteger(field: SajuInputField, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidSajuInputError(field, value, `숫자가 아닙니다: ${String(value)}`);
  }
  if (!Number.isInteger(value)) {
    throw new InvalidSajuInputError(field, value, `정수가 아닙니다: ${value}`);
  }
}

function assertRange(
  field: SajuInputField,
  value: number,
  min: number,
  max: number,
): void {
  if (value < min || value > max) {
    throw new InvalidSajuInputError(field, value, `${min}~${max} 범위를 벗어났습니다: ${value}`);
  }
}

/**
 * 입력을 검증한다. 통과하지 못하면 `InvalidSajuInputError` 를 던진다.
 *
 * 검사 순서는 큰 단위부터다 — 연도가 틀렸는데 "2월 30일" 을 먼저 지적하면
 * 사용자가 고칠 곳을 두 번 찾는다.
 */
export function assertValidSajuInput(input: SajuInput): void {
  // 객체가 아니면 필드를 읽는 순간 TypeError 가 난다. 그 전에 우리 말로 거부한다.
  if (typeof input !== 'object' || input === null) {
    throw new InvalidSajuInputError('input', input, `객체가 아닙니다: ${String(input)}`);
  }

  // 성별 없이는 대운의 방향을 정할 수 없다. 'M'·'남' 같은 표기를 받아 주면
  // 조용히 무시되고 방향이 뒤집히므로, 정확히 두 값만 받는다.
  if (!GENDERS.includes(input.gender)) {
    throw new InvalidSajuInputError(
      'gender',
      input.gender,
      `'female' 또는 'male' 이어야 합니다: ${String(input.gender)}`,
    );
  }

  assertInteger('year', input.year);
  assertRange('year', input.year, SUPPORTED_YEAR_RANGE.min, SUPPORTED_YEAR_RANGE.max);

  assertInteger('month', input.month);
  assertRange('month', input.month, 1, 12);

  assertInteger('day', input.day);
  const lastDay = daysInMonth(input.year, input.month) as number;
  if (input.day < 1 || input.day > lastDay) {
    throw new InvalidSajuInputError(
      'day',
      input.day,
      `${input.year}년 ${input.month}월은 ${lastDay}일까지입니다: ${input.day}`,
    );
  }

  if (input.hour === null) {
    // 시간 미상인데 분·초가 딸려 오면 둘 중 하나가 거짓말이다. 조용히 버리면
    // "14시 30분인데 시간을 모른다"는 입력이 통과한다. 타입만 믿을 수 없는
    // 이유는 JSON·`as any` 로 들어오는 값에는 타입이 없기 때문이다.
    for (const field of ['minute', 'second'] as const) {
      if (input[field] !== undefined) {
        throw new InvalidSajuInputError(
          field,
          input[field],
          `시간 미상(hour: null)에는 함께 넘길 수 없습니다: ${String(input[field])}`,
        );
      }
    }
    return;
  }

  assertInteger('hour', input.hour);
  assertRange('hour', input.hour, 0, 23);

  assertInteger('minute', input.minute);
  assertRange('minute', input.minute, 0, 59);

  assertInteger('second', input.second);
  assertRange('second', input.second, 0, 59);
}

/**
 * 출생지 경도를 검증한다. 동경이 양수, 서경이 음수다.
 *
 * 범위를 열어두면 조용히 틀린다. 경도 보정은 표준자오선과의 차이를 그대로
 * 시간으로 환산하므로(1° = 4분), 999° 같은 값이 들어오면 달력 시각이 이틀치
 * 밀려 **일주까지** 바뀐 사주가 아무 경고 없이 나온다.
 *
 * 정수를 요구하지 않는 것은 경도가 애초에 소수이기 때문이다(서울 126.98°).
 */
export function assertValidLongitude(longitude: number): void {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) {
    throw new InvalidSajuInputError(
      'longitude',
      longitude,
      `숫자가 아닙니다: ${String(longitude)}`,
    );
  }
  if (longitude < -180 || longitude > 180) {
    throw new InvalidSajuInputError(
      'longitude',
      longitude,
      `-180~180 범위를 벗어났습니다: ${longitude}`,
    );
  }
}

/** 시간 미상일 때 계산 기준으로 삼는 시각 — 하루의 한가운데 */
export const UNKNOWN_HOUR_PROXY = { hour: 12, minute: 0, second: 0 } as const;

export type NormalizedInput = {
  /** 검증을 통과한 계산 기준 시각. 시간 미상이면 정오로 채워진다 */
  civil: CivilDateTime;
  /** 시각을 알고 입력했는가 — `false` 면 시주를 뽑지 않는다 */
  hourKnown: boolean;
  /** 입력받은 성별 */
  gender: Gender;
};

/**
 * 입력을 검증하고 계산이 쓸 형태로 편다.
 *
 * 시간 미상이면 정오를 채우되 `hourKnown: false` 를 함께 넘긴다. 정오는
 * 일주가 자시 경계에 걸리지 않는 안전한 대표값일 뿐, 시주를 뽑는 근거가
 * 아니다. 그 구분을 잃으면 "모름"이 "낮 12시"로 둔갑한다.
 */
export function normalizeSajuInput(input: SajuInput): NormalizedInput {
  assertValidSajuInput(input);

  const { gender } = input;

  if (input.hour === null) {
    const { year, month, day } = input;
    return {
      civil: { year, month, day, ...UNKNOWN_HOUR_PROXY },
      hourKnown: false,
      gender,
    };
  }

  const { year, month, day, hour, minute, second } = input;
  return { civil: { year, month, day, hour, minute, second }, hourKnown: true, gender };
}
