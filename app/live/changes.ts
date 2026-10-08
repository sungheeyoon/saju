import { CHAT_UNREAD_MOVED } from '../me/chat/unread-signal';
import { READING_CREDITS_MOVED } from '../me/reading/credits-signal';
import { NOTIFICATIONS_UNREAD_MOVED, REQUESTS_TO_ANSWER_MOVED } from '../me/requests/unread-signal';

/**
 * 채널이 실어 오는 「무엇이 바뀌었나」 한 건과, 그것을 **어느 신호 · 어느 화면**으로 옮기는가(ADR 0155).
 *
 * 채널은 내용을 싣지 않는다 — 갈래(`area`) · 방(`match_id`) · 차례(`seq`)뿐이다. 받은 쪽은 그 갈래의 읽는 문을 다시
 * 불러 서버의 진실을 읽는다. 그래서 여기 표가 정하는 것은 「누가 다시 읽나」 하나다.
 */

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

/**
 * 갈래 → 머리글이 듣는 창 신호(각 신호 파일의 상수 그대로). 채팅은 딱지 말고도 방 · 목록이 듣는 채팅 신호
 * (`CHAT_MOVED`)를 따로 울린다 — 그것은 방과 차례를 실어서 드라이버가 따로 짓는다.
 */
const SIGNALS: Readonly<Record<Area, readonly string[]>> = {
  chat: [CHAT_UNREAD_MOVED],
  /*
    요청의 상태가 바뀌면 소식도 함께 선다(수락 · 거절 · 만료의 소식). 보낸 요청은 풀이권 한 자리를 잡고 거두거나 만료되면
    돌려준다(ADR 0038) — 셋 다 다시 센다.
  */
  requests: [REQUESTS_TO_ANSWER_MOVED, NOTIFICATIONS_UNREAD_MOVED, READING_CREDITS_MOVED],
  notifications: [NOTIFICATIONS_UNREAD_MOVED],
  credits: [READING_CREDITS_MOVED],
};

export const signalsOf = (area: Area): readonly string[] => SIGNALS[area];

/** 다시 대조할 때는 넷 다 다시 센다 */
export const ALL_SIGNALS: readonly string[] = [
  CHAT_UNREAD_MOVED,
  REQUESTS_TO_ANSWER_MOVED,
  NOTIFICATIONS_UNREAD_MOVED,
  READING_CREDITS_MOVED,
];

const within = (pathname: string, base: string): boolean => pathname === base || pathname.startsWith(`${base}/`);

/**
 * 갈래가 바뀌었을 때 **서버가 그리는 지금 화면을 다시 그려야 하나.**
 *
 * - 채팅 — 대화방 목록과 방 화면(넓은 화면의 왼쪽 목록 · 방이 닫혔나는 `my_chat_rooms` 가 든다).
 * - 요청 — 인연 탭과 그 아래(받은 요청 · 지난 인연), 소식, 인연 궁합 화면(완료 · 실패), 홈(안 읽은 소식 수),
 *   풀이 보관함(인연 궁합의 글), 대화방(수락으로 방이 선다).
 * - 소식 — 소식 화면과 홈.
 * - 풀이권 — 머리글만 그 값을 든다. 서버가 그리는 화면에는 없다.
 */
export function redrawsOn(area: Area, pathname: string): boolean {
  switch (area) {
    case 'chat':
      return within(pathname, '/me/chat');
    case 'requests':
      return (
        pathname === '/me' ||
        within(pathname, '/me/matching') ||
        within(pathname, '/me/requests') ||
        within(pathname, '/me/match') ||
        within(pathname, '/me/readings') ||
        within(pathname, '/me/chat')
      );
    case 'notifications':
      return pathname === '/me' || within(pathname, '/me/requests');
    case 'credits':
      return false;
  }
}

/** 다시 대조할 때 — 어느 갈래로든 다시 그리는 화면이면 한 번 다시 그린다 */
export const redrawsOnResync = (pathname: string): boolean => AREAS.some((area) => redrawsOn(area, pathname));
