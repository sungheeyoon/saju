import type { ChartEvidence, Limitation } from '.';
import type { RedactedChartEvidence, RedactedEvidence } from './redacted';

/**
 * Match 동의 범위로 **한 번 더 고른** 자료 — 인연 궁합(`match`)만 쓴다.
 *
 * `redactEvidence` 와 하는 일이 다르다. 그쪽은 **모델에게 넘기지 않기로 한 것**
 * (출생 원문·출생지)을 뺐고, 여기는 **인연 궁합 설명에 무엇을 넣을지**를 고른다
 * (ADR 0012·0067). 두 컷은 겹치지 않으므로 따로 선다.
 *
 * ## 빼는 것이 아니라 **고른다**
 *
 * 전에는 `compatibility` 를 통째로 남기고 명식에서 키 몇 개만 뺐다. 그러면 엔진에 새
 * 필드가 들어오는 날 그것이 조용히 모델까지 간다 — 실제로 그렇게 성별·조자시 옵션·
 * 각자의 억부 후보가 실려 있었다. 이제 **넣을 필드를 하나씩 적어서 새 객체를 짓는다.**
 *
 * ## 두 판 — 어느 쪽이 나은지는 아직 모른다
 *
 * - `limited-v1` (제한형, **운영**) — 여덟 글자와 자리 · 두 사람 사이 관계와 함께 이루는
 *   구조 · 글자 수로 센 오행 보완 · 두 일간 사이 십성 · 한계.
 * - `extended-v1` (확장형, **실험 전용**) — 위에 각자의 신강신약 · 억부 후보 · 가중 오행
 *   세력과, 쟁합을 설명하는 원국 안 연결을 더한다. 개인 신살·격국 전체·대운·지금 운은
 *   더하지 않는다.
 *
 * **운영은 제한형 A 다**(2026-09-15). 옛 컷(`legacy-v0`, `compatibility` 통째)은 저장된 옛 풀이를
 * 되짚을 때만 쓰고, 확장형 B 는 동의 화면이 연 범위보다 넓어 실험에만 있다(ADR 0067).
 */

export const MATCH_INPUTS = ['legacy-v0', 'limited-v1', 'extended-v1'] as const;
export type MatchInput = (typeof MATCH_INPUTS)[number];

/** 견주는 두 판 — 옛 컷은 비교 대상이 아니다 */
export const COMPARED_MATCH_INPUTS = ['limited-v1', 'extended-v1'] as const satisfies readonly MatchInput[];

/**
 * 운영 기본값 — **제한형 A**(2026-09-15 부터, ADR 0067).
 *
 * 실험(1~5라운드)을 마치고 사용자가 A 입력 + 인연 궁합 읽는 법 4판을 한 세트로 올렸다. 옛 컷
 * (`legacy-v0`)은 이미 저장된 풀이를 되짚을 때와 비교용으로만 남는다. 확장형 B 는 동의 범위 밖이라
 * 실험에만 있다.
 */
export const DEFAULT_MATCH_INPUT: MatchInput = 'limited-v1';

/**
 * 판마다 **실제로 들어가는 필드** — 경로와 뜻.
 *
 * 시험이 이 목록과 직렬화된 자료의 키를 **양쪽으로** 맞춘다. 목록에만 있고 자료에 없거나,
 * 자료에만 있고 목록에 없으면 빨간불이다. 실험 기록(`manifest.json`)도 이 값을 그대로 적는다.
 */
