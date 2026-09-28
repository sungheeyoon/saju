/**
 * 계획이 **조용히 건너뛰지 않는가.**
 *
 * 선택 실행의 위험은 빨간불이 아니라 **초록인데 안 잰 것**이다. 그래서 여기서 재는 것은
 * 「문서만 바뀌면 건너뛰는가」보다 「모르는 파일이 하나라도 있으면 전부 도는가」와
 * 「라벨이 검사를 뺄 수 없는가」다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEPENDENCY_LISTS,
  ENGINE_DB_FACING,
  FAST_STEPS,
  FULL_LABEL,
  HARNESS,
  SERVER_ACTIONS_ELSEWHERE,
  importsOf,
  isSurface,
  planFor,
  summaryOf,
} from './ci-plan.mjs';
import { currentStageOf } from './release-stage.mjs';

/** 공개 출시 — 머지 전에 전체를 재는 단계. 아래 「CI 계획」은 이 단계의 세 단계를 잰다 */
const pr = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '공개 출시' });
const beta = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '운영 베타' });

describe('CI 계획 — 공개 출시 전 (ADR 0097)', () => {
  it('입구가 아닌 코드 PR 은 fast 하나만 탄다 — 전체는 main 에서 돈다', () => {
    for (const files of [
      ['app/me/(shelf)/readings/shelf.tsx'],
      ['src/lib/saju/strength/index.ts'],
      ['src/lib/matching/x.ts', 'app/me/matching/x.tsx', 'app/auth-free.ts'],
      ['app/me/(shelf)/readings/book.ts', 'app/auth/signed-in.test.ts', 'app/me/matching/page.test.ts'],
      ['.github/workflows/verify.yml'],
    ]) {
      const plan = beta(files);
      expect(plan.tier, files[0]).toBe('fast');
      expect(plan.lanes, files[0]).toEqual({ policy: false, fast: true, verify: false, authed: false, flow: false, audit: false });
    }
  });

  it('정책만 바뀌면 전처럼 policy 다', () => {
    expect(beta(['docs/prd.md', '.claude/settings.json']).tier).toBe('policy');
  });

  it('supabase/ 가 하나라도 섞이면 단계와 상관없이 전부다 — 라벨 없이', () => {
    for (const file of ['supabase/migrations/20260923000000_x.sql', 'supabase/tests/40_x.test.sql', 'supabase/config.toml', 'supabase/.env']) {
      expect(beta(['app/page.tsx', file]).tier, file).toBe('full');
      expect(pr(['docs/prd.md', file]).tier, file).toBe('full');
    }
  });

  it('단계를 모르면 전부다 — 없는 단계 · 빠진 값', () => {
    expect(planFor({ files: ['app/page.tsx'], stage: '정식 운영' }).tier).toBe('full');
    expect(planFor({ files: ['app/page.tsx'], stage: null }).tier).toBe('full');
    expect(planFor({ files: ['app/page.tsx'] }).tier).toBe('full');
  });

  it('라벨은 베타에서도 더할 수만 있다', () => {
    expect(beta(['app/page.tsx'], [FULL_LABEL]).tier).toBe('full');
  });

  it('PRD 의 「(지금)」을 공개 출시로 옮기면 머지 전 전체로 돌아간다', () => {
    const prd = readFileSync(resolve(__dirname, '../docs/prd.md'), 'utf8');
    const now = currentStageOf(prd);
    expect(now).not.toBeNull();
    const launched = prd.replace(/\| \*\*([^*]+)\*\* \(지금\) \|/, '| **$1** |').replace('| **공개 출시** |', '| **공개 출시** (지금) |');
    expect(currentStageOf(launched)).toBe('공개 출시');
    const files = ['src/lib/chat/index.ts'];
    expect(planFor({ files, stage: currentStageOf(launched) }).tier).toBe('full');
    expect(planFor({ files, stage: now }).tier).toBe('fast');
  });

  /**
   * **빠른 검사에 빌드가 든다**(#219). `next build` 만 잡는 실패(`app/…/icon.tsx` 가 파비콘 라우트로 읽힌다)가
   * 단위 · 타입 · 린트를 초록으로 지나 main 에 들어갔고, Production 이 두 시간 섰다.
   */
  it('verify.yml 의 fast job 은 FAST_STEPS 를 차례로 돌고, 거기 빌드가 든다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const job = /\n  fast:\n([\s\S]*?)\n  [a-z]+:\n/.exec(yml)?.[1] ?? '';
    const runs = [...job.matchAll(/^\s+- run: (.+)$/gm)].map((one) => one[1].trim());
    expect(runs).toEqual(['npm ci', ...FAST_STEPS]);
    expect(FAST_STEPS).toContain('npm run build');
  });

  it('「(지금)」이 둘이거나 없으면 모르는 단계다', () => {
    const prd = readFileSync(resolve(__dirname, '../docs/prd.md'), 'utf8');
    expect(currentStageOf(prd.replace(/ \(지금\) \|/, ' |'))).toBeNull();
    expect(currentStageOf(prd.replace('| **공개 출시** |', '| **공개 출시** (지금) |'))).toBeNull();
    expect(currentStageOf('')).toBeNull();
  });
});

