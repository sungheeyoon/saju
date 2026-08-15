/**
 * IANA tz 데이터(Asia/Seoul)에서 한국 표준시 이력을 뽑아
 * src/lib/saju/timeCorrection/zoneHistory.ts 를 생성한다.
 *
 *   node scripts/generate-zone-history.mjs
 *
 * 런타임에 Intl 을 쓰지 않고 생성된 표를 커밋해서 쓰는 이유:
 * 브라우저·Node 마다 탑재된 tzdata 버전이 달라 같은 입력에 다른 답이 나올 수 있다.
 * 사주 계산은 결정론적이어야 하므로 한 번 뽑아 고정한다.
 */

import { writeFileSync } from 'node:fs';

const ZONE = 'Asia/Seoul';
const FROM_YEAR = 1900;
const TO_YEAR = 2100;
const DAY_MS = 86_400_000;

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  timeZoneName: 'longOffset',
});

/** 해당 시각의 UTC 오프셋(분) */
function offsetAt(time) {
  const label = formatter
    .formatToParts(new Date(time))
    .find((p) => p.type === 'timeZoneName').value;
  const m = label.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** 오프셋이 바뀌는 지점을 하루 단위로 훑고, 분 단위까지 이분 탐색으로 좁힌다. */
function findTransitions() {
  const transitions = [];
  let previous = offsetAt(Date.UTC(FROM_YEAR, 0, 1));

  for (let t = Date.UTC(FROM_YEAR, 0, 2); t < Date.UTC(TO_YEAR, 0, 1); t += DAY_MS) {
    const current = offsetAt(t);
    if (current === previous) continue;

    // 밀리초까지 좁힌다. 1분에서 멈추면 전환 시각에 초 단위 찌꺼기가 남는다.
    let lo = t - DAY_MS;
    let hi = t;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (offsetAt(mid) === previous) lo = mid;
      else hi = mid;
    }
    transitions.push({ at: hi, offset: current });
    previous = current;
  }
  return transitions;
}

/**
 * 구간을 표준시(standard)와 서머타임 가산분(dst)으로 분해한다.
 *
 * Intl 의 DST 라벨은 1955~60년 구간에서 'GMT+09:30' 으로만 나와 못 쓴다.
 * 대신 구조로 판정한다: 오프셋이 직전 구간보다 정확히 60분 높고, 다음 구간에서
 * 직전 값으로 되돌아오면 그 구간은 서머타임이다.
 */
function classify(intervals) {
  return intervals.map((interval, i) => {
    const previous = intervals[i - 1];
    const next = intervals[i + 1];

    const isDst =
      previous !== undefined &&
      next !== undefined &&
      interval.offset === previous.offset + 60 &&
      next.offset === previous.offset;

    return {
      start: interval.start,
      standardOffsetMinutes: isDst ? interval.offset - 60 : interval.offset,
      dstOffsetMinutes: isDst ? 60 : 0,
    };
  });
}

const transitions = findTransitions();

const intervals = [
  { start: null, offset: offsetAt(Date.UTC(FROM_YEAR, 0, 1)) },
  ...transitions.map((t) => ({ start: t.at, offset: t.offset })),
];

const classified = classify(intervals);

const toKst = (ms) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');
const sign = (n) => (n < 0 ? '-' : '+');
const hhmm = (n) =>
  `${sign(n)}${String(Math.floor(Math.abs(n) / 60)).padStart(2, '0')}:${String(Math.abs(n) % 60).padStart(2, '0')}`;

const rows = classified
  .map((iv) => {
    const start = iv.start === null ? 'null' : `'${new Date(iv.start).toISOString()}'`;
    const total = iv.standardOffsetMinutes + iv.dstOffsetMinutes;
    const note =
      iv.start === null
        ? '기록 이전 (지방평균시)'
        : `${toKst(iv.start)} KST부터 · UTC${hhmm(total)}${iv.dstOffsetMinutes ? ' (서머타임)' : ''}`;
    return `  // ${note}\n  { startUtc: ${start}, standardOffsetMinutes: ${iv.standardOffsetMinutes}, dstOffsetMinutes: ${iv.dstOffsetMinutes} },`;
  })
  .join('\n');

/**
 * 출처 기록 — tzdb 판본이 다르면 같은 스크립트가 다른 표를 낸다.
 * Node 가 어느 판본을 탑재했는지 `process.versions.tz` 로 확인할 수 있다.
 */
const provenance = {
  zone: ZONE,
  fromYear: FROM_YEAR,
  toYear: TO_YEAR,
  tzdb: process.versions.tz ?? 'unknown',
  node: process.versions.node,
  icu: process.versions.icu ?? 'unknown',
  generatedAt: new Date().toISOString().slice(0, 10),
};

const output = `// 이 파일은 scripts/generate-zone-history.mjs 가 생성합니다. 직접 수정하지 마세요.
// 출처: IANA tz database ${provenance.tzdb} (${ZONE}), ${FROM_YEAR}~${TO_YEAR}
// 생성: Node ${provenance.node} · ICU ${provenance.icu} · ${provenance.generatedAt}
// 재생성: node scripts/generate-zone-history.mjs
//
// tzdb 판본이 바뀌면 과거 구간까지 달라질 수 있다. 재생성 후에는 골든 스냅샷
// 차이를 반드시 확인할 것.

import type { RawZoneInterval, ZoneHistoryProvenance } from './zoneTypes';

export const ZONE_HISTORY_PROVENANCE: ZoneHistoryProvenance = ${JSON.stringify(provenance, null, 2)};

export const KOREA_ZONE_HISTORY_RAW: readonly RawZoneInterval[] = [
${rows}
];
`;

writeFileSync(new URL('../src/lib/saju/timeCorrection/zoneHistory.generated.ts', import.meta.url), output);

const dstCount = classified.filter((i) => i.dstOffsetMinutes > 0).length;
console.log(`구간 ${classified.length}개 (서머타임 ${dstCount}개) → zoneHistory.generated.ts`);
