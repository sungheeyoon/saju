import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 로컬에서 실행할 때만 쓰는 접속값 읽기 — **배포에서는 플랫폼이 환경을 준다.**
 *
 * `.env.development.local` 은 이름과 달리 Vercel 이 내려받은 **운영** 값을 든다. 그래서
 * 이것을 부르는 자리는 곧 운영에 닿는 자리이고, 잠긴 시험(`*.live.test.ts`)에만 있다.
 *
 * **이미 환경에 있는 값은 안 덮는다.** 부르는 쪽이 셸에서 준 값이 파일보다 세다.
 *
 * `call.live.test.ts` 와 `backfill-chart.live.test.ts` 가 같은 파일을 같은 규칙으로 읽는다.
 * 두 벌로 두면 아래 따옴표 교훈을 한쪽만 배운 채로 남는다.
 */
export function loadLocalEnv(): void {
  try {
    for (const line of readFileSync('.env.development.local', 'utf8').split('\n')) {
      const [key, ...rest] = line.split('=');
      if (key && !key.startsWith('#') && rest.length > 0 && !process.env[key.trim()]) {
        /**
         * **감싼 따옴표는 값이 아니다.** Next.js 는 벗겨서 읽는데 여기서만 안 벗겨, 따옴표째
         * 열쇠를 보내 두 콜이 「잘못된 열쇠」로 떨어졌다(토큰은 안 나갔다).
         */
        const raw = rest.join('=').trim();
        process.env[key.trim()] = /^(["'])(.*)\1$/.test(raw) ? raw.slice(1, -1) : raw;
      }
    }
  } catch {
    // 파일이 없으면 이미 환경에 있다고 본다. 없는 것을 지어 채우지 않는다.
  }
}

/**
 * 이 워크트리의 로컬 스택 — 컨테이너 이름과 포트를 **Supabase CLI 와 같은 자리에서** 읽는다 (ADR 0096).
 *
 * `supabase/config.toml` 은 이름과 포트를 `env()` 로 받고, CLI 는 셸 환경 → `supabase/.env.local` →
 * `supabase/.env` 차례로 그 값을 찾는다. 도구가 다른 차례로 읽으면 CLI 가 띄운 스택과 다른 컨테이너에
 * `psql` 을 보낸다 — 그래서 차례를 여기 한 곳에 둔다.
 *
 * 접속 주소와 열쇠는 여기서 안 짓는다. 그것은 `supabase status` 가 떠 있는 스택에서 준다.
 */
export type WorktreeStack = {
  id: string;
  /** `docker exec` 로 `psql` 을 보낼 컨테이너 */
  dbContainer: string;
  /** Playwright 가 제 dev 서버를 띄우는 포트 */
  webPort: number;
  /** 흐름 검사의 첫 포트 — 검사마다 여기서 제 몫만큼 더한다 */
  checkPort: number;
};

function readEnvFile(file: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const at = line.indexOf('=');
          return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

export function worktreeStack(root = process.cwd()): WorktreeStack {
  const values = {
    ...readEnvFile(join(root, 'supabase/.env')),
    ...readEnvFile(join(root, 'supabase/.env.local')),
  };
  const valueOf = (key: string): string => {
    const value = process.env[key] ?? values[key];
    if (!value) throw new Error(`로컬 스택 값 ${key} 가 없습니다 — supabase/.env 를 보세요.`);
    return value;
  };
  const id = valueOf('SAJU_STACK_ID');
  return {
    id,
    dbContainer: `supabase_db_${id}`,
    webPort: Number(valueOf('SAJU_WEB_PORT')),
    checkPort: Number(valueOf('SAJU_CHECK_PORT')),
  };
}
