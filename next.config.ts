import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

export default nextConfig;
