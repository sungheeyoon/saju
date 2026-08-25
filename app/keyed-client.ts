import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * **열쇠를 드는 유일한 자리.**
 *
 * 이 저장소는 사용자 경로에 `service_role` 을 쓰지 않는다(ADR 0003·0006). 그 규율에
 * 구멍이 둘 뚫려 있고, 둘 다 **구멍의 모양을 DB 가 정한다.**
 *
 * - `match_calculation_inputs` — 매인 판본의 계산 입력을 읽는다(ADR 0010).
 * - `save_reading` — 현재 결과를 교체한다(ADR 0013). 이 문이 `authenticated` 에게
 *   열려 있으면 로그인한 사람이 모델·redaction·출력 검사를 다 건너뛰고 임의의 글을
 *   저장할 수 있고, Match 에서는 그 글이 상대에게 간다.
 *
 * 열쇠가 할 수 있는 일은 그 함수 **둘**뿐이다. `20260826090000_reading.sql` 이 public
 * 함수의 기본 `PUBLIC EXECUTE` 를 닫고, pgTAP 이 실제 허용 집합을 둘로 고정한다. 표에는
 * 사용자 데이터를 읽고 쓰는 DML 권한이 없다(`20260824090200_access_policies.sql`).
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
export function keyedClient(what: string): SupabaseClient {
  /**
   * 이름 둘을 다 본다 — Vercel 통합이 넣어 주는 이름과 Supabase CLI 가 내주는 이름이
   * 다르다.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) throw new NoKeyError(what);

  return createClient(url, key, {
    // 이 client 에는 사용자가 없다. 쿠키도 세션도 들지 않는다 — 들면 그 세션이
    // 열쇠의 권한으로 도는 순간이 생긴다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
