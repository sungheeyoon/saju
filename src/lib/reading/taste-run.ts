import { CHART_ENGINE_VERSION } from '../saju/version';
import type { RedactedChartEvidence, RedactedEvidence } from '../saju/evidence/redacted';
import { without } from '../saju/evidence/without';

import { plainTermsIn, type CheckFinding } from './check';

/**
 * **개인별 맛보기(tasteRun)** — 근거 줄이기 · 지문 · 프롬프트 · 출력 모양 · 규칙 검사.
 *
 * ADR 0131 의 720칸 공용 표(`taste-maker.ts`)를 대신하는 설계다(ADR 0143). 실호출 짝 견본으로 재 보려고 섰고
 * (`docs/notes/2026-10-03-taste-run-experiment.md`), 이제 로그인 전 첫 화면의 서버(`app/taste-run.ts`)가 이것으로 근거를
 * 줄이고 · 지문을 짓고 · 프롬프트를 짓고 · 결과를 검사한다. 여기는 모델도 DB 도 모른다.
 *
 * ## 무엇을 더 자르나 — 해 · 나이 · 날짜
 *
 * 자기 풀이 근거(`RedactedEvidence`)는 원문 · 출생지 · 분 단위를 이미 잘랐다(ADR 0008). 그래도 1992-05-14 09:30 견본의
 * 근거에는 **해 숫자 1992(`pillars.meta.sajuYear`) · 나이 34(`now.age`) · 절기 날짜 다섯(`pillars.meta.monthTerm.date` ·
 * `nextTerm.date` · `analysis.johu.midTerm.date` · `daeun.boundaryTerm.date` · `now.*Term.date`)** 이 남아 있었다(2026-10-03
 * 에 견본 근거를 전부 훑어 잼). 맛보기는 로그인 전에 도는 글이라 지금 도는 때(대운 · 세운 · 월운)를 말할 자리가 아니고,
 * 이 값들은 여덟 글자보다 출생일을 더 좁힌다. 그래서 `now` · `daeun` 은 통째로, 나머지는 그 칸만 뺀다.
 */

// ---------------------------------------------------------------------------
// 판과 부르는 설정 — 한 곳
// ---------------------------------------------------------------------------

/**
 * 맛보기의 **판 이름 둘** — 프롬프트 판과 모델 설정 판(ADR 0143). DB 의 artifact 는 (근거 지문, 이 둘)마다 한 행이라
 * 둘 중 하나라도 바뀌면 재사용이 갈린다 — 같은 입력이라도 새 판으로 다시 쓴다. 그래서 프롬프트 · 출력 모양 · 검사가 뜻을
 * 바꾸면 `prompt` 를, 모델 · 추론 세기 · 상한이 바뀌면 `modelConfig` 를 올린다. 꼴은 DB 가 본다(`^[A-Za-z0-9._:-]{1,64}$`).
 */
export const TASTE_RUN_VERSIONS = { prompt: 'taste-run-v1', modelConfig: 'luna-none-1500-20s' } as const;

/**
 * 맛보기를 부르는 설정 — 운영자 승인(2026-10-03, ADR 0143 의 1). 모델 이름은 풀이와 같은 `GENERATION.model` 이고
 * (`app/me/reading/generation.ts`), 여기 값이 바뀌면 `TASTE_RUN_VERSIONS.modelConfig` 도 함께 올린다.
 */
export const TASTE_RUN_CALL = { reasoningEffort: 'none', maxOutputTokens: 1_500, timeoutMs: 20_000 } as const;

/**
 * 검사(`checkTasteRun`)의 **막는 코드**에 걸린 맛보기를 DB 에 적는 실패 코드 — 다음 요청이 재시도한다(상한은 DB 가 센다). 품질
 * 코드만 걸린 글은 실패가 아니다 — 그대로 적고 화면에 세운다(ADR 0163). 걸린 코드 전부는 `note_taste_checks` 가 든다.
 */
export const TASTE_CHECK_FAILED = 'taste-check-failed';

// ---------------------------------------------------------------------------
// 근거 줄이기
// ---------------------------------------------------------------------------

