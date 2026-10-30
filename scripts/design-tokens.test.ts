import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CSS_PATH, generated, regionsInto, TS_PATH, typescriptOf } from './design-tokens.mjs';

/**
 * **토큰은 한 원본에서 난다**(ADR 0109 추기 2026-10-31) — `src/lib/design/tokens.json` 에서 웹 CSS 칸과 앱 값을 짓는다.
 * 지은 것이 원본과 어긋나면 붉다. `fixtures/design-tokens-before.json` 은 옮기기 전 `globals.css` 의 값이다 — 원본으로 옮겨도 웹의 계산된 값이 그대로임을
 * 잰다. 값을 일부러 바꾸는 PR 은 그 파일도 함께 고친다.
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const css = read(CSS_PATH);

const varsOf = (block: string) => Object.fromEntries([...block.matchAll(/^\s*--([a-z-]+):\s*([^;]+);/gm)].map((match) => [match[1], match[2]]));
const without = (values: Record<string, string>, names: string[]) => Object.fromEntries(Object.entries(values).filter(([name]) => !names.includes(name)));
const withPrefix = (values: Record<string, string>, prefix: string) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => name.startsWith(prefix)).map(([name, value]) => [name.slice(prefix.length), value]));

describe('지은 것이 원본과 같다', () => {
  it.each([CSS_PATH, TS_PATH])('%s', (path) => {
    expect(read(path)).toBe((generated() as Record<string, string>)[path]);
  });

  it('칸이 없으면 지으려다 붉다 — 칸 밖으로 토큰이 새지 않는다', () => {
    expect(() => regionsInto('body {}', { light: {}, dark: {}, text: {}, radius: {} })).toThrow(/design-tokens:light/);
  });

  it('원본을 고치면 두 산출물이 함께 바뀐다', () => {
    const tokens = JSON.parse(read('src/lib/design/tokens.json'));
    tokens.light.surface = '#000001';
    expect(regionsInto(css, tokens)).toContain('--surface: #000001;');
    expect(typescriptOf(tokens)).toContain('"surface": "#000001"');
  });
});

describe('옮겨도 웹의 값이 그대로다', () => {
  const before = JSON.parse(read('scripts/fixtures/design-tokens-before.json'));
  const light = css.slice(css.indexOf(':root {'), css.indexOf('@media (prefers-color-scheme: dark)'));
  const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('@theme inline'));
  const theme = varsOf(css.slice(css.indexOf('@theme inline'), css.indexOf('.tone-wood')));

  it('밝은 화면 · 어두운 화면의 변수 전부 — 이름 · 값 · 차례', () => {
    expect(Object.entries(without(varsOf(light), ['font-system', 'font-app']))).toEqual(Object.entries(before.light));
    expect(Object.entries(varsOf(dark))).toEqual(Object.entries(before.dark));
  });

  it('글자 크기 · 모서리의 단', () => {
    expect(withPrefix(theme, 'text-')).toEqual(before.text);
    expect(withPrefix(theme, 'radius-')).toEqual(before.radius);
  });

  it('Tailwind 의 색 이름이 지은 값의 이름과 같다 — 앱과 웹이 같은 낱말로 부른다', () => {
    const colors = Object.keys(withPrefix(theme, 'color-')).map((name) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()));
    const generatedColors = [...read(TS_PATH).split('export const COLOR_DARK')[0].matchAll(/^ {2}"(\w+)":/gm)].map((match) => match[1]);
    const tones = /^(wood|fire|earth|metal|water)(Soft)?$/;
    expect(generatedColors.sort()).toEqual(colors.filter((name) => !tones.test(name)).sort());
  });
});
