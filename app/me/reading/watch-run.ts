/**
 * **도는 시도를 지켜보는 고리** — 언제 묻는가만 든다(ADR 0016 덧). 무엇을 묻고 답으로 무엇을 하는가는 부르는 칸이 든다.
 *
 * 셋을 지킨다.
 *
 * - **답이 온 뒤에 다음을 잡는다.** 간격마다 쏘면 응답이 간격을 넘는 날 물음이 겹치고, Next 는 서버 액션을 클라이언트마다
 *   하나씩 차례로 보내므로 그동안 사용자가 누른 다른 액션이 그 뒤에 선다.
 * - **숨긴 탭에서는 안 묻는다.** 아무도 안 보는 화면에 3초마다 왕복을 쓴다. 다시 보이면 간격을 기다리지 않고 곧바로 한 번
 *   묻는다 — 숨긴 사이에 끝났을 수 있다.
 * - **멈추면 다시는 안 묻는다.** 떠난 칸에서 답이 늦게 와도 다음을 잡지 않는다.
 *
 * DOM 을 모른다 — 보이는가는 `visibility` 가 답한다. 그래서 가짜 타이머와 손으로 든 값으로 그대로 잰다(`watch-run.test.ts`).
 */

/** 탭이 보이는가와 그 바뀜 — 브라우저에서는 `document` 의 `visibilitychange` 다 */
export type PageVisibility = {
  readonly hidden: () => boolean;
  /** 바뀔 때마다 부른다. 돌려준 함수가 듣기를 걷는다 */
  readonly onChange: (listener: () => void) => () => void;
};

/** 묻는 간격 — 4분짜리 일에 1초짜리 왕복은 값만 쓴다(ADR 0016) */
export const RUN_ASK_EVERY_MS = 3000;

/**
 * 지켜보기를 연다 — 첫 물음은 한 간격 뒤다(화면을 연 그 왕복이 이미 지금을 읽었다). 돌려준 함수가 멈춘다.
 *
 * `ask` 가 던져도 고리는 다음 물음으로 간다 — 한 번 못 물은 것으로 끝났다고 하지 않는다.
 */
export function watchRun({
  ask,
  everyMs = RUN_ASK_EVERY_MS,
  visibility,
}: {
  ask: () => Promise<void>;
  everyMs?: number;
  visibility: PageVisibility;
}): () => void {
  let alive = true;
  let asking = false;
  let wasHidden = visibility.hidden();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  };

  const later = () => {
    if (!alive || asking || timer !== null || visibility.hidden()) return;
    timer = setTimeout(now, everyMs);
  };

  async function now(): Promise<void> {
    timer = null;
    if (!alive || asking) return;
    asking = true;
    try {
      await ask();
    } catch {
      /* 묻는 칸이 제 실패를 받는다 — 여기서는 고리가 끊기지 않게만 한다 */
    } finally {
      asking = false;
    }
    later();
  }

  const stopListening = visibility.onChange(() => {
    if (!alive) return;
    const hidden = visibility.hidden();
    const cameBack = wasHidden && !hidden;
    wasHidden = hidden;

    if (hidden) cancel();
    /* 묻는 중이면 그 답이 곧 온다 — 답이 온 뒤에 다음을 잡는다 */
    else if (cameBack && !asking) {
      cancel();
      void now();
    }
  });

  later();

  return () => {
    alive = false;
    cancel();
    stopListening();
  };
}