describe('CI 계획 — 관문 · 화면 · 인증은 베타에서도 전부다 (ADR 0119)', () => {
  const FULL = { policy: false, fast: false, verify: true, authed: true, flow: true, audit: false };

  /** 바뀐 파일 목록 그대로 — 둘 다 PR 에서 fast 만 돌았고, #284 는 머지 뒤 main 의 flow 가 붉었다(e370931) */
  const PR_284 = [
    'app/me/(home)/loading.tsx', 'app/me/(home)/page.tsx', 'app/me/(shelf)/loading.tsx',
    'app/me/(shelf)/readings/[subject]/page.tsx', 'app/me/(shelf)/readings/book.test.ts', 'app/me/(shelf)/readings/book.ts',
    'app/me/(shelf)/readings/frame.tsx', 'app/me/(shelf)/readings/layout.tsx', 'app/me/(shelf)/readings/opening.test.ts',
    'app/me/(shelf)/readings/opening.ts', 'app/me/(shelf)/readings/page.tsx', 'app/me/(shelf)/readings/shelf.tsx',
    'app/me/(shelf)/readings/subject.ts', 'app/me/chat/(rooms)/loading.tsx', 'app/me/chat/(rooms)/page.tsx',
    'app/me/matching/loading.tsx', 'app/me/matching/page.tsx', 'app/refresh.boundary.test.ts', 'app/ui/skeleton.tsx',
    'docs/adr/0116-the-tabs-open-on-a-skeleton-inside-a-route-group.md', 'docs/architecture.md', 'docs/prd.md',
    'scripts/check-chat.mjs', 'scripts/layers.test.ts',
  ];
  const PR_286 = [
    'app/auth/page.tsx', 'app/auth/signed-in.test.ts', 'app/auth/signed-in.ts', 'app/compat/page.test.ts', 'app/compat/page.tsx',
    'app/me/(home)/page.tsx', 'app/me/chat/[matchId]/page.tsx', 'app/me/discovery/actions.ts', 'app/me/matching/page.tsx',
    'app/signup/page.tsx', 'app/ops/reports/page.tsx', 'docs/adr/0117-the-gate-asks-auth-once-and-the-screen-checks-the-signature.md',
    'docs/prd.md', 'e2e/signed-in.spec.ts', 'proxy.ts',
  ];

  it('#284 · #286 모양의 PR 은 흐름 검사와 로그인 e2e 를 머지 전에 돈다', () => {
    expect(beta(PR_284).lanes).toEqual(FULL);
    expect(beta(PR_286).lanes).toEqual(FULL);
  });

  it('입구 하나만 바뀌어도 전부다 — 관문 · 인증 · 화면 · 액션 · 그것을 재는 시험', () => {
    for (const file of [
      'proxy.ts',
      'src/lib/consent/gate.ts',
      'app/auth/signed-in.ts',
      'app/auth/callback/route.ts',
      'app/page.tsx',
      'app/layout.tsx',
      'app/me/(home)/loading.tsx',
      'app/me/compat/not-found.tsx',
      'app/me/photo/[userId]/route.ts',
      'app/me/discovery/actions.ts',
      ...SERVER_ACTIONS_ELSEWHERE,
      'e2e/match.spec.ts',
      'scripts/check-discovery.mjs',
      ...HARNESS,
    ]) {
      expect(beta([file]).lanes, file).toEqual(FULL);
      expect(beta(['docs/prd.md', file]).tier, file).toBe('full');
    }
  });

  it('입구가 아닌 것은 전부로 안 넓힌다 — 컴포넌트 · lib · 시험 파일 · 문서', () => {
    for (const file of [
      'app/me/(shelf)/readings/shelf.tsx',
      'app/ui/skeleton.tsx',
      'app/me/(shelf)/readings/book.ts',
      'app/auth/signed-in.test.ts',
      'app/me/discovery/actions.test.ts',
      'src/lib/matching/pool.ts',
      'scripts/ci-plan.mjs',
      'scripts/fake-clock.mjs',
      'app/me/matching/deck-state.ts',
      'app/api/portone/webhook/settle.ts',
      'app/me/(shelf)/readings/opening.ts',
      'app/pages.ts',
      'app/me/pageless.tsx',
    ]) {
      expect(isSurface(file), file).toBe(false);
    }
    expect(beta(['docs/adr/0116-x.md', 'docs/architecture.md']).tier).toBe('policy');
  });

  it("app/ 의 'use server' 파일은 전부 입구로 걸린다 — 이름이 다른 새 액션 파일이 조용히 빠지지 않게", () => {
    const root = resolve(__dirname, '..');
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
        one.isDirectory() ? walk(join(dir, one.name)) : /\.tsx?$/.test(one.name) ? [join(dir, one.name)] : [],
      );
    const servers = walk(resolve(root, 'app'))
      .filter((file) => /^\s*['"]use server['"]/m.test(readFileSync(file, 'utf8').split('\n').slice(0, 20).join('\n')))
      .map((file) => relative(root, file));
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.filter((file) => !isSurface(file))).toEqual([]);
    // 이름으로 견주는 목록이다 — 옮기거나 지우면 옛 이름은 아무것도 안 건다
    expect([...SERVER_ACTIONS_ELSEWHERE, ...HARNESS].filter((file) => !existsSync(resolve(root, file)))).toEqual([]);
  });
});

