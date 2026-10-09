/**
 * 묶음 배포가 main 의 전체 CI 를 **기다려야 하는가** — 사람이 눈으로 가르지 않게 계획기의 판정을 그대로 쓴다(ADR 0159).
 *
 * `docs/ops/runbook/deploy.md` 「묶음 배포」의 0 이 부른다. **두 SHA 를 따로 다룬다.**
 *
 * - **근거** — 마지막으로 전부를 잰 main 의 초록(`main-red.mjs` 의 `lastFullGreen` — `policy` 만 돈 초록은 안 센다). 언제나
 *   GitHub 에서 읽는다. 그 초록부터 올릴 SHA 까지의 **커밋마다** 그 부모(머지 커밋이면 첫 부모)와 견주어 `ci-plan.mjs` 의
 *   `deployRangeOf` 가 정책 · 주석만 · 문구만 · 동작으로 가르고, 커밋마다 그 PR 의 `gate` 최신 실행이 초록인지(`latestGatePassed`),
 *   범위에 붉게 끝난 main 실행 · 열린 `ci-main-red` 이슈가 없는지(`mainRedOf`) 읽어 넘긴다.
 * - **견주기** — `--from <SHA>`(보통 지금 운영의 SHA)는 「앱이 운영과 달라졌나」만 답한다. 근거를 대신하지 못한다 — 손으로 준
 *   SHA 가 근거가 되자 `--from X --head X` 가 아무 검증 없이 `green` 이었다(2026-10-09 외부 검토). `--from` 을 준 답은 `docs-only`
 *   (앱을 안 올린다) 아니면 `wait` 다.
 *
 * ```bash
 * git fetch origin main
 * node scripts/deploy-range.mjs                 # origin/main 을 올린다면
 * node scripts/deploy-range.mjs --head <SHA>    # 그 SHA 를 올린다면
 * node scripts/deploy-range.mjs --from <운영 SHA> # 운영 뒤로 문서뿐이면 앱을 안 올린다
 * ```
 *
 * 답은 `green` · `docs-only` · `copy` · `wait` 하나이고, 끝 코드는 `wait` 만 1 이다. 못 읽은 것(GitHub · git · 파서)은 전부 `wait` 다.
 * 출력의 `head` 가 판정한 SHA 다 — 올리는 SHA 는 그것이어야 한다.
 * **기다리지 않으면 배포 전 검증이 줄어든다** — main 의 전체 CI 는 배포 뒤에 끝나고, 붉으면 `ci-main-red` 로 대응한다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { baseSourceFromGit, deployRangeOf, mainRedOf } from './ci-plan.mjs';
import { lastFullGreen } from './main-red.mjs';

const run = (command, ...args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).trim();

function argOf(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

/**
 * 커밋을 들인 PR 들의 head SHA — `GET /repos/{repo}/commits/{sha}/pulls` 의 응답에서 머지된 것만. 모양을 모르면 `null`
 *
 * @param {unknown} pulls
 * @returns {string[] | null}
 */
export function mergedHeadsOf(pulls) {
  if (!Array.isArray(pulls)) return null;
  const heads = [];
  for (const pull of pulls) {
    if (pull === null || typeof pull !== 'object' || !('merged_at' in pull)) return null;
    if (pull.merged_at === null) continue;
    const sha = pull.head?.sha;
    if (typeof sha !== 'string') return null;
    heads.push(sha);
  }
  return heads;
}

/**
 * PR head 의 `gate` 가 초록인가 — `GET /repos/{repo}/commits/{head}/check-runs?check_name=gate` 의 응답에서 **가장 최근 실행 하나만**
 * 본다. 그것이 `status: completed` 이고 `conclusion: success` 일 때만 참이다. 예전 판정은 끝나지 않은 실행(`conclusion` 이 비어
 * 걸러졌다) · 취소 · 건너뜀을 무시해 예전 `success` 하나로 참이었다(2026-10-09 외부 검토).
 *
 * 「가장 최근」은 `started_at` 이 늦은 것, 같으면 `id` 가 큰 것이다 — 다시 돌리면 새 check run 이 새 `id` 와 새 `started_at` 으로
 * 선다(GitHub 는 목록의 차례를 약속하지 않는다). 실행 없음 · 응답 모양 모름(`check_runs` 가 배열이 아님 · 다른 이름 · 시각을 못 읽음 ·
 * `total_count` 가 받은 것보다 큼)은 거짓이다
 *
 * @param {unknown} response
 */
