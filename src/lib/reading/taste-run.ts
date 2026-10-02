import { CHART_ENGINE_VERSION } from '../saju/version';
import type { RedactedChartEvidence, RedactedEvidence } from '../saju/evidence/redacted';
import { without } from '../saju/evidence/without';

import { plainTermsIn } from './check';

/**
 * **개인별 맛보기(tasteRun)의 실험 자리** — 근거 줄이기 · 지문 · 프롬프트 · 출력 모양 · 규칙 검사.
 *
 * ADR 0131 의 720칸 공용 표(`taste-maker.ts`)를 대신할 설계를 2026-10-03 운영자와 합의했고, 이 파일은 그 설계를
 * **실호출 짝 견본으로 재 보려고** 섰다(`docs/notes/2026-10-03-taste-run-experiment.md`). 운영 경로는 아무도 이것을
 * 안 부른다 — 부르는 자리는 운영자가 손으로 돌리는 `app/me/reading/taste-run.live.test.ts` 하나다. 순서는
 * 「실호출 짝 견본 → 사람의 짝 검토 → ADR(0131 대체)」이고, 이 파일은 그 첫 걸음의 도구다. 여기는 모델도 DB 도 모른다.
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

/** 맛보기 모델이 내는 것 — 구조화 출력이 **속성 차례대로** 짓는다 */
export type TasteRunOutput = {
  previewMarkdown: string;
  continuationQuestion: string;
  answerDirection: string;
  supportingClaims: string[];
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

/**
 * 구조화 출력의 모양 — JSON Schema 의 날값이다. 도메인 lib 은 모델 SDK 를 모르므로 타입은 부르는 자리(`model.ts`)가 입힌다.
 * 통째로 `as const` 로 굳히지 않는다 — `required` 가 읽기 전용이 되면 SDK 의 스키마 타입이 안 받는다.
 */
export const TASTE_RUN_SHAPE = {
  type: 'object' as const,
  properties: {
    previewMarkdown: {
      type: 'string' as const,
      description: '로그인 전에 보여 줄 짧은 글. 해요체 문단 2~4개, 해결책 직전에서 완결된 문장으로 멈춘다',
    },
    continuationQuestion: {
      type: 'string' as const,
      description: '맛보기가 멈춘 자리의 물음 — 가입 뒤 전체 풀이가 맨 먼저 답할 것',
    },
    answerDirection: {
      type: 'string' as const,
      description: '그 물음에 대한 답의 방향 한 줄 — 사용자에게는 보이지 않는다',
    },
    supportingClaims: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '물음과 답의 방향이 기대는 자료 경로(예: analysis.structure)',
    },
  },
  required: ['previewMarkdown', 'continuationQuestion', 'answerDirection', 'supportingClaims'],
  additionalProperties: false,
};

const TASTE_RUN_PROMPT_HEAD = `# 역할

너는 사주를 처음 보는 한 사람에게 **그 사람의 사주에서 가장 먼저 눈에 띄는 이야기 하나**를 건네는 사람이다. 긴 풀이가
아니라, 읽고 나서 「이게 내 얘기다」 싶고 다음이 궁금해지는 짧은 글이다. 이 사람은 아직 가입하지 않았고, 이 글 뒤에
[더보기]가 선다. 가입하면 전체 풀이가 **네가 멈춘 그 물음에 맨 먼저 답한다.**

## 쓰는 법

- **핵심 주제 하나만** 잡는다. 자료에서 서로 다른 근거 둘 이상이 만나 이 사람에게만 맞는 장면이 되는 것을 고른다.
- **장점에서 시작해 그 장점이 만드는 문제로 잇고, 해결책 바로 앞에서 멈춘다.** 해결책은 말하지 않는다 — 그것은
  가입 뒤 전체 풀이의 첫 답이다. 멈추는 자리도 **완결된 문장**이다. 문장 중간에서 끊거나 말줄임으로 끝내지 않는다.
- 자료의 \`claims\` 가 말하는 세기보다 세게 말하지 않는다. 후보 · 참고인 값은 「~쪽으로 읽혀요」처럼 쓰고, 자료에 없는
  단정(「하나뿐」 · 「반드시」 · 「아껴 써야」)을 만들지 않는다.
- 해요체. 사주 분류명(십성 이름 · 신강 · 신약 · 용신 · 격국 · 신살 이름 · 운 이름 같은 말)과 한자는 쓰지 않는다 —
  하는 일로 풀어 쓴다. 제목 · 목록 · 굵은 글씨 없이 문단만 쓴다.
- 나이 · 해 · 지금 도는 때는 자료에 없다. 지어내지 않는다.

- 이렇게 멈추지 마라 — 「그 해결책은 가입하면 알려 드릴게요.」 · 「그 방향은 바로…」
- 이렇게 멈춰라 — 「이 사주 안에는 그 열기를 덜어 낼 방향도 함께 보여요. 그 방향을 알면, 같은 압박을 버티는 대신
  다르게 다룰 수 있어요.」

## 낼 것

- \`previewMarkdown\` — ${TASTE_RUN_RULES.previewLength.target.min}~${TASTE_RUN_RULES.previewLength.target.max}자, 문단 ${TASTE_RUN_RULES.paragraphs.min}~${TASTE_RUN_RULES.paragraphs.max}개(빈 줄로 가른다).
- \`continuationQuestion\` — 이 글이 멈춘 자리의 물음 한 줄. 가입 뒤 전체 풀이가 바로 답할 수 있는 물음이어야 한다.
- \`answerDirection\` — 그 물음의 답이 어느 쪽인지 한 줄. 사용자에게는 안 보이고, 전체 풀이가 이 방향으로 답한다.
  자료에서 실제로 나오는 방향이어야 한다.
- \`supportingClaims\` — 물음과 답의 방향이 기대는 자료 경로 ${TASTE_RUN_RULES.supportingClaims.min}~${TASTE_RUN_RULES.supportingClaims.max}개. \`chart\` 아래에서 센 경로로 적는다(예: \`analysis.structure\` · \`pillars.year.stem\`).`;

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

