/**
 * **공유 미리보기 그림 셋을 로고와 이름으로 다시 굽는다**(G-58 ㉢, ADR 0109).
 *
 * 2026-09-24 에 재어 보니 미리보기 그림 셋(`public/brand/*-share-v1.jpg`)이 모두 옛 이름 「만세력」을
 * 그림 안의 글자로 들고 있었다 — 메타데이터는 `src/lib/brand` 를 읽어 「점점」이 됐는데 대화창에 서는
 * 그림만 옛 이름이었다. 그림 속 글자는 상수를 못 읽으므로, 이 도구가 상수를 읽어 그림을 다시 굽는다.
 *
 * 그림은 이렇게 선다: 옛 그림의 오른쪽 삽화(종이 공예)는 그대로 두고, 글자가 있던 왼쪽을 그 그림의 바탕색으로
 * 덮은 뒤 로고(`app/icon.svg` 와 같은 모양 — 가운데 큰 점 · 점선 궤도 · 커지는 작은 점 둘) · `SERVICE_NAME` ·
 * `SERVICE_TAGLINE` 을 세운다. **새 문구는 없다** — 그림의 글자는 그 두 상수뿐이다.
 *
 * 왜 `opengraph-image.tsx` 가 아니라 구워 둔 JPEG 인가: 공유본 미리보기는 첫 HTML 에 상수로 실려야 하고
 * (ADR 0063), 흐름 검사(`check-share.mjs`)가 JPEG 의 실제 크기 · 무게(300KB 아래)를 적어 둔 값과 견준다.
 * 파일 규약의 그림은 PNG 로 나가 삽화가 무거워지고, 파일 그림은 메타데이터 객체보다 앞서 공유본 세 화면의
 * 갈래별 그림을 덮는다.
 *
 * 이름을 바꾸면 이것을 다시 돌린다 — `scripts/brand-share-images.test.ts` 가 구운 이름과 상수가 다르면 붉힌다.
 *
 *   node scripts/brand-share-images.mjs
 *
 * macOS 의 `sips` 로 JPEG 을 읽고 쓴다(바탕색을 재고, PNG 를 JPEG 으로 줄인다).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

import { SERVICE_NAME, SERVICE_TAGLINE } from '../src/lib/brand/index.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const BRAND = join(ROOT, 'public/brand');
const STAMP = join(ROOT, 'scripts/brand-share-images.json');
const SIZE = { width: 1200, height: 628 };
/** 흐름 검사의 선(300KB)보다 넉넉히 아래에 둔다 */
const JPEG_QUALITY = '82';

/**
 * 그림마다 옛 글자가 차지하던 자리 — 덮개가 여기까지 바탕색으로 서고, 끝 `fade` 만큼 삽화로 스민다.
 * `saju` 는 아래쪽 언덕이 왼쪽 끝까지 닿아 덮개를 위로 한정한다.
 */
const SHOTS = [
  { source: 'saju-share-v1.jpg', target: 'saju-share-v2.jpg', cover: { width: 640, height: 490 }, fade: 64 },
  { source: 'reading-share-v1.jpg', target: 'reading-share-v2.jpg', cover: { width: 625, height: 628 }, fade: 44 },
  { source: 'compat-share-v1.jpg', target: 'compat-share-v2.jpg', cover: { width: 548, height: 628 }, fade: 26 },
];

const font = (weight) =>
  readFileSync(join(ROOT, `node_modules/pretendard/dist/public/static/Pretendard-${weight}.otf`));
const FONTS = [
  { name: 'Pretendard', data: font('Bold'), weight: 700, style: 'normal' },
  { name: 'Pretendard', data: font('Medium'), weight: 500, style: 'normal' },
];

