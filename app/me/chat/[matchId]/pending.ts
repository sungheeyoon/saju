import { RATE_LIMITED_TEXT, type SendOutcome } from '@/src/lib/chat';

import type { ChatMessage } from './messages';

/**
 * **내가 보낸, 아직 읽혀 오지 않은 말** — 누르는 순간 화면에 서고, 서버가 남긴 말이 읽혀 오면 그 자리를 잇는다(ADR 0155 덧).
 *
 * 카카오톡의 방식이다(운영자 2026-10-11). 보내는 중인 말은 확정된 말과 **같은 모양**이고(흐리지 않다) 시각 자리만 비어 있다.
 * 못 보냈으면 **제자리에 남아** 곁에 실패 단추가 서고, 다시 보내거나 지운다 — 쓰던 글을 칸에 되돌리지 않는다. 실패한 말은 이
 * 화면의 상태일 뿐이라 새로고침하면 사라진다(브라우저에 적지 않는다).
 *
 * - `id` — 전송마다 브라우저가 지은 uuid. 서버에 함께 실려 같은 id 는 한 번만 남고(`send_chat_message` 의 셋째 칸), 읽혀 온
 *   **내** 말 가운데 같은 `clientId` 가 짝이다. 본문으로 짝짓지 않으므로 같은 말을 연달아 보내도 섞이지 않고, 실패로 보였지만
 *   서버는 받은 말(응답만 잃었다)이 읽혀 오면 실패 자리도 걷힌다.
 * - `state` — `sending`(답을 기다린다) · `accepted`(서버가 받았고 아직 안 읽혀 왔다 — 시각이 선다) · `failed`.
 */
export type PendingState = 'sending' | 'accepted' | 'failed';

export type Pending = {
  readonly id: string;
  readonly body: string;
  readonly sentAt: string;
  readonly state: PendingState;
};

export function settlePending(pending: readonly Pending[], messages: readonly ChatMessage[]): readonly Pending[] {
  if (pending.length === 0) return pending;
  const arrived = new Set<string>();
  for (const message of messages) if (message.mine && message.clientId !== null) arrived.add(message.clientId);
  if (arrived.size === 0) return pending;
  const left = pending.filter((one) => !arrived.has(one.id));
  return left.length === pending.length ? pending : left;
}

/** 한 전송의 상태를 바꾼다 — 이미 걷힌 것이면 그대로다 */
export function withState(pending: readonly Pending[], id: string, state: PendingState): readonly Pending[] {
  return pending.map((one) => (one.id === id && one.state !== state ? { ...one, state } : one));
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
    clientId: one.id,
  };
}

export function withPending<T extends ChatMessage>(messages: readonly T[], pending: readonly Pending[]): readonly (T | ChatMessage)[] {
  if (pending.length === 0) return messages;
  return [...messages, ...pending.map(pendingMessage)];
}

/** 보내기 액션의 답 — `actions.ts` 의 `sendChatMessage` 가 내는 모양 그대로다 */
export type SendResult = { ok: true; outcome: SendOutcome } | { ok: false; message: string };

/**
 * 한 전송의 답을 화면의 갈래로 — 받았다 · 방이 닫혔다 · 못 보냈다(곁에 세울 문장이 있으면 함께).
 *
 * 한도는 실패다 — 다시 보내기로 잠시 뒤 보낼 수 있다. 닫힘은 다시 보낼 수 없는 실패라 방이 다시 그려져 닫힌 까닭을 세운다.
 */
export type SendVerdict =
  | { readonly kind: 'accepted' }
  | { readonly kind: 'closed' }
  | { readonly kind: 'failed'; readonly message: string | null };

export function verdictOf(result: SendResult): SendVerdict {
  if (!result.ok) return { kind: 'failed', message: result.message };
  if (result.outcome === 'rate_limited') return { kind: 'failed', message: RATE_LIMITED_TEXT };
  if (result.outcome === 'closed') return { kind: 'closed' };
  return { kind: 'accepted' };
}

/** 이만큼 답이 없으면 실패로 세운다 — 서버가 늦게 받았어도 같은 id 라 다시 보내기가 두 번 남기지 않는다 */
export const SEND_DEADLINE_MS = 15_000;

export class SendDeadlinePassed extends Error {
  constructor() {
    super('chat: the send took too long');
  }
}

/** 일이 시한 안에 끝나면 그 답, 아니면 `SendDeadlinePassed` 로 진다 — 늦게 온 답은 버린다 */
export function withinDeadline<T>(work: Promise<T>, ms: number = SEND_DEADLINE_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SendDeadlinePassed()), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (thrown: unknown) => {
        clearTimeout(timer);
        reject(thrown);
      },
    );
  });
}

/**
 * 전송의 id — uuid v4. `crypto.randomUUID` 는 보안 맥락(https · localhost)에만 있어, 없으면 같은 모양을 무작위 바이트로 짓는다.
 */
export function newClientId(source: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto): string {
  if (typeof source.randomUUID === 'function') return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
