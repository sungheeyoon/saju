/** 두 번째 요소를 확인하는 화면 */
const SECOND_FACTOR_PATH = '/ops/mfa';

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
