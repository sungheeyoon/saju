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
