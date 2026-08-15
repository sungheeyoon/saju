import { fromCivil, type CivilDateTime } from '../civilTime';
import { KOREA_ZONE_HISTORY_RAW } from './zoneHistory.generated';

/**
 * 한국 표준시 이력 — 표준자오선 변경과 서머타임을 하나의 표로 다룬다.
 *
 * 둘을 따로 관리하면 1955~60년에서 반드시 틀린다. 이 시기 서머타임은
 * UTC+9:00이 아니라 **UTC+8:30 위에 얹혀** +9:30으로 갔기 때문이다.
 * 표 자체는 IANA tz 데이터에서 생성한다 (`scripts/generate-zone-history.mjs`).
 */

export type ZoneInterval = {
  /** 구간 시작. `null`이면 기록 이전 */
  start: Date | null;
  /** 구간 끝(다음 구간 시작). `null`이면 현재까지 */
  end: Date | null;
  /** 표준자오선에서 오는 오프셋(분) */
  standardOffsetMinutes: number;
  /** 서머타임 가산분 (0 또는 60) */
  dstOffsetMinutes: number;
  /** 실제 시계가 가리킨 오프셋 */
  totalOffsetMinutes: number;
};

export const KOREA_ZONE_HISTORY: readonly ZoneInterval[] = KOREA_ZONE_HISTORY_RAW.map(
  (raw, index) => {
    const next = KOREA_ZONE_HISTORY_RAW[index + 1];
    return {
      start: raw.startUtc === null ? null : new Date(raw.startUtc),
      end: next?.startUtc ? new Date(next.startUtc) : null,
      standardOffsetMinutes: raw.standardOffsetMinutes,
      dstOffsetMinutes: raw.dstOffsetMinutes,
      totalOffsetMinutes: raw.standardOffsetMinutes + raw.dstOffsetMinutes,
    };
  },
);

/** 절대 시각에 적용되던 표준시 구간을 찾는다. */
export function zoneIntervalAt(instant: Date): ZoneInterval {
  const time = instant.getTime();
  const found = KOREA_ZONE_HISTORY.findLast(
    (interval) => interval.start === null || interval.start.getTime() <= time,
  );

  if (!found) {
    throw new Error(`표준시 구간을 찾지 못했습니다: ${instant.toISOString()}`);
  }
  return found;
}

export type WallClockResolution = {
  /** 벽시계가 가리키는 실제 절대 시각 */
  instant: Date;
  interval: ZoneInterval;
  /** 서머타임 해제로 같은 벽시계가 두 번 존재한다 — 앞선 쪽(서머타임)을 택했다 */
  ambiguous: boolean;
  /** 서머타임 시작으로 존재하지 않는 벽시계다 — 건너뛴 뒤 기준으로 해석했다 */
  nonexistent: boolean;
};

/**
 * 벽시계 시각을 절대 시각으로 되돌린다.
 *
 * 서머타임 전환일에는 벽시계가 실제 시각과 1:1로 대응하지 않는다.
 * 예를 들어 1987-10-11에는 01:00~02:00이 두 번 지나갔고(모호),
 * 1987-05-10에는 02:00~03:00이 아예 없었다(부재). 둘 다 짚어서 알린다.
 */
export function resolveWallClock(civil: CivilDateTime): WallClockResolution {
  // 오프셋 0으로 읽으면 "벽시계 숫자 그대로"의 타임라인이 된다.
  const wallTime = fromCivil(civil, 0).getTime();

  const matches = KOREA_ZONE_HISTORY.filter((interval) => {
    const shift = interval.totalOffsetMinutes * 60_000;
    const startWall = interval.start === null ? -Infinity : interval.start.getTime() + shift;
    const endWall = interval.end === null ? Infinity : interval.end.getTime() + shift;
    return wallTime >= startWall && wallTime < endWall;
  });

  if (matches.length === 1) {
    const interval = matches[0];
    return {
      instant: new Date(wallTime - interval.totalOffsetMinutes * 60_000),
      interval,
      ambiguous: false,
      nonexistent: false,
    };
  }

  if (matches.length > 1) {
    // 되돌린 시계 — 관례대로 첫 번째(서머타임이 살아 있던) 해석을 택한다.
    const interval = matches[0];
    return {
      instant: new Date(wallTime - interval.totalOffsetMinutes * 60_000),
      interval,
      ambiguous: true,
      nonexistent: false,
    };
  }

  // 건너뛴 시계 — 전환 직후 구간의 오프셋으로 해석하면 시각이 앞으로 밀린다.
  const after = KOREA_ZONE_HISTORY.find((interval) => {
    const shift = interval.totalOffsetMinutes * 60_000;
    const startWall = interval.start === null ? -Infinity : interval.start.getTime() + shift;
    return startWall > wallTime;
  });

  const interval = after ?? KOREA_ZONE_HISTORY[KOREA_ZONE_HISTORY.length - 1];
  return {
    instant: new Date(wallTime - interval.totalOffsetMinutes * 60_000),
    interval,
    ambiguous: false,
    nonexistent: true,
  };
}
