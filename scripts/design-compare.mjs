/**
 * **나란히 재는 그림** — 웹 부품을 390px 로 그린 것과 앱 부품(웹 번들)을 같은 차례로 찍어 한 장에 나란히 놓는다(ADR 0109 추기 2026-10-31).
 * 값 비교는 시험(`mobile-design-tokens.test.ts`)이, 눈 비교는 이 그림이 맡는다.
 *
 *     # mobile/ 에서 앱을 웹 번들로 띄운 뒤(docs/agents/delegation/local-env.md 「앱을 웹 번들로 재기」)
 *     APP_URL=http://localhost:8081 node scripts/design-compare.mjs <내보낼 폴더>
 *
 * 웹 쪽은 Next 없이 짓는다 — `app/globals.css` 를 Tailwind 로 컴파일하고, 상수의 클래스로 정적 HTML 을 만든다(운영 라우트를 안 늘린다).
 * 글꼴은 양쪽 모두 앱의 OTF 다 — 웹의 조각 글꼴과 글리프가 같은 배포본이라 모양을 견주는 데 지장이 없다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';

import { GALLERY } from '../src/lib/design/contract.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(process.argv[2] ?? 'design-compare');
const APP_URL = process.env.APP_URL ?? 'http://localhost:8081';
const WIDTH = 390;

/** 웹 상수의 글자 — 도구는 화면 모듈을 부르지 않고 글자로 읽는다(ADR 0085). `${}` 는 같은 파일의 상수로 푼다 */
function classesOf(path, name) {
  const body = readFileSync(join(ROOT, path), 'utf8').match(new RegExp(`(?:export )?const ${name} =\\s*([\`'])([\\s\\S]*?)\\1;`))?.[2];
  if (body === undefined) throw new Error(`${path} 에 ${name} 이 없다`);
  return body.replace(/\$\{(\w+)\}/g, (_, inner) => classesOf(path, inner));
}

const webOf = (name) => {
  if (name === 'CELL') return 'rounded-cell bg-surface-soft p-3';
  if (name === 'FIELD') return classesOf('app/ui/fields.ts', name);
  if (/^(BUTTON|ICON_BUTTON)/.test(name)) return classesOf('app/ui/buttons.ts', name);
  const classes = classesOf('app/ui/surfaces.ts', name);
  return name === 'CARD_FRAME' || name === 'MENU_PANEL' ? `${classes} p-4` : classes;
};
const CLASSES = Object.fromEntries(GALLERY.map(({ web }) => [web, webOf(web)]));

function itemHtml({ web, text }) {
  const classes = CLASSES[web];
  if (web === 'FIELD') return `<input class="${classes} w-full" value="${text}" readonly />`;
  if (web.startsWith('BUTTON')) return `<div class="flex items-start"><button class="${classes}">${text}</button></div>`;
  const tone = web === 'TILE' ? ' tone-wood' : '';
  return `<div class="${classes}${tone}"><p class="text-body leading-6 text-foreground">${text}</p></div>`;
}

const body = `<main class="flex flex-col gap-4 p-4">${GALLERY.map(itemHtml).join('\n')}</main>`;

/** 그림에 쓴 클래스만 든 CSS — Tailwind 가 이 글자를 읽어 짓는다 */
const source = `${readFileSync(join(ROOT, 'app/globals.css'), 'utf8')}\n@source inline(${JSON.stringify(Object.values(CLASSES).join(' ') + ' tone-wood text-body leading-6 text-foreground flex flex-col gap-4 p-4 w-full items-start')});\n`;
const { css } = await postcss([tailwind()]).process(source, { from: join(ROOT, 'app/globals.css') });

mkdirSync(out, { recursive: true });
const font = (weight, name) => `@font-face{font-family:"Busan Dandi Myeongjo";font-weight:${weight};src:url("${pathToFileURL(join(ROOT, `mobile/assets/fonts/${name}.otf`)).href}")}`;
const webFile = join(out, 'web.html');
writeFileSync(webFile, `<!doctype html><html><head><meta charset="utf-8"><style>${font(400, 'BusanDandiMyeongjoM')}${font(700, 'BusanDandiMyeongjoB')}${css}</style></head><body>${body}</body></html>`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 1800 }, deviceScaleFactor: 2, colorScheme: 'light' });
await page.goto(pathToFileURL(webFile).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(out, 'web.png'), fullPage: true });

await page.goto(`${APP_URL}/dev-parts`, { waitUntil: 'networkidle', timeout: 180000 });
await page.getByText(GALLERY.at(-2).text).first().waitFor({ timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(out, 'app.png'), fullPage: false });

const compare = await browser.newPage({ viewport: { width: WIDTH * 2 + 48, height: 1800 }, deviceScaleFactor: 1 });
await compare.setContent(`<body style="margin:0;display:flex;gap:16px;padding:16px;background:#888;font:14px sans-serif">
  <figure style="margin:0"><figcaption style="color:#fff">웹 ${WIDTH}px</figcaption><img width="${WIDTH}" src="data:image/png;base64,${readFileSync(join(out, 'web.png')).toString('base64')}"></figure>
  <figure style="margin:0"><figcaption style="color:#fff">앱(웹 번들) ${WIDTH}px</figcaption><img width="${WIDTH}" src="data:image/png;base64,${readFileSync(join(out, 'app.png')).toString('base64')}"></figure>
</body>`);
await compare.waitForLoadState('load');
await compare.screenshot({ path: join(out, 'compare.png'), fullPage: true });
await browser.close();
console.log(join(out, 'compare.png'));
