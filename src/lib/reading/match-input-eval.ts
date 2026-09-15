import { analyzeCompatibility, computeSaju, type Saju, type SajuInput } from '../saju';
import type { SharedEvidence } from '../saju/evidence/shared';

import { checkReading, type BirthSecret } from './check';
import { readingBody, readingGrounding } from './display';
import { FALLBACK_NAMES } from './prompt';

/**
 * **인연 궁합 입력 두 판을 견주는 자** — 모델을 부르지 않는 절반이다(ADR 0067).
 *
 * 부르는 쪽은 `call.live.test.ts` 의 `READING_MATCH_INPUT_LIVE` 블록이다. 여기는 표본과
 * 재는 법을 든다. 갈라 두는 까닭은 **표본이 실험을 겨누는지를 돈 없이 늘 재기 위해서**다.
 *
 * ## 이 자가 재지 않는 것
 *
 * - **관계가 실제로 잘 되는가.** 이것은 AI 설명의 품질 비교다.
 * - **어느 글이 더 좋은가.** 그것은 사람이 블라인드로 고른다(`blindPacket`). 아래 수치는
 *   규칙 위반과 이탈의 **지표**이고, 선호와 섞어 적지 않는다.
 * - **자리 혼동의 판정.** 자리가 나오는 문장을 모아 줄 뿐이고, 맞는지는 사람이 자료와 대 본다.
 */

export type MatchFixture = {
  readonly id: string;
  /** 이 짝으로 무엇을 보려 하는가 */
  readonly asks: string;
  readonly a: SajuInput;
  readonly b: SajuInput;
};

/**
 * 표본 — **관계 구조가 서로 다른 넷.** 성질은 `fixtureTraits` 가 재고 시험이 잠근다.
 *
 * 전부 테스트용으로 고른 입력이다. 사람의 명식이 아니다.
 */
