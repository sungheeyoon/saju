/**
 * 원격 DB 에 닿는 명령을 **기계 전체에서 한 번에 하나만** 돌린다 — `npm run db:push` · `npm run db:remote -- --purpose "<목적>" "<sql>"`(목적과 해시를 접속기록에 먼저 적는다, `db-remote.mjs`).
 *
 * 로컬 스택은 워크트리마다 가를 수 있지만(ADR 0096) 운영 DB 는 하나다. 두 세션이 나란히 `db push` 를 하면
 * 서로 다른 가지의 마이그레이션이 섞여 오르고, `db query --linked` 는 나란히 부르면 로그인 역할을 세우다
 * 부딪혀 떨어진다(delegation.md 「로컬 환경의 함정」). 그래서 잠금은 워크트리 밖, 사용자의 집 폴더에 둔다.
 *
 * 잠금은 디렉터리 하나다 — `mkdir` 은 원자적이라 둘이 동시에 잡을 수 없다.
 *
 * **남은 잠금을 스스로 걷지 않는다(#154).** 처음에는 잡은 pid 가 죽어 있으면 걷었는데, 기다리던 둘이 같은
 * 죽은 잠금을 함께 보면 하나가 걷고 새로 잡은 뒤 다른 하나가 옛 판단으로 **그 새 잠금을** 지워 둘 다 운영
 * DB 에 들어간다. 래퍼만 죽고 자식 `supabase` 가 살아 있어도 걷혔다. 운영 DB 앞이라 드문 경우에 사람을
 * 부르는 쪽을 골랐다 — 자식까지 죽었으면 누가 쥐었었는지와 걷는 법을 말하고 멈춘다.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LOCK = process.env.SAJU_REMOTE_LOCK ?? join(homedir(), '.cache', 'saju', 'remote.lock');
const WAIT_MS = 10 * 60 * 1000;
/** 잡은 쪽이 owner 를 적기 전의 틈 — 이만큼 지나도 비어 있으면 적다 만 잠금이다 */
const UNWRITTEN_MS = 10 * 1000;

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
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function stop(reason, owner) {
  console.error(
    [
      `원격 잠금이 남아 있다 — ${reason}`,
      owner ? `  쥐었던 쪽: ${owner.command} (${owner.cwd}, ${owner.at}, pid ${owner.pid} · 자식 ${owner.child ?? '?'})` : '',
      `  \`pgrep -fl supabase\` 로 원격에 붙은 것이 없는지 본 뒤 손으로 걷는다: rm -rf ${LOCK}`,
      '  그 명령이 무엇을 했는지(`migration list` 의 remote 칸)를 먼저 본다 — 반쯤 오른 마이그레이션일 수 있다.',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  process.exit(1);
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
      if (Date.now() - unwrittenSince > UNWRITTEN_MS) stop('잡은 쪽이 누구인지 안 적혀 있다', null);
    } else {
      unwrittenSince = null;
      if (!alive(owner.pid) && !alive(owner.child)) stop('쥐었던 쪽도 그 자식도 이미 없다', owner);
      if (!told) {
        console.error(`다른 세션이 원격 DB 를 쓰는 중이다 — 기다린다: ${owner.command} (${owner.cwd}, ${owner.at})`);
        told = true;
      }
    }
    if (Date.now() - started > WAIT_MS) stop('10분을 기다려도 안 풀렸다', owner);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const release = () => {
  if (holder()?.pid === process.pid) rmSync(LOCK, { recursive: true, force: true });
};

await acquire();
const child = spawn(command[0], command.slice(1), { stdio: 'inherit' });
// 래퍼가 죽어도 자식이 살아 있는 동안은 잠금이 산 것으로 보이게 자식 pid 를 적는다
writeOwner({ child: child.pid });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => {
  release();
  process.exit(code ?? (signal ? 1 : 0));
});
