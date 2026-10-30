/**
 * **디자인 토큰을 한 원본에서 낸다**(ADR 0109 추기 2026-10-31) — 원본 `src/lib/design/tokens.json` 에서 웹 `app/globals.css` 의 표시된 칸과
 * 앱이 부르는 `src/lib/design/tokens.generated.ts` 를 짓는다. 값을 고치는 자리는 원본 하나다.
 *
 *     node scripts/design-tokens.mjs          # 쓴다
 *     node scripts/design-tokens.mjs --check  # 어긋나면 붉다(`scripts/design-tokens.test.ts` 도 같은 것을 잰다)
 *
 * 값이 적어 작은 스크립트로 충분하다 — Style Dictionary 같은 의존성을 들이지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CSS_PATH = 'app/globals.css';
export const TS_PATH = 'src/lib/design/tokens.generated.ts';
const TONES = ['wood', 'fire', 'earth', 'metal', 'water', 'none'];

const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const px = (value) => (value.endsWith('rem') ? parseFloat(value) * 16 : parseFloat(value));
const lines = (entries, prefix, indent) => Object.entries(entries).map(([name, value]) => `${indent}--${prefix}${name}: ${value};`).join('\n');

const isTone = (name) => TONES.some((tone) => name === tone || name === `${tone}-soft` || name === `${tone}-mid`);

/** 색의 앱 이름은 Tailwind 의 이름과 같다 — `--text-secondary` 는 `text-secondary` 로 부르므로 `secondary` */
function colorsOf(values) {
  const colors = {};
  for (const [name, value] of Object.entries(values)) {
    if (!isTone(name) && !name.startsWith('elevation-')) colors[camel(name.replace(/^text-/, ''))] = value;
  }
  return colors;
}

const tonesOf = (values) => Object.fromEntries(TONES.map((tone) => [tone, { ink: values[tone], soft: values[`${tone}-soft`], mid: values[`${tone}-mid`] }]));

const elevationsOf = (values) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => name.startsWith('elevation-')).map(([name, value]) => [name.slice('elevation-'.length), value]));

const numbers = (values) => Object.fromEntries(Object.entries(values).map(([name, value]) => [name, px(value)]));

/** 표시된 칸의 속만 바꾼다 — 칸 밖은 사람이 쓰는 CSS 다 */
export function regionsInto(css, tokens) {
  const regions = {
    light: lines(tokens.light, '', '  '),
    dark: lines(tokens.dark, '', '    '),
    text: lines(tokens.text, 'text-', '  '),
    radius: lines(tokens.radius, 'radius-', '  '),
  };
  return Object.entries(regions).reduce((text, [name, body]) => {
    const pattern = new RegExp(`(/\\* design-tokens:${name} [^\\n]*\\*/\\n)[\\s\\S]*?(\\n\\s*/\\* /design-tokens:${name} \\*/)`);
    if (!pattern.test(text)) throw new Error(`${CSS_PATH} 에 design-tokens:${name} 칸이 없다`);
    return text.replace(pattern, (_, open, close) => `${open}${body}${close}`);
  }, css);
}

export function typescriptOf(tokens) {
  const constant = (name, value, note) => `/** ${note} */\nexport const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
  return [
    '/* 지은 파일이다 — 손대지 말고 `src/lib/design/tokens.json` 을 고친 뒤 `node scripts/design-tokens.mjs` 를 돈다. */\n',
    constant('COLOR', colorsOf(tokens.light), '밝은 화면의 색 — Tailwind 의 `--color-*` 이름'),
    constant('COLOR_DARK', colorsOf(tokens.dark), '어두운 화면의 색 — 앱은 아직 안 쓴다'),
    constant('TONE', tonesOf(tokens.light), '오행 한 벌 — 글자 · 면 · 상징의 속. `none` 은 오행을 모를 때'),
    constant('TONE_DARK', tonesOf(tokens.dark), '어두운 화면의 오행 — 앱은 아직 안 쓴다'),
    constant('ELEVATION', elevationsOf(tokens.light), '그림자 다섯 단 — 웹 문법 글자 그대로. React Native 의 `boxShadow` 가 받는다'),
    constant('ELEVATION_DARK', elevationsOf(tokens.dark), '어두운 화면의 그림자 — 앱은 아직 안 쓴다'),
    constant('TEXT', numbers(tokens.text), '글자 크기의 단(px)'),
    constant('RADIUS', { ...numbers(tokens.radius), pill: tokens.pill }, '모서리 세 단(px) — 카드 · 칸 · 알약'),
    constant('SPACE', tokens.space, '간격의 단(px)'),
  ].join('\n');
}

export function generated() {
  const tokens = JSON.parse(readFileSync(join(ROOT, 'src/lib/design/tokens.json'), 'utf8'));
  return {
    [CSS_PATH]: regionsInto(readFileSync(join(ROOT, CSS_PATH), 'utf8'), tokens),
    [TS_PATH]: typescriptOf(tokens),
  };
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const check = process.argv.includes('--check');
  let stale = false;
  for (const [path, body] of Object.entries(generated())) {
    let current = '';
    try {
      current = readFileSync(join(ROOT, path), 'utf8');
    } catch {}
    if (current === body) continue;
    if (check) {
      console.error(`${path} 이 원본과 어긋난다 — node scripts/design-tokens.mjs 를 돈다`);
      stale = true;
    } else {
      writeFileSync(join(ROOT, path), body);
      console.log(`${path} 를 지었다`);
    }
  }
  if (stale) process.exit(1);
}
