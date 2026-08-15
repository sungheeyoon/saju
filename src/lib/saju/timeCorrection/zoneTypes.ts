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
