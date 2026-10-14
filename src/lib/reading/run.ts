/**
 * **마지막 시도의 모양** — 문(`app/me/reading/current.ts` 의 `lastReadingRun`)이 DB 의 줄을 이 모양으로 옮긴다.
 */

/** 시도의 상태 셋 — `reading_run.status` 의 check 제약과 같다. 모르는 상태는 문이 「시도 없음」으로 읽는다 */
export const RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;

export type LastRun = {
  readonly status: (typeof RUN_STATUSES)[number];
  readonly failureCode: string | null;
  readonly createdAt: string;
  /**
   * 도는 동안 **서버가 적은 진행** — 끝난 시도면 `null` 이다(얼린 작업이 함께 지워진다, ADR 0127).
   *
   * 셋 다 서버가 적은 값 그대로다. 화면이 시간으로 채우는 자리가 없다.
   */
  readonly progress: RunProgress | null;
};

export type RunProgress = {
  /** 얼린 작업의 상태(`frozen · preparing · submitting · submitted · retrieving`) — 모르는 값도 그대로 싣는다 */
  readonly jobStatus: string | null;
  /** 시작한 절의 수 — 소제목(`## `)이 선 수 */
  readonly sectionsBegun: number;
  /** 본문을 다 썼다 — 검사용 근거 절이 섰거나 본문이 닫혔다 */
  readonly bodyWritten: boolean;
};
