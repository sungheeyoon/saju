/**
 * **라운드 모의 합치기** — 머지할 PR 을 머지할 순서대로 받아, 저장소 밖 임시 워크트리에서 `origin/main` 위로
 * 차례로 합치고 빠른 검사를 한 번 돈다. `npm run merge:sim -- 289 290 291`.
 *
 * 2026-09-28 에 밤샘 감사의 PR 여덟(#289~#296)이 **각각 초록**이었는데 합치니 단위 시험 둘이 붉었다 — #293 의 새
 * 잠금이 #292 · #296 이 새로 들인 파일을 몰랐다(`docs/notes/2026-09-28-overnight-audit.md`). 각 PR 의 CI 는 제 가지와
 * 그때의 main 만 보므로 **서로를 모른다.** 조율자가 손으로 하던 합치기를 여기로 옮겼다.
 *
 * - **PR 은 사람이 적는다.** 열린 PR 을 모으지 않는다 — 무엇을 어느 순서로 머지할지는 조율자의 판단이다.
 * - **도는 것은 단위 시험(`scripts/code-rules.test.ts` · `scripts/layers.test.ts` 포함) · 린트 · 타입 넷이다.** 스택이 드는
 *   pgTAP · e2e · 흐름은 안 돈다 — 그것은 각 PR 의 CI 가 재고, 여기서는 「합치면 서로의 잠금에 걸리는가」만 본다.
 * - **자동 머지는 안 한다.** strict gate 와 `--auto` 가 이미 차례로 머지한다 — 이 도구는 머지 전에 한 번 보는 거울이다.
 * - 임시 워크트리는 끝나면 걷는다 — 실패해도(`finally`).
 *
 * 순수한 판단(인자 · vitest 보고 읽기 · 요약 문장)은 내보내 `scripts/merge-sim.test.ts` 가 잰다. git 과 `gh` 를
 * 부르는 쪽은 시험하지 않는다.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 사람에게 할 말이 있는 멈춤 — 쌓인 호출 대신 문장 하나와 종료 코드를 낸다 */
export class Refusal extends Error {
  /** @param {string} message @param {number} [code] */
  constructor(message, code = 3) {
    super(message);
    this.code = code;
  }
}

/** 종료 코드 — 초록 0, 검사가 붉음 1, 글자 충돌 2, 도구 · 네트워크 · 인자가 없어 못 함 3 */
export const EXIT = { green: 0, red: 1, conflict: 2, unable: 3 };

export const HELP = `라운드 모의 합치기 — 머지할 PR 을 머지할 순서대로 적는다.

  npm run merge:sim -- 289 290 291

origin/main 에서 저장소 밖 임시 워크트리를 열고, 적은 차례로 각 PR 의 가지를 합친다.
글자 충돌이면 어느 PR 의 어느 파일인지 말하고 멈춘다. 다 합쳐지면 node_modules 를 메인
폴더에서 복제하고 단위 시험(scripts/code-rules.test.ts · scripts/layers.test.ts 포함) · 린트 ·
타입을 돈다. 임시 워크트리는 끝나면 걷는다.

스택이 드는 pgTAP · e2e · 흐름 검사는 돌리지 않는다 — 그것은 각 PR 의 CI 몫이다.
열린 PR 을 알아서 모으지 않고, 머지도 하지 않는다(strict gate 와 --auto 가 맡는다).

종료 코드: 0 초록 · 1 검사가 붉음 · 2 글자 충돌 · 3 도구 · 네트워크 · 인자가 없어 못 함`;

/**
 * 인자 — PR 번호를 적은 차례 그대로. 번호가 아닌 것 · 겹친 번호 · 빈 목록은 거절한다(순서가 곧 뜻이다).
 * @param {readonly string[]} argv
 * @returns {{ help: true } | { help: false, prs: number[] }}
 */
