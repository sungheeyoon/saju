import { REPORT_DETAIL_MAX, REPORT_NOTE, REPORT_REASONS } from '@/src/lib/account';
import {
  CHAT_EMPTY_DETAIL,
  CHAT_EMPTY_TITLE,
  CHAT_INPUT_PLACEHOLDER,
  CHAT_POLICY,
  CHAT_SEND_LABEL,
  CHAT_TAB_LABEL,
  messageTimeLabel,
  partnerNameOf,
  roomHeadingOf,
  roomNoticeOf,
} from '@/src/lib/chat';
import { BLOCK_NOTE } from '@/src/lib/consent';
import { activityText, ACTIVITY_BANDS } from '@/src/lib/presence';
import { initialOf } from '@/src/lib/profile';

import type { ChatMessage } from '../../../../chat/[matchId]/messages';
import type { ChatRoom } from '../../../../chat/rooms';
import type { VariantProps } from '../..';
import { previewHref } from '../../../shared/preview-href';
import { orbitModelOf } from '../model';
import { ChatView, type ChatCopy, type MessageView, type RoomView } from './chat-view';
import { BottomBar, TopBar } from './menu';

/*
  **3차 · 관계 지도의 채팅 — 대화 중인 인연도 나를 도는 점이다.**

  홈에서 저장한 사람이 나를 돌았듯, 여기서는 **대화방이 열린 상대**가 한 궤도를 돈다. 궤도 띠는 목록의
  머리일 뿐이고 주인공은 목록과 방이다 — 데스크톱은 두 칸, 폰은 한 화면 안에서 목록 ↔ 방을 바꾼다.

  시각 · 날짜 · 닫힌 까닭은 **서버가 접어 넘긴다**(`RoomView`) — 브라우저가 시간대를 다시 재면 첫 그림과
  어긋난다. 문구는 전부 `COPY` 에 모았고 새 것과 기존 것의 구분은 `NOTES.md` 의 표가 든다.
*/

const COPY: ChatCopy = {
  title: CHAT_TAB_LABEL,
  stripTitle: '지금 대화 중인 인연',
  me: '나',
  activity: Object.fromEntries(ACTIVITY_BANDS.map((band) => [band, activityText(band)])) as ChatCopy['activity'],
  closedGroup: '닫힌 방',
  back: CHAT_TAB_LABEL,
  together: '함께 보는 궁합',
  more: '대화방 메뉴',
  pickReport: '신고할 메시지 고르기',
  pickReportHint: '신고할 상대의 메시지를 눌러 주세요.',
  block: '차단',
  blockNote: BLOCK_NOTE,
  blockConfirm: '차단합니다',
  cancel: '그만두기',
  reportNote: REPORT_NOTE,
  reportReason: '신고 사유',
  reportReasons: REPORT_REASONS.map((one) => one.label),
  reportDetail: '덧붙일 말 (선택)',
  reportDetailMax: REPORT_DETAIL_MAX,
  reportConfirm: '신고합니다',
  reportDone: '신고를 접수했습니다. 운영자가 확인합니다.',
  opened: '대화방이 열렸습니다',
  newMessages: '새 메시지',
  placeholder: CHAT_INPUT_PLACEHOLDER,
  send: CHAT_SEND_LABEL,
  maxLength: CHAT_POLICY.maxLength,
  messagesLabel: '메시지',
  emptyTitle: CHAT_EMPTY_TITLE,
  emptyDetail: CHAT_EMPTY_DETAIL,
  toMatching: '매칭에서 오늘의 인연 만나기',
  toRegister: '내 명식 등록',
};

const KST = 'Asia/Seoul';
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { timeZone: KST, year: 'numeric', month: 'long', day: 'numeric' });
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit' });

/** 같은 사람이 이 안에 이어 보낸 말은 한 덩어리로 묶는다 — 시각은 덩어리의 끝에만 선다 */
const RUN_GAP_MS = 3 * 60 * 1000;

