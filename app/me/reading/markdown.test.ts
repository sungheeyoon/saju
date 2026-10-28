import { describe, expect, it } from 'vitest';

import { markdownBlocks } from './markdown';

const paragraphs = (source: string) =>
  markdownBlocks(source).flatMap((block) => (block.kind === 'paragraph' ? [block] : []));

/**
 * **번호 붙인 항목은 한 항목이 한 문단이다**(2026-10-10 운영 smoke — 이어쓴 첫 절의 1 · 2 가 한 문단으로 붙고 둘만 굵어 보였다).
 *
 * 이 화면은 번호 목록을 따로 세우지 않고 문단으로 그린다. 빈 줄 없이 이어진 줄은 한 문단으로 붙고, 글의 첫 문단은 리드(한 단 크게)다.
 * 그래서 `1. …\n2. …\n\n3. …` 은 「1 2」 한 덩이가 리드로, 3 만 보통 문단으로 섰다.
 */
describe('풀이 원문을 덩이로 나눈다', () => {
  it('빈 줄 없이 이어진 번호 항목도 저마다 문단이다', () => {
    const shown = paragraphs('## 먼저 볼 핵심 세 가지\n1. 하나예요.\n2. 둘이에요.\n\n3. 셋이에요.');
    expect(shown.map((block) => block.text)).toEqual(['1. 하나예요.', '2. 둘이에요.', '3. 셋이에요.']);
  });

  it('번호 항목 셋은 같은 모양이다 — 첫 항목만 리드로 크게 서지 않는다', () => {
    const shown = paragraphs('## 먼저 볼 핵심 세 가지\n\n1. 하나예요.\n\n2. 둘이에요.\n\n3. 셋이에요.');
    expect(shown.map((block) => block.lead)).toEqual([false, false, false]);
  });

  it('번호 항목이 리드 자리를 쓴다 — 아래 절의 첫 문단이 글 한가운데서 리드가 되지 않는다', () => {
    const shown = paragraphs('## 먼저 볼 핵심 세 가지\n\n1. 하나예요.\n\n## 이 사주의 핵심\n\n본문이에요.');
    expect(shown.map((block) => block.lead)).toEqual([false, false]);
  });

  it('번호로 시작하지 않는 글의 첫 문단은 그대로 리드다', () => {
    const shown = paragraphs('## 지금의 핵심\n\n첫 문단이에요.\n이어지는 줄이에요.\n\n둘째 문단이에요.');
    expect(shown).toEqual([
      { kind: 'paragraph', text: '첫 문단이에요. 이어지는 줄이에요.', lead: true },
      { kind: 'paragraph', text: '둘째 문단이에요.', lead: false },
    ]);
  });

  it('번호 항목 안에서 꺾인 줄은 그 항목에 붙는다', () => {
    expect(paragraphs('1. 하나예요.\n이어서 써요.\n2. 둘이에요.').map((block) => block.text)).toEqual([
      '1. 하나예요. 이어서 써요.',
      '2. 둘이에요.',
    ]);
  });
});

/**
 * **글의 모양**(ADR 0208) — 절 요약 줄 · 번호 카드 · 라벨 행. 모양을 어긴 글은 지금처럼 문단 · 목록으로 선다.
 */
describe('글의 모양을 알아본다', () => {
  it('소제목 아래 `>` 한 줄은 절 요약이다', () => {
    expect(markdownBlocks('## 일과 돈\n> 책임이 분명한 자리에서 오래 가요.\n\n본문이에요.').slice(0, 2)).toEqual([
      { kind: 'heading', depth: 2, text: '일과 돈' },
      { kind: 'summary', text: '책임이 분명한 자리에서 오래 가요.' },
    ]);
  });

  it('`1. **제목** — 설명` 은 번호 카드다', () => {
    expect(markdownBlocks('1. **혼자 판단할 때 또렷해요** — 자기 방식으로 밀 때 가장 잘해요.')).toEqual([
      { kind: 'point', number: '1', title: '혼자 판단할 때 또렷해요', text: '자기 방식으로 밀 때 가장 잘해요.' },
    ]);
  });

  it('제목 없는 번호 항목은 지금처럼 번호 문단이다', () => {
    expect(markdownBlocks('1. 하나예요.')).toEqual([{ kind: 'paragraph', text: '1. 하나예요.', lead: false }]);
  });

  it('항목이 모두 `라벨: 내용` 이면 라벨 행이다', () => {
    expect(markdownBlocks('- 신호: 일정이 밀려요.\n- 이렇게: 범위를 다시 정하세요.')).toEqual([
      {
        kind: 'labels',
        rows: [
          { label: '신호', text: '일정이 밀려요.' },
          { label: '이렇게', text: '범위를 다시 정하세요.' },
        ],
      },
    ]);
  });

  it('하나라도 라벨이 아니거나 라벨이 길면 보통 목록이다', () => {
    expect(markdownBlocks('- 신호: 일정이 밀려요.\n- 그냥 문장이에요.')[0].kind).toBe('bullets');
    expect(markdownBlocks('- 아주 긴 라벨이라서요: 문장')[0].kind).toBe('bullets');
  });
});

describe('이어쓰기의 1번', () => {
  it('제목 없는 1번 뒤에 번호 카드가 오면 1번도 제목 없는 카드다', () => {
    const blocks = markdownBlocks('1. 답이에요.\n\n2. **둘** — 둘이에요.\n\n3. **셋** — 셋이에요.');
    expect(blocks[0]).toEqual({ kind: 'point', number: '1', title: '', text: '답이에요.' });
    expect(blocks.map((block) => block.kind)).toEqual(['point', 'point', 'point']);
  });
});