export const MATCH_INPUT_FIELDS: Record<MatchInput, Readonly<Record<string, string>>> = {
  'legacy-v0': {
    'charts.*.{claims.pillars,claims.meta,pillars,meta}': '명식 — 여덟 글자와 `pillars.meta`·`meta` 전부(성별·계산 옵션·절입·경계 문장 포함)',
    compatibility: '궁합 결과 **통째로** — 억부 후보·가중 세력·원국 안 쟁합 경쟁자 포함',
    'limitations[]': '경계 경고 원문',
  },
  'limited-v1': {
    'charts.*.pillars.{year,month,day,hour}': '여덟 글자 — 천간·지지·간지·한글·60갑자 번호',
    'charts.*.pillars.dayMaster': '일간',
    'charts.*.pillars.meta.hourKnown': '시각을 입력했는가',
    'charts.*.meta.hourKnown': '같은 값 — 프롬프트가 이 경로로 부른다',
    'charts.*.claims.{pillars,meta}': '말의 세기 상한',
    'compatibility.relations[]': '두 원국 사이 관계 — 종류·이름·참여자(판·자리·글자)·완성·방향·순환',
    'compatibility.relations[].contested': '쟁합 — **다른 원국의 경쟁자만**',
    'compatibility.combinedFormations[]': '두 사람 글자가 함께 이룬 삼합·방합·삼형 (relations 의 부분집합)',
    'compatibility.elementSupport.*.{missing,supplied,stillMissing}': '글자 수로 센 오행 보완',
    'compatibility.tenGods': '두 일간 글자 사이의 십성 — 양방향',
    'compatibility.{hourKnown,warnings}': '시각을 몰라 적게 보이는 것',
    'compatibility.claims': '위 항목만의 상한',
    'limitations[]': '기둥이 경계에 걸려 달라질 수 있다는 한계(문장 하나로) · 궁합 경고',
  },
  'extended-v1': {
    '(limited-v1 전부)': '위와 같다 — 단 쟁합은 원국 안 경쟁자까지',
    'charts.*.analysis.elements.{glyphCount,counts,ratios,strongest,weakest,missing}': '오행 분포와 지장간 가중 세력',
    'charts.*.analysis.strength.{verdict,ratio,criteria[].{key,label,met},metCount}': '신강신약 판정과 그 기준',
    'charts.*.analysis.eokbu.{status,suggestedElement,role,confidence,presentInChart,unresolved}': '억부 후보(시험값)와 아직 못 본 것',
    'charts.*.claims.{analysis.elements,analysis.strength,analysis.eokbu}': '위 판정의 상한',
    'compatibility.relations[].contested': '쟁합 — 원국 안 경쟁자까지',
    'compatibility.elementSupport.*.weakest': '가중 세력이 가장 약한 오행과 그것이 상대에게 차지하는 비중',
    'compatibility.eokbuMatch': '내 억부 후보를 상대가 가졌는가 — 시험값 딱지째',
  },
};

/** 두 판이 모두 빼는 자리 — 이름과 **왜 빠지는지** */
const WITHHELD_BOTH = {
  relations: '원국 **안에서** 닫힌 형충회합이다. 두 원국 **사이**의 것은 `compatibility` 가 든다',
  stages: '12운성 — 원국 하나의 판정이다',
  sinsal: '공망·12신살·신살 — 원국 하나의 판정이다',
  daeun: '대운은 동의 범위 밖이다',
  now: '지금 도는 운도 마찬가지다',
  'meta.gender': '입력값이다 — 대운 방향에만 쓰이고 대운은 빠진다',
  'pillars.meta.{sajuYear,monthTerm,nextTerm}': '계산 메타다 — 관계 설명에 안 쓰이고 출생일을 좁힌다',
  'pillars.meta.{lateNightRule,lateNightShiftApplied}': '계산 옵션이다(ADR 0012)',
  'pillars.meta.warnings · meta.warnings': '절기·시각 경계 문장은 출생 시각을 좁힌다 — 「기둥이 달라질 수 있다」 한 문장으로 바꿔 싣는다',
  'compatibility.relations[].{id,adjacent,distance}': '참여자의 다른 표기 · 두 원국 사이에서는 늘 비어 있다',
} as const;

