/**
 * UI 를 보려고 띄우는 개발 서버 — **로컬 스택에 붙인다.**
 *
 * `npm run dev` 를 그냥 돌리면 `.env.development.local` 을 읽어 **프로덕션 DB** 를 본다
 * (이름과 달리 그 파일은 Vercel 이 내려받은 운영 접속값이다). 화면을 보려고 누른 것이
 * 곧 운영 자료를 바꾸는 일이 된다.
 *
 * 프로세스 환경이 `.env` 파일보다 세므로 여기서 덮어 쓴다. `playwright.config.ts` 가
 * 같은 일을 하는 자리이고, 이 파일은 사람이 볼 때를 위한 같은 장치다.
 *
 * **포트를 3000 에서 비켜 둔다.** 운영에 붙은 서버가 이미 떠 있어도 서로 안 밟게.
 */

import { spawn } from 'node:child_process';

import { localStack } from './ui-seed.mjs';

const port = process.env.UI_PORT ?? '3100';
const local = localStack();

const child = spawn('npx', ['next', 'dev', '--hostname', 'localhost', '--port', port], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: local.api,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
    SUPABASE_SECRET_KEY: local.secretKey,
    SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
    /**
     * **모델은 안 부른다.** 화면을 보다가 누른 버튼 하나가 실호출이면 훑을 때마다
     * 돈이 나간다. 열쇠를 비우면 그 자리가 실패 화면으로 서고 — 그것도 볼 값이 있는
     * 화면이다.
     */
    OPENAI_API_KEY: '',
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
