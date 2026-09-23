/**
 * 이 워크트리에 로컬 스택 자리를 준다 — `npm run stack:slot -- --auto` 가 빈 번호를 고르고,
 * `npm run stack:slot -- N`(1~9)은 그 번호를 달라고 한다. `0` 은 기본값으로 되돌린다.
 *
 * 워크트리는 소스만 가른다. 컨테이너 이름과 포트가 같으면 한 워크트리의 `db:reset` 이 다른 워크트리의
 * 시험 데이터를 지우고, e2e 는 남의 dev 서버를 재사용해 남의 코드를 잰다(2026-09-23, #144). 그래서 자리
 * 번호 하나로 이름 · Supabase 포트 묶음 전체 · dev 서버와 인증 주소 · 흐름 검사 포트를 함께 옮긴다(ADR 0096).
 *
 * **다른 워크트리가 쥔 번호는 거절한다(#154).** 번호가 겹치지 않는 것은 값의 일이지만, 두 세션이 같은 번호를
 * 고르는 것은 서로를 모르는 일이다. 쥔 것은 둘에서 센다 — 다른 워크트리의 `supabase/.env.local`, 그리고
 * 어느 워크트리도 안 쥐었는데 떠 있는 `supabase_db_saju_wtN`(지워진 워크트리가 남긴 스택도 포트를 잡고 있다).
 *
 * **보는 것부터 적는 것까지는 기계 전체에서 한 번에 하나다(#158).** 둘이 동시에 `--auto` 를 부르면 같은 빈 목록을
 * 보고 같은 번호를 적었다. 할당하는 동안만 잠금 하나(`mkdir`)를 쥔다 — 자리마다 잡아 두면 워크트리를 지울 때
 * 잡힌 자리가 남고, 남은 것을 걷는 순간 원격 잠금이 겪은 경쟁(ADR 0096 추기)이 돌아온다. 잠금이 남아 있고 쥔
 * 쪽이 없으면 걷지 않고 멈춘다.
 *
 * **자리 0 은 main 체크아웃만 받는다.** 보조 워크트리가 0 을 받으면 main 의 `saju` · 54321 과 다시 부딪힌다.
 *
 * `supabase/.env.local` 의 `SAJU_` 줄만 고쳐 쓴다 — 그 밖의 줄은 사람의 것이라 남긴다. 원격에 붙는
 * 명령이 이 워크트리에서도 돌도록, main 체크아웃의 `supabase/.temp`(연결된 프로젝트)가 없으면 옮겨 온다.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** 기본값에서 자리마다 비키는 폭 — Supabase 는 543xx 열 칸을 쓰므로 100 씩, 웹은 10 씩 */
export function valuesOf(n) {
  const supabase = (base) => String(base + n * 100);
  const web = 3000 + n * 10;
  return {
    SAJU_STACK_ID: `saju_wt${n}`,
    SAJU_API_PORT: supabase(54321),
    SAJU_DB_PORT: supabase(54322),
    SAJU_SHADOW_PORT: supabase(54320),
    SAJU_POOLER_PORT: supabase(54329),
    SAJU_STUDIO_PORT: supabase(54323),
    SAJU_SMTP_PORT: supabase(54324),
    SAJU_ANALYTICS_PORT: supabase(54327),
    SAJU_INSPECTOR_PORT: String(8083 + n),
    SAJU_WEB_PORT: String(web),
    SAJU_SITE_URL: `http://127.0.0.1:${web}`,
    SAJU_SITE_URL_TLS: `https://127.0.0.1:${web}`,
    // 흐름 검사는 여기서 +0~+7 을 쓴다 — 웹 포트(3010~3090)와 안 겹친다
    SAJU_CHECK_PORT: String(3210 + n * 10),
  };
}

const slotOfStackId = (id) => {
  const found = /^saju_wt(\d)$/.exec(id ?? '');
  return found ? Number(found[1]) : null;
};

/**
 * 누가 어느 자리를 쥐었나 — 순수 함수다. `worktrees` 는 다른 워크트리의 경로와 그 `.env.local` 의 스택 이름,
 * `containers` 는 떠 있는 DB 컨테이너 이름이다. 이 워크트리가 쥔 자리는 `here` 로 빼서 센다.
 *
 * @param {{ worktrees: { path: string, stackId: string | null }[], containers: string[], here: string | null }} seen
 * @returns {Map<number, string>} 자리 → 쥔 쪽의 설명
 */
export function takenSlots({ worktrees, containers, here }) {
  const taken = new Map();
  for (const { path, stackId } of worktrees) {
    const slot = slotOfStackId(stackId);
    if (slot !== null) taken.set(slot, path);
  }
  for (const name of containers) {
    const slot = slotOfStackId(name.replace(/^supabase_db_/, ''));
    if (slot !== null && !taken.has(slot) && name !== `supabase_db_${here}`) {
      taken.set(slot, `${name} — 어느 워크트리도 안 쥔 채 떠 있다(\`docker stop\` 으로 걷는다)`);
    }
  }
  return taken;
}