export const MATCH_INPUT_FIXTURES: readonly MatchFixture[] = [
  {
    id: 'internal-rival',
    asks: '두 사람 사이 합을 한 사람 원국 안 글자가 함께 문다 — 확장형만 그 연결을 받는다. 신강/신약이 갈린다',
    a: { year: 1984, month: 1, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' },
    b: { year: 1985, month: 4, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' },
  },
  {
    id: 'combined-formation',
    asks: '두 사람 글자가 함께 세 글자 구조를 온전히 이룬다 — 한 사실로 읽고 중복 집계하지 않는가',
    a: { year: 1984, month: 1, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' },
    b: { year: 1986, month: 4, day: 5, hour: 15, minute: 10, second: 0, gender: 'female' },
  },
  {
    id: 'day-branch-clash',
    asks: '두 일지가 충한다 — 자리를 맞게 짚는가. 억부 후보를 가진 쪽이 한쪽뿐이다',
    a: { year: 1984, month: 1, day: 5, hour: 21, minute: 10, second: 0, gender: 'male' },
    b: { year: 1986, month: 4, day: 18, hour: 2, minute: 10, second: 0, gender: 'female' },
  },
  {
    id: 'hour-unknown-one-side',
    asks: '한쪽 시각을 모르고 반쪽 관계가 있다 — 없는 관계를 단정하지 않는가',
    a: { year: 1984, month: 1, day: 5, hour: 2, minute: 10, second: 0, gender: 'male' },
    b: { year: 1984, month: 7, day: 18, hour: null, gender: 'male' },
  },
];

/** 표본의 성질 — 엔진이 자라 표본이 무뎌지면 시험이 먼저 말한다 */
export function fixtureTraits(a: Saju, b: Saju) {
  const compat = analyzeCompatibility(a, b);
  return {
    internalRival: compat.relations.some((relation) =>
      relation.contested.some((contest) => contest.rivals.some((rival) => rival.chartId === contest.over.chartId)),
    ),
    fullCombinedFormation: compat.combinedFormations.some((relation) => relation.full),
    dayBranchClash: compat.relations.some(
      (relation) => relation.kind === 'branchClash' && relation.participants.every((p) => p.position === 'day'),
    ),
    hourUnknownOneSide: a.meta.hourKnown !== b.meta.hourKnown,
    partialRelation: compat.relations.some((relation) => !relation.full),
    strengthSplit: a.analysis.strength.verdict !== b.analysis.strength.verdict,
    eokbuSplit: compat.eokbuMatch.a.presentInPartner !== compat.eokbuMatch.b.presentInPartner,
  };
}

export const chartsOf = (fixture: MatchFixture) => ({ a: computeSaju(fixture.a), b: computeSaju(fixture.b) });

/** 표본의 「출생 원문」 — 검사가 글에 샜는지 볼 값. 도시는 계산에 안 쓰였다 */
export function secretsOf(fixture: MatchFixture): BirthSecret[] {
  return [fixture.a, fixture.b].map((input) => {
    const date = `${input.year}-${String(input.month).padStart(2, '0')}-${String(input.day).padStart(2, '0')}`;
    return {
      originalDate: date,
      solarDate: date,
      birthTime:
        input.hour === null
          ? null
          : `${String(input.hour).padStart(2, '0')}:${String(input.minute ?? 0).padStart(2, '0')}:00`,
      city: '서울',
    };
  });
}

/** 한 사람 이야기로 새는 낱말 — **지표**다. 나왔다고 틀린 글은 아니다 */
export const PERSONAL_DRIFT_TERMS = [
  '건강',
  '재물',
  '재산',
  '직업운',
  '평생',
  '인생 전반',
  '타고난 성격',
  '신강',
  '신약',
  '용신',
  '억부',
] as const;

/**
 * **검토 후보** — 나왔다고 틀린 글이 아니다. 사람이 문장을 자료와 대 보고 판정한다.
 *
 * 맞는 설명이 안 걸리게 넓게 잡지 않는다 — 「겉글자에 토가 없다」는 사실이라 「없다」만으로는 안 센다.
 */
export const REVIEW_PATTERNS: Readonly<Record<string, RegExp>> = {
  /* 「전혀 없다는 뜻이 아니라」는 확대가 아니라 부정이다 — 그 꼴은 아래 「범위 해설」이 센다 */
  '오행 부재 확대': /(기운|힘|요소)[이가은는도]?\s*(전혀|아예|하나도)(?!.{0,12}(뜻|의미)[이가은는]?\s*아니)|(전혀|아예|하나도)\s*없(?!.{0,8}(뜻|의미)[이가은는]?\s*아니)/,
  /* 「방어적으로 변해요」 같은 말은 안 센다 — 오행 이름 바로 뒤의 「으로 변했다」만 */
  '합화 단정': /합화|(목|화|토|금|수|나무|불|흙|쇠|물)\s*(기운)?\s*(으로|로)\s*(변했|변한|변해|바뀌었|바뀐)/,
  '내부 용어': /후보|시험값|실험적|자료상|자료에 따르면|자료에서|자료만|자료 밖|(이번|현재|이|주어진)\s*자료(에는|에|로는|만으로)/,
  /* 규칙 문장이 본문 해설로 옮겨진 꼴 — 「…라는 뜻이 아니라」「단정하는 말은 아니에요」 */
  '범위 해설': /(뜻|의미|판정|말)[이가은는]?\s*아니(라|에요|다)|단정하는 말|확정하는 판정/,
  '판단 넘기기': /본다면\?|라고 보면\?|라면\?/,
  '역할 배정': /행동하는 (사람|쪽)|판단하는 (사람|쪽)|행동형|판단형|결정하는 (사람|쪽)|추진하는 (사람|쪽)/,
};

/** 자리 이름 — 이 낱말이 든 문장을 사람이 자료와 대 본다 */
const SEAT_WORDS = /(년주|월주|일주|시주|년간|월간|일간|시간|년지|월지|일지|시지|천간|지지|배우자 자리|날 자리)/;

const ELEMENT_KEYS = new Set(['a', 'b', '*']);

/** 자료 JSON 이 가진 키 이름 전부 */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, out));
  else if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      out.add(key);
      keysOf(inner, out);
    }
  }
  return out;
}

/** 경로 문자열을 따라 값을 찾는다 — `compatibility.relations[13].full` · 없으면 `undefined` */
export function valueAt(root: unknown, path: string): unknown {
  const tokens = [...path.replace(/^\$\.?/, '').matchAll(/[^.[\]]+|\[(\d+)\]/g)].map((m) =>
    m[1] === undefined ? m[0] : Number(m[1]),
  );
  let node: unknown = root;
  for (const token of tokens) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string | number, unknown>)[token];
  }
  return node;
}