export const WITHHELD_PATHS: Record<MatchInput, Readonly<Record<string, string>>> = {
  /** 옛 컷이 들고 나가던 목록 그대로 — 운영 JSON 을 한 글자도 안 바꾼다 */
  'legacy-v0': {
    analysis: '상대 원국 하나에 대한 판정이다 — 십성·오행 세력·신강신약·억부·조후·격국·종격',
    relations: '원국 **안에서** 닫힌 형충회합이다. 두 원국 **사이**의 것은 `compatibility` 가 든다',
    stages: '12운성 — 원국 하나의 판정이다',
    sinsal: '공망·12신살·신살 — 원국 하나의 판정이다',
    daeun: '대운은 동의 범위 밖이다',
    now: '지금 도는 운도 마찬가지다',
  },
  'limited-v1': {
    analysis: '원국 하나에 대한 판정이다 — 십성·오행 세력·신강신약·억부·조후·격국·종격',
    ...WITHHELD_BOTH,
    'compatibility.relations[].contested[].rivals (같은 원국)': '원국 안 합이 있다는 사실이다',
    'compatibility.elementSupport.*.weakest': '지장간 가중 세력 — 원국 하나의 판정이다',
    'compatibility.eokbuMatch': '각자의 억부 후보를 드러낸다 — 원국 하나의 판정이다',
  },
  'extended-v1': {
    analysis: '신강신약·억부·오행 세력 **밖의** 판정 — 십성표·조후·격국·종격·통관·서열 등',
    'analysis.strength.{supportScore,opposeScore,criteria[].detail,neededElements}': '같은 판정의 다른 표기다',
    'analysis.eokbu.reason': '판정을 문장으로 옮긴 것이다 — 모델이 그대로 베낀다',
    'analysis.elements.scores': '`ratios` 와 같은 값의 정규화 전 표기다',
    ...WITHHELD_BOTH,
  },
};

/** 경계 경고를 대신하는 한 문장 — 어느 경계인지·몇 분인지는 안 싣는다 */
export const PILLAR_UNCERTAIN =
  '이 명식은 입력 시각이나 절기·시각 경계 때문에 일부 기둥이 달라질 수 있습니다.';

type Relation = NonNullable<RedactedEvidence['compatibility']>['relations'][number];
type Analysis = RedactedChartEvidence['analysis'];

export type SharedRelation = Pick<
  Relation,
  'kind' | 'tier' | 'ko' | 'name' | 'scope' | 'targetElement' | 'full' | 'participants' | 'direction' | 'cycle' | 'contested'
>;

type SharedPillars = Pick<RedactedChartEvidence['pillars'], 'year' | 'month' | 'day' | 'hour' | 'dayMaster'> & {
  meta: { hourKnown: boolean };
};

/** 확장형이 더하는 각자의 판정 — 필드를 적어서 고른다 */
export type SharedAnalysis = {
  elements: Pick<Analysis['elements'], 'glyphCount' | 'counts' | 'ratios' | 'strongest' | 'weakest' | 'missing'>;
  strength: Pick<Analysis['strength'], 'verdict' | 'ratio' | 'metCount'> & {
    criteria: readonly Pick<Analysis['strength']['criteria'][number], 'key' | 'label' | 'met'>[];
  };
  eokbu: Pick<
    Analysis['eokbu'],
    'status' | 'suggestedElement' | 'role' | 'confidence' | 'presentInChart' | 'unresolved'
  >;
};

export type SharedChartEvidence = {
  claims: Partial<RedactedChartEvidence['claims']>;
  pillars: SharedPillars;
  meta: { hourKnown: boolean };
  /** 확장형에만 선다 */
  analysis?: SharedAnalysis;
};

type Compat = NonNullable<RedactedEvidence['compatibility']>;
type Support = Compat['elementSupport']['a'];

export type SharedCompatibility = {
  claims: Partial<Compat['claims']>;
  relations: readonly SharedRelation[];
  combinedFormations: readonly SharedRelation[];
  elementSupport: {
    a: Pick<Support, 'missing' | 'supplied' | 'stillMissing'> & Partial<Pick<Support, 'weakest'>>;
    b: Pick<Support, 'missing' | 'supplied' | 'stillMissing'> & Partial<Pick<Support, 'weakest'>>;
  };
  tenGods: Compat['tenGods'];
  hourKnown: Compat['hourKnown'];
  warnings: Compat['warnings'];
  /** 확장형에만 선다 */
  eokbuMatch?: Compat['eokbuMatch'];
};

