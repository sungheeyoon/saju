import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';
import { queryFromSearchParams, type Query } from '@/src/lib/input/query';

import type { ChartWriter } from '../../../me/keyed-chart-writes';

/** 토큰을 확인한 세션을 열쇠 모듈이 묻는 길로 — 사람 id 는 Auth 서버의 답이다(`mobileSession`) */
export const chartWriterOf = (session: { client: SupabaseClient<Database>; userId: string }): ChartWriter => ({
  client: session.client,
  sessionUserId: async () => session.userId,
});

/** 본문을 값으로 — 깨졌으면 빈 값이다. 칸마다의 모양은 각 문이 본다 */
export const bodyOf = async (request: Request): Promise<Record<string, unknown>> => {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
};

/** 입력은 웹 주소와 같은 쿼리 글자로 건넌다 — 읽는 규칙도 그 함수 하나다(`queryFromSearchParams`). 여덟 글자 · 요약은 안 받는다 */
export const queryOf = (raw: unknown): Query | null =>
  typeof raw === 'string' ? queryFromSearchParams(new URLSearchParams(raw)) : null;
