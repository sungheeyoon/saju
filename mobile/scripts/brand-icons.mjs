/**
 * **앱 아이콘 · 스플래시 · 파비콘을 웹의 로고 원본 `app/icon.svg` 에서 굽는다**(ADR 0149 추기).
 *
 * 색은 원본의 밝은 짝이고(앱에 어두운 화면이 없다), 바탕은 `src/ui/tokens.ts` 를 읽는다 — 아이콘은 원본의 종이 판과 같은 `cream`,
 * 스플래시는 첫 화면 · 웹 manifest 와 같은 `background`. `app.json` 은 토큰을 못 읽어 값을 적어 두고 `scripts/mobile-brand.test.ts` 가 견준다.
 *
 * - `icon.png` — 1024. iOS · 안드로이드 공용이라 종이 판을 모서리까지 채운다(둥근 모서리 · 투명 금지 — 기기가 깎는다)
 * - `android-icon-foreground.png` · `android-icon-monochrome.png` — 1024, 투명 바탕. 적응형 캔버스 108dp 가운데 지름 66dp 만 안 깎이므로
 *   로고를 그 원 안에 넣는다. 원본 좌표에서 가운데(32, 32)부터 가장 먼 끝은 나무 점의 바깥 29.5 다
 * - `android-icon-monochrome.png` 은 흰 실루엣이다 — 안드로이드는 알파만 읽는다
 * - `android-icon-background.png` — 1024, `cream` 단색
 * - `splash-icon.png` — 1024, 투명 바탕. 안드로이드 12+ 스플래시가 지름 2/3 원 밖을 깎으므로 같은 여백을 둔다. `imageWidth` 200 이면 로고는 약 133dp
 * - `favicon.png` — 48. 웹 탭처럼 둥근 종이 판
 *
 *   node scripts/brand-icons.mjs                 # assets/images 에 굽는다
 *   node scripts/brand-icons.mjs --out <폴더>    # 다른 곳에 굽는다(미리 보기)
 *
 * sharp 는 뿌리 `node_modules` 것이다(뿌리 `scripts/brand-icons.mjs` 와 같다). 앱 패키지에는 넣지 않는다.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const MOBILE = new URL('..', import.meta.url).pathname;
const REPO = join(MOBILE, '..');
const outAt = process.argv.indexOf('--out');
const OUT = outAt > 0 ? process.argv[outAt + 1] : join(MOBILE, 'assets/images');

const tokens = readFileSync(join(MOBILE, 'src/ui/tokens.ts'), 'utf8');
const CREAM = tokens.match(/\bcream: '(#[0-9a-f]{6})'/)[1];

/** 밝은 짝 — 다크 덩어리를 걷는다(뿌리 도구와 같은 식) */
const light = readFileSync(join(REPO, 'app/icon.svg'), 'utf8').replace(/@media[^{]*\{[\s\S]*?\}\s*\}/, '');
const plate = /<rect class="paper"[^>]*\/>/;
if (!plate.test(light)) throw new Error('app/icon.svg 의 종이 판을 못 찾았다');

/** 판을 뺀 로고 — 가운데(32, 32)를 축으로, 한 변 `span` 단위의 칸에 담는다 */
const mark = (svg, span) => svg.replace(plate, '').replace('viewBox="0 0 64 64"', `viewBox="${32 - span / 2} ${32 - span / 2} ${span} ${span}"`);

/** 흰 실루엣 — 원본 규칙 뒤에 덧씌운다 */
const silhouette = light.replace('</style>', '.line { stroke: #fff; } .me, .water, .wood, .earth { fill: #fff; }\n</style>');

const REACH = 29.5;
const ADAPTIVE_SPAN = (REACH * 2 * 108) / 66;
const SPLASH_SPAN = REACH * 2 * 1.5;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * Math.ceil(size / 64) * 2 }).resize(size, size).png({ compressionLevel: 9 });

mkdirSync(OUT, { recursive: true });
const write = async (name, image) => writeFileSync(join(OUT, name), await image.toBuffer());

await write('icon.png', png(light.replace('rx="16"', 'rx="0"'), 1024).removeAlpha());
await write('android-icon-foreground.png', png(mark(light, ADAPTIVE_SPAN), 1024));
await write('android-icon-monochrome.png', png(mark(silhouette, ADAPTIVE_SPAN), 1024));
await write('android-icon-background.png', sharp({ create: { width: 1024, height: 1024, channels: 3, background: CREAM } }).png({ compressionLevel: 9 }));
await write('splash-icon.png', png(mark(light, SPLASH_SPAN), 1024));
await write('favicon.png', png(light, 48));
console.log(`아이콘 · 적응형 셋 · 스플래시 · 파비콘 → ${OUT}`);
