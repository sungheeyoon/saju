/**
 * **스낵바의 상태** — 한 번에 하나 · 4초 · 단추 하나(ADR 0109 추기 2026-10-24 「바닥 스낵바」).
 *
 * 그리는 쪽(`app/ui/snackbar.tsx` 의 `SnackbarHost`)과 나누어 둔 것은 시계와 차례를 DOM 없이 재려고다(`snackbar-store.test.ts`).
 * 값은 당근 SEED Snackbar 를 따랐다 — 기본 4초 · 새 것이 오면 지금 것을 바꿔 세운다(React 구현의 `immediate`) · 누르고 있거나
 * 초점이 있으면 시계가 선다(`pauseOnInteraction`) · 단추는 하나(seed-design.io/components/snackbar, 2026-10-25 확인).
 */

/** 서 있는 시간 — SEED 의 기본값. 단추가 있어도 같다(눌러야 하는 일은 스낵바에 두지 않는다) */
export const SNACKBAR_SHOWN_MS = 4000;

/** 스낵바의 단추 하나 — 「되돌리기」처럼 하는 일을 말하는 한두 낱말(「확인」 · 「취소」는 쓰지 않는다, SEED) */
export type SnackbarAction = { label: string; onAction: () => void };

export type Snack = { id: number; message: string; action: SnackbarAction | null };

type Timers = {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
  now: () => number;
};

const realTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

export function createSnackbarStore(timers: Timers = realTimers) {
  let current: Snack | null = null;
  let nextId = 1;
  let handle: unknown = null;
  /** 시계가 다 가기까지 남은 시간 — 멈췄다 다시 갈 때 처음부터 세지 않는다 */
  let remaining = SNACKBAR_SHOWN_MS;
  let startedAt = 0;
  let paused = false;
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());

  const stopClock = () => {
    if (handle !== null) timers.clear(handle);
    handle = null;
  };

  const startClock = () => {
    stopClock();
    startedAt = timers.now();
    const id = current?.id;
    handle = timers.set(() => dismiss(id), remaining);
  };

  function show(message: string, action: SnackbarAction | null = null): number {
    const id = nextId++;
    current = { id, message, action };
    remaining = SNACKBAR_SHOWN_MS;
    /* 멈춘 채 바뀌면(손가락이 앞 것 위에 있었다) 새 것도 멈춘 채 선다 — 손을 떼면 간다 */
    if (paused) stopClock();
    else startClock();
    emit();
    return id;
  }

  /** 걷는다 — `id` 를 주면 그 스낵바일 때만(늦게 온 시계가 새것을 걷지 않게) */
  function dismiss(id?: number): void {
    if (current === null) return;
    if (id !== undefined && current.id !== id) return;
    stopClock();
    current = null;
    emit();
  }

  /** 누르고 있거나 초점이 들어왔다 — 시계를 세운다 */
  function pause(): void {
    if (paused) return;
    paused = true;
    if (current === null || handle === null) return;
    remaining = Math.max(0, remaining - (timers.now() - startedAt));
    stopClock();
  }

  function resume(): void {
    if (!paused) return;
    paused = false;
    if (current !== null) startClock();
  }

  /** 단추를 눌렀다 — 그 일을 하고 걷는다 */
  function act(): void {
    const shown = current;
    if (shown?.action == null) return;
    dismiss(shown.id);
    shown.action.onAction();
  }

  return {
    show,
    dismiss,
    pause,
    resume,
    act,
    get: (): Snack | null => current,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** 앱에 하나 — 뿌리 레이아웃의 `SnackbarHost` 가 이것을 그린다 */
export const snackbar = createSnackbarStore();

/**
 * 끝난 일을 바닥에 잠깐 말한다 — 「보낸 요청을 거뒀어요.」 · 단추 하나(「되돌리기」).
 *
 * **곁의 한 줄(`DoneNote`)이 먼저다.** 말할 자리가 그대로 서 있으면 그 곁이 가깝다. 스낵바는 그 자리가 사라지는 일
 * (거둔 요청의 카드가 목록에서 빠진다)이나 되돌릴 길을 함께 줄 때 쓴다. 완료 안내는 그 일이 성공한 뒤에만 선다(대장 01).
 */
export function showSnackbar(message: string, action?: SnackbarAction): number {
  return snackbar.show(message, action ?? null);
}
