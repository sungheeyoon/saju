import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isBlocked } from '@/src/lib/account';
import {
  CHAT_TAB_LABEL,
  messageTimeLabel,
  partnerNameOf,
  roomHeadingOf,
  roomNoticeOf,
} from '@/src/lib/chat';
import { activityText } from '@/src/lib/presence';

import { supabaseOnServer } from '../../../auth/server-client';
import { CARD } from '../../../card';
import { AccountNotice } from '../../account-notice';
import { readAccount } from '../../account';
import { Avatar } from '../../avatar';
import { BlockButton } from '../../requests/manage';
import { chatRoomForViewer } from '../rooms';
import { Composer, ReadOnVisit } from '../composer';
import { messagesForViewer, type ChatMessage } from './messages';
import { ReportMessageButton } from './report';

export const metadata = {
  title: CHAT_TAB_LABEL,
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
  /* 닫힌 까닭 한 줄 — 상대가 떠났으면 넷째 줄(PRD §7.1). 열린 방은 `null` 이다 */
  const notice = roomNoticeOf(room);

  return (
    <main className="app-shell flex w-full flex-1 flex-col gap-6 py-9 sm:py-12">
      <header className="flex items-center gap-4 border-b border-border pb-5">
        <Link
          href="/me/chat"
          className="shrink-0 text-sm text-secondary underline underline-offset-2"
        >
          {CHAT_TAB_LABEL}
        </Link>
        <Avatar
          userId={room.partnerUserId ?? ''}
          nickname={partnerNameOf(room)}
          hasPhoto={room.partnerHasPhoto}
        />
        <div className="min-w-0 flex-1">
          {/* 상대가 떠났으면 닉네임 자리에 「탈퇴한 사용자」가 선다(PRD §5.3, ADR 0094) */}
          <h1 className="truncate text-xl font-bold tracking-[-0.03em]">{roomHeadingOf(room)}</h1>
          {/* 접속 상태는 구간 하나다 — 열린 방에만 오고, 시각은 오지 않는다(PRD §7.2, ADR 0092) */}
          {room.partnerActivity !== null && (
            <p className="text-xs text-secondary">{activityText(room.partnerActivity)}</p>
          )}
        </div>
      </header>

      <Messages messages={messages} notice={notice} />

      {notice === null ? (
        <>
          <ReadOnVisit matchId={matchId} unread={room.unread} />
          <Composer matchId={matchId} />
        </>
      ) : (
        <p role="status" className="rounded-2xl bg-surface-soft px-4 py-3 text-sm text-secondary">
          {notice}
        </p>
      )}

      {/*
        차단은 여기서도 눌린다 — 대화 중에 끊고 싶어지는 자리가 바로 여기다. 신고는 메시지마다
        선다(아래) — 근거가 되는 메시지를 고르는 것이 신고의 뜻이라(PRD §7.1).
      */}
      {notice === null && room.partnerUserId !== null && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4">
          <BlockButton userId={room.partnerUserId} />
        </div>
      )}
    </main>
  );
}

function Messages({ messages, notice }: { messages: readonly ChatMessage[]; notice: string | null }) {
  /* 열린 빈 방에는 아무것도 안 세운다 — 늘 참인 문장은 세우지 않는다(CONTEXT 「화면 문구 규칙」) */
  if (messages.length === 0) {
    if (notice === null) return null;
    return (
      <section className={`${CARD} text-sm text-muted`} aria-label="메시지">
        {notice}
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
            {/*
              신고는 상대의 메시지에만 선다 — 자기 자신은 신고할 수 없다(DB 도 막는다). 떠난 사람의
              메시지에도 안 선다 — 신고당할 계정이 없다(ADR 0094).
            */}
            {!message.mine && !message.fromLeftPartner && (
              <ReportMessageButton messageId={message.messageId} />
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
