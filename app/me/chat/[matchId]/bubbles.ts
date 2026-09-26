import type { ChatMessage } from './messages';

/**
 * 방 안의 말풍선이 서는 모양 — **서버에서 한 번 짓는다.**
 *
 * 시각 글자(「오후 8:05」)와 날짜 구분(「2026년 9월 22일」)은 지금 시각과 시간대에 기댄다. 서버(UTC)와
 * 브라우저가 따로 지으면 수화가 어긋나고 「오늘」의 경계가 아홉 시간 밀린다 — 그래서 한국 시간으로 여기서
 * 한 번 짓고 화면은 받은 글자를 그린다(`messageTimeLabel` 과 같은 까닭).
 *
 * 같은 사람이 3분 안에 이어 보낸 말은 **한 묶음**이다(카카오톡 · iMessage 의 관례) — 머리(사진)는 묶음의
 * 첫 말에만, 시각은 끝 말에만 선다. 묶음은 모양일 뿐이다: 말풍선 하나하나가 제 줄(`li`)이라 신고는 여전히
 * 메시지 하나를 고른다(PRD 「앱 내 채팅」).
 */

const KST = 'Asia/Seoul';
/** 이만큼 안에 같은 사람이 이어 보낸 말은 한 묶음 */
const GROUP_GAP_MS = 3 * 60 * 1000;

export type Bubble = {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly mine: boolean;
  /** 떠난 사람이 보낸 말 — 신고가 안 선다(ADR 0094) */
  readonly fromLeftPartner: boolean;
  /** 「오후 8:12」 — 묶음의 끝 말에만 화면이 세운다 */
  readonly time: string;
  /** 묶음의 첫 말 — 상대의 사진이 서고 머리 쪽 모서리가 뾰족하다 */
  readonly first: boolean;
  /** 묶음의 끝 말 — 시각이 선다 */
  readonly last: boolean;
};

export type BubbleDay = {
  readonly key: string;
  /** 「2026년 9월 22일」 — 목록의 날짜 표기(`messageTimeLabel`)와 같은 모양이다 */
  readonly label: string;
  readonly bubbles: readonly Bubble[];
};

const dayKeyOf = (at: Date): string => at.toLocaleDateString('en-CA', { timeZone: KST });
const dayLabelOf = (at: Date): string =>
  at.toLocaleDateString('ko-KR', { timeZone: KST, year: 'numeric', month: 'long', day: 'numeric' });
const timeOf = (at: Date): string =>
  at.toLocaleTimeString('ko-KR', { timeZone: KST, hour: 'numeric', minute: '2-digit' });

/** 오래된 것부터 온 메시지를 날짜로 나누고, 날짜 안에서 묶음의 처음과 끝을 적는다 */
export function bubbleDaysOf(messages: readonly ChatMessage[]): readonly BubbleDay[] {
  const days: { key: string; label: string; bubbles: Bubble[] }[] = [];

  messages.forEach((message, index) => {
    const at = new Date(message.createdAt);
    const key = dayKeyOf(at);
    let day = days.at(-1);
    if (day === undefined || day.key !== key) {
      day = { key, label: dayLabelOf(at), bubbles: [] };
      days.push(day);
    }

    const before = day.bubbles.at(-1);
    const joins = before !== undefined && sameRun(messages[index - 1], message);
    if (joins) day.bubbles[day.bubbles.length - 1] = { ...before, last: false };

    day.bubbles.push({
      id: message.messageId,
      body: message.body,
      createdAt: message.createdAt,
      mine: message.mine,
      fromLeftPartner: message.fromLeftPartner,
      time: timeOf(at),
      first: !joins,
      last: true,
    });
  });

  return days;
}

function sameRun(previous: ChatMessage | undefined, next: ChatMessage): boolean {
  if (previous === undefined) return false;
  if (previous.mine !== next.mine || previous.fromLeftPartner !== next.fromLeftPartner) return false;
  return new Date(next.createdAt).getTime() - new Date(previous.createdAt).getTime() <= GROUP_GAP_MS;
}
