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
/** DB 차선에서만 재어지는 자리 — 단계와 상관없이 전부를 돈다 */
const DATABASE = [/^supabase\//];
/** 엔진 안에서 DB 의 검사식이 보는 파일 — 여기가 바뀌면 로그인 뒤 자리도 재야 한다 */
export const ENGINE_DB_FACING = ['src/lib/saju/version.ts', 'src/lib/saju/pillars/index.ts'];

const matches = (rules, file) => rules.some((rule) => rule.test(file));

const isPolicy = (file) => matches(POLICY, file);
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
 *
 * @param {{ files: readonly string[], labels?: readonly string[], event?: string, stage?: string | null }} input
 * @returns {{ tier: 'policy' | 'fast' | 'engine' | 'full', reason: string, lanes: typeof LANES.full }}
 */
export function planFor({ files, labels = [], event = 'pull_request', stage = null }) {
  const decided = decide({ files, labels, event, stage });
  return { ...decided, lanes: LANES[decided.tier] };
}

function decide({ files, labels, event, stage }) {
  if (!PLANNED_EVENTS.has(event)) return { tier: 'full', reason: `\`${event}\` 은 계획을 안 본다` };
  if (labels.includes(FULL_LABEL)) return { tier: 'full', reason: `\`${FULL_LABEL}\` 라벨` };

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return { tier: 'full', reason: '바뀐 파일 목록을 못 받았다' };

  const database = changed.find((one) => matches(DATABASE, one));
  if (database) return { tier: 'full', reason: `\`${database}\` 은 DB 차선에서만 재어진다` };
  if (stage === null || !(stage in LAUNCHED)) return { tier: 'full', reason: '출시 단계를 모른다 — PRD §7.0 의 「(지금)」' };

  if (!LAUNCHED[stage]) {
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
