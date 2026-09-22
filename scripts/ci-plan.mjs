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
 * | 문서(`docs/**` · `*.md`) | `gate` 만 |
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
 * ## 원칙
 *
 * - 라벨(`full-ci`)은 **더할 수만 있고 뺄 수 없다.**
 * - 모르는 파일은 전부로 간다. 조용히 건너뛰지 않는다.
 * - diff 를 못 받았으면(빈 목록) 모르는 것이므로 전부 돈다.
 * - `main` 푸시 · `schedule` · 손으로 켠 실행은 계획을 안 보고 전부 돈다.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FULL_LABEL = 'full-ci';

/** 이 이름들로만 판단한다 — 워크플로가 `github.event_name` 을 그대로 넘긴다 */
const PLANNED_EVENTS = new Set(['pull_request']);

const DOCS = [/^docs\//, /\.md$/];
const ENGINE = [/^src\/lib\/saju\//, /^app\/saju\//];
/** 엔진 안에서 DB 의 검사식이 보는 파일 — 여기가 바뀌면 로그인 뒤 자리도 재야 한다 */
export const ENGINE_DB_FACING = ['src/lib/saju/version.ts', 'src/lib/saju/pillars/index.ts'];

const matches = (rules, file) => rules.some((rule) => rule.test(file));

const isDocs = (file) => matches(DOCS, file);
const isEngine = (file) => matches(ENGINE, file) && !ENGINE_DB_FACING.includes(file);

/** 단계마다 켜는 차선 — `verify.yml` 의 job 이름과 같다 */
const LANES = {
  docs: { verify: false, authed: false, flow: false },
  engine: { verify: true, authed: false, flow: false },
  full: { verify: true, authed: true, flow: true },
};

/**
 * @param {{ files: readonly string[], labels?: readonly string[], event?: string }} input
 * @returns {{ tier: 'docs' | 'engine' | 'full', reason: string, lanes: typeof LANES.full }}
 */
export function planFor({ files, labels = [], event = 'pull_request' }) {
  const decided = decide({ files, labels, event });
  return { ...decided, lanes: LANES[decided.tier] };
}

function decide({ files, labels, event }) {
  if (!PLANNED_EVENTS.has(event)) return { tier: 'full', reason: `\`${event}\` 은 계획을 안 본다` };
  if (labels.includes(FULL_LABEL)) return { tier: 'full', reason: `\`${FULL_LABEL}\` 라벨` };

  const changed = files.map((one) => one.trim()).filter((one) => one !== '');
  if (changed.length === 0) return { tier: 'full', reason: '바뀐 파일 목록을 못 받았다' };

  const unknown = changed.filter((one) => !isDocs(one) && !isEngine(one));
  if (unknown.length > 0) return { tier: 'full', reason: `\`${unknown[0]}\` 은 문서도 엔진도 아니다` };

  if (changed.every(isDocs)) return { tier: 'docs', reason: '문서만 바뀌었다' };
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

  const plan = planFor({ files, labels, event });

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [`tier=${plan.tier}`, ...Object.entries(plan.lanes).map(([lane, on]) => `${lane}=${on}`), '']
        .join('\n'),
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryOf(plan, files));

  console.log(JSON.stringify({ ...plan, files: files.length }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
