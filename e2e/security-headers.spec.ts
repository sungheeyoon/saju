import { expect, test } from './anon';

/**
 * 보안 헤더 (G-23 ②) — 강제하는 넷이 서고, CSP 가 정말로 막는다.
 *
 * 어긴 자리는 **모든 시험이** 잰다 — 익명 spec 은 `anon.ts`, 로그인 spec 은 `session.ts` 의 자동
 * 손잡이를 지난다. 여기서는 공개 화면 셋을 한 번씩 더 열고, 일부러 한 번 어겨 막히는 것을 본다.
 */
const PAGES = ['/', '/compat', '/privacy'];

const ENFORCED = [
  "default-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

test('강제하는 헤더가 모든 응답에 선다', async ({ request }) => {
  for (const path of PAGES) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['x-content-type-options'], path).toBe('nosniff');
    expect(headers['permissions-policy'], path).toContain('camera=()');
    expect(headers['referrer-policy'], path).toBe('no-referrer');
    for (const directive of ENFORCED) {
      expect(headers['content-security-policy'], path).toContain(directive);
    }
    // 보고만 하는 정책은 걷었다 — 둘이 서면 어느 쪽이 막는지 헷갈린다
    expect(headers['content-security-policy-report-only'], path).toBeUndefined();
  }
});

test('공개 화면 셋을 열어도 CSP 를 어기지 않는다', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
});

test('CSP 는 바깥 출처를 막고, 손잡이가 막힌 자리를 잡는다', async ({ page, cspViolations }) => {
  await page.goto('/privacy');
  await page.evaluate(() => {
    const image = document.createElement('img');
    image.src = 'https://example.com/csp-probe.png';
    document.body.append(image);
  });
  await expect.poll(() => cspViolations.length).toBeGreaterThan(0);
  expect(cspViolations[0]).toMatch(/^enforce img-src ← https:\/\/example\.com\/csp-probe\.png/);
  // 일부러 어긴 한 줄이다 — 비워야 자동 손잡이가 이 시험을 깨지 않는다
  cspViolations.length = 0;
});
