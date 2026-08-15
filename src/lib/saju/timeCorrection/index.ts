import type { CivilDateTime } from '../civilTime';
import { assertValidLongitude } from '../input';
import { equationOfTimeMinutes } from './equationOfTime';
import { DEFAULT_LONGITUDE, longitudeCorrectionMinutes, standardMeridian } from './longitude';
import { resolveWallClock, type ZoneInterval } from './zoneHistory';

export * from './equationOfTime';
export * from './longitude';
export * from './zoneHistory';
export type { RawZoneInterval } from './zoneTypes';

/**
 * 시간 보정 — 입력한 벽시계 시각을 사주 계산이 쓸 두 값으로 바꾼다.
 *
 * 두 값이 필요한 이유는 사주가 **서로 다른 두 시계**를 쓰기 때문이다.
 * - 절기(연주·월주)는 태양 황경 도달이라는 천문 사건이므로 **절대 시각**으로 본다.
 *   경도 보정을 여기에 섞으면 절입 판정이 30분씩 어긋난다.
 * - 시주·일주는 그 자리의 태양 높이가 정하므로 **보정된 지방시**로 본다.
 *
 * 그래서 절대 시각은 건드리지 않고, 지방시 보정은 "달력 시각을 읽을 때 더할
 * 오프셋"으로 표현한다.
 */

export type CorrectionKind =
  | 'standardMeridian'
  | 'dst'
  | 'longitude'
  | 'equationOfTime';

export type Correction = {
  kind: CorrectionKind;
  /** 시주·일주 판정 시각에 미친 영향(분). 0이면 문맥 정보만 담은 항목 */
  minutes: number;
  label: string;
  detail: string;
};

/**
 * 서머타임 전환으로 벽시계가 실제 시각과 1:1 대응하지 않을 때의 정책.
 *
 * - `'resolve'` — 해석하고 경고를 남긴다. 부재 시각은 전환 직후 오프셋으로 밀고,
 *   모호 시각은 앞선 쪽(서머타임이 살아 있던 해석)을 택한다.
 * - `'throw'` — `InvalidLocalTimeError`를 던진다. 입력을 되묻고 싶을 때 쓴다.
 *
 * 기본값이 `'resolve'`인 이유: 출생 기록의 시각이 실제로 존재하지 않더라도
 * 그 사람은 태어났다. 계산을 거부하는 것보다 해석 근거를 밝히는 편이 낫다.
 * 다만 정확한 시각 변환기로 쓸 때는 `'throw'`가 맞다.
 */
export type DstTransitionPolicy = 'resolve' | 'throw';

export class InvalidLocalTimeError extends Error {
  readonly kind: 'nonexistent' | 'ambiguous';

  constructor(kind: 'nonexistent' | 'ambiguous', civil: CivilDateTime) {
    const when = `${civil.year}-${String(civil.month).padStart(2, '0')}-${String(civil.day).padStart(2, '0')} ${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}`;
    super(
      kind === 'nonexistent'
        ? `${when} KST는 서머타임 전환으로 존재하지 않는 시각입니다.`
        : `${when} KST는 서머타임 해제로 두 번 존재하는 시각입니다.`,
    );
    this.name = 'InvalidLocalTimeError';
    this.kind = kind;
  }
}

export type TimeCorrectionOptions = {
  /** 경도 보정 (지방평균태양시) */
  useLongitude?: boolean;
  /** 균시차까지 적용 (진태양시) */
  useEquationOfTime?: boolean;
  /** 서머타임 되돌리기 — 끄면 출생증명서의 시계 시각을 그대로 쓴다 */
  useDst?: boolean;
  /** 출생지 경도. 동경 양수 */
  longitude?: number;
  /** 서머타임 전환일의 모호·부재 시각을 어떻게 다룰지 */
  dstTransitionPolicy?: DstTransitionPolicy;
};

export const DEFAULT_TIME_CORRECTION_OPTIONS = {
  useLongitude: true,
  useEquationOfTime: false,
  useDst: true,
  longitude: DEFAULT_LONGITUDE,
  dstTransitionPolicy: 'resolve',
} as const satisfies Required<TimeCorrectionOptions>;

