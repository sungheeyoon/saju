import {
  BRANCHES,
  BRANCH_INFO,
  CITY_LONGITUDES,
  longitudeCorrectionMinutes,
  type Branch,
  type Correction,
  type LateNightRule,
  type Pillar,
  type Saju,
} from '@/src/lib/saju';

import { calculateChart } from '@/src/lib/input/chart';
import { TIME_BASIS, type Query } from '@/src/lib/input/query';

/**
 * 입력 폼이 **사주를 아는 사람처럼** 거드는 판단 — 시진 · 보정 시각 · 자시 · 미리보기.
 *
 * 화면(`birth-form.tsx` · `birth-preview.tsx`)은 그리기만 한다. 여기 있는 것은 전부 엔진이 이미 내는 값을 읽어
 * 다시 묶은 것이고, **새로 판정하지 않는다** — 미리보기도 결과 화면과 같은 `calculateChart` 를 부른다. 폼이 따로
 * 세면 「입력하며 본 여덟 글자」와 「제출하고 본 여덟 글자」가 갈릴 자리가 생긴다.
 *
 * 제출되는 값은 그대로다(`Query`). 시진을 골라도 폼이 내보내는 것은 `time: 'HH:MM'` · `hourKnown: true` 한 벌이다.
 */

const DAY = 24 * 60;
const pad2 = (n: number) => String(n).padStart(2, '0');
const clockOf = (minutes: number) => {
  const m = ((Math.round(minutes) % DAY) + DAY) % DAY;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};
const minutesOf = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** 날짜가 다 적혔는가 — 반쪽 날짜로는 그날의 균시차 · 서머타임을 셀 수 없다 */
const hasDate = (query: Query) => /^\d{4}-\d{2}-\d{2}$/.test(query.date);

/**
 * 시계 시각에 **더하면 사주가 읽는 시각이 되는 분** — 서머타임 되돌림 + 경도 + 균시차.
 *
 * 날짜가 있으면 엔진에 그날 정오를 물어 실제로 걸리는 보정을 그대로 받는다(`meta.totalCorrectionMinutes`). 그날의
 * 표준자오선(1954~61년은 동경 127.5°) · 서머타임 · 균시차가 다 거기 들어 있다. 날짜가 덜 적혔으면 지금 표준자오선
 * (동경 135°)의 경도 보정만으로 가늠한다 — 날짜가 차면 바로 다시 센다.
 */
export function clockShiftOf(query: Query): number {
  if (hasDate(query)) {
    const noon = calculateChart({ ...query, hourKnown: true, time: '12:00' });
    if (noon.ok) return noon.saju.meta.totalCorrectionMinutes;
  }
  return TIME_BASIS[query.basis].useLongitude ? longitudeCorrectionMinutes(CITY_LONGITUDES[query.city], 9 * 60) : 0;
}

/**
 * 시진 한 칸 — **시계로 읽은 범위**다.
 *
 * 子시는 사주가 읽는 시각으로 23~1시지만, 서울 사람의 시계로는 대략 23:30~1:30 이다(경도 −32분). 부모가 「인시에
 * 났다」고 기억하는 것은 대개 그 시진이지 시계의 분이 아니므로, 칸에는 **이 사람의 출생지 · 날짜 · 시간 기준으로 옮긴
 * 시계 범위**를 적는다. 그 범위가 자정을 가로지르는 시진(대개 子)은 두 칸으로 나뉜다 — 생년월일은 시계의 날짜라,
 * 자정 전에 났는지 넘어서 났는지가 다른 날이다.
 */
export type HourSlot = {
  key: string;
  branch: Branch;
  /** 자정을 가로지르는 시진만 둘로 나뉜다 */
  part: 'whole' | 'beforeMidnight' | 'afterMidnight';
  /** 시계 시각 범위(분, 끝은 안 든다) */
  from: number;
  to: number;
  /** 고르면 실리는 시각 — 그 칸의 가운데 */
  time: string;
};

/** 이보다 짧은 토막은 칸으로 세우지 않는다 — 같은 시진의 다른 토막이 그 시진을 든다 */
const SHORTEST_PIECE = 15;

/** 사주가 읽는 시각으로 그 시진이 시작하는 분 — 子 23:00 부터 두 시간씩 */
const solarStartOf = (branch: Branch) => (BRANCH_INFO[branch].index * 120 - 60 + DAY) % DAY;

