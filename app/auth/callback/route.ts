import { cookies } from 'next/headers';
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
 *
 * ## 지나온 흔적을 치운다
 *
 * 로그인을 **시작할 때마다** PKCE 검증 쿠키가 하나 생기는데, 그 이름에는 그 시도의
 * 번호가 박힌다(`…-auth-token-flow-<난수>-code-verifier`). 이름이 매번 다르니 **덮어
 * 쓰이지 않고 쌓인다.** 끝까지 못 간 시도는 자기 쿠키를 남기고, 그 쿠키는 그 뒤로 모든
 * 요청에 실려 나간다.
 *
 * 쌓이면 요청 헤더가 Node 의 한도(16KB)를 넘고, 그때 서버는 화면이 아니라 **431** 을
 * 돌려준다. 그러면 로그인이 안 되고, 안 되니 또 시도하고, 시도마다 쿠키가 하나씩 는다 —
 * 스스로 깊어지는 구덩이다. 실제로 로컬에서 이 구덩이에 빠졌다.
 *
 * 그래서 **여기를 지날 때 치운다.** 이 자리에 왔다는 것은 흐름이 끝났다는 뜻이고
 * (통과했든 막혔든), 끝난 흐름의 검증 쿠키는 아무도 다시 안 쓴다. 바꿔 준 뒤에
 * 치우는 것이 요점이다 — `exchangeCodeForSession` 이 그 쿠키를 읽는다.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnTo = safeReturnPath(url.searchParams.get('next'));

  if (url.searchParams.get('error') !== null) {
    await dropSpentVerifiers();
    return NextResponse.redirect(new URL('/auth/denied', url.origin));
  }

  if (code === null) {
    return NextResponse.redirect(new URL('/auth', url.origin));
  }

  const supabase = await supabaseOnServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  await dropSpentVerifiers();

  if (error) {
    return NextResponse.redirect(new URL('/auth/denied', url.origin));
  }

  // Complete the beta onboarding before restoring the anonymous reading input.
  const destination = returnTo === '/#resume-reading' ? '/signup?resume=reading' : returnTo;
  return NextResponse.redirect(new URL(destination, url.origin));
}

/**
 * 다 쓴 검증 쿠키를 지운다 — **하나가 아니라 남아 있는 전부.**
 *
 * 방금 쓴 것만 지우면 이전 시도들이 남긴 것은 그대로다. 그 쌓인 것이 문제였으므로,
 * 지금 흐름이 끝난 김에 같이 쓸어 낸다. 여기 온 사람은 방금 답을 받았으니, 아직
 * 안 끝난 다른 시도가 있더라도 그것은 이미 쓸모가 없다.
 *
 * `code === null` 로 들어온 요청에서는 안 부른다. 그것은 흐름이 끝난 것이 아니라
 * **길을 잘못 든 것**이라, 다른 탭에서 도는 진짜 흐름의 쿠키를 뺏을 수 있다.
 */
async function dropSpentVerifiers() {
  const store = await cookies();

  for (const { name } of store.getAll()) {
    if (name.endsWith('-code-verifier')) store.delete(name);
  }
}
