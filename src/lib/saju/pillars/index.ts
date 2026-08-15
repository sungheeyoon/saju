import type { Pillar, Stem } from '../constants';
import type { SolarTerm } from '../solarTerms';
import { KST_OFFSET_MINUTES, civilDayNumber, toCivil, type CivilDateTime } from '../civilTime';
import { dayPillarFromDayNumber } from './day';
import { hourBranchOf, hourPillarOf } from './hour';
import { findMonthTerm, monthPillarOf } from './month';
import { yearPillarOf } from './year';

export * from '../civilTime';
export * from './day';
export * from './hour';
export * from './month';
export * from './year';

/**
 * 자시(子時) 처리 규칙 — 23:00~24:00에 태어난 경우 일주가 어느 날인가.
 *
 * - `'jo'` 조자시(早子時)설: 일주 경계를 **23:00**으로 본다.
 *   23:30 출생이면 일주가 다음 날로 넘어가고 시지는 子.
 * - `'ya'` 야자시(夜子時)설: 일주 경계를 **자정(00:00)**으로 본다.
 *   23:30 출생이면 일주는 그날 그대로이고, 그날 일간 기준으로 子시를 뽑는다.
 *
 * 두 설은 23:00~24:00 출생에서만 갈리며, 그 한 시간에 대해 일주·시주가
 * 통째로 달라진다. 어느 쪽도 표준이 아니라 학파의 선택이므로 옵션으로 둔다.
 */
export type LateNightRule = 'jo' | 'ya';

/**
 * 이 프로젝트가 채택한 기본 정책 — 조자시.
 *
 * 검증으로 정할 수 있는 값이 아니다. 역법 자료(KASI 일진표 등)는 "그 날의
 * 간지"를 줄 뿐 "23시 출생자를 어느 날로 볼 것인가"에는 답하지 않는다.
 * 계산의 정오(正誤)가 아니라 명리학 학파의 채택 기준이므로 제품 결정으로 둔다.
 *
 * 바꿔도 파장은 23:00~24:00 출생에 갇힌다. 골든 스냅샷 31건 중 2건만 변한다.
 */
export const DEFAULT_LATE_NIGHT_RULE: LateNightRule = 'jo';

export type PillarOptions = {
  lateNightRule?: LateNightRule;
  /**
   * 달력 시각을 읽을 표준시 오프셋(분). 기본 한국 표준시 UTC+9.
   * 서머타임을 되돌릴 때는 표준시 오프셋을 넘긴다.
   */
  zoneOffsetMinutes?: number;
  /**
   * 시주·일주 판정 때 달력 시각에 더할 지방시 보정(분) — 경도·균시차.
   *
   * 절대 시각을 옮기지 않고 **읽는 시계만** 옮기는 것이 핵심이다.
   * 절기 판정은 보정되지 않은 `instant` 로 그대로 이뤄지므로, 경도 보정이
   * 절입 시각을 30분씩 밀어버리는 일이 없다.
   */
  solarTimeOffsetMinutes?: number;
  /**
   * 출생 시각을 아는가. `false` 면 시주를 뽑지 않는다.
   *
   * 이때 `instant` 는 정오를 대표값으로 만든 시각이어야 한다 — 일주가
   * 자시 경계에 걸리지 않는 자리이기 때문이다.
   */
  hourKnown?: boolean;
};

export type FourPillars = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  /**
   * 시주. **출생 시각을 모르면 `null`** 이다.
   *
   * 이름은 넷이지만 셋만 나올 수 있다. 모르는 시각을 정오로 메워 午시를
   * 내놓는 것보다, 없는 것을 없다고 말하는 편이 쓰는 쪽에서 안전하다.
   */
  hour: Pillar | null;
  /** 일간 — 사주에서 '나'에 해당한다 */
  dayMaster: Stem;
  meta: {
    /** 입춘으로 판정한 사주년 (달력연도와 다를 수 있다) */
    sajuYear: number;
    /** 월지를 결정한 절기와 그 구간의 끝 */
    monthTerm: SolarTerm;
    nextTerm: SolarTerm;
    /** 시주·일주 판정에 쓴 달력 시각 (지방시 보정 반영 후) */
    civilTime: CivilDateTime;
    /** 그 달력 시각에 반영된 지방시 보정(분) */
    solarTimeOffsetMinutes: number;
    lateNightRule: LateNightRule;
    /** 야자시 규칙 때문에 일주를 다음 날로 넘겼는지 */
    lateNightShiftApplied: boolean;
    /** 시각을 알고 계산했는가 — `false` 면 `hour` 가 `null` 이다 */
    hourKnown: boolean;
    /** 경계에 걸려 결과가 달라질 수 있는 지점 */
    warnings: string[];
  };
};

/** 절기 경계에 이만큼 가까우면 경고한다 — 시간 보정만으로도 월주가 뒤집히는 폭 */
const TERM_BOUNDARY_WARNING_MINUTES = 60;

/** 시지 경계에 이만큼 가까우면 경고한다 */
const HOUR_BOUNDARY_WARNING_MINUTES = 10;

const MINUTE_MS = 60_000;

function minutesBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / MINUTE_MS;
}

