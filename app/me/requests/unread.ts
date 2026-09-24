import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 안 읽은 소식 수 — 머리글의 종이 브라우저에서 센다. **부속 정보**다 — 못 읽으면 딱지를 안 세운다(ADR 0078).
 *
 * `inbox.ts` 의 `unreadCount` 와 같은 함수(`unread_notifications`)를 부른다. 그쪽은 서버 클라이언트를 스스로
 * 만들어 브라우저에서 못 부르므로, 채팅의 `readUnreadChat` 과 같은 모양으로 클라이언트를 **받기만** 한다 —
 * 머리글은 `/` 에도 서고 그 화면은 정적으로 미리 그려지므로 서버에서 읽지 않는다(`site-header.tsx`).
 */
export async function readUnreadNotifications(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<number>> {
  const { data, error } = await client.rpc('unread_notifications');
  if (error) return unread(error, 'unread_notifications');
  return read(typeof data === 'number' ? data : 0);
}
