import type { ReadingOutput } from './policy';
import { endsPolitely, plainTextSlips, sentencesOf, type TasteRunOutput } from './taste-run';

/**
 * **가입 뒤 이어쓰기** — 맛보기(tasteRun)를 읽고 가입한 사람의 자기 풀이 프롬프트에 붙는 블록과, 그 답(`continuationAnswer`)의
 * 기계 검사. 실험 자리다(`docs/notes/2026-10-03-taste-run-experiment.md`) — 부르는 자리는 운영자가 손으로 돌리는
 * `app/me/reading/taste-run.live.test.ts` 하나이고, 운영 경로의 프롬프트(`readingPromptOf`)는 이 파일을 모른다.
 *
 * ## 왜 프롬프트 맨 뒤에 붙이나
 *
 * `readingPromptOf` 는 정적인 지시를 앞에, 사람마다 다른 자료를 뒤에 둔다 — 앞부분이 캐시로 이어지게. 이어쓰기는 사람마다
 * 다른 글이므로 자료 **뒤**에 붙인다. 그러면 `readingPromptOf` 의 기본 출력은 한 글자도 안 바뀌고(프롬프트 판 · 캐시 시험이
 * 그대로 초록), 이어쓰기가 없는 사람의 프롬프트는 지금과 같다. 첫 절 「먼저 볼 핵심 세 가지」 지시도 안 바꾼다 — 여기서
 * `markdown` 에 답을 되풀이하지 말라는 줄 하나만 더한다.
 */

/** 이어쓰기가 있을 때의 출력 — `continuationAnswer` 가 **맨 앞 속성**이다(구조화 출력은 속성 차례로 짓는다) */
export type ContinuedReadingOutput = { continuationAnswer: string } & ReadingOutput;

/** 이어쓰기에 싣는 저장된 맛보기 — 표를 다시 읽지 않고 그때 낸 원문을 그대로 싣는다 */
export type TasteRunCarry = Pick<
  TasteRunOutput,
  'previewMarkdown' | 'continuationQuestion' | 'answerDirection' | 'supportingClaims'
>;

/**
 * 시키는 값과 막는 값(`TASTE_RUN_RULES` 와 같은 규율). 막는 값 120~400 은 운영자가 정했고, 시키는 값 150~300 은 그 안에
 * 여유를 둔 첫 값이다. 겹침 문턱 둘은 **재지 않은 첫 값**이다 — 운영자의 손 견본 짝이 0.014(맛보기와)라 넉넉히 지나고,
 * 맛보기 문장을 그대로 옮기면 1 에 가깝다. 실호출 짝 견본으로 다시 잰다.
 */
export const CONTINUATION_RULES = {
  answerLength: { target: { min: 150, max: 300 }, min: 120, max: 400 },
  ngram: 4,
  /** 답의 4글자 조각 가운데 맛보기 원문에도 있는 몫 — 이 이상이면 실패 */
  previewOverlap: 0.25,
  /** 답의 4글자 조각 가운데 `markdown` 첫 절에도 있는 몫 — 이 이상이면 실패 */
  markdownHeadOverlap: 0.25,
} as const;

/** 구조화 출력에 더하는 칸 — JSON Schema 의 날값. 모양을 입히는 것은 `model.ts` 다 */
export const CONTINUATION_ANSWER_PROPERTY = {
  type: 'string',
  description: '맛보기가 멈춘 물음에 바로 답하는 한 문단. 해요체, 미루지 않고 그 자리에서 완결한다',
} as const;

const quoted = (text: string): string =>
  text
    .trim()
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');

/**
 * 자기 풀이 프롬프트 뒤에 붙는 블록. 부르는 쪽은 `${readingPromptOf(evidence)}\n\n${continuationBlockOf(taste)}` 로 잇는다.
 */
export function continuationBlockOf(taste: TasteRunCarry): string {
  const { target } = CONTINUATION_RULES.answerLength;
  return `## 이어쓰기 — 이 사람은 이미 앞 글을 읽었다

이 사람은 가입하기 전에 아래 글을 읽었고, 아래 물음에서 멈춘 채 가입했다. 이 풀이는 그 물음의 답으로 시작한다.

### 이미 읽은 글

${quoted(taste.previewMarkdown)}

### 멈춘 물음

${taste.continuationQuestion.trim()}

### 답의 방향 (사용자에게는 안 보인다)

${taste.answerDirection.trim()}

### 그 방향이 기대는 자료

${taste.supportingClaims.map((claim) => `- \`${claim}\``).join('\n')}

### 이어 쓰는 법

