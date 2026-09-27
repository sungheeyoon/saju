import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ICON_BUTTON, ICON_BUTTON_ACTIVE } from './buttons';

function screens(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return screens(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('아이콘 단추의 색', () => {
  /**
   * 흰 단추 뒤에 `bg-accent text-on-accent` 를 덧붙이면 면은 `bg-surface` 가, 그림은 `text-on-accent` 가 이겨 소식 종이
   * 흰 면에 흰 그림으로 사라졌다(2026-09-27). 이긴 쪽은 클래스 순서가 아니라 CSS 안의 순서가 정한다.
   */
  it('ICON_BUTTON 뒤에 면 색을 덧붙이는 화면이 없다 — 켜진 모양은 ICON_BUTTON_ACTIVE 다', () => {
    const offenders = screens('app').filter((path) => /\$\{ICON_BUTTON\}[^`]*\bbg-/.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('켜진 모양은 흰 면을 들지 않는다', () => {
    const classes = (value: string) => value.split(/\s+/);
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('bg-surface');
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('text-foreground');
    expect(classes(ICON_BUTTON_ACTIVE)).not.toContain('ring-border');
    expect(classes(ICON_BUTTON)).not.toContain('bg-accent');
    expect(classes(ICON_BUTTON)).not.toContain('text-on-accent');
  });
});
