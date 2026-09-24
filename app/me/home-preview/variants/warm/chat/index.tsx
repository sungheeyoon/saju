import { CHAT_TAB_LABEL } from '@/src/lib/chat';

import type { VariantProps } from '../..';
import { rounded } from '../fonts';
import { ROOT_CLASS } from '../symbols';
import { ChatView } from './chat-view';
import { EmptyChat } from './empty';
import { Badge, Dock, TopBar } from './menu';
import { roomsOf, selfElementOf } from './model';

/*
  **3차 · warm · 채팅 — 두 사람의 색으로 짜인 대화.**

  홈에서 사람 한 명이 제 오행 파스텔의 타일이었던 규칙을 대화로 옮긴다: 목록의 둥근 머리는 상대의 파스텔 고리를,
  방 안의 말풍선은 **내 말은 내 일간 잉크로 채우고 상대 말은 상대 파스텔**을 입는다. 대화 첫머리에는 매칭 카드가
  한 궁합 한 줄이 부드러운 카드로 서서 「이 사람과 왜 이야기하게 됐나」를 되짚고, 그 카드가 함께 보는 궁합으로 가는 길이다.

  넓은 화면은 목록 + 방 두 칸, 폰은 목록 → 방으로 한 칸 안에서 갈아 끼운다(`chat-view.tsx`). 메뉴는 홈의 것을 켜진 탭만
  바꿔 옮겼다(`menu.tsx`).
*/
export default function Screen({ state }: VariantProps) {
  const rooms = roomsOf(state);
  const unread = rooms.reduce((sum, room) => sum + room.unread, 0);

  return (
    <div className={`${ROOT_CLASS} flex min-w-0 flex-col gap-6 break-keep sm:gap-8`}>
      <TopBar active="/me/chat" unread={state.unread} unreadChat={state.unreadChat} />

      <header className="flex items-center gap-3">
        <h2 className={`${rounded.className} text-[2rem] leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[2.5rem]`}>
          {CHAT_TAB_LABEL}
        </h2>
        <Badge count={unread} />
      </header>

      {rooms.length === 0 ? <EmptyChat hasSelf={state.self !== null} /> : <ChatView rooms={rooms} selfElement={selfElementOf(state)} />}

      <Dock active="/me/chat" unreadChat={state.unreadChat} />
    </div>
  );
}
