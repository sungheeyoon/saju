/**
 * 기간이 시작한 날 — **서울 날짜로**, 「10월 16일 (금)」.
 *
 * DB 가 낸 `since` 는 서울 0시를 UTC 로 적은 순간이라(전날 15:00Z) 서버의 시간대로 날짜를 뽑으면 하루 앞선다.
 */
export const sinceDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
