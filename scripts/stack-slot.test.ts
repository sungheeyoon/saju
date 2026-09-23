/**
 * `stack:slot` 이 **동시에 불려도** 번호를 겹쳐 주지 않는가 (#158). 임시 저장소에 워크트리를 여럿 세우고
 * 실제 프로세스로 한꺼번에 부른다 — 할당 잠금 경로만 임시 자리다.
 *
 * **이 기계의 스택을 보지 않는다.** 스크립트는 떠 있는 `supabase_db_saju_wtN` 을 쥔 자리로 세는데, 시험이
 * 진짜 `docker ps` 를 읽던 동안에는 다른 워크트리의 스택 다섯이 떠 있으면 빈 자리가 넷뿐이라 다섯째가
 * 거절됐다(2026-09-24). 임시 저장소마다 가짜 `docker` 를 `PATH` 앞에 두고, 떠 있는 컨테이너는 시험이 정한다.
 */
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'stack-slot.mjs');

type Repo = { lock: string; main: string; worktrees: string[]; bin: string };

/**
 * 임시 저장소와 보조 워크트리 `count` 개 — 경로 목록의 첫째가 main 이다. `containers` 는 가짜 `docker ps` 가
 * 떠 있다고 말하는 이름들이다.
 */
function repoWithWorktrees(count: number, containers: string[] = []): Repo {
  const root = mkdtempSync(join(tmpdir(), 'stack-slot-'));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'docker'), `#!/bin/sh\n${containers.map((name) => `echo ${name}`).join('\n')}\n`);
  chmodSync(join(bin, 'docker'), 0o755);
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
  return { lock: join(root, 'slot.lock'), main, worktrees, bin };
}

function slot({ lock, bin }: Repo, cwd: string, arg: string): Promise<{ code: number | null; out: string }> {
  const env = { ...process.env, SAJU_SLOT_LOCK: lock, PATH: `${bin}${delimiter}${process.env.PATH}` };
  const child = spawn('node', [SCRIPT, arg], { cwd, env });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (out += chunk));
  return new Promise((done) => child.on('exit', (code) => done({ code, out })));
}

const stackIdOf = (worktree: string) =>
  /^SAJU_STACK_ID=(.+)$/m.exec(readFileSync(join(worktree, 'supabase/.env.local'), 'utf8'))?.[1];

describe('자리 할당 (ADR 0096 · #158)', () => {
  it('다섯이 동시에 --auto 를 불러도 서로 다른 번호를 받는다', async () => {
    const repo = repoWithWorktrees(5);

    const results = await Promise.all(repo.worktrees.map((worktree) => slot(repo, worktree, '--auto')));

    expect(results.map((result) => result.code)).toEqual([0, 0, 0, 0, 0]);
    const ids = repo.worktrees.map(stackIdOf);
    expect(new Set(ids).size).toBe(5);
  }, 30_000);

  it('어느 워크트리도 안 쥔 채 떠 있는 스택의 자리는 건너뛴다', async () => {
    const repo = repoWithWorktrees(1, ['supabase_db_saju', 'supabase_db_saju_wt1', 'supabase_db_saju_wt2']);

    expect((await slot(repo, repo.worktrees[0], '--auto')).code).toBe(0);
    expect(stackIdOf(repo.worktrees[0])).toBe('saju_wt3');

    const taken = await slot(repo, repo.worktrees[0], '2');
    expect(taken.code).toBe(1);
    expect(taken.out).toContain('supabase_db_saju_wt2');
  }, 30_000);

  it('보조 워크트리는 자리 0 을 못 받는다 — main 의 기본 스택과 부딪힌다', async () => {
    const repo = repoWithWorktrees(1);

    const secondary = await slot(repo, repo.worktrees[0], '0');
    expect(secondary.code).toBe(1);
    expect(secondary.out).toContain('main 체크아웃');

    expect((await slot(repo, repo.main, '0')).code).toBe(0);
  }, 30_000);

  it('거절해도 잠금을 놓는다 — 다음 할당이 막히지 않는다', async () => {
    const repo = repoWithWorktrees(1);

    expect((await slot(repo, repo.worktrees[0], '0')).code).toBe(1);
    expect((await slot(repo, repo.worktrees[0], '--auto')).code).toBe(0);
  }, 30_000);

  it('쥔 쪽이 없는 할당 잠금은 걷지 않고 멈춘다', async () => {
    const repo = repoWithWorktrees(1);
    mkdirSync(repo.lock);
    writeFileSync(join(repo.lock, 'owner.json'), JSON.stringify({ pid: 999999, cwd: '/gone' }));

    const result = await slot(repo, repo.worktrees[0], '--auto');
    expect(result.code).toBe(1);
    expect(result.out).toContain('손으로 걷는다');
  }, 30_000);
});
