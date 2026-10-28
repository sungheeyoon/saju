import type { SupabaseClient } from '@supabase/supabase-js';
import { notFound, redirect } from 'next/navigation';

import type { Database } from '@/src/lib/db';

import { SIGN_IN_AGAIN_NOTE } from '../ui/sign-in-again';
import { refuseBeforeTheDoor, type DeniedAction, type RefusedTarget, type WriteAction } from './denial';

/**
 * **운영 화면은 2단계 인증(aal2)을 마친 세션에서만 운영자 문을 부른다** (ADR 0209, ADR 0123 을 되살림).
 *
 * 여기는 **「나는 운영자인가」를 묻지 않는다** — 그 답은 여전히 DB 가 든다(ADR 0103). 묻는 것은 이 세션이 두 번째 요소를
 * 지났는가뿐이고, 지나지 않았으면 운영자 문을 **아예 부르지 않는다** — 문을 먼저 부르면 자료가 나오고 접속기록에 「읽음」이 선
 * 뒤다. 운영자가 아닌 사람은 지금처럼 404 를 받는다 — 인증 앱을 등록한 적이 없으면 확인 화면으로도 안 보낸다.
 *
 * 운영 화면(`/ops/**` 의 `page.tsx`)은 머리에서 `secondFactorGate` 를, 운영 액션(`actions.ts` 의 내보낸 함수)은 맨 앞에서
 * `writeWithoutSecondFactor` 를 부른다 — 빠진 자리는 `second-factor.boundary.test.ts` 가 붉힌다. 이것은 **화면의** 막음이다 —
 * 세션 토큰으로 PostgREST 를 직접 두드리는 길은 DB 의 막음(`is_operator()` 가 JWT 의 `aal` 도 묻는 마이그레이션 `20270102090000`)이
 * 닫는다. 그 마이그레이션은 운영자가 운영에서 등록을 마친 뒤 오른다(ADR 0209 「차례」).
 */

/** 두 번째 요소를 확인하는 화면 */
const SECOND_FACTOR_PATH = '/ops/mfa';

/**
 * 이 세션의 두 번째 요소 — 넷 중 하나다.
 *
 * - `passed` — 세션이 aal2 다
 * - `challenge` — aal1 이고 확인을 마친 TOTP 가 있다. 코드를 넣으면 aal2 가 된다
 * - `enroll` — aal1 이고 확인을 마친 TOTP 가 없다
 * - `unread` — 요소 목록을 못 읽었다. 운영자 문 앞에서는 `enroll` 과 같이 닫는다
 */
type SecondFactor = 'passed' | 'challenge' | 'enroll' | 'unread';

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
 * 운영 화면의 머리 — aal2 면 돌아오고, 아니면 **돌아오지 않는다.**
 *
 * 등록한 인증 앱이 있으면 확인 화면으로 보내고(돌아올 자리 `back` 을 싣는다), 없거나 못 읽었으면 운영자가 아닌 사람과 같은
 * 404 다 — 거절도 같은 줄(`note_operator_denial`)로 적는다. 동작 이름은 그 화면의 머리 문이다(`denial.ts`).
 */
export async function secondFactorGate(
  supabase: SupabaseClient<Database>,
  action: DeniedAction,
  back: string,
  target: RefusedTarget = {},
): Promise<void> {
  const factor = await secondFactorOf(supabase);
  if (factor === 'passed') return;
  /* `redirect` · `notFound` 는 던진다 — try 안에 두지 않는다(Next 문서) */
  if (factor === 'challenge') redirect(secondFactorHref(back));
  await refuseBeforeTheDoor(supabase, action, target);
  notFound();
}

/**
 * 운영 액션의 맨 앞 — aal2 면 `null`, 아니면 그 액션이 낼 거절이다. 거절은 운영자가 아닌 사람의 쓰기와 같은 줄로 적고
 * (`denied`), 답의 글자도 DB 가 `42501` 로 거절할 때와 같다. 화면은 이미 aal2 로 열렸으니 이 갈래는 바로 POST 한 부름이다.
 */
export async function writeWithoutSecondFactor(
  supabase: SupabaseClient<Database>,
  action: WriteAction,
  target: RefusedTarget = {},
): Promise<{ readonly ok: false; readonly message: string } | null> {
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.aal === 'aal2') return null;
  await refuseBeforeTheDoor(supabase, action, target);
  return { ok: false, message: SIGN_IN_AGAIN_NOTE };
}

/**
 * 확인을 마치고 돌아갈 자리 — **`/ops/` 아래만** 받는다.
 *
 * 주소창에서 온 값이라 그대로 보내면 열린 리다이렉트다(`src/lib/consent/return-path.ts` 와 같은 까닭). 확인 화면
 * 자신이나 모르는 값이면 오늘의 숫자로 간다.
 */
export function opsReturnPath(value: string | string[] | null | undefined): string {
  const fallback = '/ops/today';
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

/** 화면이 받은 주소 값(`searchParams`)을 돌아올 자리로 다시 잇는다 — 글자 값만, 첫 값만 */
export function backTo(pathname: string, params: Record<string, string | string[] | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one !== undefined) query.set(key, one);
  }
  const search = query.toString();
  return search === '' ? pathname : `${pathname}?${search}`;
}
