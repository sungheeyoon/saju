import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/lib/db';


/**
 * **열쇠를 드는 유일한 자리.**
 *
 * 이 저장소는 사용자 경로에 `service_role` 을 쓰지 않는다(ADR 0003·0006). 열쇠는 사용자
 * JWT 에 닫아 둔 문을 부를 때만 든다 — 부르는 곳은 여덟 파일이다(2026-09-30 에 잰 값):
 * 풀이 제출(`app/me/reading/pipeline.ts` 둘) · 결과 회수(`app/me/reading/collect.ts`) ·
 * 서버 오류 알림(`app/request-error.ts`, `instrumentation.ts` 가 부른다) ·
 * 결과 복구 크론(`app/api/cron/reading/route.ts`) · 접속기록 반출 크론
 * (`app/api/cron/audit-export/route.ts`) · OpenAI webhook · 결제 webhook
 * (`app/api/openai/webhook/route.ts` · `app/api/portone/webhook/route.ts`), 그리고 **사용자 경로의 제한된 예외 하나** —
 * 풀에 오르는 요약과 내 사람의 여덟 글자를 쓰는 문 넷(`app/me/keyed-chart-writes.ts`, G-64 · ADR 0136).
 * 그 목록은 `eslint.config.mjs` 의 `KEY_HOLDERS` 와 `scripts/layers.test.ts` 가 함께 든다 — 새 자리는 둘을 고친다.
 *
 * **구멍의 모양은 DB 가 정한다.** 열쇠가 부를 수 있는 public 함수는 이름으로 고정되어
 * 있고, 그 목록을 드는 것은 pgTAP 이다(`supabase/tests/13_reading.test.sql` 의 권한 시험).
 * 예컨대 `save_reading` 이 `authenticated` 에게 열려 있으면 로그인한 사람이 모델·
 * redaction·출력 검사를 다 건너뛰고 임의의 글을 저장할 수 있고, Match 에서는 그 글이
 * 상대에게 간다(ADR 0013). `20260826090000_reading.sql` 이 public 함수의 기본
 * `PUBLIC EXECUTE` 를 닫았고, 표에는 사용자 데이터를 읽고 쓰는 DML 권한이 없다
 * (`20260824090200_access_policies.sql`).
 */

/**
 * 열쇠가 없다 — **없는 것을 빈 문자열로 메우지 않는다.**
 *
 * 빈 키로 만든 client 는 조용히 「권한 없음」을 내고, 그러면 열쇠가 없는 배포와 정말
 * 못 하는 일이 같은 얼굴이 된다.
 */
export class NoKeyError extends Error {
  constructor(what: string) {
    super(`서버에 ${what} 열쇠가 없습니다 (SUPABASE_SECRET_KEY)`);
    this.name = 'NoKeyError';
  }
}

/**
 * @throws {NoKeyError} 접속값이나 열쇠가 없을 때.
 */
export function keyedClient(what: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  /**
   * **열쇠만 이름 둘을 본다** — 로컬 스택이 옛 이름만 내주는 때가 있다.
   *
   * `supabase status` 가 `SECRET_KEY` 를 안 내주는 판본에서는 `SERVICE_ROLE_KEY` 뿐이라,
   * 이 갈래가 없으면 로컬 시험이 열쇠 없는 배포와 같은 얼굴로 실패한다
   * (`playwright.config.ts` 가 이름 둘을 다 덮는 까닭이 그것이다).
   *
   * 주소 쪽에는 그런 자리가 없다. 로컬 도구도 CI 도 배포도 `NEXT_PUBLIC_SUPABASE_URL`
   * 하나만 쓴다 — 옛 갈래는 Vercel 통합이 이름을 두 벌 넣어 주던 동안의 자국이었다.
   */
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new NoKeyError(what);

  return createClient<Database>(url, key, {
    // 이 client 에는 사용자가 없다. 쿠키도 세션도 들지 않는다 — 들면 그 세션이
    // 열쇠의 권한으로 도는 순간이 생긴다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
