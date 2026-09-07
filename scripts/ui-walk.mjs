/**
 * 로그인된 창을 **띄워 놓는다.**
 *
 *     node scripts/ui-walk.mjs full
 *
 * 구글 동의 화면만 건너뛰고 나머지는 실제 흐름 그대로다. 창을 닫으면 끝난다 —
 * 계정은 지우지 않는다. 로컬 DB 라 쌓여도 되고, 치우고 싶으면 `npm run db:reset`.
 */

import { chromium } from '@playwright/test';

import { STATES, build } from './ui-states.mjs';

const state = process.argv[2] ?? 'full';
const port = process.env.UI_PORT ?? '3100';
const baseURL = `http://localhost:${port}`;

if (!(state in STATES)) {
  console.error(`모르는 상태입니다: ${state}\n`);
  for (const [name, what] of Object.entries(STATES)) console.error(`  ${name.padEnd(6)} ${what}`);
  process.exit(1);
}

const ready = await fetch(baseURL).then(
  () => true,
  () => false,
);
if (!ready) {
  console.error(`${baseURL} 에 아무도 없습니다 — 다른 창에서 \`node scripts/ui-dev.mjs\` 를 먼저 도세요.`);
  process.exit(1);
}

console.log(`${state} — ${STATES[state]}`);
const { people } = await build(state);

const browser = await chromium.launch({ headless: false, args: ['--window-size=1280,900'] });

for (const [index, person] of people.entries()) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await context.addCookies(person.cookies.map((one) => ({ ...one, url: baseURL })));
  const page = await context.newPage();
  await page.goto(`${baseURL}${person.at}`);
  console.log(`  창 ${index + 1} — ${person.nickname} (${person.email}) → ${person.at}`);
}

console.log('\n창을 닫으면 끝납니다. Ctrl+C 로도 됩니다.');
await new Promise((resolve) => browser.on('disconnected', resolve));
