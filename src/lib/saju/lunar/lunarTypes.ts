/**
 * 음력 표의 원본 형태 — 생성 스크립트와 런타임이 공유하는 계약.
 * (별도 파일인 이유: 생성 파일이 이 타입만 import 하고, 순환을 만들지 않기 위해)
 */

export type RawLunarYear = {
  /** 음력 1월 1일에 해당하는 양력 날짜 (YYYY-MM-DD, 한국표준시) */
  startSolar: string;
  /** 윤달의 달 번호. 윤달이 없으면 0 — 윤달은 그 번호의 달 **바로 뒤**에 온다 */
  leapMonth: number;
  /**
   * 각 달의 날 수(29 또는 30)를 **시간순으로** 나열한 것.
   *
   * 윤달이 있으면 열세 개이고, `leapMonth` 번째 다음 자리가 그 윤달이다.
   * 달 번호를 따로 싣지 않는 이유는 순서에서 유도되기 때문이다 — 두 벌로 두면
   * 어긋날 수 있고, 어긋났을 때 어느 쪽이 참인지 표가 말하지 못한다.
   */
  monthDays: readonly number[];
};

/**
 * 표를 어느 규칙과 어느 천체력으로 뽑았는지 — 재현성을 위한 기록.
 *
 * 음력은 관측이 아니라 **규정**이 정한다. 규정이 개정되거나 천체력이 바뀌면
 * 같은 스크립트가 다른 표를 낸다. 어디서 왔는지 남겨두지 않으면 「왜 이 값인가」를
 * 되짚을 방법이 없다.
 */
export type LunarTableProvenance = {
  /** 표가 덮는 음력 연도 — 양 끝을 포함한다 */
  firstYear: number;
  lastYear: number;
  /** 날짜를 정하는 규칙 */
  rule: string;
  /** 그 규칙의 원문을 볼 수 있는 곳 */
  ruleSource: string;
  /** 삭 시각을 날짜에 배정할 때 쓴 기준 */
  meridian: string;
  /** 삭·중기 시각을 구한 천체력과 그 판본 */
  ephemeris: string;
  node: string;
  /** 생성일 (YYYY-MM-DD) */
  generatedAt: string;
};

/**
 * 삭 시각이 한국표준시 자정에 붙어 있어 초하루가 하루 갈릴 수 있는 달.
 *
 * 「모른다」를 값으로 남기는 자리다. 표에는 한쪽 답이 실려 있고, 이 목록이
 * 그 답이 얼마나 아슬아슬한지를 말한다.
 */
export type NearMidnightNewMoon = {
  /** 합삭 시각 (한국표준시) */
  newMoonKst: string;
  /** 자정에서 떨어진 초. 음수면 자정 **전**이라 하루 당겨질 수 있다 */
  secondsFromMidnight: number;
  /** 이 삭이 여는 음력 달 — `L` 이 붙으면 윤달 */
  lunarDate: string;
  /** 표가 실제로 채택한 초하루의 양력 날짜 */
  solarDate: string;
};

/** 같은 이유로 동지 날짜가 갈릴 수 있는 해 — 동지월이 11월이라 음력 전체가 밀린다. */
export type NearMidnightDongji = {
  dongjiKst: string;
  secondsFromMidnight: number;
  solarDate: string;
};