export function hourSlotsOf(query: Query): HourSlot[] {
  const shift = clockShiftOf(query);
  const pieces: Omit<HourSlot, 'key' | 'time'>[] = [];

  for (const branch of BRANCHES) {
    // 시계 = 사주 시각 − 보정
    const from = (((solarStartOf(branch) - shift) % DAY) + DAY) % DAY;
    const to = from + 120;
    if (to <= DAY) {
      pieces.push({ branch, part: 'whole', from, to });
    } else {
      pieces.push({ branch, part: 'beforeMidnight', from, to: DAY });
      pieces.push({ branch, part: 'afterMidnight', from: 0, to: to - DAY });
    }
  }

  return pieces
    .filter((piece) => piece.to - piece.from >= SHORTEST_PIECE)
    .sort((a, b) => a.from - b.from)
    .map((piece) => ({
      ...piece,
      key: `${piece.branch}-${piece.part}`,
      time: clockOf(Math.floor((piece.from + piece.to) / 2)),
    }));
}

/** 그 시각이 든 칸 */
export function slotOfTime(slots: readonly HourSlot[], time: string): HourSlot | null {
  const minutes = minutesOf(time);
  if (minutes === null) return null;
  return slots.find((slot) => minutes >= slot.from && minutes < slot.to) ?? null;
}

/** 칸의 시계 범위를 읽는 글자 — 끝은 안 든다(「03:28~05:28」의 05:28 은 다음 칸) */
export const slotRangeOf = (slot: HourSlot) => `${clockOf(slot.from)}~${clockOf(slot.to)}`;

/**
 * 자시 규칙이 **이 입력에서 무엇을 바꾸는가.**
 *
 * 두 규칙으로 각각 세워 보고 일주나 시주가 갈릴 때만 답한다. 엔진의 경고(「23시대 출생이라 …」)는 갈린다는 사실만
 * 말하는데, 고르는 사람에게 필요한 것은 **어느 쪽을 고르면 어떤 일주가 서는가**다. 자정을 넘은 자시는 두 규칙의
 * 일주가 같아 묻지 않는다.
 */
export function lateNightChoicesOf(query: Query): Record<LateNightRule, { day: Pillar; hour: Pillar | null }> | null {
  if (query.hourKnown !== true || minutesOf(query.time) === null) return null;
  const jo = calculateChart({ ...query, rule: 'jo' });
  const ya = calculateChart({ ...query, rule: 'ya' });
  if (!jo.ok || !ya.ok) return null;

  const of = (saju: Saju) => ({ day: saju.pillars.day, hour: saju.pillars.hour });
  if (jo.saju.pillars.day.name === ya.saju.pillars.day.name && jo.saju.pillars.hour?.name === ya.saju.pillars.hour?.name) {
    return null;
  }
  return { jo: of(jo.saju), ya: of(ya.saju) };
}

/** 미리보기 — 입력이 다 차고 엔진이 받았을 때만 */
export type BirthPreview = {
  saju: Saju;
  /** 시계 시각과 사주가 읽은 시각 — 시각을 모르면 없다 */
  clock: { written: string; solar: string; dayShift: 'previous' | 'next' | null; corrections: Correction[] } | null;
  /** 양력 1월 · 2월 초처럼 **입춘 전이라 년주가 전해**인 때 — 띠를 헷갈리는 가장 흔한 자리 */
  beforeIpchun: { sajuYear: number; year: Pillar } | null;
  /** 엔진이 남긴 경계 경고(절입 · 시지 경계 · 자시 · 서머타임) — 문장은 엔진 것 그대로 */
  warnings: string[];
};

export function birthPreviewOf(query: Query): BirthPreview | null {
  const result = calculateChart(query);
  if (!result.ok) return null;
  const { saju } = result;
  const { meta } = saju;

  const civil = saju.pillars.meta.civilTime;
  const written = meta.resolvedTime;
  const daysApart =
    (Date.UTC(civil.year, civil.month - 1, civil.day) - Date.UTC(written.year, written.month - 1, written.day)) / 86_400_000;
  const clock =
    meta.inputTime.hour === null
      ? null
      : {
          written: query.time,
          solar: `${pad2(civil.hour)}:${pad2(civil.minute)}`,
          dayShift: daysApart < 0 ? ('previous' as const) : daysApart > 0 ? ('next' as const) : null,
          corrections: meta.corrections.filter((correction) => Math.round(correction.minutes) !== 0),
        };

  const beforeIpchun =
    saju.pillars.meta.sajuYear !== meta.resolvedTime.year
      ? { sajuYear: saju.pillars.meta.sajuYear, year: saju.pillars.year }
      : null;

  return { saju, clock, beforeIpchun, warnings: meta.warnings };
}