export function latestGatePassed(response) {
  if (response === null || typeof response !== 'object' || !Array.isArray(response.check_runs)) return false;
  const runs = response.check_runs;
  if (runs.length === 0 || (typeof response.total_count === 'number' && response.total_count > runs.length)) return false;
  let latest = null;
  for (const one of runs) {
    if (one === null || typeof one !== 'object' || one.name !== 'gate' || typeof one.id !== 'number' || typeof one.status !== 'string') return false;
    const at = typeof one.started_at === 'string' ? Date.parse(one.started_at) : Number.NaN;
    if (!Number.isFinite(at)) return false;
    if (latest === null || at > latest.at || (at === latest.at && one.id > latest.run.id)) latest = { at, run: one };
  }
  return latest.run.status === 'completed' && latest.run.conclusion === 'success';
}

/** 커밋 하나를 들인 PR 의 `gate` 가 초록이었는가 — 머지된 PR 이 없거나(직접 푸시) 못 읽으면 거짓이다 */
function gatePassed(repo, sha) {
  try {
    const heads = mergedHeadsOf(JSON.parse(run('gh', 'api', `repos/${repo}/commits/${sha}/pulls`)));
    if (heads === null || heads.length === 0) return false;
    return heads.some((head) => latestGatePassed(JSON.parse(run('gh', 'api', `repos/${repo}/commits/${head}/check-runs?check_name=gate&per_page=100`))));
  } catch {
    return false;
  }
}

/** `start..head` 의 커밋 — 커밋마다 그 첫 부모와 견준 바뀐 파일과 두 쪽 소스. 못 읽으면 `null` */
function commitsBetween(start, head) {
  try {
    run('git', 'merge-base', '--is-ancestor', start, head);
    return run('git', 'rev-list', `${start}..${head}`)
      .split('\n')
      .filter(Boolean)
      .map((sha) => {
        const parent = run('git', 'rev-list', '--parents', '-n', '1', sha).split(' ')[1] ?? null;
        let files = null;
        if (parent !== null) {
          try {
            files = run('git', 'diff', '--name-only', '--no-renames', parent, sha).split('\n');
          } catch {
            files = null;
          }
        }
        return {
          sha,
          files,
          // 다듬지 않는다 — base 쪽(`baseSourceFromGit`)과 글자째 같은 모양으로 견준다
          sourceOf: (file) => {
            try {
              return execFileSync('git', ['show', `${sha}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
            } catch {
              return null;
            }
          },
          baseSourceOf: (file) => (parent === null ? null : baseSourceFromGit(parent, file, sha)),
        };
      });
  } catch {
    return null;
  }
}

async function main() {
  const head = run('git', 'rev-parse', argOf('--head') ?? 'origin/main');
  let repo = null;
  try {
    repo = run('gh', 'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner');
  } catch {
    // 못 읽으면 마지막 초록도 PR 검사도 모른다 — wait 로 간다
  }

  // 근거는 언제나 GitHub 의 마지막 전체 초록이다 — `--from` 은 여기 들지 않는다
  let lastGreen = null;
  if (repo !== null) {
    try {
      lastGreen = lastFullGreen(repo, 'verify.yml');
      if (lastGreen !== null) lastGreen = run('git', 'rev-parse', lastGreen);
    } catch {
      lastGreen = null;
    }
  }
  const commits = lastGreen === null || lastGreen === head ? [] : commitsBetween(lastGreen, head);
  if (lastGreen !== null && commits === null) lastGreen = null; // 그 초록이 올릴 SHA 의 조상이 아니면 범위가 서지 않는다

  let unpassed = null;
  let mainRed = 'main 의 실행 · `ci-main-red` 이슈를 못 읽었다';
  if (repo !== null && commits !== null) {
    unpassed = commits.filter((one) => !gatePassed(repo, one.sha)).map((one) => one.sha);
    try {
      const runs = JSON.parse(run('gh', 'run', 'list', '--repo', repo, '--workflow', 'verify.yml', '--branch', 'main', '--limit', '100', '--json', 'headSha,conclusion'));
      const openIssues = JSON.parse(run('gh', 'issue', 'list', '--repo', repo, '--label', 'ci-main-red', '--state', 'open', '--json', 'number'));
      mainRed = mainRedOf({ runs, openIssues, shas: [head, ...commits.map((one) => one.sha)] });
    } catch {
      // 못 읽으면 붉은 것으로 센다
    }
  }

  const fromArg = argOf('--from');
  let from = null;
  let fromCommits = null;
  if (fromArg !== undefined) {
    try {
      from = run('git', 'rev-parse', fromArg);
      fromCommits = commitsBetween(from, head);
    } catch {
      from = fromArg;
      fromCommits = null;
    }
  }

  let ts = null;
  try {
    ts = (await import('typescript')).default;
  } catch {
    // 파서가 없으면 주석 · 문구를 못 가른다 — wait 로 간다
  }
  const verdict = deployRangeOf({ lastGreen, head, commits, from, fromCommits, ts, unpassed, mainRed });
  console.log(JSON.stringify({ head, lastGreen, from, ...verdict }, null, 2));
  console.log(`\n${verdict.verdict} — ${verdict.reason}`);
  process.exitCode = verdict.verdict === 'wait' ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
