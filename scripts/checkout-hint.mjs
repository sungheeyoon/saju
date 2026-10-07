/**
 * 메인 체크아웃에 쓰려 할 때 한 줄을 일러 준다 — Claude Code 의 PreToolUse 훅 (운영자 결정 2026-10-07).
 *
 * 대화가 저장소 일로 넘어가면 먼저 그 일의 역할 문서를 읽고 워크트리에서 한다(`docs/agents/delegation/coordinator.md`
 * 「조율자 세션」). 2026-10-07 에 대화로 연 세션이 역할을 안 고르고 메인 체크아웃을 직접 고쳤다. 이 훅은 **묻지도 막지도
 * 않는다** — 권한 결정(`permissionDecision`) 없이 `additionalContext` 한 줄만 모델에게 건넨다. 첫 번만 알리는 상태를 두지 않고
 * 걸릴 때마다 같은 한 줄이다.
 *
 * - Edit · Write · NotebookEdit: 고칠 파일이 메인 체크아웃 안이고 `.claude/worktrees/` 밖이면
 * - Bash: `git commit` 이 메인 체크아웃에서 돌면 — 앞의 `cd <곳>` 과 `git -C <곳>` 을 따라간다
 * - 저장소 밖(`~/.claude` 의 기억 · 스크래치 폴더 · `/tmp`)과 워크트리는 아무것도 안 찍는다
 *
 * 메인 체크아웃의 뿌리는 `CLAUDE_PROJECT_DIR`(없으면 `cwd`)에서 `/.claude/worktrees/` 앞까지다. Claude Code 는 세션이
 * 워크트리로 들어가도 `CLAUDE_PROJECT_DIR` 를 처음 자리에 두고 `cwd` 만 옮긴다(https://code.claude.com/docs/en/hooks
 * 「Worktrees are different」). Claude Code 만 이 훅을 돈다 — 설정은 `.claude/settings.json` 의 `hooks`, 규약은
 * `docs/agents/delegation/permissions.md` 「훅 — 메인 체크아웃에서 일러 준다」.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKTREES = '/.claude/worktrees';

export const REMINDER =
  '메인 체크아웃에 쓰려 한다 — 먼저 그 일의 역할 문서(docs/start.md 「역할 고르기」)를 읽고 워크트리에서 한다(docs/agents/delegation/coordinator.md 「조율자 세션」).';

/** 워크트리 안의 경로여도 메인 체크아웃의 뿌리를 돌려준다 */
export function mainRootOf(dir) {
  const at = dir.indexOf(`${WORKTREES}/`);
  return (at === -1 ? dir : dir.slice(0, at)).replace(/\/+$/, '');
}

/** 메인 체크아웃 안이고 워크트리 밖인가 */
export function inMainCheckout(path, root) {
  if (path !== root && !path.startsWith(`${root}/`)) return false;
  return path !== `${root}${WORKTREES}` && !path.startsWith(`${root}${WORKTREES}/`);
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
  const root = mainRootOf(projectDir || cwd);
  const toolInput = input.tool_input ?? {};
  if (['Edit', 'Write', 'NotebookEdit'].includes(input.tool_name ?? '')) {
    const target = toolInput.file_path ?? toolInput.notebook_path;
    return typeof target === 'string' && target !== '' && inMainCheckout(expand(target, cwd), root);
  }
  if (input.tool_name === 'Bash' && typeof toolInput.command === 'string') {
    return commitDirsOf(toolInput.command, cwd).some((dir) => inMainCheckout(dir, root));
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
