import { Body, Observer, SearchHourAngle } from 'astronomy-engine';

/**
 * 균시차(均時差) — 진태양시 − 평균태양시.
 *
 * 지구 공전 궤도가 타원이고 자전축이 기울어 있어, 실제 태양이 남중하는 시각은
 * 균일하게 흐르는 평균태양시와 어긋난다. 연중 약 -14분 ~ +16분을 오간다.
 *
 * 경도 보정만 하면 **평균**태양시에서 멈춘다. 진태양시까지 가려면 이 값을 더해야
 * 하는데, 서울 경도 보정(약 -32분)과 맞먹는 크기라 시지 경계를 넘길 수 있다.
 * 다만 국내 만세력 상당수는 균시차를 쓰지 않으므로 학파 선택으로 남긴다.
 */

/** 그리니치(경도 0°) 관측자 — 균시차는 위치와 무관하므로 기준점으로만 쓴다. */
const GREENWICH = new Observer(0, 0, 0);

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 1440;

/**
 * 주어진 시각이 속한 날의 균시차(분).
 *
 * 경도 0°에서 진태양이 남중하는 시각을 찾아 정오와의 차이를 잰다.
 * 균시차는 하루에 30초 남짓 변하므로 날짜 단위로 구해도 충분하다.
 */
export function equationOfTimeMinutes(instant: Date): number {
  const dayStart = Date.UTC(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
  );

  const transit = SearchHourAngle(Body.Sun, GREENWICH, 0, new Date(dayStart));
  const transitMinutes = (transit.time.date.getTime() - dayStart) / MINUTE_MS;

  return MINUTES_PER_DAY / 2 - transitMinutes;
}
