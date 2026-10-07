import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { LIVE_EVENT, liveChangeOf, type LiveChange } from './changes';

/**
 * 계정의 비공개 채널 하나를 연다 — 주제 `user:<uid>`, 사건 `changed`(ADR 0155).
 *
 * **듣기만 한다.** 보내는 것은 DB 트리거뿐이고 브라우저에는 보내기 정책이 없다. 남의 주제를 열면 서버가 구독을
 * 거절하고 상태 콜백이 `CHANNEL_ERROR` 를 받는다 — 드라이버가 그것을 실패로 세어 뒤물림한다.
 *
 * 구독 전에 `realtime.setAuth()` 를 부른다 — 비공개 채널의 권한은 구독할 때의 access token 으로 판정한다
 * (Supabase 「Realtime Authorization」). 토큰이 새로 나면 supabase-js 가 스스로 다시 건다.
 */
export const userTopic = (userId: string): string => `user:${userId}`;

/** 상태 콜백이 받는 값 — `SUBSCRIBED` 만 선 것이고 나머지는 실패다 */
export type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';

export async function openUserChannel(
  client: SupabaseClient<Database>,
  userId: string,
  hear: { readonly change: (change: LiveChange) => void; readonly status: (status: ChannelStatus) => void },
): Promise<RealtimeChannel | null> {
  try {
    await client.realtime.setAuth();
  } catch {
    // 토큰을 못 얻었다 — 구독해도 거절된다. 실패로 세고 뒤물림이 다시 연다.
    hear.status('CHANNEL_ERROR');
    return null;
  }

  return client
    .channel(userTopic(userId), { config: { private: true } })
    .on('broadcast', { event: LIVE_EVENT }, (message: { payload?: unknown }) => {
      const change = liveChangeOf(message.payload);
      if (change !== null) hear.change(change);
    })
    .subscribe((status) => hear.status(status as ChannelStatus));
}

/** 채널을 걷는다 — 서버에서 떠나고 클라이언트의 목록에서 지운다 */
export async function closeUserChannel(client: SupabaseClient<Database>, channel: RealtimeChannel): Promise<void> {
  await client.removeChannel(channel);
}
