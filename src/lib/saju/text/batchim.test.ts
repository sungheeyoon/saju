import { describe, expect, it } from 'vitest';

import { endsWithBatchim } from './batchim';

describe('endsWithBatchim', () => {
  it('마지막 음절의 받침을 본다 — 불·흙·물은 있고 나무·쇠는 없다', () => {
    expect(['불', '흙', '물', '인', '갑신'].map(endsWithBatchim)).toEqual([true, true, true, true, true]);
    expect(['나무', '쇠', '가', '해'].map(endsWithBatchim)).toEqual([false, false, false, false]);
  });

  it('한글 음절 밖의 글자로 끝나면 받침이 없다고 본다', () => {
    expect(['甲', 'A', '1', ''].map(endsWithBatchim)).toEqual([false, false, false, false]);
  });
});