/** 옛 컷 — 명식 세 칸을 고르고 궁합은 통째로 남긴다 */
export type LegacySharedEvidence = Omit<RedactedEvidence, 'charts' | 'contract'> & {
  contract: RedactedEvidence['contract'] & {
    withheld: Readonly<Record<string, string>>;
    scope: 'match-consent';
    /** 옛 컷은 이 값을 안 싣는다 — 운영 JSON 을 그대로 두려고 */
    matchInput?: undefined;
  };
  charts: {
    a: Pick<RedactedChartEvidence, 'pillars' | 'meta'> & { claims: Pick<RedactedChartEvidence['claims'], 'pillars' | 'meta'> };
    b: Pick<RedactedChartEvidence, 'pillars' | 'meta'> & { claims: Pick<RedactedChartEvidence['claims'], 'pillars' | 'meta'> };
  };
  compatibility: Compat;
};

export type SharedEvidence = LegacySharedEvidence | CutSharedEvidence;

/** 필드를 적어서 고른 두 판(A·B) */
export type CutSharedEvidence = {
  contract: Omit<RedactedEvidence['contract'], never> & {
    /** 이 판이 빼 둔 자리와 그 이유 */
    withheld: Readonly<Record<string, string>>;
    scope: 'match-consent';
    /** 어느 판으로 골랐는가 — 프롬프트와 검사가 이 값을 맞춘다 */
    matchInput: MatchInput;
  };
  viewedAt: string;
  /** 둘 다 선다 — 공유 결과는 한 사람짜리가 없다 */
  charts: { a: SharedChartEvidence; b: SharedChartEvidence };
  compatibility: SharedCompatibility;
  limitations: readonly Limitation[];
};

const pick = <T extends object, K extends keyof T>(value: T, keys: readonly K[]): Pick<T, K> =>
  Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, value[key]])) as Pick<T, K>;

const shareAnalysis = (analysis: Analysis): SharedAnalysis => ({
  elements: pick(analysis.elements, ['glyphCount', 'counts', 'ratios', 'strongest', 'weakest', 'missing']),
  strength: {
    ...pick(analysis.strength, ['verdict', 'ratio', 'metCount']),
    criteria: analysis.strength.criteria.map((criterion) => pick(criterion, ['key', 'label', 'met'])),
  },
  eokbu: pick(analysis.eokbu, [
    'status',
    'suggestedElement',
    'role',
    'confidence',
    'presentInChart',
    'unresolved',
  ]),
});

function shareChart(chart: RedactedChartEvidence, input: MatchInput): SharedChartEvidence {
  const extended = input === 'extended-v1';
  const claimKeys = extended
    ? (['pillars', 'meta', 'analysis.elements', 'analysis.strength', 'analysis.eokbu'] as const)
    : (['pillars', 'meta'] as const);

  return {
    claims: pick(chart.claims, claimKeys),
    pillars: {
      ...pick(chart.pillars, ['year', 'month', 'day', 'hour', 'dayMaster']),
      meta: { hourKnown: chart.pillars.meta.hourKnown },
    },
    meta: { hourKnown: chart.meta.hourKnown },
    ...(extended ? { analysis: shareAnalysis(chart.analysis) } : {}),
  };
}

/**
 * 관계 하나 — **한 사실 그대로**, 참여자와 속성을 잃지 않는다.
 *
 * 제한형은 쟁합에서 **over 와 같은 원국의 경쟁자**만 뺀다. 그 경쟁자가 있다는 것은 곧
 * 「그 사람 원국 안에 같은 합이 있다」이기 때문이다. 다른 원국의 경쟁자는 두 사람 사이의
 * 사실이라 남고, 경쟁자가 다 빠진 쟁합 항목은 없앤다.
 */
function shareRelation(relation: Relation, input: MatchInput): SharedRelation {
  const base = pick(relation, [
    'kind',
    'tier',
    'ko',
    'name',
    'scope',
    'targetElement',
    'full',
    'participants',
    'direction',
    'cycle',
  ]);

  const contested =
    input === 'extended-v1'
      ? relation.contested
      : relation.contested
          .map((contest) => ({
            over: contest.over,
            rivals: contest.rivals.filter((rival) => rival.chartId !== contest.over.chartId),
          }))
          .filter((contest) => contest.rivals.length > 0);

  return { ...base, contested };
}

