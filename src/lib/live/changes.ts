/**
 * 계정 채널의 약속 — 주제 · 사건 이름 · 실어 오는 것(ADR 0155). 웹의 라이브 층과 앱이 같은 값으로 듣는다.
 *
 * 채널은 내용을 싣지 않는다 — 갈래(`area`) · 방(`match_id`) · 차례(`seq`)뿐이다. 받은 쪽은 그 갈래의 읽는 문을 다시 불러 서버의 진실을
 * 읽는다. **듣기만 한다** — 보내는 것은 DB 트리거뿐이다.
 */
export const userTopic = (userId: string): string => `user:${userId}`;

/** 상태 콜백이 받는 값 — `SUBSCRIBED` 만 선 것이고 나머지는 실패다 */
export type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export const LIVE_EVENT = 'changed';

export const AREAS = ['chat', 'requests', 'notifications', 'credits'] as const;
export type Area = (typeof AREAS)[number];

export type LiveChange = {
  readonly area: Area;
  readonly matchId: string | null;
  readonly seq: number | null;
};

const isArea = (value: unknown): value is Area => typeof value === 'string' && (AREAS as readonly string[]).includes(value);

/**
 * 받은 payload 를 읽는다 — 모르는 모양은 `null` 이다(버린다). 모르는 갈래로 화면을 다시 그리면 무엇이 바뀌었는지
 * 모르는 채 요청만 는다. 빠진 것은 다음 다시 대조가 메운다.
 */
export function liveChangeOf(payload: unknown): LiveChange | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { area, match_id: matchId, seq } = payload as Record<string, unknown>;
  if (!isArea(area)) return null;
  if (matchId !== null && matchId !== undefined && typeof matchId !== 'string') return null;
  // bigint 는 JSON 에서 수나 글자로 온다 — 둘 다 받는다.
  const order = typeof seq === 'number' ? seq : typeof seq === 'string' && /^\d+$/.test(seq) ? Number(seq) : null;
  if (seq !== null && seq !== undefined && order === null) return null;
  return { area, matchId: matchId ?? null, seq: order };
}
