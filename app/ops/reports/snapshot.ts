import type { Side } from './labels';

/** 스냅샷의 한 줄 — 신고 당시 베낀 본문 그대로다(ADR 0091) */
export type SnapshotMessage = {
  readonly seq: number;
  readonly sentAt: string;
  /** 두 계정 중 어느 쪽인가 — 어느 쪽에도 안 대어지면 `null` */
  readonly side: Side | null;
  readonly body: string;
  /** 신고한 사람이 고른 메시지 — 스냅샷에 정확히 하나다 */
  readonly chosen: boolean;
};

/**
 * 고른 표시는 **하나만** 남긴다 — 베끼는 문이 하나만 적지만(`report_chat_message`), 둘이 서면 운영자는
 * 어느 것이 신고된 말인지 가를 수 없다. 첫 것만 남기고 나머지는 문맥으로 읽는다.
 */
export function chosenOnce(messages: readonly SnapshotMessage[]): readonly SnapshotMessage[] {
  const first = messages.findIndex((message) => message.chosen);
  return messages.map((message, at) =>
    message.chosen && at !== first ? { ...message, chosen: false } : message,
  );
}
