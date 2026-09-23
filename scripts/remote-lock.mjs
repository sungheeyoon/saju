/**
 * 원격 DB 에 닿는 명령을 **기계 전체에서 한 번에 하나만** 돌린다 — `npm run db:push` · `npm run db:remote -- "<sql>"`.
 *
 * 로컬 스택은 워크트리마다 가를 수 있지만(ADR 0096) 운영 DB 는 하나다. 두 세션이 나란히 `db push` 를 하면
 * 서로 다른 가지의 마이그레이션이 섞여 오르고, `db query --linked` 는 나란히 부르면 로그인 역할을 세우다
 * 부딪혀 떨어진다(delegation.md 「로컬 환경의 함정」). 그래서 잠금은 워크트리 밖, 사용자의 집 폴더에 둔다.
 *
 * 잠금은 디렉터리 하나다 — `mkdir` 은 원자적이라 둘이 동시에 잡을 수 없다. 잡은 쪽의 pid 가 죽어 있으면
 * 남은 잠금으로 보고 걷는다.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOCK = join(homedir(), '.cache', 'saju', 'remote.lock');
const WAIT_MS = 10 * 60 * 1000;

const command = process.argv.slice(2);
if (command.length === 0) {
  console.error('돌릴 명령이 없습니다 — `node scripts/remote-lock.mjs npx supabase db push`');
  process.exit(1);
}

function holder() {
  try {
    return JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8'));
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function acquire() {
  mkdirSync(join(homedir(), '.cache', 'saju'), { recursive: true });
  const started = Date.now();
  let told = false;
  for (;;) {
    try {
      mkdirSync(LOCK);
      writeFileSync(
        join(LOCK, 'owner.json'),
        JSON.stringify({ pid: process.pid, cwd: process.cwd(), command: command.join(' '), at: new Date().toISOString() }),
      );
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const owner = holder();
    // 막 만들어져 owner 가 아직 안 적힌 순간이면 다음 바퀴에 다시 본다
    if (owner && !alive(owner.pid)) {
      console.error(`남은 잠금을 걷는다 — pid ${owner.pid} 는 이미 없다 (${owner.cwd})`);
      rmSync(LOCK, { recursive: true, force: true });
      continue;
    }
    if (!told) {
      console.error(`다른 세션이 원격 DB 를 쓰는 중이다 — 기다린다: ${owner ? `${owner.command} (${owner.cwd}, ${owner.at})` : '?'}`);
      told = true;
    }
    if (Date.now() - started > WAIT_MS) {
      console.error(`10분을 기다려도 잠금이 안 풀렸다 — ${LOCK} 를 보세요.`);
      process.exit(1);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

const release = () => {
  if (holder()?.pid === process.pid) rmSync(LOCK, { recursive: true, force: true });
};

await acquire();
const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
