import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** `app.json` 은 토큰을 못 읽어 색을 글자로 든다 — 어긋나면 아이콘 판과 화면 바탕이 갈린다(`mobile/scripts/brand-icons.mjs`) */
const ROOT = join(__dirname, '..');
const { expo } = JSON.parse(readFileSync(join(ROOT, 'mobile/app.json'), 'utf8'));
const tokens = readFileSync(join(ROOT, 'mobile/src/ui/tokens.ts'), 'utf8');
const token = (name: string) => tokens.match(new RegExp(`\\b${name}: '(#[0-9a-f]{6})'`))?.[1];
const pluginOptions = (name: string) => expo.plugins.find((entry: unknown) => Array.isArray(entry) && entry[0] === name)[1];

describe('앱의 아이콘 · 스플래시', () => {
  it('바탕색이 토큰과 같다 — 아이콘은 웹 로고의 종이 판, 스플래시는 첫 화면', () => {
    expect(expo.android.adaptiveIcon.backgroundColor).toBe(token('cream'));
    expect(readFileSync(join(ROOT, 'app/icon.svg'), 'utf8')).toContain(`.paper { fill: ${token('cream')}; }`);
    expect(pluginOptions('expo-splash-screen').backgroundColor).toBe(token('background'));
  });

  it('가리킨 그림이 모두 있다', () => {
    const { foregroundImage, backgroundImage, monochromeImage } = expo.android.adaptiveIcon;
    const images = [expo.icon, foregroundImage, backgroundImage, monochromeImage, expo.web.favicon, pluginOptions('expo-splash-screen').image];
    for (const image of images) expect(existsSync(join(ROOT, 'mobile', image)), image).toBe(true);
  });
});
