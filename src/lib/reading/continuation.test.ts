import { describe, expect, it } from 'vitest';

import { computeSaju } from '../saju';

import { READING_PROMPTS, readingEvidenceOf, readingPromptOf } from '.';
import {
  CONTINUATION_RULES,
  checkContinuation,
  continuationBlockOf,
  continuedMarkdownOf,
  firstSectionItemNumbersOf,
  markdownHeadOf,
  overlapRatio,
} from './continuation';
import { HAND_SAMPLE } from './taste-run-sample';

const { taste, continuationAnswer: ANSWER } = HAND_SAMPLE;
const PREVIEW = taste.previewMarkdown;

/** 이어쓰기 답과 겹치지 않는 첫 절 — 「먼저 볼 핵심 세 가지」 모양만 흉내 낸다 */
const MARKDOWN = `## 먼저 볼 핵심 세 가지

2. 기준이 분명한 만큼 남의 실수에도 엄격해져 관계가 딱딱해지는 순간이 있어요.
3. 일이 몰리는 시기에는 쉬는 시간을 먼저 정해 두는 편이 오래 가요.

## 이 사주의 핵심

여기부터는 본문이에요.`;

const reasonsOf = (input: Partial<Parameters<typeof checkContinuation>[0]>) => {
  const verdict = checkContinuation({ answer: ANSWER, preview: PREVIEW, markdown: MARKDOWN, ...input });
  return verdict.ok ? [] : verdict.reasons;
};

describe('continuationAnswer 기계 검사', () => {
  it('손 견본 짝은 지난다', () => {
    expect(checkContinuation({ answer: ANSWER, preview: PREVIEW, markdown: MARKDOWN })).toEqual({ ok: true });
  });

  it('손 견본의 겹침은 문턱보다 한참 낮다 — 문턱이 견본에 맞춰 선 값이 아니다', () => {
    expect(overlapRatio(ANSWER, PREVIEW)).toBeLessThan(CONTINUATION_RULES.previewOverlap / 5);
  });

  it.each<[string, Partial<Parameters<typeof checkContinuation>[0]>]>([
    ['continuationAnswer 가 없다', { answer: null }],
    ['continuationAnswer 가 없다', { answer: '   ' }],
    ['너무 짧다', { answer: '그 방향은 밖으로 꺼내는 것이에요.' }],
    ['너무 길다', { answer: `${ANSWER} ${ANSWER}` }],
    ['해요체로 끝나지 않는 문장이 있다', { answer: ANSWER.replace('맞아요.', '맞다.') }],
    ['답을 미룬다: 「아래에서」', { answer: `${ANSWER} 어떻게 쓰는지는 아래에서 더 볼게요.` }],
    ['답을 미룬다: 「이어서 풀」', { answer: ANSWER.replace('그 방향은', '그 방향은 이어서 풀어 볼 텐데,') }],
    [
      '맛보기 원문과 겹친다',
      { answer: `${PREVIEW.split('\n\n')[1]} 그래서 생각을 밖으로 꺼내는 편이 맞아요.` },
    ],
    ['markdown 첫머리에 같은 답이 또 있다', { markdown: `## 먼저 볼 핵심 세 가지\n\n1. ${ANSWER}\n\n## 이 사주의 핵심\n\n본문이에요.` }],
    ['분류명이 있다: 식신', { answer: ANSWER.replace('생각과 기준을', '식신의 힘으로 생각과 기준을') }],
    ['한자가 있다', { answer: ANSWER.replace('불의 열기', '丙 불의 열기') }],
  ])('%s — 걸린다', (reason, patch) => {
    expect(reasonsOf(patch).join(' / ')).toContain(reason);
  });

  it('markdown 의 둘째 절 뒤에 같은 말이 있는 것은 첫머리가 아니다', () => {
    expect(checkContinuation({ answer: ANSWER, preview: PREVIEW, markdown: `${MARKDOWN}\n\n${ANSWER}` })).toEqual({ ok: true });
  });
});

