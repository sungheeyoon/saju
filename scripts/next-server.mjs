/**
 * 검사용 Next 서버 — **따로 지어서 따로 세운다.**
 *
 * `next dev` 를 쓰지 않는 것은 한 폴더에 개발 서버가 하나만 뜨기 때문이다. 켜 둔
 * 개발 서버가 있으면 검사가 그것을 끄라고 요구하게 된다. 산출물 자리도 `.next-check`
 * 로 옮겨 평소 빌드를 건드리지 않는다(`next.config.ts` 의 `distDir`).
 *
 * 접속값은 **빌드할 때와 띄울 때 둘 다** 넘긴다. `NEXT_PUBLIC_` 은 빌드 때 코드에
 * 박히고 서버가 읽는 것은 띄울 때의 값이라, 한쪽만 주면 원격을 보게 된다.
 */
import { execFileSync, spawn } from 'node:child_process';

let built = false;

export async function startCheckServer({ port, supabaseUrl, anonKey }) {
  const env = {
    ...process.env,
    NEXT_DIST_DIR: '.next-check',
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
  };

  if (!built) {
    console.log('\n… 검사용 서버를 짓는다 (.next-check)');
    execFileSync('npx', ['next', 'build'], { env, stdio: 'ignore' });
    built = true;
  }

  const server = spawn('npx', ['next', 'start', '--hostname', 'localhost', '--port', String(port)], {
    env,
    stdio: 'ignore',
  });

  const base = `http://localhost:${port}`;
  const stop = () => server.kill('SIGTERM');
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
