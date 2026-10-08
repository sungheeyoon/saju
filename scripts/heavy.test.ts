/**
 * 무거운 실행 잠금이 **하나씩 들이고, 종료 코드와 신호를 그대로 내는가** (`scripts/heavy.mjs`). 실제 프로세스를 띄워 잰다 — 잠금
 * 경로만 임시 자리다.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, 'heavy.mjs');

type Ran = { code: number | null; signal: NodeJS.Signals | null; out: string };

function run(lock: string, command: string[], env: Record<string, string> = {}) {
  const child = spawn('node', [SCRIPT, ...command], {
    env: { ...process.env, CI: '', SAJU_HEAVY_HELD: '', SAJU_HEAVY_LOCK: lock, ...env },
  });
  let out = '';
  child.stdout.on('data', (chunk) => (out += chunk));
  child.stderr.on('data', (chunk) => (out += chunk));
  const done = new Promise<Ran>((settle) => child.on('exit', (code, signal) => settle({ code, signal, out })));
  return { child, done };
}

const freshLock = () => join(mkdtempSync(join(tmpdir(), 'heavy-lock-')), 'heavy.lock');
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const NODE = (code: string) => ['node', '-e', code];

describe('무거운 실행 잠금', () => {
  it('자식의 종료 코드를 그대로 내고 잠금을 푼다', async () => {
    const lock = freshLock();
    const { code } = await run(lock, NODE('process.exit(3)')).done;
    expect(code).toBe(3);
    expect(existsSync(lock)).toBe(false);
  }, 15_000);

  it('둘째는 첫째가 끝날 때까지 기다린 뒤에 돈다', async () => {
    const lock = freshLock();
    const first = run(lock, NODE('setTimeout(() => console.log("FIRST-DONE " + Date.now()), 1500)'));
    await sleep(500);
    const second = run(lock, NODE('console.log("SECOND-RAN " + Date.now())'));
    const [a, b] = await Promise.all([first.done, second.done]);
    expect(b.out).toContain('기다린다');
    const firstDone = Number(/FIRST-DONE (\d+)/.exec(a.out)?.[1]);
    const secondRan = Number(/SECOND-RAN (\d+)/.exec(b.out)?.[1]);
    expect(secondRan).toBeGreaterThanOrEqual(firstDone);
  }, 20_000);

  it('중단 신호를 자식에게 넘기고, 잠금을 푼 뒤 같은 신호로 끝난다', async () => {
    const lock = freshLock();
    const { child, done } = run(lock, NODE('setInterval(() => {}, 1000)'));
    await sleep(800);
    expect(existsSync(lock)).toBe(true);
    child.kill('SIGTERM');
    const { signal, code } = await done;
    expect(signal === 'SIGTERM' || code === 143).toBe(true);
    expect(existsSync(lock)).toBe(false);
  }, 15_000);

  it('잡은 쪽 안에서 또 부르면 잠그지 않는다 — 감싼 스크립트가 감싼 스크립트를 불러도 서지 않는다', async () => {
    const lock = freshLock();
    const inner = `require('child_process').execFileSync('node', [${JSON.stringify(SCRIPT)}, 'node', '-e', 'console.log("INNER-RAN")'], { stdio: 'inherit' })`;
    const { code, out } = await run(lock, NODE(inner)).done;
    expect(code).toBe(0);
    expect(out).toContain('INNER-RAN');
    expect(out).not.toContain('기다린다');
  }, 15_000);

  it.each(['true', '1'])('CI(%s — GitHub · Vercel)에서는 잠금을 만들지 않는다', async (ci) => {
    const lock = freshLock();
    const { code } = await run(lock, NODE('process.exit(require("fs").existsSync(process.argv[1]) ? 7 : 0)').concat(lock), { CI: ci }).done;
    expect(code).toBe(0);
  }, 15_000);

  it('쥐었던 쪽이 죽은 잠금은 걷고 들어간다', async () => {
    const lock = freshLock();
    mkdirSync(lock);
    writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: 999999, child: 999998, cwd: '/x', command: 'old', at: 't' }));
    const { code, out } = await run(lock, NODE('console.log("RAN")')).done;
    expect(code).toBe(0);
    expect(out).toContain('RAN');
    expect(existsSync(lock)).toBe(false);
  }, 15_000);
});