export function parseArgs(argv) {
  if (argv.some((arg) => arg === '--help' || arg === '-h')) return { help: true };
  if (argv.length === 0) {
    throw new Refusal('머지할 PR 번호를 머지할 순서대로 적는다 — `npm run merge:sim -- 289 290 291`.');
  }
  /** @type {number[]} */
  const prs = [];
  for (const arg of argv) {
    const cleaned = arg.replace(/^#/, '');
    if (!/^[1-9][0-9]*$/.test(cleaned)) throw new Refusal(`「${arg}」은 PR 번호가 아니다 — 숫자만 적는다(\`#\` 는 붙여도 된다).`);
    const pr = Number(cleaned);
    if (prs.includes(pr)) throw new Refusal(`#${pr} 를 두 번 적었다 — 한 PR 은 한 번 합친다.`);
    prs.push(pr);
  }
  return { help: false, prs };
}

const SCOPES = /** @type {const} */ ([
  { key: 'code-rules', label: 'scripts/code-rules.test.ts', file: 'scripts/code-rules.test.ts' },
  { key: 'layers', label: 'scripts/layers.test.ts', file: 'scripts/layers.test.ts' },
]);

/**
 * vitest 의 JSON 보고(`--reporter=json`)를 셋으로 가른다 — 두 잠금 시험과 나머지 단위 시험. 붉은 것은 `파일 > 이름` 이다.
 * 파일이 아예 못 선 경우(import 실패)는 assertion 이 없으므로 파일 이름과 첫 줄로 든다.
 * @param {any} report
 * @param {string} root 저장소 뿌리 — 보고의 절대 경로를 뿌리 기준으로 줄인다
 */
export function testsOf(report, root) {
  const blank = () => ({ passed: 0, failed: /** @type {string[]} */ ([]), skipped: 0 });
  /** @type {Record<'unit' | 'code-rules' | 'layers', ReturnType<typeof blank>>} */
  const out = { unit: blank(), 'code-rules': blank(), layers: blank() };
  for (const file of report?.testResults ?? []) {
    const rel = relative(root, String(file.name)).split(sep).join('/');
    const bucket = out[SCOPES.find((scope) => scope.file === rel)?.key ?? 'unit'];
    const assertions = file.assertionResults ?? [];
    for (const one of assertions) {
      if (one.status === 'passed') bucket.passed += 1;
      else if (one.status === 'failed') bucket.failed.push(`${rel} > ${one.fullName ?? one.title}`);
      else bucket.skipped += 1;
    }
    if (file.status === 'failed' && !assertions.some((/** @type {any} */ one) => one.status === 'failed')) {
      const first = String(file.message ?? '').split('\n').find((line) => line.trim() !== '') ?? '파일이 서지 못했다';
      bucket.failed.push(`${rel} > (파일) ${first.trim()}`);
    }
  }
  return out;
}

/**
 * tsc 출력에서 오류 줄만 — `path(line,col): error TSnnnn: …`
 * @param {string} output
 */
export const typeErrorsOf = (output) => output.split('\n').filter((line) => /error TS\d+:/.test(line)).map((line) => line.trim());

/**
 * eslint 의 stylish 출력에서 문제 줄을 `파일:줄 규칙` 으로 — 파일 머리줄 아래 `  줄:칸  error  말  규칙` 이 온다.
 * @param {string} output
 * @param {string} root
 */
export function lintProblemsOf(output, root) {
  /** @type {string[]} */
  const problems = [];
  let file = '';
  for (const line of output.split('\n')) {
    if (/^\S/.test(line) && (line.startsWith('/') || /^[A-Za-z]:\\/.test(line))) {
      file = relative(root, line.trim()).split(sep).join('/');
      continue;
    }
    const found = /^\s+(\d+):\d+\s+(error|warning)\s+(.*?)\s{2,}(\S+)\s*$/.exec(line);
    if (found && file) problems.push(`${file}:${found[1]} ${found[4]} — ${found[3]}`);
  }
  return problems;
}

/**
 * 글자 충돌을 말하는 문장 — 어느 PR 이, 앞의 어느 PR 들 위에서, 어느 파일에서
 * @param {{ pr: number, before: readonly number[], files: readonly string[] }} conflict
 */
export function conflictMessage({ pr, before, files }) {
  const base = before.length === 0 ? 'origin/main' : `origin/main + ${before.map((n) => `#${n}`).join(' → ')}`;
  const list = files.length === 0 ? '(git 이 파일을 말하지 않았다)' : files.map((file) => `    - ${file}`).join('\n');
  return `#${pr} 가 ${base} 위에서 글자 충돌 — 여기서 멈춘다.\n  충돌한 파일:\n${list}\n  #${pr} 가지에서 \`git merge origin/main\` 으로 풀거나, 순서를 바꿔 다시 돈다.`;
}

/**
 * @typedef {{ label: string, ok: boolean, count?: string, problems: readonly string[] }} Check
 */

/**
 * 결과 요약 — 한 화면에 들게, 붉은 것은 이름을 든다(한 검사에 스물까지, 넘으면 수만)
 * @param {{ base: string, prs: readonly number[], checks: readonly Check[], dependenciesChanged?: boolean }} result
 */
export function summaryOf({ base, prs, checks, dependenciesChanged = false }) {
  const lines = [`모의 합치기 — origin/main(${base}) + ${prs.map((n) => `#${n}`).join(' → ')}`, '  글자 충돌: 없음'];
  for (const check of checks) {
    const count = check.count ? ` (${check.count})` : '';
    lines.push(`  ${check.label}: ${check.ok ? '통과' : `붉음 ${check.problems.length}`}${count}`);
    const shown = check.problems.slice(0, 20);
    for (const problem of shown) lines.push(`    - ${problem}`);
    if (check.problems.length > shown.length) lines.push(`    … 그 밖 ${check.problems.length - shown.length}`);
  }
  if (dependenciesChanged) {
    lines.push('  주의: 합친 package-lock.json 이 메인 폴더와 다르다 — 복제한 node_modules 가 낡았을 수 있다');
  }
  const red = checks.filter((check) => !check.ok);
  lines.push(
    red.length === 0
      ? '결론: 초록 — 이 순서로 합쳐도 단위 · 잠금 · 린트 · 타입은 붉지 않다. 스택 검사는 각 PR 의 CI 가 잰다.'
      : `결론: 붉음 — ${red.map((check) => check.label).join(' · ')}. 머지 전에 어느 PR 이 누구의 잠금에 걸렸는지 본다.`,
  );
  return lines.join('\n');
}

/** 한 검사의 결과를 요약 한 칸으로 — 테스트 셋 */
function checkOfTests(label, bucket) {
  const count = `${bucket.passed} 통과${bucket.skipped ? ` · ${bucket.skipped} 건너뜀` : ''}${bucket.failed.length ? ` · ${bucket.failed.length} 실패` : ''}`;
  return { label, ok: bucket.failed.length === 0, count, problems: bucket.failed };
}

// -----------------------------------------------------------------------------
// 여기부터 git · gh 를 부른다 — 시험하지 않는다
// -----------------------------------------------------------------------------

/** @param {string} command @param {readonly string[]} args @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options] */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: result.status ?? (result.error ? -1 : 0), stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

/** 합치기에 필요한 도구가 있는가 — 없으면 무엇이 없어서 못 하는지 말한다 */
function preflight(cwd) {
  if (run('git', ['--version']).error) throw new Refusal('git 이 없다 — 가지를 합칠 수 없다.');
  if (run('gh', ['--version']).error) throw new Refusal('gh(GitHub CLI) 가 없다 — PR 번호로 가지 이름을 얻을 수 없다. `brew install gh` 뒤 `gh auth login`.');
  const auth = run('gh', ['auth', 'status'], { cwd });
  if (auth.status !== 0) throw new Refusal(`gh 가 GitHub 에 로그인돼 있지 않거나 GitHub 에 닿지 않는다 — PR 을 읽을 수 없다.\n${auth.stderr.trim()}`);
}

/** 메인 체크아웃 — `git worktree list` 의 첫째. node_modules 를 거기서 복제한다 */
function mainCheckoutOf(cwd) {
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd });
  const first = /^worktree (.+)$/m.exec(listed.stdout);
  if (!first) throw new Refusal('메인 체크아웃을 못 찾았다 — `git worktree list` 가 비었다.');
  return first[1];
}

