/**
 * 어떤 변경에 어떤 검사를 돌리는가 — **규칙은 이 파일 한 곳에만 있다** (ADR 0082).
 *
 * `verify.yml` 은 여기서 나온 답을 읽을 뿐 스스로 판단하지 않는다. 경로 규칙을 YAML 의
 * `paths` 필터에 적으면 두 자리가 되고, 필터로 건너뛴 job 은 필수 검사에서 「기다리는 중」으로
 * 영원히 남는다. 여기서 낸 계획은 job 의 `if` 가 읽고, `gate` 는 `skipped` 를 통과로 센다.
 *
 * ## 세 단계뿐이다
 *
 * 최근 PR 여섯 중 넷이 스무 디렉터리를 건드리는 횡단 변경이었다. 잘게 나눈 매트릭스로 아낄
 * PR 은 드물고, 나눈 만큼 「이 경로가 저 검사에 안 걸린다」는 문장이 늘어난다 — 그 문장은
 * 파일이 옮겨지는 날 조용히 거짓이 된다. 그래서 굵게 셋만 둔다.
 *
 * | 변경이 이 안에만 있으면 | 도는 것 |
 * |---|---|
 * | 정책(`docs/**` · `*.md` · `.claude/**` · `scripts/*.test.ts`) | `policy` (scripts 시험 · 타입 · 린트, 1분 안) |
 * | 엔진(`src/lib/saju/**`) · 엔진을 그리는 칸(`app/saju/**`) | `verify` (단위·타입·린트·빌드 + 익명 e2e) |
 * | 그 밖 전부 · **모르는 파일** | 전부 |
 *
 * ## 엔진 단계의 예외 둘 — 재서 뺐다
 *
 * `src/lib/saju` 는 모든 층이 읽지만, 로그인 뒤 화면과 흐름 검사는 **같은 엔진으로 기대값을
 * 짓는다** — 엔진이 달라져도 둘은 함께 달라져 빨개지지 않는다. 빨개지는 자리는 **DB 가
 * 모양을 검사하는 곳**뿐이다: 저장되는 여덟 글자의 모양(`chartSnapshotOf`,
 * `pillars/index.ts`)과 판본(`version.ts`)은 마이그레이션의 검사식이 본다
 * (`the_person_carries_its_eight_characters`). 그 둘을 고친 PR 은 전부 돈다.
 *
 * 홈(`app/page.tsx`)과 출생 입력 폼(`app/birth-form.tsx`)은 **익명 화면이 아니다** — 홈은
 * 로그인 e2e 세 건이 회원으로 열고, 폼은 온보딩·수정·사람 관리가 같이 쓴다. 그래서 목록에 없다.
 *
 * ## 문서도 시험이 읽는다 — 정책 단계 (2026-09-23, #145)
 *
 * 문서만 바뀌면 `gate` 만 돌던 동안 구멍이 났다. `scripts/code-rules.test.ts` 는 간극 대장 · PRD ·
 * 위임 규약 · ADR · `.claude/settings.json` 을 **읽고** 견주므로, 문서 PR 이 그 시험을 깨도 그 PR 에서는
 * 아무것도 안 돌고 다음에 오는 남의 PR 에서 터졌다. 반대로 `.claude/settings.json` 과 문서만 바꾼 PR
 * (#141)은 모르는 파일이라 전부(약 5분)를 돌았다. 그 둘을 한 단계로 묶었다 — `scripts/` 의 시험 · 타입 ·
 * 린트다. `scripts/*.test.ts` 만 바뀐 PR 도 여기다: 시험 파일은 저 자신의 결과만 바꾼다.
 *
 * ## 공개 출시 전에는 빠른 검사만 머지를 막는다 (2026-09-23, #161, ADR 0097)
 *
 * 운영 베타에는 실제 사용자가 없다. PR 마다 전부(약 5분)를 돌리고 strict 가 뒤에 선 PR 을 다시 돌리는 값이
 * 다치는 사람을 막는 값보다 컸다. 그래서 단계가 공개 뒤의 규율을 켜지 않았으면(`release-stage.mjs`) PR 은
 * `fast`(단위 · 타입 · 린트) 하나만 탄다 — 정책 파일만 바뀌었으면 전처럼 `policy`. 전체 검증은 main 푸시가
 * 최신 커밋 하나에서 비차단으로 돌고, 붉으면 `ci-main-red` 이슈가 든다.
 *
 * - **`supabase/**` 는 단계와 상관없이 전부다.** 마이그레이션 · pgTAP · `config.toml` 은 DB 차선에서만 재어지고,
 *   `db:start` 가 깨지면 main 의 DB 차선이 다 선다. 라벨에 기대지 않는다 — 에이전트는 라벨을 잊는다.
 * - **단계를 모르면 전부다.** 「(지금)」이 없거나 둘이거나 표에 없는 이름이면 안전 쪽으로 간다.
 * - **공개 출시면 아래 세 단계로 돌아간다.** 단계를 옮기는 PR 은 그 PR 에서부터 새 단계로 계획된다.
 *
 * ## 빠른 검사에도 빌드가 든다 (2026-09-24, #219)
 *
 * `fast` 는 처음에 빌드를 뺐다 — 빌드가 깨지면 Vercel 이 이전 배포를 그대로 세우므로 머지 뒤 main 의 `verify` 로
 * 넉넉하다고 봤다. 그런데 `next build` 만 잡는 실패가 있다: `app/…/icon.tsx` 는 Next 가 파비콘 라우트로 읽어
 * 빌드가 섰고, 단위 · 타입 · 린트는 다 초록이었다(3d54d56). Production 이 두 시간 멈췄다. 그래서 `FAST_STEPS` 에
 * `npm run build` 를 넣는다 — 빌드는 끝에 비밀 검사도 돈다(G-23 ⑧). `verify.yml` 의 `fast` job 은 이 목록을
 * 그대로 돌고, 시험이 둘을 견준다.
 *
 * ## 운영 의존성 감사는 단계와 따로 켠다 (2026-09-23, G-23 ①, ADR 0104)
 *
 * `audit` 차선은 `npm audit --omit=dev --audit-level=high` 하나다. 위 단계들과 달리 **바뀐 파일이 아니라 밖의
 * advisory DB 가 결과를 바꾼다** — 모든 PR 에 걸면 아무것도 안 바꾼 PR 이 어느 날 붉어지고, 나란히 선 세션이
 * 그것을 제 빨간불로 읽는다. 그래서 PR 에서는 **의존성 목록(`package.json` · `package-lock.json`)을 바꾼 PR 에만**
 * 머지를 막고, 새로 뜬 advisory 는 main 푸시 · 하루 한 번의 일정이 잡아 `ci-main-red` 이슈로 알린다.
 * 라벨 · 빈 diff · 계획 밖 이벤트는 「전부」와 같이 켠다.
 *
 * ## 관문 · 화면 · 인증 · 그것을 재는 시험은 베타에서도 머지 전에 전부다 (2026-09-27, ADR 0119)
 *
 * 베타의 `fast` 는 「그 밖 전부」를 받았다. 그래서 #284(탭 넷의 `loading.tsx` · route group 이동)와 #286(`proxy.ts` 와
 * 화면 · 서버 액션 27개)이 PR 에서 `fast` 만 돌았다 — 목록이 틀린 게 아니라 규칙에 그 자리가 없었다. #284 는 머지 뒤
 * main 의 `flow` 가 붉었다(`check-discovery`, e370931). 단위 · 타입 · 린트 · 빌드는 **화면이 열리는가 · 관문이 누구를
 * 들이는가**를 모른다. 그래서 아래 `SURFACE` 가 하나라도 섞이면 단계와 상관없이 전부(익명 e2e · `authed` · `flow`)다.
 *
 * - **관문** — `proxy.ts` · `src/lib/consent/`(test-map 「관문」 줄)
 * - **인증** — `app/auth/`
 * - **화면의 입구** — `app/` 아래의 `page` · `layout` · `loading` · `template` · `error` · `not-found` · `default`(`.tsx`) ·
 *   `route.ts`. route group 을 옮기면 `--no-renames` 로 옛 · 새 `page.tsx` 가 다 서므로 이것이 잡는다
 * - **서버 액션** — `app/` 의 `actions.ts`, 그리고 이름이 다른 `'use server'` 파일(`SERVER_ACTIONS_ELSEWHERE`). 시험이
 *   `app/` 의 `'use server'` 파일 전부가 여기 걸리는지 잰다 — 새 액션 파일이 조용히 빠지지 않게
 * - **그것을 재는 시험 자체** — `e2e/` · 흐름 검사(`scripts/check-*.mjs` · `run-checks.mjs` · `next-server.mjs`).
 *   시험이 도는지는 시험을 돌려야 안다(ADR 0097 의 로컬 예외 첫째를 CI 로 옮겼다)
 *
 * 입구가 아닌 컴포넌트(`app/me/(shelf)/readings/shelf.tsx` 같은 것)와 `src/lib/**` 는 전처럼 `fast` 다 — 거기까지 넓히면 코드 PR 이 다
 * 전부가 되어 ADR 0097 이 없던 것과 같다. 차선을 경로별로 잘게 고르지 않는다(ADR 0082 — 그 문장은 파일이 옮겨지는
 * 날 거짓이 된다). `authed` 는 일곱 차선을 다 돈다.
 *
 * ## 서버에 닿는 `app/` 파일과 시험 도구가 혼자 쓰는 파일도 입구다 (2026-09-28, ADR 0119 추기)
 *
 * 이름으로만 입구를 골랐더니 판단이 사는 문이 빠졌다. `page.tsx` 는 얇고, DB 를 부르는 것은 그 옆의 `.ts` 다 —
 * `app/me/reading/pipeline.ts` · `app/me/candidates.ts` · `app/me/chat/rooms.ts` · `app/keyed-client.ts`(service-role) ·
 * `app/ops/reports/read.ts` · `app/share/public-client.ts` · `proxy.ts` 가 부르는 `app/beta-schedule.ts` 가 다 `fast` 였다.
 * 흐름 · pgTAP 은 머지 뒤 main 에서만 돌아 #284 와 같은 모양이 남았다. 이름을 늘어놓지 않고 **내용으로 가른다**:
 *
 * - **서버에 닿는 `app/` 파일** — `app/**` 의 `.ts` · `.tsx`(시험 빼고) 중 Supabase 클라이언트(`@supabase/*` 나
 *   `server-client` · `browser-client` · `keyed-client` · `public-client`)나 서버 전용 모듈(`server-only` · `next/server` ·
 *   `next/headers` · `next/cache`)을 import 하는 것(`SERVER_REACHING`). 계획 job 이 HEAD 를 받아 두므로 파일을 읽는다.
 *   못 읽는 파일(지운 것)은 안 건다 — 그것을 부르던 쪽이 함께 바뀌어 그쪽이 걸린다. 순수 화면 로직(`book.ts` ·
 *   `deck-state.ts` · 받은 client 를 쓰기만 하는 `settle.ts`)은 단위 시험이 재므로 전처럼 `fast` 다.
 * - **시험 도구가 혼자 쓰는 파일** — 앱 서버의 설정(`next.config.ts` 의 CSP · 보안 헤더는 익명 e2e 가 잰다)과
 *   e2e · 흐름 검사가 import 하되 앱은 안 부르는 파일(`HARNESS`). 목록이지만 시험이 규칙을 잰다 — e2e · 흐름 검사 ·
 *   Playwright 설정에서 import 를 따라가 앱이 안 닿는 파일이 전부 여기 걸리는지 본다. `scripts/fake-clock.mjs` 는
 *   `ui-shots` 만 쓰고 CI 가 안 돌리므로 안 든다.
 *
 * 잰 값(2026-09-28): 한 파일만 바꾼 PR 이 `fast` 에서 전부로 옮는 파일이 42 개다 — `app/**` 의 `.ts` 35 개(시험 아닌 105 개 중
 * 입구가 26 → 61, 순수 로직 44 개는 그대로 `fast`), 브라우저 client 를 부르는 `.tsx` 둘(`site-header.tsx` · `save-for-reading.tsx`),
 * 도구 다섯. 최근 머지된 PR 30 개를 옛 · 새 규칙에 넣으면 전부가 16 → 17 이다(#264 가 `s3.ts` · `ops/reports/read.ts` 로 옮는다).
 * 전부로 가는 PR 은 대개 이미 화면의 입구를 함께 바꾼다.
 *
 * ## 원칙
 *
 * - 라벨(`full-ci`)은 **더할 수만 있고 뺄 수 없다.**
 * - 모르는 파일은 전부로 간다. 조용히 건너뛰지 않는다.
 * - diff 를 못 받았으면(빈 목록) 모르는 것이므로 전부 돈다.
 * - `main` 푸시 · `schedule` · 손으로 켠 실행은 계획을 안 보고 전부 돈다.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LAUNCHED, currentStageOf } from './release-stage.mjs';

export const FULL_LABEL = 'full-ci';

/** 이 이름들로만 판단한다 — 워크플로가 `github.event_name` 을 그대로 넘긴다 */
const PLANNED_EVENTS = new Set(['pull_request']);

