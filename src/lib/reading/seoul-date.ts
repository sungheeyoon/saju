/**
 * 서울의 벽시계 — UTC 에 아홉 시간을 더한 시각. 한국은 1988 년 뒤로 일광 절약 시간이 없어 이 더하기가 `Asia/Seoul` 과 같다
 * (옆 시험이 Intl 과 견준다). 이 값의 `getUTC*` 가 서울의 연 · 월 · 일이다.
 */
export const seoulWallClock = (at: Date): Date => new Date(at.getTime() + 9 * 60 * 60 * 1000);

/** 서울 날짜(`YYYY-MM-DD`) — 서버는 UTC 라 그냥 자르면 자정 앞뒤 아홉 시간이 전날로 간다 */
export const seoulDateOf = (at: Date): string => seoulWallClock(at).toISOString().slice(0, 10);
