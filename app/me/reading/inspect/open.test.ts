import { describe, expect, it } from 'vitest';

import { inspectOpen } from './open';

describe('검산 화면이 서는 자리', () => {
  it.each([
    ['운영', 'production', false],
    ['미리보기 배포', 'preview', false],
    ['Vercel 의 개발 환경', 'development', true],
    ['로컬(값 없음)', undefined, true],
  ])('%s(%s) — 열리는가 %s', (_, value, open) => {
    expect(inspectOpen(value)).toBe(open);
  });
});
