/**
 * main 의 전체 검증이 붉으면 **이슈 하나**(`ci-main-red`)가 든다 (#161, ADR 0097).
 *
 * 공개 출시 전에는 전체 검증이 머지 뒤 main 에서 비차단으로 돈다. 아무도 안 보는 비차단 검사는 없는 것과
 * 같아서, 붉은 main 을 다음 세션이 첫 화면에서 보게 한다 — 위임 규약은 열린 `ci-main-red` 를 새 작업보다
 * 먼저 고치라고 한다(`docs/agents/delegation.md`).
 *
 * - 실패: 열린 이슈가 있으면 댓글, 없으면 연다. 실행 · SHA · 마지막 초록부터의 범위를 적는다
 * - 성공: 그 SHA 가 **지금 main 머리일 때만** 닫는다 — 늦게 끝난 옛 실행이 닫지 않게
 * - 취소 · 건너뜀: 아무것도 안 한다. 새 main 이 옛 실행을 끊는 것은 정책이다
 *
 * 부르는 곳은 `.github/workflows/main-red.yml` 하나다. `issues: write` 는 그 워크플로에만 있다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const LABEL = 'ci-main-red';
const FAILED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);

/**
 * @param {{ branch: string, conclusion: string, sha: string, mainHead: string, openIssue: number | null }} run
 * @returns {{ action: 'none' | 'open' | 'comment' | 'close', reason: string }}
 */
export function decide({ branch, conclusion, sha, mainHead, openIssue }) {
  if (branch !== 'main') return { action: 'none', reason: `${branch} 은 main 이 아니다` };
  if (FAILED.has(conclusion)) {
    return openIssue === null
      ? { action: 'open', reason: 'main 이 붉다' }
      : { action: 'comment', reason: `#${openIssue} 이 이미 열려 있다` };
  }
  if (conclusion === 'success') {
    if (openIssue === null) return { action: 'none', reason: '열린 이슈가 없다' };
    if (sha !== mainHead) return { action: 'none', reason: `${sha.slice(0, 7)} 은 지금 main 머리(${mainHead.slice(0, 7)})가 아니다` };
    return { action: 'close', reason: '지금 main 머리가 초록이다' };
  }
  return { action: 'none', reason: `${conclusion} 은 실패가 아니다` };
}

/** `gate` 는 다른 차선이 붉어서 붉다 — 원인이 아니므로 적지 않는다 */
const failedLanesOf = (jobs) => jobs.filter((one) => one !== 'gate');

/**
 * 댓글과 이슈 본문 — 사람이 읽고 바로 범위를 좁히게.
 *
 * `audit` 만 붉으면 커밋이 아니라 밖의 advisory DB 가 바뀌었을 수 있다(G-23 ①, ADR 0104) — 범위의 커밋을
 * 뒤지기 전에 그것부터 보게 한다.
 *
 * @param {{ runUrl: string, sha: string, lastGreen: string | null, failedJobs?: string[] }} run
 */
export function reportOf({ runUrl, sha, lastGreen, failedJobs = [] }) {
  const lanes = failedLanesOf(failedJobs);
  const onlyAudit = lanes.length === 1 && lanes[0] === 'audit';
  return [
    `main 의 전체 검증이 붉다 — ${runUrl}`,
    '',
    `- 커밋: \`${sha}\``,
    ...(lanes.length > 0 ? [`- 붉은 차선: ${lanes.map((one) => `\`${one}\``).join(' · ')}`] : []),
    lastGreen
      ? `- 범위: 마지막 초록 \`${lastGreen.slice(0, 7)}\` 뒤부터 — \`git log --oneline ${lastGreen.slice(0, 7)}..${sha.slice(0, 7)}\``
      : '- 범위: 마지막 초록을 못 찾았다',
    ...(onlyAudit
      ? ['', '**`audit` 만 붉다** — 범위의 커밋이 아니라 새로 뜬 advisory 일 수 있다. `docs/ops/runbook.md` 「운영 의존성 취약점」대로 한다.']
      : []),
    '',
    '**새 작업보다 먼저 고친다**(`docs/agents/delegation.md`). 최신 main 이 초록이 되면 이 이슈는 저절로 닫힌다.',
  ].join('\n');
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const runId = process.env.RUN_ID;
  const run = JSON.parse(gh('api', `repos/${repo}/actions/runs/${runId}`));
  const mainHead = gh('api', `repos/${repo}/commits/main`, '--jq', '.sha');
  const openIssue = Number(gh('issue', 'list', '--repo', repo, '--label', LABEL, '--state', 'open', '--limit', '1', '--json', 'number', '--jq', '.[0].number // empty')) || null;

  const decided = decide({ branch: run.head_branch, conclusion: run.conclusion, sha: run.head_sha, mainHead, openIssue });
  console.log(`${run.html_url} · ${run.conclusion} · ${decided.action} — ${decided.reason}`);

  if (decided.action === 'open' || decided.action === 'comment') {
    const lastGreen = gh('run', 'list', '--repo', repo, '--workflow', run.workflow_id.toString(), '--branch', 'main', '--status', 'success', '--limit', '1', '--json', 'headSha', '--jq', '.[0].headSha // empty') || null;
    const failedJobs = gh('api', '--paginate', `repos/${repo}/actions/runs/${runId}/jobs`, '--jq', '.jobs[] | select(.conclusion == "failure" or .conclusion == "timed_out") | .name')
      .split('\n')
      .filter(Boolean);
    const body = reportOf({ runUrl: run.html_url, sha: run.head_sha, lastGreen, failedJobs });
    if (decided.action === 'open') {
      gh('issue', 'create', '--repo', repo, '--label', LABEL, '--title', `main 이 붉다 — ${run.head_sha.slice(0, 7)}`, '--body', body);
    } else {
      gh('issue', 'comment', String(openIssue), '--repo', repo, '--body', body);
    }
  }
  if (decided.action === 'close') {
    gh('issue', 'close', String(openIssue), '--repo', repo, '--comment', `지금 main 머리 \`${run.head_sha.slice(0, 7)}\` 가 초록이다 — ${run.html_url}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
