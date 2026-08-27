import { describe, expect, it } from 'vitest';

import { readingBody } from './display';

describe('사용자가 읽는 사주풀이 본문', () => {
  it('내부 검토용 근거 절을 화면 본문에서 뺀다', () => {
    const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

    expect(readingBody(markdown)).toBe('## 한 줄로\n\n지금은 기준을 세울 때입니다.');
  });

  it('근거 절이 없으면 원문 내용은 그대로 둔다', () => {
    expect(readingBody('  ## 한 줄로\n\n본문  ')).toBe('## 한 줄로\n\n본문');
  });

  it('본문 문장 안의 근거라는 말은 자르지 않는다', () => {
    const markdown = '## 한 줄로\n\n이 판단의 근거는 두 흐름이 겹친다는 점입니다.';

    expect(readingBody(markdown)).toBe(markdown);
  });
});
