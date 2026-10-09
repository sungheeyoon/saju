/**
 * 계획이 **조용히 건너뛰지 않는가.**
 *
 * 선택 실행의 위험은 빨간불이 아니라 **초록인데 안 잰 것**이다. 그래서 여기서 재는 것은
 * 「문서만 바뀌면 건너뛰는가」보다 「모르는 파일이 하나라도 있으면 전부 도는가」와
 * 「라벨이 검사를 뺄 수 없는가」다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  AUTHED_LANES,
  COPY_FILES,
  CORE_STEPS,
  DEPENDENCY_LISTS,
  ENGINE_DB_FACING,
  FULL_LABEL,
  HARNESS,
  ROOT_CONFIGS,
  SERVER_ACTIONS_ELSEWHERE,
  SHARED_RISK,
  addressesOf,
  copyConstantsShape,
  copyLanesOf,
  copyOnlyChanged,
  deployRangeOf,
  syntaxOf,
  importsOf,
  isSurface,
  lanesOfTest,
  loginSpecs,
  onlyCommentsChanged,
  planFor,
  routeOf,
  settledGreen,
  specsOfLane,
  summaryOf,
} from './ci-plan.mjs';
import { STAGE_FILE, currentStageOf } from './release-stage.mjs';

/** 공개 출시 — 머지 전에 전체를 재는 단계. 아래 「CI 계획」은 이 단계의 세 단계를 잰다 */
const pr = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '공개 출시' });
const beta = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '운영 베타' });

/** 전부 — 단위 · 타입 · 린트 · 빌드(`core`) · 익명 e2e · 로그인 일곱 · 흐름 */
const FULL = { policy: false, core: true, anon: true, authed: true, flow: true, audit: false };
const CORE_ONLY = { policy: false, core: true, anon: false, authed: false, flow: false, audit: false };

