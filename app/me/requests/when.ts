/** 요청 · 소식의 시각 — **한국 시간으로.** 서버(UTC)가 그리는 화면이라 적지 않으면 아홉 시간 이르게 섰다 */
export function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });
}
