/**
 * 계획이 **조용히 건너뛰지 않는가.**
 *
 * 선택 실행의 위험은 빨간불이 아니라 **초록인데 안 잰 것**이다. 그래서 여기서 재는 것은
 * 「문서만 바뀌면 건너뛰는가」보다 「모르는 파일이 하나라도 있으면 전부 도는가」와
 * 「라벨이 검사를 뺄 수 없는가」다.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

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
  SERVICE_WORKER,
  SHARED_RISK,
  addressesOf,
  COPY_ATTRIBUTES,
  copyConstantMisuses,
  ACCESSIBLE_NAME_ATTRIBUTES,
  copyConstantsOf,
  copyConstantsShape,
  copyLanesOf,
  copyOnlyChanged,
  deployRangeOf,
  entriesReaching,
  syntaxOf,
  importsOf,
  isSurface,
  lanesOfTest,
  loginSpecs,
  mainRedOf,
  onlyCommentsChanged,
  planFor,
  regexShape,
  regexTurnsOn,
  regexUsesIn,
  routeOf,
  settledGreen,
  specsOfLane,
  summaryOf,
  testsImportingCopy,
  testsNamingLiterally,
  LANE_SCRIPTS,
  TEST_RUNNERS,
  UNTESTED_GAP,
  looseAddressesOf,
  linkReach,
  linkedOnlyEntries,
  linksIn,
  mentionOf,
  testRunnerChangeOf,
  testsOfEntry,
  untestedEntries,
} from './ci-plan.mjs';
import { STAGE_FILE, currentStageOf } from './release-stage.mjs';
import { filesUnder } from './source-files';

/** 바뀐 글자를 찾는 시험들의 차선 — 정규식은 파서로 가른다 */
const lanesFor = (copyOnly: Map<string, string[]>, tests: readonly (readonly [string, string])[]) => copyLanesOf(copyOnly, tests, ts);

/** 공개 출시 — 머지 전에 전체를 재는 단계. 아래 「CI 계획」은 이 단계의 세 단계를 잰다 */
const pr = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '공개 출시' });
const beta = (files: string[], labels: string[] = []) => planFor({ files, labels, event: 'pull_request', stage: '운영 베타' });

/** 전부 — 단위 · 타입 · 린트 · 빌드(`core`) · 익명 e2e · 로그인 일곱 · 흐름 */
const FULL = { policy: false, core: true, anon: true, authed: true, flow: true, audit: false };
const CORE_ONLY = { policy: false, core: true, anon: false, authed: false, flow: false, audit: false };

describe('CI 계획 — 공개 출시 전 (ADR 0097)', () => {
  it('입구가 아닌 코드 PR 은 core 하나만 탄다 — 전체는 main 에서 돈다(화면 컴포넌트 · CI 자체는 아래)', () => {
    for (const files of [
      ['app/me/(shelf)/readings/opening.ts'],
      ['src/lib/saju/strength/index.ts'],
      // 지운 컴포넌트(못 읽음)는 안 건다 — 부르던 쪽이 함께 바뀌어 그쪽이 걸린다
      ['src/lib/matching/x.ts', 'app/me/matching/x.tsx', 'app/auth-free.ts'],
      ['app/me/(shelf)/readings/book.ts', 'app/auth/signed-in.test.ts', 'app/me/matching/page.test.ts'],
      ['.github/ISSUE_TEMPLATE/x.yml'],
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
    // 빌드는 계획의 `build` 가 `false` 일 때만 건너뛴다 — 값이 비면 돈다(문구만 바뀐 PR, ADR 0178)
    expect(yml).toMatch(
      /^ {6}- run: npm run build\n {8}if: \$\{\{ !cancelled\(\) && steps\.install\.outcome == 'success' && needs\.plan\.outputs\.build != 'false' \}\}$/m,
    );
    expect(runsOf('anon')).toEqual(['npm ci', 'npx playwright install --with-deps chromium', 'npm run test:e2e']);
  });

  /**
   * **앞 검사가 붉어도 뒤 검사는 돈다**(2026-10-22, ADR 0097 덧). 기본 `if` 는 `success()` 라 `npm test` 가 붉으면 타입 · 린트 ·
   * 빌드가 건너뛰어졌다 — ADR 번호를 나눠 쥔 뒤 번호 PR(#791 · #792 · #796)은 빌드가 한 번도 안 돌았다. 넓히기만 한다 —
   * 붉은 단계를 삼키는 `continue-on-error` 는 없고, 첫 검사는 기본 조건 그대로이며, 설치가 섰을 때만 돈다.
   */
  it('core · policy 의 검사는 앞 검사가 붉어도 돌고, 붉음을 삼키지 않는다', () => {
    const yml = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    const stepsOf = (name: string) => {
      const block = new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)\\n  [a-z]+:\\n`).exec(yml)?.[1] ?? '';
      // 주석 줄은 뺀다 — 머리 주석이 `continue-on-error` 를 이름으로 말한다
      const job = block
        .split('\n')
        .filter((line) => !/^\s*#/.test(line))
        .join('\n');
      expect(job, name).not.toMatch(/continue-on-error/);
      // 단계의 첫 키가 무엇이든(`- name:` · `- if:` …) `run:` 이 든 단계는 다 센다
      const field = (step: string, key: string) => new RegExp(`^(?: {8})?${key}: (.+)$`, 'm').exec(step)?.[1].trim();
      return job
        .split(/^ {6}- /m)
        .slice(1)
        .filter((step) => field(step, 'run') !== undefined)
        .map((step) => ({ run: field(step, 'run'), cond: field(step, 'if') ?? null, id: field(step, 'id') }));
    };
    const GUARD = "${{ !cancelled() && steps.install.outcome == 'success' }}";
    const BUILD = "${{ !cancelled() && steps.install.outcome == 'success' && needs.plan.outputs.build != 'false' }}";
    const expected = {
      core: ['npm ci', ...CORE_STEPS],
      policy: ['npm ci', 'npx vitest run scripts/', 'npm run typecheck', 'npx eslint scripts/'],
    };
    for (const [name, runs] of Object.entries(expected)) {
      const steps = stepsOf(name);
      // 명령 목록 전체를 견준다 — 가드 없는 단계가 끼어들면 여기서 걸린다
      expect(steps.map((step) => step.run), name).toEqual(runs);
      const [install, head, ...rest] = steps;
      expect(install, name).toEqual({ run: 'npm ci', cond: null, id: 'install' });
      expect(head, name).toEqual({ run: runs[1], cond: null, id: undefined });
      // 조건은 글자 그대로 — `|| always()` 같은 꼬리가 붙으면 다르다
      for (const step of rest) expect(step.cond, `${name}: ${step.run}`).toBe(step.run === 'npm run build' ? BUILD : GUARD);
    }
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
    const rest = PR_284.filter((file) => !file.endsWith('/layout.tsx') && !file.endsWith('/subject.ts'));
    // 서가의 컴포넌트(shelf · frame)는 그 layout 이 부르므로 그것만으로도 전부다(입구가 아닌 화면 컴포넌트)
    expect(beta(rest).cause).toBe('주소 없음');
    const plan = beta(rest.filter((file) => !/\/(?:shelf|frame)\.tsx$/.test(file)));
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
    const servers = filesUnder(resolve(root, 'app'))
      .filter((file) => /\.tsx?$/.test(file))
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
/** 저장소의 파일 — 없거나 폴더면 `null` */
const diskOf = (file: string): string | null =>
  existsSync(resolve(ROOT, file)) && statSync(resolve(ROOT, file)).isFile() ? readFileSync(resolve(ROOT, file), 'utf8') : null;
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
/** 시험이 import 를 따라가는 뿌리 — `.ts` · `.tsx` · `.mjs` */
const codeUnder = (dir: string): string[] => filesUnder(dir).filter((file) => /\.(tsx?|mjs)$/.test(file));
const isTestFile = (file: string) => /\.test\.tsx?$/.test(file);
const escapeForRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('CI 계획 — 판단이 사는 app/ 파일과 시험 도구도 입구다 (2026-09-28, ADR 0119 추기)', () => {
  it('감사가 짚은 서버 문 — 이름이 입구가 아니어도 DB · service-role · 공개 client 를 부르면 입구다. 액션 · route · 관문이 부르면 전부, 아니면 쓰는 입구의 차선(ADR 0178)', () => {
    for (const file of [
      'app/me/reading/pipeline.ts',
      'app/me/same-chart.ts',
      'app/me/candidates.ts',
      'app/keyed-client.ts',
      'app/me/photo/photo-response.ts',
      'app/beta-schedule.ts',
    ]) {
      expect(isSurface(file), file).toBe(true);
      expect(beta([file]).lanes, file).toEqual(FULL);
    }
    for (const file of ['app/me/chat/rooms.ts', 'app/ops/reports/read.ts', 'app/share/public-client.ts']) {
      expect(isSurface(file), file).toBe(true);
      expect(beta([file]).tier, file).toBe('narrow');
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

  /**
   * CI · 운영 · 개발 도구 넷(#767 검수) — 시험이 import 하거나 부르지 않아 `core` 다. `pr-title` 은 계획 job 이 PR 마다 부르고 제 단위
   * 시험이 있다, `deploy-smoke` 는 `npm run smoke:deploy`(사람이 배포 뒤), `brand-icons` · `push-vapid-keys` 는 사람이 손으로 돌린다
   */
  it('시험이 부르지 않는 도구 넷은 시험 도구가 아니다 — e2e · 흐름 검사 · Playwright 설정 · 그 도우미가 import 도 실행도 안 한다', () => {
    const tools = ['scripts/pr-title.mjs', 'scripts/deploy-smoke.mjs', 'scripts/brand-icons.mjs', 'scripts/push-vapid-keys.mjs'];
    for (const file of tools) {
      expect(existsSync(resolve(ROOT, file)), file).toBe(true);
      expect(isSurface(file), file).toBe(false);
      expect(beta([file]).lanes, file).toEqual(CORE_ONLY);
    }
    const harness = [
      ...codeUnder(resolve(ROOT, 'e2e')),
      ...codeUnder(resolve(ROOT, 'scripts')).filter((file) => !isTestFile(file) && isSurface(relative(ROOT, file))),
      resolve(ROOT, 'playwright.config.ts'),
    ];
    const code = (file: string) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
        .join('\n');
    // 부른다 = import 하거나, 그 파일 이름을 통째 문자열로 실행 인자에 넘긴다. 안내 문장 속의 이름(`push-local.mjs` 가 찍는
    // 「node scripts/push-vapid-keys.mjs」)은 부르는 것이 아니다
    const calls = harness.flatMap((file) =>
      tools
        .filter((tool) => {
          const name = escapeForRegExp(tool.replace(/^scripts\//, ''));
          const source = code(file);
          return (
            importsOf(source).some((one) => one.endsWith(tool.replace(/^scripts\//, '')) || one.endsWith(tool.replace(/^scripts\/|\.mjs$/g, ''))) ||
            new RegExp(`['"\`](?:\\.{1,2}\\/|scripts\\/)?${name}['"\`]`).test(source)
          );
        })
        .map((tool) => `${relative(ROOT, file)} → ${tool}`),
    );
    expect(calls).toEqual([]);
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
    // 타입만 들여도 서버 도달이다 — 주입받은 클라이언트로 DB 를 부른다(#682 독립 검토). 입구가 없는 고아라 전부
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
      ...codeUnder(resolve(ROOT, 'e2e')),
      ...readdirSync(resolve(ROOT, 'scripts'))
        .filter((name) => /^check-[^/]+\.mjs$/.test(name))
        .map((name) => resolve(ROOT, 'scripts', name)),
      ...HARNESS.map((file) => resolve(ROOT, file)),
      resolve(ROOT, 'scripts/run-checks.mjs'),
    ];
    const appRoots = [...codeUnder(resolve(ROOT, 'app')).filter((file) => !isTestFile(file)), resolve(ROOT, 'proxy.ts')];
    const app = reachedFrom(appRoots);
    const toolOnly = [...reachedFrom(harnessRoots)].filter((file) => !app.has(file)).map((file) => relative(ROOT, file));
    expect(toolOnly).toContain('scripts/checks.mjs');
    expect(toolOnly.filter((file) => !isSurface(file))).toEqual([]);
  });
});

/**
 * **입구가 아닌 서버 파일은 그것을 쓰는 입구의 주소로 간다**(운영자 2026-10-12, ADR 0178). 전에는 주소를 못 뽑아 전부였다 —
 * `app/` 의 시험 아닌 파일 388 개 중 113 개가 전부였고 그중 65 개가 「주소 없음」이었다(#649 · #650 · #651 · #657 · #673).
 */
