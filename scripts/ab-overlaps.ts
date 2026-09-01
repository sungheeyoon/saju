/**
 * `overlaps` 지시가 실제로 글을 바꾸는가 — **3군 A/B 하네스.**
 *
 * 단위 시험은 「자료가 맞는가」까지만 잰다. 「모델이 그 자료를 제대로 읽는가」는
 * 모델을 불러야 알 수 있고, 그래서 이 파일이 있다.
 *
 * ## 왜 옛 커밋을 체크아웃하지 않는가
 *
 * 대조군을 옛판으로 잡으면 `target` 조인·중복 금지·목록 완전성·반합 흡수 교정까지
 * 함께 달라져 **무엇이 결과를 바꿨는지 갈리지 않는다.** 세 군 모두 지금 코드에서
 * 짓고, 한 군씩 **한 가지만** 덜어 낸다.
 *
 *   A  지금 코드에서 `overlaps` 자료와 그 지시만 뺀 것
 *   B  지금 코드 그대로
 *   C  B 에서 「많아야 두 곳」 선택 예산만 뺀 것
 *
 * C 가 따로 있는 이유는, 예산이 없을 때 색인을 **과대사용**하는지가 예산 절의
 * 존재 이유이기 때문이다. A·B 만 보면 그 물음에 답이 안 나온다.
 *
 * ## 판정을 둘로 나눈다
 *
 * 기계가 셀 수 있는 것만 여기서 센다(hard gate). 해상도·구체성·앞 구조와의 연결은
 * 사람이 **군 이름을 가린 채** 본다 — 그것을 정규식으로 세면 재는 척만 하게 된다.
 *
 * ## 부르는 법
 *
 *   node scripts/run-ts.mjs scripts/ab-overlaps.ts  # dry-run. 프롬프트만 짓고 센다
 *   node scripts/run-ts.mjs scripts/ab-overlaps.ts --execute \
 *     --max-calls 15 --max-usd 3                    # 실제 호출. 상한 둘 다 필수
 *
 * `--max-calls` 는 호출 수의 확실한 상한이다. `--max-usd` 는 **호출 사이에서 멈추는
 * 운영 상한**이라 마지막 한 호출분은 넘어설 수 있다 — 출력 토큰에 상한을 걸지 않았기
 * 때문이고, 그것은 운영 호출과 조건을 같게 두려는 것이다. 쓴 양을 못 세는 응답이
 * 오면 비용을 검증할 수 없으므로 그 자리에서 멈춘다.
 *   node scripts/run-ts.mjs scripts/ab-overlaps.ts --execute --repeat 3 --max-calls 45 --max-usd 6
 *
 * `npx jiti` 로 바로 부르면 안 된다 — `app/` 의 `@/` 별칭이 안 풀린다. 그 래퍼가
 * `scripts/run-ts.mjs` 다.
 *
 * 결과는 `.ab-overlaps/<timestamp>/` 에 남는다 — 프롬프트 해시·모델·usage·출력
 * 원문까지. 사람이 눈으로 보는 파일은 `blind.md` 이고 **군 이름이 없다.**
 */
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeSaju, type Saju, type SajuInput } from '../src/lib/saju';
import { BRANCH_INFO, STEM_INFO } from '../src/lib/saju/constants';
import { currentFortuneOf } from '../src/lib/saju/now';
import { randomInputs } from '../src/lib/saju/population';
import { absorbableByUnknownHour } from '../src/lib/saju/relations';
import { CONTROL, readingEvidenceOf, readingPromptOf } from '../src/lib/reading';
import { checkReading } from '../src/lib/reading/check';
import { measureMarkdown } from '../src/lib/reading/measure';
/**
 * **dry-run 도 이 모듈을 불러 본다.**
 *
 * 한동안 `--execute` 안에서만 동적으로 불렀는데, 그래서 dry-run 이 열다섯 번 다
 * 통과해 놓고 실제 실행이 **첫 호출 직전에** 죽었다(`@/` 별칭). 돈을 쓰는 경로의
 * 배선은 돈을 안 쓰는 실행이 증명해야 한다 — 군 무결성을 먼저 묻는 것과 같은 이유다.
 */
import { callModel } from '../app/me/reading/model';
import { GENERATION } from '../app/me/reading/generation';
import type { ModelUsage } from '../app/me/reading/generator';

// ─── 군 ────────────────────────────────────────────────────────────────────

/**
 * 프롬프트에서 절 하나를 도려낸다.
 *
 * **못 찾으면 던진다.** 제목이 바뀌었는데 조용히 통째로 남으면 A 군이 B 군과
 * 같아지고, 그러면 「차이가 없다」는 결과가 나온다 — 가장 나쁜 실패다.
 */