function shareCompat(compat: Compat, input: MatchInput): SharedCompatibility {
  const extended = input === 'extended-v1';
  const support = (side: Support) =>
    extended
      ? pick(side, ['missing', 'supplied', 'stillMissing', 'weakest'])
      : pick(side, ['missing', 'supplied', 'stillMissing']);
  const claimKeys = [
    'relations',
    'combinedFormations',
    'elementSupport',
    'tenGods',
    'hourKnown',
    'warnings',
    ...(extended ? (['eokbuMatch'] as const) : []),
  ] as const;

  return {
    claims: pick(compat.claims, claimKeys),
    relations: compat.relations.map((relation) => shareRelation(relation, input)),
    combinedFormations: compat.combinedFormations.map((relation) => shareRelation(relation, input)),
    elementSupport: { a: support(compat.elementSupport.a), b: support(compat.elementSupport.b) },
    tenGods: compat.tenGods,
    hourKnown: compat.hourKnown,
    warnings: compat.warnings,
    ...(extended ? { eokbuMatch: compat.eokbuMatch } : {}),
  };
}

/**
 * 한계 — **경계가 있다는 사실만** 남긴다.
 *
 * 명식 경고는 「입춘 절입 시각과 경계에 아주 가깝습니다」·「23시대 출생이라…조자시 기준」처럼
 * 어느 경계인지와 계산 옵션을 적는다. 관계를 읽는 데 필요한 것은 「기둥이 달라질 수 있다」
 * 하나라 그 문장으로 바꾼다. 문장을 파싱하지 않는다 — 경고가 **있는가**만 본다.
 */
function shareLimitations(limitations: readonly Limitation[]): Limitation[] {
  const chartNotes = (['chart:a', 'chart:b'] as const)
    .filter((where) => limitations.some((limitation) => limitation.where === where))
    .map((where): Limitation => ({ where, kind: null, text: PILLAR_UNCERTAIN }));

  return [...chartNotes, ...limitations.filter((limitation) => limitation.where === 'compatibility')];
}

/**
 * 공유 결과의 자료를 만든다 — **두 사람이 다 있어야 한다.**
 *
 * @returns 궁합이 없거나 한 사람뿐이면 `null`. 그런 자료로 공유 결과를 만들 수 없다.
 */
export function shareEvidence(
  evidence: RedactedEvidence,
  input: MatchInput = DEFAULT_MATCH_INPUT,
): SharedEvidence | null {
  const { b } = evidence.charts;
  if (b === null || evidence.compatibility === null) return null;

  if (input === 'legacy-v0') {
    const legacyChart = (chart: RedactedChartEvidence) => ({
      claims: { pillars: chart.claims.pillars, meta: chart.claims.meta },
      pillars: chart.pillars,
      meta: chart.meta,
    });
    return {
      ...evidence,
      contract: { ...evidence.contract, withheld: WITHHELD_PATHS['legacy-v0'], scope: 'match-consent' },
      charts: { a: legacyChart(evidence.charts.a), b: legacyChart(b) },
      compatibility: evidence.compatibility,
    };
  }

  return {
    contract: {
      ...evidence.contract,
      withheld: WITHHELD_PATHS[input],
      scope: 'match-consent',
      matchInput: input,
    },
    viewedAt: evidence.viewedAt,
    charts: { a: shareChart(evidence.charts.a, input), b: shareChart(b, input) },
    compatibility: shareCompat(evidence.compatibility, input),
    limitations: shareLimitations(evidence.limitations),
  };
}

/**
 * 자료가 **어느 판으로 지어졌는가** — 옛 컷은 값을 안 드므로 `legacy-v0` 로 읽는다.
 *
 * 검사는 모델에 보낸 JSON 문자열만 받는다. 판을 따로 넘기면 자료와 검사가 다른 판을
 * 말할 수 있으므로, 자료가 든 값에서 읽는다.
 */
export function matchInputOfEvidenceText(evidenceText: string): MatchInput {
  try {
    const found = (JSON.parse(evidenceText) as { contract?: { matchInput?: unknown } }).contract?.matchInput;
    return (COMPARED_MATCH_INPUTS as readonly unknown[]).includes(found) ? (found as MatchInput) : 'legacy-v0';
  } catch {
    return 'legacy-v0';
  }
}

/** 이 파일이 넣지 않기로 한 키가 원본에 있는지 볼 때 쓴다 */
export type WithheldChartKey = Exclude<keyof ChartEvidence, keyof SharedChartEvidence>;
