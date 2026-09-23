/**
 * 원격 잠금이 **둘을 함께 들이지 않는가** (#154). 실제 프로세스를 띄워 잰다 — 잠금 경로만 임시 자리다.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'remote-lock.mjs');

function run(lock: string, ...command: string[]): { done: Promise<{ code: number | null; out: string }>; pid: number } {
  const child = spawn('node', [SCRIPT, ...command], { env: { ...process.env, SAJU_REMOTE_LOCK: lock } });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (out += chunk));
  return { done: new Promise((done) => child.on('exit', (code) => done({ code, out }))), pid: child.pid! };
}

const freshLock = () => join(mkdtempSync(join(tmpdir(), 'remote-lock-')), 'remote.lock');
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('원격 잠금 (ADR 0096 · #154)', () => {
  it('둘이 같은 죽은 잠금을 함께 봐도 아무도 안 들어가고, 걷는 법을 말하며 멈춘다', async () => {
    const lock = freshLock();
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 999999, child: 999998, cwd: '/x', command: 'old', at: 't' }));

    const [b, c] = await Promise.all([run(lock, 'echo', 'B-RAN').done, run(lock, 'echo', 'C-RAN').done]);

    for (const { code, out } of [b, c]) {
      expect(code).toBe(1);
      expect(out).not.toMatch(/-RAN/);
      expect(out).toContain('손으로 걷는다');
    }
    expect(existsSync(join(lock, 'owner.json'))).toBe(true);
  }, 15_000);

  it('래퍼가 죽어도 자식이 사는 동안은 기다린다 — 자식까지 끝나면 들어가지 않고 멈춘다', async () => {
    const lock = freshLock();
    const first = run(lock, 'sh', '-c', 'sleep 2; echo A-DONE');
    await sleep(700);
    process.kill(first.pid, 'SIGKILL');

    const started = Date.now();
    const second = await run(lock, 'echo', 'D-RAN').done;

    expect(second.out).toContain('기다린다');
    expect(second.out).not.toContain('D-RAN');
    expect(second.code).toBe(1);
    expect(Date.now() - started).toBeGreaterThan(800);
  }, 15_000);

  it('평소에는 줄을 선다 — 앞이 끝난 뒤에 돌고, 끝나면 잠금이 없다', async () => {
    const lock = freshLock();
    const first = run(lock, 'sh', '-c', 'echo E-START; sleep 1; echo E-END');
    await sleep(300);
    const second = run(lock, 'echo', 'F-RAN');

    const [a, b] = await Promise.all([first.done, second.done]);
    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    expect(b.out).toContain('F-RAN');
    expect(existsSync(lock)).toBe(false);
  }, 15_000);
});
