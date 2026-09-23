import { expect, test } from '@playwright/test';

import { watchCsp } from './csp';

/**
 * 보안 헤더 (G-23 ②) — 강제하는 셋이 서고, 보고만 하는 CSP 를 어긴 자리가 없다.
 *
 * 로그인 뒤 화면은 `session.ts` 의 자동 손잡이가 모든 시험에서 같은 것을 잰다.
 */
const PAGES = ['/', '/saju', '/compat', '/privacy'];

test('강제하는 헤더가 모든 응답에 선다', async ({ request }) => {
  for (const path of PAGES) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['content-security-policy'], path).toBe("frame-ancestors 'none'");
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['permissions-policy'], path).toContain('camera=()');
    expect(headers['referrer-policy'], path).toBe('no-referrer');
    expect(headers['content-security-policy-report-only'], path).toContain("object-src 'none'");
  }
});

test('로그인 전 화면은 보고만 하는 CSP 를 어기지 않는다', async ({ context, page }) => {
  const seen: string[] = [];
  await watchCsp(context, seen);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(seen).toEqual([]);
});
