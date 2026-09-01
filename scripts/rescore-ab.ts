/**
 * 저장된 글을 **다시 채점한다 — 모델을 부르지 않는다.**
 *
 * 게이트는 정규식 탐지기라 틀린다. 실제로 첫 실행에서 「허위 이름」이 한국어 어미를
 * 스물 넘게 잡았다(`요구해`·`답답해`). 그때 고친 게이트로 **이미 치른 호출을 다시
 * 세려면** 출력 원문이 남아 있어야 하고, 그래서 남긴다.
 *
 * 이 파일이 있는 한 게이트를 고치는 값이 싸다 — 고치고 다시 돌리면 되지, 다시
 * 부를 이유가 없다.
 *
 *   node scripts/run-ts.mjs scripts/rescore-ab.ts                 # 가장 최근 실행
 *   node scripts/run-ts.mjs scripts/rescore-ab.ts .ab-overlaps/…  # 특정 실행
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeSaju } from '../src/lib/saju';
import { FIXTURES, GATES, type Gate } from './ab-overlaps';

function latestRun(): string {
  // 실제 실행만 본다 — dry-run 에는 채점할 글이 없다.
  const runs = readdirSync('.ab-overlaps', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('run-'))
    .map((entry) => entry.name)
    .sort();

  const latest = runs.at(-1);
  if (latest === undefined) {
    console.error('채점할 실행이 없다. `--execute` 로 한 번 돌린 뒤에 부른다.');
    process.exit(1);
  }

  return join('.ab-overlaps', latest);
}

const dir = process.argv[2] ?? latestRun();

const lines = readFileSync(join(dir, 'runs.jsonl'), 'utf8').trim().split('\n').filter(Boolean);
const rescored: unknown[] = [];

console.log(`${dir} — ${lines.length}건\n`);

for (const line of lines) {
  const run = JSON.parse(line) as {
    fixture: string;
    arm: string;
    text?: string;
    error?: string;
    length?: { chars: number; target: { min: number; max: number }; overBy: number };
    production?: { ok: boolean };
    durationMs?: number;
    gates?: Gate[];
  };

  const head = `${run.arm} ${run.fixture}`;

  if (run.text === undefined) {
    console.log(`${head}\n  ✗ ${run.error}\n`);
    rescored.push({ ...run, rescored: null });
    continue;
  }

  const fixture = FIXTURES.find((f) => f.id === run.fixture);
  if (fixture === undefined) throw new Error(`그런 명식이 없다: ${run.fixture}`);

  const saju = computeSaju(fixture.input);
  const gates = GATES.map((gate) => gate(saju, run.text as string));

  const seconds = run.durationMs === undefined ? '' : ` · ${(run.durationMs / 1000).toFixed(0)}s`;
  const length =
    run.length === undefined
      ? ''
      : ` · ${run.length.chars}자(주문 ${run.length.target.min}~${run.length.target.max}` +
        `${run.length.overBy > 0 ? `, +${run.length.overBy} 초과` : ''})`;

  console.log(`${head}${seconds}${length} · 프로덕션 ${run.production?.ok === false ? 'FAIL' : run.production?.ok ? '통과' : '안 잼'}`);

  for (const gate of gates) {
    const before = run.gates?.find((g) => g.id === gate.id);
    const moved = before !== undefined && before.pass !== gate.pass ? ` (전 ${before.pass ? 'ok' : 'fail'})` : '';
    console.log(
      `  ${gate.pass ? 'ok  ' : gate.hard ? 'HARD' : 'soft'} ${gate.id.padEnd(12)}${moved} ${gate.detail.slice(0, 100)}`,
    );
  }
  console.log();

  rescored.push({ ...run, gates });
}

writeFileSync(join(dir, 'rescored.json'), JSON.stringify(rescored, null, 2));
console.log(`→ ${join(dir, 'rescored.json')}`);