describe('CI 계획 — 공개 출시 전 (ADR 0097)', () => {
  it('입구가 아닌 코드 PR 은 core 하나만 탄다 — 전체는 main 에서 돈다', () => {
    for (const files of [
      ['app/me/(shelf)/readings/shelf.tsx'],
      ['src/lib/saju/strength/index.ts'],
      ['src/lib/matching/x.ts', 'app/me/matching/x.tsx', 'app/auth-free.ts'],
      ['app/me/(shelf)/readings/book.ts', 'app/auth/signed-in.test.ts', 'app/me/matching/page.test.ts'],
      ['.github/workflows/verify.yml'],
    ]) {
      const plan = beta(files);
      expect(plan.tier, files[0]).toBe('core');
      expect(plan.lanes, files[0]).toEqual(CORE_ONLY);
      expect(plan.authedLanes, files[0]).toEqual([]);
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
    const prd = readFileSync(resolve(__dirname, '..', STAGE_FILE), 'utf8');
    const now = currentStageOf(prd);
    expect(now).not.toBeNull();
    const launched = prd.replace(/\| \*\*([^*]+)\*\* \(지금\) \|/, '| **$1** |').replace('| **공개 출시** |', '| **공개 출시** (지금) |');
    expect(currentStageOf(launched)).toBe('공개 출시');
    const files = ['src/lib/chat/index.ts'];
    expect(planFor({ files, stage: currentStageOf(launched) }).tier).toBe('full');
    expect(planFor({ files, stage: now }).tier).toBe('core');
  });

  /**
   * **빠른 검사에 빌드가 든다**(#219). `next build` 만 잡는 실패(`app/…/icon.tsx` 가 파비콘 라우트로 읽힌다)가
   * 단위 · 타입 · 린트를 초록으로 지나 main 에 들어갔고, Production 이 두 시간 섰다.
   */
  it('verify.yml 의 core job 은 CORE_STEPS 를 차례로 돌고, 거기 빌드가 든다 — anon 은 그것을 다시 돌지 않는다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const runsOf = (name: string) => {
      const job = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)\\n  [a-z]+:\\n`).exec(yml)?.[1] ?? '';
      return [...job.matchAll(/^\s+- run: (.+)$/gm)].map((one) => one[1].trim());
    };
    expect(runsOf('core')).toEqual(['npm ci', ...CORE_STEPS]);
    expect(CORE_STEPS).toContain('npm run build');
    expect(runsOf('anon')).toEqual(['npm ci', 'npx playwright install --with-deps chromium', 'npm run test:e2e']);
  });

  it('「(지금)」이 둘이거나 없으면 모르는 단계다', () => {
    const prd = readFileSync(resolve(__dirname, '..', STAGE_FILE), 'utf8');
    expect(currentStageOf(prd.replace(/ \(지금\) \|/, ' |'))).toBeNull();
    expect(currentStageOf(prd.replace('| **공개 출시** |', '| **공개 출시** (지금) |'))).toBeNull();
    expect(currentStageOf('')).toBeNull();
  });
});

describe('CI 계획 — 관문 · 화면 · 인증은 베타에서도 전부다 (ADR 0119)', () => {
  /** 바뀐 파일 목록 그대로 — 둘 다 PR 에서 fast(지금 core) 만 돌았고, #284 는 머지 뒤 main 의 flow 가 붉었다(e370931) */
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

  it('#284 · #286 모양의 PR 은 흐름 검사와 로그인 e2e 를 머지 전에 돈다 — 둘 다 공용 위험이 들었다', () => {
    expect(beta(PR_284).lanes).toEqual(FULL);
    expect(beta(PR_284).cause).toBe('layout');
    expect(beta(PR_286).lanes).toEqual(FULL);
    expect(beta(PR_286).cause).toBe('인증');
  });

  it('#284 에서 layout 과 subject.ts 를 빼도 흐름 검사는 선다 — check-chat.mjs 와 탭의 주소가 부른다', () => {
    const plan = beta(PR_284.filter((file) => !file.endsWith('/layout.tsx') && !file.endsWith('/subject.ts')));
    expect(plan.tier).toBe('narrow');
    expect(plan.lanes.flow).toBe(true);
  });

  it('관문 · 인증 · 액션 · route · layout · 시험 도구는 하나만 바뀌어도 전부다', () => {
    for (const file of [
      'proxy.ts',
      'src/lib/consent/gate.ts',
      'app/auth/signed-in.ts',
      'app/auth/callback/route.ts',
      'app/layout.tsx',
      'app/me/photo/[userId]/route.ts',
      'app/me/discovery/actions.ts',
      ...SERVER_ACTIONS_ELSEWHERE,
      ...HARNESS,
    ]) {
      expect(beta([file]).lanes, file).toEqual(FULL);
      expect(beta(['docs/prd.md', file]).tier, file).toBe('full');
    }
  });

  it('화면의 입구 · spec · 흐름 검사는 이제 그 주소에 닿는 차선만이다 (2026-10-01)', () => {
    const lanesOf = (file: string) => {
      const plan = beta([file]);
      return { tier: plan.tier, ...plan.lanes, authedLanes: plan.authedLanes };
    };
    const some = (authedLanes: string[], rest: Partial<typeof FULL> = {}) => ({
      tier: 'narrow', ...CORE_ONLY, authed: authedLanes.length > 0, authedLanes, ...rest,
    });
    expect(lanesOf('app/page.tsx')).toEqual(some(['signed-in:desktop', 'signed-in:mobile', 'push'], { anon: true, flow: true }));
    expect(lanesOf('app/me/(home)/loading.tsx')).toEqual(some(AUTHED_LANES, { anon: true, flow: true }));
    expect(lanesOf('app/me/compat/not-found.tsx')).toEqual(some(['signed-in:desktop', 'signed-in:mobile'], { anon: true, flow: true }));
    expect(lanesOf('e2e/match.spec.ts')).toEqual(some(['match:desktop', 'match:mobile']));
    expect(lanesOf('scripts/check-discovery.mjs')).toEqual(some([], { flow: true }));
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
    for (const file of ['scripts/ci-plan.mjs', 'scripts/release-stage.mjs', 'scripts/merge-sim.mjs', 'scripts/read-budget.mjs', 'scripts/fake-clock.mjs', 'scripts/ui-shots.mjs', 'scripts/generate-lunar-table.mjs']) {
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
    expect(planFor({ files: ['app/unrelated.ts'], stage: '운영 베타', sourceOf }).tier).toBe('core');
    expect(isSurface('app/db-error.ts', () => null)).toBe(false);
  });

  it('가르는 것은 이름이 아니라 import 다 — 새 파일도 · 지운 파일은 안 건다 · 시험 파일은 안 건다', () => {
    const fake = (source: string | null) => () => source;
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import { supabaseOnServer } from '../auth/server-client';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import type { SupabaseClient } from '@supabase/supabase-js';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("import 'server-only';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/new-door.ts'], stage: '운영 베타', sourceOf: fake("export { x } from '../../keyed-client';") }).tier).toBe('full');
    expect(planFor({ files: ['app/me/pure.ts'], stage: '운영 베타', sourceOf: fake("import { chartOf } from '@/src/lib/input/chart';") }).tier).toBe('core');
    expect(planFor({ files: ['app/me/gone.ts'], stage: '운영 베타', sourceOf: fake(null) }).tier).toBe('core');
    expect(planFor({ files: ['app/me/door.test.ts'], stage: '운영 베타', sourceOf: fake("import 'server-only';") }).tier).toBe('core');
    // app/ 밖은 내용으로 안 가른다 — src/lib 는 전처럼 core(ADR 0119 「안 고른 것」)
    expect(planFor({ files: ['src/lib/db/x.ts'], stage: '운영 베타', sourceOf: fake("import '@supabase/ssr';") }).tier).toBe('core');
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
    expect(pairs.map(([key]) => key).sort()).toEqual([...lanes, 'authed_lanes'].sort());
  });

  it('차선마다 같은 이름의 job 이 있고 그 job 은 제 출력 하나로만 켜진다', () => {
    for (const lane of lanes) {
      const job = jobs.get(lane);
      expect(job, lane).toBeDefined();
      expect(job, lane).toMatch(/^ {4}needs: plan$/m);
      expect(job, lane).toMatch(new RegExp(`^ {4}if: needs\\.plan\\.outputs\\.${lane} == 'true'$`, 'm'));
    }
    const read = [...yml.matchAll(/needs\.plan\.outputs\.([\w-]+)/g)].map((one) => one[1]);
    expect(read.filter((name) => !lanes.includes(name) && name !== 'authed_lanes')).toEqual([]);
  });

  /**
   * 로그인 차선은 계획이 고른다(2026-10-01). 목록을 워크플로에 다시 적으면 두 자리가 되고, 계획이 고른 차선과 실제로
   * 도는 차선이 갈린다. 원소는 문자열이어야 한다 — 실패한 차선의 artifact 이름이 `matrix.lane` 을 읽는다(#397)
   */
  it('authed job 의 matrix 는 계획의 authed_lanes 를 그대로 받고, 차선마다 test:e2e 스크립트가 있다', () => {
    const authed = jobs.get('authed') ?? '';
    expect(authed).toMatch(/^ {8}lane: \$\{\{ fromJSON\(needs\.plan\.outputs\.authed_lanes\) \}\}$/m);
    expect(authed).toContain('npm run test:e2e:${{ matrix.lane }}');
    expect(authed).toContain('LANE: ${{ matrix.lane }}');
    expect(yml).not.toMatch(/'signed-in:desktop'/);
    const scripts = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).scripts;
    for (const lane of AUTHED_LANES) {
      expect(typeof lane, lane).toBe('string');
      expect(scripts[`test:e2e:${lane}`], lane).toBeDefined();
    }
  });

  it('익명 e2e 가 붉으면 올리는 artifact 는 차선 이름을 딴다', () => {
    expect(jobs.get('anon')).toContain('name: anon-test-results');
    expect(yml).not.toContain('verify-test-results');
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
    const plan = pr(['docs/adr/0082-x.md', 'GLOSSARY.md', 'docs/prd.md']);

    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual({ policy: true, core: false, anon: false, authed: false, flow: false, audit: false });
  });

  it('도구 설정 · 이슈와 PR 틀 · scripts 의 시험 파일도 정책이다 (#141 은 설정 하나로 전부를 돌았다)', () => {
    for (const file of [
      '.claude/settings.json',
      '.github/ISSUE_TEMPLATE/ready-for-agent.md',
      '.github/pull_request_template.md',
      'scripts/code-rules.test.ts',
    ]) {
      expect(pr(['docs/agents/delegation/permissions.md', file]).tier, file).toBe('policy');
    }
  });

  it('scripts 의 시험이 아닌 파일과 더 깊은 자리의 시험은 정책이 아니다', () => {
    for (const file of ['scripts/ci-plan.mjs', 'scripts/checks.mjs', 'scripts/nested/x.test.ts', 'src/lib/chat/index.test.ts']) {
      expect(pr([file]).tier, file).toBe('full');
    }
  });

  it('어느 단계든 scripts 시험은 돈다 — policy 가 꺼진 단계는 core 의 npm test 가 돈다', () => {
    for (const files of [['docs/prd.md'], ['src/lib/saju/strength/index.ts'], ['app/page.tsx']]) {
      const { lanes } = pr(files);
      expect(lanes.policy || lanes.core, files[0]).toBe(true);
    }
  });

  it('엔진과 그것을 그리는 칸만 바뀌면 core 와 익명 e2e 만 돈다', () => {
    const plan = pr(['src/lib/saju/strength/index.ts', 'app/saju/fortune.tsx', 'docs/prd.md']);

    expect(plan.tier).toBe('engine');
    expect(plan.lanes).toEqual({ policy: false, core: true, anon: true, authed: false, flow: false, audit: false });
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
      expect(plan.lanes, stranger).toEqual({ ...FULL, audit: stranger === 'package.json' });
      expect(plan.authedLanes, stranger).toEqual(AUTHED_LANES);
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

  it('일정 · 손으로 켠 실행은 계획을 안 보고, main 푸시도 범위를 못 받으면 전부다', () => {
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

/**
 * 운영 베타의 PR 은 **그 주소에 실제로 닿는 차선만** 돈다(2026-10-01, ADR 0097 · 0119 추기). 여기서 재는 것은 좁혀지는
 * 값만이 아니라, 좁혀서는 안 되는 자리 — 공용 위험 · 모르는 파일 · 차선을 못 찾는 spec — 가 여전히 전부로 가는가다.
 */
describe('CI 계획 — 그 주소에 실제로 닿는 차선만 (2026-10-01)', () => {
  const SIGNED_IN = ['signed-in:desktop', 'signed-in:mobile'];
  const narrow = (authedLanes: string[], rest: Partial<typeof FULL> = {}) => ({
    lanes: { ...CORE_ONLY, authed: authedLanes.length > 0, ...rest },
    authedLanes,
  });
  const lanesOf = (files: string[]) => {
    const plan = beta(files);
    return { lanes: plan.lanes, authedLanes: plan.authedLanes };
  };

  it('/me/readings/compat 의 화면은 signed-in 둘만 — 익명 · 흐름 · 나머지 로그인 차선은 건너뛴다', () => {
    expect(lanesOf(['app/me/(shelf)/readings/compat/page.tsx'])).toEqual(narrow(SIGNED_IN));
  });

  it('/me/people 의 화면은 익명(auth.spec 이 요청한다) · signed-in 둘 · match 둘 · 흐름 — chat · notice 는 없다', () => {
    expect(addressesOf(readFileSync(resolve(ROOT, 'e2e/auth.spec.ts'), 'utf8'))).toContain('/me/people');
    expect(lanesOf(['app/me/people/page.tsx'])).toEqual(
      narrow([...SIGNED_IN, 'match:desktop', 'match:mobile'], { anon: true, flow: true }),
    );
  });

  it('spec 만 바뀌면 그 spec 의 차선만 — #392 모양(컴포넌트 · spec · 간극 대장)도', () => {
    expect(lanesOf(['e2e/signed-in.spec.ts'])).toEqual(narrow(SIGNED_IN));
    expect(lanesOf(['app/me/people/manage.tsx', 'e2e/signed-in.spec.ts', 'docs/product/gaps.md'])).toEqual(narrow(SIGNED_IN));
    expect(lanesOf(['e2e/chat.spec.ts'])).toEqual(narrow(['chat:desktop', 'chat:mobile']));
    expect(lanesOf(['e2e/notice.spec.ts'])).toEqual(narrow(['notice']));
    expect(lanesOf(['e2e/saju.spec.ts'])).toEqual(narrow([], { anon: true }));
    expect(lanesOf(['app/icon.svg'])).toEqual(narrow([], { anon: true }));
  });

  it('주석에만 적힌 주소는 그 시험을 부르지 않는다 — saju.spec 의 주석이 /me/reading/inspect 를 적는다', () => {
    expect(readFileSync(resolve(ROOT, 'e2e/saju.spec.ts'), 'utf8')).toContain('`/me/reading/inspect`');
    expect(lanesOf(['app/me/reading/inspect/page.tsx'])).toEqual(narrow(SIGNED_IN, { flow: true }));
  });

  it('전부일 때 core · anon · authed 일곱 · flow 가 모두 선다 — 라벨 · push · 일정 · 손으로 켠 실행', () => {
    const everything = { lanes: { ...FULL, audit: true }, authedLanes: AUTHED_LANES };
    const labelled = beta(['app/me/(shelf)/readings/compat/page.tsx'], [FULL_LABEL]);
    expect({ lanes: labelled.lanes, authedLanes: labelled.authedLanes }).toEqual(everything);
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      const plan = planFor({ files: [], event });
      expect({ lanes: plan.lanes, authedLanes: plan.authedLanes }, event).toEqual(everything);
    }
  });

  /** 갈래마다 대표 — 갈래를 더하면 여기에도 더한다(마지막 줄이 짝을 견준다) */
  const RISK_SAMPLES: Record<string, string[]> = {
    DB: ['supabase/migrations/20261001000000_x.sql'],
    'Next 공용 경계': [
      'app/global-error.tsx',
      'app/global-not-found.tsx',
      'app/me/forbidden.tsx',
      'app/unauthorized.tsx',
      'instrumentation.ts',
      'instrumentation-client.ts',
      'middleware.ts',
    ],
    관문: ['proxy.ts', 'src/lib/consent/gate.ts'],
    인증: ['app/auth/signed-in.ts'],
    layout: ['app/layout.tsx', 'app/me/(shelf)/readings/layout.tsx'],
    'route.ts': ['app/me/photo/[userId]/route.ts'],
    '서버 액션': ['app/me/discovery/actions.ts', ...SERVER_ACTIONS_ELSEWHERE],
    'e2e 기반': ['e2e/session.ts', 'e2e/fixtures/x.json'],
    '시험 도구': [...HARNESS, 'scripts/run-checks.mjs', 'scripts/some-new-helper.mjs'],
  };

  it('공용 위험은 갈래마다 전부다 — 까닭에 갈래 이름이 실린다', () => {
    for (const [branch, files] of Object.entries(RISK_SAMPLES)) {
      for (const file of files) {
        const plan = beta([file]);
        expect(plan.lanes, file).toEqual(FULL);
        expect(plan.cause, file).toBe(branch);
        // 좁혀질 화면과 섞여도 공용 위험이 먼저다
        expect(beta(['app/me/(shelf)/readings/compat/page.tsx', file]).cause, file).toBe(branch);
      }
    }
    expect(Object.keys(RISK_SAMPLES).sort()).toEqual(SHARED_RISK.map(([name]) => name).sort());
  });

  it('모르는 새 파일은 베타에서도 전부다 — 알려진 core 자리는 자리로 적는다', () => {
    for (const file of ['newdir/thing.sh', 'Dockerfile', 'tools/x.mjs', 'e2e2/x.ts']) {
      expect(beta([file]).lanes, file).toEqual(FULL);
      expect(beta([file]).cause, file).toBe('미분류');
    }
    for (const file of ['src/lib/matching/pool.ts', 'app/ui/skeleton.tsx', 'scripts/ci-plan.mjs', '.github/workflows/verify.yml', 'public/brand/x.jpg', ...ROOT_CONFIGS]) {
      expect(beta([file]).tier, file).toBe('core');
    }
    // 이름으로 견주는 목록이다 — 지운 이름은 아무것도 안 건다
    expect(ROOT_CONFIGS.filter((file) => !existsSync(resolve(ROOT, file)))).toEqual([]);
  });

  it('입구인데 주소를 못 뽑거나 닿는 시험이 없으면 전부다', () => {
    expect(beta(['app/me/candidates.ts']).cause).toBe('주소 없음');
    expect(beta(['app/me/nowhere-yet/page.tsx']).cause).toBe('닿는 시험 없음');
  });

  it('불변식 — authed 는 authedLanes 가 비지 않았는가이고, 정책 밖의 계획에는 core 가 선다', () => {
    const files = [
      ...filesUnder(resolve(ROOT, 'app')),
      ...filesUnder(resolve(ROOT, 'e2e')),
      ...filesUnder(resolve(ROOT, 'scripts')),
      ...filesUnder(resolve(ROOT, 'src/lib/consent')),
    ].map((file) => relative(ROOT, file));
    expect(files.length).toBeGreaterThan(300);
    for (const file of files) {
      const plan = beta([file]);
      expect(plan.lanes.authed, file).toBe(plan.authedLanes.length > 0);
      expect(plan.authedLanes.every((lane) => AUTHED_LANES.includes(lane)), file).toBe(true);
      if (plan.tier !== 'policy') expect(plan.lanes.core, file).toBe(true);
    }
  });

  it('차선 스크립트가 부르는 spec 은 모두 AUTHED · NOTICE 무늬에 들고, 차선마다 하나 이상 부른다', () => {
    const login = loginSpecs();
    for (const lane of AUTHED_LANES) {
      const specs = specsOfLane(lane);
      expect(specs.length, lane).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(login, `${lane} → ${spec}`).toContain(spec);
        expect(existsSync(resolve(ROOT, spec)), spec).toBe(true);
        expect(lanesOfTest(spec), spec).toContain(lane);
      }
    }
    // 무늬에 든 spec 은 어느 차선이든 부른다 — 아니면 그 spec 의 변경을 어디서도 안 잰다
    for (const spec of login) expect(AUTHED_LANES.some((lane) => specsOfLane(lane).includes(spec)), spec).toBe(true);
    expect(lanesOfTest('e2e/auth.spec.ts')).toEqual(['anon']);
    expect(lanesOfTest('scripts/check-chat.mjs')).toEqual(['flow']);
  });

  /**
   * **로그인 손잡이를 부르는 spec 은 로그인 무늬에 든다**(2026-10-08). 무늬(`playwright.config.ts` 의 `AUTHED` · `NOTICE`)에 없는
   * spec 은 로그인 없는 프로젝트(`desktop-chromium` · `mobile-chromium`)가 집어 세션 없이 돌고, 로그인 차선은 그 파일을 모른다 —
   * #537 은 새 spec 파일 대신 `signed-in.spec.ts` 에 시험을 넣어야 했다. 거꾸로 무늬에 든 spec 은 세션을 쓴다.
   */
  it('e2e/session.ts 를 부르는 spec 은 AUTHED · NOTICE 무늬에 들고, 무늬의 spec 은 그것을 부른다', () => {
    const login = loginSpecs();
    const specs = readdirSync(resolve(ROOT, 'e2e'))
      .filter((name) => name.endsWith('.spec.ts'))
      .map((name) => `e2e/${name}`);
    const usesSession = (spec: string) => /from '\.\/session'/.test(readFileSync(resolve(ROOT, spec), 'utf8'));
    expect(specs.length).toBeGreaterThan(5);
    expect(specs.filter((spec) => usesSession(spec) && !login.includes(spec))).toEqual([]);
    expect(login.filter((spec) => !usesSession(spec))).toEqual([]);
  });

  it('주소의 무늬 — route group · slot 은 걷고, [x] 는 한 마디, page 밖은 그 아래 전부', () => {
    const route = (file: string) => routeOf(file) ?? /$^/;
    expect(route('app/me/(shelf)/readings/compat/page.tsx').test('/me/readings/compat')).toBe(true);
    expect(route('app/me/(shelf)/readings/compat/page.tsx').test('/me/readings/compat/x')).toBe(false);
    expect(route('app/me/people/[personId]/page.tsx').test('/me/people/x')).toBe(true);
    expect(route('app/me/people/[personId]/page.tsx').test('/me/people')).toBe(false);
    expect(route('app/me/@modal/x/page.tsx').test('/me/x')).toBe(true);
    expect(route('app/docs/[...slug]/page.tsx').test('/docs/a/b')).toBe(true);
    expect(route('app/docs/[...slug]/page.tsx').test('/docs')).toBe(false);
    expect(route('app/docs/[[...slug]]/page.tsx').test('/docs')).toBe(true);
    expect(route('app/me/(home)/loading.tsx').test('/me/chat/x')).toBe(true);
    expect(route('app/me/(home)/loading.tsx').test('/meet')).toBe(false);
    expect(route('app/not-found.tsx').test('/anything/at/all')).toBe(true);
    expect(route('app/page.tsx').test('/')).toBe(true);
    expect(route('app/page.tsx').test('/me')).toBe(false);
    expect(routeOf('app/me/layout.tsx')).toBeNull();
    expect(routeOf('app/me/candidates.ts')).toBeNull();
  });

  it('시험이 요청하는 주소 — 주석 줄은 빼고, ${…} 는 한 마디, %2F 는 풀고, ? · # 뒤는 버린다', () => {
    const source = [
      "await page.goto('/me/people');",
      'await page.goto(`/me/chat/${matchId}?tab=1`);',
      "expect(location).toBe('/auth?next=%2Fme%2Freadings#top');",
      "// await page.goto('/commented/out');",
      ' * `/also/commented` 는 문서다',
      '/* `/block/comment` */',
    ].join('\n');
    const found = addressesOf(source);
    expect(found).toEqual(expect.arrayContaining(['/me/people', '/me/chat/x', '/auth', '/me/readings']));
    expect(found.filter((one) => /comment/.test(one))).toEqual([]);
  });

  it('공개 출시면 좁히지 않는다 — 화면 하나도 전부다', () => {
    const plan = pr(['app/me/(shelf)/readings/compat/page.tsx']);
    expect(plan.tier).toBe('full');
    expect(plan.authedLanes).toEqual(AUTHED_LANES);
  });

  it('요약은 고른 로그인 차선을 적는다', () => {
    const files = ['app/me/(shelf)/readings/compat/page.tsx'];
    const text = summaryOf(beta(files), files);
    expect(text).toContain('`signed-in:desktop` · `signed-in:mobile`');
    expect(text).toContain('| `anon` | 건너뛴다 |');
  });
});

/**
 * 주석만 바뀐 코드 파일은 정책으로 센다(ADR 0153). 여기서 재는 것은 좁혀지는 값보다 **코드 변경이 주석으로 새지 않는가**다 —
 * 주석으로 잘못 세면 코드 변경이 `policy` 만 돌고 머지된다. 판정은 파서(`typescript`)의 구문 나무다.
 */
describe('CI 계획 — 주석만 바뀐 코드 파일은 정책이다 (ADR 0153)', () => {
  /** 한 파일을 `before` → `after` 로 바꾼 PR 의 계획 — `others` 는 base 쪽이 없는(새) 파일로 함께 바뀐다 */
  const planOf = (file: string, before: string, after: string, others: string[] = [], stage = '운영 베타') =>
    planFor({
      files: [file, ...others],
      stage,
      ts,
      sourceOf: (one) => (one === file ? after : null),
      baseSourceOf: (one) => (one === file ? before : null),
    });
  const changes = (before: string, after: string, file = 'app/layout.tsx') => onlyCommentsChanged(ts, file, before, after);

  const LAYOUT = [
    "import type { Metadata } from 'next';",
    '',
    '/**',
    ' * **미리보기는 앱 전체의 것이다.**',
    ' *',
    ' * 「이거 한번 써 봐」 하고 `saju-snowy.vercel.app` 만 보내는 사람 — 에게는 대화창에',
    ' * **파란 주소 한 줄**만 선다.',
    ' */',
    'export const metadata: Metadata = {',
    '  // 미리보기 그림 — 앱 전체',
    "  title: '만날지도',",
    '};',
    '',
    'export default function RootLayout({ children }: { children: React.ReactNode }) {',
    '  return (',
    '    <html lang="ko">',
    '      {/* 머리 */}',
    '      <body>{children}</body>',
    '    </html>',
    '  );',
    '}',
    '',
  ].join('\n');
  const edit = (from: string, to: string, source = LAYOUT) => {
    expect(source).toContain(from);
    return source.replace(from, to);
  };
  const URL_FIX = ['`saju-snowy.vercel.app`', '`mannalmap.com`'] as const;

  it('#519 — layout.tsx 의 블록 주석 한 줄만 바뀌면 공용 위험이 아니라 policy 다', () => {
    const plan = planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['docs/ops/runbook/deploy.md']);
    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual({ ...CORE_ONLY, core: false, policy: true });
    expect(plan.reason).toContain('`app/layout.tsx`');
  });

  it('공개 출시에서도 주석만 바뀐 파일은 정책으로 센다', () => {
    expect(planOf('src/lib/chat/index.ts', '// 옛 말\nexport const x = 1;\n', '// 새 말\nexport const x = 1;\n', [], '공개 출시').tier).toBe('policy');
  });

  it('주석이 아닌 토큰이 하나라도 바뀌면 지금 규칙 그대로다 — layout 은 전부', () => {
    const plan = planOf('app/layout.tsx', LAYOUT, edit("title: '만날지도'", "title: '만날 지도'"));
    expect(plan.tier).toBe('full');
    expect(plan.cause).toBe('layout');
    expect(planOf('app/layout.tsx', LAYOUT, edit('  // 미리보기 그림 — 앱 전체', '  // 미리보기 그림\n  description: "x",')).tier).toBe('full');
  });

  it('다른 파일이 함께 바뀌면 그 파일의 규칙을 탄다 — 주석만 바뀐 파일만 빠진다', () => {
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['src/lib/chat/index.ts']).tier).toBe('core');
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['proxy.ts']).tier).toBe('full');
  });

  it('주석을 더하고 지우고 빈 줄 · 들여쓰기를 바꾼 것은 주석만이다 — JSX 주석 안도', () => {
    expect(changes(LAYOUT, edit('  // 미리보기 그림 — 앱 전체\n', ''))).toBe(true);
    expect(changes(LAYOUT, edit(' * **파란 주소 한 줄**만 선다.\n', ' * **파란 주소 한 줄**만 선다.\n *\n * 한 줄 더.\n'))).toBe(true);
    expect(changes(LAYOUT, edit("import type { Metadata } from 'next';\n\n", "import type { Metadata } from 'next';\n\n\n"))).toBe(true);
    expect(changes(LAYOUT, edit("  title: '만날지도',", "    title: '만날지도', // 이름"))).toBe(true);
    expect(changes(LAYOUT, edit('{/* 머리 */}', '{/* 머리 — 앱 전체 */}'))).toBe(true);
  });

  it('주석을 코드로 · 코드를 주석으로 바꾸면 주석만이 아니다', () => {
    expect(changes(LAYOUT, edit("  // 미리보기 그림 — 앱 전체\n  title: '만날지도',\n", "  // title: '만날지도',\n"))).toBe(false);
    expect(changes(LAYOUT, edit('  // 미리보기 그림 — 앱 전체', "  description: '앱 전체',"))).toBe(false);
    // 블록을 열어 코드를 감싼다
    expect(changes(LAYOUT, edit("  title: '만날지도',", "  /* title: '만날지도', */"))).toBe(false);
  });

  it('문자열 · 템플릿 · JSX 글자 속의 // 와 * 는 주석이 아니다', () => {
    const url = "const site = 'https://mannalmap.com';\n";
    expect(changes(url, edit('mannalmap.com', 'example.com', url), 'app/site-url.ts')).toBe(false);
    const template = 'const sql = `\n  // 이건 값이다\n  * 이것도\n`;\n';
    expect(changes(template, edit('// 이건 값이다', '// 이건 바뀐 값이다', template), 'app/sql.ts')).toBe(false);
    expect(changes(template, edit('  * 이것도\n', '  * 이것도\n\n', template), 'app/sql.ts')).toBe(false);
    const jsx = 'export const A = () => (\n  <p>\n    // 화면에 보이는 글\n  </p>\n);\n';
    expect(changes(jsx, edit('// 화면에 보이는 글', '// 화면에 보이는 새 글', jsx), 'app/a.tsx')).toBe(false);
  });

  it('토큰은 같아도 줄바꿈이 자동 세미콜론으로 뜻을 바꾸면 주석만이 아니다', () => {
    // `return x` → `return` 뒤 줄바꿈: 값을 돌려주던 것이 undefined 를 돌려준다
    const returns = 'export function f(x: number) {\n  return x; // 값\n}\n';
    expect(changes(returns, edit('return x; // 값', 'return // 값\n  x;', returns), 'app/f.ts')).toBe(false);
    // `a;\n(b)` → `a\n(b)`: 두 문이 호출 하나가 된다
    const call = 'const a = f;\nconst b = 1;\na;\n(b);\n';
    expect(changes(call, edit('a;\n(b);', 'a\n(b);', call), 'app/call.ts')).toBe(false);
    // 같은 자리의 줄바꿈이어도 뜻이 같으면 주석만이다
    expect(changes(call, edit('a;\n(b);', 'a; // 이음\n(b);', call), 'app/call.ts')).toBe(true);
  });

  it('곱셈의 이음 줄 · 정규식 속의 /* 는 코드다', () => {
    const product = 'const area = width\n  * height;\n';
    expect(changes(product, edit('  * height;', '  * depth;', product), 'app/area.ts')).toBe(false);
    const regex = "const slash = /\\/*$/;\n// 꼬리\n";
    expect(changes(regex, edit('/\\/*$/', '/\\/+$/', regex), 'app/slash.ts')).toBe(false);
    expect(changes(regex, edit('// 꼬리', '// 꼬리 고침', regex), 'app/slash.ts')).toBe(true);
  });

  it("'use client' · 'use server' 는 문자열 토큰이라 더하고 빼면 주석만이 아니다", () => {
    const body = '// 단추\nexport const x = 1;\n';
    expect(changes(body, `'use client';\n${body}`, 'app/button.tsx')).toBe(false);
    expect(changes(`'use server';\n${body}`, body, 'app/actions-x.ts')).toBe(false);
  });

  it('뜻이 있는 주석이 더해지거나 지워지거나 다른 노드로 옮으면 주석만이 아니다', () => {
    const base = 'const a = 1;\nconst b: number = a;\n';
    for (const directive of [
      '// @ts-expect-error 옛 타입',
      '// @ts-ignore',
      '// @ts-nocheck',
      '/* eslint-enable no-console */',
      '/* global window */',
      '/// <reference types="next" />',
      '/** @jsxImportSource preact */',
      '/* webpackChunkName: "x" */',
      '// istanbul ignore next',
      '// prettier-ignore',
    ]) {
      const added = edit('const b', `${directive}\nconst b`, base);
      expect(changes(base, added, 'app/x.ts'), `+ ${directive}`).toBe(false);
      expect(changes(added, base, 'app/x.ts'), `- ${directive}`).toBe(false);
    }
    const moved = '// @ts-expect-error 옛 타입\nconst a = 1;\nconst b = a;\n';
    expect(changes(moved, edit('// @ts-expect-error 옛 타입\nconst a = 1;\n', 'const a = 1;\n// @ts-expect-error 옛 타입\n', moved), 'app/x.ts')).toBe(false);
    // 지시 곁의 산문만 바뀌면 주석만이다 — 지시 줄은 그대로다
    expect(changes(`// 까닭\n${moved}`, `// 까닭 고침\n${moved}`, 'app/x.ts')).toBe(true);
  });

  it('파싱 실패 · 가르지 않는 확장자 · 한쪽이 없음(추가 · 삭제 · 이름 바꿈) · 파서 없음은 지금 규칙 그대로다', () => {
    expect(changes('const a = (;\n// a\n', 'const a = (;\n// b\n', 'app/broken.ts')).toBe(false);
    expect(onlyCommentsChanged(ts, 'supabase/migrations/1_x.sql', '-- a\nselect 1;\n', '-- b\nselect 1;\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'docs/x.md', 'a\n', 'b\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'app/new.ts', null, '// 새 파일\n')).toBe(false);
    expect(onlyCommentsChanged(ts, 'app/gone.ts', '// 지운 파일\n', null)).toBe(false);
    expect(onlyCommentsChanged(null, 'app/layout.tsx', LAYOUT, edit(...URL_FIX))).toBe(false);
    // 새 파일 · 지운 파일만 있는 PR 은 지금 규칙 그대로
    expect(planOf('app/layout.tsx', LAYOUT, edit(...URL_FIX), ['app/me/layout.tsx']).tier).toBe('full');
    // supabase/ 는 주석을 가르기 전에 전부다
    expect(planOf('supabase/functions/x.ts', '// a\nexport {};\n', '// b\nexport {};\n').tier).toBe('full');
  });

  it('base 를 못 읽거나 파서를 안 받으면 지금 규칙 그대로다', () => {
    const after = edit(...URL_FIX);
    expect(planFor({ files: ['app/layout.tsx'], stage: '운영 베타', sourceOf: () => after }).tier).toBe('full');
    expect(planFor({ files: ['app/layout.tsx'], stage: '운영 베타', ts, sourceOf: () => after, baseSourceOf: () => null }).tier).toBe('full');
    expect(planFor({ files: ['app/layout.tsx'], stage: '운영 베타', sourceOf: () => after, baseSourceOf: () => LAYOUT }).tier).toBe('full');
  });

  it('일정 · 손으로 켠 실행 · 범위 없는 main 푸시는 주석만 바뀌어도 전부다', () => {
    const after = edit(...URL_FIX);
    for (const event of ['push', 'schedule', 'workflow_dispatch']) {
      const plan = planFor({ files: ['app/layout.tsx'], event, stage: '운영 베타', ts, sourceOf: () => after, baseSourceOf: () => LAYOUT });
      expect(plan.tier, event).toBe('full');
    }
  });

  it('JSDoc 은 토큰이 아니다 — 저장소의 큰 머리 주석도 그대로 읽힌다', () => {
    const source = readFileSync(resolve(ROOT, 'scripts/ci-plan.mjs'), 'utf8');
    const tokens = syntaxOf(ts, 'scripts/ci-plan.mjs', source);
    expect(tokens).not.toBeNull();
    expect(tokens?.tokens.some((one) => one.includes('주석만 바뀐 코드 파일은 정책으로 센다'))).toBe(false);
    expect(changes(source, source.replace('세 단계뿐이다', '세 단계뿐이다 (고침)'), 'scripts/ci-plan.mjs')).toBe(true);
  });

  it('verify.yml 의 계획 단계는 PR · main 푸시에서 파서를 깔고 merge-base 를 --base 로 넘긴다 — 못 구하면 빈 값이다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const plan = /\n {2}plan:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    expect(plan).toMatch(/- if: github\.event_name == 'pull_request' \|\| github\.event_name == 'push'\n\s+continue-on-error: true\n\s+run: npm ci --ignore-scripts/);
    expect(plan).toContain('base=$(git merge-base "origin/$BASE" HEAD) || base=""');
    expect(plan).toMatch(/node scripts\/ci-plan\.mjs [^\n]*--base "\$base"/);
  });
});

