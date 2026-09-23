/**
 * `stack:slot` 이 **동시에 불려도** 번호를 겹쳐 주지 않는가 (#158). 임시 저장소에 워크트리를 여럿 세우고
 * 실제 프로세스로 한꺼번에 부른다 — 할당 잠금 경로만 임시 자리다.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'stack-slot.mjs');

/** 임시 저장소와 보조 워크트리 `count` 개 — 경로 목록의 첫째가 main 이다 */
function repoWithWorktrees(count: number): { lock: string; main: string; worktrees: string[] } {
  const root = mkdtempSync(join(tmpdir(), 'stack-slot-'));
  const main = join(root, 'main');
  mkdirSync(join(main, 'supabase'), { recursive: true });
  writeFileSync(join(main, 'supabase/.env'), 'SAJU_STACK_ID=saju\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: main, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'base');
  const worktrees = Array.from({ length: count }, (_, index) => {
    const path = join(root, `wt${index}`);
    git('worktree', 'add', '-q', '-b', `b${index}`, path);
    mkdirSync(join(path, 'supabase'), { recursive: true });
    return path;
  });
  return { lock: join(root, 'slot.lock'), main, worktrees };
}

function slot(cwd: string, lock: string, arg: string): Promise<{ code: number | null; out: string }> {
  const child = spawn('node', [SCRIPT, arg], { cwd, env: { ...process.env, SAJU_SLOT_LOCK: lock } });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (out += chunk));
  return new Promise((done) => child.on('exit', (code) => done({ code, out })));
}

const stackIdOf = (worktree: string) =>
  /^SAJU_STACK_ID=(.+)$/m.exec(readFileSync(join(worktree, 'supabase/.env.local'), 'utf8'))?.[1];

describe('자리 할당 (ADR 0096 · #158)', () => {
  it('다섯이 동시에 --auto 를 불러도 서로 다른 번호를 받는다', async () => {
    const { lock, worktrees } = repoWithWorktrees(5);

    const results = await Promise.all(worktrees.map((worktree) => slot(worktree, lock, '--auto')));

    expect(results.map((result) => result.code)).toEqual([0, 0, 0, 0, 0]);
    const ids = worktrees.map(stackIdOf);
    expect(new Set(ids).size).toBe(5);
  }, 30_000);

  it('보조 워크트리는 자리 0 을 못 받는다 — main 의 기본 스택과 부딪힌다', async () => {
    const { lock, main, worktrees } = repoWithWorktrees(1);

    const secondary = await slot(worktrees[0], lock, '0');
    expect(secondary.code).toBe(1);
    expect(secondary.out).toContain('main 체크아웃');

    expect((await slot(main, lock, '0')).code).toBe(0);
  }, 30_000);

  it('거절해도 잠금을 놓는다 — 다음 할당이 막히지 않는다', async () => {
    const { lock, worktrees } = repoWithWorktrees(1);

    expect((await slot(worktrees[0], lock, '0')).code).toBe(1);
    expect((await slot(worktrees[0], lock, '--auto')).code).toBe(0);
  }, 30_000);

  it('쥔 쪽이 없는 할당 잠금은 걷지 않고 멈춘다', async () => {
    const { lock, worktrees } = repoWithWorktrees(1);
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 999999, cwd: '/gone' }));

    const result = await slot(worktrees[0], lock, '--auto');
    expect(result.code).toBe(1);
    expect(result.out).toContain('손으로 걷는다');
  }, 30_000);
});