- 구조화 출력에 \`continuationAnswer\` 칸이 하나 더 있고 **맨 앞**이다. 그 칸부터 쓴다.
- \`continuationAnswer\` 는 위 물음에 **첫 문장부터 바로 답하고, 그 칸 안에서 완결한다.** 답을 뒤로 미루지 않는다.
- 이미 읽은 글을 다시 설명하지 않는다. 앞 글과 다른 성격으로 이 사람을 규정하지 않는다 — 앞 글이 세운 사람을 그대로 이어 간다.
- 답의 방향과 그 방향이 기대는 자료에 기대어 답한다. 자료가 말하는 세기보다 세게 말하지 않는다.
- ${target.min}~${target.max}자, 해요체 한 문단. 분류명과 한자는 쓰지 않는다.
- \`markdown\` 에서는 이 답을 되풀이하지 않는다 — 화면이 그 답을 본문 위에 따로 세운다.`;
}

// ---------------------------------------------------------------------------
// continuationAnswer 기계 검사
// ---------------------------------------------------------------------------

export type ContinuationVerdict = { ok: true } | { ok: false; reasons: readonly string[] };

/**
 * 답을 뒤로 미루는 말 — 「아래에서 더」 · 「이어서 풀어 볼게요」. 걸리면 그 칸이 답이 아니라 예고다.
 */
const DEFERRING = /아래에서|아래 절|뒤에서|뒷부분|이어서 풀|이어서 살펴|이어서 보|더 알아보|자세히 풀어|자세히 살펴|다음 절|본문에서/;

/** 낱자 n-gram — 빈칸 · 문장부호를 걷고 센다. 한국어는 낱말 경계가 조사로 흔들려 글자 조각이 덜 흔들린다 */
const gramsOf = (text: string, size: number): Set<string> => {
  const letters = [...text.replace(/[\s\p{P}\p{S}]/gu, '')];
  const grams = new Set<string>();
  for (let at = 0; at + size <= letters.length; at += 1) grams.add(letters.slice(at, at + size).join(''));
  return grams;
};

/**
 * `answer` 의 조각 가운데 `other` 에도 있는 몫(0~1). 답이 비면 0.
 *
 * **보조 검사다.** 글자 조각이 겹치는지만 보므로 말을 바꿔 같은 뜻을 되풀이한 것은 못 잡는다. 「질문에 맞는 답인가」 ·
 * 「한 사람이 쓴 한 글로 이어지는가」는 사람의 짝 검토가 판정한다(노트 「짝 검토의 여섯 질문」).
 */
export function overlapRatio(answer: string, other: string, size: number = CONTINUATION_RULES.ngram): number {
  const mine = gramsOf(answer, size);
  if (mine.size === 0) return 0;
  const theirs = gramsOf(other, size);
  let shared = 0;
  for (const gram of mine) if (theirs.has(gram)) shared += 1;
  return shared / mine.size;
}

/** `markdown` 의 첫 절 — 둘째 `## ` 머리 앞까지. 머리가 둘이 안 되면 앞 600자 */
export const markdownHeadOf = (markdown: string): string => {
  const second = [...markdown.matchAll(/^## /gm)][1];
  return second === undefined ? markdown.slice(0, 600) : markdown.slice(0, second.index);
};

const ratio = (value: number): string => value.toFixed(2);

/**
 * `continuationAnswer` 를 잰다 — 하나라도 걸리면 실패. 걸린 까닭을 전부 모아 낸다.
 */
export function checkContinuation({
  answer,
  preview,
  markdown,
}: {
  answer: string | null | undefined;
  preview: string;
  markdown: string;
}): ContinuationVerdict {
  const text = (answer ?? '').trim();
  if (text === '') return { ok: false, reasons: ['continuationAnswer 가 없다'] };

  const reasons: string[] = [];
  const { min, max } = CONTINUATION_RULES.answerLength;
  if (text.length < min) reasons.push(`너무 짧다(${text.length}자)`);
  if (text.length > max) reasons.push(`너무 길다(${text.length}자)`);
  if (sentencesOf(text).some((sentence) => !endsPolitely(sentence))) reasons.push('해요체로 끝나지 않는 문장이 있다');
  const deferring = DEFERRING.exec(text);
  if (deferring !== null) reasons.push(`답을 미룬다: 「${deferring[0]}」`);

  const fromPreview = overlapRatio(text, preview);
  if (fromPreview >= CONTINUATION_RULES.previewOverlap) reasons.push(`맛보기 원문과 겹친다(${ratio(fromPreview)})`);
  const fromMarkdown = overlapRatio(text, markdownHeadOf(markdown));
  if (fromMarkdown >= CONTINUATION_RULES.markdownHeadOverlap) {
    reasons.push(`markdown 첫머리에 같은 답이 또 있다(${ratio(fromMarkdown)})`);
  }

  reasons.push(...plainTextSlips(text));

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