/** 맛보기 근거에서 더 빼는 자리 — 이름과 **왜 뺐는지**(`REDACTED_PATHS` 와 같은 규율) */
export const TASTE_DROPPED_PATHS = {
  viewedAt: '부른 시각 — 지금 도는 때를 짚는 기준이라 맛보기에는 쓰지 않는다',
  now: '지금 도는 대운 · 세운 · 월운과 나이 · 해 — 로그인 전 글은 때를 말하지 않는다',
  daeun: '대운의 방향 · 대운수 · 경계 절기의 날짜 — 나이와 출생일을 좁힌다',
  'claims.now': '빠진 자리의 상한',
  'claims.daeun': '빠진 자리의 상한',
  'pillars.meta.sajuYear': '해 숫자 — 60년 주기 안의 자리를 하나로 정한다',
  'pillars.meta.monthTerm.date': '절입 날짜 — 해와 날짜를 그대로 든다',
  'pillars.meta.nextTerm.date': '다음 절입 날짜 — 같은 까닭',
  'analysis.johu.midTerm.date': '중기 날짜 — 같은 까닭',
} as const;

type ChartClaims = RedactedChartEvidence['claims'];
type PillarsMeta = RedactedChartEvidence['pillars']['meta'];
type Term = PillarsMeta['monthTerm'];
type Johu = RedactedChartEvidence['analysis']['johu'];

/** 날짜를 뺀 절기 — 이름 · 황경 · 지지만 남는다 */
type TasteTerm = Omit<Term, 'date'>;

export type TasteChart = Omit<RedactedChartEvidence, 'now' | 'daeun' | 'claims' | 'pillars' | 'analysis'> & {
  claims: Omit<ChartClaims, 'now' | 'daeun'>;
  pillars: Omit<RedactedChartEvidence['pillars'], 'meta'> & {
    meta: Omit<PillarsMeta, 'sajuYear' | 'monthTerm' | 'nextTerm'> & { monthTerm: TasteTerm; nextTerm: TasteTerm };
  };
  analysis: Omit<RedactedChartEvidence['analysis'], 'johu'> & {
    johu: Omit<Johu, 'midTerm'> & { midTerm: Omit<NonNullable<Johu['midTerm']>, 'date'> | null };
  };
};

/**
 * 맛보기 모델이 받는 자료 — **한 사람, 때 없음.**
 *
 * 경로는 `chart` 아래에서 센다 — 모델이 `supportingClaims` 에 적는 `analysis.structure` 가 곧 `chart.analysis.structure` 다.
 */
export type TasteEvidence = {
  contract: RedactedEvidence['contract'] & { tasteDropped: typeof TASTE_DROPPED_PATHS };
  chart: TasteChart;
  limitations: RedactedEvidence['limitations'];
};

const termWithoutDate = (term: Term): TasteTerm => without(term, 'date');

/**
 * 자기 풀이 근거에서 맛보기 근거를 짓는다 — **받는 것이 redacted 근거다.** 입력에서 다시 만들지 않는다(ADR 0008 과 같은
 * 까닭: 두 자리에서 만들면 두 근거가 갈린다).
 *
 * @throws {Error} 두 사람짜리 근거를 받았을 때 — 맛보기는 한 사람의 것이다.
 */
export function tasteEvidenceOf(evidence: RedactedEvidence): TasteEvidence {
  if (evidence.charts.b !== null) throw new Error('맛보기 근거는 한 사람의 근거로만 짓는다');
  const chart = evidence.charts.a;
  const meta = chart.pillars.meta;
  const johu = chart.analysis.johu;

  return {
    contract: { ...evidence.contract, tasteDropped: TASTE_DROPPED_PATHS },
    chart: {
      ...without(chart, 'now', 'daeun', 'claims', 'pillars', 'analysis'),
      claims: without(chart.claims, 'now', 'daeun'),
      pillars: {
        ...without(chart.pillars, 'meta'),
        meta: {
          ...without(meta, 'sajuYear', 'monthTerm', 'nextTerm'),
          monthTerm: termWithoutDate(meta.monthTerm),
          nextTerm: termWithoutDate(meta.nextTerm),
        },
      },
      analysis: {
        ...without(chart.analysis, 'johu'),
        johu: { ...without(johu, 'midTerm'), midTerm: johu.midTerm === null ? null : without(johu.midTerm, 'date') },
      },
    },
    limitations: evidence.limitations,
  };
}