/** 저장소 안의 import 를 파일로 푼다 — `./` · `../` · `@/` 만. 패키지는 `null` */
const ROOT = resolve(__dirname, '..');
const resolveImport = (name: string, from: string): string | null => {
  const base = name.startsWith('@/') ? resolve(ROOT, name.slice(2)) : name.startsWith('.') ? resolve(dirname(from), name) : null;
  if (base === null) return null;
  for (const tail of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']) {
    const file = base + tail;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
};
const reachedFrom = (roots: string[]): Set<string> => {
  const seen = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const name of importsOf(readFileSync(file, 'utf8'))) {
      const next = resolveImport(name, file);
      if (next !== null && !next.includes('/node_modules/')) queue.push(next);
    }
  }
  return seen;
};
const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((one) =>
    one.isDirectory() ? filesUnder(join(dir, one.name)) : /\.(tsx?|mjs)$/.test(one.name) ? [join(dir, one.name)] : [],
  );
const isTestFile = (file: string) => /\.test\.tsx?$/.test(file);

describe('CI 계획 — 판단이 사는 app/ 파일과 시험 도구도 입구다 (2026-09-28, ADR 0119 추기)', () => {
  const FULL = { policy: false, fast: false, verify: true, authed: true, flow: true, audit: false };

  it('감사가 짚은 서버 문 — 이름이 입구가 아니어도 DB · service-role · 공개 client 를 부르면 전부다', () => {
    for (const file of [
      'app/me/reading/pipeline.ts',
      'app/me/same-chart.ts',
      'app/me/candidates.ts',
      'app/me/chat/rooms.ts',
      'app/keyed-client.ts',
      'app/ops/reports/read.ts',
      'app/share/public-client.ts',
      'app/me/photo/photo-response.ts',
      'app/beta-schedule.ts',
    ]) {
      expect(beta([file]).lanes, file).toEqual(FULL);
    }
  });

  it('앱 서버의 설정과 흐름 검사 · e2e 의 도우미도 전부다', () => {
    for (const file of [
      'next.config.ts',
      'playwright.config.ts',
      'scripts/checks.mjs',
      'scripts/notice.mjs',
      'scripts/run-checks.mjs',
      'scripts/next-server.mjs',
      'src/lib/local-env.ts',
      // 아직 없는 새 도우미도 이름을 안 적고 걸린다 — 빼는 쪽(NOT_HARNESS)을 적는다
      'scripts/beta-dates.mjs',
      'scripts/some-new-helper.mjs',
    ]) {
      expect(beta([file]).lanes, file).toEqual(FULL);
    }
    for (const file of ['scripts/ci-plan.mjs', 'scripts/release-stage.mjs', 'scripts/fake-clock.mjs', 'scripts/ui-shots.mjs', 'scripts/generate-lunar-table.mjs']) {
      expect(isSurface(file), file).toBe(false);
    }
  });

  it('관문이 import 를 따라 닿는 app/ 파일은 서버에 안 닿아도 전부다 — 관문이 새로 부르기 시작한 PR 에서부터', () => {
    const tree: Record<string, string> = {
      'proxy.ts': "import { currentSchedule } from '@/app/beta-schedule';",
      'app/beta-schedule.ts': "import { read } from './db-error';\nimport type { X } from '@/src/lib/consent';",
      'app/db-error.ts': 'export const read = 1;',
      'app/unrelated.ts': 'export const y = 2;',
      'src/lib/consent/index.ts': 'export type X = 1;',
    };
    const sourceOf = (file: string) => tree[file] ?? null;
    expect(planFor({ files: ['app/db-error.ts'], stage: '운영 베타', sourceOf }).tier).toBe('full');
    expect(planFor({ files: ['app/unrelated.ts'], stage: '운영 베타', sourceOf }).tier).toBe('fast');
    expect(isSurface('app/db-error.ts', () => null)).toBe(false);
  });

  it('가르는 것은 이름이 아니라 import 다 — 새 파일도 · 지운 파일은 안 건다 · 시험 파일은 안 건다', () => {
    const fake = (source: string | null) => () => source;
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import { supabaseOnServer } from '../auth/server-client';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import type { SupabaseClient } from '@supabase/supabase-js';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import 'server-only';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("export { x } from '../../keyed-client';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/pure.ts'], stage: '운영 베타', sourceOf: fake("import { chartOf } from '@/src/lib/input/chart';") }).tier).toBe('fast');
    expect(planFor({ files: ['app/me/gone.ts'], stage: '운영 베타', sourceOf: fake(null) }).tier).toBe('fast');
    expect(planFor({ files: ['app/me/door.test.ts'], stage: '운영 베타', sourceOf: fake("import 'server-only';") }).tier).toBe('fast');
    // app/ 밖은 내용으로 안 가른다 — src/lib 는 전처럼 fast(ADR 0119 「안 고른 것」)
    expect(planFor({ files: ['src/lib/db/x.ts'], stage: '운영 베타', sourceOf: fake("import '@supabase/ssr';") }).tier).toBe('fast');
  });

  it('관문(proxy.ts)이 import 하는 저장소 파일은 전부 입구다', () => {
    const reached = [...reachedFrom([resolve(ROOT, 'proxy.ts')])].map((file) => relative(ROOT, file));
    expect(reached).toContain('app/beta-schedule.ts');
    // 관문이 부르는 도메인 lib(`src/lib/consent` 밖)는 앱도 부르고 단위 시험이 잰다 — app/ 과 관문 자리만 본다
    const doors = reached.filter((file) => file.startsWith('app/') || file === 'proxy.ts' || file.startsWith('src/lib/consent/'));
    expect(doors.filter((file) => !isSurface(file))).toEqual([]);
  });

  it('e2e · 흐름 검사 · Playwright 가 import 하되 앱은 안 닿는 파일은 전부 입구다 — 새 도우미가 조용히 빠지지 않게', () => {
    const harnessRoots = [
      ...filesUnder(resolve(ROOT, 'e2e')),
      ...readdirSync(resolve(ROOT, 'scripts'))
        .filter((name) => /^check-[^/]+\.mjs$/.test(name))
        .map((name) => resolve(ROOT, 'scripts', name)),
      ...HARNESS.map((file) => resolve(ROOT, file)),
      resolve(ROOT, 'scripts/run-checks.mjs'),
    ];
    const appRoots = [...filesUnder(resolve(ROOT, 'app')).filter((file) => !isTestFile(file)), resolve(ROOT, 'proxy.ts')];
    const app = reachedFrom(appRoots);
    const toolOnly = [...reachedFrom(harnessRoots)].filter((file) => !app.has(file)).map((file) => relative(ROOT, file));
    expect(toolOnly).toContain('scripts/checks.mjs');
    expect(toolOnly.filter((file) => !isSurface(file))).toEqual([]);
  });
});

describe('CI 계획 — ci-plan.mjs 의 차선과 verify.yml 이 짝을 이룬다', () => {
  /**
   * 한쪽에서 이름이 바뀌면 그 job 은 `if` 가 영원히 거짓이라 늘 skipped 이고, `gate` 는 skipped 를 통과로 세 초록이다 —
   * 아무 빨간불 없이 차선 하나가 사라진다. 그래서 계획이 내는 차선 전부를 워크플로의 네 자리와 견준다.
   */
  const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
  /** 단계마다 내는 차선 이름의 합 — 한 단계의 줄에서만 이름이 바뀌어도 걸리게 */
  const lanes = [
    ...new Set(
      [planFor({ files: [], event: 'push' }), beta(['app/me/matching/deck-state.ts']), beta(['docs/prd.md']), pr(['src/lib/saju/strength/index.ts'])]
        .flatMap((plan) => Object.keys(plan.lanes)),
    ),
  ].sort();
  const jobs = new Map(
    [...yml.split(/^jobs:\n/m)[1].matchAll(/^  ([a-z][\w-]*):\n([\s\S]*?)(?=^  [a-z][\w-]*:\n|(?![\s\S]))/gm)].map((one) => [one[1], one[2]]),
  );

  it('계획 job 의 outputs 는 차선마다 한 줄이고 같은 이름의 step 출력을 넘긴다', () => {
    const plan = jobs.get('plan') ?? '';
    const block = /\n    outputs:\n((?: {6}.+\n)+)/.exec(plan)?.[1] ?? '';
    const pairs = [...block.matchAll(/^ {6}([\w-]+): \$\{\{ steps\.plan\.outputs\.([\w-]+) \}\}$/gm)].map((one) => [one[1], one[2]]);
    expect(pairs.length).toBe(block.trim().split('\n').length);
    for (const [key, value] of pairs) expect(value, key).toBe(key);
    expect(pairs.map(([key]) => key).sort()).toEqual(lanes);
  });

  it('차선마다 같은 이름의 job 이 있고 그 job 은 제 출력 하나로만 켜진다', () => {
    for (const lane of lanes) {
      const job = jobs.get(lane);
      expect(job, lane).toBeDefined();
      expect(job, lane).toMatch(/^ {4}needs: plan$/m);
      expect(job, lane).toMatch(new RegExp(`^ {4}if: needs\\.plan\\.outputs\\.${lane} == 'true'$`, 'm'));
    }
    const read = [...yml.matchAll(/needs\.plan\.outputs\.([\w-]+)/g)].map((one) => one[1]);
    expect(read.filter((name) => !lanes.includes(name))).toEqual([]);
  });

  it('plan · gate 밖의 job 은 전부 차선이고, gate 가 그 전부를 물린다', () => {
    expect([...jobs.keys()].filter((name) => name !== 'plan' && name !== 'gate').sort()).toEqual(lanes);
    const needs = /^ {4}needs: \[([^\]]*)\]$/m.exec(jobs.get('gate') ?? '')?.[1].split(',').map((one) => one.trim()) ?? [];
    expect(needs.sort()).toEqual(['plan', ...lanes].sort());
  });
});