describe('CI 계획 — 문서만 바뀐 main 푸시는 policy 만 (ADR 0154)', () => {
  const BEFORE = 'c'.repeat(40);
  const GREEN = { before: BEFORE, forced: false, beforeGreen: true };
  const push = (files: string[], pushed: Parameters<typeof planFor>[0]['pushed'] = GREEN) => planFor({ files, event: 'push', pushed });
  const POLICY_ONLY = { ...CORE_ONLY, core: false, policy: true };

  it('범위 전체가 정책이면 policy 만 — 여러 PR 이 한 푸시에 들어도 범위 전체로 가르고, audit 도 건너뛴다', () => {
    const plan = push(['docs/adr/0154-x.md', 'GLOSSARY.md', '.claude/settings.json', 'scripts/ci-plan.test.ts', 'docs/product/gaps.md']);
    expect(plan.tier).toBe('policy');
    expect(plan.lanes).toEqual(POLICY_ONLY);
    expect(plan.authedLanes).toEqual([]);
    expect(plan.reason).toContain(BEFORE.slice(0, 7));
  });

  it('범위에 정책 밖 파일이 하나라도 있으면 전부다 — 문서 PR 과 코드 PR 이 한 푸시에 들어도', () => {
    for (const code of ['src/lib/chat/index.ts', 'app/me/(shelf)/readings/compat/page.tsx', 'scripts/ci-plan.mjs', 'package.json', 'newdir/thing.sh']) {
      const plan = push(['docs/prd.md', code]);
      expect(plan.tier, code).toBe('full');
      expect(plan.cause, code).toBe('main 푸시');
      expect(plan.lanes, code).toEqual({ ...FULL, audit: true });
      expect(plan.authedLanes, code).toEqual(AUTHED_LANES);
    }
    expect(push(['docs/prd.md', 'supabase/migrations/20261008000000_x.sql']).cause).toBe('DB');
  });

  it('주석만 바뀐 코드 파일은 푸시 전 SHA 의 소스와 견줘 정책으로 센다 — 토큰이 바뀌면 전부', () => {
    const before = '// 옛 말\nexport const x = 1;\n';
    const pushOf = (after: string) =>
      planFor({ files: ['app/layout.tsx', 'docs/prd.md'], event: 'push', pushed: GREEN, ts, sourceOf: () => after, baseSourceOf: () => before });
    expect(pushOf('// 새 말\nexport const x = 1;\n').tier).toBe('policy');
    expect(pushOf('// 새 말\nexport const x = 1;\n').reason).toContain('주석만 바뀐 코드 파일은 정책으로 셌다: `app/layout.tsx`');
    expect(pushOf('// 옛 말\nexport const x = 2;\n').tier).toBe('full');
    // 파서가 없으면 지금 규칙 그대로 — 코드 파일이라 전부
    expect(planFor({ files: ['app/layout.tsx'], event: 'push', pushed: GREEN, sourceOf: () => '// 새\n', baseSourceOf: () => '// 옛\n' }).tier).toBe('full');
  });

  it('닫히는 쪽 — 범위 없음 · 0 SHA · 강제 갱신 · 빈 diff 는 전부다', () => {
    const docs = ['docs/prd.md'];
    expect(push(docs, null).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, before: null }).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, before: '0'.repeat(40) }).cause).toBe('범위 모름');
    expect(push(docs, { ...GREEN, forced: true }).cause).toBe('강제 갱신');
    expect(push([]).cause).toBe('빈 diff');
    expect(push(['', ' ']).cause).toBe('빈 diff');
    for (const pushed of [null, { ...GREEN, forced: true }]) expect(push(docs, pushed).lanes.audit).toBe(true);
  });

  it('앞 커밋의 verify 가 초록으로 끝나지 않았으면(끊김 · 붉음 · 못 읽음) 정책만이어도 전부다 — 끊긴 코드 커밋이 안 재어진 채 남지 않게', () => {
    for (const beforeGreen of [false, null]) {
      const plan = push(['docs/prd.md'], { ...GREEN, beforeGreen });
      expect(plan.tier, String(beforeGreen)).toBe('full');
      expect(plan.cause, String(beforeGreen)).toBe('앞 커밋 미검증');
      expect(plan.lanes.audit).toBe(true);
    }
  });

  it('앞 커밋의 초록 — main 의 실행 중 초록이 하나 이상이고 붉은 것이 없다. 끊긴 것 · 도는 것은 안 세고, PR 실행은 안 본다', () => {
    expect(settledGreen([{ event: 'push', conclusion: 'success' }])).toBe(true);
    expect(settledGreen([{ event: 'push', conclusion: 'cancelled' }, { event: 'schedule', conclusion: 'success' }])).toBe(true);
    expect(settledGreen([{ event: 'push', conclusion: 'success' }, { event: 'schedule', conclusion: null }])).toBe(true);
    expect(settledGreen([])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: 'cancelled' }])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: null }])).toBe(false);
    expect(settledGreen([{ event: 'push', conclusion: 'success' }, { event: 'schedule', conclusion: 'failure' }])).toBe(false);
    for (const red of ['failure', 'timed_out', 'startup_failure', 'action_required']) {
      expect(settledGreen([{ event: 'push', conclusion: red }]), red).toBe(false);
    }
    expect(settledGreen([{ event: 'pull_request', conclusion: 'success' }])).toBe(false);
  });

  it('일정 · 손으로 켠 실행은 범위를 받아도 전부다', () => {
    for (const event of ['schedule', 'workflow_dispatch']) {
      expect(planFor({ files: ['docs/prd.md'], event, pushed: GREEN }).tier, event).toBe('full');
    }
  });

  it('verify.yml — main 푸시는 푸시 전 SHA 부터의 diff 와 base · 범위를 넘기고, 계획 job 은 실행을 읽기만 한다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const plan = /\n {2}plan:\n([\s\S]*?)\n {2}[a-z]+:\n/.exec(yml)?.[1] ?? '';
    expect(plan).toContain('BEFORE: ${{ github.event.before }}');
    expect(plan).toContain('FORCED: ${{ github.event.forced }}');
    expect(plan).toContain('GH_TOKEN: ${{ github.token }}');
    expect(plan).toContain('files=$(git diff --name-only --no-renames "$BEFORE" HEAD) || files=""');
    expect(plan).toContain('base="$BEFORE"');
    expect(plan).toMatch(/node scripts\/ci-plan\.mjs [^\n]*--before "\$BEFORE" --forced "\$FORCED"/);
    expect(plan).toMatch(/permissions:\n\s+contents: read\n\s+actions: read\n/);
  });
});

