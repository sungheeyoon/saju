import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REMINDER, commitDirsOf, mainRootOf, responseOf, touchesMainCheckout } from './checkout-hint.mjs';

const ROOT = '/home/me/saju';
const TREE = `${ROOT}/.claude/worktrees/agent-1`;
const edit = (file_path: string, cwd = ROOT) => touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path }, cwd }, ROOT);
const bash = (command: string, cwd = ROOT) => touchesMainCheckout({ tool_name: 'Bash', tool_input: { command }, cwd }, ROOT);

describe('checkout-hint — 메인 체크아웃에 쓸 때 한 줄을 일러 준다 (docs/agents/delegation/permissions.md)', () => {
  it('메인 체크아웃 안의 파일을 고치면 걸린다 — Edit · Write · NotebookEdit, 상대 경로도', () => {
    expect(edit(`${ROOT}/docs/start.md`)).toBe(true);
    expect(edit(`${ROOT}/AGENTS.md`)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'Write', tool_input: { file_path: 'app/page.tsx' }, cwd: ROOT }, ROOT)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'NotebookEdit', tool_input: { notebook_path: `${ROOT}/x.ipynb` }, cwd: ROOT }, ROOT)).toBe(true);
  });

  it('워크트리 안과 저장소 밖은 지난다', () => {
    expect(edit(`${TREE}/docs/start.md`, TREE)).toBe(false);
    expect(edit('docs/start.md', TREE)).toBe(false);
    expect(edit('/home/me/.claude/projects/x/memory/MEMORY.md')).toBe(false);
    expect(edit('/tmp/claude-1000/scratchpad/body.md')).toBe(false);
    // 이름이 뿌리로 시작할 뿐인 옆 폴더는 저장소 밖이다
    expect(edit('/home/me/saju-old/README.md')).toBe(false);
  });

  it('워크트리에서 돌아도 메인 체크아웃의 뿌리를 안다 — CLAUDE_PROJECT_DIR 가 워크트리여도', () => {
    expect(mainRootOf(TREE)).toBe(ROOT);
    expect(mainRootOf(`${TREE}/`)).toBe(ROOT);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: `${ROOT}/docs/x.md` }, cwd: TREE }, TREE)).toBe(true);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: { file_path: `${TREE}/docs/x.md` }, cwd: TREE }, TREE)).toBe(false);
  });

  it('git commit 은 메인 체크아웃에서 돌 때만 걸린다 — cd 와 -C 를 따라간다', () => {
    expect(bash('git commit -m x')).toBe(true);
    expect(bash('git add -A && git commit -m x')).toBe(true);
    expect(bash(`cd ${ROOT} && git commit -m x`, TREE)).toBe(true);
    expect(bash(`git -C ${ROOT} commit -m x`, TREE)).toBe(true);
    expect(bash('GIT_EDITOR=true git -c user.name=x commit --amend')).toBe(true);

    expect(bash('git commit -m x', TREE)).toBe(false);
    expect(bash(`cd ${TREE} && git commit -m x`)).toBe(false);
    expect(bash(`git -C ${TREE} commit -m x`)).toBe(false);
    expect(bash('git status && git log --oneline -3')).toBe(false);
    expect(bash('npm test')).toBe(false);
  });

  it('commitDirsOf 는 commit 이 도는 자리만 든다', () => {
    expect(commitDirsOf('git status; cd docs && git commit -m x', ROOT)).toEqual([`${ROOT}/docs`]);
    expect(commitDirsOf('git log | head', ROOT)).toEqual([]);
  });

  it('다른 도구 · 빈 입력은 지난다', () => {
    expect(touchesMainCheckout({ tool_name: 'Read', tool_input: { file_path: `${ROOT}/docs/start.md` }, cwd: ROOT }, ROOT)).toBe(false);
    expect(touchesMainCheckout({ tool_name: 'Edit', tool_input: {}, cwd: ROOT }, ROOT)).toBe(false);
  });

  it('답은 권한 결정 없이 일러 줄 한 줄이고, 안 걸리면 아무것도 안 찍는다', () => {
    expect(responseOf(false)).toBe('');
    const out = JSON.parse(responseOf(true));
    expect(out).toEqual({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: REMINDER } });
    expect(out.hookSpecificOutput).not.toHaveProperty('permissionDecision');
    expect(REMINDER).not.toContain('\n');
    expect(REMINDER).toContain('docs/agents/delegation/coordinator.md');
  });

  it('settings.json 의 PreToolUse 훅이 이 스크립트를 쓰기 도구와 Bash 에 건다', () => {
    const settings = JSON.parse(readFileSync(join(__dirname, '../.claude/settings.json'), 'utf8'));
    const entries = settings.hooks?.PreToolUse ?? [];
    const ours = entries.filter((entry: { hooks: { command: string }[] }) =>
      entry.hooks.some((hook) => hook.command.includes('scripts/checkout-hint.mjs')),
    );
    expect(ours).toHaveLength(1);
    expect(ours[0].matcher.split('|').sort()).toEqual(['Bash', 'Edit', 'NotebookEdit', 'Write']);
  });

  it('스크립트로 돌리면 stdin 의 훅 입력을 읽어 답을 찍는다', () => {
    const run = (input: object) =>
      execFileSync('node', [join(__dirname, 'checkout-hint.mjs')], {
        input: JSON.stringify(input),
        env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
      }).toString();
    expect(JSON.parse(run({ tool_name: 'Write', tool_input: { file_path: `${ROOT}/a.md` }, cwd: ROOT })).hookSpecificOutput.additionalContext).toBe(REMINDER);
    expect(run({ tool_name: 'Write', tool_input: { file_path: `${TREE}/a.md` }, cwd: TREE })).toBe('');
  });
});