describe('CI 계획 — 운영 의존성 감사 (G-23 ①, ADR 0104)', () => {
  it('의존성 목록을 바꾼 PR 만 audit 이 머지를 막는다 — 어느 단계든', () => {
    for (const file of DEPENDENCY_LISTS) {
      expect(beta(['app/page.tsx', file]).lanes.audit, file).toBe(true);
      expect(pr([file]).lanes.audit, file).toBe(true);
      expect(beta(['docs/prd.md', file]).lanes.audit, file).toBe(true);
    }
  });

  it('의존성을 안 바꾼 PR 은 밖의 advisory 로 붉어지지 않는다 — DB · 정책 · 코드 PR 모두', () => {
    for (const files of [['app/page.tsx'], ['docs/prd.md'], ['supabase/migrations/20260923000000_x.sql'], ['src/lib/saju/strength/index.ts'], ['scripts/package.json'], ['e2e/package-lock.json']]) {
      expect(beta(files).lanes.audit, files[0]).toBe(false);
      expect(pr(files).lanes.audit, files[0]).toBe(false);
    }
  });

  it('main 푸시 · 일정 · 손으로 켠 실행 · 라벨 · 빈 diff 는 켠다 — 새 advisory 는 거기서 잡힌다', () => {
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      expect(planFor({ files: [], event }).lanes.audit, event).toBe(true);
    }
    expect(beta(['app/page.tsx'], [FULL_LABEL]).lanes.audit).toBe(true);
    expect(beta([]).lanes.audit).toBe(true);
  });

  it('verify.yml 이 audit 차선을 계획대로 켜고 gate 가 그것을 물린다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    expect(yml).toContain("audit: ${{ steps.plan.outputs.audit }}");
    expect(yml).toContain("if: needs.plan.outputs.audit == 'true'");
    expect(yml).toContain('npm audit --omit=dev --audit-level=high');
    expect(yml).toMatch(/gate:\n\s+needs: \[[^\]]*\baudit\b/);
  });
});

