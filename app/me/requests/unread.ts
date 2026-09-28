import type { SupabaseClient } from '@supabase/supabase-js';

import { answerCount, bellCount } from '@/src/lib/consent';
import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * 머리글의 두 딱지 — 종의 안 읽은 소식 수와 인연 탭의 답할 요청 수. 둘 다 **부속 정보**다 — 못 읽으면 딱지를
 * 안 세운다(ADR 0078). **무엇을 어느 딱지가 세는지는 `src/lib/consent/counts.ts` 가 든다**(ADR 0129) — 요청 하나가
 * 두 딱지를 켜지 않는다.
 *
 * 채팅의 `readUnreadChat` 과 같은 모양으로 클라이언트를 **받기만** 한다 — 머리글은 `/` 에도 서고 그 화면은
 * 정적으로 미리 그려지므로 서버에서 읽지 않는다(`site-header.tsx`). 서버 쪽 `unreadCount`(`inbox.ts`)도 이 문을 지난다.
 */

/**
 * 안 읽은 소식 수 — 요청이 왔다는 소식을 뺀다.
 *
 * 전에는 `unread_notifications`(전부 센다)를 불렀다. 갈래를 알아야 빼므로 목록 문(`my_notifications`, 최근 50줄)을
 * 읽고 **갈래와 읽음 둘만** 본다 — 50줄 밖의 안 읽은 소식은 딱지에 안 선다(소식 화면도 그 50줄만 그린다).
 */
export async function readUnreadNotifications(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<number>> {
  const { data, error } = await client.rpc('my_notifications');
  if (error) return unread(error, 'my_notifications');
  return read(bellCount((data ?? []).map((row) => ({ kind: row.kind, unread: row.read_at === null }))));
}

/** 답할 요청 수 — 받은 요청 중 아직 답하지 않은 것. 인연 탭의 딱지다 */
export async function readRequestsToAnswer(
  client: SupabaseClient<Database>,
): Promise<SkippableRead<number>> {
  const { data, error } = await client.rpc('my_match_requests');
  if (error) return unread(error, 'my_match_requests');
  return read(answerCount(data ?? []));
}
