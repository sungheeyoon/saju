/**
 * **공유 미리보기 그림 셋을 지금 화면의 모양으로 그려 굽는다**(G-58 ㉢, ADR 0109).
 *
 * 옛 그림(`*-share-v1.jpg`)은 이름을 정하기 전의 종이 공예 삽화였고, v2 는 그 위에 로고와 이름만 덮어 구웠다.
 * 화면은 그 사이 「부드러움」 한 벌로 옮겨 갔다(ADR 0109) — 크림 종이 바탕 · 오행 파스텔 면 · 먹색 선의 다섯 상징 ·
 * 점선 궤도의 관계 지도 · 고운돋움 제목. v3 는 삽화를 빌리지 않고 **화면과 같은 부품으로 그린다**:
 *
 * - `saju` (첫 화면 · 사람 공유) — 가운데 나, 안쪽 궤도에 다섯 기운, 바깥 점선 궤도. 로고와 같은 짜임이다
 * - `reading` (풀이 공유) — 여덟 글자 판. 기둥 넷의 글자가 제 기운의 파스텔 면에 선다
 * - `compat` (궁합 공유) — 두 사람의 궤도가 겹치고, 둘 사이의 선 가운데 하트
 *
 * 색은 `app/globals.css` 의 밝은 토큰을 읽는다(새 색을 짓지 않는다). 다섯 상징의 모양은 `app/ui/element-symbol.tsx`,
 * 하트 · 반짝임은 `app/ui/icons.tsx` 와 같은 선이다 — 거기를 바꾸면 여기도 옮긴다. **그림의 글자는 `SERVICE_NAME` ·
 * `SERVICE_TAGLINE` 둘과 여덟 글자(한자)뿐이다** — 새 문구는 없다.
 *
 * 왜 `opengraph-image.tsx` 가 아니라 구워 둔 JPEG 인가: 공유본 미리보기는 첫 HTML 에 상수로 실려야 하고
 * (ADR 0063), 흐름 검사(`check-share.mjs`)가 JPEG 의 실제 크기 · 무게(300KB 아래)를 적어 둔 값과 견준다.
 * 파일 규약의 그림은 파일 그림이 메타데이터 객체보다 앞서 공유본 세 화면의 갈래별 그림을 덮는다.
 *
 * **판을 바꾸면 파일 이름의 판(`-v3`)도 올린다** — 카카오톡 · 페이스북은 미리보기 그림을 주소로 오래 붙들어, 같은
 * 이름에 새 그림을 올리면 옛 그림이 계속 선다. 이름을 바꾸면 이것을 다시 돌린다 — `scripts/brand-share-images.test.ts`
 * 가 구운 이름과 상수가 다르면 붉힌다.
 *
 *   node scripts/brand-share-images.mjs                  # public/brand 에 굽는다
 *   node scripts/brand-share-images.mjs --out <폴더>     # 다른 곳에 굽는다(미리 보기)
 *
 * Playwright 의 Chromium 으로 두 배 크기로 그리고 sharp 로 1200×628 로 줄여 mozjpeg 로 담는다. 고운돋움은 Google
 * Fonts 에서 받는다(앱과 같은 곳) — 굽는 기계에 망이 있어야 한다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';
import sharp from 'sharp';

import { SERVICE_NAME, SERVICE_TAGLINE } from '../src/lib/brand/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const STAMP = join(ROOT, 'scripts/brand-share-images.json');
const SIZE = { width: 1200, height: 628 };
/** 흐름 검사의 선(300KB)보다 한참 아래 — 면이 평평해 이 값에서도 선이 번지지 않는다 */
const JPEG_QUALITY = 88;

const outAt = process.argv.indexOf('--out');
const OUT = outAt > 0 ? process.argv[outAt + 1] : join(ROOT, 'public/brand');

