import { readFileSync } from 'node:fs';

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
