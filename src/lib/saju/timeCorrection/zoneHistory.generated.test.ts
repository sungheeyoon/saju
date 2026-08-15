import { describe, expect, it } from 'vitest';

import {
  KOREA_ZONE_HISTORY,
  ZONE_HISTORY_PROVENANCE,
} from '@/src/lib/saju/timeCorrection/zoneHistory';

/**
 * 생성된 표준시 표가 선언한 출처와 실제로 맞는지 확인한다.
 *
 * 표는 손으로 쓰지 않고 IANA tz 데이터에서 뽑지만, 뽑은 뒤에는 그냥 커밋된
 * 숫자 덩어리다. 한 줄만 잘못 손대도 그 시기 출생자의 시주가 통째로 어긋나고
 * 아무도 모른다. 그래서 실행 환경의 tzdb 와 다시 맞춰 본다.
 *
 * 단, 실행 환경의 판본이 생성 당시와 다르면 대조는 의미가 없다. 그때는
 * 건너뛰고 그 사실을 남긴다 — 실패로 위장하지 않는다.
 */

const ZONE = ZONE_HISTORY_PROVENANCE.zone;
const DAY_MS = 86_400_000;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  timeZoneName: 'longOffset',
});

/** 해당 시각에 이 시간대가 실제로 쓰던 UTC 오프셋(분) — 실행 환경의 tzdb 기준 */
function icuOffsetAt(time: number): number {
  const label = formatter
    .formatToParts(new Date(time))
    .find((part) => part.type === 'timeZoneName')!.value;
  const match = label.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
}

/** 표가 말하는 그 시각의 총 오프셋 */
function tableOffsetAt(time: number): number {
  const interval = KOREA_ZONE_HISTORY.findLast(
    (candidate) => candidate.start === null || candidate.start.getTime() <= time,
  )!;
  return interval.totalOffsetMinutes;
}

const sameTzdb = process.versions.tz === ZONE_HISTORY_PROVENANCE.tzdb;

describe('표준시 표의 출처(provenance)', () => {
  it('어디서 언제 뽑았는지 기록되어 있다', () => {
    expect(ZONE_HISTORY_PROVENANCE.zone).toBe('Asia/Seoul');
    expect(ZONE_HISTORY_PROVENANCE.fromYear).toBe(1900);
    expect(ZONE_HISTORY_PROVENANCE.toYear).toBe(2100);
    // tzdb 판본은 '2025b' 꼴, 생성일은 'YYYY-MM-DD' 꼴
    expect(ZONE_HISTORY_PROVENANCE.tzdb).toMatch(/^\d{4}[a-z]$/);
    expect(ZONE_HISTORY_PROVENANCE.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ZONE_HISTORY_PROVENANCE.node).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it(`실행 환경 tzdb 판본을 알려준다 (기록 ${ZONE_HISTORY_PROVENANCE.tzdb} · 현재 ${process.versions.tz ?? '미상'})`, () => {
    // 정보성 확인 — 판본이 달라도 실패시키지 않는다. 다르면 아래 대조가 skip 된다.
    expect(typeof (process.versions.tz ?? '')).toBe('string');
  });
});

describe('생성된 표 ↔ 실행 환경 tzdb 대조', () => {
  it.skipIf(!sameTzdb)('전환 시각이 분 단위까지 일치한다', () => {
    for (const interval of KOREA_ZONE_HISTORY) {
      if (interval.start === null) continue;
      const at = interval.start.getTime();

      // 전환 직후는 이 구간의 오프셋, 1분 전은 그와 달라야 한다.
      expect(icuOffsetAt(at), interval.start.toISOString()).toBe(interval.totalOffsetMinutes);
      expect(icuOffsetAt(at - 60_000), `${interval.start.toISOString()} 직전`).not.toBe(
        interval.totalOffsetMinutes,
      );
    }
  });

  it.skipIf(!sameTzdb)('빠뜨린 전환이 없다 — 1900~2100 하루 단위 대조', () => {
    // 전환을 하나 통째로 빠뜨리면 위 테스트는 통과한다. 그래서 훑는다.
    // toYear 는 포함이다 — 그 해 12월 31일까지 훑어야 선언한 범위를 다 덮는다.
    const from = Date.UTC(ZONE_HISTORY_PROVENANCE.fromYear, 0, 1);
    const to = Date.UTC(ZONE_HISTORY_PROVENANCE.toYear + 1, 0, 1);

    // 비교 지점은 절대 시각이므로 전환 당일이라고 봐줄 것이 없다. 정확히 같아야 한다.
    for (let time = from; time < to; time += DAY_MS / 2) {
      expect(tableOffsetAt(time), new Date(time).toISOString()).toBe(icuOffsetAt(time));
    }
  });
});