function collectWarnings(
  instant: Date,
  civil: CivilDateTime,
  monthTerm: SolarTerm,
  nextTerm: SolarTerm,
  lateNightRule: LateNightRule,
  hourKnown: boolean,
  /** `civil` 을 읽을 때 쓴 오프셋 — 절입 시각을 같은 시계로 읽어야 날짜가 맞다 */
  civilOffsetMinutes: number,
): string[] {
  const warnings: string[] = [];

  for (const term of [monthTerm, nextTerm]) {
    // 입춘만 연주까지 가른다. 다른 절기는 월주만 바뀐다.
    const affected = term.name === '입춘' ? '연주와 월주' : '월주';

    if (!hourKnown) {
      // 시각을 모르면 "몇 분 차이"를 말할 수 없다. 대신 절입일에 태어났는지만
      // 본다 — 그 날이라면 시각에 따라 월주가 통째로 갈린다.
      const sameDay =
        civilDayNumber(toCivil(term.date, civilOffsetMinutes)) === civilDayNumber(civil);
      if (sameDay) {
        warnings.push(
          `출생일이 ${term.name} 절입일입니다. 시각을 모르면 ${affected}를 확정할 수 없습니다.`,
        );
      }
      continue;
    }

    const gap = minutesBetween(instant, term.date);
    if (gap > TERM_BOUNDARY_WARNING_MINUTES) continue;

    const distance = gap < 1 ? '1분 미만' : `${Math.round(gap)}분`;

    warnings.push(
      `${term.name} 절입 시각과 ${distance} 차이입니다. 시간 보정 여부에 따라 ${affected}가 달라질 수 있습니다.`,
    );
  }

  if (!hourKnown) {
    warnings.push(
      '출생 시각을 몰라 시주를 뽑지 않았습니다. 오행 분포와 신강·신약도 여섯 글자만으로 판정한 값입니다.',
    );
    return warnings;
  }

  // 시지는 홀수 시각에 바뀐다 (23, 01, 03 …)
  const minutesIntoHourPair = ((civil.hour % 2) * 60 + civil.minute + 60) % 120;
  const toHourBoundary = Math.min(minutesIntoHourPair, 120 - minutesIntoHourPair);
  if (toHourBoundary <= HOUR_BOUNDARY_WARNING_MINUTES) {
    warnings.push(
      `시지 경계와 ${Math.round(toHourBoundary)}분 차이입니다. 시간 보정 여부에 따라 시주가 달라질 수 있습니다.`,
    );
  }

  if (civil.hour === 23) {
    warnings.push(
      `23시대 출생이라 조자시/야자시 선택에 따라 일주와 시주가 달라집니다. 현재 ${
        lateNightRule === 'jo' ? '조자시(일주 경계 23:00)' : '야자시(일주 경계 자정)'
      } 기준으로 계산했습니다.`,
    );
  }

  return warnings;
}

/**
 * 절대 시각으로부터 사주 4주를 도출한다.
 *
 * 보정값 계산은 이 함수의 책임이 아니다. `timeCorrection`이 산출한
 * `zoneOffsetMinutes`·`solarTimeOffsetMinutes`를 받아 쓰기만 한다.
 */
export function getFourPillars(instant: Date, options: PillarOptions = {}): FourPillars {
  const {
    lateNightRule = DEFAULT_LATE_NIGHT_RULE,
    zoneOffsetMinutes = KST_OFFSET_MINUTES,
    solarTimeOffsetMinutes = 0,
    hourKnown = true,
  } = options;

  // 시주·일주가 볼 시계 — 지방시 보정이 여기에만 반영된다.
  const civil = toCivil(instant, zoneOffsetMinutes + solarTimeOffsetMinutes);

  // 연·월: 절기 구간이 사주년과 월지를 함께 결정한다.
  // 절입 판정은 보정되지 않은 절대 시각으로 한다.
  const { term, sajuYear, nextTerm } = findMonthTerm(instant, civil.year);
  const year = yearPillarOf(sajuYear);
  const month = monthPillarOf(year.stem, term.branch);

  // 일: 조자시설에서는 23시부터 이미 다음 날이다.
  // 시각을 모를 때는 정오 기준이라 자시 경계에 닿지 않는다.
  const lateNightShiftApplied = hourKnown && lateNightRule === 'jo' && civil.hour >= 23;
  const day = dayPillarFromDayNumber(civilDayNumber(civil) + (lateNightShiftApplied ? 1 : 0));

  // 시: 시지는 시계 시각이, 시간(時干)은 위에서 확정된 일간이 정한다.
  const hour = hourKnown ? hourPillarOf(day.stem, hourBranchOf(civil.hour)) : null;

  return {
    year,
    month,
    day,
    hour,
    dayMaster: day.stem,
    meta: {
      sajuYear,
      monthTerm: term,
      nextTerm,
      civilTime: civil,
      solarTimeOffsetMinutes,
      lateNightRule,
      lateNightShiftApplied,
      hourKnown,
      warnings: collectWarnings(
        instant,
        civil,
        term,
        nextTerm,
        lateNightRule,
        hourKnown,
        zoneOffsetMinutes + solarTimeOffsetMinutes,
      ),
    },
  };
}

/** 시주가 비었을 때 자리를 지키는 표기 */
export const UNKNOWN_PILLAR_MARK = '시미상';

/**
 * 4주를 만세력 표기 순서인 **시주 일주 월주 년주**로 늘어놓는다.
 *
 * 세로쓰기를 오른쪽에서 왼쪽으로 읽던 관례가 남은 것이라, 년주가 아니라
 * 시주가 맨 앞에 온다. 시각을 모르면 첫 자리가 `시미상`이 된다.
 */
export function formatPillars(pillars: FourPillars): string {
  return [pillars.hour, pillars.day, pillars.month, pillars.year]
    .map((p) => p?.name ?? UNKNOWN_PILLAR_MARK)
    .join(' ');
}