export type ClaimLike = {
  subject: string;
  statement: string;
  evidence: readonly { path: string; value: string }[];
  reach: string;
};

/** 주장 목록을 자료와 맞춘다 — **경로가 있는가 · 값이 같은가 · 사람이 맞는가** */
export function checkClaims(evidence: SharedEvidence, claims: readonly ClaimLike[]) {
  const problems: { claim: number; statement: string; code: string; detail: string }[] = [];
  const same = (found: unknown, written: string) => {
    const exact = JSON.stringify(found);
    if (exact === written) return true;
    try {
      return JSON.stringify(JSON.parse(written)) === exact;
    } catch {
      return typeof found === 'string' && found === written;
    }
  };

  claims.forEach((claim, index) => {
    if (claim.evidence.length === 0) {
      problems.push({ claim: index, statement: claim.statement, code: 'no-evidence', detail: '근거 없음' });
    }
    for (const ref of claim.evidence) {
      const found = valueAt(evidence, ref.path);
      if (found === undefined) {
        problems.push({ claim: index, statement: claim.statement, code: 'path-missing', detail: ref.path });
        continue;
      }
      if (!same(found, ref.value)) {
        problems.push({ claim: index, statement: claim.statement, code: 'value-mismatch', detail: `${ref.path}: ${ref.value} ≠ ${JSON.stringify(found)}` });
      }
      /* 한 사람에 대한 주장이 반대편 사람의 칸만 가리키면 사람이 바뀐 것일 수 있다 */
      const side = /(?:charts|elementSupport|eokbuMatch)\.(a|b)\b/.exec(ref.path)?.[1];
      const want = claim.subject === '첫 번째 분' ? 'a' : claim.subject === '두 번째 분' ? 'b' : null;
      if (side !== undefined && want !== null && side !== want) {
        problems.push({ claim: index, statement: claim.statement, code: 'subject-side-mismatch', detail: `${claim.subject} ↔ ${ref.path}` });
      }
    }
  });

  return { claims: claims.length, direct: claims.filter((c) => c.reach === 'direct').length, problems };
}

