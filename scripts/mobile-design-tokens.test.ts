import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUTTON, BUTTON_PRIMARY_OFF, CELL, COLOR, FIELD, RADIUS, SURFACE, TEXT } from '../src/lib/design';

/**
 * **앱의 면 · 칸 · 단추 값이 웹 상수와 같다**(ADR 0109 추기 2026-10-31). 토큰은 한 원본에서 나지만(`design-tokens.test.ts`) 면은 웹이 클래스 글자로 든다 —
 * 그 글자를 값으로 풀어 `src/lib/design/parts.ts` 와 견준다. 웹 상수를 고치면 여기가 붉어져 앱이 따라간다.
 */
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const css = read('app/globals.css');
const camel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
const elevation = Object.fromEntries([...css.slice(0, css.indexOf('@media (prefers-color-scheme: dark)')).matchAll(/--elevation-([a-z]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]));

/** 웹 상수의 글자 — `${}` 는 같은 파일의 상수로 푼다 */
function classesOf(path: string, name: string): string {
  const body = read(path).match(new RegExp(`(?:export )?const ${name} =\\s*([\`'])([\\s\\S]*?)\\1;`))?.[2];
  if (body === undefined) throw new Error(`${path} 에 ${name} 이 없다`);
  return body.replace(/\$\{(\w+)\}/g, (_, inner: string) => classesOf(path, inner));
}

const step = (value: string) => Number(value) * 4;
const COLORS: Record<string, string | undefined> = COLOR;
const RADII: Record<string, number> = { card: RADIUS.card, cell: RADIUS.cell, full: RADIUS.pill };
const SIZES: Record<string, number | undefined> = { ...TEXT, sm: 14 };

/** 앱에 옮기는 클래스만 값으로 푼다 — 나머지(배치 · 올림 · 초점 · `sm:` 같은 변형)는 앱의 몫이 아니라 건너뛴다 */
function styleOf(classes: string): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  for (const name of classes.split(/\s+/).filter((one) => one !== '' && !one.includes(':'))) {
    const color = (prefix: string) => (name.startsWith(prefix) ? COLORS[camel(name.slice(prefix.length))] : undefined);
    const number = (prefix: string) => (new RegExp(`^${prefix}-[\\d.]+$`).test(name) ? step(name.slice(prefix.length + 1)) : undefined);
    if (/^rounded-(card|cell|full)$/.test(name)) style.borderRadius = RADII[name.slice('rounded-'.length)];
    else if (name === 'border' || name === 'ring-1') style.borderWidth = 1;
    else if (name === 'border-2') style.borderWidth = 2;
    else if (name === 'border-y') Object.assign(style, { borderTopWidth: 1, borderBottomWidth: 1 });
    else if (name === 'border-dashed') style.borderStyle = 'dashed';
    else if (color('border-') ?? color('ring-')) style.borderColor = color('border-') ?? color('ring-');
    else if (color('bg-')) style.backgroundColor = color('bg-');
    else if (color('text-')) style.color = color('text-');
    else if (name.startsWith('text-') && SIZES[name.slice(5)] !== undefined) style.fontSize = SIZES[name.slice(5)];
    else if (number('p') !== undefined) style.padding = number('p');
    else if (number('px') !== undefined) style.paddingHorizontal = number('px');
    else if (number('py') !== undefined) style.paddingVertical = number('py');
    else if (number('min-h') !== undefined) style.minHeight = number('min-h');
    else if (number('size') !== undefined) Object.assign(style, { width: number('size'), height: number('size') });
    else if (name.startsWith('shadow-') && elevation[name.slice(7)] !== undefined) style.boxShadow = elevation[name.slice(7)];
    else if (name === 'overflow-hidden') style.overflow = 'hidden';
  }
  return style;
}

describe('면 · 칸 · 단추의 값', () => {
  it.each(Object.entries(SURFACE))('%s 가 `surfaces.ts` 의 같은 이름과 같다', (name, value) => {
    // 글자색은 면의 값이 아니다 — 앱은 `Text` 가 든다
    const face = styleOf(classesOf('app/ui/surfaces.ts', name));
    delete face.color;
    expect(value).toEqual(face);
  });

  it.each(Object.entries(BUTTON))('%s 가 `buttons.ts` 의 같은 이름과 같다', (name, value) => {
    expect(value).toEqual(styleOf(classesOf('app/ui/buttons.ts', name)));
  });

  it('글 칸은 `FIELD` 와, 칸의 기본 면은 웹의 `rounded-cell bg-surface-soft p-3` 와 같다', () => {
    expect(FIELD).toEqual(styleOf(classesOf('app/ui/fields.ts', 'FIELD')));
    expect(CELL).toEqual(styleOf('rounded-cell bg-surface-soft p-3'));
    expect(read('app/ui/surfaces.ts')).toContain('rounded-cell');
  });

  it('주 단추의 못 누름은 웹의 `PRIMARY_OFF` 다', () => {
    const off = classesOf('app/ui/buttons.ts', 'PRIMARY_OFF');
    for (const name of ['disabled:bg-surface-sunken', 'disabled:text-muted', 'disabled:shadow-none']) expect(off).toContain(name);
    expect(BUTTON_PRIMARY_OFF).toEqual({ backgroundColor: COLOR.surfaceSunken, color: COLOR.muted });
  });
});

describe('앱이 값을 베끼지 않는다', () => {
  it('`mobile/src/ui/tokens.ts` 에 색 글자가 하나뿐이다 — 웹에 토큰이 없는 `border-warning/25`', () => {
    const tokens = read('mobile/src/ui/tokens.ts');
    expect(tokens.match(/#[0-9a-f]{6}|rgba\(/g)).toEqual(['rgba(']);
    expect(tokens).toContain("from '@design'");
  });
});
