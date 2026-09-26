import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * **손이 붙은 뒤에 누른다** — 서버 HTML 로 먼저 선 단추는 보이고 눌리지만, 누름을 받는 손(React)은 하이드레이션
 * 뒤에 붙는다. 그 전의 누름은 아무 일도 안 하고 사라지고, Playwright 는 그것을 다시 누르지 않는다.
 *
 * 워커 셋 · 첫 컴파일 · CI 처럼 하이드레이션이 늦는 날에만 붉어서 흔들리는 시험으로 보였다(2026-09-26 — 사람 더하기 ·
 * 오늘의 인연 넘기기 · 사진 끌기). `networkidle` 은 손이 붙었다는 뜻이 아니다. React 가 요소에 제 속성
 * (`__reactProps$…`)을 다는 것이 붙었다는 표시다.
 *
 * 화면을 연 뒤의 첫 누름은 아래 `waitForHydrationOnNavigation` 이 모든 시험에서 대신 기다린다. 이 손잡이는
 * 그 뒤에도 늦게 붙는 요소(스트리밍으로 나중에 온 조각)를 누를 때 쓴다.
 */
export async function hydrated(control: Locator): Promise<Locator> {
  await expect
    .poll(() => control.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      message: '하이드레이션이 끝나지 않았다',
    })
    .toBe(true);
  return control;
}

/**
 * **이 화면에 React 가 손을 달았는가** — 문서에 이벤트 손(`_reactListening…`)이 서고 `<body>` 가 제 속성을 받았다.
 *
 * 앞의 것은 `hydrateRoot` 가 문서에 이벤트를 다는 순간이다. 그 뒤로는 아직 하이드레이션 안 된 조각을 눌러도 React 가
 * 그 조각을 먼저 붙이고 누름을 흘려보낸다 — 그 전의 누름만 사라진다. 뒤의 것은 껍데기(`layout`)가 실제로 붙었다는 표시다.
 * Next 의 화면이 아닌 응답(그림 · JSON · 자바스크립트를 끈 창)에는 기다릴 것이 없다.
 */
async function untilHydrated(page: Page): Promise<void> {
  const isApp = await page
    .evaluate(() => document.querySelector('script[src*="/_next/"]') !== null)
    .catch(() => false);
  if (!isApp) return;
  await page.waitForFunction(
    () =>
      Object.keys(document).some((key) => key.startsWith('_reactListening')) &&
      Object.keys(document.body ?? {}).some((key) => key.startsWith('__reactProps$')),
    undefined,
    { polling: 50 },
  );
}

const PATCHED = Symbol('hydration-aware');

function patch(page: Page): void {
  const marked = page as Page & { [PATCHED]?: true };
  if (marked[PATCHED]) return;
  marked[PATCHED] = true;

  const goto = page.goto.bind(page);
  const reload = page.reload.bind(page);
  const settles = (options?: { waitUntil?: string }) => options?.waitUntil !== 'commit';

  page.goto = async (url, options) => {
    const response = await goto(url, options);
    if (settles(options)) await untilHydrated(page);
    return response;
  };
  page.reload = async (options) => {
    const response = await reload(options);
    if (settles(options)) await untilHydrated(page);
    return response;
  };
}

/**
 * **`goto` · `reload` 가 하이드레이션까지 기다린다** — 그 창에서 열리는 모든 쪽에.
 *
 * 화면을 열고 바로 누르는 자리가 시험 전체에 백 군데가 넘었다. 한 자리씩 `hydrated` 를 두르면 새 시험을 쓰는 사람이
 * 또 잊는다 — 그래서 여는 문 자체가 기다린다. 자바스크립트를 끈 창에는 걸지 않는다(붙을 손이 없다).
 */
export function waitForHydrationOnNavigation(context: BrowserContext): void {
  for (const page of context.pages()) patch(page);
  context.on('page', patch);
}

/** 모든 시험의 기본 창에 거는 손잡이 — 익명은 `csp.ts` 의 `anonTest`, 로그인은 `session.ts` 가 이어받는다 */
export const hydrationFixture = [
  async (
    { context, javaScriptEnabled }: { context: BrowserContext; javaScriptEnabled: boolean | undefined },
    use: (value: void) => Promise<void>,
  ) => {
    if (javaScriptEnabled !== false) waitForHydrationOnNavigation(context);
    await use();
  },
  { auto: true },
] as const;