/** @param {number} pr @param {string} cwd */
function headOf(pr, cwd) {
  const viewed = run('gh', ['pr', 'view', String(pr), '--json', 'headRefName,state,isCrossRepository'], { cwd });
  if (viewed.status !== 0) throw new Refusal(`#${pr} 를 못 읽었다 — 없는 번호이거나 GitHub 에 닿지 않는다.\n${viewed.stderr.trim()}`);
  const { headRefName, state, isCrossRepository } = JSON.parse(viewed.stdout);
  if (isCrossRepository) throw new Refusal(`#${pr} 는 포크의 가지다 — 이 도구는 origin 의 가지만 합친다.`);
  if (state !== 'OPEN') console.log(`  (#${pr} 는 ${state} 다 — 그래도 가지를 합친다)`);
  return String(headRefName);
}

/** node_modules 를 복제한다 — Turbopack 은 심볼릭 링크를 거절하고, vitest 는 링크 너머의 `server-only` 를 못 찾는다 */
function cloneModules(from, to) {
  const source = join(from, 'node_modules');
  if (!existsSync(source)) throw new Refusal(`메인 폴더에 node_modules 가 없다 — ${from} 에서 \`npm ci\` 를 먼저 돈다.`);
  // APFS 는 `-c` 로 복제만 적는다(빠르고 자리를 안 쓴다). 안 되는 파일시스템이면 그냥 복사한다
  if (run('cp', ['-Rc', source, join(to, 'node_modules')]).status === 0) return;
  rmSync(join(to, 'node_modules'), { recursive: true, force: true });
  const copied = run('cp', ['-R', source, join(to, 'node_modules')]);
  if (copied.status !== 0) throw new Refusal(`node_modules 를 복제하지 못했다.\n${copied.stderr.trim()}`);
}

