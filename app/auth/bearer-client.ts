import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { supabaseEnv } from './config';

/**
 * 앱이 드는 Supabase — **그 사람의 토큰으로 돈다**(ADR 0211).
 *
 * 쿠키 대신 `Authorization` 머리를 싣는 것 말고는 `server-client.ts` 와 같다 — 공개 키이고, 모든 판정은 RLS 와 DB 함수가
 * `auth.uid()` 로 한다. 토큰을 저장하거나 갱신하지 않는다. 갱신은 앱의 일이고, 이 클라이언트는 요청 하나만 산다.
 */
export function supabaseAsBearer(accessToken: string): SupabaseClient<Database> {
  const { url, publishableKey } = supabaseEnv();

  return createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
