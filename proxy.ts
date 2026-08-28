import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from '@/app/auth/config';

/**
 * 세션을 갱신한다 — **여기서 판정하지 않는다.**
 *
 * Next 16 에서 `middleware.ts` 는 폐기되고 이 자리가 `proxy.ts` 가 됐다. Supabase
 * 문서는 아직 전부 `middleware.ts` 로 적혀 있으니 그대로 베끼면 안 된다.
 *
 * 하는 일은 하나다. 만료된 access token 을 새로 받아 쿠키에 다시 심는다. 서버
 * 컴포넌트는 쿠키를 쓸 수 없으므로(응답 헤더가 이미 나갔다) 갱신할 자리가 여기밖에
 * 없다.
 *
 * **접근 판정은 안 한다.** Next 문서도 proxy 를 「낙관적 확인」까지로 못박고, 우리
 * 쪽 이유는 더 단순하다 — 무엇을 볼 수 있는지는 DB 정책이 정한다. 여기서 한 번 더
 * 판정하면 답하는 자리가 둘이 되고, 둘은 언젠가 어긋난다.
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of written) response.cookies.set(name, value, options);
      },
    },
  });

  // 이 한 줄이 갱신을 일으킨다. 값을 쓰지 않아도 불러야 한다.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * 익명 흐름은 지나가지 않게 한다.
   *
   * `/` 만 로그인 없이 도는 정적 화면이다. `/compat` 은 로그인 후 쓰므로 만료된
   * 세션을 갱신해야 한다.
   */
  matcher: ['/me/:path*', '/compat', '/auth/:path*'],
};
