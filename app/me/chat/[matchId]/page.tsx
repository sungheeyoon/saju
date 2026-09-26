import { notFound, redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { CHAT_TAB_LABEL, partnerNameOf, roomHeadingOf, roomNoticeOf } from '@/src/lib/chat';

import { supabaseOnServer } from '../../../auth/server-client';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { ChatFrame, RoomList } from '../room-list';
import { chatRoomsForViewer } from '../rooms';
import { roomTonesForViewer } from '../tones';
import { bubbleDaysOf } from './bubbles';
import { MESSAGE_WINDOW, messagesForViewer } from './messages';
import { ChatRoomView } from './room';

export const metadata = {
  title: CHAT_TAB_LABEL,
  description: '매칭된 상대와 메시지를 주고받습니다.',
};

/**
 * 방 안 — 매칭된 한 쌍의 대화(PRD 「앱 내 채팅」).
 *
 * 열려 있으면 입력이 서고, 닫혔으면 입력 자리에 닫힌 까닭 한 줄이 선다. 방이 없거나 내가 볼 수
 * 없는 방은 읽는 문이 내주지 않고 여기서 404 다 — 「저 둘 사이에 방이 있나」를 이 화면이
 * 묻지 않는다(ADR 0091). 넓은 화면은 왼쪽에 목록이 함께 서는데, 방 하나를 찾으려고 이미 목록 전부를
 * 읽으므로(`chatRoomsForViewer`) 더 읽는 것은 없다.
 */
export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const supabase = await supabaseOnServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth');

  const { matchId } = await params;
  const { state } = await readAccount(supabase, 'status');

  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-9 sm:py-14">
        <AccountNotice state={state} />
      </main>
    );
  }

  const rooms = await chatRoomsForViewer();
  const room = rooms.find((one) => one.matchId === matchId) ?? null;
  if (room === null) notFound();

  const [messages, tones] = await Promise.all([messagesForViewer(matchId), roomTonesForViewer(rooms)]);

  return (
    <main className="app-shell flex w-full flex-1 flex-col py-3 md:py-6 lg:py-8">
      <ChatFrame
        opened
        list={<RoomList rooms={rooms} activeId={matchId} titleLevel="h2" tones={tones} />}
        pane={
          <ChatRoomView
            room={{
              matchId,
              heading: roomHeadingOf(room),
              name: partnerNameOf(room),
              partnerUserId: room.partnerUserId,
              partnerHasPhoto: room.partnerHasPhoto,
              notice: roomNoticeOf(room),
              activity: room.partnerActivity,
              unread: room.unread,
              days: bubbleDaysOf(messages),
              fromBeginning: messages.length < MESSAGE_WINDOW,
              tones: tones.get(matchId) ?? null,
            }}
          />
        }
      />
    </main>
  );
}
