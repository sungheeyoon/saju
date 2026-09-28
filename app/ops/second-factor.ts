import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

/**
 * **운영자 화면은 2단계 인증(aal2)을 마친 세션에서만 운영자 문을 부른다** (ADR 0122).
 *
 * 2026-09-28 에 재 보니 운영자를 가리는 자리는 DB 의 `is_operator()` 하나였고 그것은 `public.operator` 에 id 가
 * 있는가만 물었다 — 세션의 인증 수준(`aal`)을 보는 자리는 앱 · DB 어디에도 0 이었다. 로그인은 구글 하나라,
 * 운영자의 구글 계정이 새면 그 세션으로 신고 근거 · 설문 글을 그대로 읽었다.
 *
 * 여기는 **「나는 운영자인가」를 묻지 않는다** — 그 답은 여전히 DB 가 든다(`/ops/survey` · `/ops/reports` 머리말).
 * 묻는 것은 이 세션이 두 번째 요소를 지났는가뿐이고, 지나지 않았으면 운영자 문을 **아예 부르지 않는다**.
 * 운영자가 아닌 사람은 지금처럼 거절(404)을 받는다 — 두 번째 요소를 등록한 적이 없으면 확인 화면으로도 안 보낸다.
 *
 * **이것은 화면의 막음이다.** 세션 토큰을 쥔 사람이 PostgREST 로 문을 직접 두드리면 이 파일을 안 지난다 — 그
 * 막음은 `is_operator()` 가 `auth.jwt() ->> 'aal'` 을 함께 묻는 날 선다(ADR 0122 「DB 층」).
 */

/** 두 번째 요소가 필요하다 — 등록한 요소가 있어 확인 화면으로 보낸다 */
export const SECOND_FACTOR_NEEDED = 'second-factor';

/** 두 번째 요소를 확인하는 화면 */
export const SECOND_FACTOR_PATH = '/ops/mfa';

/**
 * 이 세션의 두 번째 요소 — 넷 중 하나다.
 *
 * - `passed` — 세션이 aal2 다
 * - `challenge` — aal1 이고 확인을 마친 TOTP 가 있다. 코드를 넣으면 aal2 가 된다
 * - `enroll` — aal1 이고 확인을 마친 TOTP 가 없다
 * - `unread` — 요소 목록을 못 읽었다. 운영자 문 앞에서는 `enroll` 과 같이 닫는다
 */
export type SecondFactor = 'passed' | 'challenge' | 'enroll' | 'unread';

/**
 * 수준은 쿠키 토큰의 **서명을 확인한** 클레임에서 읽는다(`getClaims`, ADR 0117). `getAuthenticatorAssuranceLevel()`
 * 은 인자 없이 부르면 서명을 안 본 쿠키 세션을 읽으므로 쓰지 않는다. 요소 목록은 aal2 가 아닐 때만 Auth 서버에
 * 묻는다(`listFactors` 가 `getUser` 를 부른다) — 이미 지난 운영자의 화면에는 왕복이 늘지 않는다.
 */
export async function secondFactorOf(supabase: SupabaseClient<Database>): Promise<SecondFactor> {
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.aal === 'aal2') return 'passed';

  const listed = await supabase.auth.mfa.listFactors();
  if (listed.error !== null) return 'unread';
  return listed.data.totp.length > 0 ? 'challenge' : 'enroll';
}

/**
 * 확인을 마치고 돌아갈 자리 — **`/ops/` 아래만** 받는다.
 *
 * 주소창에서 온 값이라 그대로 보내면 열린 리다이렉트다(`app/auth/return-path.ts` 와 같은 까닭). 확인 화면
 * 자신이나 모르는 값이면 신고 목록으로 간다.
 */
export function opsReturnPath(value: string | string[] | null | undefined): string {
  const fallback = '/ops/reports';
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined || candidate === null || !candidate.startsWith('/ops/')) return fallback;

  try {
    const parsed = new URL(candidate, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid' || !parsed.pathname.startsWith('/ops/')) return fallback;
    if (parsed.pathname === SECOND_FACTOR_PATH) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

/** 확인 화면으로 가는 주소 — 돌아올 자리를 싣는다 */
export const secondFactorHref = (back: string): string =>
  `${SECOND_FACTOR_PATH}?next=${encodeURIComponent(opsReturnPath(back))}`;
