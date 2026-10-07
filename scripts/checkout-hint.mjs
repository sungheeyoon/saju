/**
 * 메인 체크아웃에 쓰려 할 때 한 줄을 일러 준다 — Claude Code 의 PreToolUse 훅(ADR 0150).
 *
 * **묻지도 막지도 않는다** — 권한 결정(`permissionDecision`) 없이 `additionalContext` 한 줄만 모델에게 건넨다. 상태를 두지
 * 않아 걸릴 때마다 같은 한 줄이다.
 *
 * - Edit · Write · NotebookEdit: 고칠 파일이 이 저장소의 메인 체크아웃 안이면. 새 파일은 가장 가까운 있는 조상 폴더로 가른다
 * - Bash: `git commit` 이 메인 체크아웃에서 돌면 — 앞의 `cd <곳>` 과 `git -C <곳>` 을 따라간다
 * - 연결된 워크트리(어디에 섰든) · 저장소 밖 · 다른 저장소 · git 이 실패한 자리는 아무것도 안 찍는다
 *
 * 메인 체크아웃인지는 경로가 아니라 git 이 답한다 — 메인 체크아웃은 `--git-dir` 이 `--git-common-dir` 과 같고, 연결된
 * 워크트리는 제 git-dir(`.git/worktrees/<이름>`)을 가진다. 같은 저장소인지는 세션의 자리(`CLAUDE_PROJECT_DIR`, 없으면 `cwd`)의
 * common-dir 과 견주는데, 그 둘째 부름은 대상이 메인 체크아웃일 때만 돈다 — 워크트리의 쓰기는 git 을 한 번 부른다.
 * Claude Code 만 이 훅을 돈다 — 설정은 `.claude/settings.json` 의 `hooks`, 규약은 `docs/agents/delegation/permissions.md`
 * 「훅 — 메인 체크아웃에서 일러 준다」.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REMINDER =
  '메인 체크아웃에 쓰려 한다 — 먼저 그 일의 역할 문서(docs/start.md 「역할 고르기」)를 읽고 워크트리에서 한다(docs/agents/delegation/coordinator.md 「조율자 세션」).';

const isDirectory = (path) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** 가장 가까운 있는 조상 디렉터리 — 새 파일의 폴더는 아직 없을 수 있다 */
export function existingDirOf(path) {
  let dir = path;
  while (!isDirectory(dir) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

/** 부모 프로세스의 `GIT_DIR` 따위가 `-C` 를 덮지 않게 걷는다 */
const gitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

/** 디렉터리가 든 저장소의 git-dir 과 common-dir — 저장소 밖이거나 git 이 실패하면 null */
export function gitDirsOf(dir) {
  try {
    const [gitDir, commonDir] = execFileSync(
      'git',
      ['-C', dir, 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'],
      { encoding: 'utf8', env: gitEnv(), stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 },
    )
      .trim()
      .split('\n');
    return gitDir && commonDir ? { gitDir, commonDir } : null;
  } catch {
    return null;
  }
}

/** 경로가 세션과 같은 저장소의 메인 체크아웃 안인가 — 연결된 워크트리는 git-dir 이 common-dir 과 다르다 */
export function inMainCheckout(path, projectDir) {
  const target = gitDirsOf(existingDirOf(path));
  if (!target || target.gitDir !== target.commonDir) return false;
  return gitDirsOf(existingDirOf(projectDir))?.commonDir === target.commonDir;
}

const expand = (path, base) => {
  const unquoted = path.replace(/^(['"])(.*)\1$/, '$2');
  const home = unquoted === '~' || unquoted.startsWith('~/') ? homedir() + unquoted.slice(1) : unquoted;
  return isAbsolute(home) ? resolve(home) : resolve(base, home);
};

/** 명령이 `git commit` 을 도는 디렉터리들 — 앞의 `cd` 와 `git -C` 를 따라간다 */
export function commitDirsOf(command, cwd) {
  const dirs = [];
  let here = cwd;
  for (const raw of command.split(/&&|\|\||[;|\n]/)) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (words[0] === 'cd' && words[1]) {
      here = expand(words[1], here);
      continue;
    }
    while (words.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words.shift();
    if (words[0] !== 'git') continue;
    let dir = here;
    let index = 1;
    while (index < words.length && words[index].startsWith('-')) {
      if (words[index] === '-C' && words[index + 1]) {
        dir = expand(words[index + 1], dir);
        index += 2;
      } else if (words[index] === '-c' && words[index + 1]) {
        index += 2;
      } else {
        index += 1;
      }
    }
    if (words[index] === 'commit') dirs.push(dir);
  }
  return dirs;
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input 훅이 stdin 으로 받는 것
 * @param {string | undefined} projectDir `CLAUDE_PROJECT_DIR`
 * @returns {boolean} 메인 체크아웃에 쓰는 호출인가
 */
export function touchesMainCheckout(input, projectDir) {
  const cwd = input.cwd ?? process.cwd();
  const project = projectDir || cwd;
  const toolInput = input.tool_input ?? {};
  if (['Edit', 'Write', 'NotebookEdit'].includes(input.tool_name ?? '')) {
    const target = toolInput.file_path ?? toolInput.notebook_path;
    return typeof target === 'string' && target !== '' && inMainCheckout(expand(target, cwd), project);
  }
  if (input.tool_name === 'Bash' && typeof toolInput.command === 'string') {
    return commitDirsOf(toolInput.command, cwd).some((dir) => inMainCheckout(dir, project));
  }
  return false;
}

/** PreToolUse 의 답 — 권한 결정 없이 일러 줄 한 줄만. 안 걸리면 아무것도 안 찍는다 */
export function responseOf(touches) {
  return touches ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: REMINDER } }) : '';
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return; // 못 읽으면 조용히 지난다 — 이 훅은 담이 아니라 알림이다
  }
  const out = responseOf(touchesMainCheckout(input, process.env.CLAUDE_PROJECT_DIR));
  if (out) process.stdout.write(`${out}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
