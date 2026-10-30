import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 안내 화면의 짧은 말은 웹의 글자 그대로다.** 긴 글과 법적 글은 `src/lib/brand` · `src/lib/consent` 를 함께 쓰고, 제목 · 단추 같은 짧은 말만
 * 두 화면의 코드에 각자 선다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const koreanChunks = (text: string) => [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

const WEB = flat(
  [
    'app/privacy/page.tsx',
    'app/terms/page.tsx',
    'app/refund/page.tsx',
    'app/about/page.tsx',
    'app/help/page.tsx',
    'app/auth/page.tsx',
    'app/auth/sign-in-button.tsx',
    'app/auth/denied/page.tsx',
    'app/closed/page.tsx',
    /* 약관이 비는 빌드의 한 줄은 오류 화면의 제목이다(대장 02) */
    'app/error-screen.tsx',
  ]
    .map(read)
    .join('\n'),
);

const SCREENS = [
  ...['privacy', 'terms', 'refund', 'about', 'help', 'closed', 'auth/index', 'auth/denied'].map((name) => `mobile/src/app/${name}.tsx`),
  ...readdirSync(join(ROOT, 'mobile/src/info'))
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => `mobile/src/info/${name}`),
];

describe('앱 안내 화면의 글자', () => {
  for (const file of SCREENS) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      expect(koreanChunks(read(file)).filter((chunk) => !WEB.includes(flat(chunk)))).toEqual([]);
    });
  }
});
