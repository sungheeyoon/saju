import type { CivilDateTime } from '../civilTime';
import type { SajuOptions } from '../index';

/**
 * 골든 테스트 경계 케이스.
 *
 * 고르는 기준은 "여기서 틀리면 조용히 틀린다"이다. 평범한 날짜는 어차피
 * 다른 테스트가 덮으므로, 규칙이 갈리는 지점만 모았다.
 *
 * 각 케이스의 결과는 `golden.snapshot.txt`에 고정되어 있다. 리팩터링으로
 * 값이 바뀌면 스냅샷 차이로 드러난다.
 */

export type GoldenCase = {
  id: string;
  /** 이 케이스가 고정하려는 것 */
  note: string;
  input: CivilDateTime;
  options: SajuOptions;
};

const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): CivilDateTime => ({ year, month, day, hour, minute, second: 0 });

/** 자시·시지 경계를 볼 때는 경도 보정을 꺼야 의도한 시각이 유지된다. */
const RAW: SajuOptions = { useLongitude: false, useEquationOfTime: false, useDst: true };
const SEOUL: SajuOptions = { useLongitude: true, useEquationOfTime: false, useDst: true };
const TRUE_SOLAR: SajuOptions = { useLongitude: true, useEquationOfTime: true, useDst: true };

export const GOLDEN_CASES: readonly GoldenCase[] = [
  // ── 절기 경계 ────────────────────────────────────────────
  // 2025년 입춘 = 2025-02-03 23:10:29 KST
  {
    id: 'ipchun-before',
    note: '입춘 절입 직전 — 연주가 아직 전년(甲辰)이어야 한다',
    input: at(2025, 2, 3, 23, 10),
    options: RAW,
  },
  {
    id: 'ipchun-after',
    note: '입춘 절입 직후 — 연주가 乙巳로 넘어가고 월지가 寅이 된다',
    input: at(2025, 2, 3, 23, 11),
    options: RAW,
  },
  {
    id: 'ipchun-longitude-stable',
    note: '입춘 직후에 경도 보정을 켜도 연주·월주는 흔들리지 않아야 한다',
    input: at(2025, 2, 3, 23, 11),
    options: SEOUL,
  },
  // 2025년 경칩 = 2025-03-05 17:07:17 KST
  {
    id: 'gyeongchip-before',
    note: '경칩 직전 — 월지가 아직 寅',
    input: at(2025, 3, 5, 17, 7),
    options: RAW,
  },
  {
    id: 'gyeongchip-after',
    note: '경칩 직후 — 월지가 卯로 넘어간다',
    input: at(2025, 3, 5, 17, 8),
    options: RAW,
  },
  // 2026년 소한 = 2026-01-05 17:23:03 KST
  {
    id: 'sohan-before',
    note: '소한 직전 — 1월인데 사주년은 아직 2025, 월지는 子',
    input: at(2026, 1, 5, 17, 22),
    options: RAW,
  },
  {
    id: 'sohan-after',
    note: '소한 직후 — 월지는 丑이 되지만 사주년은 여전히 2025',
    input: at(2026, 1, 5, 17, 24),
    options: RAW,
  },
  {
    id: 'daeseol',
    note: '대설 직후 — 12월인데 월지가 子',
    input: at(2025, 12, 7, 6, 5),
    options: RAW,
  },

  // ── 자시 경계 (조자시/야자시) ─────────────────────────────
  {
    id: 'jasi-2259-jo',
    note: '22:59 조자시 — 아직 亥시, 일주 그대로',
    input: at(2025, 6, 15, 22, 59),
    options: { ...RAW, lateNightRule: 'jo' },
  },
  {
    id: 'jasi-2300-jo',
    note: '23:00 조자시 — 子시로 바뀌고 일주가 다음 날로 넘어간다',
    input: at(2025, 6, 15, 23, 0),
    options: { ...RAW, lateNightRule: 'jo' },
  },
  {
    id: 'jasi-2300-ya',
    note: '23:00 야자시 — 子시지만 일주는 그날 그대로',
    input: at(2025, 6, 15, 23, 0),
    options: { ...RAW, lateNightRule: 'ya' },
  },
  {
    id: 'jasi-2359-ya',
    note: '23:59 야자시 — 자정 직전까지 일주 유지',
    input: at(2025, 6, 15, 23, 59),
    options: { ...RAW, lateNightRule: 'ya' },
  },
  {
    id: 'jasi-0000-jo',
    note: '00:00 — 자정을 넘었으므로 두 설이 일치한다',
    input: at(2025, 6, 16, 0, 0),
    options: { ...RAW, lateNightRule: 'jo' },
  },
  {
    id: 'jasi-0000-ya',
    note: '00:00 야자시 — 위와 같은 결과여야 한다',
    input: at(2025, 6, 16, 0, 0),
    options: { ...RAW, lateNightRule: 'ya' },
  },
  {
    id: 'jasi-0100',
    note: '01:00 — 子시가 끝나고 丑시 시작',
    input: at(2025, 6, 16, 1, 0),
    options: RAW,
  },

  // ── 시지 경계 ────────────────────────────────────────────
  {
    id: 'hour-0859',
    note: '08:59 — 아직 辰시',
    input: at(2025, 6, 15, 8, 59),
    options: RAW,
  },
  {
    id: 'hour-0900',
    note: '09:00 정각 — 경계는 새 시지(巳)에 포함된다',
    input: at(2025, 6, 15, 9, 0),
    options: RAW,
  },

  // ── 서머타임 ─────────────────────────────────────────────
  {
    id: 'dst-1988-on',
    note: '1988 서머타임 — 되돌리면 시계가 한 시간 빠진다',
    input: at(1988, 7, 15, 14, 0),
    options: { ...SEOUL, useDst: true },
  },
  {
    id: 'dst-1988-off',
    note: '같은 입력, 서머타임 미보정 — 시주가 갈릴 수 있다',
    input: at(1988, 7, 15, 14, 0),
    options: { ...SEOUL, useDst: false },
  },
  {
    id: 'dst-gap',
    note: '1987-05-10 02:30 — 서머타임 시작으로 존재하지 않던 시각',
    input: at(1987, 5, 10, 2, 30),
    options: SEOUL,
  },
  {
    id: 'dst-ambiguous',
    note: '1987-10-11 02:30 — 서머타임 해제로 두 번 지나간 시각',
    input: at(1987, 10, 11, 2, 30),
    options: SEOUL,
  },
  {
    id: 'dst-1957-on-830',
    note: '1957 서머타임 — UTC+8:30 위에 얹혀 +9:30이 되던 시기',
    input: at(1957, 7, 15, 14, 0),
    options: TRUE_SOLAR,
  },

  // ── 표준자오선 전환 ──────────────────────────────────────
  {
    id: 'meridian-1954-before',
    note: '1954-03-21 전 — 표준자오선 135°, 경도 보정 약 -32분',
    input: at(1954, 3, 20, 12, 0),
    options: SEOUL,
  },
  {
    id: 'meridian-1954-after',
    note: '1954-03-21 후 — 표준자오선 127.5°, 경도 보정이 -2분으로 줄어든다',
    input: at(1954, 3, 22, 12, 0),
    options: SEOUL,
  },
  {
    id: 'meridian-1961-before',
    note: '1961-08-10 전 — 아직 UTC+8:30',
    input: at(1961, 8, 9, 12, 0),
    options: SEOUL,
  },
  {
    id: 'meridian-1961-after',
    note: '1961-08-10 후 — UTC+9 복귀',
    input: at(1961, 8, 11, 12, 0),
    options: SEOUL,
  },

  // ── 달력 경계 ────────────────────────────────────────────
  {
    id: 'leap-day',
    note: '윤년 2월 29일 — 일주가 건너뛰지 않아야 한다',
    input: at(2024, 2, 29, 12, 0),
    options: RAW,
  },
  {
    id: 'year-end-jo',
    note: '12-31 23:30 조자시 — 일주가 다음 해 1월 1일로 넘어간다',
    input: at(2025, 12, 31, 23, 30),
    options: { ...RAW, lateNightRule: 'jo' },
  },
  {
    id: 'gapja-day',
    note: '2024-01-01 — 일주가 갑자(甲子)인 날, 일주 앵커 검증용',
    input: at(2024, 1, 1, 12, 0),
    options: RAW,
  },

  // ── 균시차 극값 ──────────────────────────────────────────
  {
    id: 'eot-max',
    note: '균시차 최대(+16분대) — 진태양시가 가장 앞서는 날',
    input: at(2025, 11, 3, 12, 0),
    options: TRUE_SOLAR,
  },
  {
    id: 'eot-min',
    note: '균시차 최소(-14분대) — 진태양시가 가장 뒤처지는 날',
    input: at(2025, 2, 11, 12, 0),
    options: TRUE_SOLAR,
  },
];