function cutSection(prompt: string, heading: string): string {
  const start = prompt.indexOf(heading);
  if (start < 0) throw new Error(`절을 못 찾았다: ${heading}`);

  const rest = prompt.slice(start + heading.length);
  const next = rest.search(/\n#{2,3} /);
  const end = next < 0 ? prompt.length : start + heading.length + next;

  return prompt.slice(0, start) + prompt.slice(end);
}

/** `overlaps` 때문에 생긴 절들 — 궁위와 흔한 신살은 색인과 무관하므로 남긴다 */
const OVERLAP_SECTIONS = [
  '### 같은 자리에 무엇이 함께 걸렸는지 보라',
  '### 같은 근거를 두 번 세지 마라',
  '### 몇 군데나 쓸 것인가',
];

const BUDGET_SECTION = '### 몇 군데나 쓸 것인가';

type Arm = { id: 'A' | 'B' | 'C'; label: string; build: (saju: Saju) => string };

const promptOf = (saju: Saju, viewedAt: Date): string =>
  readingPromptOf(readingEvidenceOf('self', { a: saju }, viewedAt));

/**
 * 자료에서 `overlaps` 를 **키째로** 들어낸 프롬프트 — 지시도 함께 뺀다.
 *
 * 처음에는 `overlaps: []` 로 두고 문자열을 치환했는데 두 군데가 틀렸다. 빈 배열은
 * 「쟀는데 없다」라서 없는 것과 다르고, 무엇보다 **`claims` 상한표에도 같은 이름이
 * 있어서** 자료만 지워도 「overlaps 라는 근거가 있다」가 그대로 남았다. 정규식이
 * 먼저 만난 것이 그 상한표 쪽이었다.
 *
 * 그래서 JSON 을 풀어 두 자리에서 지우고 다시 싣는다.
 */
function withoutOverlaps(saju: Saju, viewedAt: Date): string {
  const prompt = promptOf(saju, viewedAt);

  const fence = prompt.match(/```json\n([\s\S]*?)\n```/);
  if (fence === null) throw new Error('자료 블록을 못 찾았다');

  const evidence = JSON.parse(fence[1]) as {
    charts: Record<string, { claims?: Record<string, unknown> } | null>;
  };

  for (const chart of Object.values(evidence.charts)) {
    if (chart === null) continue;
    delete (chart as Record<string, unknown>).overlaps;
    if (chart.claims) delete chart.claims.overlaps;
  }

  let stripped = prompt.replace(fence[1], JSON.stringify(evidence));
  for (const heading of OVERLAP_SECTIONS) stripped = cutSection(stripped, heading);

  return stripped;
}

const VIEWED_AT = new Date('2026-08-31T00:00:00Z');

const ARMS: Arm[] = [
  { id: 'A', label: 'overlaps 자료·지시 없음', build: (s) => withoutOverlaps(s, VIEWED_AT) },
  { id: 'B', label: '지금 코드 그대로', build: (s) => promptOf(s, VIEWED_AT) },
  {
    id: 'C',
    label: '선택 예산만 없음',
    build: (s) => cutSection(promptOf(s, VIEWED_AT), BUDGET_SECTION),
  },
];

// ─── 명식 ──────────────────────────────────────────────────────────────────

type Fixture = {
  id: string;
  /** 이 명식으로 무엇을 재는가 */
  asks: string;
  input: SajuInput;
};

const FIXTURES: Fixture[] = [
  {
    id: 'stem-star-misjoin',
    asks: '천간에 걸린 현침살을 같은 기둥 지지의 해묘반합·묘오파·공망과 묶는가',
    input: { year: 2033, month: 6, day: 9, hour: 23, minute: 0, second: 0, gender: 'male' },
  },
  {
    id: 'yangin-dohwa-clash-void',
    asks: '일지 양인·도화가 자오충·년주공망과 함께 있음을 한 문장으로 읽는가',
    input: { year: 2065, month: 9, day: 4, hour: 0, minute: 0, second: 0, gender: 'female' },
  },
  {
    id: 'restated-gwimun-wonjin',
    asks: '축오귀문(관계)과 귀문관살(신살)을 근거 둘로 세는가',
    input: { year: 1966, month: 6, day: 24, hour: 3, minute: 0, second: 0, gender: 'female' },
  },
  {
    id: 'hourless-partial-combination',
    asks: '시간 미상의 신유 반방합을 「있다」로 단정하는가 — hard gate',
    // 시간 미상 입력은 분·초 자리를 아예 비운다(`UnknownHourInput`).
    input: { year: 2052, month: 3, day: 7, hour: null, gender: 'male' },
  },
  {
    /** 리뷰가 더하라고 한 자리 — **C 군이 과대사용하는지는 여기서만 잰다** */
    id: 'overlap-not-worth-writing',
    asks: '겹침은 있으나 쓸 것이 없다 — 억지로 끌어오는가',
    input: { year: 1937, month: 1, day: 14, hour: 3, minute: 0, second: 0, gender: 'male' },
  },
];

// ─── 기계가 세는 것 ────────────────────────────────────────────────────────

type Gate = { id: string; hard: boolean; pass: boolean; detail: string };

/**
 * 이 엔진이 낼 수 있는 **모든** 신살 이름 — 닫힌 어휘를 표에서 모은다.
 *
 * 손으로 적지 않는다. 표가 늘면 이 집합도 는다.
 */
const ALL_STAR_KO: ReadonlySet<string> = new Set(
  randomInputs(400).flatMap((input) => computeSaju(input).sinsal.stars.map((star) => star.ko)),
);

/** 관계 이름은 앞에 간지 두 글자가 붙는다 — 「자오충」·「해묘 반합」 */
const GANJI = '자축인묘진사오미신유술해갑을병정무기경신임계';


/**
 * 자료에 없는 이름을 말했는가 — 「없는 것을 지어내지 마라」.
 *
 * ## 낱말 꼴로 잡으면 한국어가 걸린다
 *
 * 앞판은 `[가-힣]{2,4}(충|형|파|해|합|…)` 이었다. 실제로 돌려 보니 **요구해 ·
 * 답답해 · 정리해 · 계산해 · 안전해** 가 줄줄이 잡혔다 — 어미 `-해`·`-합`·`-파`가
 * 관계 접미사와 같은 글자다. 스물이 넘는 오탐에 진짜 신호(`문창귀인`·`오오형`)가
 * 파묻혔다.
 *
 * 그래서 **닫힌 어휘**로 바꾼다. 관계는 앞 두 글자가 간지인 것만 세고, 신살은
 * 엔진이 낼 수 있는 이름의 집합과 맞댄다. 「요구」는 간지가 아니라 애초에 안 걸린다.
 */
function fabricated(saju: Saju, text: string): Gate {
  /**
   * **운 관계도 자료다.** 원국만 보면 세운·월운과 원국 사이의 관계를 전부 허위로 잡는다 —
   * 첫 실행에서 「오오형·신해해·묘신원진·묘신귀문」 넷이 그렇게 걸렸고 넷 다 자료에
   * 있었다.
   */
  const now = currentFortuneOf(saju, VIEWED_AT);
  const everyRelation = [
    ...saju.relations,
    ...(now.relations ?? []),
    ...(['daeun', 'saeun', 'wolun'] as const).flatMap(
      (span) => (now[span] as { relations?: { ko: string }[] } | null)?.relations ?? [],
    ),
  ];

  const realRelations = new Set(everyRelation.map((r) => r.ko.replace(/\s+/g, '')));
  const realStars = new Set(saju.sinsal.stars.map((s) => s.ko));

  /**
   * **이 명식에 실제로 있는 글자만 관계 이름의 앞자리에 설 수 있다.**
   *
   * 앞판은 「간지 두 글자 + 접미사」 꼴이면 다 잡았다. 寅·丁 이 간지라 **「인정해」**
   * 가 관계 이름으로 걸렸다 — 손으로 제외 목록을 적을 수도 있었지만 그러면 다음
   * 낱말에서 또 걸린다.
   *
   * 관계 이름은 언제나 그 명식(또는 지금 도는 운)에 **있는 글자**를 부른다. 없는 글자로
   * 시작하는 것은 관계 이름이 아니다.
   */
  const ko = (char: string): string =>
    (STEM_INFO as Record<string, { ko: string }>)[char]?.ko ??
    (BRANCH_INFO as Record<string, { ko: string }>)[char]?.ko ??
    char;

  const present = new Set(
    [
      ...(['year', 'month', 'day', 'hour'] as const)
        .map((position) => saju.pillars[position])
        .filter((pillar) => pillar !== null)
        .flatMap((pillar) => [pillar.stem as string, pillar.branch as string]),
      ...everyRelation.flatMap(
        (r) => (r as { participants?: { char: string }[] }).participants?.map((p) => p.char) ?? [],
      ),
    ].map(ko),
  );

  const relationShaped = new RegExp(`[${GANJI}]{2}\\s?(?:충|합|형|파|해|원진|귀문|반합|반방합)`, 'g');
  const unknownRelations = [
    ...new Set(
      (text.match(relationShaped) ?? [])
        .map((word) => word.replace(/\s+/g, ''))
        /**
         * **자료의 이름이 더 길 수 있다.** 「병신합수」를 「병신합」으로 잘라 놓고 못
         * 찾았다 — 접미사가 붙는 이름은 앞에서부터 맞대야 한다.
         */
        .filter((word) => present.has(word[0]) && present.has(word[1]))
        .filter((word) => ![...realRelations].some((real) => real.startsWith(word))),
    ),
  ];

  const unknownStars = [
    ...new Set([...ALL_STAR_KO].filter((ko) => text.includes(ko) && !realStars.has(ko))),
  ];

  const unknown = [...unknownRelations, ...unknownStars];

  return {
    /**
     * **advisory 다 — 아직 hard 로 세울 물건이 아니다.**
     *
     * 닫힌 어휘로 바꾸고 hard 로 올렸는데, 실제 호출 한 건에서 여섯을 잡고 **여섯 다
     * 오탐**이었다. 구멍이 셋 남아 있었다.
     *
     *   운 관계를 안 본다   오오형·신해해·묘신원진·묘신귀문은 세운(丙午)·월운(丙申)과
     *                       원국 사이의 관계라 자료에 **있다**. 여기서는 원국만 봤다
     *   이름을 잘라 맞춘다   자료의 「병신합수」를 「병신합」으로 잘라 놓고 못 찾았다
     *   간지가 한국어와 겹친다  寅·丁이 간지라 「인정해」가 관계 이름 꼴로 걸린다
     *
     * 셋 다 고칠 수 있지만, **지금 고치면 평가 전에 평가기를 또 짓게 된다.** 원문이
     * 남으므로 열다섯 건에서 실제 표현을 본 뒤 `rescore-ab.ts` 에서 고치는 편이 낫다.
     * 그때까지는 의심 후보만 모은다.
     */
    id: '허위-이름',
    hard: false,
    pass: unknown.length === 0,
    detail: unknown.join(', '),
  };
}

/** 천간에 걸린 신살을 같은 기둥 지지의 것과 묶었는가 */
function targetMisjoin(saju: Saju, text: string): Gate {
  const hits: string[] = [];

  for (const overlap of saju.overlaps) {
    const stemStars = saju.sinsal.stars.filter((star) =>
      star.hits.some((hit) => hit.position === overlap.position && hit.target === 'stem'),
    );
    const branchNames = [...overlap.branch.map((r) => r.ko), ...(overlap.emptiness.length ? ['공망'] : [])];

    for (const star of stemStars) {
      for (const sentence of text.split(/(?<=[.。!?])\s|\n/)) {
        if (!sentence.includes(star.ko)) continue;
        const together = branchNames.filter((name) => sentence.includes(name));
        if (together.length > 0) hits.push(`${star.ko} × ${together.join('/')}`);
      }
    }
  }

  return { id: 'target-오조인', hard: true, pass: hits.length === 0, detail: [...new Set(hits)].join(', ') };
}

/** 옮겨 적은 신살과 그 원본을 한 문장에서 근거 둘로 세었는가 */
function doubleCounted(saju: Saju, text: string): Gate {
  const pairs: [string, string][] = [];
  for (const star of saju.sinsal.stars) {
    if (star.kind !== 'gwimun' && star.kind !== 'wonjin') continue;
    const source = star.kind === 'gwimun' ? 'branchGhostGate' : 'branchResentment';
    for (const relation of saju.relations.filter((r) => r.kind === source)) {
      pairs.push([star.ko, relation.ko]);
    }
  }

  const hits = pairs.filter(([starKo, relationKo]) =>
    text
      .split(/\n\n+/)
      .some(
        (para) =>
          para.includes(starKo) &&
          para.includes(relationKo) &&
          /또(한)?|게다가|뿐(만)? 아니라|더구나|여기에/.test(para),
      ),
  );

  return {
    id: '중복-근거',
    hard: true,
    pass: hits.length === 0,
    detail: hits.map(([a, b]) => `${a}+${b}`).join(', '),
  };
}

/** 시간 미상의 반쪽 합을 단정했는가 — **이 명식의 hard gate** */
function absorptionCaveat(saju: Saju, text: string): Gate {
  const risky = saju.relations.filter((r) => absorbableByUnknownHour(r, saju.meta.hourKnown));
  if (risky.length === 0) return { id: '반합-단서', hard: true, pass: true, detail: '해당 없음' };

  const missing = risky
    .filter((relation) =>
      text
        .split(/\n\n+/)
        .some(
          (para) =>
            para.includes(relation.ko) && !/흡수|시주에 따라|시각을 몰라|시주를 알면/.test(para),
        ),
    )
    .map((r) => r.ko);

  return {
    id: '반합-단서',
    hard: true,
    pass: missing.length === 0,
    detail: missing.length ? `단서 없이 단정: ${missing.join(', ')}` : `${risky.length}건 모두 단서 있음`,
  };
}

/** 겹침을 몇 군데나 썼는가 — 예산은 둘이다 */
function overlapBudget(saju: Saju, text: string): Gate {
  const positions = new Set<string>();
  const PILLAR_KO: Record<string, string> = { year: '년주', month: '월주', day: '일주', hour: '시주' };

  for (const overlap of saju.overlaps) {
    const names = [...overlap.stem, ...overlap.branch].map((r) => r.ko);
    if (names.length === 0) continue;

    for (const para of text.split(/\n\n+/)) {
      const named = names.some((name) => para.includes(name));
      const seated = para.includes(PILLAR_KO[overlap.position]) || para.includes(`${overlap.position}`);
      if (named && seated) positions.add(overlap.position);
    }
  }

  return {
    id: '겹침-예산',
    hard: false, // 문단 단위 어림이라 사람이 다시 본다
    pass: positions.size <= 2,
    detail: `${positions.size}곳 (${[...positions].join(',')})`,
  };
}

export const GATES = [fabricated, targetMisjoin, doubleCounted, absorptionCaveat, overlapBudget];
export { FIXTURES, ARMS };
export type { Gate };

// ─── 실행 ──────────────────────────────────────────────────────────────────

/**
 * 이 하네스만의 문턱 — **운영과 다른 조건이라 결과에 적는다.**
 *
 * 운영은 제출하고 떠나므로(ADR 0020) 함수 수명에 안 매인다. 이 동기 경로만 240초에
 * 걸려 열다섯 번짜리 비교가 완주를 못 했다 — 넷 중 둘이 거기서 섰다. 재는 것이
 * 프롬프트의 품질이지 그 문턱이 아니므로 넉넉히 준다.
 */
const EVAL_TIMEOUT_MS = 900_000;

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`);
  return at < 0 ? undefined : argv[at + 1];
};
const has = (name: string) => argv.includes(`--${name}`);

const execute = has('execute');
/** 한 자리만 다시 보고 싶을 때 — 진단 호출이 열다섯 번을 끌고 가지 않게 한다 */
const onlyFixture = flag('fixture');
const onlyArm = flag('arm');
const repeat = Number(flag('repeat') ?? 1);
const maxCalls = Number(flag('max-calls') ?? 0);
const maxUsd = Number(flag('max-usd') ?? 0);

const chosenFixtures = FIXTURES.filter((f) => onlyFixture === undefined || f.id === onlyFixture);
const chosenArms = ARMS.filter((a) => onlyArm === undefined || a.id === onlyArm);

if (chosenFixtures.length === 0) throw new Error(`그런 명식이 없다: ${onlyFixture}`);
if (chosenArms.length === 0) throw new Error(`그런 군이 없다: ${onlyArm}`);

const planned = chosenFixtures.length * chosenArms.length * repeat;
const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * dry-run 과 실제 실행을 **다른 이름으로 남긴다.**
 *
 * 한 자리에 섞어 두었더니 dry-run 산출물을 치우는 `rm -rf .ab-overlaps` 가 **돈을
 * 치른 실행의 원문까지** 가져갔다. 출력 원문을 남기는 이유가 「고친 게이트로 다시
 * 세려고」인데, 그 원문이 청소에 쓸려 나가면 남긴 값이 없다.
 *
 * 이제 dry-run 은 `dry-`, 실제 실행은 `run-` 으로 선다. 치울 때는 `dry-*` 만 지운다.
 */
const outDir = join('.ab-overlaps', `${execute ? 'run' : 'dry'}-${stamp}`);

/**
 * 단가 — **옮겨 적은 값이라 언제 어디서 왔는지 함께 둔다.**
 *
 * 100만 토큰당 USD. 2026-08-31 에 OpenAI 가격표에서 옮겼다. 값이 낡으면 상한이
 * 조용히 헐거워지므로, 실행할 때마다 계산 근거를 결과에 함께 적어 나중에 되짚을 수
 * 있게 한다(`runs.json.pricing`).
 */
const PRICING = {
  model: GENERATION.model,
  source: 'https://developers.openai.com/api/docs/pricing',
  quotedOn: '2026-08-31',
  perMillionUsd: { input: 0.2, cacheRead: 0.02, cacheWrite: 0.25, output: 1.2 },
} as const;

/**
 * 이 호출이 쓴 돈. **못 세면 `null` 이고, 그때는 멈춘다.**
 *
 * 0 으로 돌려주면 상한이 영영 안 걸린다 — 「없다」와 「못 셌다」를 가르는 자리가
 * 여기서는 곧 돈이다.
 */
function costOf(usage: ModelUsage | null): number | null {
  if (usage === null) return null;

  const { noCacheTokens, cacheReadTokens, cacheWriteTokens, outputTokens } = usage;

  // **넷 중 하나라도 모르면 비용도 모른다.** 캐시 칸만 `?? 0` 으로 메우고 있었는데,
  // 그것은 「모르면 멈춘다」와 정면으로 어긋난다 — 안 준 자리를 0 으로 읽으면 값이
  // 조용히 작아지고, 작아진 누계는 상한에 안 걸린다.
  if (
    noCacheTokens === null ||
    cacheReadTokens === null ||
    cacheWriteTokens === null ||
    outputTokens === null
  ) {
    return null;
  }

  const { input, cacheRead, cacheWrite, output } = PRICING.perMillionUsd;

  return (
    (noCacheTokens * input +
      cacheReadTokens * cacheRead +
      cacheWriteTokens * cacheWrite +
      outputTokens * output) /
    1_000_000
  );
}

type Run = {
  fixture: string;
  arm: Arm['id'];
  rep: number;
  promptHash: string;
  promptChars: number;
  /** provider 가 실제로 답한 모델 — 요청한 이름과 다를 수 있다 */
  modelId?: string | null;
  usage?: ModelUsage | null;
  usd?: number | null;
  /** 이 호출에 걸린 시간. 240초 문턱에 얼마나 붙어 있는지가 여기서 보인다 */
  durationMs?: number;
  text?: string;
  /**
   * **프로덕션 검사를 그대로 태운 결과.**
   *
   * 모델이 응답했다고 성공이 아니다 — 서비스는 그 뒤에 `checkReading` 을 지나야
   * 저장한다. 하네스가 그것을 안 태우면 실제로는 거절될 글을 품질 평가하게 된다.
   */
  production?: { ok: boolean; failures?: { code: string; detail: string }[] };
  /**
   * 주문한 분량과 실제 — **사용자 본문 기준이다.**
   *
   * 앞판은 `markdown.length` 로 쟀다. 계약이 「검사용 근거 절은 분량에 넣지 않는다」고
   * 적어 두었는데 그것을 안 따라서, 근거 절까지 합친 값을 주문과 견주고 「27% 초과」라고
   * 읽었다. `measureMarkdown` 이 이미 `readingBody` 로 자른 길이를 낸다.
   */
  length?: {
    /** 사용자에게 보이는 본문 */
    body: number;
    /** 근거 절까지 합친 전체 */
    whole: number;
    target: { min: number; max: number };
    overBy: number;
    sections: number;
  };
  error?: string;
  errorCode?: string;
  gates?: Gate[];
};

/**
 * **군이 실제로 갈렸는지 먼저 묻는다.**
 *
 * A 가 조용히 B 와 같아지는 것이 이 하네스의 최악의 실패다 — 그러면 「차이가 없다」가
 * 나오고, 그 결론은 지시가 무력하다는 뜻이 아니라 **재지 않았다**는 뜻이다.
 * 제목이 바뀌면 `cutSection` 이 던지고, 자료가 안 지워지면 여기서 걸린다.
 */
function checkArms(saju: Saju): void {
  // **고른 군만 본다.** `--arm B` 로 한 군만 부를 때 없는 군을 견주면 죽는다.
  if (chosenArms.length < ARMS.length) {
    for (const arm of chosenArms) arm.build(saju);
    return;
  }

  const built = Object.fromEntries(ARMS.map((arm) => [arm.id, arm.build(saju)]));

  if (/"overlaps"/.test(built.A)) throw new Error('A 군에 overlaps 가 남았다 (자료나 상한표)');
  if (!/"overlaps"/.test(built.B)) throw new Error('B 군에 overlaps 가 없다 — 대조가 성립하지 않는다');
  for (const heading of OVERLAP_SECTIONS) {
    if (built.A.includes(heading)) throw new Error(`A 군에 절이 남았다: ${heading}`);
    if (!built.B.includes(heading)) throw new Error(`B 군에 절이 없다: ${heading}`);
  }
  if (built.C.includes(BUDGET_SECTION)) throw new Error('C 군에 예산 절이 남았다');
  if (built.C.length >= built.B.length) throw new Error('C 가 B 보다 짧지 않다');

  const same = ARMS.flatMap((one, i) =>
    ARMS.slice(i + 1).map((other) =>
      built[one.id] === built[other.id] ? `${one.id}=${other.id}` : null,
    ),
  ).filter((x) => x !== null);
  if (same.length > 0) throw new Error(`군이 서로 같다: ${same.join(', ')}`);
}

async function main() {
  console.log(`군 ${chosenArms.length} × 명식 ${chosenFixtures.length} × 반복 ${repeat} = 호출 ${planned}회`);

  for (const fixture of chosenFixtures) checkArms(computeSaju(fixture.input));
  console.log('군 무결성 확인 — 셋이 서로 다르고, 갈린 자리가 의도한 자리다\n');

  if (execute) {
    if (!maxCalls || !maxUsd) {
      console.error('--execute 는 --max-calls 와 --max-usd 를 함께 요구한다. 상한 없는 실행은 없다.');
      process.exit(1);
    }
    if (planned > maxCalls) {
      console.error(`계획 ${planned}회가 상한 ${maxCalls}회를 넘는다.`);
      process.exit(1);
    }

    /**
     * 시작 전 **거친 어림값** — 명백히 큰 실행을 미리 접는다.
     *
     * **바닥값이 아니다.** 한동안 그렇게 부르고 「이걸 넘으면 실제도 반드시 넘는다」고
     * 적어 두었는데 틀린 말이었다. 값이 글자 수인데 과금은 토큰 수라, 한 토큰이 여러
     * 글자일 수도 한 글자가 여러 토큰일 수도 있다 — 어느 방향으로도 어긋난다.
     *
     * 정확한 사전 거절이 필요하면 tokenizer 를 들여야 한다. 그때까지 이 줄은
     * **자릿수가 틀린 실행을 막는 용도**이고, 진짜 상한은 호출 사이 누계가 든다.
     */
    const estimatedInputUsd =
      (FIXTURES.flatMap((fixture) => {
        const saju = computeSaju(fixture.input);
        return ARMS.map((arm) => arm.build(saju).length * repeat);
      }).reduce((sum, chars) => sum + chars, 0) *
        PRICING.perMillionUsd.input) /
      1_000_000;

    if (estimatedInputUsd > maxUsd) {
      console.error(
        `입력만 거칠게 어림해도 $${estimatedInputUsd.toFixed(4)} 로 상한 $${maxUsd} 를 넘는다.`,
      );
      process.exit(1);
    }
    console.log(
      `입력 어림값 $${estimatedInputUsd.toFixed(4)} — 상한 $${maxUsd}. 글자 수로 잰 어림이라 실제와 다르다`,
    );
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY 가 없다.');
      process.exit(1);
    }
  }

  const runs: Run[] = [];
  let spentUsd = 0;

  /**
   * **디렉터리와 manifest 를 먼저 만든다.**
   *
   * 앞판은 열다섯 번이 다 끝난 뒤에야 파일을 썼다. 열네 번 값을 치르고 끊기면
   * 아무것도 안 남는다 — 돈을 쓰는 반복문에서 결과를 메모리에만 들고 있으면 안 된다.
   */
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        execute,
        repeat,
        planned,
        maxCalls,
        maxUsd,
        requestedModel: GENERATION.model,
        evalTimeoutMs: EVAL_TIMEOUT_MS,
        pricing: PRICING,
        arms: ARMS.map((arm) => ({ id: arm.id, label: arm.label })),
        fixtures: FIXTURES.map((f) => ({ id: f.id, asks: f.asks })),
      },
      null,
      2,
    ),
  );

  const runsPath = join(outDir, 'runs.jsonl');
  writeFileSync(runsPath, '');
  /** 호출 하나가 끝날 때마다 곧바로 붙인다 — 성공도 실패도 usage 도 */
  const checkpoint = (run: Run) => appendFileSync(runsPath, `${JSON.stringify(run)}\n`);

  for (const fixture of chosenFixtures) {
    const saju = computeSaju(fixture.input);

    for (const arm of chosenArms) {
      const prompt = arm.build(saju);

      for (let rep = 1; rep <= repeat; rep += 1) {
        const run: Run = {
          fixture: fixture.id,
          arm: arm.id,
          rep,
          promptHash: hash(prompt),
          promptChars: prompt.length,
        };

        if (execute) {
          // **호출 사이에서 멈추는 상한이다.** 이미 넘었으면 다음 것을 안 부른다 —
          // 출력 토큰에 상한이 없어 한 호출분은 넘어설 수 있다.
          if (spentUsd >= maxUsd) {
            console.log(`\n상한 도달 — $${spentUsd.toFixed(4)} / $${maxUsd}. 남은 호출을 접는다.`);
            break;
          }

          const startedAt = Date.now();
          const result = await callModel(prompt, EVAL_TIMEOUT_MS);
          run.durationMs = Date.now() - startedAt;

          if (result.ok) {
            const markdown = result.output.markdown;
            run.text = markdown;
            run.usage = result.usage;
            run.modelId = result.modelId;
            run.usd = costOf(result.usage);

            const verdict = checkReading({
              kind: 'self',
              output: result.output,
              evidenceText: prompt,
              secrets: [],
            });
            run.production = verdict.ok
              ? { ok: true }
              : { ok: false, failures: verdict.failures.map((f) => ({ code: f.code, detail: f.detail })) };

            const target = CONTROL.selfLength;
            const measured = measureMarkdown(markdown);
            run.length = {
              body: measured.length,
              whole: measured.whole,
              target,
              overBy: Math.max(0, measured.length - target.max),
              sections: measured.headings,
            };

            run.gates = GATES.map((gate) => gate(saju, markdown));
          } else {
            run.error = `${result.code}: ${result.detail}`;
            run.errorCode = result.code;
            run.usage = null;
            run.usd = null;
          }

          if (run.usd === null) {
            checkpoint(run);
            runs.push(run);
            console.error(
              `\n쓴 양을 못 셌다(${run.error ?? 'usage 없음'}). 비용을 검증할 수 없으므로 멈춘다.`,
            );
            console.error(`여기까지 $${spentUsd.toFixed(4)} — ${outDir}`);
            process.exit(1);
          }

          spentUsd += run.usd;
        }

        checkpoint(run);
        runs.push(run);
        console.log(
          `  ${fixture.id.padEnd(30)} ${arm.id}  rep${rep}  ${run.promptHash}  ${run.promptChars}자` +
            (run.durationMs === undefined ? '' : `  ${(run.durationMs / 1000).toFixed(0)}s`) +
            (run.length === undefined
              ? ''
              : `  본문 ${run.length.body}자${run.length.overBy > 0 ? `(+${run.length.overBy} 초과)` : ''}` +
                `  ${run.production?.ok ? '검사통과' : `검사FAIL:${run.production?.failures?.map((f) => f.code).join()}`}`) +
            (run.usd == null ? '' : `  $${run.usd.toFixed(4)}  누계 $${spentUsd.toFixed(4)}`) +
            (run.error ? `  ✗ ${run.error}` : run.gates ? `  ${run.gates.filter((g) => !g.pass).map((g) => g.id).join(',') || 'gate 통과'}` : ''),
        );
      }
    }
  }

  writeFileSync(
    join(outDir, 'runs.json'),
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        execute,
        repeat,
        requestedModel: GENERATION.model,
        respondedModels: [...new Set(runs.map((r) => r.modelId).filter(Boolean))],
        pricing: PRICING,
        spentUsd,
        runs,
      },
      null,
      2,
    ),
  );

  // 군 이름을 가리고 순서를 섞은 채 사람에게 보인다.
  if (execute) {
    const shuffled = [...runs].filter((r) => r.text).sort(() => Math.random() - 0.5);
    const blind = shuffled
      .map((run, index) => `## 글 ${index + 1} — 명식 \`${run.fixture}\`\n\n${run.text}\n`)
      .join('\n---\n\n');
    writeFileSync(join(outDir, 'blind.md'), blind);
    writeFileSync(
      join(outDir, 'key.json'),
      JSON.stringify(shuffled.map((r, i) => ({ 글: i + 1, arm: r.arm, fixture: r.fixture, rep: r.rep })), null, 2),
    );
  }

  console.log(
    `\n${execute ? `실행 끝 — $${spentUsd.toFixed(4)} 썼다` : 'dry-run 끝'}. → ${outDir}`,
  );
  if (!execute) console.log('치울 때는 `rm -rf .ab-overlaps/dry-*` — `run-*` 은 원문이라 남긴다.');
  if (!execute) console.log('실제 호출은 --execute --max-calls N --max-usd N');
}

/**
 * **불러오기만 하면 돌지 않는다.**
 *
 * 재채점기가 이 모듈에서 게이트와 명식을 가져다 쓰는데, 여기서 곧바로 `main()` 이
 * 돌면 저장된 글을 다시 세려다 새 실행이 시작된다 — 돈이 드는 쪽이 부작용으로
 * 딸려 오면 안 된다.
 */
// 실행기가 `argv` 를 정상 모양으로 맞춰 주므로 한 자리만 보면 된다.
if (process.argv[1]?.endsWith('ab-overlaps.ts')) void main();