describe('겹침의 자', () => {
  it('같은 글은 1, 글자가 하나도 안 겹치면 0, 빈 답은 0', () => {
    expect(overlapRatio(ANSWER, ANSWER)).toBe(1);
    expect(overlapRatio('가나다라마바사', '아자차카타파하')).toBe(0);
    expect(overlapRatio('', PREVIEW)).toBe(0);
  });

  it('빈칸 · 문장부호가 달라도 같은 조각으로 센다', () => {
    expect(overlapRatio('밖으로, 꺼내요.', '밖으로꺼내요')).toBe(1);
  });

  it('첫 절은 둘째 머리 앞까지다 — 머리가 없으면 앞 600자', () => {
    expect(markdownHeadOf(MARKDOWN)).not.toContain('여기부터는 본문');
    expect(markdownHeadOf('가'.repeat(900))).toHaveLength(600);
  });
});

describe('이어쓰기 블록', () => {
  const block = continuationBlockOf(taste);

  it('저장된 원문 · 멈춘 물음 · 답의 방향 · 기대는 자료를 그대로 싣는다', () => {
    for (const paragraph of PREVIEW.split('\n\n')) expect(block).toContain(`> ${paragraph}`);
    expect(block).toContain(taste.continuationQuestion);
    expect(block).toContain(taste.answerDirection);
    for (const claim of taste.supportingClaims) expect(block).toContain(`- \`${claim}\``);
  });

  it('시키는 분량과 되풀이하지 말라는 줄을 말한다 · 맨 앞 칸을 이름으로 부른다', () => {
    expect(block).toContain(`${CONTINUATION_RULES.answerLength.target.min}~${CONTINUATION_RULES.answerLength.target.max}자`);
    expect(block).toContain('**2번과 3번 두 항목만** 쓴다');
    expect(block).toContain('`continuationAnswer` 칸이 하나 더 있고 **맨 앞**이다');
  });

  it('시키는 분량이 막는 분량 안에 있다', () => {
    const { target, min, max } = CONTINUATION_RULES.answerLength;
    expect(target.min).toBeGreaterThanOrEqual(min);
    expect(target.max).toBeLessThanOrEqual(max);
  });

  it('기존 자기 풀이 프롬프트는 이어쓰기를 모른다 — 기본 출력이 그대로다', () => {
    const built = readingEvidenceOf('self', { a: computeSaju(HAND_SAMPLE.input) }, new Date('2026-10-03T03:00:00Z'));
    const prompt = readingPromptOf(built);

    expect(prompt.startsWith(READING_PROMPTS.self.slice(0, 200))).toBe(true);
    expect(prompt).not.toContain('continuationAnswer');
    expect(prompt).not.toContain('이어쓰기');
    /* 붙이는 자리는 맨 뒤 — 앞부분(캐시가 잇는 곳)은 글자째 같다 */
    expect(`${prompt}\n\n${block}`.startsWith(prompt)).toBe(true);
  });
});

describe('첫 절의 1번은 이어쓰기 답이다 — 한 번만 선다', () => {
  it('모델은 2 · 3 만 쓰고 화면이 1번 본문으로 답을 넣는다', () => {
    const shown = continuedMarkdownOf(ANSWER, MARKDOWN);
    expect(firstSectionItemNumbersOf(shown)).toEqual([1, 2, 3]);
    expect(shown).toContain(`1. ${ANSWER}\n2. `);
    expect(shown.split(ANSWER)).toHaveLength(2);
  });

  it('모델이 1번을 쓰거나 셋을 쓰면 걸린다', () => {
    const withOne = MARKDOWN.replace('2. 기준이', '1. 답을 다시 말해요.\n2. 기준이');
    expect(reasonsOf({ markdown: withOne }).join(' / ')).toContain('첫 절 항목 번호가 2 · 3 이 아니다(1 · 2 · 3)');
    expect(reasonsOf({ markdown: '## 먼저 볼 핵심 세 가지\n\n본문만 있어요.' }).join(' / ')).toContain('(없음)');
  });

  it('2번이 없으면 지어내 끼우지 않는다', () => {
    const plain = '## 먼저 볼 핵심 세 가지\n\n본문만 있어요.';
    expect(continuedMarkdownOf(ANSWER, plain)).toBe(plain);
  });
});
