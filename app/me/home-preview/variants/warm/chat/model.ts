import { partnerNameOf, roomHeadingOf, roomNoticeOf } from '@/src/lib/chat';
import { activityText, type ActivityBand } from '@/src/lib/presence';
import { initialOf } from '@/src/lib/profile';
import { STEM_INFO, type Element } from '@/src/lib/saju';

import type { ChatMessage } from '../../../../chat/[matchId]/messages';
import type { ChatRoom } from '../../../../chat/rooms';
import type { PreviewState } from '../../../state';

/*
  **방 한 칸이 화면에 서는 모양 — 서버에서 한 번 짓는다.**

  시각 글자(「오후 8:05」 · 「어제」)는 지금 시각에 기대므로 서버에서 한 번만 짓고 브라우저는 받은 글자를 그린다 —
  둘이 따로 지으면 자정 무렵에 수화가 어긋난다. 말풍선 묶음(연달아 보낸 말)과 날짜 구분도 여기서 끝낸다.

  미리보기의 가짜 값은 첫 방(서연)의 대화만 준다. 다른 방은 목록의 마지막 메시지 한 줄로 방 안을 세운다 —
  방마다 다른 모양(대화가 긴 방 · 한 줄인 방 · 빈 방 · 닫힌 방)을 한 번씩 볼 수 있다.
*/

const KST = 'Asia/Seoul';
/** 이만큼 안에 같은 사람이 이어 보낸 말은 한 묶음 — 머리(사진)와 시각을 한 번만 세운다 */
const GROUP_GAP_MS = 3 * 60 * 1000;

export type Bubble = { id: string; body: string; createdAt: string };

export type BubbleGroup = {
  key: string;
  mine: boolean;
  /** 떠난 사람이 보낸 말 — 신고가 안 선다(ADR 0094) */
  fromLeft: boolean;
  /** 묶음의 끝 시각 「오후 8:12」 */
  time: string;
  bubbles: Bubble[];
};

export type DayBlock = { key: string; label: string; groups: BubbleGroup[] };

export type Compat = { score: number; element: Element | null; highlight: string | null; balanceLabel: string };

export type RoomView = {
  matchId: string;
  name: string;
  heading: string;
  initial: string;
  photoUrl: string | null;
  /** 상대의 파스텔 — 매칭 카드가 말한 「내게 채워 주는 기운」. 모르면 `null` */
  element: Element | null;
  activity: ActivityBand | null;
  activityLabel: string | null;
  /** 닫힌 까닭 한 줄 — 열린 방은 `null` */
  notice: string | null;
  left: boolean;
  /** 신고 · 차단을 걸 사람이 있다 */
  hasPartner: boolean;
  listTime: string;
  /** 목록의 둘째 줄 — 닫힌 방은 까닭, 빈 방은 빈 글자 */
  lastLine: string;
  unread: number;
  compat: Compat | null;
  days: DayBlock[];
};

const dayKey = (at: Date) => at.toLocaleDateString('en-CA', { timeZone: KST });

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit' });

/** 목록의 시각 — 오늘은 시각, 어제는 「어제」, 그 전은 「9월 22일」 */
function listTimeOf(iso: string, now: Date): string {
  const at = new Date(iso);
  if (dayKey(at) === dayKey(now)) return timeOf(iso);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (dayKey(at) === dayKey(yesterday)) return '어제';
  return at.toLocaleDateString('ko-KR', { timeZone: KST, month: 'long', day: 'numeric' });
}

/** 날짜 구분 — 「2026년 9월 22일 월요일」 */
const dayLabelOf = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { timeZone: KST, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

export function daysOf(messages: readonly ChatMessage[]): DayBlock[] {
  const days: DayBlock[] = [];
  for (const message of messages) {
    const at = new Date(message.createdAt);
    const key = dayKey(at);
    let day = days.at(-1);
    if (day === undefined || day.key !== key) {
      day = { key, label: dayLabelOf(message.createdAt), groups: [] };
      days.push(day);
    }
    const group = day.groups.at(-1);
    const last = group?.bubbles.at(-1);
    const joins =
      group !== undefined &&
      last !== undefined &&
      group.mine === message.mine &&
      group.fromLeft === message.fromLeftPartner &&
      at.getTime() - new Date(last.createdAt).getTime() <= GROUP_GAP_MS;
    const bubble = { id: message.messageId, body: message.body, createdAt: message.createdAt };
    if (joins) {
      group.bubbles.push(bubble);
      group.time = timeOf(message.createdAt);
    } else {
      day.groups.push({
        key: message.messageId,
        mine: message.mine,
        fromLeft: message.fromLeftPartner,
        time: timeOf(message.createdAt),
        bubbles: [bubble],
      });
    }
  }
  return days;
}

/** 첫 방이 아니면 목록의 마지막 한 줄로 방 안을 세운다 */
function messagesOf(room: ChatRoom, index: number, first: readonly ChatMessage[]): readonly ChatMessage[] {
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

const ELEMENT_KEYS = new Set<string>(['木', '火', '土', '金', '水']);
const elementOf = (value: string | undefined): Element | null =>
  value !== undefined && ELEMENT_KEYS.has(value) ? (value as Element) : null;

export function roomsOf(state: PreviewState, now: Date = new Date()): RoomView[] {
  return state.rooms.map((room, index) => {
    const card = state.cards.find((one) => one.candidateUserId === room.partnerUserId) ?? null;
    const name = partnerNameOf(room);
    const notice = roomNoticeOf(room);
    const element = elementOf(card?.highlights[0]?.element);
    return {
      matchId: room.matchId,
      name,
      heading: roomHeadingOf(room),
      initial: room.partnerLeft ? '' : initialOf(name),
      photoUrl: room.partnerLeft ? null : (card?.photoUrl ?? null),
      element,
      activity: room.partnerActivity,
      activityLabel: room.partnerActivity === null ? null : activityText(room.partnerActivity),
      notice,
      left: room.partnerLeft,
      hasPartner: room.partnerUserId !== null,
      listTime: listTimeOf(room.lastMessageAt ?? room.openedAt, now),
      lastLine: notice ?? room.lastMessageBody ?? '',
      unread: room.unread,
      compat:
        card === null || room.partnerLeft
          ? null
          : {
              score: card.previewScore,
              element,
              highlight: card.highlights[0]?.text ?? null,
              balanceLabel: card.balanceLabel,
            },
      days: daysOf(messagesOf(room, index, state.messages)),
    };
  });
}

export const selfElementOf = (state: PreviewState): Element | null =>
  state.self === null ? null : STEM_INFO[state.self.saju.pillars.dayMaster].element;
