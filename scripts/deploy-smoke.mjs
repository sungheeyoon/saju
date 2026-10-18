/**
 * 묶음 배포 뒤 **smoke 다섯 화면**을 로그인 없이 headless 로 본다 — `docs/ops/runbook/deploy.md` 「배포」 4 단계가 부른다(G-115).
 *
 * ```bash
 * npm run smoke:deploy                    # 운영 주소는 docs/ops/runbook/domain.md 맨 위의 그 줄에서 읽는다
 * npm run smoke:deploy -- --url <주소>    # 다른 주소(손으로 만든 Preview 등)
 * ```
 *
 * 배포 에이전트가 배포마다 headless Chromium 스크립트를 새로 써서 판정이 갈릴 틈이 있었다(#759 · #763). 판정은 4 단계 그대로다.
 *
 * - **다섯 모두** — 닿은 응답이 200 이고 · 돈 주소의 호스트에 머물고 · h1 이 그 화면의 제 제목(`SCREENS`)이고 · CSP 위반과
 *   잡히지 않은 예외(`pageerror`)가 없어야 통과다. 200 이 아니면 404 · 오류 경계도 실패다 — 500 만 막던 판정은 `/auth` 라우트가
 *   빠진 배포를 통과시켰다(2026-10-18 검토).
 * - **로그인 없이 서는 둘**(`/` · `/auth`) — 제 주소에 머물고 빈 화면이 아니어야 한다.
 * - **로그인이 드는 셋**(`/compat` · `/me/people` · `/ops/reports`) — 로그인 없이 `/auth?next=<그 주소>` 로 넘어가는지만 본다. 운영
 *   계정의 비밀번호 · 세션은 쓰지 않는다 — 로그인한 화면은 운영자가 본다(ADR 0105).
 *
 * CSP 가 아닌 콘솔 오류는 표에 세어 적기만 하고 판정에 넣지 않는다. CSP 헤더가 응답에 섰는지도 찍기만 한다.
 * 결과는 이슈에 그대로 붙이는 Markdown 표다. 하나라도 실패면 끝 코드 1 이다. Playwright 라 `package.json` 의 명령이
 * `scripts/heavy.mjs` 를 지난다 — `node scripts/deploy-smoke.mjs` 를 바로 부르면 그 잠금을 안 지난다.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 4 단계의 다섯 화면 — `login` 이면 로그인 없이 `/auth?next=` 로 넘어가는지만 본다. `h1` 은 4 단계의 「**제** 제목」이다 — 닿은 화면의
 * h1 이 이 글자여야 한다. `<title>` 은 `app/layout.tsx` 의 기본값이 늘 채우고 404 · 오류 경계에도 h1 이 서므로, 제목이 「있다」로는
 * 라우트가 빠진 배포를 못 가른다(2026-10-18 검토). 글자의 원본은 `app/home-hero.tsx` · `app/auth/page.tsx` 의 `title`
 * (`forCompat` 갈래와 `${SERVICE_NAME} 시작하기`)이고, 어긋나면 `deploy-smoke.test.ts` 가 붉어진다.
 */
export const SCREENS = [
  { name: '홈', path: '/', login: false, h1: '나는 어떤 사람일까?' },
  { name: '로그인', path: '/auth', login: false, h1: '만날지도 시작하기' },
  { name: '궁합', path: '/compat', login: true, h1: '궁합풀이는 로그인하면 볼 수 있어요' },
  { name: '사람 목록', path: '/me/people', login: true, h1: '만날지도 시작하기' },
  { name: '운영자 신고', path: '/ops/reports', login: true, h1: '만날지도 시작하기' },
];

/** 이 길이보다 짧은 본문 글자는 빈 화면으로 친다 — 제목 한 줄만 있어도 넘는다 */
const EMPTY_TEXT = 10;

/**
 * `docs/ops/runbook/domain.md` 의 「운영 주소는 `https://…` 이다」 줄에서 주소를 뽑는다. 못 찾으면 `null`
 *
 * @param {string} text
 * @returns {string | null}
 */
