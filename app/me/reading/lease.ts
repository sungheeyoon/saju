/**
 * 회수가 일감 하나를 쥐는 시간의 **상한** — 그 상한이 DB 의 임대(`reading_job_lease()`, 150초)보다 짧아야 산 작업자의 일감을
 * 남이 다시 집지 않는다(ADR 0201).
 *
 * 쥐는 동안 하는 일은 넷이다 — 집기의 답을 받고, 회수하고(조회), 검사하고(밀리초), 적는다. 적기는 **두 번까지**다 — 저장이
 * 답을 못 받으면 놓고, 거절되면 실패로 닫는다(`collect.ts`). 기다림이 있는 것은 망을 지나는 부름이고, 모두 여기서 상한을 정한다.
 * 검사는 셈하지 않는다.
 *
 * 상한을 넘겨도 틀린 값은 안 남는다 — 저장 · 실패는 지금 쥔 작업자만 하고, 시도는 한 번만 끝난다. 넘기면 같은 결과를 둘이
 * 회수하는 낭비가 생길 뿐이다.
 */

/**
 * 회수 조회 한 번 — **10초 · 다시 1번.** 상한은 시도마다 머리와 본문을 함께 덮는다(`openai` 7.8 `client.js` 의
 * `makeRequest` 가 시도마다 시각을 새로 재고, `parseResponseWithTimeout` 이 본문 읽기를 같은 시한과 겨룬다). 끝난 응답을 읽는
 * GET 이라 보통 1초 안이다. SDK 기본값(10분 · 다시 2번)이면 복구기
 * (`maxDuration` 300초)와 webhook(60초)보다 길어 일감 하나가 뒤를 다 밀었다.
 */
export const RETRIEVE_REQUEST = { timeout: 10_000, maxRetries: 1 } as const;

/**
 * SDK 가 다시 보내기 전에 기다리는 가장 긴 시간 — provider 가 `retry-after` 로 60초 이하를 말하면 그대로 따르고, 그보다 길거나
 * 없으면 제 셈(0.5초부터 두 배씩, 8초까지)을 쓴다(`openai` 7.8 의 `retryRequest`).
 */
export const RETRY_WAIT_CAP_MS = 60_000;

/** 열쇠로 부르는 DB 문 한 번 — 10초. 넘으면 끊고 일시 장애로 본다(저장이 됐을 수 있다 — DB 가 두 번째를 막는다) */
export const DB_CALL_MS = 10_000;

/** DB 의 임대 — `reading_job_lease()` 와 같은 값이다(`lease.test.ts` 가 마이그레이션의 값과 견주고, pgTAP 이 DB 쪽을 잰다) */
export const READING_JOB_LEASE_MS = 150_000;

/** 복구기가 기한을 넘긴 일감을 닫는 시간 — `reading_job_deadline()`, 8분. 임대가 이보다 짧아야 기한 전에 다시 집는다 */
export const READING_JOB_DEADLINE_MS = 8 * 60_000;

/** 회수 뒤 적기 — 저장 하나, 그것이 답을 못 받거나 거절되면 놓기나 실패 하나 */
export const WRITES_AFTER_RETRIEVE = 2;

/**
 * 집은 시각부터 마지막으로 적을 때까지 — 집기의 답(DB 한 번) + 회수(시도마다 상한, 사이마다 기다림) + 적기(DB 두 번).
 * 지금 값은 10 + (10 × 2 + 60) + 10 × 2 = 110초다.
 */
export const HOLD_BOUND_MS =
  DB_CALL_MS
  + RETRIEVE_REQUEST.timeout * (RETRIEVE_REQUEST.maxRetries + 1)
  + RETRY_WAIT_CAP_MS * RETRIEVE_REQUEST.maxRetries
  + DB_CALL_MS * WRITES_AFTER_RETRIEVE;
