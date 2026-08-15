/**
 * 표준시 이력 테이블의 원본 형태 — 생성 스크립트와 런타임이 공유하는 계약.
 * (별도 파일인 이유: 생성 파일이 이 타입만 import 하고, 순환을 만들지 않기 위해)
 */
export type RawZoneInterval = {
  /** 구간 시작 절대 시각. `null`이면 기록 이전(첫 구간) */
  startUtc: string | null;
  /** 표준자오선에서 오는 오프셋(분) — 서머타임을 제외한 값 */
  standardOffsetMinutes: number;
  /** 서머타임 가산분 (0 또는 60) */
  dstOffsetMinutes: number;
};

/**
 * 표를 어디서 언제 뽑았는지 — 재현성을 위한 기록.
 *
 * 표준시 이력은 자료(tzdb)가 개정되면 과거 구간까지 바뀔 수 있다. 어느 판본에서
 * 뽑았는지 남겨두지 않으면 "왜 이 값인가"를 되짚을 방법이 없다.
 */
export type ZoneHistoryProvenance = {
  zone: string;
  fromYear: number;
  toYear: number;
  /** IANA tz database 판본 (예: '2025b') */
  tzdb: string;
  /** 그 판본을 탑재하고 있던 Node.js와 ICU */
  node: string;
  icu: string;
  /** 생성일 (YYYY-MM-DD) */
  generatedAt: string;
};
