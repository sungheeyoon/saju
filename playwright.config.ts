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
      /** 공유 결과 화면 하나가 이 열쇠로 매인 판본을 읽는다(ADR 0010) */
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    };
  } catch {
    return {};
  }
}

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
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
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