/** 왼쪽 위 모서리의 바탕색 — sips 가 낸 BMP 를 읽어 평균한다 */
function paperColor(jpegPath, work) {
  const bmpPath = join(work, 'probe.bmp');
  execFileSync('sips', ['-s', 'format', 'bmp', jpegPath, '--out', bmpPath], { stdio: 'ignore' });
  const bmp = readFileSync(bmpPath);
  const offset = bmp.readUInt32LE(10);
  const width = bmp.readInt32LE(18);
  const rawHeight = bmp.readInt32LE(22);
  const height = Math.abs(rawHeight);
  const bytes = bmp.readUInt16LE(28) / 8;
  const stride = Math.ceil((width * bytes) / 4) * 4;
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = 16; y < 56; y += 1) {
    const row = rawHeight > 0 ? height - 1 - y : y;
    for (let x = 16; x < 56; x += 1) {
      const at = offset + row * stride + x * bytes;
      sum[0] += bmp[at + 2];
      sum[1] += bmp[at + 1];
      sum[2] += bmp[at];
      count += 1;
    }
  }
  return sum.map((value) => Math.round(value / count));
}

const rgb = ([r, g, b], alpha = 1) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
const isDark = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;

/** `app/icon.svg` 의 모양과 밝은 짝의 색 — 바탕 네모만 빼고, 선색은 그림의 글자색을 따른다 */
function logoSvg(line) {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">',
    `<circle cx="16" cy="16.5" r="11" fill="none" stroke="${line}" stroke-opacity="0.6" stroke-width="1.8" stroke-dasharray="0.1 3.3" stroke-linecap="round"/>`,
    `<circle cx="16" cy="16.5" r="6" fill="#f0957a" stroke="${line}" stroke-width="1.6"/>`,
    `<circle cx="17.4" cy="5.6" r="2" fill="#86b4db" stroke="${line}" stroke-width="1.3"/>`,
    `<circle cx="24.9" cy="10" r="3" fill="#8cc49a" stroke="${line}" stroke-width="1.5"/>`,
    '</svg>',
  ].join('');
}

async function bake(shot, work) {
  const sourcePath = join(BRAND, shot.source);
  const paper = paperColor(sourcePath, work);
  const ink = isDark(paper) ? '#f7f2e8' : '#20221f';
  const art = `data:image/jpeg;base64,${readFileSync(sourcePath).toString('base64')}`;
  const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg(ink)).toString('base64')}`;
  const solid = shot.cover.width - shot.fade;

  const tree = h(
    'div',
    { style: { display: 'flex', position: 'relative', width: '100%', height: '100%', background: rgb(paper) } },
    h('img', { src: art, width: SIZE.width, height: SIZE.height, style: { position: 'absolute', left: 0, top: 0 } }),
    h('div', {
      style: {
        position: 'absolute', left: 0, top: 0, width: shot.cover.width, height: shot.cover.height,
        background: `linear-gradient(to right, ${rgb(paper)} ${solid}px, ${rgb(paper, 0)} ${shot.cover.width}px)`,
      },
    }),
    h(
      'div',
      {
        style: {
          position: 'absolute', left: 80, top: 0, height: shot.cover.height, width: solid - 80,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', color: ink,
          fontFamily: 'Pretendard',
        },
      },
      h('img', { src: logo, width: 128, height: 128, style: { marginLeft: -8 } }),
      h('div', { style: { marginTop: 18, fontSize: 132, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1 } }, SERVICE_NAME),
      h('div', { style: { marginTop: 28, fontSize: 34, fontWeight: 500, letterSpacing: '-0.02em', whiteSpace: 'nowrap', opacity: 0.88 } }, SERVICE_TAGLINE),
    ),
  );

  const png = Buffer.from(await new ImageResponse(tree, { ...SIZE, fonts: FONTS }).arrayBuffer());
  const pngPath = join(work, `${shot.target}.png`);
  writeFileSync(pngPath, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', JPEG_QUALITY, pngPath, '--out', join(BRAND, shot.target)], {
    stdio: 'ignore',
  });
  console.log(`${shot.target} ← ${shot.source} · 바탕 ${rgb(paper)} · 글자 ${ink}`);
}

const work = mkdtempSync(join(tmpdir(), 'brand-share-'));
try {
  for (const shot of SHOTS) await bake(shot, work);
} finally {
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(
  STAMP,
  `${JSON.stringify({ name: SERVICE_NAME, tagline: SERVICE_TAGLINE, images: SHOTS.map((shot) => shot.target) }, null, 2)}\n`,
);