function messagesOf(room: ChatRoom, index: number, first: readonly ChatMessage[]): readonly ChatMessage[] {
  /*
    가짜 값은 첫 방의 대화만 든다(`screens.ts`). 다른 방은 목록의 마지막 한 줄을 상대가 보낸 말 하나로 세운다 —
    빈 방처럼 보이면 방 안의 모양을 견줄 수 없다. 실제로는 읽는 문이 방마다 내준다.
  */
  if (index === 0) return first;
  if (room.lastMessageBody === null || room.lastMessageAt === null) return [];
  return [
    {
      messageId: `${room.matchId}-last`,
      seq: 1,
      mine: false,
      fromLeftPartner: room.partnerLeft,
      body: room.lastMessageBody,
      createdAt: room.lastMessageAt,
    },
  ];
}

function viewOf(room: ChatRoom, index: number, state: VariantProps['state']): RoomView {
  const name = partnerNameOf(room);
  const notice = roomNoticeOf(room);
  const raw = messagesOf(room, index, state.messages);
  /* 안 읽은 수만큼 상대의 마지막 말 앞에 「새 메시지」 줄이 선다 */
  const partnerIds = raw.filter((one) => !one.mine).map((one) => one.messageId);
  const firstUnread = room.unread > 0 ? partnerIds[partnerIds.length - room.unread] ?? null : null;

  const messages: MessageView[] = raw.map((one, i) => {
    const prev = raw[i - 1];
    const next = raw[i + 1];
    const joins = (a: ChatMessage | undefined, b: ChatMessage | undefined) =>
      a !== undefined &&
      b !== undefined &&
      a.mine === b.mine &&
      dayLabel(a.createdAt) === dayLabel(b.createdAt) &&
      Math.abs(Date.parse(b.createdAt) - Date.parse(a.createdAt)) <= RUN_GAP_MS &&
      b.messageId !== firstUnread;
    return {
      id: one.messageId,
      mine: one.mine,
      body: one.body,
      at: one.createdAt,
      day: dayLabel(one.createdAt),
      time: timeLabel(one.createdAt),
      runStart: !joins(prev, one),
      runEnd: !joins(one, next),
      firstUnread: one.messageId === firstUnread,
      /* 떠난 사람의 말은 신고할 수 없다 — 신고당할 계정이 없다(ADR 0094) */
      reportable: !one.mine && !one.fromLeftPartner && notice === null,
    };
  });

  return {
    id: room.matchId,
    name,
    heading: roomHeadingOf(room),
    initial: room.partnerLeft ? '' : initialOf(name),
    photoUrl: room.partnerHasPhoto
      ? state.cards.find((card) => card.candidateUserId === room.partnerUserId)?.photoUrl ?? null
      : null,
    activity: notice === null ? room.partnerActivity : null,
    notice,
    line: notice ?? room.lastMessageBody,
    at: messageTimeLabel(room.lastMessageAt ?? room.openedAt),
    unread: room.unread,
    canBlock: notice === null && room.partnerUserId !== null,
    matchHref: notice === null ? previewHref(`/me/match/${room.matchId}`) : null,
    openedDay: dayLabel(room.openedAt),
    messages,
  };
}

export default function Screen({ state }: VariantProps) {
  const self = orbitModelOf(state).self;
  const rooms = state.rooms.map((room, index) => viewOf(room, index, state));

  return (
    <div className="flex min-w-0 flex-col gap-6 sm:gap-8">
      <TopBar unread={state.unread} unreadChat={state.unreadChat} current="/me/chat" />
      <ChatView
        rooms={rooms}
        self={self === null ? null : { stem: self.day.stem, element: self.day.element, label: self.label, spoken: self.day.spoken }}
        copy={COPY}
        hrefs={{ matching: previewHref('/me/matching'), register: previewHref('/me') }}
      />
      <BottomBar unreadChat={state.unreadChat} current="/me/chat" />
    </div>
  );
}