describe('CI 계획 — 문구만 바뀐 파일은 core 에 옛 글자를 찾는 시험의 차선만 더한다 (ADR 0159)', () => {
  /** 한 파일을 `before` → `after` 로 바꾼 PR 의 계획 — `others` 는 base 쪽이 없는(새) 파일로 함께 바뀐다 */
  const planOf = (file: string, before: string, after: string, others: string[] = [], stage = '운영 베타') =>
    planFor({
      files: [file, ...others],
      stage,
      ts,
      sourceOf: (one) => (one === file ? after : null),
      baseSourceOf: (one) => (one === file ? before : null),
    });
  const copyOf = (before: string, after: string, file = 'app/me/matching/request-card.tsx') => copyOnlyChanged(ts, file, before, after);

  /** 입구가 아닌 화면 — 문구가 아닌 것이 바뀌어도 지금 규칙으로 core 이므로, 갈림은 `copyOnlyChanged` 로 잰다 */
  const CARD = [
    "'use client';",
    '',
    "import { REQUEST_OPENS_CHAT_NOTE } from '@/src/lib/matching/copy';",
    '',
    "const LABEL = '요청 보내기';",
    '',
    'export function RequestCard({ open, ready, onSend }: { open: boolean; ready: boolean; onSend: () => void }) {',
    '  return (',
    '    <div className="mt-2 flex flex-col gap-2">',
    '      <p>',
    '        요청을 보내면 상대의 인연 탭에',
    '        하나가 뜹니다.',
    '      </p>',
    '      {open && <p>{REQUEST_OPENS_CHAT_NOTE}</p>}',
    '      <p>{ready ? `${LABEL} 준비됨` : `준비 중`}</p>',
    '      <a href="/me/requests" aria-label="받은 요청 보기">받은 요청</a>',
    '      <button type="button" onClick={() => onSend()} data-testid="send">{LABEL}</button>',
    '      <select name="side"><option>요청자</option></select>',
    '    </div>',
    '  );',
    '}',
    '',
  ].join('\n');
  const edit = (from: string, to: string, source = CARD) => {
    expect(source).toContain(from);
    return source.replace(from, to);
  };

  it('JSX 글자(요소 사이의 글자)만 바뀌면 문구만이다 — 옛 글자는 공백을 접어 돌려준다', () => {
    expect(copyOf(CARD, edit('하나가 뜹니다.', '요청 하나가 뜹니다.'))).toEqual(['요청을 보내면 상대의 인연 탭에 하나가 뜹니다.']);
    expect(copyOf(CARD, edit('>받은 요청</a>', '>받은 요청 열기</a>'))).toEqual(['받은 요청']);
    // 주석과 함께 바뀌어도 문구만이다
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "// 단추 글자\nconst LABEL = '요청 보내기';", edit('요청을 보내면', '요청을 꼭 보내면')))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
    ]);
    // JSX 주석 `{/* */}` 을 새로 세우는 것은 식 자리 하나가 느는 것이라 구조다
    expect(copyOf(CARD, edit('      <p>\n        요청을', '      {/* 안내 */}\n      <p>\n        요청을 꼭'))).toBeNull();
  });

  it('JSX 속성 값은 문구가 아니다 — className · href · aria-label · data-* · type', () => {
    expect(copyOf(CARD, edit('flex flex-col gap-2', 'flex flex-col gap-3'))).toBeNull();
    expect(copyOf(CARD, edit('href="/me/requests"', 'href="/me/inbox"'))).toBeNull();
    expect(copyOf(CARD, edit('aria-label="받은 요청 보기"', 'aria-label="받은 요청 열기"'))).toBeNull();
    expect(copyOf(CARD, edit('data-testid="send"', 'data-testid="send-request"'))).toBeNull();
    expect(copyOf(CARD, edit('type="button"', 'type="submit"'))).toBeNull();
  });

  it('조건식 · 이벤트 핸들러 · 식별자 · 구조가 바뀌면 문구가 아니다', () => {
    expect(copyOf(CARD, edit('{open && <p>', '{!open && <p>'))).toBeNull();
    expect(copyOf(CARD, edit('{open && <p>', '{open || <p>'))).toBeNull();
    expect(copyOf(CARD, edit('{ready ? `${LABEL} 준비됨` : `준비 중`}', '{!ready ? `${LABEL} 준비됨` : `준비 중`}'))).toBeNull();
    expect(copyOf(CARD, edit('onClick={() => onSend()}', 'onClick={() => undefined}'))).toBeNull();
    expect(copyOf(CARD, edit('onClick=', 'onDoubleClick='))).toBeNull();
    expect(copyOf(CARD, edit('<p>{REQUEST_OPENS_CHAT_NOTE}</p>', '<span>{REQUEST_OPENS_CHAT_NOTE}</span>'))).toBeNull();
    // 새 줄(요소)을 더하는 것도 구조다 — #570 의 모양
    expect(copyOf(CARD, edit('      <a href', '      <p>새 줄</p>\n      <a href'))).toBeNull();
  });

  it('템플릿의 식 · 글자 조각 · 목록 밖 문자열 상수 · import 경로는 문구가 아니다', () => {
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL.trim()} 준비됨`'))).toBeNull();
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL} 준비 끝`'))).toBeNull();
    expect(copyOf(CARD, edit('`준비 중`', '`준비하는 중`'))).toBeNull();
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "const LABEL = '인연 요청 보내기';"))).toBeNull();
    expect(copyOf(CARD, edit("from '@/src/lib/matching/copy'", "from '@/src/lib/matching/words'"))).toBeNull();
    // 목록 밖 파일의 `export const` 문자열 — 경로 · 키일 수 있다
    expect(copyOnlyChanged(ts, 'src/lib/matching/paths.ts', "export const INBOX = '/me/requests';\n", "export const INBOX = '/me/inbox';\n")).toBeNull();
  });

  it('값이 곧 동작인 요소의 글자(option · textarea · style · script)는 문구가 아니다', () => {
    expect(copyOf(CARD, edit('<option>요청자</option>', '<option>보낸 사람</option>'))).toBeNull();
    const style = 'export const S = () => <style>body {"{"} color: red {"}"}</style>;\n';
    expect(copyOf(style, style.replace('color: red', 'color: blue'), 'app/s.tsx')).toBeNull();
  });

  it('문구와 동작이 한 파일에 섞이면 문구가 아니다', () => {
    const both = edit('flex flex-col gap-2', 'flex flex-col gap-3', edit('하나가 뜹니다.', '요청 하나가 뜹니다.'));
    expect(copyOf(CARD, both)).toBeNull();
  });

  it('판별이 불확실하면 문구로 세지 않는다 — 파싱 실패 · 한쪽 없음 · 파서 없음 · 앱 밖 · 시험 파일 · 글자째 같음 · 주석만', () => {
    expect(copyOf(`${CARD}\nconst broken = (;\n`, `${edit('하나가 뜹니다.', '하나가 떠요.')}\nconst broken = (;\n`)).toBeNull();
    expect(copyOf(CARD, edit('<p>\n        요청을', '<p\n        요청을'))).toBeNull();
    expect(copyOnlyChanged(ts, 'app/new.tsx', null, CARD)).toBeNull();
    expect(copyOnlyChanged(ts, 'app/gone.tsx', CARD, null)).toBeNull();
    expect(copyOnlyChanged(null, 'app/me/matching/request-card.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOnlyChanged(ts, 'e2e/card.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOnlyChanged(ts, 'app/me/card.test.tsx', CARD, edit('하나가 뜹니다.', '하나가 떠요.'))).toBeNull();
    expect(copyOf(CARD, CARD)).toBeNull();
    expect(copyOf(CARD, edit("'use client';", "'use client';\n// 주석만"))).toBeNull();
    // 파싱이 실패한 파일은 PR 계획에서도 지금 규칙 그대로다 — layout 은 전부
    const layout = 'export default function L() {\n  return <body><p>머리 글 하나</p></body>;\n}\nconst broken = (;\n';
    expect(planOf('app/layout.tsx', layout, layout.replace('하나', '둘')).cause).toBe('layout');
  });

  it('목록 안 문구 상수 파일의 문자열 값만 바뀌면 문구다 — 이름 · 모양이 바뀌면 아니다', () => {
    const file = 'src/lib/matching/copy.ts';
    const before = "/** 셋째 줄 */\nexport const NOTE = '상대가 수락하면 채팅방이 열려요.';\nexport const OTHER = `둘째`;\n";
    expect(copyOnlyChanged(ts, file, before, before.replace('채팅방이 열려요', '대화방이 열려요'))).toEqual(['상대가 수락하면 채팅방이 열려요.']);
    expect(copyOnlyChanged(ts, file, before, before.replace('`둘째`', '`둘째 줄`'))).toEqual(['둘째']);
    expect(copyOnlyChanged(ts, file, before, before.replace('NOTE', 'NOTE_2'))).toBeNull();
    expect(copyOnlyChanged(ts, file, before, `${before}export const MORE = '셋';\n`)).toBeNull();
    // 모양을 벗어난 파일(import · 식 · 타입 표기 · let · 내보내지 않음)은 문자열이 문구 자리가 아니다
    for (const extra of ["import { x } from './x';\n", 'export const N = 1;\n', "export const T: string = 'a';\n", "export let L = 'a';\n", "const HIDDEN = 'a';\n"]) {
      const shaped = `${extra}${before}`;
      expect(copyOnlyChanged(ts, file, shaped, shaped.replace('채팅방이 열려요', '대화방이 열려요')), extra).toBeNull();
    }
  });

  it('문구 상수 파일은 목록과 이름이 짝이고, 모양을 지키고, 그 이름은 화면(.tsx)과 시험만 부른다 — 용도가 확인된 문구만 든다', () => {
    const libs = readdirSync(resolve(ROOT, 'src/lib'), { withFileTypes: true }).filter((one) => one.isDirectory());
    const named = libs.map((one) => `src/lib/${one.name}/copy.ts`).filter((file) => existsSync(resolve(ROOT, file)));
    expect([...named].sort()).toEqual([...COPY_FILES].sort());
    const walk = (dir: string): string[] =>
      readdirSync(resolve(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? (entry.name === 'node_modules' ? [] : walk(`${dir}/${entry.name}`)) : /\.(?:tsx?|mjs)$/.test(entry.name) ? [`${dir}/${entry.name}`] : [],
      );
    const sources = ['app', 'src', 'e2e', 'scripts']
      .flatMap(walk)
      .concat(['proxy.ts'])
      .map((file) => [file, readFileSync(resolve(ROOT, file), 'utf8')] as const);
    for (const file of COPY_FILES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
      expect(copyConstantsShape(ts, tree), file).toBe(true);
      const names = [...source.matchAll(/^export const (\w+)/gm)].map((one) => one[1]);
      expect(names.length, file).toBeGreaterThan(0);
      for (const name of names) {
        const callers = sources.filter(([one, text]) => one !== file && new RegExp(`\\b${name}\\b`).test(text)).map(([one]) => one);
        expect(callers.length, name).toBeGreaterThan(0);
        expect(
          callers.filter((one) => !/^app\/.+\.tsx$/.test(one) && !/\.test\.tsx?$/.test(one)),
          name,
        ).toEqual([]);
      }
    }
  });

  it('관문 공용 위험 자리라도 문구만이면 core 다 — layout 의 JSX 글자 · 옛 글자를 말하는 시험이 없으면 core 하나', () => {
    const layout = 'export default function L({ children }: { children: React.ReactNode }) {\n  return <body><p>머리 글 하나</p>{children}</body>;\n}\n';
    const plan = planOf('app/layout.tsx', layout, layout.replace('머리 글 하나', '머리 글 둘'));
    expect(plan.tier).toBe('core');
    expect(plan.lanes).toEqual(CORE_ONLY);
    expect(plan.reason).toContain('문구만 바뀐 파일은 core 로 셌다: `app/layout.tsx`');
    // 같은 파일의 속성을 바꾸면 그대로 공용 위험이다
    expect(planOf('app/layout.tsx', layout, layout.replace('<body>', '<body className="x">')).cause).toBe('layout');
    // 문서와 함께여도 core 다 — 정책 단계로 내려가지 않는다
    expect(planOf('app/layout.tsx', layout, layout.replace('머리 글 하나', '머리 글 둘'), ['docs/product/copy-ledger.md']).lanes).toEqual(CORE_ONLY);
    // 다른 파일이 전부를 부르면 그대로 전부다
    expect(planOf('app/layout.tsx', layout, layout.replace('머리 글 하나', '머리 글 둘'), ['proxy.ts']).tier).toBe('full');
  });

  it('옛 글자를 흐름 검사가 말하면 flow 가 더 선다 — check-share 가 「테스트 코드가 필요해요」를 찾는다', () => {
    const file = 'src/lib/account/copy.ts';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    const plan = planOf(file, before, before.replace('테스트 코드가 필요해요', '테스트 코드가 있어야 해요'), ['docs/product/copy-ledger.md']);
    expect(plan.tier).toBe('narrow');
    expect(plan.lanes.core).toBe(true);
    expect(plan.lanes.flow).toBe(true);
    expect(plan.reason).toContain('`scripts/check-share.mjs`');
  });

  it('옛 글자를 spec 이 말하면 그 spec 의 차선이 선다 — 통째로든 리터럴 · 정규식 조각으로든, spec 아닌 e2e 면 전부', () => {
    const olds = new Map([['app/me/matching/request-card.tsx', ['요청을 보내면 상대의 인연 탭에 하나가 뜹니다.']]]);
    const spec = (body: string) => [['e2e/match.spec.ts', body] as const];
    expect(copyLanesOf(olds, spec("await expect(page.getByText('요청을 보내면 상대의 인연 탭에 하나가 뜹니다.')).toBeVisible();"))).toEqual({
      lanes: lanesOfTest('e2e/match.spec.ts'),
      tests: ['e2e/match.spec.ts'],
    });
    expect(lanesOfTest('e2e/match.spec.ts')).toEqual(['match:desktop', 'match:mobile']);
    expect(copyLanesOf(olds, spec('await page.getByText(/인연 탭에/).click();')).tests).toEqual(['e2e/match.spec.ts']);
    expect(copyLanesOf(olds, spec("await page.getByText('하나가 뜹니다').click();")).tests).toEqual(['e2e/match.spec.ts']);
    expect(copyLanesOf(olds, spec("await page.getByRole('button', { name: '보내기' }).click();"))).toEqual({ lanes: [], tests: [] });
    expect(copyLanesOf(olds, [['e2e/session.ts', "const x = '인연 탭에';"]]).lanes).toBeNull();
    expect(copyLanesOf(olds, [['scripts/check-chat.mjs', "check('x', html.includes('인연 탭에'));"]]).lanes).toEqual(['flow']);
  });

  it('PR 계획 — 옛 글자를 말하는 spec 이 저장소에 있으면 그 차선이 선다(match.spec 의 「수락해서 인연 궁합이 열렸어요.」)', () => {
    const screen = 'export const S = () => <p>수락해서 인연 궁합이 열렸어요.</p>;\n';
    const plan = planOf('app/me/requests/status-line.tsx', screen, screen.replace('열렸어요', '열렸습니다'));
    expect(plan.tier).toBe('narrow');
    expect(plan.authedLanes).toEqual(expect.arrayContaining(['match:desktop', 'match:mobile']));
    expect(plan.reason).toContain('`e2e/match.spec.ts`');
  });

  it('공개 출시에는 문구로 좁히지 않는다 — 화면 하나도 전부다', () => {
    const screen = 'export const L = () => <p>머리 글 하나</p>;\n';
    expect(planOf('app/me/x.tsx', screen, screen.replace('하나', '둘'), [], '공개 출시').tier).toBe('full');
  });

  it('main 푸시는 문구만이어도 전부다 — 머지 뒤의 전체 검증은 그대로다', () => {
    const screen = 'export const L = () => <p>머리 글 하나</p>;\n';
    const plan = planFor({
      files: ['app/me/x.tsx'],
      event: 'push',
      pushed: { before: 'c'.repeat(40), forced: false, beforeGreen: true },
      ts,
      sourceOf: () => screen.replace('하나', '둘'),
      baseSourceOf: () => screen,
    });
    expect(plan.tier).toBe('full');
  });
});

