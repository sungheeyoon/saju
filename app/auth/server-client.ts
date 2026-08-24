import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseEnv } from './config';

/**
 * 서버가 드는 Supabase — **사용자 JWT 로 돈다.**
 *
 * service role 을 쓰지 않는다. 그 키는 RLS 를 통째로 지나가므로, 한 번 쓰기
 * 시작하면 「이 요청이 무엇을 볼 수 있는가」의 답이 정책이 아니라 앱 코드로
 * 옮겨 간다 — 정책을 DB 에 건 이유가 사라진다.
 *
 * `cookies()` 는 이 버전에서 async 다.
 */
export async function supabaseOnServer() {
  /**
   * **쿠키를 먼저 만진다 — 순서가 뜻을 갖는다.**
   *
   * 이 함수를 부르는 화면은 사람마다 다르므로 미리 그려질 수 없다. Next 는 빌드 때
   * 한 번 그려 보다가 `cookies()` 에 닿는 순간 「이건 동적이다」로 판정하고 물러난다.
   * 접속값을 먼저 읽으면 그 판정에 닿기 전에 터져서, 접속값이 없는 사람의 빌드가
   * 통째로 실패한다 — 정작 빌드에는 필요 없는 값인데도.
   */
  const store = await cookies();
  const { url, publishableKey } = supabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (written) => {
        try {
          for (const { name, value, options } of written) store.set(name, value, options);
        } catch {
          /**
           * 서버 컴포넌트에서는 쿠키를 못 쓴다 — 응답 헤더가 이미 나갔기 때문이다.
           * 삼켜도 되는 이유는 갱신을 `proxy.ts` 가 하기 때문이다. 그쪽이 없으면
           * 세션이 만료된 채로 굳으므로, 이 `catch` 는 proxy 와 한 벌이다.
           */
        }
      },
    },
  });
}
