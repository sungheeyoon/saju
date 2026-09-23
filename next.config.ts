import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

/**
 * **브라우저가 부를 수 있는 곳** — 강제한다(G-23 ②).
 *
 * `Report-Only` 로 먼저 세워 e2e 전부(익명 · 로그인 · 관문)에서 어긴 자리 0 을 확인한 뒤 강제로
 * 올렸다(2026-09-23). 운영 화면이 부르는 출처도 브라우저로 열어 쟀다 — 홈 · 로그인 · 처리방침 · 궁합(로그인으로
 * 튕긴다)에서 스크립트 58 · 글꼴 60 · 요청 14 가 전부 제 출처였고, Vercel Analytics · 툴바처럼 운영에서만 붙는
 * 스크립트는 없다(쓰지 않고, 미리보기 배포도 없다). 그래서 **바깥으로 열린 곳은 Supabase 하나다.**
 *
 * **아직 강제하지 않는 것 — `script-src` 의 `'unsafe-inline'`.** 그것을 빼려면 Next 가 페이지에
 * 심는 인라인 스크립트마다 nonce 가 필요하고, nonce 를 쓰면 지금 미리 만들어 두는 화면이 요청마다
 * 다시 그려진다. PG · 본인인증 도메인과 함께 정한다 — 잰 값은 G-23 ② 와
 * `docs/notes/csp-nonce-2026-09-23.md`. `style-src` 의 `'unsafe-inline'` 도 같은 결정을 기다린다.
 *
 * `frame-ancestors` 는 `Report-Only` 에서 무시돼 따로 한 줄로 강제하던 것을 이 정책 하나에 합쳤다.
 * 어긴 자리를 받는 `report-uri` 는 두지 않았다 — 받을 서버가 곧 누구나 쓸 수 있는 공개 POST 가 되고,
 * 어긴 자리는 곧 깨진 화면이라 e2e 의 손잡이(`e2e/csp.ts`)가 먼저 본다. 운영에서 깨지면 되돌리는
 * 법은 `docs/ops/runbook.md` 「CSP 가 화면을 막을 때」.
 *
 * 개발 서버는 `eval` 과 웹소켓(HMR)을 쓴다 — 그 둘은 개발에서만 연다.
 */
const contentSecurityPolicy = [
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
           * **강제하는 것 넷** — 부를 수 있는 출처(CSP, 위), 남의 틀 안에 못 들어가고(클릭재킹 —
           * CSP 의 `frame-ancestors` 를 모르는 옛 브라우저에는 `X-Frame-Options`), 파일 종류를
           * 추측하지 않고, 쓰지 않는 기기 권한을 닫는다. 결제(`payment`)는 PG 가 정해질 때 본다.
           */
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
