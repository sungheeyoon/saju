import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { supabaseEnv } from '@/app/auth/config';
import type { Database } from '@/src/lib/db';

/**
 * **바깥 감시가 두드리는 문** — 함수가 돌고 앱이 DB 에 닿는가를 상태 코드 하나로 낸다(G-118, `docs/ops/runbook/jobs.md` 「바깥 감시」).
 *
 * 첫 화면(`/`)은 빌드 때 미리 그려져 CDN 이 낸다 — 함수가 다 죽고 DB 접속값이 틀려도 200 이다. 그래서 바깥 감시는 이
 * 문을 두드린다. 여기서 보는 것은 둘뿐이다: 이 함수가 돌았다(응답이 왔다), 그리고 로그인 없는 역할(`anon`)로 DB 의
 * 공개 문 하나가 답했다. DB 안의 잡(`pg_cron`)이 도는지는 이 문이 아니라 heartbeat 가 본다.
 *
 * **자격을 묻지 않는 유일한 `/api` 문이다**(`app/me/reading/boundary.test.ts` 의 예외, 운영자 결정 2026-10-24 · ADR 0206).
 * 비밀이 없어 단순하고, 두드려서 일어나는 일은 로그인 없는 역할이 이미 직접 부를 수 있는 공개 문 하나의 읽기뿐이다 — 그래도
 * 누구나 함수 호출 하나와 DB 읽기 하나의 비용 · 부하를 낼 수 있다(ADR 0206 「치르는 값」). 부르는 문은
 * `current_beta_schedule` — 관문과 처리방침이 로그인 없이 이미 읽는 날짜 둘이다(`app/beta-schedule.ts`). 열쇠
 * (`service_role`)도 세션 쿠키도 안 든다. 답에는 읽은 값도 오류 문장도 싣지 않는다 — `ok` 또는 `unavailable` 한 낱말과
 * 상태 코드뿐이다. 오류 원문은 함수 로그에만 남긴다.
 *
 * **느린 DB 는 죽은 DB 다.** 감시 서비스는 대개 30초 안팎에서 끊는다 — 그보다 먼저 5초에 끊고 503 을 낸다. 함수가
 * 한도까지 매달리지 않는다.
 */

/** 함수 한도 — DB 를 기다리는 시간(5초)에 여유를 더한 것 */
export const maxDuration = 10;

/** 두드릴 때마다 지금을 본다 — 캐시된 200 은 감시를 속인다 */
export const dynamic = 'force-dynamic';

/** DB 를 기다리는 시간 — 넘으면 503. 감시 서비스의 제한시간보다 짧다 */
const DB_TIMEOUT_MS = 5000;

const NO_STORE = { 'cache-control': 'no-store' } as const;

export async function GET(): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(new Error(`DB 가 ${DB_TIMEOUT_MS}ms 안에 답하지 않았다`)), DB_TIMEOUT_MS);
  try {
    const { url, publishableKey } = supabaseEnv();
    const client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const answer = client.rpc('current_beta_schedule').abortSignal(abort.signal);
    const { error } = await Promise.race([
      answer,
      new Promise<never>((_, reject) => abort.signal.addEventListener('abort', () => reject(abort.signal.reason))),
    ]);
    if (error) {
      console.error('health: current_beta_schedule', error.code ?? '', error.message);
      return unavailable();
    }
    return Response.json({ status: 'ok' }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error('health:', error instanceof Error ? error.message : String(error));
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(): Response {
  return Response.json({ status: 'unavailable' }, { status: 503, headers: NO_STORE });
}
