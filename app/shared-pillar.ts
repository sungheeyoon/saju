import { chartSnapshotOf, type ChartSnapshot, type Gender, type Pillars } from '@/src/lib/saju';

/**
 * 공유 궁합 화면이 브라우저에 내보내는 명식 모양.
 *
 * **엔진의 여덟 글자 스냅샷과 같은 모양이다**(`ChartSnapshot`, ADR 0071). 한동안 이
 * 파일이 그 모양을 따로 들고 있었는데, 같은 것이 두 벌이면 한쪽만 고쳐지는 날이 온다.
 * 정확한 생년월일시·출생지·보정값이 든 `Saju.meta` 와 `Pillars.meta` 는 여기 없고,
 * 런타임에서도 아래 변환 함수가 새 객체를 만들어 잘라 낸다.
 *
 * 갈리는 칸이 하나 있다 — **성별**. 본인이 관리하는 사람의 비공개 궁합 화면에서만
 * 서고, 저장되는 스냅샷에는 안 실린다(동의 범위가 여덟 글자까지다, ADR 0012).
 */
export type SharedPillarChart = ChartSnapshot & {
  /** 본인이 관리하는 사람의 비공개 궁합 화면에서만 표시한다. */
  readonly gender?: Gender;
};

/** 여덟 글자만 복사한다 — 짓는 일은 엔진 쪽 한 자리가 한다 */
export function sharedPillarChartOf(pillars: Pillars): SharedPillarChart {
  return chartSnapshotOf(pillars);
}

/**
 * **저장돼 있던 여덟 글자를 화면 모양으로 받는다** (ADR 0071).
 *
 * 앞서는 이 값이 서버에서 두 판본을 읽어 **계산한** 것이었다. 이제 동의 때 베껴 둔 것을
 * 그대로 읽으므로, 들어오는 것은 `jsonb` 한 덩이다.
 *
 * **DB 가 모양을 이미 봤다**(`is_chart_snapshot` — 낱자가 천간 열·지지 열둘 안인가,
 * 일간이 일주의 천간인가, 칸이 다섯인가). 그래도 여기서 한 번 더 보는 것은 이 값이
 * **화면으로 나가는 경계**를 지나기 때문이다 — 백필이 아직 안 닿은 옛 Match 는 이 칸이
 * 비어 있고, 그때 빈 값을 명식 보드로 넘기면 화면이 빈 칸을 그린다.
 *
 * @returns 모양이 아니면 `null`. **기본값으로 메우지 않는다** — 없는 여덟 글자를 지어
 *   세우면 두 사람이 동의한 적 없는 명식이 보드에 선다.
 */
export function storedPillarChart(value: unknown): SharedPillarChart | null {
  if (typeof value !== 'object' || value === null) return null;

  const chart = value as Record<string, unknown>;
  const pillar = (at: unknown): boolean =>
    typeof at === 'object' &&
    at !== null &&
    typeof (at as Record<string, unknown>).stem === 'string' &&
    typeof (at as Record<string, unknown>).branch === 'string';

  if (!pillar(chart.year) || !pillar(chart.month) || !pillar(chart.day)) return null;
  if (chart.hour !== null && !pillar(chart.hour)) return null;
  if (typeof chart.dayMaster !== 'string') return null;

  return chart as unknown as SharedPillarChart;
}
