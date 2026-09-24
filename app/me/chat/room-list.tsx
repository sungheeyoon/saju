import Link from 'next/link';

import { CHAT_TAB_LABEL, messageTimeLabel, partnerNameOf, roomNoticeOf } from '@/src/lib/chat';
import type { Element } from '@/src/lib/saju';

import { elementScope } from '../../element-tone';
import { BADGE, TYPE_TITLE } from '../../ui/surfaces';
import { Avatar } from '../avatar';
import { ChatIcon } from './chat-icon';
import type { ChatRoom } from './rooms';
import type { RoomTones } from './tones';

/**
 * **목록과 방이 한 틀에 선다** — 넓은 화면(lg)은 왼쪽 목록 + 오른쪽 방 두 칸, 폰은 주소마다 한 칸이다.
 *
 * 주소는 그대로 둘이다(`/me/chat` · `/me/chat/[matchId]`). 넓은 화면에서 방을 눌러도 주소가 바뀌고, 두 화면이
 * 같은 틀을 그려 칸이 제자리에 남는다 — 새로고침 · 뒤로 · 링크 공유가 방 하나를 정확히 가리킨다.
 *
 * 높이는 화면에 맞추고 칸마다 따로 스크롤한다(lg). 폰의 목록은 문서 흐름대로 길어진다.
 */
export function ChatFrame({
  list,
  pane,
  opened,
}: {
  list: React.ReactNode;
  pane: React.ReactNode;
  /** 방이 열린 화면인가 — 폰에서는 방만, 아니면 목록만 선다 */
  opened: boolean;
}) {
  return (
    <div className="grid min-w-0 flex-1 gap-5 lg:h-[calc(100dvh-8rem)] lg:min-h-[32rem] lg:flex-none lg:grid-cols-[21rem_minmax(0,1fr)]">
      <div className={`${opened ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-col`}>{list}</div>
      <div className={`${opened ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-col`}>{pane}</div>
    </div>
  );
}

/**
 * 대화방 목록. 닫힌 방도 남는다 — 「방이 닫힌다」는 입력이 안 된다는 뜻이지 사라진다는 뜻이 아니다.
 *
 * **접속 상태는 여기 안 선다.** PRD §7.2 가 허락한 자리는 방 안과 후보 카드 둘이다 — 목록에 점을 세우면
 * 매칭된 사람 전부의 활동을 한눈에 훑는 판이 된다.
 */
export function RoomList({
  rooms,
  activeId,
  titleLevel,
  tones,
}: {
  rooms: readonly ChatRoom[];
  activeId: string | null;
  /** 방마다 두 사람의 색(`roomTonesForViewer`) — 없는 방은 회색 고리다 */
  tones: ReadonlyMap<string, RoomTones>;
  /** 목록 화면에서는 화면 제목(h1), 방 화면에서는 곁의 칸이라 h2 다 — 방 화면의 h1 은 상대의 이름이다 */
  titleLevel: 'h1' | 'h2';
}) {
  const Title = titleLevel;
  return (
    <section
      aria-label="대화방 목록"
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:rounded-[2rem] lg:bg-surface lg:ring-1 lg:ring-border"
    >
      <Title className={`${TYPE_TITLE} pb-4 lg:px-6 lg:pb-2 lg:pt-5 lg:text-[1.5rem]`}>{CHAT_TAB_LABEL}</Title>
      <ul className="-mx-2 flex min-h-0 flex-col gap-0.5 overflow-y-auto lg:mx-0 lg:p-2">
        {rooms.map((room) => (
          <li key={room.matchId}>
            <RoomRow room={room} active={room.matchId === activeId} tone={tones.get(room.matchId)?.theirs.element ?? null} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoomRow({ room, active, tone }: { room: ChatRoom; active: boolean; tone: Element | null }) {
  /*
    닫힌 방은 마지막 메시지 대신 닫힌 까닭이 자물쇠와 함께 선다 — 누르기 전에 무엇이 안 되는지 읽힌다.
    상대가 떠난 방은 까닭 대신 넷째 줄이다(PRD §7.1).
  */
  const notice = roomNoticeOf(room);
  const closed = notice !== null;
  const name = partnerNameOf(room);
  const at = room.lastMessageAt ?? room.openedAt;
  /* 지금 열어 둔 방의 안 읽은 수는 이미 읽는 중이다 — 읽음 처리가 돌아오기 전에도 세우지 않는다 */
  const unread = active ? 0 : room.unread;

  return (
    <Link
      href={`/me/chat/${room.matchId}`}
      aria-current={active ? 'page' : undefined}
      /* 지금 열린 방은 그 사람의 파스텔이 깔린다 — 목록의 사진 고리와 같은 색이라 어느 방인지 색으로도 이어진다 */
      className={`${elementScope(tone)} flex min-h-[4.5rem] items-center gap-3 rounded-[1.25rem] px-2 py-2.5 active:scale-[0.99] lg:px-3 ${
        active ? (tone === null ? 'bg-surface-soft' : 'bg-[var(--tile)]') : 'hover:bg-surface-soft'
      }`}
    >
      <span className={closed ? 'opacity-60 grayscale' : ''}>
        <Avatar userId={room.partnerUserId ?? ''} nickname={name} hasPhoto={room.partnerHasPhoto} size={56} tone={tone} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-rounded text-[17px] leading-6 ${closed ? 'text-secondary' : 'text-foreground'}`}>
            {name}
          </span>
          <span
            className={`shrink-0 text-[12px] tabular-nums ${unread > 0 ? 'font-semibold text-foreground' : 'text-secondary'}`}
          >
            {messageTimeLabel(at)}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {closed && <ChatIcon name="lock" className="size-3.5 text-secondary" />}
          <span
            className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${
              unread > 0 && !closed ? 'font-semibold text-foreground' : 'text-secondary'
            }`}
          >
            {notice ?? room.lastMessageBody ?? ''}
          </span>
          {unread > 0 && (
            <span className={`${BADGE} shrink-0 px-1.5`}>
              {unread}
              <span className="sr-only">건 안 읽음</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