// ---------------------------------------------------------------------------
// 지문
// ---------------------------------------------------------------------------

/**
 * 근거 지문의 원문 — **여덟 글자 · 성별 · 시간 앎 · 엔진 판.** 맛보기 근거가 이 넷에서만 나오므로 넷이 같으면 같은 글을
 * 다시 써도 된다(같은 브라우저 · 같은 지문은 재사용, 노트 「비용 · 남용」).
 *
 * 시간을 모르면 시주 자리를 `-` 로 둔다 — 「시간 모름」과 「어느 시주」가 한 값으로 접히지 않게. 원문은 해시 전의 값이라
 * 어디에도 저장하지 않는다. **해시도 대입으로 풀린다**(경우의 수가 60⁴ × 2 × 2 남짓) — 지문은 비밀이 아니라 열쇠다.
 */
export function tasteFingerprintSourceOf(evidence: TasteEvidence): string {
  const { pillars, meta } = evidence.chart;
  const eight = [pillars.year, pillars.month, pillars.day, pillars.hour].map((pillar) => pillar?.name ?? '-').join('');
  return ['taste-fingerprint-v1', CHART_ENGINE_VERSION, eight, meta.gender, meta.hourKnown ? 'hour' : 'no-hour'].join('|');
}

/**
 * 근거 지문 — SHA-256 의 16진 64자. Web Crypto(`globalThis.crypto.subtle`)로 잰다 — 도메인 lib 은 `node:` 모듈을 모른다
 * (`scripts/layers.test.ts`). Node 와 브라우저가 같은 값을 낸다.
 */