/** 글이 지켜야 할 모양 — 짧은 규칙만. 글의 질 · 「내 얘기인가」는 사람의 짝 검토가 본다 */
export type TasteRunVerdict = { ok: true } | { ok: false; reasons: readonly string[] };

const HANJA = /[一-鿿]/;
/** 화면에 「AI」를 새로 세우지 않는다(운영자 2026-09-29) — 글 안에서도 */
const AI_WORD = /\bAI\b|인공지능/;
const MARKUP = /(^|\n)\s*(#|[-*] |\d+\. )|\*\*|__|`/;
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
export const plainTextSlips = (text: string): string[] => {
  const reasons: string[] = [];
  if (HANJA.test(text)) reasons.push('한자가 있다');
  const terms = plainTermsIn(text);
  if (terms.length > 0) reasons.push(`분류명이 있다: ${terms.join(' · ')}`);
  return reasons;
};

/** 경로가 맛보기 근거의 `chart` 아래에 실제로 있는가 — 빠진 자리(`now` · `daeun`)를 가리키면 없다 */
const pathExists = (chart: TasteChart, path: string): boolean => {
  let at: unknown = chart;
  for (const key of path.split('.')) {
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, key)) return false;
    at = (at as Record<string, unknown>)[key];
  }
  return true;
};

const SEGMENT = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/;

/**
 * 맛보기 출력의 짧은 규칙 검사 — 걸린 까닭을 전부 모아 낸다.
 *
 * `evidence` 를 주면 `supportingClaims` 의 경로가 그 근거에 실제로 있는지까지 본다.
 */
export function checkTasteRun(output: TasteRunOutput, evidence?: TasteEvidence): TasteRunVerdict {
  const reasons: string[] = [];
  const preview = output.previewMarkdown.trim();

  if (preview === '') reasons.push('previewMarkdown 이 비었다');
  if (output.continuationQuestion.trim() === '') reasons.push('continuationQuestion 이 비었다');
  if (output.answerDirection.trim() === '') reasons.push('answerDirection 이 비었다');
  const claims = output.supportingClaims.map((claim) => claim.trim()).filter((claim) => claim !== '');
  if (claims.length < TASTE_RUN_RULES.supportingClaims.min || claims.length > TASTE_RUN_RULES.supportingClaims.max) {
    reasons.push(`supportingClaims 가 ${claims.length}개다`);
  }
  const malformed = claims.filter((claim) => !SEGMENT.test(claim));
  if (malformed.length > 0) reasons.push(`경로 꼴이 아닌 supportingClaims: ${malformed.join(' · ')}`);
  if (evidence !== undefined) {
    const missing = claims.filter((claim) => SEGMENT.test(claim) && !pathExists(evidence.chart, claim));
    if (missing.length > 0) reasons.push(`근거에 없는 경로: ${missing.join(' · ')}`);
  }

  if (preview === '') return { ok: false, reasons };

  const length = preview.length;
  if (length < TASTE_RUN_RULES.previewLength.min) reasons.push(`너무 짧다(${length}자)`);
  if (length > TASTE_RUN_RULES.previewLength.max) reasons.push(`너무 길다(${length}자)`);
  const paragraphs = preview.split(/\n\s*\n/).filter((paragraph) => paragraph.trim() !== '');
  if (paragraphs.length < TASTE_RUN_RULES.paragraphs.min || paragraphs.length > TASTE_RUN_RULES.paragraphs.max) {
    reasons.push(`문단이 ${paragraphs.length}개다`);
  }
  if (TRAILING_OFF.test(preview) || !/[.!?][」』"')\]]*$/.test(preview)) reasons.push('완결된 문장으로 끝나지 않는다');
  if (sentencesOf(preview).some((sentence) => !endsPolitely(sentence))) reasons.push('해요체로 끝나지 않는 문장이 있다');
  if (AI_WORD.test(preview)) reasons.push('「AI」를 말한다');
  if (MARKUP.test(preview)) reasons.push('제목 · 목록 · 굵은 글씨가 있다');
  reasons.push(...plainTextSlips(preview));

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
