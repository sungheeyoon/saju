import type { SaveResult } from '../../save-result';

/**
 * **고르면 곧 저장하는 칸의 차례** — 저장하는 동안 또 고르면 마지막 값이 이긴다(화면 점검 B16, 2026-10-10).
 *
 * 저장은 한 번에 하나씩 간다. 가는 동안 고른 값은 **마지막 하나만** 남겨 두었다가 앞 저장이 끝나면 보낸다 — 두 저장을
 * 나란히 보내면 늦게 떠난 것이 먼저 닿아 서버에 앞 값이 남을 수 있다. 칸을 잠그지 않는 것은 화살표로 고르는 사람의
 * 초점이 잠긴 칸에서 사라지기 때문이다.
 *
 * 실패하면 남겨 둔 값도 버리고(같은 까닭으로 막힐 것이다) 서버가 든 마지막 값을 `failed` 로 돌려준다 — 칸은 그리로 돌아간다.
 */
export function saveLatest<T extends string>(
  stored: T,
  save: (value: T) => Promise<SaveResult>,
  report: { busy: (busy: boolean) => void; failed: (back: T, message: string) => void },
): (value: T) => void {
  let held = stored;
  let sending = false;
  let waiting: { value: T } | null = null;

  const send = async (first: T) => {
    sending = true;
    report.busy(true);
    let next: T | null = first;
    try {
      while (next !== null) {
        const value: T = next;
        next = null;
        const result = await save(value);
        if (!result.ok) {
          waiting = null;
          report.failed(held, result.message);
          break;
        }
        held = value;
        const queued = waiting as { value: T } | null;
        waiting = null;
        if (queued !== null && queued.value !== held) next = queued.value;
      }
    } finally {
      /* 문이 던져도(연결이 끊겨도) 칸이 「저장하는 중」에 묶이지 않는다 */
      waiting = null;
      sending = false;
      report.busy(false);
    }
  };

  return (value: T) => {
    if (sending) {
      waiting = { value };
      return;
    }
    if (value === held) return;
    void send(value);
  };
}
