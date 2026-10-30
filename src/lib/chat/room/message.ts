/**
 * 방 안의 말 한 건 — 웹과 앱이 같은 모양으로 읽는다. 읽는 문(`my_chat_messages`)을 부르는 일은 양쪽 문이 하고(ADR 0091), 여기는 그 줄을
 * 도메인 말로 옮길 뿐이다.
 */

/** 한 번에 읽는 메시지 수 — 함수의 상한과 같다. 이보다 적게 왔으면 그 앞은 없다 */
export const MESSAGE_WINDOW = 200;

export type ChatMessage = {
  readonly messageId: string;
  readonly seq: number;
  readonly mine: boolean;
  /**
   * 보낸 사람이 떠났다 — 보낸 사람 칸이 비었다(ADR 0094). 그 줄에는 신고가 안 선다 — 신고당할
   * 계정이 없고, DB 도 받지 않는다.
   */
  readonly fromLeftPartner: boolean;
  readonly body: string;
  readonly createdAt: string;
  /**
   * 보낸 사람이 전송마다 지은 id — **내 말에만** 온다(상대의 말 · 옛 말은 `null`). 방은 보내는 중인 말과 읽혀 온 말을 이것으로
   * 짝짓고, 서버는 같은 id 를 두 번 남기지 않는다(`20261201090000`, ADR 0155 덧).
   */
  readonly clientId: string | null;
};

/** 읽는 문의 한 줄 — 생성 타입은 `client_id` 를 `string` 으로 적지만 남의 말 · 옛 말은 비어 온다 */
type MessageRow = {
  readonly message_id: string;
  readonly seq: number;
  readonly mine: boolean | null;
  readonly sender_user_id: string | null;
  readonly body: string;
  readonly created_at: string;
  readonly client_id: string | null;
};

const messageOf = (row: MessageRow): ChatMessage => ({
  messageId: row.message_id,
  seq: row.seq,
  mine: row.mine === true,
  fromLeftPartner: row.mine !== true && row.sender_user_id === null,
  body: row.body,
  createdAt: row.created_at,
  clientId: row.client_id ?? null,
});

/** 오래된 것이 먼저다 — `seq` 는 방마다 이어지는 번호가 아니라 표 전체의 차례다 */
export const messagesOf = (rows: readonly MessageRow[]): readonly ChatMessage[] =>
  rows.map(messageOf).sort((a, b) => a.seq - b.seq);
