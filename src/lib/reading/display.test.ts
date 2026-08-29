import { describe, expect, it } from 'vitest';

import { readingBody, readingGrounding } from './display';

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

/**
 * **잘라 낸 쪽도 읽을 수 있어야 검수가 된다.**
 *
 * 이 절은 프롬프트가 시켜서 만들어지고 DB 에 저장까지 되는데 어디에도 안 서 있었다.
 * 그러면 「이 문장이 왜 이렇게 나왔나」의 답이 사람의 짐작이 된다.
 */
describe('되짚는 자리가 읽는 근거 절', () => {
  const markdown = `## 한 줄로

지금은 기준을 세울 때입니다.

### 근거 (검사용)

한 줄로 — analysis.strength [유도]`;

  it('본문이 버린 쪽을 그대로 준다', () => {
    expect(readingGrounding(markdown)).toBe(
      '### 근거 (검사용)\n\n한 줄로 — analysis.strength [유도]',
    );
  });

  /** 자르는 자리가 하나여야 한다 — 둘이면 본문에서 뺀 줄이 여기에도 없는 날이 온다 */
  it('본문과 근거를 합치면 잘린 것이 없다', () => {
    const body = readingBody(markdown);
    const grounding = readingGrounding(markdown) ?? '';

    expect(`${body}\n\n${grounding}`).toBe(markdown);
  });

  /** 「모델이 안 썼다」와 「비어 있다」는 다른 사실이고, 안 쓴 것 자체가 검수 대상이다 */
  it('근거 절이 없으면 null 이다', () => {
    expect(readingGrounding('## 한 줄로\n\n본문뿐입니다.')).toBeNull();
    expect(readingGrounding('## 한 줄로\n\n본문\n\n### 근거 (검사용)\n\n   ')).toBeNull();
  });

  it('본문 문장 안의 근거라는 말에 걸리지 않는다', () => {
    expect(readingGrounding('## 한 줄로\n\n이 판단의 근거는 겹침입니다.')).toBeNull();
  });
});
