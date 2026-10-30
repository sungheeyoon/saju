/**
 * **못 남긴 읽음을 다시 시도하는 때**(ADR 0155 「읽음은 본 것까지만」).
 *
 * 읽음은 말풍선이 화면에 들 때 한 번 부른다. 그 한 번이 망 · DB 로 실패하면, 그 뒤로 새 말풍선이 들지 않는 한 아무도 다시
 * 부르지 않아 상대 쪽에는 안 읽은 수가 남고 내 딱지도 안 내려간다. 그래서 실패한 뒤에는 두 길로 다시 부른다.
 *
 * - **복구 신호** — 망이 돌아왔다(`online`), 라이브 층이 다시 대조했다(채팅 신호의 `matchId` 없음), 문서가 다시 보인다.
 *   신호마다 한 번이고 그때 뒤물림을 처음으로 되돌린다 — 신호는 밖에서 오므로 그 수가 곧 상한이다.
 * - **제한된 뒤물림** — 신호가 없어도 보이는 동안 2s · 4s · 8s · 16s · 30s 에 다시 부르고 그 다섯 번에서 멈춘다. 일시적인
 *   실패(배포 순간의 502 · 잠깐의 끊김)는 1분 안에 메우고, 오래 가는 실패(권한 거절 · 닫힌 방)는 다섯 번에서 그친다 —
 *   열어 둔 탭이 몇 시간 동안 DB 를 두드리지 않게. 상한 30초는 라이브 층의 대체 조회 간격(`FALLBACK_EVERY_MS`)과 같다.
 *
 * **숨은 탭에서는 부르지 않는다** — 차례가 와도 건너뛰고, 다시 보이면 그때 부른다(본 데까지만 남긴다는 약속).
 * 타이머만 들고 브라우저를 모른다 — vitest 의 가짜 시계로 잰다.
 */

/** 첫 다시 시도까지 — 그 뒤로 두 배씩 */
export const READ_RETRY_FIRST_MS = 2_000;
/** 다시 시도 간격의 상한 */
export const READ_RETRY_MAX_MS = 30_000;
/** 신호 없이 스스로 다시 부르는 최대 수 */
export const READ_RETRY_LIMIT = 5;

/** 연이어 `failures` 번 실패한 뒤 기다릴 시간 — 상한을 넘었으면 `null`(더 스스로 부르지 않는다) */
export function readRetryDelay(failures: number): number | null {
  if (failures < 1 || failures > READ_RETRY_LIMIT) return null;
  return Math.min(READ_RETRY_MAX_MS, READ_RETRY_FIRST_MS * 2 ** (failures - 1));
}

export type ReadRetry = {
  /** 남기기가 실패했다 — 보이는 동안 뒤물림 뒤에 다시 부른다 */
  readonly failed: () => void;
  /** 남겼다 — 뒤물림을 걷는다 */
  readonly succeeded: () => void;
  /** 복구 신호가 왔다 — 실패가 남아 있으면 곧장 다시 부른다 */
  readonly recovered: () => void;
  readonly stop: () => void;
};

export function startReadRetry(hands: { readonly attempt: () => void; readonly visible: () => boolean }): ReadRetry {
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    failed: () => {
      if (stopped) return;
      failures += 1;
      cancel();
      const delay = readRetryDelay(failures);
      if (delay === null) return;
      timer = setTimeout(() => {
        timer = null;
        if (!stopped && hands.visible()) hands.attempt();
      }, delay);
    },
    succeeded: () => {
      failures = 0;
      cancel();
    },
    recovered: () => {
      if (stopped || failures === 0 || !hands.visible()) return;
      failures = 0;
      cancel();
      hands.attempt();
    },
    stop: () => {
      stopped = true;
      cancel();
    },
  };
}