describe('CI 계획 — 입구가 아닌 서버 파일은 import 를 거꾸로 따라 입구의 차선만 (ADR 0178)', () => {
  const disk = (file: string) => (existsSync(resolve(ROOT, file)) && statSync(resolve(ROOT, file)).isFile() ? readFileSync(resolve(ROOT, file), 'utf8') : null);

  /**
   * 타입만 들이는 import 도 서버 도달이다(#682 독립 검토) — `import type { SupabaseClient }` 만 든 파일이 주입받은 클라이언트로
   * `client.rpc` 를 부른다. 그것을 빼면 e2e 없는 core 로 떨어졌다. 그런 파일도 쓰는 입구의 차선이나 전부로 간다
   */
  it('타입만 들이고 주입받은 클라이언트로 DB 를 부르는 파일은 서버 파일이다 — 입구의 차선이나 전부로, core 하나로 떨어지지 않는다', () => {
    const sale = 'app/me/credits/sale.ts';
    expect(readFileSync(resolve(ROOT, sale), 'utf8')).toMatch(/import type \{[^}]*SupabaseClient[^}]*\} from '@supabase\/supabase-js'/);
    expect(isSurface(sale)).toBe(true);
    expect(beta([sale]).tier).toBe('full');

    const room = 'app/me/chat/[matchId]/room-compat.ts';
    expect(readFileSync(resolve(ROOT, room), 'utf8')).toMatch(/import type \{[^}]*\} from '@supabase\/supabase-js'/);
    expect(isSurface(room)).toBe(true);
    expect(beta([room]).tier).toBe('narrow');

    // 같은 꼴의 새 파일 — page 가 부르면 그 주소의 차선, 아무도 안 부르면 전부
    const door = 'app/me/people/typed-door.ts';
    const page = 'app/me/people/page.tsx';
    const source = "import type { SupabaseClient } from '@supabase/supabase-js';\nexport const read = (client: SupabaseClient) => client.rpc('x');\n";
    const used = (file: string) => (file === door ? source : file === page ? `import { read } from './typed-door';\n${disk(page)}` : disk(file));
    const plan = planFor({ files: [door], stage: '운영 베타', sourceOf: used });
    expect(plan.tier).toBe('narrow');
    expect(plan.authedLanes).toEqual(beta([page]).authedLanes);
    const alone = (file: string) => (file === door ? source : disk(file));
    expect(planFor({ files: [door], stage: '운영 베타', sourceOf: alone }).lanes).toEqual(FULL);
  });

  it('입구를 다시 내보내는 page 의 주소도 든다 — 입구에서 멈추지 않고 위로 더 따라간다', () => {
    const door = 'app/me/people/new-door.ts';
    const first = 'app/me/(shelf)/readings/compat/page.tsx';
    const second = 'app/me/people/page.tsx';
    const sourceOf = (file: string) => {
      if (file === door) return "import 'server-only';\nexport const x = 1;\n";
      if (file === first) return `import { x } from '../../../people/new-door';\n${disk(first)}`;
      if (file === second) return "export { default } from '../(shelf)/readings/compat/page';\n";
      return disk(file);
    };
    const reach = entriesReaching(door, sourceOf, [door]);
    expect(reach.risk).toBeNull();
    expect(reach.entries).toEqual([first, second].sort());
    const plan = planFor({ files: [door], stage: '운영 베타', sourceOf });
    // 둘째 page(/me/people)의 차선 — match 가 든다. 첫째(/me/readings/compat)만이면 signed-in 둘뿐이다
    expect(beta([first]).authedLanes).not.toContain('match:desktop');
    expect(plan.authedLanes).toContain('match:desktop');
  });

  it('app/me/match/screen.tsx — 그것을 쓰는 page 의 주소에 닿는 차선만, 전부가 아니다', () => {
    const file = 'app/me/match/screen.tsx';
    expect(isSurface(file)).toBe(true);
    expect(routeOf(file)).toBeNull();
    const reach = entriesReaching(file);
    expect(reach.risk).toBeNull();
    expect(reach.entries.length).toBeGreaterThan(0);
    expect(reach.entries.every((entry) => routeOf(entry) !== null)).toBe(true);
    const plan = beta([file]);
    expect(plan.tier).toBe('narrow');
    expect(plan.authedLanes.length).toBeLessThan(AUTHED_LANES.length);
    expect(plan.authedLanes).toContain('match:desktop');
    expect(plan.authedLanes).not.toContain('notice');
  });

  it('app/me/requests/inbox.ts — layout · 서버 액션이 부르면 그 자리라 여전히 전부다(안전 문턱은 그대로, ADR 0119)', () => {
    const file = 'app/me/requests/inbox.ts';
    const reach = entriesReaching(file);
    expect(['layout', '서버 액션']).toContain(reach.risk?.name);
    const plan = beta([file]);
    expect(plan.lanes).toEqual(FULL);
    expect(plan.cause).toBe('주소 없음');
    expect(plan.reason).toMatch(/\((?:layout|서버 액션)\)가 부른다/);
  });

  it('입구를 하나도 못 찾는 고아 서버 파일은 전부다 · 관문이 부르면 전부다', () => {
    const orphan = 'app/me/orphan-door.ts';
    const sourceOf = (file: string) => (file === orphan ? "import 'server-only';\nexport const x = 1;\n" : disk(file));
    const plan = planFor({ files: [orphan], stage: '운영 베타', sourceOf });
    expect(plan.lanes).toEqual(FULL);
    expect(plan.cause).toBe('주소 없음');
    expect(plan.reason).toContain('입구를 못 찾는다');
    expect(beta(['app/beta-schedule.ts']).reason).toContain('관문이 부른다');
  });

  it('같은 PR 에서 새 page 가 새 서버 파일을 부르면 그 page 의 주소로 간다 — page 의 시험이 정말 없으면 core 와 시험 공백', () => {
    const door = 'app/me/people/new-door.ts';
    const page = 'app/me/people/page.tsx';
    const pageSource = `import { x } from './new-door';\n${disk(page)}`;
    const sourceOf = (file: string) => (file === door ? "import 'server-only';\nexport const x = 1;\n" : file === page ? pageSource : disk(file));
    const plan = planFor({ files: [door], stage: '운영 베타', sourceOf });
    const pagePlan = beta([page]);
    expect(plan.tier).toBe('narrow');
    expect(plan.authedLanes).toEqual(pagePlan.authedLanes);
    expect(plan.lanes).toEqual(pagePlan.lanes);
    const lonely = 'app/me/nowhere-yet/page.tsx';
    const lonelyOf = (file: string) => (file === door ? "import 'server-only';\n" : file === lonely ? "import { x } from '../people/new-door';\n" : disk(file));
    const lonelyPlan = planFor({ files: [door, lonely], stage: '운영 베타', sourceOf: lonelyOf });
    expect(lonelyPlan.lanes).toEqual(CORE_ONLY);
    expect(lonelyPlan.reason).toContain(`\`${lonely}\` 는 core 로 셌다(시험 공백, 간극 대장 ${UNTESTED_GAP})`);
    // 다른 파일이 켠 차선은 그대로다
    const mixed = planFor({ files: [door, lonely, page], stage: '운영 베타', sourceOf: (file) => (file === page ? pageSource : lonelyOf(file)) });
    expect(mixed.lanes).toEqual(pagePlan.lanes);
    expect(mixed.reason).toContain('시험 공백');
  });

  it('실측 — app/ 의 시험 아닌 파일 중 「주소 없음」으로 전부가 되는 파일은 공용 위험 · 관문 · 고아 까닭뿐이다', () => {
    const files = codeUnder(resolve(ROOT, 'app'))
      .map((file) => relative(ROOT, file))
      .filter((file) => !isTestFile(file));
    const noAddress = files.map((file) => beta([file])).filter((plan) => plan.cause === '주소 없음');
    for (const plan of noAddress) expect(plan.reason).toMatch(/가 부른다$|관문이 부른다$|입구를 못 찾는다$/);
    // 서버 파일은 옛 규칙의 65 개에서 42 개로 줄었고(ADR 0178), 화면 컴포넌트 21 개(`.tsx` 19 · hook 같은 `.ts` 둘)가 layout · 인증 ·
    // Next 공용 경계를 지나 더해졌다(2026-10-22 에 잰 합 68) — 다시 넓어지면 이 수를 보고 까닭을 적는다. 2026-10-23 에 둘 —
    // 사진 저장소의 켜는 값 · S3 손(`app/me/photo/store-env.ts` · `s3-store.ts`)을 청소 크론(`app/api/cron/photo-sweep`)이 부른다(G-120).
    // 2026-10-24 에 둘 — 바닥 스낵바 한 자리(`app/ui/snackbar.tsx` · `snackbar-store.ts`)를 뿌리 레이아웃이 부른다(어느 화면이든 띄운다, ADR 0109 추기)
    expect(noAddress.length).toBeLessThanOrEqual(72);
  });
});

/**
 * **입구가 아닌 화면 컴포넌트도 그것을 쓰는 입구의 차선을 탄다**(CI 갈래 검수 2026-10-22 의 1). 전에는 `core` 만 돌아 main 이 붉은
 * #581(#579 — `anon` · `signed-in`) · #614(#612 — `push`) · #595(#593 — `signed-in`)가 다 여기서 샜다.
 */
describe('CI 계획 — 입구가 아닌 화면 컴포넌트는 그것을 쓰는 입구의 차선을 탄다', () => {
  /** main 이 붉었던 PR 의 코드 파일과 그때 붉은 차선 */
  const REDS: [string, string[], string[]][] = [
    [
      '#579 → #581',
      ['app/compat-picker.tsx', 'app/compat-view.tsx', 'app/me/consent-controls.tsx', 'app/me/people/manage.tsx', 'app/me/survey/form.tsx', 'app/saju/fortune.tsx', 'app/saju/result-nav.tsx', 'app/ui/buttons.ts'],
      ['anon', 'signed-in:desktop', 'signed-in:mobile'],
    ],
    ['#612 → #614', ['app/me/push/browser.ts', 'app/me/settings/push-row.tsx'], ['push']],
    ['#593 → #595', ['app/match-index.tsx', 'app/me/compat/screen.tsx', 'app/me/onboarding.tsx', 'app/saju-hero.tsx'], ['signed-in:desktop', 'signed-in:mobile']],
  ];

  it('main 이 붉었던 세 PR 의 화면 파일만으로도 그때 붉은 차선이 머지 전에 선다', () => {
    for (const [name, files, red] of REDS) {
      const plan = beta(files);
      const on = [...(plan.lanes.anon ? ['anon'] : []), ...plan.authedLanes];
      if (plan.tier !== 'full') for (const lane of red) expect(on, `${name} :: ${lane}`).toContain(lane);
    }
    // #612 의 둘 중 컴포넌트(`push-row.tsx`) 하나로 push 가 선다 — 옛 규칙은 core 하나였다
    expect(beta(['app/me/settings/push-row.tsx']).authedLanes).toContain('push');
  });

  it('지운 컴포넌트(못 읽음)는 안 건다 · layout 이 부르면 그 자리라 전부 · 아무도 안 부르면 전부', () => {
    expect(planFor({ files: ['app/me/gone-card.tsx'], stage: '운영 베타', sourceOf: () => null }).lanes).toEqual(CORE_ONLY);
    const shelf = beta(['app/me/(shelf)/readings/shelf.tsx']);
    expect(shelf.lanes).toEqual(FULL);
    expect(shelf.reason).toContain('(layout)가 부른다');
    const orphan = 'app/me/orphan-card.tsx';
    const plan = planFor({ files: [orphan], stage: '운영 베타', sourceOf: (one) => (one === orphan ? 'export const C = () => null;\n' : diskOf(one)) });
    expect(plan.cause).toBe('주소 없음');
    expect(plan.reason).toContain('입구를 못 찾는다');
  });

  it('React 를 들이거나 \'use client\' 인 .ts(hook 같은 것)도 화면 컴포넌트다 — 순수 로직 .ts 는 core 그대로 (운영자 2026-10-22)', () => {
    for (const hook of ['app/me/chat/[matchId]/use-outbox.ts', 'app/me/matching/use-deck.ts', 'app/ui/leave-guard.ts']) {
      const plan = beta([hook]);
      expect(plan.tier, hook).toBe('narrow');
      expect(plan.authedLanes.length, hook).toBeGreaterThan(0);
    }
    expect(beta(['app/me/(shelf)/readings/book.ts']).lanes).toEqual(CORE_ONLY);
    // 주석 속 「'use client'」는 지시가 아니다 — 첫 칸에 선 문자열만 센다
    expect(beta(['app/me/matching/history-href.ts']).lanes).toEqual(CORE_ONLY);
    const client = 'app/me/people/use-thing.ts';
    const page = 'app/me/people/page.tsx';
    const sourceOf = (one: string) =>
      one === client ? "'use client';\nexport const useThing = () => 1;\n" : one === page ? `import { useThing } from './use-thing';\n${diskOf(page)}` : diskOf(one);
    expect(planFor({ files: [client], stage: '운영 베타', sourceOf }).lanes).toEqual(beta([page]).lanes);
    const hook = (one: string) => (one === client ? "import { useState } from 'react';\nexport const useThing = () => useState(1);\n" : sourceOf(one));
    expect(planFor({ files: [client], stage: '운영 베타', sourceOf: hook }).lanes).toEqual(beta([page]).lanes);
  });

  it('실측 — 저장소의 화면 컴포넌트는 core 하나로 떨어지지 않는다(쓰는 입구에 닿는 시험이 정말 없을 때 말고는)', () => {
    const components = codeUnder(resolve(ROOT, 'app'))
      .map((file) => relative(ROOT, file).split(sep).join('/'))
      .filter((file) => file.endsWith('.tsx') && !isTestFile(file) && routeOf(file) === null && !isSurface(file));
    expect(components.length).toBeGreaterThan(100);
    const silent = components
      .map((file) => [file, beta([file])] as const)
      .filter(([, plan]) => plan.tier === 'core' && !plan.reason.includes('시험 공백'))
      .map(([file]) => file);
    expect(silent).toEqual([]);
  });
});

/**
 * **css module 과 서비스 워커는 core 하나로 떨어지지 않는다**(2026-10-22 감사가 `planFor` 에 넣어 본 구멍 둘). css module 만 바꾼 PR 은
 * `.tsx` 가 아니라 `core` 였고, `public/sw.js` 는 알려진 `core` 자리(`public/**`)라 그것을 등록해 재는 `e2e/push.spec.ts` 의 차선이 안 섰다.
 */
