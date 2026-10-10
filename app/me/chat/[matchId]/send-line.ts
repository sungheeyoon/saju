import { SEND_DEADLINE_MS, UNREACHED, verdictOf, withFailure, withState, type Pending, type SendResult, type SendVerdict } from './pending';

/** 한 번의 전송이 낸 갈래 — `overdue` 는 떠난 말이 시한 안에 답을 못 받은 것이다(서버에 남았을 수 있다) */
export type LineReport = SendVerdict | { readonly kind: 'overdue' };

/** 줄의 알림을 보낼 말 목록에 — 시한을 넘긴 말은 서버에 남았을 수 있다는 표지를 켠다 */
export function heard(pending: readonly Pending[], id: string, outcome: LineReport): readonly Pending[] {
  if (outcome.kind === 'accepted') return withState(pending, id, 'accepted');
  if (outcome.kind === 'overdue') return withFailure(pending, id, true);
  if (outcome.kind === 'closed') return withFailure(pending, id, false);
  return withFailure(pending, id, outcome.mightBeKept);
}

export type SendLine = {
  /** 줄 끝에 선다 — 앞의 전송이 끝나야 떠난다. 다시 보내기도 같은 id 로 여기 선다 */
  readonly enqueue: (id: string, body: string) => void;
};

/**
 * **방의 보내기 줄** — 한 번에 한 말만 서버로 떠나보내고, 그 부름이 정말 끝나야 다음 말이 떠난다.
 *
 * Next 는 한 클라이언트의 서버 액션을 차례로 하나씩 보낸다. 줄을 Next 에 맡기면 앞의 말이 늦을 때 뒤의 말은 떠나지도 않았는데
 * 시한이 차서 실패로 서고, 사람이 그 말을 지운 뒤에 Next 가 그대로 보내 버린다. 그래서 줄은 여기 있고:
 *
 * - 시한(`SEND_DEADLINE_MS`)은 떠난 말에만 센다 — 줄에 선 말은 「보내는 중」 그대로다.
 * - 시한이 지나도 다음 말을 떠나보내지 않는다 — 늦은 부름이 Next 의 줄을 아직 잡고 있다. 그 부름이 끝나면(늦은 답 · 망 오류) 떠난다.
 * - 늦게 온 답은 「받았다」면 알리고, 그 사이 같은 id 가 다시 줄에 서지 않았으면 실패도 알린다(남았을 수 있다는 표지는 그대로다).
 *
 * `transmit` 은 던지지 않는 부름이어야 한다(`actionAnswer` 를 지난 것). 던지면 닿지 못한 것으로 받는다.
 */
export function sendLine(
  transmit: (id: string, body: string) => Promise<SendResult>,
  report: (id: string, outcome: LineReport) => void,
  deadlineMs: number = SEND_DEADLINE_MS,
): SendLine {
  const waiting: { readonly id: string; readonly body: string; readonly attempt: number }[] = [];
  const latest = new Map<string, number>();
  let attempts = 0;
  let busy = false;

  const pump = () => {
    if (busy) return;
    const next = waiting.shift();
    if (next === undefined) return;
    busy = true;
    const current = () => latest.get(next.id) === next.attempt;
    const timer = setTimeout(() => {
      if (current()) report(next.id, { kind: 'overdue' });
    }, deadlineMs);
    const settle = (answer: SendResult) => {
      clearTimeout(timer);
      busy = false;
      const verdict = verdictOf(answer);
      if (verdict.kind === 'accepted' || current()) report(next.id, verdict);
      pump();
    };
    transmit(next.id, next.body).then(settle, () => settle(UNREACHED));
  };

  return {
    enqueue(id, body) {
      attempts += 1;
      latest.set(id, attempts);
      waiting.push({ id, body, attempt: attempts });
      pump();
    },
  };
}
