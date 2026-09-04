import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseEnv } from '@/app/auth/config';
import { gateFor, scheduleFrom } from '@/src/lib/consent';

/**
 * 세션을 갱신하고, **`/me` 아래로 들어오는 사람에게 길을 가리킨다.**
 *
 * Next 16 에서 `middleware.ts` 는 폐기되고 이 자리가 `proxy.ts` 가 됐다. Supabase
 * 문서는 아직 전부 `middleware.ts` 로 적혀 있으니 그대로 베끼면 안 된다.
 *
 * ## 관문이 여기로 온 이유 — **레이아웃은 안 돈다**
 *
 * 안내·종료·이름 셋은 `app/me/layout.tsx` 에 있었다. 그런데 **레이아웃은 자기 아래
 * 화면끼리 옮겨 다닐 때 다시 안 돈다** — 재어 봤다(2026-09-04). 그래서 관문이 첫 문서
 * 적재에서만 섰고, 앱 안에서 걸어 다니는 사람에게는 아무것도 안 물었다. 그리고
 * 레이아웃이 자기 아래 화면으로 튕기면 브라우저가 그 조각을 끝없이 다시 받아 **화면이
 * 빈다**(커밋 `2cbb31f`).
 *
 * 여기는 앱 안 이동에도 매번 돈다. 그것이 이 자리로 옮긴 유일한 이유다.
 *
 * ## 그래도 **접근 판정은 안 한다**
 *
 * 무엇을 볼 수 있는지는 여전히 DB 정책이 정하고, 되돌릴 수 없는 문마다 DB 가 다시
 * 묻는다(`create_self_person`·`start_reading_run`·`is_active_account`). 여기서 하는
 * 일은 **길을 가리키는 것**뿐이라, 이 파일이 통째로 틀려도 열리는 문은 없다.
 *
 * 고르는 규칙은 여기 없다 — `gateFor` 가 든다. 자료를 읽는 일과 고르는 일을 떼어
 * 두면 규칙을 브라우저 없이 전부 밟을 수 있고, **밟히지 않은 규칙이 그 구멍을
 * 만들었다.**
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabaseEnv();

  /**
   * 갱신된 쿠키를 **어느 응답에든 다시 싣는다.**
   *
   * 전에는 `setAll` 안에서 응답을 새로 만들었다. 그러면 튕기는 응답에는 그 쿠키가 못
   * 실린다 — 방금 새로 받은 토큰을 버리고 보내는 셈이라, 만료가 겹치는 순간 사용자가
   * 로그인 화면과 관문 사이를 오간다.
   */
  const fresh: { name: string; value: string; options?: object }[] = [];

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (written) => {
        for (const { name, value } of written) request.cookies.set(name, value);
        fresh.push(...written);
      },
    },
  });

  const carrying = (response: NextResponse) => {
    for (const { name, value, options } of fresh) response.cookies.set(name, value, options);
    return response;
  };

  // 이 한 줄이 갱신을 일으킨다. 값도 쓴다 — 로그인하지 않은 사람에게는 길을 안 가리킨다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
    **로그인 판정은 여기서 안 한다.** 화면마다 이미 하고 있고(`redirect('/auth')`),
    여기서 또 하면 판정하는 자리가 둘이 된다.
  */
  if (user === null) return carrying(NextResponse.next({ request }));

  /*
    계정을 못 읽은 것은 안내를 안 본 것과 다르다. `gateFor` 가 그때 아무 데도 안
    보내고, 화면이 「계정을 읽지 못했습니다」라고 말한다.
  */
  const [{ data: account }, notice] = await Promise.all([
    supabase.from('app_user').select('nickname, notice_version, notice_schedule_id').maybeSingle(),
    scheduleFrom((name) => supabase.rpc(name)),
  ]);

  const where = gateFor(
    request.nextUrl.pathname,
    account === null
      ? null
      : {
          nickname: account.nickname,
          noticeVersion: account.notice_version,
          noticeScheduleId: account.notice_schedule_id,
        },
    notice,
    new Date(),
  );

  if (where !== null) return carrying(NextResponse.redirect(new URL(where, request.url)));

  return carrying(NextResponse.next({ request }));
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
