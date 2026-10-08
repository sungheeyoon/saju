import type { ChatMessage } from './messages';

/**
 * **보내는 중인 내 말** — 누르는 순간 화면에 서고, 서버가 받은 뒤 읽혀 온 진짜 말이 그 자리를 잇는다.
 *
 * 보낸 사람의 말은 서버 액션 한 번 · 다시 읽기 한 번이 끝나야 섰다(ADR 0155 — 채널은 「바뀌었다」만 알린다). 그동안 입력 칸에
 * 글자가 남아 있어 「입력하고 좀 있다 뜬다」로 읽혔다(운영자 2026-10-08). 화면은 먼저 그리고, 맞추는 규칙은 여기 하나다.
 *
 * - `after` — 보낼 때 가진 가장 큰 차례. 그 뒤에 읽혀 온 **내** 말 가운데 본문이 같은 것이 짝이다(보내기 전 같은 말 · 상대의 같은
 *   말은 짝이 아니다). 진짜 말 하나는 보내는 중 하나만 걷는다 — 같은 말을 두 번 보내면 두 번 읽혀 와야 둘 다 걷힌다.
 * - 실패한 보내기는 방이 걷는다 — 이 목록은 「서버가 받았다고 아직 안 읽힌 말」만 든다.
 */
export type Pending = {
  readonly id: string;
  readonly body: string;
  readonly after: number;
  readonly sentAt: string;
};

export function settlePending(pending: readonly Pending[], messages: readonly ChatMessage[]): readonly Pending[] {
  if (pending.length === 0) return pending;
  const used = new Set<string>();
  const left = pending.filter((one) => {
    const real = messages.find((m) => m.mine && m.seq > one.after && m.body === one.body && !used.has(m.messageId));
    if (real === undefined) return true;
    used.add(real.messageId);
    return false;
  });
  return left.length === pending.length ? pending : left;
}

/** 보내는 중인 말을 화면의 말 모양으로 — 차례는 가진 어느 말보다 뒤다(읽음 표시는 상대 말의 차례만 센다) */
export function pendingMessage(one: Pending): ChatMessage {
  return {
    messageId: one.id,
    seq: Number.MAX_SAFE_INTEGER,
    mine: true,
    fromLeftPartner: false,
    body: one.body,
    createdAt: one.sentAt,
  };
}

export function withPending<T extends ChatMessage>(messages: readonly T[], pending: readonly Pending[]): readonly (T | ChatMessage)[] {
  if (pending.length === 0) return messages;
  return [...messages, ...pending.map(pendingMessage)];
}
