/**
 * 요청 · 소식 · 풀이의 시각 — **한국 시간으로.** 서버(UTC)가 먼저 그리는 칸이라 시간대를 안 적으면 아홉 시간 이르게 서고,
 * 브라우저가 이어받는 칸(풀이 판)은 한국의 브라우저가 다른 글자를 그려 하이드레이션이 어긋났다.
 */
export function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
}
