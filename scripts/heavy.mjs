/**
 * **무거운 실행을 기계 전체에서 한 번에 하나만** 돌린다 — `next build` · Playwright e2e · 흐름 검사(`package.json` 의 그 스크립트들이
 * 이 파일을 지난다). `node scripts/heavy.mjs <명령…>`.
 *
 * 2026-10-08 에 워크트리 셋이 e2e 와 빌드를 나란히 돌리자 WSL 의 메모리(6GB)와 스왑이 다 차서 에이전트가 10분씩 멈췄고, 로그인
 * e2e 스물하나가 dev 서버를 기다리다 시간 초과로 붉었다(`docs/notes/2026-10-08-perf-round.md`). 스택 자리(ADR 0096)는 포트와
 * 컨테이너를 가르지만 메모리는 못 가른다. 에이전트마다 손으로 감싸던 `flock` 은 워크트리 격리가 막아 스크래치 파일에 숨었고, 같은
 * 스크래치를 두 에이전트가 덮었다.
 *
 * - **잠금은 디렉터리 하나다** — `mkdir` 은 원자적이다(`scripts/remote-lock.mjs` 와 같은 꼴). 자리는 집 폴더라 워크트리가 달라도 하나다.
 * - **안에서 또 부르면 잠그지 않는다.** 잡은 쪽이 자식에게 `SAJU_HEAVY_HELD=1` 을 물려준다 — 감싼 스크립트가 감싼 스크립트를 부르면
 *   바깥이 쥔 잠금을 안쪽이 기다리며 둘 다 선다.
 * - **CI 는 잠그지 않는다** — 러너 하나에 실행 하나다. Vercel 의 운영 빌드도 `npm run build` 로 이 파일을 지난다.
 * - **종료 코드와 신호는 그대로 낸다.** 자식이 신호로 죽었으면 잠금을 풀고 같은 신호로 스스로 죽는다 — 부른 쪽(npm · 셸 · 하네스)이
 *   「중단됐다」를 「실패했다」와 가를 수 있게.
 * - **죽은 쪽의 잠금은 걷는다.** 원격 잠금(`remote-lock.mjs`)은 걷지 않고 사람을 부른다 — 둘이 함께 걷으면 운영 DB 에 둘이 든다.
 *   여기서 같은 경합이 나면 무거운 실행 둘이 잠깐 겹칠 뿐이라 기다리던 일이 멈추지 않는 쪽을 골랐다.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { constants, homedir } from 'node:os';
import { join } from 'node:path';

const LOCK = process.env.SAJU_HEAVY_LOCK ?? join(homedir(), '.cache', 'saju', 'heavy.lock');
/** e2e 전부가 30분 가까이 걸린다 — 그 둘을 기다릴 만큼 */
const WAIT_MS = 60 * 60 * 1000;
/** 잡은 쪽이 owner 를 적기 전의 틈 */
const UNWRITTEN_MS = 10 * 1000;

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('돌릴 명령이 없습니다 — `node scripts/heavy.mjs next build`');
  process.exit(1);
}

/** CI 는 러너마다 `CI=true`(GitHub) · `CI=1`(Vercel 의 빌드)다 */
const onCi = (process.env.CI ?? '') !== '' && process.env.CI !== 'false' && process.env.CI !== '0';
const held = onCi || process.env.SAJU_HEAVY_HELD === '1';

function holder() {
  try {
    return JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8'));
  } catch {
    return null;
  }
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

const writeOwner = (extra = {}) =>
  writeFileSync(
    join(LOCK, 'owner.json'),
    JSON.stringify({ pid: process.pid, cwd: process.cwd(), command: command.join(' '), at: new Date().toISOString(), ...extra }),
  );

async function acquire() {
  mkdirSync(join(LOCK, '..'), { recursive: true });
  const started = Date.now();
  let told = false;
  let unwrittenSince = null;
  for (;;) {
    try {
      mkdirSync(LOCK);
      writeOwner();
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = holder();
    if (owner === null) {
      unwrittenSince ??= Date.now();
      if (Date.now() - unwrittenSince > UNWRITTEN_MS) rmSync(LOCK, { recursive: true, force: true });
    } else {
      unwrittenSince = null;
      if (!alive(owner.pid) && !alive(owner.child)) {
        console.error(`무거운 실행 잠금을 걷는다 — 쥐었던 쪽이 없다: ${owner.command} (${owner.cwd}, ${owner.at})`);
        rmSync(LOCK, { recursive: true, force: true });
        continue;
      }
      if (!told) {
        console.error(`다른 세션이 무거운 실행 중이다 — 기다린다: ${owner.command} (${owner.cwd}, ${owner.at})`);
        told = true;
      }
    }
    if (Date.now() - started > WAIT_MS) {
      console.error(`60분을 기다려도 안 풀렸다 — 쥔 쪽: ${owner?.command ?? '?'} (pid ${owner?.pid ?? '?'}). 잠금: ${LOCK}`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const release = () => {
  if (!held && holder()?.pid === process.pid) rmSync(LOCK, { recursive: true, force: true });
};

if (!held) await acquire();
const child = spawn(command[0], command.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, SAJU_HEAVY_HELD: '1' },
});
// 래퍼가 죽어도 자식이 살아 있는 동안은 잠금이 산 것으로 보이게 자식 pid 를 적는다
if (!held) writeOwner({ child: child.pid });
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => {
  release();
  console.error(`명령을 못 띄웠다: ${command[0]} — ${error.message}`);
  process.exit(127);
});
child.on('exit', (code, signal) => {
  release();
  if (signal) {
    process.removeAllListeners(signal);
    process.kill(process.pid, signal);
    // 신호를 막아 둔 환경이면 위가 안 죽인다 — 셸의 관례 값으로 낸다
    setTimeout(() => process.exit(128 + (constants.signals[signal] ?? 0)), 100);
    return;
  }
  process.exit(code ?? 1);
});
