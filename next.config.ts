import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

/**
 * **브라우저가 부를 수 있는 곳** — 아직 막지 않고 어긴 자리만 알린다(G-23 ②).
 *
 * `Report-Only` 로 먼저 세운다. 강제하려면 Next 가 페이지에 심는 인라인 스크립트마다 nonce 가
 * 필요하고, nonce 를 쓰면 지금 미리 만들어 두는 화면이 요청마다 다시 그려진다 — 성능과 비용이
 * 바뀌는 결정이라 PG · 본인인증 도메인이 정해질 때 함께 정한다. 그래서 `script-src` 의
 * `'unsafe-inline'` 은 **지금 이 정책이 재는 것이 아니다.** 지금 재는 것은 스크립트 밖의
 * 출처 — 연결 · 이미지 · 글꼴 · 틀 · 폼 — 이고, e2e 가 어긴 자리 0 을 지킨다(`e2e/csp.ts`).
 *
 * 개발 서버는 `eval` 과 웹소켓(HMR)을 쓴다 — 그 둘은 개발에서만 연다.
 */
const reportOnlyPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}${isDev ? ' ws: wss:' : ''}`.trimEnd(),
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  // The in-app preview reaches the dev server through IPv4 loopback.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  /**
   * 빌드 산출물을 어디에 둘지 — **평소에는 `.next` 하나다.**
   *
   * 서버 검사(`scripts/check-managed.mjs`)만 이 값을 옮긴다. 그 검사는 로컬 스택을
   * 보는 서버를 따로 세워 두드리는데, 개발 서버가 이미 떠 있으면 같은 자리를 두고
   * 다투게 된다 — `next dev` 는 한 폴더에 하나만 뜬다. 자리를 나누면 켜 둔 개발
   * 서버를 끄지 않고도 잴 수 있다.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  /**
   * 주소가 밖으로 새어 나가지 않게 한다.
   *
   * 입력은 이제 `#` 뒤에 실리고(`app/hash-query.ts`) fragment 는 `Referer` 에 애초에
   * 담기지 않는다. 그래도 거는 것은 **아직 도는 옛 `?` 링크** 때문이다 — 그 주소로
   * 들어온 화면에서 외부 링크를 하나만 눌러도 두 사람의 생년월일시가 상대 서버의
   * 로그에 남는다. `#` 으로 갈아 놓기 전의 첫 화면에서 일어날 수 있는 일이다.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          /**
           * **강제하는 것 셋** — 남의 틀 안에 못 들어가고(클릭재킹), 파일 종류를 추측하지 않고,
           * 쓰지 않는 기기 권한을 닫는다. `frame-ancestors` 는 `Report-Only` 에서 무시되므로
           * 강제 정책에 따로 한 줄로 선다. 결제(`payment`)는 PG 가 정해질 때 본다.
           */
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'Content-Security-Policy-Report-Only', value: reportOnlyPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