export function productionUrlOf(text) {
  const found = /\*\*운영 주소는 `(https:\/\/[^`\s]+)` 이다\*\*/.exec(text);
  if (!found) return null;
  try {
    return new URL(found[1]).origin;
  } catch {
    return null;
  }
}

/**
 * 명령줄 인자 — `--url <주소>` 하나만 받는다. 꼴이 틀리면 운영을 대신 돌지 않고 `error` 를 낸다(`--url=…` · 값 없는 `--url` ·
 * 모르는 인자 · 경로가 붙은 주소).
 *
 * @param {string[]} args
 * @returns {{ url: string | null } | { error: string }}
 */
export function argsOf(args) {
  if (args.length === 0) return { url: null };
  if (args.length !== 2 || args[0] !== '--url') return { error: `모르는 인자다: ${args.join(' ')} — \`--url <주소>\` 하나만 받는다` };
  let url;
  try {
    url = new URL(args[1]);
  } catch {
    return { error: `--url 의 값이 주소가 아니다: ${args[1]}` };
  }
  if (!/^https?:$/.test(url.protocol)) return { error: `--url 은 http · https 주소다: ${args[1]}` };
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return { error: `--url 은 경로 없는 주소다(예: https://host): ${args[1]}` };
  return { url: url.origin };
}

/**
 * 한 화면의 관찰을 4 단계의 문턱으로 가른다. `base` 는 돈 주소의 origin 이다 — 다른 호스트로 넘어가면 실패다.
 *
 * @param {{ path: string, login: boolean, h1: string }} screen
 * @param {{ status: number | null, finalOrigin: string, finalPath: string, finalNext: string | null, title: string, h1: string,
 *   textLength: number, csp: string[], consoleErrors: string[], pageErrors: string[], error?: string }} seen
 * @param {string} base
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function judge(screen, seen, base) {
  if (seen.error) return { pass: false, reasons: [`열지 못했다 — ${seen.error}`] };
  const reasons = [];
  // 로그인이 드는 셋은 넘어간 /auth 의 응답이다 — 넘김 끝이 404 · 500 이어도 실패다
  if (seen.status === null) reasons.push('응답이 없다');
  else if (seen.status !== 200) reasons.push(`${seen.status}`);
  if (seen.finalOrigin !== base) reasons.push(`다른 호스트로 넘어갔다(${seen.finalOrigin})`);
  if (screen.login) {
    if (seen.finalPath !== '/auth' || seen.finalNext !== screen.path) {
      const at = seen.finalNext === null ? seen.finalPath : `${seen.finalPath}?next=${seen.finalNext}`;
      reasons.push(`/auth?next=${screen.path} 로 넘어가지 않았다(${at})`);
    }
  } else {
    if (seen.finalPath !== screen.path) reasons.push(`다른 주소로 넘어갔다(${seen.finalPath})`);
    if (seen.textLength < EMPTY_TEXT) reasons.push('빈 화면');
  }
  if (seen.h1.trim() !== screen.h1) reasons.push(`제 제목이 아니다(h1 「${seen.h1.trim() || '없음'}」)`);
  if (seen.csp.length > 0) reasons.push(`CSP 위반 ${seen.csp.length}`);
  if (seen.pageErrors.length > 0) reasons.push(`잡히지 않은 예외 ${seen.pageErrors.length}`);
  return { pass: reasons.length === 0, reasons };
}

/** 표의 칸에 들어갈 글자 — `|` 와 줄바꿈이 표를 깨지 않게 */
const cell = (text) => String(text).replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/**
 * 이슈에 붙일 Markdown 표
 *
 * @param {{ screen: { name: string, path: string, login: boolean }, seen: Parameters<typeof judge>[1], verdict: ReturnType<typeof judge> }[]} rows
 * @returns {string}
 */
export function tableOf(rows) {
  const lines = ['| 화면 | 판정 | 응답 · 닿은 주소 | h1 | CSP 위반 · 콘솔 오류 · 예외 |', '| --- | --- | --- | --- | --- |'];
  for (const { screen, seen, verdict } of rows) {
    const what = `${screen.name} \`${screen.path}\``;
    const mark = verdict.pass ? (screen.login ? '통과 — 로그인 앞까지' : '통과') : `실패 — ${verdict.reasons.join(' · ')}`;
    const at = seen.error ? '—' : `${seen.status ?? '—'} \`${seen.finalPath}${seen.finalNext === null ? '' : `?next=${encodeURIComponent(seen.finalNext)}`}\``;
    const counts = seen.error ? '—' : `${seen.csp.length} · ${seen.consoleErrors.length} · ${seen.pageErrors.length}`;
    lines.push(`| ${cell(what)} | ${cell(mark)} | ${cell(at)} | ${cell(seen.h1 || '—')} | ${counts} |`);
  }
  return lines.join('\n');
}

