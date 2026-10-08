import type { ChatMessage } from './messages';

/**
 * 방이 든 메시지를 **합치고 세우는** 규칙 — 채널이 「새 메시지」를 알리면 방은 읽는 문을 다시 불러 여기서 합친다
 * (ADR 0155). 같은 메시지가 두 번 와도(채널 · 다시 대조 · 보낸 뒤 읽기가 겹친다) 한 번만 서고, 차례(`seq`)로 선다.
 *
 * 브라우저도 React 도 모른다 — vitest 가 중복 · 순서 · 빈 자리를 그대로 잰다.
 */

/** 가진 것과 새로 읽은 것을 `messageId` 로 합쳐 `seq` 로 세운다. 이미 가진 것은 가진 그대로 둔다(붙여 둔 글자가 산다) */
export function mergeMessages<T extends ChatMessage>(have: readonly T[], incoming: readonly T[]): readonly T[] {
  if (incoming.length === 0) return have;
  const byId = new Map<string, T>();
  for (const message of have) byId.set(message.messageId, message);
  let added = false;
  for (const message of incoming) {
    if (byId.has(message.messageId)) continue;
    byId.set(message.messageId, message);
    added = true;
  }
  if (!added) return have;
  return [...byId.values()].sort((a, b) => a.seq - b.seq);
}

/** 가진 것 중 가장 큰 차례 — 없으면 0(차례는 1 부터다) */
export const newestSeq = (messages: readonly ChatMessage[]): number => messages.at(-1)?.seq ?? 0;

/** 가진 것 중 가장 작은 차례 — 없으면 `null` */
export const oldestSeq = (messages: readonly ChatMessage[]): number | null => messages[0]?.seq ?? null;

/**
 * 이 알림에 다시 읽어야 하나 — 차례를 모르면(다시 대조 · 방 상태) 읽고, 알면 가진 것보다 클 때만 읽는다.
 * 내가 보낸 메시지의 알림이 보낸 뒤 읽기보다 늦게 오면 여기서 걸러진다.
 */
export const needsNewer = (have: readonly ChatMessage[], seq: number | null): boolean =>
  seq === null || seq > newestSeq(have);

/** 한 쪽을 읽는 손 — `before` 를 주면 그 앞, 안 주면 가장 최근부터. 오래된 것이 먼저 온다 */
export type ReadPage = (page: { readonly before?: number; readonly limit: number }) => Promise<readonly ChatMessage[]>;

/**
 * 가진 가장 큰 차례 **뒤**의 것을 빠짐없이 읽는다.
 *
 * 가장 최근 한 쪽을 읽고, 그 쪽이 가득 찼는데 가장 작은 차례가 가진 것보다 아직 크면 사이가 비었을 수 있다 — 그 앞을
 * 더 읽는다. 차례는 방마다 이어지는 번호가 아니라서 「두 차례 사이가 떴다」로는 빈 자리를 못 가른다. 그래서 쪽이
 * 가득 찼는가로 가른다. 끊긴 동안 쌓인 수백 건도 이렇게 다 온다.
 */
export async function readNewer(read: ReadPage, after: number, limit: number): Promise<readonly ChatMessage[]> {
  const pages: ChatMessage[] = [];
  let before: number | undefined;
  for (;;) {
    const page = await read(before === undefined ? { limit } : { before, limit });
    const fresh = page.filter((message) => message.seq > after);
    pages.push(...fresh);
    const smallest = page[0]?.seq;
    if (page.length < limit || smallest === undefined || smallest <= after) return pages;
    before = smallest;
  }
}

/**
 * 읽음을 어디까지 남길까 — **보이는 문서에서 화면에 들어온 상대 말의 가장 큰 차례**, 그리고 이미 남긴 것보다 클 때만
 * (ADR 0155 「읽음은 본 것까지만」). 숨은 탭은 남기지 않는다 — 다시 보이면 그때 잰다.
 */
export function readUpTo(seen: Iterable<number>, visible: boolean, marked: number): number | null {
  if (!visible) return null;
  let most = 0;
  for (const seq of seen) if (seq > most) most = seq;
  return most > marked ? most : null;
}

/**
 * 방에 들어왔을 때 이미 읽은 데까지 — 서버가 안 읽은 수를 0 으로 주면 가진 상대 말 전부가 읽힌 것이다. 아니면 모른다
 * (0 — 화면에 들어온 것부터 남긴다. 함수는 앞으로만 움직이므로 다시 남겨도 뒤로 가지 않는다).
 */
export function readAlready(messages: readonly ChatMessage[], unread: number): number {
  if (unread > 0) return 0;
  let most = 0;
  for (const message of messages) if (!message.mine && message.seq > most) most = message.seq;
  return most;
}
