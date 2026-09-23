import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { worktreeStack } from '../src/lib/local-env';

import { SLOTS, takenSlots, valuesOf } from './stack-slot.mjs';

const ROOT = resolve(__dirname, '..');

/** `supabase/.env` 의 기본값 — main 체크아웃과 CI 가 이 값으로 선다 */
const defaults = Object.fromEntries(
  readFileSync(join(ROOT, 'supabase/.env'), 'utf8')
    .split('\n')
    .filter((line) => /^SAJU_[A-Z_]+=/.test(line))
    .map((line) => line.split('=') as [string, string]),
);

describe('워크트리마다 제 스택 (ADR 0096)', () => {
  it('config.toml 이 env() 로 받는 이름은 전부 supabase/.env 에 기본값이 있다 — 없으면 CLI 가 설정을 못 읽는다', () => {
    const config = readFileSync(join(ROOT, 'supabase/config.toml'), 'utf8');
    const wanted = [...config.matchAll(/^[a-z_]+ = "env\((SAJU_[A-Z_]+)\)"/gm)].map((match) => match[1]);
    expect(wanted.length).toBeGreaterThan(8);
    expect(wanted.filter((name) => !(name in defaults))).toEqual([]);
  });

  it('자리가 쓰는 이름은 기본값과 같은 목록이다 — 하나만 옮기면 두 워크트리가 그 하나를 두고 부딪힌다', () => {
    expect(Object.keys(valuesOf(1)).sort()).toEqual(Object.keys(defaults).sort());
  });

  it('자리 0(기본값)~9 의 이름과 포트는 서로 안 겹친다 — 흐름 검사는 제 첫 포트에서 +7 까지 쓴다', () => {
    const slots = [defaults, ...Array.from({ length: 9 }, (_, index) => valuesOf(index + 1) as Record<string, string>)];
    const ids = slots.map((values) => values.SAJU_STACK_ID);
    expect(new Set(ids).size).toBe(slots.length);

    const taken = new Map<number, string>();
    const clashes: string[] = [];
    slots.forEach((values, slot) => {
      for (const [key, value] of Object.entries(values)) {
        if (!/^\d+$/.test(value)) continue; // 이름과 주소는 포트가 아니다 — 주소는 웹 포트를 따라간다
        const width = key === 'SAJU_CHECK_PORT' ? 8 : 1;
        for (let offset = 0; offset < width; offset += 1) {
          const port = Number(value) + offset;
          const owner = `${slot}:${key}`;
          if (taken.has(port)) clashes.push(`${port} — ${taken.get(port)} · ${owner}`);
          taken.set(port, owner);
        }
      }
    });
    expect(clashes).toEqual([]);
  });
});

function worktree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'stack-'));
  mkdirSync(join(root, 'supabase'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, 'supabase', name), body);
  return root;
}

const BASE = 'SAJU_STACK_ID=saju\nSAJU_WEB_PORT=3000\nSAJU_CHECK_PORT=3210\n';

describe('누가 어느 자리를 쥐었나 — takenSlots (#154)', () => {
  const here = 'saju_wt3';

  it('다른 워크트리의 .env.local 이 쥔 자리는 쥔 것이다 — 두 세션이 같은 번호를 못 고른다', () => {
    const taken = takenSlots({ worktrees: [{ path: '/w/a', stackId: 'saju_wt1' }, { path: '/w/b', stackId: null }], containers: [], here });
    expect([...taken.keys()]).toEqual([1]);
    expect(taken.get(1)).toBe('/w/a');
  });

  it('어느 워크트리도 안 쥐었는데 떠 있는 스택도 쥔 것이다 — 포트를 잡고 있다', () => {
    const taken = takenSlots({ worktrees: [], containers: ['supabase_db_saju', 'supabase_db_saju_wt5'], here });
    expect([...taken.keys()]).toEqual([5]);
  });

  it('제 스택은 제 자리를 막지 않는다 — 다시 불러도 같은 번호를 받는다', () => {
    const taken = takenSlots({ worktrees: [], containers: ['supabase_db_saju_wt3'], here });
    expect(taken.size).toBe(0);
  });

  it('자리 번호와 스택 이름이 한 목록이다', () => {
    expect(SLOTS.map((n: number) => valuesOf(n).SAJU_STACK_ID)).toEqual(SLOTS.map((n: number) => `saju_wt${n}`));
  });
});

describe('worktreeStack — CLI 와 같은 차례로 읽는다 (ADR 0096)', () => {
  afterEach(() => {
    delete process.env.SAJU_STACK_ID;
  });

  it('.env 만 있으면 기본값이다', () => {
    expect(worktreeStack(worktree({ '.env': BASE }))).toEqual({
      id: 'saju',
      dbContainer: 'supabase_db_saju',
      webPort: 3000,
      checkPort: 3210,
    });
  });

  it('.env.local 이 .env 를 덮는다', () => {
    const root = worktree({ '.env': BASE, '.env.local': '# 사람의 줄\nSAJU_STACK_ID=saju_wt2\nSAJU_WEB_PORT=3020\n' });
    expect(worktreeStack(root)).toMatchObject({ dbContainer: 'supabase_db_saju_wt2', webPort: 3020, checkPort: 3210 });
  });

  it('셸의 환경변수가 둘보다 세다', () => {
    process.env.SAJU_STACK_ID = 'from_shell';
    const root = worktree({ '.env': BASE, '.env.local': 'SAJU_STACK_ID=saju_wt2\n' });
    expect(worktreeStack(root).dbContainer).toBe('supabase_db_from_shell');
  });

  it('값이 없으면 어디를 보라고 말하며 멈춘다', () => {
    expect(() => worktreeStack(worktree({}))).toThrow(/SAJU_STACK_ID/);
  });
});