export async function tasteFingerprintOf(evidence: TasteEvidence): Promise<string> {
  const bytes = new TextEncoder().encode(tasteFingerprintSourceOf(evidence));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// 출력 모양과 프롬프트
// ---------------------------------------------------------------------------

/**
 * 맛보기의 꼴 — **근거에 가장 맞는 하나를 모델이 고른다.** 1차(2026-10-03)는 모든 사주를 「장점 → 그 장점이 만드는 문제 →
 * 해결 직전」 한 꼴로 쓰게 했고, 여섯 명식이 거의 다 「잘하지만 혼자 버티다 지친다 → 나눠라」로 모였다. 한 꼴이 이야기를
 * 정한 것이다. 그래서 꼴을 여럿 두고 고르게 한다. 「압박 · 책임 · 혼자 버팀」은 그것이 정말 가장 두드러진 사주에서만 쓴다.
 */
export const TASTE_TOPICS = [
  '겉과 속의 차이',
  '결정하거나 행동하는 방식',
  '관계에서 반복되는 장면',
  '일이나 돈을 다루는 방식',
  '힘이 살아나는 조건',
  '힘이 빠지는 조건',
  '서로 반대되는 두 성향',
  '잘못 알려진 자신의 강점',
] as const;

export type TasteTopic = (typeof TASTE_TOPICS)[number];

/**
 * 맛보기 모델이 내는 것 — 구조화 출력이 **속성 차례대로** 짓는다.
 *
 * 차례가 곧 생각의 차례다: 이 사주에서 남과 다른 것을 고르고(`topic` · `distinctivePattern`) → 근거를 정하고
 * (`supportingClaims`) → 궁금증과 답의 방향을 정한 뒤(`continuationQuestion` · `answerDirection`) → **글은 마지막에**
 * 쓴다(`previewMarkdown`). 1차는 글을 먼저 쓰고 근거를 뒤에 끼워 맞췄다 — 근거 경로가 틀린 실패 넷이 그 증상이었다.
 */
export type TasteRunOutput = {
  topic: TasteTopic;
  distinctivePattern: string;
  supportingClaims: string[];
  continuationQuestion: string;
  answerDirection: string;
  previewMarkdown: string;
};

/**
 * 시키는 값과 막는 값을 가른다(`docs/notes/verification-discipline.md`, 2026-09-07 — 지시에 없는 상한이 글을 통째로
 * 떨어뜨렸다). 프롬프트가 `target` 을 읽어 꽂고, 검사는 `min` · `max` 만 막는다. 운영자가 정한 계약은 300~500자 ·
 * 2~4문단이다. 막는 값 250 · 600 은 **재지 않은 첫 값**이다 — 운영자의 손 견본이 280자라 300 으로 막으면 그 견본이 떨어진다.
 */
export const TASTE_RUN_RULES = {
  previewLength: { target: { min: 300, max: 500 }, min: 250, max: 600 },
  paragraphs: { min: 2, max: 4 },
  supportingClaims: { min: 1, max: 6 },
} as const;

/** 근거 경로를 한 층 더 내려가 세는 칸 — 나머지 칸은 그 이름 하나가 경로다 */
const CLAIM_BRANCHES = ['analysis', 'pillars', 'sinsal'] as const;
/** 경로로 고르게 하지 않는 칸 — 상한 표(`claims`)와 성별 · 시간 앎 같은 겉값(`meta`, `pillars.meta`) */
const CLAIM_SKIPPED = new Set(['claims', 'meta', 'pillars.meta']);

/**
 * 이 근거에서 **고를 수 있는 근거 경로 전부** — 구조화 출력의 `enum` 이 된다. 경로는 `chart` 아래에서 센다.
 *
 * 프롬프트에 목록을 보이는 것으로는 모자랐다(1차: `chart.analysis.…` · 없는 `analysis.relations`). 그래서 스키마가 막는다.
 * 값이 `null` 인 칸(시간 모름의 `pillars.hour`)은 없는 것과 같다 — 고르게 두지 않는다.
 */
export function tasteClaimPathsOf(evidence: TasteEvidence): string[] {
  const chart: Record<string, unknown> = { ...evidence.chart };
  return Object.keys(chart).flatMap((key) => {
    if (CLAIM_SKIPPED.has(key) || chart[key] === null) return [];
    const value = chart[key];
    if (!(CLAIM_BRANCHES as readonly string[]).includes(key) || value === null || typeof value !== 'object') return [key];
    const inner = value as Record<string, unknown>;
    return Object.keys(inner)
      .map((child) => `${key}.${child}`)
      .filter((path) => !CLAIM_SKIPPED.has(path) && inner[path.slice(key.length + 1)] !== null);
  });
}

/**
 * 구조화 출력의 모양 — JSON Schema 의 날값이다. 도메인 lib 은 모델 SDK 를 모르므로 타입은 부르는 자리(`model.ts`)가 입힌다.
 * 통째로 `as const` 로 굳히지 않는다 — `required` 가 읽기 전용이 되면 SDK 의 스키마 타입이 안 받는다.
 *
 * `supportingClaims` 의 `enum` 이 사람마다 달라서(시간 모름이면 `pillars.hour` 가 없다) 근거를 받아 짓는다.
 */
export const tasteRunShapeOf = (evidence: TasteEvidence) => ({
  type: 'object' as const,
  properties: {
    topic: {
      type: 'string' as const,
      enum: [...TASTE_TOPICS],
      description: '이 사주의 근거에 가장 맞는 맛보기의 꼴 하나',
    },
    distinctivePattern: {
      type: 'string' as const,
      description: '이 사주가 다른 사주와 갈리는 점 한두 문장 — 근거의 값으로 말한다. 사용자에게는 보이지 않는다',
    },
    supportingClaims: {
      type: 'array' as const,
      items: { type: 'string' as const, enum: tasteClaimPathsOf(evidence) },
      description: '주제 · 물음 · 답의 방향이 기대는 근거 경로',
    },
    continuationQuestion: {
      type: 'string' as const,
      description: '맛보기가 멈춘 자리의 물음 — 가입 뒤 전체 풀이가 맨 먼저 답할 것',
    },
    answerDirection: {
      type: 'string' as const,
      description: '그 물음에 대한 답의 방향 한 줄 — 사용자에게는 보이지 않는다',
    },
    previewMarkdown: {
      type: 'string' as const,
      description: '로그인 전에 보여 줄 짧은 글. 위에서 정한 것으로 마지막에 쓴다. 해요체 문단 2~4개, 완결된 문장으로 멈춘다',
    },
  },
  required: ['topic', 'distinctivePattern', 'supportingClaims', 'continuationQuestion', 'answerDirection', 'previewMarkdown'],
  additionalProperties: false,
});

const TASTE_RUN_PROMPT_HEAD = `# 역할

너는 사주를 처음 보는 한 사람에게 **그 사람의 사주에서만 나오는 이야기 하나**를 건네는 사람이다. 긴 풀이가 아니라,
읽고 나서 「이건 남이 아니라 내 얘기다」 싶고 다음이 궁금해지는 짧은 글이다. 이 사람은 아직 가입하지 않았고, 이 글 뒤에
[더보기]가 선다. 가입하면 전체 풀이가 **네가 멈춘 그 물음에 맨 먼저 답한다.**

## 생각하는 차례 — 낼 칸의 차례가 이것이다

1. **이 사주에서 남과 갈리는 것을 고른다.** 자료를 보고 이 명식에서 가장 두드러지는 값(가장 많은 오행 · 없는 오행 ·
   눈에 띄는 합 · 충 · 형 · 뿌리의 모양 · 계절과 일간의 관계 · 판정이 갈리는 자리 등)을 찾는다. 많은 사람에게 그대로
   맞는 이야기(「잘하지만 혼자 다 떠안는다」 · 「책임감이 강하다」)는 고르지 않는다. 그것을 \`distinctivePattern\` 에 적는다.
2. **꼴을 고른다**(\`topic\`). 아래 여덟 중 그 근거에 가장 맞는 것 하나다. 늘 같은 꼴을 고르지 않는다 — 근거가 가리키는
   것을 고른다. **「압박 · 책임 · 혼자 버팀」 이야기는 그것이 이 사주에서 정말 가장 두드러질 때만** 쓴다.
${TASTE_TOPICS.map((topic) => `   - ${topic}`).join('\n')}
3. **근거를 정한다**(\`supportingClaims\`). 고를 수 있는 경로는 스키마가 준다.
4. **궁금증과 답의 방향을 정한다**(\`continuationQuestion\` · \`answerDirection\`). 답의 방향은 자료에서 실제로 나오는 것이어야 한다.
5. **글은 마지막에 쓴다**(\`previewMarkdown\`). 위에서 정한 것만으로 쓴다.

## 글을 쓰는 법

- 핵심 주제 하나. 그 사람이 「맞아, 나 이래」 할 **구체적인 장면**으로 시작한다. 정해진 순서(장점 → 문제 → 해결 직전)를
  따르지 않아도 된다 — 고른 꼴이 글의 모양을 정한다.
- **끝은 지금 말한 장면 안의 물음 한 문장으로 멈춘다** — \`continuationQuestion\` 과 **같은 궁금증**을 그 장면의 말로 묻고
  「~까요?」로 끝낸다. 답은 가입 뒤 전체 풀이의 첫 문단이다. 문장 중간에서 끊거나 말줄임으로 끝내지 않는다.
- **다음을 예고하지 않는다.** 「다음 이야기의 핵심이 됩니다」 · 「다음 풀이에서 이어집니다」 · 「따로 살펴볼 필요가 있어요」 ·
  「물음으로 남아요」 · 「가입하면 알려 드릴게요」처럼 글 바깥(다음 글 · 풀이 · 가입)을 가리키는 말을 쓰지 않는다.
- 자료의 \`claims\` 가 말하는 세기보다 세게 말하지 않는다. 후보 · 참고인 값은 「~쪽으로 읽혀요」처럼 쓰고, 자료에 없는
  단정(「하나뿐」 · 「반드시」 · 「아껴 써야」)을 만들지 않는다.
- 해요체. 사주 분류명(십성 이름 · 신강 · 신약 · 용신 · 격국 · 신살 이름 · 운 이름 같은 말)과 한자는 쓰지 않는다 —
  하는 일로 풀어 쓴다. **강약 판정을 쉬운 말로 옮긴 표현(「약한 쪽에 서 있어도」 · 「힘이 센 사주라」)도 쓰지 않는다.**
  제목 · 목록 · 굵은 글씨 없이 문단만 쓴다.
- 나이 · 해 · 지금 도는 때는 자료에 없다. 지어내지 않는다.

## 낼 것

- \`previewMarkdown\` — ${TASTE_RUN_RULES.previewLength.target.min}~${TASTE_RUN_RULES.previewLength.target.max}자, 문단 ${TASTE_RUN_RULES.paragraphs.min}~${TASTE_RUN_RULES.paragraphs.max}개(빈 줄로 가른다).
- \`supportingClaims\` — ${TASTE_RUN_RULES.supportingClaims.min}~${TASTE_RUN_RULES.supportingClaims.max}개.
- 나머지 칸은 한두 문장.`;

/** 맛보기 프롬프트 — 정적인 지시를 앞에, 사람마다 다른 자료를 맨 뒤에 둔다(캐시가 앞부분을 잇는다) */
export function tasteRunPromptOf(evidence: TasteEvidence): string {
  return `${TASTE_RUN_PROMPT_HEAD}

## 자료 (${evidence.contract.version}, 맛보기 컷)

\`\`\`json
${JSON.stringify(evidence)}
\`\`\``;
}

// ---------------------------------------------------------------------------
// 규칙 검사
// ---------------------------------------------------------------------------

/**
 * 맛보기 검사 코드 — 막는 넷은 **DB 가 받지 못하는 꼴**이다(`finish_taste` 의 성공 검사 · `taste_artifact` 의 검사식과 같은 수).
 * 나머지는 품질이라 걸려도 글을 적고 화면에 세운다(ADR 0163).
 */
export type TasteCheckCode =
  /** `previewMarkdown` 이 비었다 — 막는다 */
  | 'preview-empty'
  /** 이어쓰기가 읽는 칸(`topic` · `distinctivePattern` · `continuationQuestion` · `answerDirection`)이 비었다 — 막는다 */
  | 'field-empty'
  /** 칸이 DB 가 받는 길이를 넘었다(`TASTE_STORE_LIMITS`) — 막는다 */
  | 'field-too-long'
  /** 근거 경로가 1~6개가 아니거나 경로 꼴이 아니다 — 막는다 */
  | 'claims-unstorable'
  | 'unknown-topic'
  | 'claims-not-in-evidence'
  | 'length-out-of-contract'
  | 'paragraphs-out-of-contract'
  | 'unfinished-sentence'
  | 'no-closing-question'
  | 'foreshadowing'
  | 'not-polite'
  | 'ai-word'
  | 'markup'
  | 'hanja'
  | 'plain-term';

/** 막는 코드 — 이 밖은 걸려도 글을 적는다(ADR 0163 의 갈래 표) */
export const TASTE_BLOCKING_CODES: ReadonlySet<TasteCheckCode> = new Set<TasteCheckCode>([
  'preview-empty',
  'field-empty',
  'field-too-long',
  'claims-unstorable',
]);

/** DB 가 받는 칸의 길이 — `taste_artifact` · `taste_session` 의 검사식과 `finish_taste` 의 성공 검사가 같은 수를 든다 */
export const TASTE_STORE_LIMITS = {
  previewMarkdown: 2_000,
  topic: 100,
  distinctivePattern: 1_000,
  continuationQuestion: 500,
  answerDirection: 1_000,
} as const;

export type TasteCheckFinding = CheckFinding<TasteCheckCode>;

/**
 * 글이 지켜야 할 모양 — 짧은 규칙만. 글의 질 · 「내 얘기인가」는 사람의 짝 검토가 본다. `reasons` 는 사람이 읽는 설명(실호출
 * 보고 · 시험), `findings` 는 그 설명에 코드를 단 것이다 — 걸린 것이 없으면 `ok` 다.
 */
export type TasteRunVerdict =
  | { ok: true }
  | { ok: false; reasons: readonly string[]; findings: readonly TasteCheckFinding[] };

/** 걸린 것 가운데 막는 것 — 하나라도 있으면 성공으로 적지 않는다 */
export const tasteBlockingOf = (findings: readonly TasteCheckFinding[]): TasteCheckFinding[] =>
  findings.filter((finding) => TASTE_BLOCKING_CODES.has(finding.code));

const HANJA = /[一-鿿]/;
/** 화면에 「AI」를 새로 세우지 않는다(운영자 2026-09-29) — 글 안에서도 */
const AI_WORD = /\bAI\b|인공지능/;
const MARKUP = /(^|\n)\s*(#|[-*] |\d+\. )|\*\*|__|`/;
/**
 * 글 바깥을 가리키는 예고 — 2차 실호출(2026-10-03)에서 끝 문장 셋이 이렇게 미끄러졌고 셋 다 합니다체였다
 * (「…핵심이 됩니다」 · 「…가장 먼저 이어집니다」 · 「따로 살펴볼 필요가 있어요」). 끝 문단에서만 본다.
 */
const FORESHADOWING = /다음 (이야기|풀이|글|내용|절)|이어집니다|이어져요|따로 (살펴|읽|봐|볼)|(물음|질문)으로 남|가입/;

/** 말줄임 — 문장 중간에서 끊은 자리 */
const TRAILING_OFF = /(…|\.\.\.?|‥)\s*$/;

/** 문장으로 가른다 — 마침표 · 물음표 · 느낌표 뒤의 빈칸에서 */
export const sentencesOf = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '');

/**
 * 해요체로 끝나는 문장인가 — 닫는 따옴표 · 괄호는 넘기고 본다(「…이에요.」).
 */
export const endsPolitely = (sentence: string): boolean => /요[.!?][」』"')\]]*$/.test(sentence.trim());

/** 분류명 · 한자 — 맛보기와 이어쓰기 답이 함께 쓰는 줄 */
const plainTextFindings = (text: string): TasteCheckFinding[] => {
  const findings: TasteCheckFinding[] = [];
  if (HANJA.test(text)) findings.push({ code: 'hanja', detail: '한자가 있다' });
  const terms = plainTermsIn(text);
  if (terms.length > 0) findings.push({ code: 'plain-term', detail: `분류명이 있다: ${terms.join(' · ')}` });
  return findings;
};

/** 분류명 · 한자를 사람이 읽는 설명으로 — 이어쓰기 답의 검사가 쓴다 */
export const plainTextSlips = (text: string): string[] => plainTextFindings(text).map((finding) => finding.detail);

/** 경로가 맛보기 근거의 `chart` 아래에 실제로 있는가 — 빠진 자리(`now` · `daeun`)를 가리키면 없다 */
const pathExists = (chart: TasteChart, path: string): boolean => {
  let at: unknown = chart;
  for (const key of path.split('.')) {
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, key)) return false;
    at = (at as Record<string, unknown>)[key];
  }
  return true;
};