describe('묶음 배포의 기다림 — 마지막 초록부터 HEAD 까지가 문구 · 문서뿐인가 (ADR 0159)', () => {
  const GREEN = 'a'.repeat(40);
  const HEAD = 'b'.repeat(40);
  const CARD = 'export const C = () => <p>요청을 보냈어요</p>;\n';
  const range = (
    files: string[],
    sources: Record<string, [string | null, string | null]> = {},
    more: Partial<Parameters<typeof deployRangeOf>[0]> = {},
  ) =>
    deployRangeOf({
      lastGreen: GREEN,
      head: HEAD,
      files,
      ts,
      sourceOf: (file) => sources[file]?.[1] ?? null,
      baseSourceOf: (file) => sources[file]?.[0] ?? null,
      unpassed: [],
      ...more,
    });
  const copyCard: Record<string, [string, string]> = { 'app/me/card.tsx': [CARD, CARD.replace('보냈어요', '보냈습니다')] };

  it('문구 · 문서뿐인 범위는 기다리지 않는다 — 문서 · 주석뿐이면 docs-only', () => {
    const copy = range(['docs/product/copy-ledger.md', 'app/me/card.tsx'], copyCard);
    expect(copy.verdict).toBe('copy');
    expect(copy.copy).toEqual(['app/me/card.tsx']);
    expect(range(['docs/prd.md', 'scripts/ci-plan.test.ts']).verdict).toBe('docs-only');
    const commented: Record<string, [string, string]> = { 'src/lib/chat/index.ts': ['// 옛\nexport const x = 1;\n', '// 새\nexport const x = 1;\n'] };
    expect(range(['docs/prd.md', 'src/lib/chat/index.ts'], commented).verdict).toBe('docs-only');
  });

  it('동작이 바뀐 커밋이 하나라도 섞이면 기다린다 — 그 파일을 이름으로 든다', () => {
    const mixed = range(['app/me/card.tsx', 'src/lib/chat/index.ts', 'docs/prd.md'], {
      ...copyCard,
      'src/lib/chat/index.ts': ['export const x = 1;\n', 'export const x = 2;\n'],
    });
    expect(mixed.verdict).toBe('wait');
    expect(mixed.behavior).toEqual(['src/lib/chat/index.ts']);
    expect(range(['supabase/migrations/20261009000000_x.sql']).verdict).toBe('wait');
    expect(range(['app/me/new.tsx'], { 'app/me/new.tsx': [null, CARD] }).verdict).toBe('wait');
  });

  it('마지막 초록을 못 찾거나 · diff 를 못 읽거나 · 파서가 없거나 · PR 검사가 초록이 아니거나 못 읽으면 기다린다', () => {
    expect(range(['docs/prd.md'], {}, { lastGreen: null }).verdict).toBe('wait');
    expect(range([]).verdict).toBe('wait');
    expect(range(['docs/prd.md'], {}, { files: null }).verdict).toBe('wait');
    expect(range(['app/me/card.tsx'], copyCard, { ts: null }).verdict).toBe('wait');
    expect(range(['app/me/card.tsx'], copyCard, { unpassed: null }).verdict).toBe('wait');
    const red = range(['app/me/card.tsx'], copyCard, { unpassed: ['c'.repeat(40)] });
    expect(red.verdict).toBe('wait');
    expect(red.reason).toContain('ccccccc');
  });

  it('마지막 초록이 HEAD 면 green 이다', () => {
    expect(range([], {}, { lastGreen: HEAD }).verdict).toBe('green');
  });

  it('배포 범위 명령은 CI · 개발 도구다 — 공용 위험(시험 도구)으로 안 걸린다', () => {
    expect(beta(['scripts/deploy-range.mjs']).tier).toBe('core');
  });
});
