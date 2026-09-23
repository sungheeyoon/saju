import type { BrowserContext } from '@playwright/test';

/**
 * 콘텐츠 보안 정책을 **어긴 자리**를 모은다 (G-23 ②).
 *
 * CSP 는 아직 `Report-Only` 로 선다 — 브라우저는 막지 않고 `securitypolicyviolation` 사건만
 * 낸다. 받을 서버를 두지 않았으므로 그 사건을 시험이 듣는다. 시험 하나가 끝날 때 모은 것이
 * 비어 있어야 한다 — 비어 있지 않으면 **강제로 바꾸는 날 그 화면이 깨진다**는 뜻이다.
 */
export async function watchCsp(context: BrowserContext, sink: string[]): Promise<void> {
  await context.exposeBinding('__cspViolation', (_source, line: string) => {
    sink.push(line);
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __cspViolation?: (line: string) => void }).__cspViolation;
      report?.(`${event.effectiveDirective} ← ${event.blockedURI || '(inline)'} @ ${event.documentURI}`);
    });
  });
}