/**
 * 경로 앞의 `chart.` 만 뗀다 — 근거가 `chart` 아래에서 세는 것을 모델이 한 칸 위에서 센 것이라 뜻이 같다. **그 밖은
 * 고치지 않는다** — 없는 경로(`analysis.relations`)를 가까운 경로로 고쳐 주면 근거 없는 글이 근거 있는 척 지난다.
 */
export const normalizeClaim = (claim: string): string => claim.trim().replace(/^chart\./, '');

const SEGMENT = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/;

/**
 * 맛보기 출력의 짧은 규칙 검사 — 걸린 것을 전부 모아 낸다. 막는 것과 품질을 함께 내고, 무엇을 막는지는 `tasteBlockingOf` 가
 * 가른다. 설명에는 모델이 쓴 글을 싣지 않는다 — 길이 · 개수 · 우리 표의 낱말 · 경로 꼴의 값까지만.
 *
 * `evidence` 를 주면 `supportingClaims` 의 경로가 그 근거에 실제로 있는지까지 본다.
 */
export function checkTasteRun(output: TasteRunOutput, evidence?: TasteEvidence): TasteRunVerdict {
  const findings: TasteCheckFinding[] = [];
  const found = (code: TasteCheckCode, detail: string) => findings.push({ code, detail });
  const preview = output.previewMarkdown.trim();

  if (preview === '') found('preview-empty', 'previewMarkdown 이 비었다');
  if (output.topic.trim() === '') found('field-empty', 'topic 이 비었다');
  else if (!(TASTE_TOPICS as readonly string[]).includes(output.topic)) found('unknown-topic', `모르는 topic(${output.topic.length}자)`);
  if (output.distinctivePattern.trim() === '') found('field-empty', 'distinctivePattern 이 비었다');
  if (output.continuationQuestion.trim() === '') found('field-empty', 'continuationQuestion 이 비었다');
  if (output.answerDirection.trim() === '') found('field-empty', 'answerDirection 이 비었다');
  for (const [field, limit] of Object.entries(TASTE_STORE_LIMITS) as [keyof typeof TASTE_STORE_LIMITS, number][]) {
    const length = output[field].trim().length;
    if (length > limit) found('field-too-long', `${field} 이 ${length}자다(${limit} 이하)`);
  }
  const claims = output.supportingClaims.map(normalizeClaim).filter((claim) => claim !== '');
  if (claims.length < TASTE_RUN_RULES.supportingClaims.min || claims.length > TASTE_RUN_RULES.supportingClaims.max) {
    found('claims-unstorable', `supportingClaims 가 ${claims.length}개다`);
  }
  const malformed = claims.filter((claim) => !SEGMENT.test(claim));
  if (malformed.length > 0) found('claims-unstorable', `경로 꼴이 아닌 supportingClaims ${malformed.length}개`);
  if (evidence !== undefined) {
    const allowed = new Set(tasteClaimPathsOf(evidence));
    const missing = claims.filter((claim) => SEGMENT.test(claim) && (!allowed.has(claim) || !pathExists(evidence.chart, claim)));
    if (missing.length > 0) found('claims-not-in-evidence', `근거에 없는 경로: ${missing.join(' · ')}`);
  }

  if (preview !== '') {
    const length = preview.length;
    if (length < TASTE_RUN_RULES.previewLength.min) found('length-out-of-contract', `너무 짧다(${length}자)`);
    if (length > TASTE_RUN_RULES.previewLength.max) found('length-out-of-contract', `너무 길다(${length}자)`);
    const paragraphs = preview.split(/\n\s*\n/).filter((paragraph) => paragraph.trim() !== '');
    if (paragraphs.length < TASTE_RUN_RULES.paragraphs.min || paragraphs.length > TASTE_RUN_RULES.paragraphs.max) {
      found('paragraphs-out-of-contract', `문단이 ${paragraphs.length}개다`);
    }
    if (TRAILING_OFF.test(preview) || !/[.!?][」』"')\]]*$/.test(preview)) found('unfinished-sentence', '완결된 문장으로 끝나지 않는다');
    const last = sentencesOf(preview).at(-1) ?? '';
    if (!/요\?[」』"')\]]*$/.test(last)) found('no-closing-question', '장면 안의 물음(「~요?」)으로 멈추지 않는다');
    const foreshadow = FORESHADOWING.exec(paragraphs.at(-1) ?? '');
    if (foreshadow !== null) found('foreshadowing', `다음을 예고한다: 「${foreshadow[0]}」`);
    if (sentencesOf(preview).some((sentence) => !endsPolitely(sentence))) found('not-polite', '해요체로 끝나지 않는 문장이 있다');
    if (AI_WORD.test(preview)) found('ai-word', '「AI」를 말한다');
    if (MARKUP.test(preview)) found('markup', '제목 · 목록 · 굵은 글씨가 있다');
    findings.push(...plainTextFindings(preview));
  }

  return findings.length === 0 ? { ok: true } : { ok: false, reasons: findings.map((finding) => finding.detail), findings };
}