export type CorrectedTime = {
  /** 벽시계가 가리키는 실제 절대 시각 — 절기 판정용 */
  instant: Date;
  /** 달력 시각을 읽을 표준시 오프셋(분) */
  zoneOffsetMinutes: number;
  /** 시주·일주 판정 때 달력 시각에 더할 보정(분) */
  solarTimeOffsetMinutes: number;
  zone: ZoneInterval;
  corrections: Correction[];
  warnings: string[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
/** 경도는 소수 첫째 자리로 뭉개면 서울 126.98°가 127°로 보여 오해를 부른다. */
const round2 = (n: number) => Math.round(n * 100) / 100;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${round1(n)}분`;

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export function correctTime(
  civil: CivilDateTime,
  options: TimeCorrectionOptions = {},
): CorrectedTime {
  const {
    useLongitude = DEFAULT_TIME_CORRECTION_OPTIONS.useLongitude,
    useEquationOfTime = DEFAULT_TIME_CORRECTION_OPTIONS.useEquationOfTime,
    useDst = DEFAULT_TIME_CORRECTION_OPTIONS.useDst,
    longitude = DEFAULT_TIME_CORRECTION_OPTIONS.longitude,
    dstTransitionPolicy = DEFAULT_TIME_CORRECTION_OPTIONS.dstTransitionPolicy,
  } = options;

  // 경도는 보정을 켰을 때만 결과에 들어간다. 꺼져 있으면 따지지 않는다.
  if (useLongitude) assertValidLongitude(longitude);

  const { instant, interval, ambiguous, nonexistent } = resolveWallClock(civil);

  if (dstTransitionPolicy === 'throw' && (nonexistent || ambiguous)) {
    throw new InvalidLocalTimeError(nonexistent ? 'nonexistent' : 'ambiguous', civil);
  }

  const corrections: Correction[] = [];
  const warnings: string[] = [];

  // 표준자오선 — 그 자체로 시각을 옮기지는 않지만 경도 보정의 기준이 된다.
  corrections.push({
    kind: 'standardMeridian',
    minutes: 0,
    label: '표준자오선',
    detail: `${formatOffset(interval.standardOffsetMinutes)} (동경 ${round2(standardMeridian(interval.standardOffsetMinutes))}°) 기준`,
  });

  // 서머타임 — 되돌리면 달력 시각을 표준시로 읽어 1시간이 빠진다.
  const dstActive = interval.dstOffsetMinutes > 0;
  const zoneOffsetMinutes =
    useDst && dstActive ? interval.standardOffsetMinutes : interval.totalOffsetMinutes;

  if (dstActive) {
    corrections.push({
      kind: 'dst',
      minutes: useDst ? -interval.dstOffsetMinutes : 0,
      label: '서머타임',
      detail: useDst
        ? `시행 기간이라 ${interval.dstOffsetMinutes}분을 되돌렸습니다`
        : `시행 기간이지만 되돌리지 않았습니다`,
    });
  }

  // 경도 — 표준자오선과의 차이를 시간으로 환산한다.
  let solarTimeOffsetMinutes = 0;

  if (useLongitude) {
    const minutes = longitudeCorrectionMinutes(longitude, interval.standardOffsetMinutes);
    solarTimeOffsetMinutes += minutes;
    corrections.push({
      kind: 'longitude',
      minutes,
      label: '경도 보정',
      detail: `동경 ${round2(longitude)}° ↔ 표준자오선 ${round2(standardMeridian(interval.standardOffsetMinutes))}° → ${signed(minutes)}`,
    });
  }

  // 균시차 — 여기까지 더해야 진태양시가 된다.
  if (useEquationOfTime) {
    const minutes = equationOfTimeMinutes(instant);
    solarTimeOffsetMinutes += minutes;
    corrections.push({
      kind: 'equationOfTime',
      minutes,
      label: '균시차',
      detail: `${signed(minutes)} (진태양시 적용)`,
    });
  }

  if (ambiguous) {
    warnings.push(
      '서머타임이 해제되던 날이라 같은 시각이 두 번 존재합니다. 앞선 쪽(서머타임이 살아 있던 시각)으로 해석했습니다.',
    );
  }
  if (nonexistent) {
    warnings.push(
      '서머타임이 시작되던 날이라 실제로 존재하지 않은 시각입니다. 전환 직후 기준으로 해석했습니다.',
    );
  }

  return {
    instant,
    zoneOffsetMinutes,
    solarTimeOffsetMinutes,
    zone: interval,
    corrections,
    warnings,
  };
}
