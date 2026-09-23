/**
 * 이 워크트리에 로컬 스택 자리를 준다 — `npm run stack:slot -- N` (N 은 1~9, 0 은 기본값으로 되돌린다).
 *
 * 워크트리는 소스만 가른다. 컨테이너 이름과 포트가 같으면 한 워크트리의 `db:reset` 이 다른 워크트리의
 * 시험 데이터를 지우고, e2e 는 남의 dev 서버를 재사용해 남의 코드를 잰다(2026-09-23, #144). 그래서 자리
 * 번호 하나로 이름 · Supabase 포트 묶음 전체 · dev 서버 포트 · 흐름 검사 포트를 함께 옮긴다(ADR 0096).
 *
 * `supabase/.env.local` 의 `SAJU_` 줄만 고쳐 쓴다 — 그 밖의 줄은 사람의 것이라 남긴다. 원격에 붙는
 * 명령(`db push` · `db query --linked`)이 이 워크트리에서도 돌도록, main 체크아웃의 `supabase/.temp`
 * (연결된 프로젝트)가 없으면 옮겨 온다.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 기본값에서 자리마다 비키는 폭 — Supabase 는 543xx 열 칸을 쓰므로 100 씩, 웹은 10 씩 */
export function valuesOf(n) {
  const supabase = (base) => String(base + n * 100);
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
    SAJU_WEB_PORT: String(3000 + n * 10),
    // 흐름 검사는 여기서 +0~+7 을 쓴다 — 웹 포트(3010~3090)와 안 겹친다
    SAJU_CHECK_PORT: String(3210 + n * 10),
  };
}

function main() {
  const slot = Number(process.argv[2]);
  if (!Number.isInteger(slot) || slot < 0 || slot > 9) {
    console.error('자리 번호는 0~9 입니다 — `npm run stack:slot -- 1`. 0 은 기본값(main 체크아웃)으로 되돌립니다.');
    process.exit(1);
  }

  const file = join(process.cwd(), 'supabase/.env.local');
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

  const temp = join(process.cwd(), 'supabase/.temp');
  if (!existsSync(join(temp, 'project-ref'))) {
    const main = execFileSync('git', ['worktree', 'list', '--porcelain'], { encoding: 'utf8' })
      .split('\n')
      .find((line) => line.startsWith('worktree '))
      ?.slice('worktree '.length);
    const source = main && join(main, 'supabase/.temp');
    if (source && source !== temp && existsSync(join(source, 'project-ref'))) {
      cpSync(source, temp, { recursive: true });
      console.log(`연결된 프로젝트를 옮겨 왔다 — ${source}`);
    }
  }

  console.log('스택이 이미 떠 있었다면 `npm run db:stop` 뒤 `npm run db:start` 로 다시 띄운다.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
