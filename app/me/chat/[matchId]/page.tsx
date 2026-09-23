import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import { CHAT_TAB_LABEL, closedRoomText, messageTimeLabel, roomTitleOf } from '@/src/lib/chat';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { Avatar } from '../../avatar';
import { BlockButton } from '../../requests/manage';
import { chatRoomForViewer, type ChatRoom } from '../rooms';
import { Composer, ReadOnVisit } from '../composer';
import { messagesForViewer, type ChatMessage } from './messages';
import { ReportMessageButton } from './report';

export const metadata = {
  title: `${CHAT_TAB_LABEL} — 만세력`,
  description: '매칭된 상대와 메시지를 주고받습니다.',
};

/**
 * 방 안 — 매칭된 한 쌍의 대화(PRD §7.1).
 *
 * 열려 있으면 입력이 서고, 닫혔으면 입력 자리에 닫힌 까닭 한 줄이 선다. 방이 없거나 내가 볼 수
 * 없는 방은 읽는 문이 `null` 로 내주고 여기서 404 다 — 「저 둘 사이에 방이 있나」를 이 화면이
 * 묻지 않는다(ADR 0091).
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

  const room = await chatRoomForViewer(matchId);
  if (room === null) notFound();

  const messages = await messagesForViewer(matchId);

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="flex items-center gap-4 border-b border-border pb-5">
        <Link
          href="/me/chat"
          className="shrink-0 text-sm text-secondary underline underline-offset-2"
        >
          {CHAT_TAB_LABEL}
        </Link>
        <Avatar userId={room.partnerUserId} nickname={room.partnerNickname} hasPhoto={room.partnerHasPhoto} />
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-[-0.03em]">
          {roomTitleOf(room.partnerNickname)}
        </h1>
      </header>

      <Messages messages={messages} room={room} />

      {room.closedReason === null ? (
        <>
          <ReadOnVisit matchId={matchId} unread={room.unread} />
          <Composer matchId={matchId} />
        </>
      ) : (
        <p role="status" className="rounded-2xl bg-surface-soft px-4 py-3 text-sm text-secondary">
          {closedRoomText(room.closedReason)}
        </p>
      )}

      {/*
        차단은 여기서도 눌린다 — 대화 중에 끊고 싶어지는 자리가 바로 여기다. 신고는 메시지마다
        선다(아래) — 근거가 되는 메시지를 고르는 것이 신고의 뜻이라(PRD §7.1).
      */}
      {room.closedReason === null && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <BlockButton userId={room.partnerUserId} />
        </div>
      )}
    </main>
  );
}

function Messages({ messages, room }: { messages: readonly ChatMessage[]; room: ChatRoom }) {
  /* 열린 빈 방에는 아무것도 안 세운다 — 늘 참인 문장은 세우지 않는다(CONTEXT 「화면 문구 규칙」) */
  if (messages.length === 0) {
    if (room.closedReason === null) return null;
    return (
      <section className={`${CARD} text-sm text-muted`} aria-label="메시지">
        {closedRoomText(room.closedReason)}
      </section>
    );
  }

  return (
    <ol className="flex flex-col gap-2" aria-label="메시지">
      {messages.map((message) => (
        <li
          key={message.messageId}
          className={`flex flex-col gap-1 ${message.mine ? 'items-end' : 'items-start'}`}
        >
          <div
            className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${
              message.mine ? 'bg-accent text-on-accent' : 'bg-surface-soft text-foreground'
            }`}
          >
            {message.body}
          </div>
          <span className="flex items-center gap-2 text-[11px] text-muted">
            <time dateTime={message.createdAt}>{messageTimeLabel(message.createdAt)}</time>
            {/* 신고는 상대의 메시지에만 선다 — 자기 자신은 신고할 수 없다(DB 도 막는다) */}
            {!message.mine && <ReportMessageButton messageId={message.messageId} />}
          </span>
        </li>
      ))}
    </ol>
  );
}
