import { createClient } from '@supabase/supabase-js';

import type { Database } from '@db';
import { sharedReadingOfRow, type ShareKind, type SharedReading } from '@reading/shared';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * 공유본이 드는 Supabase — **세션을 아예 안 든다**(웹의 `app/share/public-client.ts` 와 같다). 내주는 것은 누가 보든 같은 한 덩어리이고
 * 여는 열쇠는 주소의 토큰 하나다. 로그인한 사람의 만료된 세션이 갱신을 시도하다 이 읽기를 망치는 길을 두지 않는다.
 */
const client =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

export type ShareRead = { kind: 'open'; shared: SharedReading } | { kind: 'gone' } | { kind: 'failed' };

/** 없는 링크와 못 여는 링크는 안 가른다(`gone`). **터진 것은 없는 것이 아니다**(`failed`) — 다시 와 보라는 말을 한다(ADR 0078) */
export async function readShared(token: string, expect: ShareKind): Promise<ShareRead> {
  if (client === null) return { kind: 'failed' };

  const { data, error } = await client.rpc('shared_reading', { p_token: token });
  if (error !== null) {
    console.error('shared_reading', error.code);
    return { kind: 'failed' };
  }

  const shared = sharedReadingOfRow((data ?? [])[0], expect);
  return shared === null ? { kind: 'gone' } : { kind: 'open', shared };
}
