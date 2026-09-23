/**
 * **Vercel 은 0 이면 건너뛰고 1 이면 빌드한다** — 그 반대 의미를 여기서 든다.
 *
 * 판단(`decide`)은 순수 함수로 재고, 진입점은 실제로 띄워 종료 코드를 잰다. 가짜 git 저장소를 임시 폴더에
 * 지어 기준 커밋이 있는 경우 · 없는 경우 · git 밖인 경우를 밟는다 — 네트워크를 안 쓴다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decide, exitCodeOf, skippable } from './vercel-ignore.mjs';

const SCRIPT = resolve(__dirname, 'vercel-ignore.mjs');

describe('무엇이 바뀌면 Preview 를 건너뛰나', () => {
  it('문서 · 마이그레이션 · pgTAP · src 와 scripts 의 단위 시험만 건너뛸 수 있다', () => {
    for (const file of [
      'docs/ops/runbook.md',
      'README.md',
      'AGENTS.md',
      'supabase/migrations/20261010090000_x.sql',
      'supabase/tests/46_x.test.sql',
      'src/lib/chat/limits.test.ts',
      'scripts/ci-plan.test.ts',
    ]) {
      expect(skippable(file), file).toBe(true);
    }
  });

  it('앱 · src · 설정 · 의존성 · 빌드 스크립트 · 환경변수 검사는 빌드한다', () => {
    for (const file of [
      'app/page.tsx',
      'app/ops/reports/filters.test.ts',
      'src/lib/chat/limits.ts',
      'src/lib/db/database.generated.ts',
      'next.config.ts',
      'vercel.json',
      'package.json',
      'package-lock.json',
      'proxy.ts',
      'scripts/secret-env.mjs',
      'scripts/vercel-ignore.mjs',
      'supabase/config.toml',
      'e2e/chat.spec.ts',
      'public/favicon.ico',
    ]) {
      expect(skippable(file), file).toBe(false);
    }
  });
});

describe('판단', () => {
  it('production 은 무엇이 바뀌었든 빌드한다', () => {
    expect(decide({ env: 'production', files: ['docs/prd.md'] }).build).toBe(true);
    expect(decide({ env: 'production', files: null }).build).toBe(true);
  });

  it('Preview 에서 건너뛸 자리만 바뀌었으면 건너뛴다', () => {
    expect(decide({ env: 'preview', files: ['docs/prd.md', 'supabase/tests/45_x.test.sql'] }).build).toBe(false);
  });

  it('하나라도 앱 쪽이면 빌드한다', () => {
    const decision = decide({ env: 'preview', files: ['docs/prd.md', 'app/page.tsx'] });
    expect(decision.build).toBe(true);
    expect(decision.reason).toContain('app/page.tsx');
  });

  it('모르면 빌드한다 — 비교 실패 · 빈 목록 · 모르는 환경', () => {
    expect(decide({ env: 'preview', files: null }).build).toBe(true);
    expect(decide({ env: 'preview', files: [] }).build).toBe(true);
    expect(decide({ env: 'preview', files: ['', '  '] }).build).toBe(true);
    expect(decide({ env: undefined, files: ['docs/prd.md'] }).build).toBe(true);
    expect(decide({ env: 'development', files: ['docs/prd.md'] }).build).toBe(true);
  });

  it('종료 코드는 거꾸로다 — 빌드는 1, 건너뜀은 0', () => {
    expect(exitCodeOf({ build: true, reason: '' })).toBe(1);
    expect(exitCodeOf({ build: false, reason: '' })).toBe(0);
  });
});

describe('진입점', () => {
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], {
        cwd: dir,
        encoding: 'utf8',
      }).trim();
    const put = (path: string) => {
      mkdirSync(join(dir, dirname(path)), { recursive: true });
      writeFileSync(join(dir, path), String(Math.random()));
    };
    git('init', '--quiet');
    put('app/page.tsx');
    git('add', '.');
    git('commit', '--quiet', '-m', 'first');
    return { dir, git, put, head: () => git('rev-parse', 'HEAD') };
  };

  const run = (cwd: string, env: Record<string, string>) =>
    spawnSync(process.execPath, [SCRIPT], {
      cwd,
      encoding: 'utf8',
      env: { NODE_ENV: 'test', PATH: process.env.PATH ?? '', ...env },
    }).status;

  it('지난 배포 뒤에 문서만 바뀌었으면 0 으로 끝난다', () => {
    const { dir, git, put, head } = repo();
    const previous = head();
    put('docs/a.md');
    git('add', '.');
    git('commit', '--quiet', '-m', 'docs');
    expect(run(dir, { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: previous })).toBe(0);
  });

  it('앱이 바뀌었으면 1, production 이면 문서만이어도 1', () => {
    const { dir, git, put, head } = repo();
    const previous = head();
    put('docs/a.md');
    put('app/page.tsx');
    git('add', '.');
    git('commit', '--quiet', '-m', 'app');
    expect(run(dir, { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: previous })).toBe(1);

    const again = repo();
    const before = again.head();
    again.put('docs/b.md');
    again.git('add', '.');
    again.git('commit', '--quiet', '-m', 'docs');
    expect(run(again.dir, { VERCEL_ENV: 'production', VERCEL_GIT_PREVIOUS_SHA: before })).toBe(1);
  });

  it('기준이 clone 에 없고 가져올 곳도 없으면 1 — 판단 불가는 빌드다', () => {
    const { dir } = repo();
    expect(run(dir, { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: 'f'.repeat(40) })).toBe(1);
    // 첫 배포 — 기준이 비었고 origin 이 없다
    expect(run(dir, { VERCEL_ENV: 'preview' })).toBe(1);
  });

  it('git 저장소 밖이면 1', () => {
    const outside = mkdtempSync(join(tmpdir(), 'vercel-ignore-none-'));
    expect(run(outside, { VERCEL_ENV: 'preview', VERCEL_GIT_PREVIOUS_SHA: 'a'.repeat(40) })).toBe(1);
  });
});