/** @param {readonly number[]} prs */
function simulate(prs) {
  const cwd = process.cwd();
  preflight(cwd);
  const main = mainCheckoutOf(cwd);

  console.log('origin/main 과 PR 가지를 받는다…');
  const heads = prs.map((pr) => ({ pr, head: headOf(pr, cwd) }));
  const fetched = run('git', ['fetch', 'origin', 'main', ...heads.map(({ head }) => `+refs/heads/${head}:refs/remotes/origin/${head}`)], { cwd });
  if (fetched.status !== 0) throw new Refusal(`origin 에서 가지를 못 받았다 — 네트워크나 가지 이름을 본다.\n${fetched.stderr.trim()}`);

  // macOS 의 임시 폴더는 `/var` → `/private/var` 링크다 — vitest 는 실제 경로로 보고하므로 실제 경로로 연다
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'merge-sim-')));
  let added = false;
  try {
    const opened = run('git', ['worktree', 'add', '--detach', dir, 'origin/main'], { cwd });
    if (opened.status !== 0) throw new Refusal(`임시 워크트리를 못 열었다.\n${opened.stderr.trim()}`);
    added = true;
    const base = run('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir }).stdout.trim();

    /** @type {number[]} */
    const merged = [];
    for (const { pr, head } of heads) {
      const result = run(
        'git',
        ['-c', 'user.name=merge-sim', '-c', 'user.email=merge-sim@localhost', 'merge', '--no-edit', `origin/${head}`],
        { cwd: dir },
      );
      if (result.status !== 0) {
        const files = run('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: dir }).stdout.split('\n').filter(Boolean);
        if (files.length === 0) throw new Refusal(`#${pr}(${head}) 를 합치지 못했다.\n${(result.stderr || result.stdout).trim()}`);
        console.log(conflictMessage({ pr, before: merged, files }));
        return EXIT.conflict;
      }
      console.log(`  #${pr}(${head}) 합침`);
      merged.push(pr);
    }

    console.log('node_modules 를 복제한다…');
    cloneModules(main, dir);
    const lock = (root) => (existsSync(join(root, 'package-lock.json')) ? readFileSync(join(root, 'package-lock.json'), 'utf8') : '');
    const dependenciesChanged = lock(dir) !== lock(main);

    console.log('단위 시험을 돈다…');
    const reportFile = join(dir, '.merge-sim-vitest.json');
    // CI=1 — vitest 의 느린 기계 한도(30초)를 쓴다. 합치기가 도는 동안 다른 세션이 기계를 나눠 쓴다
    const env = { ...process.env, CI: '1' };
    const unit = run('npx', ['vitest', 'run', '--reporter=dot', '--reporter=json', `--outputFile.json=${reportFile}`], { cwd: dir, env });
    /** @type {Check[]} */
    const checks = [];
    if (existsSync(reportFile)) {
      const buckets = testsOf(JSON.parse(readFileSync(reportFile, 'utf8')), dir);
      checks.push(checkOfTests('단위 시험', buckets.unit));
      for (const scope of SCOPES) checks.push(checkOfTests(scope.label, buckets[scope.key]));
    } else {
      checks.push({ label: '단위 시험', ok: false, problems: [`vitest 가 보고를 안 남겼다 — ${(unit.stderr || unit.stdout).trim().split('\n').slice(-3).join(' / ')}`] });
    }

    console.log('린트를 돈다…');
    const lint = run('npm', ['run', 'lint', '--silent'], { cwd: dir });
    const lintProblems = lintProblemsOf(lint.stdout, dir);
    checks.push({
      label: '린트',
      ok: lint.status === 0,
      problems: lint.status === 0 ? [] : lintProblems.length ? lintProblems : [(lint.stderr || lint.stdout).trim().split('\n').slice(-3).join(' / ')],
    });

    console.log('타입을 돈다…');
    const types = run('npm', ['run', 'typecheck', '--silent'], { cwd: dir });
    const typeErrors = typeErrorsOf(`${types.stdout}\n${types.stderr}`);
    checks.push({
      label: '타입',
      ok: types.status === 0,
      problems: types.status === 0 ? [] : typeErrors.length ? typeErrors : [(types.stderr || types.stdout).trim().split('\n').slice(-3).join(' / ')],
    });

    console.log('');
    console.log(summaryOf({ base, prs, checks, dependenciesChanged }));
    return checks.every((check) => check.ok) ? EXIT.green : EXIT.red;
  } finally {
    if (added) run('git', ['worktree', 'remove', '--force', dir], { cwd });
    rmSync(dir, { recursive: true, force: true });
    run('git', ['worktree', 'prune'], { cwd });
  }
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(HELP);
      return;
    }
    process.exitCode = simulate(args.prs);
  } catch (thrown) {
    if (thrown instanceof Refusal) {
      console.error(thrown.message);
      process.exitCode = thrown.code;
      return;
    }
    throw thrown;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