/** `app/globals.css` 의 첫 `:root`(밝은 화면) 토큰 */
function lightTokens() {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8');
  const root = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
  return Object.fromEntries([...root.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}
const T = lightTokens();

const ELEMENTS = {
  wood: { ink: T.wood, soft: T['wood-soft'], mid: T['wood-mid'] },
  fire: { ink: T.fire, soft: T['fire-soft'], mid: T['fire-mid'] },
  earth: { ink: T.earth, soft: T['earth-soft'], mid: T['earth-mid'] },
  metal: { ink: T.metal, soft: T['metal-soft'], mid: T['metal-mid'] },
  water: { ink: T.water, soft: T['water-soft'], mid: T['water-mid'] },
};

/** `app/ui/element-symbol.tsx` 의 다섯 모양(24 격자) */
const SYMBOL_PATHS = {
  wood: (e) =>
    `<path d="M12 21V11" stroke="${e.ink}" stroke-width="1.8" fill="none"/>` +
    `<path d="M12 13c-4.5 0-7-2.6-7-7 4.4 0 7 2.5 7 7Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>` +
    `<path d="M12 11c0-4.2 2.4-7 7-7 0 4.6-2.6 7-7 7Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>`,
  fire: (e) =>
    `<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.2 2.2-5 3.4-7.6.6 1.6 1.4 2.5 2.4 2.9C11.2 7 12.6 4.6 14.8 3c-.3 3 1.4 4.8 2.6 6.6 1 1.4 1.6 3 1.6 4.9 0 3.9-2.9 6.5-7 6.5Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>`,
  earth: (e) =>
    `<path d="M2.5 18.5 9 9.5l3.2 4.2 2.6-3.2 6.7 8Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>` +
    `<path d="M2.5 21h19" stroke="${e.ink}" stroke-width="1.6" fill="none"/>`,
  metal: (e) =>
    `<path d="M6.5 4h11l4 5.5L12 21 2.5 9.5Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>` +
    `<path d="M2.5 9.5h19M9 4l3 5.5L15 4M12 9.5V21" stroke="${e.ink}" stroke-width="1.2" fill="none"/>`,
  water: (e) =>
    `<path d="M12 3c3.4 4.2 6.2 7.7 6.2 11.2A6.2 6.2 0 0 1 5.8 14.2C5.8 10.7 8.6 7.2 12 3Z" fill="${e.mid}" stroke="${e.ink}" stroke-width="1.5"/>` +
    `<path d="M9 14.5a3 3 0 0 0 3 3" stroke="${e.ink}" stroke-width="1.4" fill="none"/>`,
};

/** 상징 하나를 (cx, cy) 가운데 size 크기로 */
const symbol = (name, cx, cy, size) =>
  `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})" stroke-linecap="round" stroke-linejoin="round">${SYMBOL_PATHS[name](ELEMENTS[name])}</g>`;

/** 파스텔 면의 둥근 딱지에 상징 — 화면의 기운 원과 같은 짜임(면 · 옅은 테 · 상징) */
const badge = (name, cx, cy, r, { dashed = false } = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ELEMENTS[name].soft}" stroke="${ELEMENTS[name].mid}" stroke-width="2" ${dashed ? 'stroke-dasharray="5 6"' : ''}/>` +
  symbol(name, cx, cy, r * 1.05);

/** 점선 궤도 — 로고의 `stroke-dasharray="0.1 3.3"` 과 같은 둥근 점 */
const orbit = (cx, cy, r, { gap = 13, width = 4, color = T['border-strong'] } = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-dasharray="0.1 ${gap}"/>`;

const HEART = 'M12 19.5s-7.5-4.4-7.5-9.7A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5c0 5.3-7.5 9.7-7.5 9.7Z';
const SPARK = 'M12 3.5 13.9 10l6.6 2-6.6 2L12 20.5 10.1 14l-6.6-2 6.6-2Z';
const icon = (d, cx, cy, size, { fill = 'none', stroke = T.foreground, width = 1.8 } = {}) =>
  `<g transform="translate(${cx - size / 2} ${cy - size / 2}) scale(${size / 24})"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/></g>`;

/** 로고(`app/ui/logo.tsx` · `app/icon.svg`) — 바탕 네모 없이 */
const LOGO = `<svg viewBox="0 0 32 32" width="84" height="84">
  <circle cx="16" cy="16.5" r="11" fill="none" stroke="${T.foreground}" stroke-opacity="0.5" stroke-width="1.8" stroke-dasharray="0.1 3.3" stroke-linecap="round"/>
  <circle cx="16" cy="16.5" r="6" fill="${T['fire-mid']}" stroke="${T.foreground}" stroke-width="1.6"/>
  <circle cx="17.4" cy="5.6" r="2" fill="${T['water-mid']}" stroke="${T.foreground}" stroke-width="1.3"/>
  <circle cx="24.9" cy="10" r="3" fill="${T['wood-mid']}" stroke="${T.foreground}" stroke-width="1.5"/>
</svg>`;

/* ───────────── 그림 셋 — 오른쪽 그림판(1200×628 좌표의 SVG) ───────────── */

/** 첫 화면 · 사람 공유 — 나를 가운데 두고 다섯 기운이 안쪽 궤도에, 바깥 점선 궤도에 작은 점들 */
function sajuArt() {
  const cx = 880;
  const cy = 318;
  const ring = 158;
  const order = ['wood', 'fire', 'earth', 'metal', 'water'];
  const at = (i, r, offset = -90) => {
    const a = ((offset + i * 72) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const badges = order.map((name, i) => badge(name, ...at(i, ring), 40)).join('');
  const spokes = [0, 3]
    .map((i) => {
      const [x, y] = at(i, ring - 42);
      const [x0, y0] = at(i, 74);
      return `<line x1="${x0}" y1="${y0}" x2="${x}" y2="${y}" stroke="${T.foreground}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join('');
  const outer = 262;
  const beads = [
    [-58, 9, T['water-mid']],
    [-30, 13, T['wood-mid']],
    [122, 7, T['border-strong']],
    [168, 9, T['earth-mid']],
    [214, 6, T['border-strong']],
  ]
    .map(([deg, r, fill]) => {
      const a = (deg * Math.PI) / 180;
      return `<circle cx="${cx + outer * Math.cos(a)}" cy="${cy + outer * Math.sin(a)}" r="${r}" fill="${fill}" stroke="${T.foreground}" stroke-width="2.4"/>`;
    })
    .join('');
  return `
    <circle cx="${cx}" cy="${cy}" r="218" fill="${T['accent-soft']}" opacity="0.55"/>
    <circle cx="${cx}" cy="${cy}" r="${ring}" fill="none" stroke="${T.foreground}" stroke-opacity="0.16" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="112" fill="${T['fire-soft']}"/>
    ${orbit(cx, cy, outer)}
    ${beads}
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="66" fill="${T['fire-mid']}" stroke="${T.foreground}" stroke-width="4"/>
    <circle cx="${cx - 18}" cy="${cy - 20}" r="12" fill="#ffffff" opacity="0.35"/>
    ${badges}`;
}

/** 풀이 공유 — 기둥 넷 · 여덟 글자가 제 기운의 면에 선 판. 판은 살짝 기울고 뒤에 궤도가 돈다 */
function readingArt() {
  /* 시 · 일 · 월 · 년. 다섯 기운이 다 서도록 고른 보기 글자다 — 누구의 명식도 아니다 */
  const pillars = [
    [['壬', 'water'], ['寅', 'wood']],
    [['丙', 'fire'], ['午', 'fire']],
    [['乙', 'wood'], ['酉', 'metal']],
    [['庚', 'metal'], ['辰', 'earth']],
  ];
  const tile = 88;
  const gapX = 18;
  const gapY = 14;
  const cardW = 4 * tile + 3 * gapX + 2 * 40;
  const cardH = 2 * tile + gapY + 2 * 40;
  const cx = 872;
  const cy = 330;
  const x0 = cx - cardW / 2;
  const y0 = cy - cardH / 2;
  const tiles = pillars
    .map((column, c) =>
      column
        .map(([char, name], r) => {
          const x = x0 + 40 + c * (tile + gapX);
          const y = y0 + 40 + r * (tile + gapY);
          const e = ELEMENTS[name];
          return (
            `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" rx="22" fill="${e.soft}"/>` +
            `<text x="${x + tile / 2}" y="${y + tile / 2 + 18}" text-anchor="middle" font-size="52" font-weight="700" fill="${e.ink}" font-family="'Noto Sans KR', sans-serif">${char}</text>`
          );
        })
        .join(''),
    )
    .join('');
  /* 일주(둘째 기둥)는 홈의 명식처럼 두 글자를 한 테로 두른다 */
  const dayX = x0 + 40 + (tile + gapX) - 7;
  const day = `<rect x="${dayX}" y="${y0 + 33}" width="${tile + 14}" height="${2 * tile + gapY + 14}" rx="28" fill="none" stroke="${T.foreground}" stroke-width="3.5"/>`;
  return `
    ${orbit(cx + 10, cy - 4, 262)}
    <circle cx="${cx + 10 + 262 * Math.cos(-0.5)}" cy="${cy - 4 + 262 * Math.sin(-0.5)}" r="11" fill="${T['water-mid']}" stroke="${T.foreground}" stroke-width="2.4"/>
    <circle cx="${cx + 10 + 262 * Math.cos(2.5)}" cy="${cy - 4 + 262 * Math.sin(2.5)}" r="8" fill="${T['earth-mid']}" stroke="${T.foreground}" stroke-width="2.4"/>
    <g transform="rotate(-4 ${cx} ${cy})" filter="url(#lift)">
      <rect x="${x0}" y="${y0}" width="${cardW}" height="${cardH}" rx="40" fill="${T.surface}"/>
      ${tiles}
      ${day}
    </g>
    <g transform="rotate(8 ${x0 + cardW - 8} ${y0 + 6})">
      <circle cx="${x0 + cardW - 8}" cy="${y0 + 6}" r="40" fill="${T.accent}"/>
      ${icon(SPARK, x0 + cardW - 8, y0 + 6, 40, { fill: T['on-accent'], stroke: T['on-accent'], width: 1.2 })}
    </g>`;
}

/** 궁합 공유 — 두 사람의 궤도가 겹치고, 둘을 잇는 선 가운데 하트. 궤도 위에 각자의 기운 */
function compatArt() {
  const a = [748, 318];
  const b = [1018, 318];
  const r = 150;
  const mid = [(a[0] + b[0]) / 2, 318];
  return `
    <ellipse cx="${mid[0]}" cy="${mid[1]}" rx="318" ry="226" fill="${T['accent-soft']}" opacity="0.5"/>
    ${orbit(...a, r)}
    ${orbit(...b, r)}
    <path d="M ${a[0] + 64} ${a[1]} C ${mid[0] - 40} ${a[1] - 38}, ${mid[0] + 40} ${b[1] - 38}, ${b[0] - 64} ${b[1]}" fill="none" stroke="${T.foreground}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${a[0]}" cy="${a[1]}" r="64" fill="${T['fire-soft']}" stroke="${T.fire}" stroke-width="4"/>
    ${symbol('fire', a[0], a[1], 70)}
    <circle cx="${b[0]}" cy="${b[1]}" r="64" fill="${T['water-soft']}" stroke="${T.water}" stroke-width="4"/>
    ${symbol('water', b[0], b[1], 70)}
    <circle cx="${mid[0]}" cy="${mid[1] - 28}" r="34" fill="${T.surface}" stroke="${T.foreground}" stroke-width="3"/>
    ${icon(HEART, mid[0], mid[1] - 27, 38, { fill: T['fire-mid'], stroke: T.foreground, width: 1.6 })}
    ${badge('wood', a[0] - r * Math.cos(0.9), a[1] - r * Math.sin(0.9), 34)}
    ${badge('earth', a[0] - r * Math.cos(-0.75), a[1] - r * Math.sin(-0.75), 30)}
    ${badge('metal', b[0] + r * Math.cos(0.85), b[1] - r * Math.sin(0.85), 34)}
    <circle cx="${b[0] + r * Math.cos(-0.6)}" cy="${b[1] - r * Math.sin(-0.6)}" r="10" fill="${T['wood-mid']}" stroke="${T.foreground}" stroke-width="2.4"/>
    <circle cx="${a[0] + r * Math.cos(2.1)}" cy="${a[1] + r * Math.sin(2.1)}" r="8" fill="${T['earth-mid']}" stroke="${T.foreground}" stroke-width="2.4"/>`;
}

/** 모서리의 파스텔 원 — 첫 화면 머리판의 모서리처럼 캔버스 밖으로 반쯤 나간다 */
const CORNERS = {
  saju: [
    [1170, -30, 190, T['wood-soft']],
    [1235, 70, 150, T['water-soft']],
    [-60, 660, 170, T['earth-soft']],
  ],
  reading: [
    [1190, 640, 210, T['water-soft']],
    [1110, 690, 130, T['wood-soft']],
    [-40, -50, 150, T['fire-soft']],
  ],
  compat: [
    [1180, -20, 170, T['fire-soft']],
    [-50, 650, 190, T['wood-soft']],
    [40, 700, 120, T['water-soft']],
  ],
};

const SHOTS = [
  { kind: 'saju', target: 'saju-share-v3.jpg', art: sajuArt },
  { kind: 'reading', target: 'reading-share-v3.jpg', art: readingArt },
  { kind: 'compat', target: 'compat-share-v3.jpg', art: compatArt },
];

function page(shot) {
  const corners = CORNERS[shot.kind].map(([x, y, r, fill]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Noto+Sans+KR:wght@700&display=block">
<style>
  @font-face { font-family: Pretendard; font-weight: 600; src: url("file://${ROOT}node_modules/pretendard/dist/public/static/Pretendard-SemiBold.otf"); }
  html, body { margin: 0; }
  body { width: ${SIZE.width}px; height: ${SIZE.height}px; position: relative; overflow: hidden; background: ${T.background}; }
  svg.art { position: absolute; inset: 0; }
  .words { position: absolute; left: 92px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; color: ${T.foreground}; }
  .name { margin-top: 20px; font-family: 'Gowun Dodum'; font-size: 132px; line-height: 1; letter-spacing: -0.02em; }
  .tagline { margin-top: 30px; font-family: Pretendard; font-weight: 600; font-size: 31px; letter-spacing: -0.02em; color: ${T['text-secondary']}; white-space: nowrap; }
</style></head>
<body>
  <svg class="art" viewBox="0 0 ${SIZE.width} ${SIZE.height}" width="${SIZE.width}" height="${SIZE.height}">
    <defs>
      <filter id="lift" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="rgb(60,48,30)" flood-opacity="0.16"/>
      </filter>
    </defs>
    ${corners}
    ${shot.art()}
  </svg>
  <div class="words">
    ${LOGO}
    <div class="name">${SERVICE_NAME}</div>
    <div class="tagline">${SERVICE_TAGLINE}</div>
  </div>
</body></html>`;
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
  const tab = await context.newPage();
  for (const shot of SHOTS) {
    await tab.setContent(page(shot), { waitUntil: 'networkidle' });
    await tab.evaluate(() => document.fonts.ready);
    const png = await tab.screenshot({ type: 'png' });
    const jpeg = await sharp(png)
      .resize(SIZE.width, SIZE.height, { kernel: 'lanczos3' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
    writeFileSync(join(OUT, shot.target), jpeg);
    console.log(`${shot.target} · ${Math.round(jpeg.length / 1024)}KB`);
  }
} finally {
  await browser.close();
}

if (OUT === join(ROOT, 'public/brand')) {
  writeFileSync(
    STAMP,
    `${JSON.stringify({ name: SERVICE_NAME, tagline: SERVICE_TAGLINE, images: SHOTS.map((shot) => shot.target) }, null, 2)}\n`,
  );
}