const ELEMENT_WORDS: Readonly<Record<string, RegExp>> = {
  木: /나무|목\s*기운|목의|목이|목은|목\(/,
  火: /불기운|불의 기운|불이|화\s*기운|화의|화\(/,
  土: /흙|토\s*기운|토가|토는|토의|토\(/,
  金: /쇠|금속|금\s*기운|금이|금은|금의|금\(/,
  水: /물기운|물의 기운|물이|수\s*기운|수의|수\(/,
};

/**
 * **사람과 오행이 엇갈린 문장 후보** — 한 사람만 부르며 「없다」고 한 오행이 그 사람의 `missing` 에 없을 때.
 * 확정이 아니다 — 사람이 문장을 자료와 대 본다.
 */
function personElementCandidates(evidence: SharedEvidence, sentences: readonly string[]): string[] {
  const [first, second] = [FALLBACK_NAMES.a as string, FALLBACK_NAMES.b as string];
  const support = evidence.compatibility.elementSupport;
  return sentences.filter((sentence) => {
    const names = [first, second].filter((name) => sentence.includes(name));
    if (names.length !== 1 || !/없/.test(sentence)) return false;
    const missing: readonly string[] = names[0] === first ? support.a.missing : support.b.missing;
    return Object.entries(ELEMENT_WORDS).some(([element, word]) => word.test(sentence) && !missing.includes(element));
  });
}

export type MatchRunMetrics = {
  /** 저장 검사가 막는 것 — 규칙 위반 */
  readonly blocking: readonly string[];
  /** 근거 칸이 이름을 댄 관계 가운데 자료의 관계 목록에 없는 것 — 근거 오류 후보 */
  readonly unknownRelations: readonly string[];
  /** 근거 칸이 댄 경로 가운데 이 자료에 없는 키를 지나는 것 — 근거 오류 후보 */
  readonly absentPaths: readonly string[];
  /** 근거 칸이 이름을 댄 서로 다른 관계 수 / 자료의 관계 수 — 구체성 지표 */
  readonly relationCoverage: { readonly cited: number; readonly available: number };
  /** 검토 후보 문장 — 갈래마다. 오류 확정이 아니다 */
  readonly reviewCandidates: Readonly<Record<string, readonly string[]>>;
  /** 본문에서 자리 이름이 든 문장 — 자리 혼동은 사람이 이것을 자료와 대 보고 판정한다 */
  readonly seatSentences: readonly string[];
  /** 개인 풀이 쪽 이탈 지표 */
  readonly personalDrift: {
    readonly terms: Readonly<Record<string, number>>;
    /** 두 사람 중 한 사람만 부르는 문단 수 / 두 사람 중 누구든 부르는 문단 수 */
    readonly oneSidedParagraphs: number;
    readonly namedParagraphs: number;
  };
  readonly bodyChars: number;
  readonly score: number | null;
  /** 점수 − 기준점 */
  readonly scoreDelta: number | null;
};

export function measureMatchRun({
  evidence,
  output,
  baseline,
  secrets,
}: {
  evidence: SharedEvidence;
  output: { markdown: string; score: number | null; metaphor: string };
  baseline: number;
  secrets: readonly BirthSecret[];
}): MatchRunMetrics {
  const evidenceText = JSON.stringify(evidence);
  const verdict = checkReading({ kind: 'match', output, evidenceText, secrets, baseline });
  const body = readingBody(output.markdown);
  const grounding = readingGrounding(output.markdown) ?? '';

  const relationNames = new Set(evidence.compatibility.relations.map((relation) => relation.ko));
  /**
   * 관계 이름은 **여러 낱말**일 수 있다 — 「인묘 반방합」·「인사신 삼형」. 뒷말을 못 읽으면 앞말만
   * 떨어져 자료에 없는 이름으로 잡힌다(첫 실호출에서 넷이 그렇게 거짓으로 잡혔다). 이름이 아닌
   * 낱말(「반합·반방합의」)은 이름 뒤에 문장 부호가 붙으므로 따로 거른다. 모델은 `relations` 대신 「관계」로도 적고,
   * 「인신충 2건」처럼 수를 붙이기도 한다.
   */
  const cited = [
    ...grounding.matchAll(/(?:relations|관계)\s+([가-힣]+(?:\s(?:반방합|반합|삼형|삼합|방합|[가-힣]+방))?)(?=\s*(?:\d+건\s*)?\[)/g),
  ].map((m) => m[1]);
  const keys = keysOf(evidence);
  const paths = [
    ...grounding.matchAll(
      /\b(?:charts|compatibility|analysis|contract|limitations|sinsal|now|daeun|stages|eokbuMatch|elementSupport|tenGods|combinedFormations)(?:\.[A-Za-z*]+)+/g,
    ),
  ].map((m) => m[0]);

  const sentences = body
    .split(/(?<=[.!?。])\s+|\n/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '' && !sentence.startsWith('#'));
  const names = [FALLBACK_NAMES.a as string, FALLBACK_NAMES.b as string];
  const paragraphs = body.split(/\n{2,}/).filter((paragraph) => !paragraph.startsWith('#'));
  const named = paragraphs.filter((paragraph) => names.some((name) => paragraph.includes(name)));

  return {
    blocking: verdict.ok ? [] : verdict.failures.map((failure) => `${failure.code}: ${failure.detail}`),
    unknownRelations: [...new Set(cited.filter((name) => !relationNames.has(name)))],
    absentPaths: [
      ...new Set(
        paths.filter((path) =>
          path.split('.').some((segment) => !ELEMENT_KEYS.has(segment) && !keys.has(segment)),
        ),
      ),
    ],
    relationCoverage: { cited: new Set(cited.filter((name) => relationNames.has(name))).size, available: relationNames.size },
    seatSentences: sentences.filter((sentence) => SEAT_WORDS.test(sentence)),
    reviewCandidates: Object.fromEntries(
      [
        ...Object.entries(REVIEW_PATTERNS).map(
          ([name, pattern]) => [name, sentences.filter((sentence) => pattern.test(sentence))] as const,
        ),
        ['사람-오행 엇갈림', personElementCandidates(evidence, sentences)] as const,
      ].filter(([, found]) => found.length > 0),
    ),
    personalDrift: {
      terms: Object.fromEntries(
        PERSONAL_DRIFT_TERMS.map((term) => [term, body.split(term).length - 1]).filter(([, count]) => (count as number) > 0),
      ),
      oneSidedParagraphs: named.filter((paragraph) => names.filter((name) => paragraph.includes(name)).length === 1).length,
      namedParagraphs: named.length,
    },
    bodyChars: body.length,
    score: output.score,
    scoreDelta: output.score === null ? null : output.score - baseline,
  };
}

export type MatchRunRecord = {
  readonly fixture: string;
  readonly variant: string;
  readonly rep: number;
  readonly ok: boolean;
  readonly failure?: string;
  readonly metrics?: MatchRunMetrics;
};

const mean = (values: readonly number[]) =>
  values.length === 0 ? null : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

/** 표본 × 판마다 모은다 — **규칙 위반 수치만.** 선호는 여기 없다 */
export function aggregateMatchRuns(records: readonly MatchRunRecord[]) {
  const groups = new Map<string, MatchRunRecord[]>();
  for (const record of records) {
    const key = `${record.fixture}|${record.variant}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }

  return [...groups].map(([key, group]) => {
    const [fixture, variant] = key.split('|');
    const measured = group.flatMap((record) => (record.metrics ? [record.metrics] : []));
    const scores = measured.flatMap((m) => (m.score === null ? [] : [m.score]));
    const scoreMean = mean(scores);
    return {
      fixture,
      variant,
      calls: group.length,
      failedCalls: group.filter((record) => !record.ok).length,
      blockingRuns: measured.filter((m) => m.blocking.length > 0).length,
      blockingCodes: [...new Set(measured.flatMap((m) => m.blocking.map((b) => b.split(':')[0])))],
      unknownRelationsMean: mean(measured.map((m) => m.unknownRelations.length)),
      absentPathsMean: mean(measured.map((m) => m.absentPaths.length)),
      relationCoverageMean: mean(
        measured.map((m) => (m.relationCoverage.available === 0 ? 0 : m.relationCoverage.cited / m.relationCoverage.available)),
      ),
      seatSentencesMean: mean(measured.map((m) => m.seatSentences.length)),
      driftTermsMean: mean(measured.map((m) => Object.values(m.personalDrift.terms).reduce((sum, n) => sum + n, 0))),
      oneSidedRatioMean: mean(
        measured.map((m) =>
          m.personalDrift.namedParagraphs === 0 ? 0 : m.personalDrift.oneSidedParagraphs / m.personalDrift.namedParagraphs,
        ),
      ),
      scores,
      scoreMean,
      scoreRange: scores.length === 0 ? null : [Math.min(...scores), Math.max(...scores)],
      scoreSd:
        scores.length < 2 || scoreMean === null
          ? null
          : Number(Math.sqrt(scores.reduce((sum, s) => sum + (s - scoreMean) ** 2, 0) / (scores.length - 1)).toFixed(2)),
      scoreDeltaMean: mean(measured.flatMap((m) => (m.scoreDelta === null ? [] : [m.scoreDelta]))),
    };
  });
}

/** 씨앗으로 섞는다 — 같은 씨앗이면 같은 차례라 되짚을 수 있다 */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 블라인드 묶음 — **판 이름과 점수를 가린다.**
 *
 * 표본마다 한 덩어리로 묶고 그 안에서 섞는다. 점수는 판마다 다른 근거로 움직이므로
 * 보이면 선호가 점수를 따라간다. 열쇠(`key`)는 따로 떨군다.
 */
export function blindPacket(
  runs: readonly { fixture: string; variant: string; rep: number; markdown: string; metaphor: string }[],
  seed: number,
) {
  const key: { label: string; fixture: string; variant: string; rep: number }[] = [];
  const sections: string[] = [];
  let label = 0;

  for (const fixture of [...new Set(runs.map((run) => run.fixture))]) {
    const asks = MATCH_INPUT_FIXTURES.find((one) => one.id === fixture)?.asks ?? '';
    sections.push(`# 표본 \`${fixture}\`\n\n> 보려는 것: ${asks}`);
    for (const run of shuffled(runs.filter((one) => one.fixture === fixture), seed)) {
      label += 1;
      key.push({ label: `글 ${label}`, fixture, variant: run.variant, rep: run.rep });
      sections.push(`## 글 ${label}\n\n**한 줄 요약** — ${run.metaphor}\n\n${readingBody(run.markdown)}`);
    }
  }

  return { markdown: sections.join('\n\n---\n\n'), key };
}
