import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 채팅 화면의 짧은 말은 웹의 글자 그대로다.**
 *
 * 문구는 `src/lib/chat` · `src/lib/account` · `src/lib/consent` 의 상수를 함께 쓴다. 단추 이름 같은 짧은 말은 두 화면의 코드에 각자 선다 — 앱의 글자가 웹 코드에
 * 그대로 있는지 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');

const filesUnder = (dir: string): string[] =>
  readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(ROOT, path)).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const flat = (text: string) => text.replace(/\s+/g, ' ');

const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

describe('앱 채팅 화면의 글자', () => {
  const web = flat(
    [
      ...filesUnder('app/me/chat'),
      ...filesUnder('src/lib/chat'),
      'app/me/requests/report-block.tsx',
      'app/me/partner-sheet.tsx',
      'app/ui/failure-line.tsx',
      'app/ui/sheet.tsx',
      'app/ui/stem-symbol.tsx',
      'app/ui/confirm-dialog.tsx',
      'app/not-found.tsx',
    ]
      .map((file) => readFileSync(join(ROOT, file), 'utf8'))
      .join('\n'),
  );

  for (const file of [...filesUnder('mobile/src/chat'), ...filesUnder('mobile/src/app/me/chat')]) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(readFileSync(join(ROOT, file), 'utf8')).filter((chunk) => !web.includes(flat(chunk)));
      expect(strays).toEqual([]);
    });
  }
});
