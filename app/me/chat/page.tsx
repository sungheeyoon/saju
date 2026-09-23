import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import {
  CHAT_EMPTY_DETAIL,
  CHAT_EMPTY_TITLE,
  CHAT_TAB_LABEL,
  messageTimeLabel,
  partnerNameOf,
  roomNoticeOf,
} from '@/src/lib/chat';

import { supabaseOnServer } from '../../auth/server-client';
import { CARD } from '../../card';
import { AccountNotice } from '../account-notice';
import { readAccount } from '../account';
import { Avatar } from '../avatar';
import { chatRoomsForViewer, type ChatRoom } from './rooms';

export const metadata = {
  title: `${CHAT_TAB_LABEL} — 만세력`,
  description: '매칭된 상대와 주고받은 메시지를 확인합니다.',
};

/**
 * 대화방 목록 — 탭이다(PRD §7.1 · §7.4.1).
 *
 * 닫힌 방도 목록에 남는다 — 「방이 닫힌다」는 입력이 안 된다는 뜻이지 사라진다는 뜻이 아니다.
 * 누가 어느 방을 보는가는 읽는 문이 이미 정해서 내준다(ADR 0091). 이 화면은 그리기만 한다.
 */
export default async function ChatRoomsPage() {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { state } = await readAccount(supabase, 'status');

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-8 py-9 sm:py-14">
      <header className="flex max-w-2xl flex-col gap-2">
        <p className="eyebrow">{CHAT_TAB_LABEL}</p>
        <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{CHAT_TAB_LABEL}</h1>
      </header>

      {isBlocked(state) ? <AccountNotice state={state} /> : <Rooms />}
    </main>
  );
}

async function Rooms() {
  const rooms = await chatRoomsForViewer();

  if (rooms.length === 0) {
    return (
      <section className={`${CARD} flex flex-col gap-1.5`}>
        <h2 className="text-base font-semibold">{CHAT_EMPTY_TITLE}</h2>
        <p className="text-sm leading-6 text-secondary">{CHAT_EMPTY_DETAIL}</p>
      </section>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => (
        <li key={room.matchId}>
          <RoomRow room={room} />
        </li>
      ))}
    </ul>
  );
}

function RoomRow({ room }: { room: ChatRoom }) {
  /*
    닫힌 방은 마지막 메시지 대신 닫힌 까닭이 선다 — 누르기 전에 무엇이 안 되는지 읽힌다. 상대가
    떠난 방은 까닭 대신 넷째 줄이다(PRD §7.1).
  */
  const notice = roomNoticeOf(room);
  const line = notice ?? room.lastMessageBody ?? '';
  const name = partnerNameOf(room);
  const at = room.lastMessageAt ?? room.openedAt;

  return (
    <Link
      href={`/me/chat/${room.matchId}`}
      className={`${CARD} flex items-center gap-4 hover:border-accent`}
    >
      <Avatar userId={room.partnerUserId ?? ''} nickname={name} hasPhoto={room.partnerHasPhoto} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-base font-semibold">{name}</span>
          <span className="shrink-0 text-xs text-muted">{messageTimeLabel(at)}</span>
        </span>
        <span className={`truncate text-sm ${notice !== null ? 'text-muted' : 'text-secondary'}`}>
          {line}
        </span>
      </span>
      {room.unread > 0 && (
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-fire text-[11px] font-bold text-white">
          {room.unread}
          <span className="sr-only">건 안 읽음</span>
        </span>
      )}
    </Link>
  );
}