/** CSP 위반이 콘솔에 찍힌 글 — 콘솔 오류 수에서 빼고 CSP 로 센다 */
const CSP_CONSOLE = /Content Security Policy|Content-Security-Policy/i;

/** @param {import('@playwright/test').Browser} browser */
async function look(browser, base, screen) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const cspEvents = [];
  const cspConsole = [];
  const consoleErrors = [];
  const pageErrors = [];
  // 주소가 바뀌어도 이어지게 바인딩으로 받는다 — 문서마다 다시 거는 수신기가 위반을 바깥으로 보낸다
  await context.exposeBinding('__smokeCsp', (_source, text) => cspEvents.push(text));
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      /** @type {any} */ (window).__smokeCsp(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    (CSP_CONSOLE.test(text) ? cspConsole : consoleErrors).push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  // 같은 위반이 사건과 콘솔에 함께 온다 — 사건을 먼저 세고, 사건이 없을 때만 콘솔을 센다
  const cspOf = () => (cspEvents.length > 0 ? cspEvents : cspConsole);
  try {
    const response = await page.goto(`${base}${screen.path}`, { waitUntil: 'load', timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const url = new URL(page.url());
    const seen = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      textLength: (document.body?.innerText ?? '').trim().length,
    }));
    return {
      status: response?.status() ?? null,
      finalOrigin: url.origin,
      finalPath: url.pathname,
      finalNext: url.searchParams.get('next'),
      ...seen,
      csp: cspOf(),
      consoleErrors,
      pageErrors,
      cspHeader: Boolean(response?.headers()['content-security-policy']),
    };
  } catch (error) {
    const empty = { status: null, finalOrigin: '', finalPath: '', finalNext: null, title: '', h1: '', textLength: 0 };
    return { ...empty, csp: cspOf(), consoleErrors, pageErrors, cspHeader: false, error: error instanceof Error ? error.message.split('\n')[0] : String(error) };
  } finally {
    await context.close();
  }
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const args = argsOf(process.argv.slice(2));
  if ('error' in args) {
    console.error(args.error);
    process.exit(1);
  }
  const base = args.url ?? productionUrlOf(readFileSync(join(root, 'docs/ops/runbook/domain.md'), 'utf8'));
  if (!base) {
    console.error('운영 주소를 못 읽었다 — docs/ops/runbook/domain.md 의 「운영 주소는 … 이다」 줄을 보거나 --url 로 준다');
    process.exit(1);
  }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  const rows = [];
  try {
    for (const screen of SCREENS) {
      const seen = await look(browser, base, screen);
      rows.push({ screen, seen, verdict: judge(screen, seen, base) });
    }
  } finally {
    await browser.close();
  }
  const at = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'medium' }).format(new Date());
  const failed = rows.filter((row) => !row.verdict.pass);
  const headers = rows.filter((row) => !row.seen.error);
  console.log(`smoke — \`${base}\` · ${at} (서울) · 로그인 없이 headless Chromium(\`npm run smoke:deploy\`)\n`);
  console.log(tableOf(rows));
  console.log(
    `\nCSP 헤더(강제): ${headers.every((row) => row.seen.cspHeader) ? '다섯 응답 모두에 섰다' : '빠진 응답이 있다'}. ` +
      (failed.length === 0 ? '다섯 모두 통과.' : `실패 ${failed.length} — 「CSP 가 화면을 막을 때」의 1 처럼 앞 배포를 Promote 할지 본다.`),
  );
  const noted = rows.flatMap(({ screen, seen }) => [...seen.consoleErrors, ...seen.pageErrors].map((text) => `- ${screen.path}: ${text}`));
  if (noted.length > 0) console.log(`\n판정에 넣지 않은 콘솔 오류 · 예외:\n${noted.join('\n')}`);
  process.exitCode = failed.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
