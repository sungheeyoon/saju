
import { isBlocked } from '@/src/lib/account';
import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import { supabaseOnServer } from '../../../auth/server-client';
import { signedInUser } from '../../../auth/signed-in';
import { redirectToSignIn } from '../../../auth/sign-in-redirect';
import { TYPE_TITLE } from '../../../ui/surfaces';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { EmptyChat, NoRoomChosen } from '../empty';
import { ChatFrame, RoomList } from '../room-list';
import { chatRoomsForViewer } from '../rooms';
import { roomTonesForViewer } from '../tones';

export const metadata = {
  title: CHAT_TAB_LABEL,
  description: '매칭된 상대와 주고받은 메시지를 확인합니다.',
};

/**
 * 대화방 목록 — 탭이다(PRD 「앱 내 채팅」 · 「화면 정리」).
 *
 * 누가 어느 방을 보는가는 읽는 문이 이미 정해서 내준다(ADR 0091). 이 화면은 그리기만 한다. 넓은 화면은
 * 방 화면과 같은 두 칸 틀이고 오른쪽 칸이 비어 있다(`ChatFrame`).
 */
export default async function ChatRoomsPage() {
  const supabase = await supabaseOnServer();

  const user = await signedInUser(supabase);
  if (!user) return redirectToSignIn();

  /*
    **방 목록은 계정과 나란히 읽는다**(2026-09-30) — 계정을 읽은 뒤에 시작하던 동안 탭 이동이 한 물결 더 길었다. 이용이 멈춘
    계정이면 안 쓰고 버린다 — 아래에서 따로 받아 보므로, 여기서 안 잡으면 버린 쪽의 실패가 처리되지 않은 거절로 뜬다.
  */
  const rooms = chatRoomsForViewer();
  rooms.catch(() => {});

  const { state } = await readAccount(supabase, ['status', 'self_person_id']);

  return (
    <main className="app-shell flex w-full flex-1 flex-col py-6 sm:py-10 lg:py-8">
      {isBlocked(state) ? (
        <div className="flex flex-col gap-6">
          <h1 className={TYPE_TITLE}>{CHAT_TAB_LABEL}</h1>
          <AccountNotice state={state} />
        </div>
      ) : (
        <Rooms hasSelf={state.kind === 'active' && state.selfPersonId !== null} reading={rooms} />
      )}
    </main>
  );
}

async function Rooms({ hasSelf, reading }: { hasSelf: boolean; reading: ReturnType<typeof chatRoomsForViewer> }) {
  const rooms = await reading;

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className={TYPE_TITLE}>{CHAT_TAB_LABEL}</h1>
        <EmptyChat hasSelf={hasSelf} />
      </div>
    );
  }

  return (
    <ChatFrame
      opened={false}
      list={<RoomList rooms={rooms} activeId={null} titleLevel="h1" tones={await roomTonesForViewer(rooms)} />}
      pane={<NoRoomChosen />}
    />
  );
}
