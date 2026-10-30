/**
 * **처음 온 사람인가** — 내 사주만 등록했고, 받은 풀이 · 만드는 중인 풀이 · 저장한 사람이 하나도 없다(운영자 결정 2026-10-18 G-99 안 A).
 *
 * 그때 홈의 「내가 받은 사주풀이」는 빈 점선 한 권(「사주풀이 받기」)뿐이라 바로 위 내 사주 카드의 「사주풀이 받기」를 두 번
 * 권했다. 처음 온 사람의 홈은 그 칸을 걷고 저장한 사람을 카드 바로 아래로 올린다. 하나라도 생기면 다시 온 사람의 홈(지금 차례)이다.
 */
export function isFirstVisit({
  readings,
  running,
  people,
}: {
  /** 만든 풀이 목록(`myReadings`) — 한 사람 풀이 · 궁합풀이 다 */
  readings: readonly unknown[];
  /** 만드는 중인 풀이 */
  running: readonly unknown[];
  /** 저장한 사람 수(나는 빼고) */
  people: number;
}): boolean {
  return readings.length === 0 && running.length === 0 && people === 0;
}
