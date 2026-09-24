import type { ChatRoom } from '../chat/rooms';
import type { ChatMessage } from '../chat/[matchId]/messages';
import { EXAMPLE_CARDS } from '../matching/examples';
import type { DeckCard } from '../matching/matching-experience';
import type { InboxMatch } from '../requests/inbox';

/*
  **매칭 · 풀이 · 채팅 화면의 가짜 값** — 홈의 `fixtures.ts` 와 같은 규율이다: DB 를 안 읽고, 두 시안이 같은 값을 받는다.

  후보 카드는 `/me/matching/preview` 가 쓰는 예시 셋(`EXAMPLE_CARDS`, 사진 포함)을 그대로 쓴다. 대화방과 메시지는
  실제 문(`my_chat_rooms` · `messagesForViewer`)이 내주는 모양 그대로 지었다 — 닫힌 방 · 떠난 상대 · 긴 메시지 · 안 읽은 수를 섞었다.
*/

/** 매칭 — 오늘의 후보 카드 */
export const CARDS: readonly DeckCard[] = EXAMPLE_CARDS;

/** 풀이 목록 위에 서는 「함께 보는 궁합」 — 서로 동의해 만드는 중인 인연 궁합풀이 */
export const MAKING: readonly InboxMatch[] = [
  {
    matchId: 'preview-match-1',
    partnerUserId: 'example-seoyeon',
    nickname: '서연',
    intro: null,
    hasPhoto: true,
    suppliedToMe: '木',
    balanceLabel: '서로 비슷하게 채워 주는 사이',
    createdAt: '2026-09-24T11:20:00+09:00',
  },
];

export const ROOMS: readonly ChatRoom[] = [
  {
    matchId: 'preview-room-1',
    partnerUserId: 'example-seoyeon',
    partnerNickname: '서연',
    partnerLeft: false,
    partnerHasPhoto: true,
    openedAt: '2026-09-22T20:00:00+09:00',
    closedReason: null,
    lastMessageAt: '2026-09-24T12:48:00+09:00',
    lastMessageBody: '그 전시 이번 주말까지래요! 토요일 오후 어떠세요?',
    unread: 2,
    partnerActivity: 'now',
  },
  {
    matchId: 'preview-room-2',
    partnerUserId: 'example-jiwoo',
    partnerNickname: '지우',
    partnerLeft: false,
    partnerHasPhoto: true,
    openedAt: '2026-09-20T09:00:00+09:00',
    closedReason: null,
    lastMessageAt: '2026-09-23T22:10:00+09:00',
    lastMessageBody: '저도 궁합풀이 읽어 봤는데, 물과 불 이야기가 신기했어요. 서로 채워 주는 쪽이라니 다행이에요 ㅎㅎ 다음에 얘기 더 해요',
    unread: 0,
    partnerActivity: 'day',
  },
  {
    matchId: 'preview-room-3',
    partnerUserId: 'example-harin',
    partnerNickname: '하린',
    partnerLeft: false,
    partnerHasPhoto: true,
    openedAt: '2026-09-15T18:00:00+09:00',
    closedReason: null,
    lastMessageAt: null,
    lastMessageBody: null,
    unread: 0,
    partnerActivity: 'earlier',
  },
  {
    matchId: 'preview-room-4',
    partnerUserId: null,
    partnerNickname: '',
    partnerLeft: true,
    partnerHasPhoto: false,
    openedAt: '2026-09-02T18:00:00+09:00',
    closedReason: 'deletion_request',
    lastMessageAt: '2026-09-05T10:02:00+09:00',
    lastMessageBody: '좋은 하루 보내세요!',
    unread: 0,
    partnerActivity: null,
  },
];

let seq = 0;
function message(mine: boolean, body: string, createdAt: string): ChatMessage {
  seq += 1;
  return { messageId: `preview-msg-${seq}`, seq, mine, fromLeftPartner: false, body, createdAt };
}

/** 첫 방(서연)의 대화 — 날짜가 바뀌는 자리와 연달아 보낸 메시지를 섞었다 */
export const MESSAGES: readonly ChatMessage[] = [
  message(false, '안녕하세요! 궁합풀이 보고 먼저 인사드려요 :)', '2026-09-22T20:05:00+09:00'),
  message(true, '안녕하세요, 반가워요. 저도 읽어 봤어요. 나무 기운을 채워 준다는 말이 기억에 남네요.', '2026-09-22T20:11:00+09:00'),
  message(false, '맞아요. 저는 겨울에 태어나서 물이 많대요 ㅎㅎ', '2026-09-22T20:12:00+09:00'),
  message(false, '혹시 전시 좋아하세요?', '2026-09-22T20:12:30+09:00'),
  message(true, '좋아해요! 요즘은 사진전을 자주 봐요.', '2026-09-23T08:40:00+09:00'),
  message(false, '성수에 새로 연 사진전 있는데 평이 좋더라고요.', '2026-09-24T12:47:00+09:00'),
  message(false, '그 전시 이번 주말까지래요! 토요일 오후 어떠세요?', '2026-09-24T12:48:00+09:00'),
];
