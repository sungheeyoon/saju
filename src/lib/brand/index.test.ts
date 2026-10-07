import { describe, expect, it } from 'vitest';

import { SERVICE_NAME, SERVICE_NAME_OBJECT, SERVICE_NAME_TOPIC } from '.';

/** 마지막 음절에 받침이 있는가 — `src/lib/saju/text/batchim.ts` 와 같은 셈이다. brand 는 saju 를 부르지 않는다(lib 방향) */
const endsWithBatchim = (word: string) => {
  const last = word.charCodeAt(word.length - 1) - 0xac00;
  return last >= 0 && last <= 11171 && last % 28 !== 0;
};

describe('서비스 이름', () => {
  it('조사가 이름의 받침을 따른다', () => {
    const batchim = endsWithBatchim(SERVICE_NAME);
    expect(SERVICE_NAME_TOPIC).toBe(`${SERVICE_NAME}${batchim ? '은' : '는'}`);
    expect(SERVICE_NAME_OBJECT).toBe(`${SERVICE_NAME}${batchim ? '을' : '를'}`);
  });
});

