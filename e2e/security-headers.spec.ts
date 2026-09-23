import { expect, test } from './anon';

/**
 * 보안 헤더 (G-23 ②) — 강제하는 셋이 서고, 보고만 하는 CSP 를 어긴 자리가 없다.
 *
 * 어긴 자리는 **모든 시험이** 잰다 — 익명 spec 은 `anon.ts`, 로그인 spec 은 `session.ts` 의 자동
 * 손잡이를 지난다. 여기서는 공개 화면 셋을 한 번씩 더 연다.
 */
const PAGES = ['/', '/compat', '/privacy'];

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

test('공개 화면 셋을 열어도 보고만 하는 CSP 를 어기지 않는다', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
});
