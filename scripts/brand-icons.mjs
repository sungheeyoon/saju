/**
 * **탭 그림의 대체판을 `app/icon.svg` 에서 굽는다**(ADR 0149).
 *
 * `app/icon.svg` 하나로는 모자란다 — Safari 는 SVG 파비콘을 안 읽고, 수집기 · 옛 브라우저는 `/favicon.ico` 를 곧장 두드린다
 * (그 주소가 404 라 탭에 기본 그림이 섰다, 2026-10-07). Next 의 파일 규약(`node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/01-metadata/app-icons.md`)대로 셋을 `app/` 에 둔다:
 *
 * - `app/favicon.ico` — 16 · 32 · 48 세 판(PNG 를 담은 ICO). **16 판은 나 · 선 · 닿은 한 사람만 두고 선을 굵힌다** — 그 크기에서 점선
 *   궤도는 회색 얼룩이 되고 작은 점은 한 픽셀이 된다
 * - `app/apple-icon.png` — 180. iOS 가 모서리를 스스로 깎으므로 종이 판을 모서리까지 채운다(둥근 모서리 밖이 검게 선다)
 * - `app/icon.svg` 는 그대로 원본이다 — 다크 화면 짝을 든다
 * - `public/badge.png` — 96. 안드로이드 알림의 단색 배지(`public/sw.js` 의 `badge`, G-74 · ADR 0156). 안드로이드는 알파만 읽고
 *   색을 스스로 칠하므로 **투명 바탕에 흰 실루엣**이다. 24dp 칸(xxxhdpi 에서 96px)이라 16 판처럼 점선 궤도를 빼고, 선은 굵히고,
 *   테두리는 모양에 합쳐 점마다 반지름을 그만큼 키운다. 무리 전체를 칸 가운데로 옮긴다(원본은 위로 치우쳤다). **좌표는 아래에 손으로
 *   옮겨 적었다 — icon.svg 를 바꾸면 이것도 고친다**(ADR 0149 추기)
 *
 * 색은 `app/icon.svg` 의 밝은 짝이다(그 파일의 `@media` 덩어리를 걷고 굽는다). 그림을 고치면 icon.svg 를 고치고 이것을 다시 돌린다.
 *
 *   node scripts/brand-icons.mjs                 # app/ 에 굽는다
 *   node scripts/brand-icons.mjs --out <폴더>    # 다른 곳에 굽는다(미리 보기)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const outAt = process.argv.indexOf('--out');
const OUT = outAt > 0 ? process.argv[outAt + 1] : join(ROOT, 'app');

/** 밝은 짝 — 다크 덩어리를 걷는다 */
const light = readFileSync(join(ROOT, 'app/icon.svg'), 'utf8').replace(/@media[^{]*\{[\s\S]*?\}\s*\}/, '');

/** 16px 판 — 나 · 선 · 닿은 사람만, 선을 굵게(물 점은 그 크기에서 나에게 붙어 한 덩이가 된다) */
const tiny = light
  .replace(/<circle class="line"[^>]*\/>/, '')
  .replace(/<circle class="earth line"[^>]*\/>/, '')
  .replace('d="M32 32 L51.5 43.2" stroke-width="2.6"', 'd="M24 25 L45 42" stroke-width="5"')
  .replace('cx="32" cy="32" r="9.5" stroke-width="2.8"', 'cx="24" cy="25" r="13" stroke-width="4.5"')
  .replace(/<circle class="water line"[^>]*\/>/, '')
  .replace('cx="51.5" cy="43.2" r="5.8" stroke-width="2.4"', 'cx="45" cy="42" r="9.5" stroke-width="4.5"');

/**
 * 알림 배지 — 흰 실루엣. 좌표는 `app/icon.svg` 그대로이고 반지름은 원본 반지름 + 테두리 절반이다.
 * 무리의 상자(x 8.6~58.5 · y 4.2~50.4)를 가운데로 (−1.5, +4.7) 옮기고, 칸 가운데를 축으로 1.12 배 키운다 — 96 칸의 너비 88% ·
 * 높이 81% 를 차고 가장자리에 6~9px 를 남긴다(운영자 2026-10-10 「칸에 더 크게, 약 80%」). 1 배는 79% · 73% 였다
 */
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g fill="#fff" transform="translate(32 32) scale(1.12) translate(-32 -32) translate(-1.5 4.7)">
    <path d="M32 32 L51.5 43.2" stroke="#fff" stroke-width="3.6" stroke-linecap="round" />
    <circle cx="32" cy="32" r="10.9" />
    <circle cx="32" cy="9.5" r="5.3" />
    <circle cx="51.5" cy="43.2" r="7" />
    <circle cx="13.5" cy="45.5" r="4.9" />
  </g>
</svg>`;

/** 모서리까지 채운 판 — iOS 가 깎는다 */
const square = light.replace('rx="16"', 'rx="0"');

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * Math.ceil(size / 64) * 4 }).resize(size, size).png().toBuffer();

/** PNG 를 그대로 담은 ICO — Vista 뒤의 모든 브라우저가 읽는다 */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const at = 6 + index * 16;
    header.writeUInt8(size >= 256 ? 0 : size, at);
    header.writeUInt8(size >= 256 ? 0 : size, at + 1);
    header.writeUInt8(0, at + 2);
    header.writeUInt8(0, at + 3);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(data.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

mkdirSync(OUT, { recursive: true });
const images = [
  { size: 16, data: await png(tiny, 16) },
  { size: 32, data: await png(light, 32) },
  { size: 48, data: await png(light, 48) },
];
writeFileSync(join(OUT, 'favicon.ico'), ico(images));
writeFileSync(join(OUT, 'apple-icon.png'), await png(square, 180));
const BADGE_OUT = outAt > 0 ? OUT : join(ROOT, 'public');
mkdirSync(BADGE_OUT, { recursive: true });
writeFileSync(join(BADGE_OUT, 'badge.png'), await png(badge, 96));
/* 미리 보기 자리에는 ICO 속 판도 따로 내놓는다 — ICO 는 그림 보기 도구가 한 판만 연다 */
if (outAt > 0) for (const { size, data } of images) writeFileSync(join(OUT, `favicon-${size}.png`), data);
console.log(`favicon.ico (16 · 32 · 48) · apple-icon.png (180) → ${OUT} · badge.png (96) → ${BADGE_OUT}`);
