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
 * ## 돌아갈 곳은 **요청이 정한다**
 *
 * 여기서 `new URL(경로, url.origin)` 으로 절대 주소를 지었는데, `request.url` 의
 * origin 은 **요청이 들어온 주소가 아니라 서버가 묶인 주소**다. `--hostname 0.0.0.0`
 * 으로 띄우면 `localhost:3000` 으로 들어온 사람을 `0.0.0.0:3000` 으로 돌려보낸다.
 *
 * 그 둘은 **다른 오리진**이라 방금 붙인 세션 쿠키가 안 실린다. 그래서 로그인은
 * 성공했는데 도착한 화면에는 세션이 없고, 관문이 다시 로그인 화면으로 튕긴다 —
 * 사용자에게는 「로그인했는데 계속 로그인하라고 한다」로 보인다.
 *
 * 그래서 **오리진을 짓지 않는다.** `Location` 에 경로만 적으면 브라우저가 자기가
 * 두드린 주소를 기준으로 푼다(RFC 7231). 도착지는 `safeReturnPath` 가 이미 같은
 * 오리진의 경로로 좁혀 두었으므로, 여기서 오리진을 아는 척할 이유가 없다.
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
    return goTo('/auth/denied');
  }

  if (code === null) {
    return goTo('/auth');
  }

  const supabase = await supabaseOnServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  await dropSpentVerifiers();

  if (error) {
    return goTo('/auth/denied');
  }

  // 로그인 전에 적던 입력을 되살리기 전에 가입 관문을 먼저 지난다
  const destination = returnTo === '/#resume-reading' ? '/signup?resume=reading' : returnTo;
  return goTo(destination);
}

/**
 * 같은 오리진 안에서 옮긴다 — **주소는 브라우저가 짓는다.**
 *
 * `NextResponse.redirect` 는 절대 주소를 요구하므로 쓰지 않는다. 여기서 절대 주소를
 * 지으려면 오리진을 알아야 하는데, 이 자리에서 아는 오리진은 요청이 들어온 곳이
 * 아니다(위 머리말). 경로만 적으면 그 문제가 사라진다.
 */
function goTo(path: string) {
  return new NextResponse(null, { status: 307, headers: { Location: path } });
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
