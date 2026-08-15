// 이 파일은 scripts/generate-zone-history.mjs 가 생성합니다. 직접 수정하지 마세요.
// 출처: IANA tz database 2025b (Asia/Seoul), 1900-01-01 ~ 2100-12-31
// 생성: Node 24.12.0 · ICU 77.1 · 2026-08-15
// 재생성: node scripts/generate-zone-history.mjs
//
// tzdb 판본이 바뀌면 과거 구간까지 달라질 수 있다. 재생성 후에는 골든 스냅샷
// 차이를 반드시 확인할 것.

import type { RawZoneInterval, ZoneHistoryProvenance } from './zoneTypes';

export const ZONE_HISTORY_PROVENANCE: ZoneHistoryProvenance = {
  "zone": "Asia/Seoul",
  "fromYear": 1900,
  "toYear": 2100,
  "tzdb": "2025b",
  "node": "24.12.0",
  "icu": "77.1",
  "generatedAt": "2026-08-15"
};

export const KOREA_ZONE_HISTORY_RAW: readonly RawZoneInterval[] = [
  // 기록 이전 (지방평균시)
  { startUtc: null, standardOffsetMinutes: 507, dstOffsetMinutes: 0 },
  // 1908-04-01 00:32 KST부터 · UTC+08:30
  { startUtc: '1908-03-31T15:32:08.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1912-01-01 00:30 KST부터 · UTC+09:00
  { startUtc: '1911-12-31T15:30:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1948-06-01 00:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1948-05-31T15:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1948-09-12 23:00 KST부터 · UTC+09:00
  { startUtc: '1948-09-12T14:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1949-04-03 00:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1949-04-02T15:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1949-09-10 23:00 KST부터 · UTC+09:00
  { startUtc: '1949-09-10T14:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1950-04-01 00:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1950-03-31T15:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1950-09-09 23:00 KST부터 · UTC+09:00
  { startUtc: '1950-09-09T14:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1951-05-06 00:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1951-05-05T15:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1951-09-08 23:00 KST부터 · UTC+09:00
  { startUtc: '1951-09-08T14:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1954-03-21 00:00 KST부터 · UTC+08:30
  { startUtc: '1954-03-20T15:00:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1955-05-05 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1955-05-04T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1955-09-08 23:30 KST부터 · UTC+08:30
  { startUtc: '1955-09-08T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1956-05-20 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1956-05-19T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1956-09-29 23:30 KST부터 · UTC+08:30
  { startUtc: '1956-09-29T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1957-05-05 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1957-05-04T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1957-09-21 23:30 KST부터 · UTC+08:30
  { startUtc: '1957-09-21T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1958-05-04 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1958-05-03T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1958-09-20 23:30 KST부터 · UTC+08:30
  { startUtc: '1958-09-20T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1959-05-03 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1959-05-02T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1959-09-19 23:30 KST부터 · UTC+08:30
  { startUtc: '1959-09-19T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1960-05-01 00:30 KST부터 · UTC+09:30 (서머타임)
  { startUtc: '1960-04-30T15:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 60 },
  // 1960-09-17 23:30 KST부터 · UTC+08:30
  { startUtc: '1960-09-17T14:30:00.000Z', standardOffsetMinutes: 510, dstOffsetMinutes: 0 },
  // 1961-08-10 00:30 KST부터 · UTC+09:00
  { startUtc: '1961-08-09T15:30:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1987-05-10 02:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1987-05-09T17:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1987-10-11 02:00 KST부터 · UTC+09:00
  { startUtc: '1987-10-10T17:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
  // 1988-05-08 02:00 KST부터 · UTC+10:00 (서머타임)
  { startUtc: '1988-05-07T17:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 60 },
  // 1988-10-09 02:00 KST부터 · UTC+09:00
  { startUtc: '1988-10-08T17:00:00.000Z', standardOffsetMinutes: 540, dstOffsetMinutes: 0 },
];
