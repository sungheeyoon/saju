import { execFileSync } from 'node:child_process';

import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${port}`;

/**
 * 개발 서버를 **로컬 스택에 붙여** 띄운다.
 *
 * `.env.development.local` 은 원격 프로젝트를 가리킨다. 그대로 두면 로그인 흐름 시험이
 * 원격에 계정을 만든다 — 검사가 만든 사람이 실제 후보 목록에 서는 것이다. 프로세스
 * 환경이 `.env` 파일보다 세므로 여기서 덮어 쓴다. 익명 시험은 Supabase 를 두드리지
 * 않아 영향이 없고, 이제 **원격에 닿을 자리 자체가 없다.**
 *
 * 로컬 스택이 없으면 접속값 자리를 비워 둔 채 띄운다. 익명 시험은 그대로 돌고,
 * 로그인 흐름은 `e2e/session.ts` 가 「`npm run db:start` 뒤에 다시 도세요」로 죽는다 —
 * 그쪽이 이유를 아는 자리다.
 */
function localStack(): Record<string, string> {
  try {
    const status = JSON.parse(
      execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    return {
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
      SUPABASE_URL: status.API_URL,
      /**
       * 공유 결과 화면이 이 열쇠로 매인 판본을 읽는다(ADR 0010).
       *
       * **이름 둘을 다 덮는다.** `keyed-client.ts` 는 `SUPABASE_SECRET_KEY` 를 먼저
       * 보므로 하나만 덮으면 원격 열쇠가 로컬 API 를 두드리다 「권한 없음」으로 끝난다 —
       * 열쇠가 없는 배포와 똑같은 얼굴이라 무엇이 틀렸는지 화면에서 안 보인다.
       */
      SUPABASE_SECRET_KEY: status.SECRET_KEY,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    };
  } catch {
    return {};
  }
}

/**
 * 로그인한 세션이 있어야 도는 시험들 — **이름으로 가른다.**
 *
 * 디렉터리로 가르지 않는 것은 `session.ts` 와 `birth-form.ts` 같은 손잡이를 양쪽이
 * 함께 쓰기 때문이다. 옮겨 두면 상대 경로가 길어지고, 길어진 경로는 어느 쪽이
 * 백엔드를 요구하는지 말해 주지 않는다.
 */
const AUTHED = ['**/signed-in.spec.ts', '**/match.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  /**
   * **백엔드가 필요한 시험과 아닌 시험을 project 로 가른다.**
   *
   * `auth.spec.ts` 가 「로그인하지 않은 사람을 돌려보내는 데 백엔드가 필요하면 그것부터
   * 잘못이다」라고 적어 두었고, 그 계약 덕에 익명 시험은 CI 의 껍데기 접속값으로도
   * 돈다. 로그인 흐름은 반대다 — 로컬 스택에 계정을 만들어야 시작조차 못 한다.
   *
   * 둘을 한 project 에 두면 **기본 명령이 스택 없이는 초록으로 안 끝난다.** 그러면
   * 「원래 두 개는 빨간불이다」가 되고, 그 순간부터 아무도 이 층의 색을 안 본다.
   *
   * `npm run test:e2e` 는 위 둘만 돌린다. 로그인 흐름은 `npm run test:e2e:authed` 이고
   * 그것만 `npm run db:start` 를 요구한다.
   */
  projects: [
    {
      name: 'desktop-chromium',
      testIgnore: AUTHED,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: AUTHED,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'authed-desktop',
      testMatch: AUTHED,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authed-mobile',
      testMatch: AUTHED,
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname localhost --port ${port}`,
    env: localStack(),
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