/** 정책 — 사람과 에이전트가 읽는 규약, 그리고 그것을 견주는 시험. 코드가 아니라 `scripts/` 시험이 잰다 */
const POLICY = [/^docs\//, /\.md$/, /^\.claude\//, /^scripts\/[^/]+\.test\.ts$/];
const ENGINE = [/^src\/lib\/saju\//, /^app\/saju\//];
/** 의존성 목록 — 이것을 바꾼 PR 만 `audit` 이 머지를 막는다 */
export const DEPENDENCY_LISTS = ['package.json', 'package-lock.json'];
/** 관문 · 인증 · 화면의 입구 · 서버 액션 · 그것을 재는 시험 — 베타에서도 전부를 돈다(위 「관문 · 화면 · 인증」) */
const SURFACE = [
  /^proxy\.ts$/,
  /^src\/lib\/consent\//,
  /^app\/auth\//,
  /^app\/(.+\/)?(page|layout|loading|template|error|not-found|default)\.tsx$/,
  /^app\/(.+\/)?route\.ts$/,
  /^app\/(.+\/)?actions\.ts$/,
  /^e2e\//,
  /^scripts\/check-[^/]+\.mjs$/,
];
/** 이름이 `actions.ts` 가 아닌 `'use server'` 파일 — 이름으로 견주므로 시험이 실재를 잰다 */
export const SERVER_ACTIONS_ELSEWHERE = ['app/nickname.ts', 'app/me/reading/share.ts'];
/**
 * 앱 서버의 설정, 그리고 e2e · 흐름 검사가 import 하되 앱은 안 부르는 파일 — 위 「서버에 닿는 `app/` 파일과 시험 도구」.
 * 시험이 import 를 따라가 앱이 안 닿는 도구 파일이 전부 여기 있는지 잰다 — 새 도우미가 조용히 빠지지 않게
 */
export const HARNESS = [
  'next.config.ts',
  'playwright.config.ts',
  'scripts/run-checks.mjs',
  'scripts/next-server.mjs',
  'scripts/checks.mjs',
  'scripts/notice.mjs',
  'src/lib/local-env.ts',
];
/**
 * 서버에 닿는 `app/` 파일을 가르는 import — Supabase 클라이언트와 서버 전용 모듈. 이것을 부르는 `app/**` 파일은 이름과
 * 상관없이 입구다(위 「서버에 닿는 `app/` 파일」)
 */
export const SERVER_REACHING =
  /^(?:@supabase\/|server-only$|next\/(?:server|headers|cache)$)|\/(?:server-client|browser-client|keyed-client|public-client)(?:\.ts)?$/;
/** DB 차선에서만 재어지는 자리 — 단계와 상관없이 전부를 돈다 */
const DATABASE = [/^supabase\//];
/** 엔진 안에서 DB 의 검사식이 보는 파일 — 여기가 바뀌면 로그인 뒤 자리도 재야 한다 */
export const ENGINE_DB_FACING = ['src/lib/saju/version.ts', 'src/lib/saju/pillars/index.ts'];

/** `fast` job 이 `npm ci` 뒤에 차례로 도는 명령 — `verify.yml` 이 이 목록과 같아야 한다(위 「빠른 검사에도 빌드가 든다」) */
export const FAST_STEPS = ['npm test', 'npm run typecheck', 'npm run lint', 'npm run build'];

const matches = (rules, file) => rules.some((rule) => rule.test(file));

const isPolicy = (file) => matches(POLICY, file);

/** 파일이 import 하는 이름들 — `import … from` · `export … from` · `import '…'` · `import('…')` */
export const importsOf = (source) =>
  [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g)].map((one) => one[1]);

/** 저장소 뿌리에서 읽는다 — 계획 job 은 PR 의 HEAD 를 받아 둔다. 못 읽으면(지운 파일) `null` */
export function sourceFromDisk(file) {
  try {
    return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
}

/** `app/**` 의 시험 아닌 `.ts` · `.tsx` 가 Supabase 클라이언트나 서버 전용 모듈을 부르는가 */
export function reachesServer(file, sourceOf = sourceFromDisk) {
  if (!/^app\/.+\.tsx?$/.test(file)) return false;
  const source = sourceOf(file);
  return source !== null && importsOf(source).some((name) => SERVER_REACHING.test(name));
}

/** 시험 파일(`*.test.ts`)은 제 결과만 바꾼다 — `app/auth/signed-in.test.ts` 하나로 전부를 돌지 않는다 */
export const isSurface = (file, sourceOf = sourceFromDisk) =>
  !/\.test\.tsx?$/.test(file) &&
  (matches(SURFACE, file) ||
    SERVER_ACTIONS_ELSEWHERE.includes(file) ||
    HARNESS.includes(file) ||
    reachesServer(file, sourceOf));
const isEngine = (file) => matches(ENGINE, file) && !ENGINE_DB_FACING.includes(file);

/** 단계마다 켜는 차선 — `verify.yml` 의 job 이름과 같다 */
const LANES = {
  // `verify` · `fast` 가 도는 단계는 `npm test` 가 scripts 시험을 이미 돈다 — policy 는 그것이 안 도는 단계에만 켠다
  policy: { policy: true, fast: false, verify: false, authed: false, flow: false },
  fast: { policy: false, fast: true, verify: false, authed: false, flow: false },
  engine: { policy: false, fast: false, verify: true, authed: false, flow: false },
  full: { policy: false, fast: false, verify: true, authed: true, flow: true },
};

/**
 * `stage` 는 `release-stage.mjs` 의 `currentStageOf` 가 낸 값이다 — `null` 이나 빠진 값은 모르는 단계다.
 * `sourceOf` 는 바뀐 파일의 지금 내용이다(서버에 닿는 `app/` 파일을 가른다) — 빠지면 저장소에서 읽는다.
 *
 * @param {{ files: readonly string[], labels?: readonly string[], event?: string, stage?: string | null, sourceOf?: (file: string) => string | null }} input
 * @returns {{ tier: 'policy' | 'fast' | 'engine' | 'full', reason: string, lanes: typeof LANES.full & { audit: boolean } }}
 */
export function planFor({ files, labels = [], event = 'pull_request', stage = null, sourceOf = sourceFromDisk }) {
  const decided = decide({ files, labels, event, stage, sourceOf });
  return { ...decided, lanes: { ...LANES[decided.tier], audit: audits({ files, labels, event }) } };
}

/** 단계와 상관없다 — 위 「운영 의존성 감사」 */
function audits({ files, labels, event }) {
  if (!PLANNED_EVENTS.has(event) || labels.includes(FULL_LABEL)) return true;
  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  return changed.length === 0 || changed.some((one) => DEPENDENCY_LISTS.includes(one));
}

function decide({ files, labels, event, stage, sourceOf }) {
  if (!PLANNED_EVENTS.has(event)) return { tier: 'full', reason: `\`${event}\` 은 계획을 안 본다` };
  if (labels.includes(FULL_LABEL)) return { tier: 'full', reason: `\`${FULL_LABEL}\` 라벨` };

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return { tier: 'full', reason: '바뀐 파일 목록을 못 받았다' };

  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return { tier: 'full', reason: `\`${database}\` 은 DB 차선에서만 재어진다` };
  if (stage === null || !(stage in LAUNCHED)) return { tier: 'full', reason: '출시 단계를 모른다 — PRD §7.0 의 「(지금)」' };

  if (!LAUNCHED[stage]) {
    const surface = changed.find((one) => isSurface(one, sourceOf));
    if (surface) return { tier: 'full', reason: `${stage} — \`${surface}\` 은 관문 · 화면 · 인증이라 머지 전에 전부 잰다` };
    if (changed.every(isPolicy)) return { tier: 'policy', reason: `${stage} — 정책만 바뀌었다` };
    return { tier: 'fast', reason: `${stage} — 빠른 검사만 머지를 막고 전체는 main 에서 돈다` };
  }

  const unknown = changed.filter((one) => !isPolicy(one) && !isEngine(one));
  if (unknown.length > 0) return { tier: 'full', reason: `\`${unknown[0]}\` 은 정책도 엔진도 아니다` };

  if (changed.every(isPolicy)) return { tier: 'policy', reason: '정책(문서 · 도구 설정 · scripts 시험)만 바뀌었다' };
  return { tier: 'engine', reason: '엔진과 그것을 그리는 칸만 바뀌었다' };
}

/** 사람이 읽는 표 — step summary 에 찍는다 */
export function summaryOf(plan, files) {
  const lanes = Object.entries(plan.lanes)
    .map(([lane, on]) => `| \`${lane}\` | ${on ? '돈다' : '건너뛴다'} |`)
    .join('\n');
  return [
    `## CI 계획: \`${plan.tier}\``,
    '',
    `${plan.reason} (바뀐 파일 ${files.length}개)`,
    '',
    '| 차선 | |',
    '|---|---|',
    lanes,
    '',
  ].join('\n');
}

function argOf(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
}

function main() {
  const files = readFileSync(0, 'utf8').split('\n').filter((one) => one.trim() !== '');
  const labels = (argOf('--labels') ?? '').split(',').map((one) => one.trim()).filter(Boolean);
  const event = argOf('--event') ?? 'pull_request';

  let stage = null;
  try {
    stage = currentStageOf(readFileSync(new URL('../docs/prd.md', import.meta.url), 'utf8'));
  } catch {
    // PRD 를 못 읽으면 모르는 단계다 — 전부로 간다
  }
  const plan = planFor({ files, labels, event, stage });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [`tier=${plan.tier}`, ...Object.entries(plan.lanes).map(([lane, on]) => `${lane}=${on}`), '']
        .join('\n'),
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryOf(plan, files));

  console.log(JSON.stringify({ ...plan, stage, files: files.length }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
