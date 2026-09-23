import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 안 읽은 메시지 수 — **부속 정보**다. 못 읽으면 배지를 안 세운다(ADR 0078).
 *
 * 서버(목록 화면)와 브라우저(헤더의 탭 배지)가 같은 문을 쓴다 — `readReadingCredits` 와 같은 모양.
 * 그래서 이 파일은 클라이언트를 **받기만** 하고 만들지 않는다 — 서버 클라이언트를 여기서 들면
 * 헤더가 `next/headers` 를 브라우저로 끌고 간다.
 */
export async function readUnreadChat(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<number>> {
  const { data, error } = await client.rpc('unread_chat_count');
  if (error) return unread(error, 'unread_chat_count');
  return read(typeof data === 'number' ? data : 0);
}