describe('CI 계획 — 공개 출시', () => {
  it('정책만 바뀌면 policy 차선만 돈다 — 문서도 scripts 시험이 읽으므로 아무것도 안 도는 단계는 없다', () => {
    const plan = pr(['docs/adr/0082-x.md', 'CONTEXT.md', 'docs/prd.md']);

    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual({ policy: true, fast: false, verify: false, authed: false, flow: false, audit: false });
  });

  it('도구 설정 · 이슈와 PR 틀 · scripts 의 시험 파일도 정책이다 (#141 은 설정 하나로 전부를 돌았다)', () => {
    for (const file of [
      '.claude/settings.json',
      '.github/ISSUE_TEMPLATE/ready-for-agent.md',
      '.github/pull_request_template.md',
      'scripts/code-rules.test.ts',
    ]) {
      expect(pr(['docs/agents/delegation.md', file]).tier, file).toBe('policy');
    }
  });

  it('scripts 의 시험이 아닌 파일과 더 깊은 자리의 시험은 정책이 아니다', () => {
    for (const file of ['scripts/ci-plan.mjs', 'scripts/checks.mjs', 'scripts/nested/x.test.ts', 'src/lib/chat/index.test.ts']) {
      expect(pr([file]).tier, file).toBe('full');
    }
  });

  it('어느 단계든 scripts 시험은 돈다 — policy 가 꺼진 단계는 verify 의 npm test 가 돈다', () => {
    for (const files of [['docs/prd.md'], ['src/lib/saju/strength/index.ts'], ['app/page.tsx']]) {
      const { lanes } = pr(files);
      expect(lanes.policy || lanes.verify, files[0]).toBe(true);
    }
  });

  it('엔진과 그것을 그리는 칸만 바뀌면 verify 만 돈다', () => {
    const plan = pr(['src/lib/saju/strength/index.ts', 'app/saju/fortune.tsx', 'docs/prd.md']);

    expect(plan.tier).toBe('engine');
    expect(plan.lanes).toEqual({ policy: false, fast: false, verify: true, authed: false, flow: false, audit: false });
  });

  it('모르는 파일이 하나라도 섞이면 전부 돈다', () => {
    for (const stranger of [
      'app/page.tsx',
      'app/birth-form.tsx',
      'scripts/ci-plan.mjs',
      'package.json',
      '.github/workflows/verify.yml',
      'supabase/migrations/20260101000000_x.sql',
      'e2e/match.spec.ts',
    ]) {
      const plan = pr(['src/lib/saju/strength/index.ts', stranger]);

      expect(plan.tier, stranger).toBe('full');
      expect(plan.lanes, stranger).toEqual({ policy: false, fast: false, verify: true, authed: true, flow: true, audit: stranger === 'package.json' });
    }
  });

  it('DB 검사식이 보는 엔진 파일은 엔진 단계에 안 든다', () => {
    /** 저장되는 여덟 글자의 모양과 판본 — 로그인 뒤 자리만 빨개지는 유일한 엔진 변경 */
    for (const file of ENGINE_DB_FACING) expect(pr([file]).tier, file).toBe('full');
    // 이름으로 견주는 목록이다 — 파일을 옮기면 옛 이름은 아무것도 안 걸러 새 자리가 엔진 단계로 조용히 빠진다
    const root = resolve(__dirname, '..');
    expect([...ENGINE_DB_FACING, ...DEPENDENCY_LISTS].filter((file) => !existsSync(resolve(root, file)))).toEqual([]);
  });

  it('diff 를 못 받았으면 모르는 것이므로 전부 돈다', () => {
    expect(pr([]).tier).toBe('full');
    expect(pr(['', '  ']).tier).toBe('full');
  });

  it('라벨은 더할 수만 있고 뺄 수 없다', () => {
    expect(pr(['docs/prd.md'], [FULL_LABEL]).tier).toBe('full');
    /** 전부 도는 변경은 어떤 라벨로도 안 줄어든다 */
    expect(pr(['app/page.tsx'], ['docs-only', 'skip-ci', 'engine']).tier).toBe('full');
    expect(pr(['docs/prd.md'], ['docs-only']).tier).toBe('policy');
  });

  it('main 푸시 · 일정 · 손으로 켠 실행은 계획을 안 본다', () => {
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      expect(planFor({ files: ['docs/prd.md'], event }).tier, event).toBe('full');
    }
  });

  it('요약은 단계와 차선을 사람이 읽게 적는다', () => {
    const files = ['docs/prd.md'];
    const text = summaryOf(pr(files), files);

    expect(text).toContain('`policy`');
    expect(text).toContain('| `authed` | 건너뛴다 |');
    expect(text).toContain('바뀐 파일 1개');
  });
});
