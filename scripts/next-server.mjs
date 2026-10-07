/**
 * 검사용 Next 서버 — **따로 지어서 따로 세운다.**
 *
 * `next dev` 를 쓰지 않는 것은 한 폴더에 개발 서버가 하나만 뜨기 때문이다. 켜 둔
 * 개발 서버가 있으면 검사가 그것을 끄라고 요구하게 된다. 산출물 자리도 `.next-check`
 * 로 옮겨 평소 빌드를 건드리지 않는다(`next.config.ts` 의 `distDir`).
 *
 * 접속값은 **빌드할 때와 띄울 때 둘 다** 넘긴다. `NEXT_PUBLIC_` 은 빌드 때 코드에
 * 박히고 서버가 읽는 것은 띄울 때의 값이라, 한쪽만 주면 원격을 보게 된다.
 *
 * `secretKey` 는 **주는 검사만 준다.** 공유 결과 화면 하나가 그것으로 매인 판본을
 * 읽는다(ADR 0010). 안 주면 그 화면은 「지금은 열 수 없습니다」로 서므로, 열쇠가
 * 없을 때 무슨 일이 나는지도 검사가 실제로 볼 수 있다. 내 사람을 등록 · 고치거나 참여를
 * 여는 화면도 열쇠로 쓴다(G-64, ADR 0136) — 그 화면을 두드리는 검사는 준다.
 *
 * `whileRunning` 은 **띄울 때만** 얹는다. 빌드에도 얹으면 그 값이 코드에 박혀, 다음에
 * 그 값 없이 세운 서버까지 같은 것을 들고 돈다 — 훑기가 시계를 미는 자리가 그렇다.
 */
import { execFileSync, spawn } from 'node:child_process';

let built = false;

/**
 * `listenAll` 은 **컨테이너가 두드리는 검사만** 켠다 — DB 의 `pg_net` 이 `host.docker.internal` 로 앱을 부르는 웹 푸시가
 * 그렇다(`check-push.mjs`). Docker Desktop(WSL · macOS)은 그 이름을 호스트의 루프백으로 잇지만, 리눅스(CI)에서는 브리지의
 * 게이트웨이 주소라 `localhost` 에만 선 서버에 안 닿는다(2026-10-08 CI 에서 배달 열한 건이 시한을 넘겼다).
 */
export async function startCheckServer({ port, supabaseUrl, anonKey, secretKey, whileRunning, built: builtWith, listenAll = false }) {
  const env = {
    ...process.env,
    NEXT_DIST_DIR: '.next-check',
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    // 로컬 것만 들어간다. `next start` 는 `NODE_ENV=production` 이라
    // `.env.development.local`(원격 값)을 읽지 않는다 — 검사가 원격을 건드릴 자리가 없다.
    ...(secretKey ? { SUPABASE_SECRET_KEY: secretKey } : {}),
    /**
     * 빌드에 박혀야 하는 값(`NEXT_PUBLIC_` 하나 더) — 웹 푸시의 공개 열쇠가 그렇다(`check-push.mjs`). 빌드와 띄우기
     * 양쪽에 얹는다. `whileRunning` 과 달리 이 값은 코드에 박히는 것이 목적이다.
     */
    ...builtWith,
  };

  if (!built) {
    console.log('\n… 검사용 서버를 짓는다 (.next-check)');
    execFileSync('npx', ['next', 'build'], { env, stdio: 'ignore' });
    built = true;
  }

  const server = spawn('npx', ['next', 'start', '--hostname', listenAll ? '0.0.0.0' : 'localhost', '--port', String(port)], {
    env: { ...env, ...whileRunning },
    stdio: 'ignore',
    // 제 프로세스 묶음으로 띄운다 — `npx` 만 끄면 그 아래 `next-server` 가 포트를 쥔 채 남아, 다음 검사가 옛 서버를 두드린다
    detached: true,
  });

  const base = `http://localhost:${port}`;
  const stop = () => {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // 이미 끝났다
    }
  };
  process.on('exit', stop);

  // 뜨기 전에 두드리면 검사가 아니라 경주가 된다.
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(base, { redirect: 'manual' });
      return { base, stop };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  stop();
  throw new Error(`Next 서버가 ${base} 에 뜨지 않았습니다.`);
}