describe('CI 계획 — css module 은 그것을 들이는 화면의 차선, 서비스 워커는 그것을 여는 시험의 차선을 탄다', () => {
  it('css module 하나만 바꿔도 그것을 들이는 컴포넌트를 바꾼 것과 같은 차선이 선다', () => {
    const css = 'app/me/home/map/relation-map.module.css';
    const plan = beta([css]);
    expect(plan.tier).not.toBe('core');
    expect(plan.lanes).toEqual(beta(['app/me/home/map/relation-map.tsx']).lanes);
    expect(plan.authedLanes).toEqual(beta(['app/me/home/map/relation-map.tsx']).authedLanes);
  });

  it('실측 — 저장소의 css module 은 core 하나로 떨어지지 않는다 · app/globals.css 는 core 그대로', () => {
    const modules = filesUnder(resolve(ROOT, 'app'))
      .map((file) => relative(ROOT, file).split(sep).join('/'))
      .filter((file) => file.endsWith('.module.css'));
    expect(modules.length).toBeGreaterThan(3);
    const silent = modules.filter((file) => {
      const plan = beta([file]);
      return plan.tier === 'core' && !plan.reason.includes('시험 공백');
    });
    expect(silent).toEqual([]);
    // 뿌리 layout 이 들이는 전역 css 는 좁히면 사실상 전부다 — 단위 · 빌드가 재는 core 로 둔다
    expect(beta(['app/globals.css']).lanes).toEqual(CORE_ONLY);
  });

  it('지운 css module(못 읽음)은 안 건다 · 아무도 안 들이면 전부', () => {
    expect(planFor({ files: ['app/me/gone.module.css'], stage: '운영 베타', sourceOf: () => null }).lanes).toEqual(CORE_ONLY);
    const orphan = 'app/me/orphan.module.css';
    const plan = planFor({ files: [orphan], stage: '운영 베타', sourceOf: (one) => (one === orphan ? '.x { color: red; }\n' : diskOf(one)) });
    expect(plan.cause).toBe('주소 없음');
  });

  it('public/sw.js 는 서비스 워커를 여는 시험의 차선(push)을 탄다 — public 의 다른 파일은 core 그대로', () => {
    const plan = beta([SERVICE_WORKER]);
    expect(plan.tier).toBe('narrow');
    expect(plan.authedLanes).toContain('push');
    expect(plan.reason).toContain('e2e/push.spec.ts');
    expect(beta(['public/badge.png']).lanes).toEqual(CORE_ONLY);
  });

  it('SERVICE_WORKER 는 앱이 등록하는 서비스 워커 그 파일이다', () => {
    expect(existsSync(resolve(ROOT, SERVICE_WORKER))).toBe(true);
    const registering = [...codeUnder(resolve(ROOT, 'app')), ...codeUnder(resolve(ROOT, 'src'))]
      .map((file) => readFileSync(file, 'utf8'))
      .filter((source) => /serviceWorker\.register\(/.test(source));
    expect(registering.length).toBeGreaterThan(0);
    const urls = new Set(registering.flatMap((source) => [...source.matchAll(/['"`](\/[\w./-]+\.js)['"`]/g)].map((one) => one[1])));
    expect([...urls]).toEqual([SERVICE_WORKER.replace(/^public/, '')]);
  });
});

/**
 * **닿는 시험이 0 인 입구는 「정말 없음」과 「탐색이 놓쳤음」으로 가른다**(운영자 2026-10-22 「조건부 core」). 글자 그대로 요청하는 시험이
 * 없어도 템플릿 · 이어 붙임 · 정규식 · 도우미가 그 주소를 요청할 수 있으면 전부, 그것도 없으면 core 와 간극 대장의 시험 공백이다.
 */
describe('CI 계획 — 닿는 시험이 0 인 입구는 정말 없을 때만 core 와 시험 공백이다', () => {
  const patterns = (source: string) => looseAddressesOf(source).map((one) => one.pattern.source);

  it('확실히 못 푼 주소를 넓게 잡는다 — 템플릿의 식 · 이어 붙임 · 식 뒤의 경로 · 정규식의 \\/ 경로. 주석 · 분수 · 나눗셈 글자는 아니다', () => {
    const hit = (source: string, address: string) => looseAddressesOf(source).some((one) => one.pattern.test(address));
    expect(hit('await page.goto(`/me/${tab}`);', '/me/credits')).toBe(true);
    expect(hit("await page.goto('/me/' + tab);", '/me/credits')).toBe(true);
    expect(hit('await fetch(`${BASE}/me/credits/history`);', '/me/credits/history')).toBe(true);
    expect(hit('await expect(page).toHaveURL(/\\/me\\/credits$/);', '/me/credits')).toBe(true);
    expect(hit('await expect(page).toHaveURL(/\\/me\\/credits$/);', '/me/credits/history')).toBe(false);
    expect(hit('await expect(page).toHaveURL(/\\/me\\/readings\\/[0-9a-f-]+$/);', '/me/readings/x')).toBe(true);
    expect(patterns('// await page.goto(`/me/${tab}`);')).toEqual([]);
    expect(patterns('console.log(`${passed}/${total} 통과`);')).toEqual([]);
    expect(patterns("getByText(/\\d+ \\/ 100/);")).toEqual([]);
    // 글자 그대로의 주소는 여기 안 든다 — `addressesOf` 몫이다
    expect(patterns("await page.goto('/me/credits');")).toEqual([]);
  });

  it('입구 하나의 시험 — 글자 그대로 닿으면 그 시험, 0 이면 요청할 수도 있는 시험 · 도우미, 그것도 없으면 정말 없음', () => {
    const map = (addresses: Record<string, string[]>, loose: Record<string, string> = {}) => ({
      addresses,
      loose: Object.fromEntries(Object.entries(loose).map(([file, source]) => [file, looseAddressesOf(source)])),
    });
    const page = 'app/me/credits/page.tsx';
    expect(testsOfEntry(page, map({ 'e2e/a.spec.ts': ['/me/credits'] }))).toEqual({ tests: ['e2e/a.spec.ts'], unsure: [] });
    expect(testsOfEntry(page, map({ 'e2e/a.spec.ts': ['/me'] }, { 'e2e/a.spec.ts': 'await page.goto(`/me/${tab}`);' }))).toEqual({
      tests: [],
      unsure: ['e2e/a.spec.ts'],
    });
    expect(testsOfEntry(page, map({ 'e2e/a.spec.ts': ['/me'] }, { 'e2e/a.spec.ts': "await page.goto('/me');" }))).toEqual({ tests: [], unsure: [] });
    // 그 아래 전부를 맡는 입구(`loading` …)는 무늬의 머리가 그 아래면 놓쳤을 수 있다
    expect(testsOfEntry('app/me/credits/loading.tsx', map({}, { 'e2e/b.spec.ts': 'expect(url).toMatch(/\\/me\\/credits\\/history\\/[0-9]+/);' })).unsure).toEqual([
      'e2e/b.spec.ts',
    ]);
    // 동적 마디 · route group 은 보기 주소에서 한 마디 · 없음이다
    expect(testsOfEntry('app/ops/(desk)/orders/[id]/page.tsx', map({}, { 'scripts/check-x.mjs': 'await fetch(`${base}/ops/orders/${id}`);' })).unsure).toEqual([
      'scripts/check-x.mjs',
    ]);
  });

  it('경로가 글자로 들어 있기만 해도 놓쳤을 수 있다 — glob · 정규식 문자열 · 경로 상수 · 이어 붙임. 앞이 다른 마디면 아니다 (두 번째 검토)', () => {
    const page = 'app/me/credits/page.tsx';
    const judge = (source: string, imported = '') =>
      testsOfEntry(page, { addresses: { 'e2e/x.spec.ts': addressesOf(source) }, loose: { 'e2e/x.spec.ts': looseAddressesOf(source) }, texts: { 'e2e/x.spec.ts': `${source}\n${imported}` } });
    const unsure = (source: string, imported = '') => judge(source, imported).unsure.length > 0;
    expect(unsure("await page.waitForURL('**/me/credits');")).toBe(true);
    expect(unsure("const base = '/me';\nawait page.goto(base + '/credits');")).toBe(true);
    expect(unsure('await expect(page).toHaveURL(/credits$/);')).toBe(true);
    expect(unsure("import { CREDITS } from '../src/lib/x';\nawait page.goto(CREDITS);", "export const CREDITS = '/me/credits';")).toBe(true);
    // 정규식 문자열의 끝 `$` 는 떼고 읽어 글자 그대로 닿는다
    expect(judge("await expect(page).toHaveURL(new RegExp('/me/credits$'));").tests).toEqual(['e2e/x.spec.ts']);
    // 다른 마디 뒤의 끝 마디 · 주석 속 경로는 아니다
    expect(testsOfEntry('app/me/credits/history/page.tsx', { addresses: {}, loose: {}, texts: { 'e2e/m.spec.ts': "await page.goto('/me/matching/history');" } }).unsure).toEqual([]);
    expect(mentionOf('app/page.tsx')).toBeNull();
    expect(mentionOf('app/me/chat/[matchId]/page.tsx')!.test('`/me/chat/${id}`')).toBe(true);
  });

  it('시험 없는 입구를 다른 page 가 다시 내보내면 그 page 의 시험이 그것을 그린다 — 놓쳤을 수 있어 전부 (두 번째 검토)', () => {
    const lonely = 'app/me/credits/page.tsx';
    const page = 'app/me/people/page.tsx';
    const sourceOf = (one: string) => (one === page ? `export { default } from '../credits/page';\n` : diskOf(one));
    const plan = planFor({ files: [lonely], stage: '운영 베타', sourceOf });
    expect(plan.lanes).toEqual(FULL);
    expect(plan.cause).toBe('닿는 시험 모름');
    expect(plan.reason).toContain(page);
  });

  it('탐색이 놓쳤을 수 있으면 전부다 — 서가 아래 새 page 는 글자 그대로 요청하는 시험이 없어도 정규식 `\\/me\\/readings\\/[0-9a-f-]+$` 이 요청할 수 있다', () => {
    const page = 'app/me/readings/foo/bar/page.tsx';
    expect(testsOfEntry(page).tests).toEqual([]);
    expect(testsOfEntry(page).unsure.length).toBeGreaterThan(0);
    const plan = beta([page]);
    expect(plan.lanes).toEqual(FULL);
    expect(plan.cause).toBe('닿는 시험 모름');
  });

  it('정말 없으면 그 파일만 core 다 — 다른 파일이 켠 차선은 그대로, 까닭에 간극 대장의 줄이 실린다', () => {
    // 어느 앱 코드도 링크하지 않는 새 page 와 그것만 부르는 서버 파일
    const lonely = 'app/me/nowhere-yet/page.tsx';
    const door = 'app/me/nowhere-yet/read.ts';
    const sourceOf = (one: string) => (one === lonely ? "import { x } from './read';\n" : one === door ? "import 'server-only';\nexport const x = 1;\n" : diskOf(one));
    const one = planFor({ files: [lonely], stage: '운영 베타', sourceOf });
    expect(one.lanes).toEqual(CORE_ONLY);
    expect(one.reason).toContain(`시험 공백, 간극 대장 ${UNTESTED_GAP}`);
    expect(planFor({ files: [door, lonely], stage: '운영 베타', sourceOf }).lanes).toEqual(CORE_ONLY);
    const compat = 'app/me/(shelf)/readings/compat/page.tsx';
    const mixed = planFor({ files: [lonely, compat], stage: '운영 베타', sourceOf });
    expect(mixed.lanes).toEqual(beta([compat]).lanes);
    expect(mixed.reason).toContain('시험 공백');
  });

  it(`간극 대장 ${UNTESTED_GAP} 의 기록이 닿는 시험이 정말 없는 입구와 링크로만 닿는 입구를 빠짐없이 든다 — 시험을 더하면 그 줄을 지운다`, () => {
    const record = readFileSync(resolve(ROOT, `docs/product/gaps/records/g-${UNTESTED_GAP.slice(2)}.md`), 'utf8');
    const listedUnder = (heading: string) => {
      const section = record.split(/^## /m).find((one) => one.startsWith(heading)) ?? '';
      expect(section, heading).not.toBe('');
      return [...section.matchAll(/^- `(app\/[^`]+)`/gm)].map((one) => one[1]).sort();
    };
    expect(listedUnder('닿는 시험이 없는 입구')).toEqual(untestedEntries());
    expect(listedUnder('링크로만 닿는 입구')).toEqual(linkedOnlyEntries());
    expect(readFileSync(resolve(ROOT, 'docs/product/gaps.md'), 'utf8')).toMatch(new RegExp(`^\\| ${UNTESTED_GAP} \\|`, 'm'));
  });
});

/**
 * **다른 화면이 가리키는 입구도 「놓쳤을 수 있음」이다**(ADR 0195 덧, 외부 리뷰 2026-10-22). 주소를 한 글자도 적지 않고 링크를 눌러 그
 * 입구에 닿는 시험이 있을 수 있다 — 그 입구를 가리키는(링크든 이동이든) 화면을 여는 시험이 있으면 전부다. 시험이 무엇을 누르는지는 가르지
 * 않는다(독립 검토 2026-10-22 — 선택자 글자 · 좌표 누름 · 키 · 대소문자로 이름 좁힘이 샜다).
 */
describe('CI 계획 — 다른 화면이 가리키는 입구는 정말 없음이 아니다', () => {
  it('앱 코드가 그 입구를 가리키는가 — 링크 · 이동 · 넓은 무늬 · 경로 글자. import 경로 · 주소창 조각 · 다른 주소는 아니다', () => {
    const help = 'app/help/page.tsx';
    expect(linksIn("export const L = [{ href: '/help', label: '자주 묻는 질문' }];", help)).toBe(true);
    expect(linksIn('<Link href="/help">{COPY.help}</Link>', help)).toBe(true);
    expect(linksIn("router.push('/help');", help)).toBe(true);
    expect(linksIn("export const HELP_PATH = '/help';", help)).toBe(true);
    expect(linksIn("const to = ['', 'help'].join('/');", help)).toBe(true);
    expect(linksIn('const to = `${base}/help`;', help)).toBe(true);
    expect(linksIn("import { x } from '../help/open-hashed';\nimport y from '@/app/help/z';", help)).toBe(false);
    expect(linksIn('<Link href="/helper">x</Link>', help)).toBe(false);
  });

  it('주소창 조각은 확실한 꼴만 걷는다 — 경로 자리의 홀로 선 search · hash 는 경로일 수 있어 넓게 (독립 검토)', () => {
    const help = 'app/help/page.tsx';
    // `?` · `#` 뒤, 그리고 끝에 search 다음 hash 가 붙은 꼴은 주소창 조각이다
    expect(linksIn('return `/${search}${hash}`;', help)).toBe(false);
    expect(linksIn('return `/${location.search}${location.hash}`;', help)).toBe(false);
    expect(linksIn('return `/?${search}`;', help)).toBe(false);
    // 경로 자리의 홀로 선 식은 경로일 수 있다
    expect(linksIn('return `/${hash}`;', help)).toBe(true);
    expect(linksIn('return `/${search}`;', help)).toBe(true);
    expect(linksIn('return `/ops/orders/${order.hash}`;', 'app/ops/orders/[id]/page.tsx')).toBe(true);
  });

  it('주소를 적지 않고 링크를 눌러 닿을 수 있으면 놓쳤을 수 있다 — 외부 리뷰의 반례 · 독립 검토의 반례', () => {
    const page = 'app/help/page.tsx';
    const everywhere = { route: /^\/.*$/, samples: ['/', '/x'] };
    const judge = (code: string, routes = [everywhere]) =>
      testsOfEntry(page, {
        addresses: { 'e2e/x.spec.ts': addressesOf(code) },
        loose: { 'e2e/x.spec.ts': looseAddressesOf(code) },
        texts: { 'e2e/x.spec.ts': code },
        linkReach: () => ({ routes }),
      }).unsure;
    const opensHome = "await page.goto('/');\n";
    // 무엇을 누르든(이름 · 선택자 글자 · 좌표 · 키) — 누르지 않아도(이동은 그리는 순간에도 옮긴다) 그 화면을 열면 든다
    for (const act of [
      "await page.getByRole('link', { name: '자주 묻는 질문' }).click();",
      "await page.getByRole('link', { name: '채팅' }).click();",
      "await page.locator('text=자주 묻는 질문').click();",
      "await page.locator('xpath=//footer//a').click();",
      'await page.mouse.click(10, 700);',
      "await page.keyboard.press('NumpadEnter');",
      'await page.evaluate(() => document.links[3].click());',
      '',
    ]) {
      expect(judge(`${opensHome}${act}`), act).toEqual(['e2e/x.spec.ts']);
    }
    // 그 입구를 가리키는 화면을 열지 않거나, 앱 어디서도 가리키지 않으면 아니다
    const meOnly = { route: /^\/me(?:\/.*)?$/, samples: ['/me', '/me/x'] };
    expect(judge("await page.goto('/ops/reports');\nawait page.getByRole('link').click();", [meOnly])).toEqual([]);
    expect(judge(`${opensHome}await page.getByRole('link').click();`, [])).toEqual([]);
  });

  it('배열을 `/` 로 이은 주소도 요청할 수 있는 주소로 넓게 잡는다', () => {
    const hit = (source: string, address: string) => looseAddressesOf(source).some((one) => one.pattern.test(address));
    expect(hit("await page.goto(['', 'me', 'credits'].join('/'));", '/me/credits')).toBe(true);
    expect(hit("await page.goto(['', 'me', 'credits'].join('/'));", '/me/credits/history')).toBe(false);
    expect(hit("await page.goto([base, 'credits'].join('/'));", '/me/credits')).toBe(true);
    expect(looseAddressesOf('const pair = [a, b].join(\'/\');')).toEqual([]);
  });

  it('실측 — 시험 공백이던 입구 아홉은 공용 바닥글 · 회원 머리 · 운영 머리가 가리켜 모두 전부다', () => {
    const nine = [
      'app/help/page.tsx',
      'app/me/credits/done/page.tsx',
      'app/me/credits/history/page.tsx',
      'app/me/credits/page.tsx',
      'app/ops/members/page.tsx',
      'app/ops/orders/page.tsx',
      'app/ops/today/page.tsx',
      'app/refund/page.tsx',
      'app/terms/page.tsx',
    ];
    for (const entry of nine) {
      expect(testsOfEntry(entry).tests, entry).toEqual([]);
      const plan = beta([entry]);
      expect(plan.lanes, entry).toEqual(FULL);
      expect(plan.cause, entry).toBe('닿는 시험 모름');
    }
    expect(linkedOnlyEntries()).toEqual(nine);
    // 운영 화면은 운영 머리(`app/ops/layout.tsx` 아래)만 가리킨다 — 모든 화면이 아니다
    expect(linkReach('app/ops/today/page.tsx').routes.map((one) => one.route.source)).toContain(routeOf('app/ops/loading.tsx')!.source);
  });
});

/**
 * **CI 자체와 시험 실행 의존성을 바꾼 PR 은 전부를 돈다**(운영자 2026-10-22 「이번에 전부로」). 전에는 `core`(와 `audit`)만 돌아 바뀐
 * 워크플로 단계와 Playwright · Supabase CLI 가 PR 에서 한 번도 안 돌았다. 앱이 쓰는 패키지의 판은 일반 의존성이라 그대로 `core` · `audit` 이다.
 */
describe('CI 계획 — CI 자체 · 시험 실행 의존성은 전부다', () => {
  const PKG = diskOf('package.json')!;
  const LOCK = diskOf('package-lock.json')!;
  type Manifest = {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
    packages: Record<string, { version: string }>;
  };
  const bump = (json: string, edit: (value: Manifest) => void) => {
    const value = JSON.parse(json);
    edit(value);
    return JSON.stringify(value, null, 2);
  };
  const planOf = (file: string, after: string) =>
    planFor({ files: [file], stage: '운영 베타', sourceOf: (one) => (one === file ? after : diskOf(one)), baseSourceOf: diskOf });

  it('Playwright · Supabase CLI 의 판이나 차선 스크립트가 바뀌면 전부, 앱 패키지 · 다른 스크립트만이면 core 와 audit', () => {
    const runner = planOf('package.json', bump(PKG, (json) => (json.devDependencies['@playwright/test'] = '^9.9.9')));
    expect(runner.lanes).toEqual({ ...FULL, audit: true });
    expect(runner.cause).toBe('시험 실행 의존성');
    expect(planOf('package.json', bump(PKG, (json) => (json.devDependencies.supabase = '9.9.9'))).cause).toBe('시험 실행 의존성');
    expect(planOf('package.json', bump(PKG, (json) => (json.scripts['test:e2e:push'] += ' --retries=3'))).cause).toBe('시험 실행 의존성');
    expect(planOf('package.json', bump(PKG, (json) => (json.scripts['db:start'] += ',realtime'))).cause).toBe('시험 실행 의존성');
    const app = planOf('package.json', bump(PKG, (json) => (json.dependencies.next = '99.0.0')));
    expect(app.lanes).toEqual({ ...CORE_ONLY, audit: true });
    expect(planOf('package.json', bump(PKG, (json) => (json.scripts.start += ' --keepAliveTimeout 1'))).lanes).toEqual({ ...CORE_ONLY, audit: true });
    // e2e 가 앱을 띄우는 `dev` 도 차선 스크립트다(두 번째 검토의 반례)
    expect(planOf('package.json', bump(PKG, (json) => (json.scripts.dev = 'next dev --broken-flag'))).cause).toBe('시험 실행 의존성');
  });

  it('잠금 파일 — 설치된 실행기(node_modules/<이름> 으로 끝나는 열쇠)의 판 · 출처 · 지문이 바뀌면 전부, 다른 패키지만이면 core 와 audit', () => {
    const installed = Object.keys(JSON.parse(LOCK).packages).filter((key) => /(?:^|\/)node_modules\/(?:@playwright\/test|playwright|playwright-core|supabase)$/.test(key));
    expect(installed.length).toBeGreaterThanOrEqual(3);
    // 가짜 푸시 서비스가 직접 들이는 간접 의존성 — package.json 에 없어도 잠금 파일의 판이 바뀌면 전부다(두 번째 검토의 반례)
    const ece = Object.keys(JSON.parse(LOCK).packages).filter((key) => /(?:^|\/)node_modules\/http_ece$/.test(key));
    expect(ece.length).toBeGreaterThan(0);
    for (const key of ece) expect(planOf('package-lock.json', bump(LOCK, (json) => (json.packages[key].version = '9.9.9'))).cause, key).toBe('시험 실행 의존성');
    for (const key of installed) {
      const plan = planOf('package-lock.json', bump(LOCK, (json) => (json.packages[key].version = '9.9.9')));
      expect(plan.cause, key).toBe('시험 실행 의존성');
    }
    expect(planOf('package-lock.json', bump(LOCK, (json) => (json.packages['node_modules/next'].version = '99.0.0'))).lanes).toEqual({ ...CORE_ONLY, audit: true });
  });

  it('base 나 HEAD 를 못 읽거나 JSON 이 아니면 가를 수 없어 전부다', () => {
    expect(testRunnerChangeOf(['package.json'], { sourceOf: diskOf, baseSourceOf: () => null })).toMatch(/가를 수 없다/);
    expect(testRunnerChangeOf(['package-lock.json'], { sourceOf: () => '{', baseSourceOf: diskOf })).toMatch(/가를 수 없다/);
    expect(beta(['package.json']).cause).toBe('시험 실행 의존성');
    expect(testRunnerChangeOf(['package.json', 'package-lock.json'], { sourceOf: diskOf, baseSourceOf: diskOf })).toBeNull();
  });

  it('워크플로 · Node 판(.nvmrc)은 CI 자체라 전부다 — 워크플로 밖의 .github 는 아니다', () => {
    for (const file of ['.github/workflows/verify.yml', '.github/workflows/main-red.yml', '.nvmrc']) {
      expect(beta([file]).lanes, file).toEqual(FULL);
      expect(beta([file]).cause, file).toBe('CI 자체');
    }
    expect(beta(['.github/ISSUE_TEMPLATE/x.yml']).lanes).toEqual(CORE_ONLY);
    expect(beta(['.github/pull_request_template.md']).tier).toBe('policy');
  });

  it('잠금 — 차선 job 이 부르는 npm 스크립트는 모두 LANE_SCRIPTS 이고, 그 스크립트가 부르는 실행기와 시험만 들이는 패키지는 TEST_RUNNERS 에 있다', () => {
    const yml = readFileSync(resolve(ROOT, '.github/workflows/verify.yml'), 'utf8');
    const coreRuns = new Set(CORE_STEPS.map((step) => step.replace(/^npm run /, '')));
    // 주석이 아닌 `run:` 줄만 — 머리 주석이 `npm run verify` 를 이름으로 말한다
    const runs = yml
      .split('\n')
      .filter((line) => /^\s*(?:- )?run: /.test(line))
      .flatMap((line) => [...line.matchAll(/npm run ([\w:-]+(?:\$\{\{[^}]*\}\})?)/g)].map((one) => one[1].replace(/\$\{\{[^}]*\}\}/, 'x')))
      .filter((name) => !coreRuns.has(name));
    // e2e 가 앱을 띄우는 명령(`playwright.config.ts` 의 `webServer.command`)도 차선이 부르는 스크립트다
    const config = readFileSync(resolve(ROOT, 'playwright.config.ts'), 'utf8');
    const served = [.../webServer:\s*\{\s*command:\s*`([^`]*)`/.exec(config)![1].matchAll(/npm run ([\w:-]+)/g)].map((one) => one[1]);
    expect(served).toEqual(['dev']);
    expect(runs.length).toBeGreaterThan(3);
    expect([...runs, ...served].filter((name) => !LANE_SCRIPTS.test(name))).toEqual([]);
    const scripts: Record<string, string> = JSON.parse(PKG).scripts;
    const binaries = new Set(
      Object.entries(scripts)
        .filter(([name]) => LANE_SCRIPTS.test(name) && name !== 'dev')
        .flatMap(([, command]) => command.split('&&').map((one) => one.trim().replace(/^node scripts\/heavy\.mjs /, '').split(' ')[0])),
    );
    expect([...binaries].sort()).toEqual(['node', 'playwright', 'supabase']);
    expect(TEST_RUNNERS).toContain('@playwright/test');
    expect(TEST_RUNNERS).toContain('supabase');
    // `dev` 는 앱 자신(`next dev`)이다 — Next 의 판은 일반 의존성이라 core 와 audit 이고, 스크립트 줄이 바뀌면 전부다
    expect(scripts.dev.split(' ')[0]).toBe('next');
    // 시험(e2e · 흐름 검사 · Playwright 설정)과 그 도우미(`fake-push-service.mjs` 같은 시험 도구)만 들이는 패키지 — 앱(app · src · proxy)이
    // 안 들이는 것. package.json 에 없는 간접 의존성(`http_ece`)도 든다
    const packageOf = (name: string) => (name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]);
    const imported = (files: string[]) =>
      new Set(files.flatMap((file) => importsOf(readFileSync(file, 'utf8'))).filter((name) => !/^(?:\.|@\/|node:)/.test(name)).map(packageOf));
    const testOnly = imported([
      ...codeUnder(resolve(ROOT, 'e2e')),
      resolve(ROOT, 'playwright.config.ts'),
      ...codeUnder(resolve(ROOT, 'scripts')).filter((file) => !isTestFile(file) && isSurface(relative(ROOT, file))),
    ]);
    expect(testOnly).toContain('http_ece');
    const app = imported([...codeUnder(resolve(ROOT, 'app')), ...codeUnder(resolve(ROOT, 'src')), resolve(ROOT, 'proxy.ts')]);
    expect([...testOnly].filter((name) => !app.has(name) && !TEST_RUNNERS.includes(name))).toEqual([]);
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
    expect(pairs.map(([key]) => key).sort()).toEqual([...lanes, 'authed_lanes', 'build'].sort());
  });

  it('차선마다 같은 이름의 job 이 있고 그 job 은 제 출력 하나로만 켜진다', () => {
    for (const lane of lanes) {
      const job = jobs.get(lane);
      expect(job, lane).toBeDefined();
      expect(job, lane).toMatch(/^ {4}needs: plan$/m);
      expect(job, lane).toMatch(new RegExp(`^ {4}if: needs\\.plan\\.outputs\\.${lane} == 'true'$`, 'm'));
    }
    const read = [...yml.matchAll(/needs\.plan\.outputs\.([\w-]+)/g)].map((one) => one[1]);
    expect(read.filter((name) => !lanes.includes(name) && name !== 'authed_lanes' && name !== 'build')).toEqual([]);
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
    // 운영 베타에서도 전부다 — 머리말 · 시험 지도의 「전부」와 같다(운영자 2026-10-22 「코드를 전부로」). 엔진의 다른 파일은 core 그대로
    for (const file of ENGINE_DB_FACING) expect(beta([file]).cause, file).toBe('엔진의 DB 쪽');
    expect(beta(['src/lib/saju/strength/index.ts']).lanes).toEqual(CORE_ONLY);
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
    // 컴포넌트(manage.tsx)는 이제 그것을 쓰는 입구(`/me/people`)의 차선을 더한다
    expect(lanesOf(['app/me/people/manage.tsx', 'e2e/signed-in.spec.ts', 'docs/product/gaps.md'])).toEqual(lanesOf(['app/me/people/page.tsx']));
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
    '엔진의 DB 쪽': ENGINE_DB_FACING,
    'CI 자체': ['.github/workflows/verify.yml', '.github/workflows/main-red.yml', '.github/workflows/new.yml', '.nvmrc'],
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
    // 의존성 목록은 base 와 견줘 시험 실행 의존성이 그대로일 때만 core 다 — 여기서는 base 도 디스크의 것이다. `.nvmrc` 는 CI 자체다
    const sameBase = (files: string[]) => planFor({ files, stage: '운영 베타', baseSourceOf: diskOf });
    for (const file of ['src/lib/matching/pool.ts', 'app/ui/buttons.ts', 'scripts/ci-plan.mjs', '.github/ISSUE_TEMPLATE/x.yml', 'public/brand/x.jpg', ...ROOT_CONFIGS.filter((one) => one !== '.nvmrc')]) {
      expect(sameBase([file]).tier, file).toBe('core');
    }
    // 이름으로 견주는 목록이다 — 지운 이름은 아무것도 안 건다
    expect(ROOT_CONFIGS.filter((file) => !existsSync(resolve(ROOT, file)))).toEqual([]);
  });

  it('입구가 아닌 서버 파일의 주소를 못 뽑으면 전부다 · 주소에 닿는 시험이 정말 없으면 core 와 시험 공백', () => {
    // 서버 액션(`app/me/discovery/actions.ts`)이 부르는 서버 파일은 그 액션의 자리라 전부다
    expect(beta(['app/me/candidates.ts']).cause).toBe('주소 없음');
    const lonely = beta(['app/me/nowhere-yet/page.tsx']);
    expect(lonely.lanes).toEqual(CORE_ONLY);
    expect(lonely.reason).toContain(`시험 공백, 간극 대장 ${UNTESTED_GAP}`);
  });

  it('불변식 — authed 는 authedLanes 가 비지 않았는가이고, 정책 밖의 계획에는 core 가 선다', () => {
    const files = [
      ...codeUnder(resolve(ROOT, 'app')),
      ...codeUnder(resolve(ROOT, 'e2e')),
      ...codeUnder(resolve(ROOT, 'scripts')),
      ...codeUnder(resolve(ROOT, 'src/lib/consent')),
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
  const planOf = (file: string, before: string, after: string, others: string[] = [], stage = '운영 베타', mentions: [string, string][] = []) =>
    planFor({
      files: [file, ...others],
      stage,
      ts,
      mentions,
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
  const planOf = (file: string, before: string, after: string, others: string[] = [], stage = '운영 베타', mentions: [string, string][] = []) =>
    planFor({
      files: [file, ...others],
      stage,
      ts,
      mentions,
      sourceOf: (one) => (one === file ? after : null),
      baseSourceOf: (one) => (one === file ? before : null),
    });
  const copyOf = (before: string, after: string, file = 'app/me/matching/request-card.tsx') => copyOnlyChanged(ts, file, before, after);

  /** 글자 없이 화면을 찾는 정규식 — 바뀐 글자를 글자 그대로 찾지 않지만(`testsNamingLiterally`) 차선은 켠다(`regexTurnsOn`) */
  const SCREEN_REGEX = 'page.getByRole(\'heading\', { name: /^\\S+$/ });';

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

  it('JSX 글자(요소 사이의 글자)만 바뀌면 문구만이다 — 앞뒤 글자를 공백을 접어 돌려준다', () => {
    expect(copyOf(CARD, edit('하나가 뜹니다.', '요청 하나가 뜹니다.'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 요청 하나가 뜹니다.',
    ]);
    expect(copyOf(CARD, edit('>받은 요청</a>', '>받은 요청 열기</a>'))).toEqual(['받은 요청', '받은 요청 열기']);
    // 주석과 함께 바뀌어도 문구만이다
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "// 단추 글자\nconst LABEL = '요청 보내기';", edit('요청을 보내면', '요청을 꼭 보내면')))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 꼭 보내면 상대의 인연 탭에 하나가 뜹니다.',
    ]);
    // 표에 없는 엔티티가 바뀐 글자에 있으면 판별하지 않는다(반쯤 푼 글자로 찾지 않게)
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가 뜹니다 &rarr;'))).toBeNull();
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가 뜹니다 &#x2192;'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다 →',
    ]);
    // JSX 엔티티는 풀어서 견준다 — `&nbsp;` 는 공백으로 접힌다
    expect(copyOf(CARD, edit('하나가 뜹니다.', '하나가&nbsp;떠요&hellip;'))).toEqual([
      '요청을 보내면 상대의 인연 탭에 하나가 뜹니다.',
      '요청을 보내면 상대의 인연 탭에 하나가 떠요…',
    ]);
    // JSX 주석 `{/* */}` 을 새로 세우는 것은 식 자리 하나가 느는 것이라 구조다
    expect(copyOf(CARD, edit('      <p>\n        요청을', '      {/* 안내 */}\n      <p>\n        요청을 꼭'))).toBeNull();
  });

  it('글자 속성에 문구 상수를 쓰는 것과 속성의 글자를 직접 바꾸는 것은 다르다 — 앞은 상수 값 변경이 문구, 뒤는 화면용 접근성 이름만 문구다', () => {
    // 속성 글자를 직접 바꾸는 diff 는 HTML 요소의 aria-label 만 문구다 — title · alt · placeholder 는 아니다(G-90)
    expect(ACCESSIBLE_NAME_ATTRIBUTES).toEqual(['aria-label']);
    for (const attribute of COPY_ATTRIBUTES) {
      const screen = `export const S = () => <input ${attribute}="가나다" />;\n`;
      expect(copyOnlyChanged(ts, 'app/s.tsx', screen, screen.replace('가나다', '라마바')), attribute).toEqual(
        ACCESSIBLE_NAME_ATTRIBUTES.includes(attribute) ? ['가나다', '라마바'] : null,
      );
    }
    // 그 속성에 문구 상수를 쓰는 것은 잠금이 허용하고, 상수 값이 바뀐 diff 는 문구다
    const screen = "import { NOTE } from '@/src/lib/matching/copy';\nexport const S = () => <input aria-label={NOTE} />;\n";
    expect(copyConstantMisuses(ts, 'app/s.tsx', screen, ['NOTE'])).toEqual([]);
    const copyFile = "export const NOTE = '가나다';\n";
    expect(copyOnlyChanged(ts, 'src/lib/matching/copy.ts', copyFile, copyFile.replace('가나다', '라마바'))).toEqual(['가나다', '라마바']);
  });

  it('JSX 속성 값은 문구가 아니다 — className · href · aria-label · data-* · type', () => {
    expect(copyOf(CARD, edit('flex flex-col gap-2', 'flex flex-col gap-3'))).toBeNull();
    expect(copyOf(CARD, edit('href="/me/requests"', 'href="/me/inbox"'))).toBeNull();
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

  it('템플릿의 식 · 목록 밖 문자열 상수 · import 경로는 문구가 아니다', () => {
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL.trim()} 준비됨`'))).toBeNull();
    expect(copyOf(CARD, edit("const LABEL = '요청 보내기';", "const LABEL = '인연 요청 보내기';"))).toBeNull();
    expect(copyOf(CARD, edit("from '@/src/lib/matching/copy'", "from '@/src/lib/matching/words'"))).toBeNull();
    // 목록 밖 파일의 `export const` 문자열 — 경로 · 키일 수 있다
    expect(copyOnlyChanged(ts, 'src/lib/matching/paths.ts', "export const INBOX = '/me/requests';\n", "export const INBOX = '/me/inbox';\n")).toBeNull();
  });

  it('JSX 자식 식이 그대로 세우는 글자 — 템플릿의 글자 조각 · 조건식의 두 갈래 · && 의 오른쪽은 문구다 (G-90)', () => {
    // #575 의 모양 — 식은 그대로이고 템플릿의 글자 조각만 바뀌었다
    const home = "export const G = ({ name }: { name: string }) => <h1 className=\"x\">{name === '' ? '반가워요' : `${name}님, 오늘도 반가워요`}</h1>;\n";
    expect(copyOf(home, home.replace('님, 오늘도', ' 님, 오늘도'), 'app/g.tsx')).toEqual(['님, 오늘도 반가워요']);
    expect(copyOf(home, home.replace("'반가워요'", "'안녕하세요'"), 'app/g.tsx')).toEqual(['반가워요', '안녕하세요']);
    expect(copyOf(CARD, edit('`${LABEL} 준비됨`', '`${LABEL} 준비 끝`'))).toEqual(['준비됨', '준비 끝']);
    expect(copyOf(CARD, edit('`준비 중`', '`준비하는 중`'))).toEqual(['준비 중', '준비하는 중']);
    const more = (inner: string) => `export const M = ({ a, b }: { a: boolean; b?: string }) => <p>${inner}</p>;\n`;
    for (const [inner, from, to] of [
      ["{a && '하나'}", '하나', '둘'],
      ["{b ?? '없음'}", '없음', '비었음'],
      ["{(a ? ('왼' ) : '오')}", '왼', '왼쪽'],
      ["{'통째'}", '통째', '통째로'],
      ['{`${b} 건`}', ' 건', '개'],
    ] as const) {
      expect(copyOf(more(inner), more(inner).replace(from, to), 'app/m.tsx'), inner).not.toBeNull();
    }
    // 식이 바뀌면 · 결과로 서지 않는 글자면 문구가 아니다 — 조건 · && 와 || 의 왼쪽 · 비교 · 함수 인자 · 속성 접근 · 배열
    expect(copyOf(home, home.replace("name === ''", "name === 'x'"), 'app/g.tsx')).toBeNull();
    expect(copyOf(home, home.replace('`${name}님', '`${name.trim()}님'), 'app/g.tsx')).toBeNull();
    for (const [inner, from, to] of [
      ["{'왼' || b}", '왼', '오'],
      ["{'왼' && b}", '왼', '오'],
      ["{b === '같음' ? 1 : 2}", '같음', '다름'],
      ["{label('키')}", '키', '열쇠'],
      ["{'가나'.length}", '가나', '가나다'],
      ["{['하나', '둘'].join(' · ')}", '하나', '셋'],
      ["{a ? <span>{b}</span> : null}{t('키')}", '키', '열쇠'],
    ] as const) {
      expect(copyOf(more(inner), more(inner).replace(from, to), 'app/m.tsx'), inner).toBeNull();
    }
    // 속성 안의 식은 화면용 접근성 이름이 아니면 자리가 아니다 · 값 요소 안은 몇 겹 아래든 빠진다
    const attr = "export const A = ({ a }: { a: boolean }) => <a href={a ? '/가' : '/나'} className={`x ${a ? 'y' : 'z'}`}>열기</a>;\n";
    expect(copyOf(attr, attr.replace("'/가'", "'/다'"), 'app/a.tsx')).toBeNull();
    expect(copyOf(attr, attr.replace("'y'", "'w'"), 'app/a.tsx')).toBeNull();
    const option = "export const O = ({ a }: { a: boolean }) => <select><option>{a ? '예' : '아니오'}</option></select>;\n";
    expect(copyOf(option, option.replace("'예'", "'네'"), 'app/o.tsx')).toBeNull();
  });

  it('HTML 요소의 aria-label 글자는 문구다 — 따옴표 값 · 그대로 서는 식. 컴포넌트의 aria-label 과 다른 속성은 아니다 (G-90)', () => {
    // #575 의 모양 — 오늘의 인연 단추의 접근성 이름
    const button = 'export const D = () => <button type="button" aria-label="상세 궁합 요청하기">궁합 요청</button>;\n';
    expect(copyOf(button, button.replace('상세 궁합 요청하기', '궁합 요청'), 'app/d.tsx')).toEqual(['상세 궁합 요청하기', '궁합 요청']);
    expect(copyOf(CARD, edit('aria-label="받은 요청 보기"', 'aria-label="받은 요청 열기"'))).toEqual(['받은 요청 보기', '받은 요청 열기']);
    const template = 'export const D = ({ name }: { name: string }) => <button aria-label={`${name} 님 지우기`}>×</button>;\n';
    expect(copyOf(template, template.replace(' 님 지우기', ' 님 삭제'), 'app/d.tsx')).toEqual([' 님 지우기', ' 님 삭제'].map((one) => one.trim()));
    // 컴포넌트(대문자 · 점 이름)의 aria-label 은 그 컴포넌트가 무엇에 쓰는지 모른다 · 이름이 바뀌거나 다른 aria-* 는 아니다
    for (const tag of ['Button', 'motion.button']) {
      const custom = `export const D = () => <${tag} aria-label="가나다">x</${tag}>;\n`;
      expect(copyOf(custom, custom.replace('가나다', '라마바'), 'app/d.tsx'), tag).toBeNull();
    }
    expect(copyOf(button, button.replace('aria-label=', 'aria-description='), 'app/d.tsx')).toBeNull();
    const labelled = 'export const D = () => <button aria-labelledby="가나다">x</button>;\n';
    expect(copyOf(labelled, labelled.replace('가나다', '라마바'), 'app/d.tsx')).toBeNull();
    // 값 요소 안의 aria-label 도 빠진다(보수적으로)
    const option = 'export const O = () => <select><option aria-label="가나다">a</option></select>;\n';
    expect(copyOf(option, option.replace('가나다', '라마바'), 'app/o.tsx')).toBeNull();
  });

  it('문구 파일의 표 상수 — 값만 문구이고 키 · 모양이 바뀌면 아니다 · 한 칸을 꺼내 글자 자리에 세울 때만 쓰임이다 (G-90)', () => {
    const file = 'src/lib/discovery/copy.ts';
    const before = "export const EMPTY = {\n  /** 제목 */\n  title: '가',\n  'line': `나`,\n} as const;\nexport const LABEL = { any: '상관없음', male: '남자' };\n";
    const tree = ts.createSourceFile(file, before, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
    expect([...copyConstantsOf(ts, tree)!].map(([name, one]) => [name, one.kind, one.values.length])).toEqual([
      ['EMPTY', 'table', 2],
      ['LABEL', 'table', 2],
    ]);
    expect(copyOnlyChanged(ts, file, before, before.replace("'가'", "'가가'"))).toEqual(['가', '가가']);
    expect(copyOnlyChanged(ts, file, before, before.replace("'남자'", "'남성'"))).toEqual(['남자', '남성']);
    expect(copyOnlyChanged(ts, file, before, before.replace('male:', 'man:'))).toBeNull();
    expect(copyOnlyChanged(ts, file, before, before.replace('} as const;', '};'))).toBeNull();
    // 표 안에 글자 아닌 값 · 펼침 · 계산한 키 · 줄임 · 메서드 · 다른 `as` 가 하나라도 서면 그 파일은 모양이 아니다
    for (const table of ["{ a: 1 }", "{ ...X }", "{ [K]: 'a' }", '{ a }', "{ a() { return 'a'; } }", "{ a: 'a' } as Record<string, string>", '{}', "{ a: `${x}` }"]) {
      const shaped = `export const T = ${table};\n`;
      expect(copyConstantsOf(ts, ts.createSourceFile(file, shaped, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)), table).toBeNull();
    }
    const head = "import { EMPTY, NOTE } from '@/src/lib/discovery/copy';\n";
    const use = (body: string) => copyConstantMisuses(ts, 'app/a.tsx', `${head}${body}\n`, ['EMPTY', 'NOTE'], 'src/lib/discovery/copy', ['EMPTY']);
    expect(use("export const A = ({ k, a }: { k: 'title' | 'line'; a: boolean }) => <div aria-label={EMPTY.line}><h2>{EMPTY.title}</h2><p>{EMPTY[k]}</p><p>{a ? NOTE : null}</p><p>{a && EMPTY.line}</p></div>;")).toEqual([]);
    expect(use('export const A = () => <p>{EMPTY}</p>;')).toEqual(['EMPTY:2']);
    expect(use('export const all = Object.keys(EMPTY);')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <p>{EMPTY.title.trim()}</p>;')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <a href={EMPTY.title}>x</a>;')).toEqual(['EMPTY:2']);
    expect(use('export const A = () => <p>{NOTE.length}</p>;')).toEqual(['NOTE:2']);
    expect(use('export const A = () => <p>{NOTE[0]}</p>;')).toEqual(['NOTE:2']);
    expect(use("export const A = ({ a }: { a: string }) => <p>{NOTE || a}</p>;")).toEqual(['NOTE:2']);
    expect(use("export const A = ({ a }: { a: boolean }) => <p>{NOTE ? 1 : 2}</p>;")).toEqual(['NOTE:2']);
  });

  it('바뀐 문구 파일을 들이는 시험의 차선을 켠다 — 상수를 이름으로 읽는 시험은 글자 검색에 안 걸린다 (G-90)', () => {
    const tests: [string, string][] = [
      ['e2e/chat.spec.ts', "import { CHAT_EMPTY_TITLE } from '@/src/lib/chat/copy';\nawait expect(page.getByText(CHAT_EMPTY_TITLE)).toBeVisible();\n"],
      ['e2e/live.spec.ts', "import { closedRoomText } from '@/src/lib/chat';\n"],
      ['scripts/check-chat.mjs', "const { NOTE } = await import('../src/lib/chat/copy.ts');\n"],
    ];
    expect(testsImportingCopy(['src/lib/chat/copy.ts'], tests)).toEqual(['e2e/chat.spec.ts', 'scripts/check-chat.mjs']);
    expect(testsImportingCopy(['app/me/chat/empty.tsx'], tests)).toEqual([]);
    expect(lanesFor(new Map([['src/lib/chat/copy.ts', ['가나다라', '마바사아']]]), tests)).toEqual({
      lanes: [...lanesOfTest('e2e/chat.spec.ts')!, ...lanesOfTest('scripts/check-chat.mjs')!],
      tests: ['e2e/chat.spec.ts', 'scripts/check-chat.mjs'],
    });
  });

  it('바뀐 글자를 시험이 글자 그대로 찾으면 문구만이 아니다 — 통째 · 따옴표 조각 · 글자 있는 정규식 · 주석, 이름으로 읽으면 아니다 (운영자 2026-10-10)', () => {
    const texts = ['메시지', '대화'];
    const of = (source: string) => testsNamingLiterally(texts, [['e2e/chat.spec.ts', source]], ts);
    expect(of("await expect(page.getByRole('log', { name: '메시지' })).toBeVisible();")).toEqual(['e2e/chat.spec.ts']);
    expect(of('// 메시지 칸을 본다\nconst x = 1;')).toEqual(['e2e/chat.spec.ts']);
    expect(of("page.getByRole('log', { name: /대화/ });")).toEqual(['e2e/chat.spec.ts']);
    expect(of("page.getByRole('log', { name: new RegExp('메시지') });")).toEqual(['e2e/chat.spec.ts']);
    // 긴 글자의 조각(넉 자 이상)을 따옴표로 찾아도 글자 그대로다
    expect(testsNamingLiterally(['요청을 보내면 상대의 인연 탭에 하나가 뜹니다.'], [['scripts/check-x.mjs', "body.includes('하나가 뜹니다')"]], ts)).toEqual(['scripts/check-x.mjs']);
    // 정규식은 글자가 있고 그 글자를 실제로 찾을 때만 — 조각만 겹치고 못 찾으면 · 정리 자리면 · 글자 없는 정규식은 아니다
    expect(of("page.getByRole('heading', { name: /^\\S+$/ });")).toEqual([]);
    expect(of("await expect(x).not.toHaveAttribute('open', /.+/);")).toEqual([]);
    const long = ['요청이 수락돼 인연 궁합이 열리면 메시지를 주고받을 수 있어요.'];
    const reg = (source: string) => testsNamingLiterally(long, [['e2e/m.spec.ts', source]], ts);
    expect(reg("page.getByText(/인연 궁합/);")).toEqual(['e2e/m.spec.ts']);
    expect(reg("page.getByText(/^인연/);")).toEqual([]);
    expect(reg("const s = name.replace(/인연/g, '');")).toEqual([]);
    expect(reg('page.getByText(new RegExp(name));')).toEqual([]);
    // 상수를 이름으로 읽거나, 짧은 조각 · 상관없는 글자면 아니다
    expect(of("import { LOG_LABEL } from '@/src/lib/chat/copy';\npage.getByRole('log', { name: LOG_LABEL });")).toEqual([]);
    expect(of("page.getByRole('heading', { name: /^\\d+$/ });")).toEqual([]);
    expect(of("page.getByText('메');")).toEqual([]);
    expect(of("page.getByText('보낸 말');")).toEqual([]);
    // 파싱하지 못하는 시험은 판별 불가라 찾는 것으로 센다
    expect(of('const broken = (;')).toEqual(['e2e/chat.spec.ts']);
  });

  it('독립 검토의 반례 — 대화방의 `aria-label="메시지"` 를 바꾸면 chat · live spec 이 글자 그대로 찾아 문구만이 아니다 (2026-10-10)', () => {
    const file = 'app/me/chat/[matchId]/room.tsx';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    expect(before).toContain('aria-label="메시지"');
    const after = before.replace('aria-label="메시지"', 'aria-label="대화 내용"');
    // 글자만 놓고 보면 문구 자리다(HTML 요소의 aria-label)
    expect(copyOnlyChanged(ts, file, before, after)).toEqual(['메시지', '대화 내용']);
    // 저장소의 시험이 그 글자를 찾는다 — PR 계획은 지금 규칙, 배포는 기다린다
    const disk = (one: string) => (existsSync(resolve(ROOT, one)) && statSync(resolve(ROOT, one)).isFile() ? readFileSync(resolve(ROOT, one), 'utf8') : null);
    const plan = planFor({ files: [file], stage: '운영 베타', ts, sourceOf: (one) => (one === file ? after : disk(one)), baseSourceOf: (one) => (one === file ? before : null) });
    expect(plan.reason).not.toContain('문구만 바뀐 파일');
    const existing = planFor({ files: [file], stage: '운영 베타' });
    expect(plan.lanes).toEqual(existing.lanes);
    const commit = { sha: 'd'.repeat(40), files: [file], sourceOf: (one: string) => (one === file ? after : null), baseSourceOf: (one: string) => (one === file ? before : null) };
    const range = deployRangeOf({ lastGreen: 'a'.repeat(40), head: 'b'.repeat(40), commits: [commit], ts, unpassed: [], mainRed: null });
    expect(range.verdict).toBe('wait');
    expect(range.behavior).toHaveLength(1);
    expect(range.behavior[0]).toContain('시험이 글자 그대로 찾는다');
    expect(range.behavior[0]).toContain('e2e/chat.spec.ts');
    // 그 커밋의 시험이 글자를 찾지 않으면(`mentions`) 문구다
    expect(deployRangeOf({ lastGreen: 'a'.repeat(40), head: 'b'.repeat(40), commits: [{ ...commit, mentions: () => [] }], ts, unpassed: [], mainRed: null }).verdict).toBe('copy');
  });

  it('이번에 옮긴 문구 상수는 e2e · 흐름 검사가 이름으로 읽는다 — 그 글자를 따옴표로 적은 시험이 없다 (G-90)', () => {
    const tests = [...readdirSync(resolve(ROOT, 'e2e')).map((one) => `e2e/${one}`), ...readdirSync(resolve(ROOT, 'scripts')).map((one) => `scripts/${one}`).filter((one) => /^scripts\/check-[^/]+\.mjs$/.test(one))]
      .filter((one) => /\.(?:ts|mjs)$/.test(one))
      .map((one) => [one, readFileSync(resolve(ROOT, one), 'utf8')] as [string, string]);
    /** 따옴표 · 백틱 리터럴의 글자(공백을 접은 것) — 상수를 이름으로 읽으면 여기 그 글자가 없다 */
    const quoted = (source: string) => [...source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)].map((one) => one[2].replace(/\s+/g, ' ').trim());
    // 정규식 · 짧은 따옴표 조각이 그 글자를 찾는 것은 남는다 — 그때 그 글자를 바꾼 PR 은 기다린다(`testsNamingLiterally`, 안전 쪽)
    for (const file of ['src/lib/chat/copy.ts', 'src/lib/discovery/copy.ts']) {
      const tree = ts.createSourceFile(file, readFileSync(resolve(ROOT, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      for (const [name, { values }] of copyConstantsOf(ts, tree)!) {
        for (const value of values) {
          const text = (value as import('typescript').StringLiteral).text;
          expect(tests.filter(([, source]) => quoted(source).includes(text)).map(([one]) => one), `${file} 의 ${name} 「${text}」`).toEqual([]);
        }
      }
    }
  });

  it('정규식이 바뀐 글자 밖까지 붙잡아도 — 한글 세 자 이상 이어진 조각이 앞뒤 글자 안에 있으면 찾는 것이다 (재검토 2026-10-10)', () => {
    // 본: e2e/saju.spec.ts 의 `toMatch(/\d{4}년 … \d{1,2}분 기준으로 짚었고/)` ↔ 화면 템플릿 조각 `${asOf} 기준으로 짚었고,`
    const screen = 'export const F = ({ asOf }: { asOf: string }) => <p>{`${asOf} 기준으로 짚었고, 다시 제출하기 전까지는 그대로예요.`}</p>;\n';
    const texts = copyOnlyChanged(ts, 'app/f.tsx', screen, screen.replace('기준으로 짚었고', '기준으로 봤고'))!;
    expect(texts).toEqual([' 기준으로 짚었고, 다시 제출하기 전까지는 그대로예요.', ' 기준으로 봤고, 다시 제출하기 전까지는 그대로예요.'].map((one) => one.trim()));
    const spec = 'expect(text).toMatch(/\\d{4}년 \\d{1,2}월 \\d{1,2}일 \\d{1,2}시 \\d{1,2}분 기준으로 짚었고/);';
    expect(new RegExp('\\d{1,2}분 기준으로 짚었고').test(texts[0])).toBe(false);
    expect(testsNamingLiterally(texts, [['e2e/saju.spec.ts', spec]], ts)).toEqual(['e2e/saju.spec.ts']);
    // 저장소의 saju.spec 그대로도 찾는다
    const real = readFileSync(resolve(ROOT, 'e2e/saju.spec.ts'), 'utf8');
    expect(real).toContain('분 기준으로 짚었고/');
    expect(testsNamingLiterally(texts, [['e2e/saju.spec.ts', real]], ts)).toEqual(['e2e/saju.spec.ts']);
    // 두 자 조각(`/^인연/` · `/채팅/`)만 겹치면 그대로 빠진다
    expect(testsNamingLiterally(['요청이 수락돼 인연 궁합이 열리면'], [['e2e/m.spec.ts', 'page.getByText(/^인연/);']], ts)).toEqual([]);
  });

  it('값이 곧 동작인 요소의 글자(option · textarea · style · script · Script)는 몇 겹 아래든 문구가 아니다', () => {
    expect(copyOf(CARD, edit('<option>요청자</option>', '<option>보낸 사람</option>'))).toBeNull();
    const style = 'export const S = () => <style>body {"{"} color: red {"}"}</style>;\n';
    expect(copyOf(style, style.replace('color: red', 'color: blue'), 'app/s.tsx')).toBeNull();
    // 바로 위 요소만 보면 아래 글자가 문구로 통과했다(2026-10-09 외부 검토) — 조상 전체로 내려간다
    const deep = (inner: string) => `export const S = () => <div><p>머리</p>${inner}</div>;\n`;
    for (const [inner, from, to] of [
      ['<select><option><span>allow</span></option></select>', 'allow', 'deny'],
      ['<select><option><>월</></option></select>', '월', '화'],
      ['<select><option>{x ? <b><i>하나</i></b> : null}</option></select>', '하나', '둘'],
      ['<textarea><span>기본 값</span></textarea>', '기본 값', '다른 값'],
      ['<style><span>a {"{"} color: red {"}"}</span></style>', 'red', 'blue'],
      ['<script><span>window.x = 1</span></script>', 'window.x = 1', 'window.x = 2'],
      ['<Script id="s">window.x = 1</Script>', 'window.x = 1', 'window.x = 2'],
      ['<Script id="s"><>window.x = 1</></Script>', 'window.x = 1', 'window.x = 2'],
    ] as const) {
      const before = deep(inner);
      expect(copyOf(before, before.replace(from, to), 'app/s.tsx'), inner).toBeNull();
    }
    // 그 밖의 자리는 그대로 문구다 — 같은 파일의 바깥 글자, 이름 모르는 대문자 컴포넌트의 글자
    const outside = deep('<select><option><span>allow</span></option></select>');
    expect(copyOf(outside, outside.replace('머리', '머리글'), 'app/s.tsx')).toEqual(['머리', '머리글']);
    // `next/script` 를 다른 이름으로 받으면 그 이름도 뺀다 · 이름 붙여 · 네임스페이스로 받으면 그 파일은 문구로 세지 않는다
    const renamed = "import NS from 'next/script';\nexport const S = () => <div><p>머리</p><NS id=\"s\">window.x = 1</NS></div>;\n";
    expect(copyOf(renamed, renamed.replace('window.x = 1', 'window.x = 2'), 'app/s.tsx')).toBeNull();
    expect(copyOf(renamed, renamed.replace('머리', '머리글'), 'app/s.tsx')).toEqual(['머리', '머리글']);
    for (const binding of ['* as NS', '{ default as NS }']) {
      const unknown = renamed.replace('NS from', `${binding} from`);
      expect(copyOf(unknown, unknown.replace('머리', '머리글'), 'app/s.tsx'), binding).toBeNull();
    }
    // `require` · 동적 `import()` 로 부르면 판별이 안 선다(재검토)
    for (const load of ["const NS = require('next/script');", "const NS = (await import('next/script')).default;"]) {
      const loaded = renamed.replace("import NS from 'next/script';", load);
      expect(copyOf(loaded, loaded.replace('머리', '머리글'), 'app/s.tsx'), load).toBeNull();
    }
    expect(
      copyConstantMisuses(ts, 'app/a.tsx', "const S = require('next/script');\nexport const A = () => <p>{NOTE}</p>;\n", ['NOTE']),
    ).toEqual(['app/a.tsx: next/script 를 판별 못 함']);
    const button = 'export const S = () => <Button>보내기</Button>;\n';
    expect(copyOf(button, button.replace('보내기', '요청 보내기'), 'app/s.tsx')).toEqual(['보내기', '요청 보내기']);
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
    expect(copyOnlyChanged(ts, file, before, before.replace('채팅방이 열려요', '대화방이 열려요'))).toEqual([
      '상대가 수락하면 채팅방이 열려요.',
      '상대가 수락하면 대화방이 열려요.',
    ]);
    expect(copyOnlyChanged(ts, file, before, before.replace('`둘째`', '`둘째 줄`'))).toEqual(['둘째', '둘째 줄']);
    expect(copyOnlyChanged(ts, file, before, before.replace('NOTE', 'NOTE_2'))).toBeNull();
    expect(copyOnlyChanged(ts, file, before, `${before}export const MORE = '셋';\n`)).toBeNull();
    // 모양을 벗어난 파일(import · 식 · 타입 표기 · let · 내보내지 않음)은 문자열이 문구 자리가 아니다
    for (const extra of ["import { x } from './x';\n", 'export const N = 1;\n', "export const T: string = 'a';\n", "export let L = 'a';\n", "const HIDDEN = 'a';\n"]) {
      const shaped = `${extra}${before}`;
      expect(copyOnlyChanged(ts, file, shaped, shaped.replace('채팅방이 열려요', '대화방이 열려요')), extra).toBeNull();
    }
  });

  it('문구 상수 파일은 목록과 이름이 짝이고, 모양을 지키고, 그 이름은 화면(.tsx)의 글자 자리와 시험(*.test.ts · e2e/**)만 부른다 — 용도가 확인된 문구만 든다', () => {
    const libs = readdirSync(resolve(ROOT, 'src/lib'), { withFileTypes: true }).filter((one) => one.isDirectory());
    const named = libs.map((one) => `src/lib/${one.name}/copy.ts`).filter((file) => existsSync(resolve(ROOT, file)));
    expect([...named].sort()).toEqual([...COPY_FILES].sort());
    const walk = (dir: string): string[] => codeUnder(resolve(ROOT, dir)).map((file) => relative(ROOT, file).split(sep).join('/'));
    // 뿌리의 `*.ts` · `*.mjs`(`proxy.ts` · `next.config.ts` · `instrumentation.ts` …)도 훑는다
    const roots = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(?:tsx?|mjs)$/.test(entry.name))
      .map((entry) => entry.name);
    const sources = ['app', 'src', 'e2e', 'scripts']
      .flatMap(walk)
      .concat(roots)
      .map((file) => [file, readFileSync(resolve(ROOT, file), 'utf8')] as const);
    for (const file of COPY_FILES) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
      expect(copyConstantsShape(ts, tree), file).toBe(true);
      const constants = copyConstantsOf(ts, tree)!;
      const names = [...constants.keys()];
      const tables = names.filter((name) => constants.get(name)!.kind === 'table');
      expect(names.length, file).toBeGreaterThan(0);
      // 이름으로 부르든 모듈을 들이든(별칭 · 네임스페이스) 부르는 파일이다
      const copyModule = file.replace(/\.ts$/, '');
      const importing = new RegExp(`(?:\\bfrom|\\bimport\\s*\\()\\s*['"][^'"\\n]*${copyModule.replace(/^src\//, '')}(?:\\.ts)?['"]`);
      for (const name of names) {
        const callers = sources
          .filter(([one, text]) => one !== file && (new RegExp(`\\b${name}\\b`).test(text) || importing.test(text)))
          .map(([one]) => one);
        expect(callers.length, name).toBeGreaterThan(0);
        // 시험(e2e · 흐름 검사)은 그 상수를 읽어 화면을 찾는다 — 이름으로 읽으면 글자가 바뀌어도 시험을 고칠 일이 없다(G-90)
        expect(
          callers.filter((one) => !/^app\/.+\.tsx$/.test(one) && !/\.test\.tsx?$/.test(one) && !/^e2e\//.test(one) && !/^scripts\/check-[^/]+\.mjs$/.test(one)),
          name,
        ).toEqual([]);
        // 화면 안에서도 글자 자리(JSX 자식 `{NAME}` · 글자 속성의 값)에만 선다 — `href={NAME}` · 함수 인자 · 비교 · 키 · 다시 내보내기는 안 된다
        for (const caller of callers.filter((one) => /^app\/.+\.tsx$/.test(one))) {
          const text = sources.find(([one]) => one === caller)![1];
          expect(copyConstantMisuses(ts, caller, text, names, copyModule, tables), `${caller} 의 ${name}`).toEqual([]);
        }
      }
    }
  });

  it('문구 상수는 JSX 자식 · 글자 속성(aria-label · title · alt · placeholder)의 값으로만 쓰인다 — 경로 · 키로 쓰면 잠금이 붉다', () => {
    expect(COPY_ATTRIBUTES).toEqual(['aria-label', 'title', 'alt', 'placeholder']);
    const ok = [
      "import { NOTE } from '@/src/lib/matching/copy';",
      'export const A = () => (',
      '  <div title={NOTE}>',
      '    <p>{NOTE}</p>',
      '    <><span>{NOTE}</span></>',
      '    <input placeholder={NOTE} aria-label={NOTE} />',
      '    <img alt={NOTE} src="/a.png" />',
      '  </div>',
      ');',
      '',
    ].join('\n');
    expect(copyConstantMisuses(ts, 'app/a.tsx', ok, ['NOTE'])).toEqual([]);
    // 검토가 든 재현 — 문구 파일에 경로를 두고 `href` 로 쓰면 그 값 변경이 문구로 셌다
    const misuse = (line: string) =>
      copyConstantMisuses(ts, 'app/a.tsx', `import { NOTE } from '@/src/lib/matching/copy';\nexport const A = () => ${line};\n`, ['NOTE']);
    expect(misuse('<a href={NOTE}>도움말</a>')).toEqual(['NOTE:2']);
    expect(misuse('<p key={NOTE}>x</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p data-testid={NOTE}>x</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{NOTE.trim()}</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{NOTE === "a" ? 1 : 2}</p>')).toEqual(['NOTE:2']);
    expect(misuse('<p>{`${NOTE}`}</p>')).toEqual(['NOTE:2']);
    expect(misuse('fetch(NOTE)')).toEqual(['NOTE:2']);
    expect(misuse('({ [NOTE]: 1 })')).toEqual(['NOTE:2']);
    // 글자 하나만 감싼 프래그먼트를 프롭으로 넘기면 그 글자를 넘긴 것과 같다(#852 — 확인 창은 단추 글자 길이를 잰다)
    expect(misuse('<Dialog confirmLabel={<>{NOTE}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={busy ? "a" : <>{NOTE}</>} />')).toEqual(['NOTE:2']);
    // 공백 글자 · 공백 식을 곁들여도 같다(#853 검토)
    expect(misuse('<Dialog confirmLabel={<> {NOTE}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={<>{NOTE}{" "}</>} />')).toEqual(['NOTE:2']);
    expect(misuse('<Dialog confirmLabel={<>\n  {NOTE}\n</>} />')).toEqual(['NOTE:3']);
    // 요소를 프롭으로 넘겨 그리는 자리(빈 칸 · 바닥 단추)는 된다
    expect(misuse('<Sheet footer={<a href="/me">{NOTE}</a>} />')).toEqual([]);
    expect(misuse('<Sheet footer={<><i />{NOTE}</>} />')).toEqual([]);
    expect(copyConstantMisuses(ts, 'app/a.tsx', 'const broken = (;\n', ['NOTE'])).toEqual(['app/a.tsx: 파싱 실패']);
  });

  it('문구 상수 쓰임 — 값 · 코드 요소 안의 자식 식 · 별칭 · 네임스페이스 · 다시 내보내기도 잰다 (2026-10-09 독립 검토)', () => {
    const head = "import { NOTE } from '@/src/lib/matching/copy';\n";
    const use = (body: string, prefix = head) => copyConstantMisuses(ts, 'app/a.tsx', `${prefix}${body}\n`, ['NOTE'], 'src/lib/matching/copy');
    // 값 · 코드 요소 안이면 몇 겹 아래든, 프래그먼트를 넘어서도 오용이다
    for (const inner of [
      '<select><option>{NOTE}</option></select>',
      '<select><option><>{NOTE}</></option></select>',
      '<select><option><span>{NOTE}</span></option></select>',
      '<textarea>{NOTE}</textarea>',
      '<style>{NOTE}</style>',
      '<script>{NOTE}</script>',
      '<Script id="s">{NOTE}</Script>',
    ]) {
      expect(use(`export const A = () => <div>${inner}</div>;`), inner).toEqual(['NOTE:2']);
    }
    expect(use('export const A = () => <NS>{NOTE}</NS>;', `import NS from 'next/script';\n${head}`)).toEqual(['NOTE:3']);
    expect(use('export const A = () => <div><p>{NOTE}</p></div>;')).toEqual([]);
    // 별칭은 같은 상수다
    const alias = "import { NOTE as X } from '@/src/lib/matching/copy';\n";
    expect(use('export const A = () => <a href={X}>x</a>;', alias)).toEqual(['X:2']);
    expect(use('export const A = () => <p>{X}</p>;', alias)).toEqual([]);
    // 네임스페이스 — `C.NOTE` 는 같은 판정, `C` 를 통째로 쓰면 오용
    const space = "import * as C from '@/src/lib/matching/copy';\n";
    expect(use('export const A = () => <p title={C.NOTE}>{C.NOTE}</p>;', space)).toEqual([]);
    expect(use('export const A = () => <a href={C.NOTE}>x</a>;', space)).toEqual(['NOTE:2']);
    expect(use('export const all = Object.values(C);', space)).toEqual(['C:2']);
    expect(use('export const A = () => <a href={C.NOTE}>x</a>;', "import * as C from '../../src/lib/matching/copy';\n")).toEqual([]);
    expect(
      copyConstantMisuses(ts, 'app/me/a.tsx', "import * as C from '../../src/lib/matching/copy';\nexport const A = () => <a href={C.NOTE}>x</a>;\n", ['NOTE'], 'src/lib/matching/copy'),
    ).toEqual(['NOTE:2']);
    // 다시 내보내기는 오용이다
    expect(use('export { NOTE };')).toEqual(['NOTE:2']);
    expect(use("export { NOTE as PATH } from '@/src/lib/matching/copy';", '')).toEqual(['NOTE:1']);
    expect(use("export * from '@/src/lib/matching/copy';", '')).toEqual(['*:1']);
    expect(use("export * as C from '@/src/lib/matching/copy';", '')).toEqual(['*:1']);
    // 동적으로 들이면 오용이다 — 그 이름이 어디서 쓰이는지 따라가지 못한다
    expect(use("export const load = async () => (await import('@/src/lib/matching/copy')).NOTE;", '')).toEqual(['import():1']);
    expect(use("const c = require('../src/lib/matching/copy');", '')).toEqual(['import():1']);
    // `next/script` 를 이름 붙여 받으면 판별이 안 선다
    expect(use('export const A = () => <p>{NOTE}</p>;', `import { default as S } from 'next/script';\n${head}`)).toEqual(['app/a.tsx: next/script 를 판별 못 함']);
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

  it('문구 판정은 좁히기만 한다 — check-share 가 옛 글자를 말해도 지금 규칙이 core 인 문구 파일은 core 그대로 (운영자 2026-10-09)', () => {
    const file = 'src/lib/account/copy.ts';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    const share = 'scripts/check-share.mjs';
    const plan = planOf(file, before, before.replace('테스트 코드가 필요해요', '테스트 코드가 있어야 해요'), ['docs/product/copy-ledger.md'], '운영 베타', [
      [share, readFileSync(resolve(ROOT, share), 'utf8')],
    ]);
    expect(plan.tier).toBe('core');
    expect(plan.lanes).toEqual(CORE_ONLY);
  });

  it('입구 page 의 문구 — 말하는 시험 없음은 core, 지금 규칙 안의 차선이면 그것, 넓으면 지금 규칙, 동작이 섞이면 지금 규칙', () => {
    const file = 'app/me/people/page.tsx';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    const after = before.replace('>저장한 사람<', '>저장한 이<');
    expect(after).not.toBe(before);
    const existing = planFor({ files: [file], stage: '운영 베타' });
    expect(existing.tier).toBe('narrow');
    // 말하는 시험 없음 → core
    expect(planOf(file, before, after).lanes).toEqual(CORE_ONLY);
    // 글자 그대로 찾는 시험이 있으면 문구만이 아니다 → 지금 규칙(운영자 2026-10-10)
    const literal = planOf(file, before, after, [], '운영 베타', [['e2e/match.spec.ts', "page.getByText('저장한 사람');"]]);
    expect(literal.lanes).toEqual(existing.lanes);
    expect(literal.authedLanes).toEqual(existing.authedLanes);
    // 글자 없이 화면을 찾는 정규식은 차선만 켠다 — 지금 규칙 안의 차선(match) → core + match
    const inside = planOf(file, before, after, [], '운영 베타', [['e2e/match.spec.ts', SCREEN_REGEX]]);
    expect(inside.tier).toBe('narrow');
    expect(inside.lanes).toEqual({ ...CORE_ONLY, authed: true });
    expect(inside.authedLanes).toEqual(['match:desktop', 'match:mobile']);
    // 지금 규칙에 없는 차선(chat)을 켜면 지금 규칙 그대로 — 넓히지 않는다
    const wider = planOf(file, before, after, [], '운영 베타', [['e2e/chat.spec.ts', SCREEN_REGEX]]);
    expect(wider.lanes).toEqual(existing.lanes);
    expect(wider.authedLanes).toEqual(existing.authedLanes);
    // 검색이 전부(spec 아닌 도우미)를 부르면 지금 규칙 그대로
    const helper = planOf(file, before, after, [], '운영 베타', [['e2e/session.ts', SCREEN_REGEX]]);
    expect(helper.lanes).toEqual(existing.lanes);
    // 문구와 동작이 섞이면 문구가 아니라 지금 규칙
    const mixed = planOf(file, before, after.replace('className={TYPE_TITLE}', 'className={TYPE_DISPLAY}'));
    expect(mixed.lanes).toEqual(existing.lanes);
  });

  it('정규식은 확실히 풀 수 있는 모양(통째 리터럴 · 이스케이프 · 맨 위 `|` 갈래 · 맨 앞뒤 `^ $`)만 글자로 푼다', () => {
    expect(regexShape('채팅방이')).toEqual({ literals: ['채팅방이'] });
    expect(regexShape('^채팅방이 열려요\\.$')).toEqual({ literals: ['채팅방이 열려요.'] });
    expect(regexShape('예시|연결 준비 중')).toEqual({ literals: ['예시', '연결 준비 중'] });
    expect(regexShape('\\/me\\/requests')).toEqual({ literals: ['/me/requests'] });
    // 그 밖은 기호를 지워 견주지 않는다 — 기호 사이의 글자 조각과, `\d` · `\s` 류에 붙은 조각만 든다
    expect(regexShape('수락하면.*열려요')).toEqual({ fragments: ['수락하면', '열려요'], nearClass: [] });
    expect(regexShape('(?:예시|연결 준비 중)')).toEqual({ fragments: ['예시', '연결 준비 중'], nearClass: [] });
    expect(regexShape('상대가\\s+수락[가-힣]{2}열려요')).toEqual({ fragments: ['상대가', '수락', '열려요'], nearClass: ['상대가', '수락'] });
    expect(regexShape('열려요?')).toEqual({ fragments: ['열려요'], nearClass: [] });
    expect(regexShape('<[^>]+>')).toEqual({ fragments: ['<', '>'], nearClass: [] });
    expect(regexShape('\\d+개')).toEqual({ fragments: ['개'], nearClass: ['개'] });
    expect(regexShape('1\\s*명')).toEqual({ fragments: ['1', '명'], nearClass: ['1', '명'] });
    expect(regexShape('^\\d+초$')).toEqual({ fragments: ['초'], nearClass: ['초'] });
  });

  it('정규식도 바뀐 글자와 관련될 수 있으면 차선을 켠다 — 한글 두 자 · 그 밖 넉 자부터, 글자 갈래에 붙은 한글은 한 자도', () => {
    const notes = new Map([['src/lib/matching/copy.ts', ['상대가 수락하면 채팅방이 열려요.', '상대가 수락하면 대화방이 열려요.']]]);
    const spec = (line: string) => [['e2e/match.spec.ts', line] as const];
    const hits = (texts: string[], line: string) => lanesFor(new Map([['app/x.tsx', texts]]), spec(line)).tests;
    // 검토가 든 재현 — 기호가 낀 정규식이 「상대가 수락하면 채팅방이 열려요.」를 말하는 spec 을 못 찾았다
    for (const body of ['/채팅방이 열려요\\./', '/수락하면.*열려요/', '/^상대가 수락하면/', '/수락하면\\s+채팅방이/', '/(채팅|대화)방이 열려요/']) {
      expect(lanesFor(notes, spec(`await expect(page.getByText(${body})).toBeVisible();`)).tests, body).toEqual(['e2e/match.spec.ts']);
    }
    // 둘째 검토가 든 재현 — 확실히 푼 정규식이 넉 자 문턱에 걸렸다(Playwright 의 정규식은 부분 일치)
    for (const body of ['/수락/', '/채팅/', '/^상대/']) {
      expect(lanesFor(notes, spec(`await page.getByRole('dialog', { name: ${body} }).click();`)).tests, body).toEqual(['e2e/match.spec.ts']);
    }
    expect(hits(['인연 요청', '인연 신청'], "page.getByRole('heading', { name: /^인연/ })")).toEqual(['e2e/match.spec.ts']);
    // 한글 없는 것은 넉 자부터 · `i` 깃발이면 대소문자를 접는다
    expect(hits(['Send Request'], 'page.getByText(/send/)')).toEqual([]);
    expect(hits(['Send Request'], 'page.getByText(/send request/)')).toEqual([]);
    expect(hits(['Send Request'], 'page.getByText(/send request/i)')).toEqual(['e2e/match.spec.ts']);
    // 글자 갈래(`\d` · `\s`)에 붙은 한글은 한 자라도 견준다 — 붙지 않은 한 자는 안 본다
    expect(hits(['3개 남았어요', '3개 있어요'], 'expect(text).toMatch(/\\d+개/);')).toEqual(['e2e/match.spec.ts']);
    expect(hits(['함께 1 명', '함께 한 명'], 'expect(text).toMatch(/1\\s*명/);')).toEqual(['e2e/match.spec.ts']);
    expect(hits(['10초 뒤', '곧'], 'expect(text).toMatch(/^\\d+초$/);')).toEqual(['e2e/match.spec.ts']);
    // 글자가 있는데 견줄 만큼 길지 않으면 판단이 안 서 켠다(운영자 2026-10-09)
    expect(hits(['함께 3명', '함께 셋'], 'expect(text).toMatch(/명.*/);')).toEqual(['e2e/match.spec.ts']);
    // 글자 조각이 길고 바뀐 글자와 관련 없으면 켜지 않는다
    expect(lanesFor(notes, spec('page.getByText(/잠깐.*기다려/)')).tests).toEqual([]);
    // 재검토가 든 재현 — `=>` 뒤 · `+` 뒤 · `case` 뒤의 정규식도 읽는다
    for (const line of ['const ok = (t: string) => /수락/.test(t);', "const r = '' + /수락/.source;", 'switch (x) { case /수락/.source: break; }']) {
      expect(hits(['수락하기', '받기'], line), line).toEqual(['e2e/match.spec.ts']);
    }
    // 파서가 가른다 — 주석 속 `/…/` 와 나눗셈은 정규식이 아니다
    expect(lanesFor(notes, spec('// 화면 a/채팅방이/b 를 본다\nconst x = a / 채팅 / b;')).tests).toEqual([]);
  });

  it('글자 없는 정규식은 쓰임 자리로 가른다 — 화면 자리 · 그 밖 · 글자 모름은 켜고, 문자열 정리만 안 켠다 (운영자 2026-10-09)', () => {
    const notes = new Map([['src/lib/matching/copy.ts', ['상대가 수락하면 채팅방이 열려요.', '상대가 수락하면 대화방이 열려요.']]]);
    const on = (line: string) => lanesFor(notes, [['e2e/match.spec.ts', line] as const]).tests.length === 1;
    // 화면 요소를 찾거나 재는 자리
    for (const line of [
      'page.getByText(/^\\s*$/);',
      "page.getByRole('button', { name: /^\\d+$/ });",
      'page.getByLabel(/.+/);',
      'rows.filter({ hasText: /\\d/ });',
      'rows.filter({ hasNotText: /\\d/ });',
      'await expect(el).toHaveText([/.+/, /\\d+/]);',
      'await expect(el).toContainText(/\\d+/);',
      'await expect(el).toHaveAccessibleName(/.+/);',
      'await expect(page).toHaveTitle(/.+/);',
    ]) {
      expect(regexUsesIn(ts, 'e2e/match.spec.ts', line)!.every((use) => use.place === 'screen'), line).toBe(true);
      expect(on(line), line).toBe(true);
    }
    // 문자열 정리 — 그것만으로 켜지 않는다
    for (const line of ["const t = s.replace(/\\s+/g, ' ');", "const t = s.replaceAll(/\\d/g, '');", 'const parts = s.split(/,\\s*/);', "const t = s.replace(new RegExp(v, 'g'), '');"]) {
      expect(regexUsesIn(ts, 'e2e/match.spec.ts', line)!.every((use) => use.place === 'cleanup'), line).toBe(true);
      expect(on(line), line).toBe(false);
    }
    // 그 밖 · 판별 불가 — 켠다
    for (const line of ['const ok = /^\\d+$/.test(x);', 'const m = s.match(/\\d+/);', 'const re = /^\\d+$/;', 'const re = new RegExp(name);', "check('x', /\\s+/.exec(s));"]) {
      expect(on(line), line).toBe(true);
    }
    // 글자 모르는 RegExp 는 정리 자리만 빼고 켠다 · `replace` 의 둘째 인자 자리는 정리가 아니다
    expect(regexTurnsOn({ body: null, flags: '', place: 'cleanup' }, ['x'])).toBe(false);
    expect(regexTurnsOn({ body: null, flags: '', place: 'other' }, ['x'])).toBe(true);
    expect(on("const t = s.replace('a', String(/\\d/));")).toBe(true);
    // 파싱이 실패한 시험은 판별 불가라 켠다 · 정규식을 안 읽는 확장자는 글자만 견준다
    expect(on('const broken = (;')).toBe(true);
    expect(lanesFor(notes, [['e2e/fixture.txt', '/^\\d+$/'] as const]).tests).toEqual([]);
  });

  it('실측 — 저장소의 시험 파일을 파서로 읽어 정규식 리터럴을 다 잡고, 문구 한 줄은 검색이 전부를 불러도 지금 규칙(core)보다 넓어지지 않는다', () => {
    const walk = (dir: string): string[] =>
      filesUnder(resolve(ROOT, dir))
        .map((file) => relative(ROOT, file).split(sep).join('/'))
        .filter((file) => /\.(?:ts|mts|mjs|js)$/.test(file));
    const files = [...walk('e2e'), ...walk('scripts').filter((file) => /^scripts\/check-[^/]+\.mjs$/.test(file))];
    let literals = 0;
    let walked = 0;
    for (const file of files) {
      const source = readFileSync(resolve(ROOT, file), 'utf8');
      const uses = regexUsesIn(ts, file, source);
      expect(uses, `${file} 파싱`).not.toBeNull();
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const count = (node: ts.Node): number => (node.kind === ts.SyntaxKind.RegularExpressionLiteral ? 1 : 0) + node.getChildren(tree).reduce((sum, child) => sum + count(child), 0);
      walked += count(tree);
      literals += uses!.filter((use) => use.body !== null).length;
    }
    // 2026-10-09 검토 에이전트가 센 리터럴 315 개 — 그 뒤 시험이 늘면 늘 뿐 줄지 않게(줄면 셈이 빠진 것인지 본다)
    expect(walked).toBeGreaterThanOrEqual(315);
    expect(literals).toBeGreaterThanOrEqual(walked);
    // 검색만 보면 문구 한 줄이(요청 취소 창의 제목 — G-86 의 채팅방 줄은 2026-10-26 걷혔고, 되돌릴 수 없다는 줄은 #852 가 확인 창의 프롭으로 옮겼다) 전부를 부른다 — 글자 없는 정규식이 도우미(`e2e/birth-form.ts` 등)의 `.exec` ·
    // `.test` 에 선다. 그래도 문구 판정은 좁히기만 하므로 계획은 지금 규칙(core)보다 넓어지지 않는다
    const note = 'src/lib/matching/copy.ts';
    const noteBefore = readFileSync(resolve(ROOT, note), 'utf8');
    const noteTexts = copyOnlyChanged(ts, note, noteBefore, noteBefore.replace("'보낸 요청을 취소할까요?'", "'보낸 요청도 취소할까요?'"))!;
    const sources = files.map((file) => [file, readFileSync(resolve(ROOT, file), 'utf8')] as const);
    expect(lanesFor(new Map([[note, noteTexts]]), sources).lanes).toBeNull();
    // 다른 파일은 디스크에서 읽는다 — 아무 경로에나 같은 소스를 주면 관문의 import 를 끝없이 따라간다
    const disk = (one: string) => {
      try {
        return readFileSync(resolve(ROOT, one), 'utf8');
      } catch {
        return null;
      }
    };
    const notePlan = planFor({
      files: [note],
      stage: '운영 베타',
      ts,
      sourceOf: (one) => (one === note ? noteBefore.replace("'보낸 요청을 취소할까요?'", "'보낸 요청도 취소할까요?'") : disk(one)),
      baseSourceOf: (one) => (one === note ? noteBefore : disk(one)),
    });
    expect(notePlan.lanes).toEqual(CORE_ONLY);
    // 입구가 아닌 컴포넌트의 JSX 글자 한 줄 — 그 글자(「오늘의 인연」)를 match.spec 이 글자 그대로 찾아 문구만이 아니다. 지금 규칙은
    // 그 컴포넌트를 쓰는 입구의 차선이다(입구가 아닌 화면 컴포넌트)
    const screen = 'app/me/matching/matching-experience.tsx';
    const screenBefore = readFileSync(resolve(ROOT, screen), 'utf8');
    const screenAfter = screenBefore.replace('>오늘의 인연<', '>오늘의 사람<');
    expect(screenAfter).not.toBe(screenBefore);
    const screenPlan = planFor({
      files: [screen],
      stage: '운영 베타',
      ts,
      sourceOf: (one) => (one === screen ? screenAfter : disk(one)),
      baseSourceOf: (one) => (one === screen ? screenBefore : disk(one)),
    });
    expect(screenPlan.tier).toBe('narrow');
    expect(screenPlan.lanes).toEqual(beta([screen]).lanes);
    expect(screenPlan.authedLanes).toEqual(beta([screen]).authedLanes);
    expect(screenPlan.authedLanes).toContain('match:desktop');
  });

  it('새 글자를 말하는 spec 도 차선을 켠다 — 「없어야」 하는 글자 · getByRole 의 이름과 겹칠 수 있다', () => {
    const screen = 'export const S = () => <p>연결 중이에요</p>;\n';
    const texts = copyOnlyChanged(ts, 'app/me/s.tsx', screen, screen.replace('연결 중이에요', '연결 준비 중'));
    expect(texts).toEqual(['연결 중이에요', '연결 준비 중']);
    const absent = [['e2e/match.spec.ts', 'await expect(page.getByText(/예시|연결 준비 중/)).toHaveCount(0);'] as const];
    expect(lanesFor(new Map([['app/me/s.tsx', texts!]]), absent).tests).toEqual(['e2e/match.spec.ts']);
    // 옛 글자만 찾으면 안 걸렸다
    expect(lanesFor(new Map([['app/me/s.tsx', ['연결 중이에요']]]), absent).tests).toEqual([]);
  });

  it('옛 글자를 spec 이 말하면 그 spec 의 차선이 선다 — 통째로든 리터럴 · 정규식 조각으로든, spec 아닌 e2e 면 전부', () => {
    const olds = new Map([['app/me/matching/request-card.tsx', ['요청을 보내면 상대의 인연 탭에 하나가 뜹니다.']]]);
    const spec = (body: string) => [['e2e/match.spec.ts', body] as const];
    expect(lanesFor(olds, spec("await expect(page.getByText('요청을 보내면 상대의 인연 탭에 하나가 뜹니다.')).toBeVisible();"))).toEqual({
      lanes: lanesOfTest('e2e/match.spec.ts'),
      tests: ['e2e/match.spec.ts'],
    });
    expect(lanesOfTest('e2e/match.spec.ts')).toEqual(['match:desktop', 'match:mobile']);
    expect(lanesFor(olds, spec('await page.getByText(/인연 탭에/).click();')).tests).toEqual(['e2e/match.spec.ts']);
    expect(lanesFor(olds, spec("await page.getByText('하나가 뜹니다').click();")).tests).toEqual(['e2e/match.spec.ts']);
    expect(lanesFor(olds, spec("await page.getByRole('button', { name: '보내기' }).click();"))).toEqual({ lanes: [], tests: [] });
    expect(lanesFor(olds, [['e2e/session.ts', "const x = '인연 탭에';"]]).lanes).toBeNull();
    expect(lanesFor(olds, [['scripts/check-chat.mjs', "check('x', html.includes('인연 탭에'));"]]).lanes).toEqual(['flow']);
  });

  it('좁히기는 부분집합일 때만 — 같으면 같고, 비교할 수 없으면(다른 차선이 섞이면) 지금 규칙, 차선을 바꿔치지 않는다', () => {
    const file = 'app/me/people/page.tsx';
    const before = readFileSync(resolve(ROOT, file), 'utf8');
    const after = before.replace('>저장한 사람<', '>저장한 이<');
    const existing = planFor({ files: [file], stage: '운영 베타' });
    const withMention = (spec: string) => planOf(file, before, after, [], '운영 베타', [[spec, SCREEN_REGEX]]);
    // 부분집합(core + match ⊂ 지금 규칙) → 채택
    expect(withMention('e2e/match.spec.ts').authedLanes).toEqual(['match:desktop', 'match:mobile']);
    // 같다(signed-in 이 지금 규칙의 차선 · 그 밖은 core 하나 더) → 부분집합이라 채택, 넓어지지 않는다
    const same = withMention('e2e/signed-in.spec.ts');
    expect(same.authedLanes.every((lane) => existing.authedLanes.includes(lane))).toBe(true);
    // 비교할 수 없다 — chat 은 지금 규칙에 없다. 차선 수는 더 적어도(core + chat 둘 < 지금 일곱) 지금 규칙 그대로다
    const swapped = withMention('e2e/chat.spec.ts');
    expect(swapped.lanes).toEqual(existing.lanes);
    expect(swapped.authedLanes).toEqual(existing.authedLanes);
    expect(swapped.authedLanes).not.toContain('chat:desktop');
  });

  it('여러 파일이 섞인 PR — 파일마다 정한 계획의 합이라 동작이 바뀐 파일의 차선은 문구 파일 때문에 빠지지 않는다', () => {
    const page = 'app/me/people/page.tsx';
    const before = readFileSync(resolve(ROOT, page), 'utf8');
    const after = before.replace('>저장한 사람<', '>저장한 이<');
    const mixed = (others: string[]) =>
      planFor({
        files: [page, ...others],
        stage: '운영 베타',
        ts,
        mentions: [],
        sourceOf: (one) => (one === page ? after : null),
        baseSourceOf: (one) => (one === page ? before : null),
      });
    // 문구만 바뀐 page + 동작이 바뀐 공용 위험 파일 → 전부
    expect(mixed(['proxy.ts']).tier).toBe('full');
    // 문구만 바뀐 page + `supabase/**` → 전부
    expect(mixed(['supabase/migrations/20261010000000_x.sql']).tier).toBe('full');
    // 문구만 바뀐 page + 동작이 바뀐 다른 page → 그 page 의 주소 차선이 남는다
    const other = 'app/me/matching/page.tsx';
    const alone = planFor({ files: [other], stage: '운영 베타' });
    const both = mixed([other]);
    expect(alone.authedLanes.length).toBeGreaterThan(0);
    for (const lane of alone.authedLanes) expect(both.authedLanes, lane).toContain(lane);
    expect(both.lanes.flow).toBe(alone.lanes.flow);
    expect(both.lanes.anon).toBe(alone.lanes.anon);
  });

  it('PR 계획 — 입구가 아닌 컴포넌트는 그것을 쓰는 입구의 차선이고, 옛 글자를 spec 이 글자 그대로 찾으면 문구로 좁히지 않는다(저장소의 match.spec 이 「수락해서 채팅방이 열렸어요.」를 말한다)', () => {
    const file = 'app/me/requests/status-line.tsx';
    const page = 'app/me/requests/page.tsx';
    const before = 'export const S = () => <p>수락해서 채팅방이 열렸어요.</p>;\n';
    const after = before.replace('열렸어요', '열렸습니다');
    const match = 'e2e/match.spec.ts';
    const pageSource = `import { S } from './status-line';\n${diskOf(page)}`;
    const plan = planFor({
      files: [file],
      stage: '운영 베타',
      ts,
      mentions: [[match, readFileSync(resolve(ROOT, match), 'utf8')]],
      sourceOf: (one) => (one === file ? after : one === page ? pageSource : diskOf(one)),
      baseSourceOf: (one) => (one === file ? before : diskOf(one)),
    });
    expect(plan.tier).toBe('narrow');
    expect(plan.lanes).toEqual(beta([page]).lanes);
    expect(plan.authedLanes).toEqual(beta([page]).authedLanes);
    // 아무도 안 부르는 컴포넌트는 쓰는 입구를 못 찾아 전부다
    expect(planOf(file, before, after, [], '운영 베타', [[match, readFileSync(resolve(ROOT, match), 'utf8')]]).cause).toBe('주소 없음');
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
    expect(plan.build).toBe(true);
  });

  /**
   * **코드가 문구만 바뀐 PR 은 `core` 에서 빌드를 뺀다**(운영자 2026-10-12, ADR 0178). 빌드를 core 에 넣은 까닭(#219)은
   * `app/**\/icon.tsx` 의 이름 · 모양 실패였고 문구 한 줄로는 안 생긴다. 단위 · 타입 · 린트와 바뀐 글자를 찾는 시험의 차선은 남는다.
   * 문구 밖의 코드가 하나라도 섞이면 · 라벨 · 공개 출시 · main 푸시 · 일정은 빌드가 돈다
   */
  it('문구만 바뀐 PR 은 빌드를 건너뛴다 — 문서가 섞여도, 그 밖의 코드 · 라벨 · 공개 출시 · 푸시면 빌드가 돈다', () => {
    const changed = edit('하나가 뜹니다.', '하나가 떠요.');
    const copyPr = planOf('app/me/matching/request-card.tsx', CARD, changed);
    expect(copyPr.lanes.core).toBe(true);
    expect(copyPr.build).toBe(false);
    expect(copyPr.reason).toContain('빌드는 건너뛴다');
    expect(summaryOf(copyPr, ['app/me/matching/request-card.tsx'])).toContain('`core` 의 빌드 | 건너뛴다');
    expect(planOf('app/me/matching/request-card.tsx', CARD, changed, ['docs/product/copy-ledger.md']).build).toBe(false);
    // 문구 밖의 코드가 섞이면 — 새 파일(base 없음)은 문구로 안 센다
    expect(planOf('app/me/matching/request-card.tsx', CARD, changed, ['src/lib/matching/pool.ts']).build).toBe(true);
    expect(planOf('app/me/matching/request-card.tsx', CARD, changed, ['proxy.ts']).build).toBe(true);
    // 문구가 아니면 — 속성 값
    expect(planOf('app/me/matching/request-card.tsx', CARD, edit('mt-2', 'mt-3')).build).toBe(true);
    expect(planOf('app/me/matching/request-card.tsx', CARD, changed, [], '공개 출시').build).toBe(true);
    const labelled = planFor({
      files: ['app/me/matching/request-card.tsx'],
      labels: [FULL_LABEL],
      stage: '운영 베타',
      ts,
      mentions: [],
      sourceOf: () => changed,
      baseSourceOf: () => CARD,
    });
    expect(labelled.build).toBe(true);
    // 정책만이면 core 가 없으니 빌드도 없다
    expect(beta(['docs/prd.md']).build).toBe(false);
    expect(beta(['src/lib/matching/pool.ts']).build).toBe(true);
  });

  it('메타데이터 파일(icon · opengraph-image …)은 문구만 바뀌어도 빌드가 돈다 — 빌드 때 그림을 그린다(#682 독립 검토)', () => {
    const image = "export default function Image() {\n  return <div style={{ display: 'flex' }}>사주 궁합</div>;\n}\n";
    for (const file of ['app/opengraph-image.tsx', 'app/icon.tsx', 'app/apple-icon.tsx', 'app/share/[id]/twitter-image.tsx']) {
      const plan = planOf(file, image, image.replace('사주 궁합', '사주 보기'));
      expect(plan.reason, file).toContain('문구만 바뀐 파일은 core 로 셌다');
      expect(plan.build, file).toBe(true);
    }
  });
});

describe('묶음 배포의 기다림 — 마지막 초록부터 HEAD 까지의 커밋마다 문구 · 문서뿐인가 (ADR 0159)', () => {
  const GREEN = 'a'.repeat(40);
  const HEAD = 'b'.repeat(40);
  const FROM = 'f'.repeat(40);
  const CARD = 'export const C = () => <p>요청을 보냈어요</p>;\n';
  type Commit = NonNullable<Parameters<typeof deployRangeOf>[0]['commits']>[number];
  let serial = 0;
  /** 커밋 하나 — `sources` 는 파일마다 `[부모 쪽, 이 커밋 쪽]` */
  const commit = (files: string[] | null, sources: Record<string, [string | null, string | null]> = {}): Commit => ({
    sha: `${(serial += 1).toString(16).padStart(7, '0')}${'c'.repeat(33)}`,
    files,
    sourceOf: (file) => sources[file]?.[1] ?? null,
    baseSourceOf: (file) => sources[file]?.[0] ?? null,
  });
  const range = (commits: Commit[] | null, more: Partial<Parameters<typeof deployRangeOf>[0]> = {}) =>
    deployRangeOf({ lastGreen: GREEN, head: HEAD, commits, ts, unpassed: [], mainRed: null, ...more });
  const copyCommit = () => commit(['app/me/card.tsx'], { 'app/me/card.tsx': [CARD, CARD.replace('보냈어요', '보냈습니다')] });
  const docsCommit = () => commit(['docs/prd.md', 'scripts/ci-plan.test.ts']);
  const behaviorCommit = () => commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['export const x = 1;\n', 'export const x = 2;\n'] });
  const revertCommit = () => commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['export const x = 2;\n', 'export const x = 1;\n'] });

  it('문구 커밋만 · 문서 커밋과 문구 커밋은 copy, 문서 · 주석뿐이면 docs-only', () => {
    const copy = range([copyCommit(), copyCommit(), copyCommit()]);
    expect(copy.verdict).toBe('copy');
    expect(copy.copy).toEqual(['app/me/card.tsx']);
    expect(range([docsCommit(), copyCommit()]).verdict).toBe('copy');
    expect(range([docsCommit()]).verdict).toBe('docs-only');
    const commented = commit(['src/lib/chat/index.ts'], { 'src/lib/chat/index.ts': ['// 옛\nexport const x = 1;\n', '// 새\nexport const x = 1;\n'] });
    expect(range([docsCommit(), commented]).verdict).toBe('docs-only');
    // 바꾼 파일이 없는 커밋은 문서로 센다
    expect(range([commit([])]).verdict).toBe('docs-only');
  });

  it('그 커밋의 시험을 못 읽으면 던지지 않고 wait 로 답한다 — 까닭에 커밋과 오류가 든다 (재검토 2026-10-10)', () => {
    const broken = { ...copyCommit(), mentions: () => { throw new Error('fatal: bad object deadbeef\nmore'); } };
    const waited = range([docsCommit(), broken]);
    expect(waited.verdict).toBe('wait');
    expect(waited.reason).toContain('그 커밋의 시험을 못 읽었다 — ');
    expect(waited.reason).toContain(broken.sha.slice(0, 7));
    expect(waited.reason).toContain('fatal: bad object deadbeef');
    expect(waited.reason).not.toContain('more');
    // `--from` 쪽 범위에서 못 읽어도 같다
    const viaFrom = range([docsCommit()], { from: FROM, fromCommits: [broken] });
    expect(viaFrom.verdict).toBe('wait');
    expect(viaFrom.reason).toContain('그 커밋의 시험을 못 읽었다');
    // 문구 후보가 없는 커밋은 시험을 읽지 않는다
    const unused = { ...docsCommit(), mentions: () => { throw new Error('읽으면 안 된다'); } };
    expect(range([unused]).verdict).toBe('docs-only');
  });

  it('범위를 끝과 끝이 아니라 커밋마다 가른다 — 동작 변경 → 되돌림 → 문구 커밋이면 기다린다', () => {
    const waited = range([behaviorCommit(), revertCommit(), copyCommit()]);
    expect(waited.verdict).toBe('wait');
    expect(waited.behavior).toHaveLength(2);
    expect(waited.behavior.every((one) => one.endsWith(':src/lib/chat/index.ts'))).toBe(true);
    expect(range([copyCommit(), behaviorCommit()]).verdict).toBe('wait');
    expect(range([commit(['supabase/migrations/20261009000000_x.sql'])]).verdict).toBe('wait');
    expect(range([commit(['app/me/new.tsx'], { 'app/me/new.tsx': [null, CARD] })]).verdict).toBe('wait');
    // 바뀐 파일을 못 읽은 커밋(부모 없음 · 읽기 실패)은 동작이다
    expect(range([copyCommit(), commit(null)]).verdict).toBe('wait');
    // 머지 커밋은 바꾼 것이 문구뿐이어도 동작이다 — 첫 부모와의 차이가 다른 가지의 동작 → 되돌림을 뭉친다
    const merged = range([copyCommit(), { ...copyCommit(), merge: true }]);
    expect(merged.verdict).toBe('wait');
    expect(merged.behavior[0]).toContain('머지 커밋');
  });

  it('마지막 초록을 못 찾거나 · 커밋을 못 읽거나 · 파서가 없거나 · PR 검사가 초록이 아니거나 못 읽거나 · main 이 붉으면 기다린다', () => {
    expect(range([docsCommit()], { lastGreen: null }).verdict).toBe('wait');
    expect(range([]).verdict).toBe('wait');
    expect(range(null).verdict).toBe('wait');
    expect(range([copyCommit()], { ts: null }).verdict).toBe('wait');
    expect(range([copyCommit()], { unpassed: null }).verdict).toBe('wait');
    const red = range([copyCommit()], { unpassed: ['c'.repeat(40)] });
    expect(red.verdict).toBe('wait');
    expect(red.reason).toContain('ccccccc');
    const mainRed = range([copyCommit()], { mainRed: '`ci-main-red` 이슈가 열려 있다 — main 이 붉다' });
    expect(mainRed.verdict).toBe('wait');
    expect(mainRed.reason).toContain('ci-main-red');
    expect(range([], { lastGreen: HEAD, mainRed: 'x' }).verdict).toBe('wait');
  });

  it('마지막 초록이 HEAD 일 때만 green 이다', () => {
    expect(range([], { lastGreen: HEAD }).verdict).toBe('green');
  });

  it('--from 은 근거가 되지 못한다 — --from X --head X 도 마지막 초록 없이는 wait, 답은 docs-only 아니면 wait', () => {
    // 검토가 든 재현 — 예전에는 `--from` 이 마지막 초록 자리에 들어 `green` 이었다
    expect(range(null, { lastGreen: null, from: HEAD, fromCommits: [] }).verdict).toBe('wait');
    // 마지막 초록부터 동작이 바뀌었으면 운영과 같아도 wait
    expect(range([behaviorCommit()], { from: HEAD, fromCommits: [] }).verdict).toBe('wait');
    // 마지막 초록이 근거를 세우고 운영 뒤로 바뀐 것이 없으면 docs-only — 앱을 안 올린다
    const same = range([copyCommit()], { from: HEAD, fromCommits: [] });
    expect(same.verdict).toBe('docs-only');
    expect(same.reason).toContain('근거');
    expect(range([], { lastGreen: HEAD, from: HEAD, fromCommits: [] }).verdict).toBe('docs-only');
    expect(range([copyCommit()], { from: FROM, fromCommits: [docsCommit()] }).verdict).toBe('docs-only');
  });

  it('--from 이 마지막 초록보다 뒤이고 그 사이에 동작 변경이 있으면 wait — from..head 가 문서뿐이어도', () => {
    // 초록 → (동작) → from → (문서) → head
    const between = behaviorCommit();
    const after = docsCommit();
    expect(range([between, after], { from: FROM, fromCommits: [after] }).verdict).toBe('wait');
  });

  it('--from 뒤로 앱이 바뀌었으면 wait — 올릴지 · 기다릴지는 --from 없이 부른 답이 정한다', () => {
    const copy = copyCommit();
    const answered = range([copy], { from: FROM, fromCommits: [copy] });
    expect(answered.verdict).toBe('wait');
    expect(answered.reason).toContain('`--from` 없이');
    expect(range([copy]).verdict).toBe('copy');
    // 운영이 마지막 초록보다 앞이고 그 사이에 동작이 있었어도 앱이 바뀐 것이라 wait
    expect(range([docsCommit()], { from: FROM, fromCommits: [behaviorCommit(), docsCommit()] }).verdict).toBe('wait');
    // `--from` 의 범위를 못 읽으면(HEAD 의 조상이 아님) wait
    expect(range([docsCommit()], { from: FROM, fromCommits: null }).verdict).toBe('wait');
  });

  it('main 이 붉은가 — 범위의 붉은 verify · 열린 ci-main-red · 못 읽음 · 모르는 모양은 붉다', () => {
    const shas = ['1'.repeat(40), '2'.repeat(40)];
    expect(mainRedOf({ runs: [{ headSha: shas[0], conclusion: 'success' }, { headSha: 'z'.repeat(40), conclusion: 'failure' }], openIssues: [], shas })).toBeNull();
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'failure' }], openIssues: [], shas })).toContain('2222222');
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'timed_out' }], openIssues: [], shas })).not.toBeNull();
    // 끊긴 · 도는 실행은 붉음이 아니다 — 근거는 따로 마지막 전체 초록이 선다
    expect(mainRedOf({ runs: [{ headSha: shas[1], conclusion: 'cancelled' }, { headSha: shas[0], conclusion: null }], openIssues: [], shas })).toBeNull();
    expect(mainRedOf({ runs: [], openIssues: [{ number: 9 }], shas })).toContain('ci-main-red');
    expect(mainRedOf({ runs: null, openIssues: [], shas })).not.toBeNull();
    expect(mainRedOf({ runs: [], openIssues: undefined, shas })).not.toBeNull();
    expect(mainRedOf({ runs: [{ sha: shas[0] }], openIssues: [], shas })).not.toBeNull();
  });

  it('배포 범위 명령은 CI · 개발 도구다 — 공용 위험(시험 도구)으로 안 걸린다', () => {
    expect(beta(['scripts/deploy-range.mjs']).tier).toBe('core');
  });
});
