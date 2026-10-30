import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 풀이 화면의 짧은 말은 웹의 글자 그대로다**(`scripts/mobile-chart-copy.test.ts` 와 같은 잠금).
 *
 * 긴 안내는 `src/lib/reading/notes.ts` 를 함께 쓴다. 칸 안의 짧은 말은 두 화면의 코드에 각자 선다 — 앱의 글자가 웹 코드에 그대로 있는지
 * 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const inDir = (dir: string, ending: RegExp) =>
  readdirSync(join(ROOT, dir))
    .filter((name) => ending.test(name))
    .map((name) => `${dir}/${name}`);

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** 한글로 시작해 따옴표 · 중괄호 · 꺾쇠 · 줄바꿈 앞까지 — 글자 조각 하나 */
const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

describe('앱 풀이 화면의 글자', () => {
  const web = flat(
    [
      ...inDir('app/me/reading', /\.tsx$/),
      ...inDir('app/me/(shelf)/readings', /\.tsx?$/),
      'app/me/(shelf)/readings/[subject]/page.tsx',
      'app/me/reading/share.ts',
      'app/came-from.ts',
      'app/not-found.tsx',
      'app/person-combobox.tsx',
      'app/service-features.ts',
      'app/ui/failure-line.tsx',
      'src/lib/home/making.ts',
      'app/ui/confirm-dialog.tsx',
      'app/save-for-reading.tsx',
      'src/lib/account/index.ts',
    ]
      .map(read)
      .join('\n'),
  );

  const screens = [
    ...inDir('mobile/src/reading', /\.tsx?$/),
    'mobile/src/app/me/readings/index.tsx',
    'mobile/src/app/me/readings/[subject].tsx',
  ];

  for (const screen of screens) {
    it(`${screen} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(read(screen)).filter((chunk) => !web.includes(flat(chunk)));
      expect(strays).toEqual([]);
    });
  }
});
