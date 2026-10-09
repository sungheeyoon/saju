/**
 * 묶음 배포가 main 의 전체 CI 를 **기다려야 하는가** — 사람이 눈으로 가르지 않게 계획기의 판정을 그대로 쓴다(ADR 0159).
 *
 * `docs/ops/runbook/deploy.md` 「묶음 배포」의 0 이 부른다. 범위는 **마지막으로 전부를 잰 main 의 초록**(`main-red.mjs` 의
 * `lastFullGreen` — `policy` 만 돈 초록은 안 센다)부터 올릴 SHA 까지다. 그 안의 바뀐 파일을 `ci-plan.mjs` 의 `deployRangeOf` 가
 * 정책 · 주석만 · 문구만 · 동작으로 가르고, 범위의 커밋마다 그 PR 의 `gate` 가 초록이었는지 GitHub 에서 읽어 넘긴다.
 *
 * ```bash
 * git fetch origin main
 * node scripts/deploy-range.mjs                 # origin/main 을 올린다면
 * node scripts/deploy-range.mjs --head <SHA>    # 그 SHA 를 올린다면
 * node scripts/deploy-range.mjs --from <SHA>    # 범위의 시작을 손으로 준다(예: 지금 운영의 SHA — 문서뿐이면 앱을 안 올린다)
 * ```
 *
 * 답은 `green` · `docs-only` · `copy` · `wait` 하나이고, 끝 코드는 `wait` 만 1 이다. 못 읽은 것(GitHub · git · 파서)은 전부 `wait` 다.
 * **이 답은 기다림을 덜 뿐 검증을 덜지 않는다** — main 의 전체 CI 는 뒤에서 계속 돌고, 붉으면 `ci-main-red` 로 대응한다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { baseSourceFromGit, deployRangeOf } from './ci-plan.mjs';
import { lastFullGreen } from './main-red.mjs';

const run = (command, ...args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).trim();

function argOf(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

/** 커밋 하나를 들인 PR 의 `gate` 가 초록이었는가 — 머지된 PR 이 없거나(직접 푸시) 못 읽으면 거짓이다 */
function gatePassed(repo, sha) {
  const heads = run('gh', 'api', `repos/${repo}/commits/${sha}/pulls`, '--jq', '.[] | select(.merged_at != null) | .head.sha').split('\n').filter(Boolean);
  if (heads.length === 0) return false;
  return heads.some((head) => {
    const conclusions = run('gh', 'api', `repos/${repo}/commits/${head}/check-runs?check_name=gate&per_page=100`, '--jq', '.check_runs[].conclusion')
      .split('\n')
      .filter(Boolean);
    return conclusions.includes('success') && !conclusions.some((one) => one !== 'success' && one !== 'cancelled' && one !== 'skipped');
  });
}

async function main() {
  const head = run('git', 'rev-parse', argOf('--head') ?? 'origin/main');
  let repo = null;
  try {
    repo = run('gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
  } catch {
    // 못 읽으면 마지막 초록도 PR 검사도 모른다 — wait 로 간다
  }

  let lastGreen = argOf('--from') ?? null;
  if (lastGreen === null && repo !== null) {
    try {
      lastGreen = lastFullGreen(repo, 'verify.yml');
    } catch {
      lastGreen = null;
    }
  }
  if (lastGreen !== null) {
    try {
      lastGreen = run('git', 'rev-parse', lastGreen);
      run('git', 'merge-base', '--is-ancestor', lastGreen, head);
    } catch {
      // 그 초록이 올릴 SHA 의 조상이 아니면 범위가 서지 않는다
      lastGreen = null;
    }
  }

  let files = null;
  let unpassed = null;
  if (lastGreen !== null && lastGreen !== head) {
    try {
      files = run('git', 'diff', '--name-only', '--no-renames', lastGreen, head).split('\n');
    } catch {
      files = null;
    }
    if (repo !== null) {
      try {
        const commits = run('git', 'rev-list', `${lastGreen}..${head}`).split('\n').filter(Boolean);
        unpassed = commits.filter((sha) => !gatePassed(repo, sha));
      } catch {
        unpassed = null;
      }
    }
  }

  let ts = null;
  try {
    ts = (await import('typescript')).default;
  } catch {
    // 파서가 없으면 주석 · 문구를 못 가른다 — wait 로 간다
  }
  const sourceAt = (file) => {
    try {
      // 다듬지 않는다 — base 쪽(`baseSourceFromGit`)과 글자째 같은 모양으로 견준다
      return execFileSync('git', ['show', `${head}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch {
      return null;
    }
  };
  const verdict = deployRangeOf({
    lastGreen,
    head,
    files,
    ts,
    sourceOf: sourceAt,
    baseSourceOf: (file) => (lastGreen === null ? null : baseSourceFromGit(lastGreen, file, head)),
    unpassed,
  });
  console.log(JSON.stringify({ head, lastGreen, ...verdict }, null, 2));
  console.log(`\n${verdict.verdict} — ${verdict.reason}`);
  process.exitCode = verdict.verdict === 'wait' ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
