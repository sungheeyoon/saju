import type { Viewport } from 'next';
import { notFound } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { CHAT_TAB_LABEL, partnerNameOf, roomHeadingOf, roomNoticeOf } from '@/src/lib/chat';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { ChatFrame, RoomList } from '../room-list';
import { chatRoomsForViewer } from '../rooms';
import { roomTonesForViewer } from '../tones';
import { labelled } from './bubbles';
import { MESSAGE_WINDOW, messagesForViewer } from './messages';
import { ChatRoomView } from './room';
import styles from './room.module.css';

export const metadata = {
  title: CHAT_TAB_LABEL,
  description: '매칭된 상대와 메시지를 주고받습니다.',
};

/**
 * 화면 자판이 올라오면 레이아웃이 그만큼 줄어든다 — 폰의 방(`100dvh`)이 머리와 입력칸을 제자리에 둔다. 이 방에만 건다 —
 * 모든 화면에 걸면 Android 에서 하단 독이 자판 위로 따라 오른다. 나머지 칸(폭 · 배율 · `viewportFit`)은 `app/layout.tsx` 의 것을
 * 잇는다(Next 는 viewport 를 칸마다 겹쳐 쓴다). iOS Safari 는 이 값을 모른다 — 방이 `visualViewport` 로 맞춘다(`use-room-height.ts`, G-89).
 */
export const viewport: Viewport = {
  interactiveWidget: 'resizes-content',
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

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  const { matchId } = await params;
  const { state } = await readAccount(supabase, ['status']);

  if (isBlocked(state)) {
    return (
      <main className="app-shell flex flex-1 flex-col gap-6 py-8 sm:py-12">
        <AccountNotice state={state} />
      </main>
    );
  }

  const rooms = await chatRoomsForViewer();
  const room = rooms.find((one) => one.matchId === matchId) ?? null;
  if (room === null) notFound();

  const [messages, tones] = await Promise.all([messagesForViewer(supabase, matchId), roomTonesForViewer(rooms)]);

  return (
    <main className={`app-shell ${styles.page} flex w-full flex-1 flex-col md:py-6 lg:py-8`}>
      <ChatFrame
        opened
        list={<RoomList rooms={rooms} activeId={matchId} titleLevel="h2" tones={tones} />}
        pane={
          /* 방마다 제 상태다 — 넓은 화면에서 다른 방을 누르면 가진 메시지 · 쓰던 글을 새로 시작한다 */
          <ChatRoomView
            key={matchId}
            room={{
              matchId,
              heading: roomHeadingOf(room),
              name: partnerNameOf(room),
              partnerUserId: room.partnerUserId,
              partnerHasPhoto: room.partnerHasPhoto,
              notice: roomNoticeOf(room),
              activity: room.partnerActivity,
              unread: room.unread,
              messages: messages.map(labelled),
              fromBeginning: messages.length < MESSAGE_WINDOW,
              tones: tones.get(matchId) ?? null,
            }}
          />
        }
      />
    </main>
  );
}
