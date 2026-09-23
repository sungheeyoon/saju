/**
 * Vercel 이 **이 커밋을 빌드할지** — `vercel.json` 의 `ignoreCommand` 가 부른다 (운영자 결정 2026-09-24, G-23).
 *
 * ## 종료 코드의 뜻이 거꾸로다
 *
 * Vercel 의 Ignored Build Step 은 **0 이면 건너뛰고, 1 이면 빌드한다**
 * (<https://vercel.com/docs/project-configuration/vercel-json#ignorecommand>, 2026-09-24 에 읽음). 셸의 습관(0 = 성공 =
 * 진행)과 반대라, 판단을 순수 함수(`decide`)로 두고 종료 코드는 `exitCodeOf` 한 곳에서만 짓는다. 시험
 * (`vercel-ignore.test.ts`)이 이 반대 의미를 든다 — 오류로 끝나는 모든 길은 1(빌드)이다.
 *
 * ## 건너뛰는 것은 좁게, 모르면 빌드한다
 *
 * Preview 만 건너뛴다 — `VERCEL_ENV=production` 은 무엇이 바뀌었든 빌드한다. 건너뛰는 것은 **바뀐 파일이 전부**
 * 아래 넷일 때뿐이다: 문서(`docs/**` · `*.md`), DB 마이그레이션(`supabase/migrations/**`), pgTAP(`supabase/tests/**`),
 * 순수 단위 시험(`src/**` · `scripts/**` 의 `*.test.ts`). 셋 다 배포된 앱의 모양을 안 바꾼다 — 마이그레이션은
 * `db push` 로 따로 가고(runbook 「배포」), 앱을 부르는 쪽이 함께 바뀌면 그 파일이 빌드를 켠다. `app/**` 의 시험은
 * 건너뛰지 않는다 — 결정이 `app/**` 를 통째로 빌드 쪽에 두었다.
 *
 * 비교할 기준을 못 찾거나, git 이 실패하거나, 바뀐 파일 목록이 비면 **빌드한다.** 한 번 더 빌드하는 값은
 * 몇 분이고, 빌드했어야 할 것을 건너뛴 값은 옛 코드의 Preview 를 새 코드로 믿는 것이다.
 *
 * ## 기준 — 지난 성공 배포, 없으면 main 과의 갈림점
 *
 * `VERCEL_GIT_PREVIOUS_SHA` 는 **그 가지의 지난 성공 배포**다(Ignored Build Step 이 있을 때만 주어지고, 가지의
 * 첫 배포에는 비어 있다 — system environment variables 문서, 2026-09-24). 건너뛴 배포는 성공이 아니라서
 * 기준이 그 자리에 머문다 — 건너뛴 동안 쌓인 변경이 다음 판단에 다 든다. Vercel 은 얕게 clone 한다
 * (`--depth=10`, KB 「How do I use the Ignored Build Step」) — 기준 커밋이 clone 에 없으면 그것만 가져오고,
 * 첫 배포면 `origin` 의 `main` 을 가져와 갈림점을 기준으로 삼는다. 어느 쪽도 안 되면 빌드한다.
 *
 * ## 이것이 아끼지 않는 것
 *
 * 건너뛴 배포는 `CANCELED` 로 서고 **하루 배포 수(Hobby) 에는 여전히 센다** — project settings 문서 「Ignored Build
 * Step」의 note(2026-09-24). 아끼는 것은 빌드 시간과 동시 빌드 자리다.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** 바뀌어도 Preview 를 건너뛰는 자리 — 이 밖의 파일이 하나라도 있으면 빌드한다 */
export const SKIPPABLE = [
  /^docs\//,
  /\.md$/,
  /^supabase\/migrations\//,
  /^supabase\/tests\//,
  /^src\/.+\.test\.ts$/,
  /^scripts\/.+\.test\.ts$/,
];

export const skippable = (file) => SKIPPABLE.some((rule) => rule.test(file));

/**
 * @param {{ env: string | undefined, files: readonly string[] | null }} input
 *   `files` 가 `null` 이면 비교를 못 했다는 뜻이다
 * @returns {{ build: boolean, reason: string }}
 */
export function decide({ env, files }) {
  if (env === 'production') return { build: true, reason: 'production 은 건너뛰지 않는다' };
  if (env !== 'preview') return { build: true, reason: `VERCEL_ENV 를 모른다(${env ?? '없음'})` };
  if (files === null) return { build: true, reason: '비교할 기준을 못 찾았다' };

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return { build: true, reason: '바뀐 파일 목록이 비었다' };

  const needs = changed.find((one) => !skippable(one));
  if (needs !== undefined) return { build: true, reason: `\`${needs}\` 은 빌드가 필요하다` };
  return { build: false, reason: `문서 · 마이그레이션 · pgTAP · 단위 시험만 바뀌었다 (${changed.length}개)` };
}

/** Vercel 의 뜻 — **1 이면 빌드, 0 이면 건너뜀** */
export const exitCodeOf = (decision) => (decision.build ? 1 : 0);

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const hasCommit = (sha) => {
  try {
    git('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

/** 기준 커밋 — 없으면 `null`. 얕은 clone 이라 필요한 것만 가져온다 */
function baseOf(previous) {
  if (previous) {
    if (!hasCommit(previous)) git('fetch', '--quiet', '--depth=1', 'origin', previous);
    return hasCommit(previous) ? previous : null;
  }
  git('fetch', '--quiet', '--depth=100', 'origin', 'main');
  return git('merge-base', 'HEAD', 'FETCH_HEAD') || null;
}

function changedFiles(previous) {
  try {
    const base = baseOf(previous);
    if (base === null) return null;
    return git('diff', '--name-only', base, 'HEAD').split('\n');
  } catch {
    return null;
  }
}

function main() {
  let decision;
  try {
    const env = process.env.VERCEL_ENV;
    // production 은 git 을 부르기도 전에 답한다 — 비교가 실패할 틈조차 없게
    const files = env === 'preview' ? changedFiles(process.env.VERCEL_GIT_PREVIOUS_SHA) : [];
    decision = decide({ env, files });
  } catch (error) {
    decision = { build: true, reason: `판단하다 멈췄다 — ${error instanceof Error ? error.message : String(error)}` };
  }
  console.log(`${decision.build ? '빌드한다' : '건너뛴다'} — ${decision.reason}`);
  process.exit(exitCodeOf(decision));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
