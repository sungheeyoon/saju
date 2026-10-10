import type { SaveResult } from '../../save-result';

/**
 * **고르면 곧 저장하는 칸의 차례** — 저장하는 동안 또 고르면 마지막 값이 이긴다.
 *
 * 저장은 한 번에 하나씩 간다. 가는 동안 고른 값은 **마지막 하나만** 남겨 두었다가 앞 저장이 끝나면 보낸다 — 두 저장을
 * 나란히 보내면 늦게 떠난 것이 먼저 닿아 서버에 앞 값이 남을 수 있다. 칸을 잠그지 않는 것은 화살표로 고르는 사람의
 * 초점이 잠긴 칸에서 사라지기 때문이다.
 *
 * 실패하면 남겨 둔 값도 버리고(같은 까닭으로 막힐 것이다) 서버가 든 마지막 값을 `failed` 로 돌려준다 — 칸은 그리로 돌아간다.
 * 문이 값 대신 던지면(연결이 끊기면) 까닭을 모르므로 `unexpected` 를 까닭으로 같은 길을 간다. `saved` 는 **마지막으로 고른 값까지**
 * 저장된 때 한 번만 부른다 — 앞 값이 저장된 순간에 「저장했다」고 하면 뒤에 고른 값이 아직 안 간 것을 가린다.
 */
export function saveLatest<T extends string>(
  stored: T,
  save: (value: T) => Promise<SaveResult>,
  report: {
    busy: (busy: boolean) => void;
    saved: () => void;
    failed: (back: T, message: string) => void;
  },
  unexpected: string,
): (value: T) => void {
  let held = stored;
  let sending = false;
  let waiting: { value: T } | null = null;

  const send = async (first: T) => {
    sending = true;
    report.busy(true);
    let next: T | null = first;
    let outcome: { ok: true } | { ok: false; message: string } = { ok: true };
    while (next !== null) {
      const value: T = next;
      next = null;
      let result: SaveResult;
      try {
        result = await save(value);
      } catch {
        result = { ok: false, message: unexpected };
      }
      if (!result.ok) {
        outcome = { ok: false, message: result.message };
        break;
      }
      held = value;
      const queued = waiting as { value: T } | null;
      waiting = null;
      if (queued !== null && queued.value !== held) next = queued.value;
    }
    waiting = null;
    sending = false;
    report.busy(false);
    if (outcome.ok) report.saved();
    else report.failed(held, outcome.message);
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
