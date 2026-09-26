import { test as base, type BrowserContext } from '@playwright/test';

import { hydrationFixture } from './hydrated';

/**
 * 콘텐츠 보안 정책을 **어긴 자리**를 모은다 (G-23 ②).
 *
 * CSP 는 강제다(`next.config.ts`) — 어긴 것은 브라우저가 막고 `securitypolicyviolation` 사건을
 * 낸다. 받을 서버를 두지 않았으므로 그 사건을 시험이 듣는다. 시험 하나가 끝날 때 모은 것이
 * 비어 있어야 한다 — 비어 있지 않으면 **그 화면의 무엇인가가 이미 막혀 깨졌다**는 뜻이다.
 * 줄 머리의 `disposition` 이 막았는지(`enforce`) 보고만 했는지(`report`)를 말한다.
 */
export async function watchCsp(context: BrowserContext, sink: string[]): Promise<void> {
  await context.exposeBinding('__cspViolation', (_source, line: string) => {
    sink.push(line);
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { __cspViolation?: (line: string) => void }).__cspViolation;
      report?.(
        `${event.disposition} ${event.effectiveDirective} ← ${event.blockedURI || '(inline)'} @ ${event.documentURI}`,
      );
    });
  });
}

/**
 * 시험 하나가 끝날 때 **어긴 자리가 비어 있어야 한다** — 모든 익명 · 로그인 시험이 이 손잡이를
 * 자동으로 지난다. 로그인 쪽은 `session.ts` 가 이것을 이어받고, 익명 쪽은 `anon.ts` 가 든다.
 */
export const cspFixture = [
  async ({ context }: { context: BrowserContext }, use: (seen: string[]) => Promise<void>) => {
    const seen: string[] = [];
    await watchCsp(context, seen);
    await use(seen);
    if (seen.length > 0) throw new Error(`CSP 를 어긴 자리가 있다:\n${seen.join('\n')}`);
  },
  { auto: true },
] as const;

/**
 * 로그인하지 않은 시험의 `test` — CSP 를 어긴 자리를 자동으로 모으고, 화면을 열면 하이드레이션까지 기다린다
 * (`hydrated.ts`)
 */
export const anonTest = base.extend<{ cspViolations: string[]; hydration: void }>({
  cspViolations: [cspFixture[0], cspFixture[1]],
  hydration: [hydrationFixture[0], hydrationFixture[1]],
});
