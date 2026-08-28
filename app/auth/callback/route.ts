import { NextResponse } from 'next/server';
import { supabaseOnServer } from '../server-client';
import { safeReturnPath } from '../return-path';

/**
 * 구글이 답을 들고 돌아오는 자리.
 *
 * 여기 오는 길은 둘이다.
 *
 * - `code` 를 들고 온다 — 통과했다. 그 코드를 세션으로 바꾼다.
 * - `error` 를 들고 온다 — **초대 관문에 막혔다.** 계정은 만들어지지 않았다.
 *
 * 두 번째가 우리가 일부러 만든 길이다. `auth.users` 에 아무것도 안 남으므로,
 * 다음에 초대 명단에 넣으면 그때 처음 가입한 것과 똑같이 들어온다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnTo = safeReturnPath(url.searchParams.get('next'));

  if (url.searchParams.get('error') !== null) {
    return NextResponse.redirect(new URL('/auth/denied', url.origin));
  }

  if (code === null) {
    return NextResponse.redirect(new URL('/auth', url.origin));
  }

  const supabase = await supabaseOnServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/auth/denied', url.origin));
  }

  return NextResponse.redirect(new URL(returnTo, url.origin));
}