function stackIdIn(root) {
  try {
    return /^SAJU_STACK_ID=(.+)$/m.exec(readFileSync(join(root, 'supabase/.env.local'), 'utf8'))?.[1].trim() ?? null;
  } catch {
    return null;
  }
}

function look(cwd) {
  const paths = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => resolve(line.slice('worktree '.length)));
  let containers = [];
  try {
    containers = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' })
      .split('\n')
      .filter((name) => name.startsWith('supabase_db_'));
  } catch {
    // Docker 가 안 떠 있으면 떠 있는 스택도 없다
  }
  return {
    main: paths[0],
    seen: {
      worktrees: paths.filter((path) => path !== resolve(cwd)).map((path) => ({ path, stackId: stackIdIn(path) })),
      containers,
      here: stackIdIn(cwd),
    },
  };
}

const LOCK = process.env.SAJU_SLOT_LOCK ?? join(homedir(), '.cache', 'saju', 'slot.lock');

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** 할당하는 동안만 쥔다 — 몇십 ms 다. 남은 잠금은 걷지 않고 멈춘다 */
function withSlotLock(work) {
  mkdirSync(join(LOCK, '..'), { recursive: true });
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(LOCK);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    let owner = null;
    try {
      owner = JSON.parse(readFileSync(join(LOCK, 'owner.json'), 'utf8'));
    } catch {
      // 막 잡혀 owner 가 아직 안 적혔다
    }
    if ((owner && !alive(owner.pid)) || Date.now() - started > 10_000) {
      console.error(`자리 할당 잠금이 남아 있다${owner ? ` — pid ${owner.pid} (${owner.cwd})` : ''}. 도는 \`stack:slot\` 이 없으면 손으로 걷는다: rm -rf ${LOCK}`);
      process.exit(1);
    }
    execFileSync('sleep', ['0.05']);
  }
  try {
    writeFileSync(join(LOCK, 'owner.json'), JSON.stringify({ pid: process.pid, cwd: process.cwd() }));
    return work();
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}

/** 할당을 거절한다 — 잠금을 놓은 뒤에 말하고 끝내도록 던진다(`process.exit` 는 `finally` 를 건너뛴다) */
class Refusal extends Error {}

function main() {
  try {
    withSlotLock(allocate);
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    console.error(error.message);
    process.exitCode = 1;
  }
}

function allocate() {
  const cwd = process.cwd();
  const arg = process.argv[2];
  const { main: mainPath, seen } = look(cwd);
  const taken = takenSlots(seen);

  let slot;
  if (arg === '--auto') {
    slot = SLOTS.find((n) => !taken.has(n));
    if (slot === undefined) {
      throw new Refusal(`빈 자리가 없다 — ${[...taken].map(([n, who]) => `${n}: ${who}`).join(' · ')}`);
    }
  } else {
    slot = Number(arg);
    if (!Number.isInteger(slot) || slot < 0 || slot > 9) {
      throw new Refusal('`npm run stack:slot -- --auto` 로 빈 자리를 받거나 1~9 를 준다. 0 은 기본값(main 체크아웃)으로 되돌린다.');
    }
    if (slot === 0 && resolve(cwd) !== mainPath) {
      throw new Refusal(`자리 0 은 main 체크아웃(${mainPath})의 기본 스택이다 — 보조 워크트리는 \`--auto\` 로 제 자리를 받는다.`);
    }
    if (taken.has(slot)) {
      throw new Refusal(`자리 ${slot} 은 이미 쥐었다 — ${taken.get(slot)}. \`--auto\` 로 빈 자리를 받는다.`);
    }
  }

  const file = join(cwd, 'supabase/.env.local');
  const kept = existsSync(file)
    ? readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() !== '' && !line.startsWith('SAJU_'))
    : [];

  if (slot === 0) {
    if (kept.length > 0) writeFileSync(file, `${kept.join('\n')}\n`);
    else rmSync(file, { force: true });
    console.log('자리 0 — supabase/.env 의 기본값(saju · 54321 · 3000)으로 돈다.');
  } else {
    const lines = Object.entries(valuesOf(slot)).map(([key, value]) => `${key}=${value}`);
    writeFileSync(file, `${[...kept, ...lines].join('\n')}\n`);
    console.log(`자리 ${slot} — ${lines.join(' · ')}`);
  }

  const temp = join(cwd, 'supabase/.temp');
  const source = mainPath && join(mainPath, 'supabase/.temp');
  if (!existsSync(join(temp, 'project-ref')) && source && source !== temp && existsSync(join(source, 'project-ref'))) {
    cpSync(source, temp, { recursive: true });
    console.log(`연결된 프로젝트를 옮겨 왔다 — ${source}`);
  }

  console.log('스택이 이미 떠 있었다면 `npm run db:stop` 뒤 `npm run db:start` 로 다시 띄운다.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
