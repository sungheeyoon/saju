/**
 * 로그인 뒤 돌아갈 내부 경로.
 *
 * 외부 주소와 프로토콜 상대 주소(`//…`)는 받지 않는다. OAuth 콜백의 `next`는
 * 주소창에서 온 값이므로 그대로 redirect 하면 열린 리다이렉트가 된다.
 */
export function safeReturnPath(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate?.startsWith('/') || candidate.startsWith('//')) return '/me';

  try {
    const parsed = new URL(candidate, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid') return '/me';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/me';
  }
}
