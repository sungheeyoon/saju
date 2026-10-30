import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱의 저장한 사람 · 궁합 화면 글자는 웹의 글자 그대로다**(`scripts/mobile-chart-copy.test.ts` 와 같은 잠금).
 *
 * 판정과 긴 문장은 `src/lib` 를 함께 쓴다. 표의 태그 사이에 낀 짧은 말은 두 화면의 코드에 각자 서므로, 앱의 글자가 웹 코드에
 * 그대로 있는지 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const koreanChunks = (text: string) => [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>$\n]*/g)].map((match) => match[0].trim());

const WEB = flat(
  [
    'app/birth-form.tsx',
    'app/person-combobox.tsx',
    'app/relation-choice.tsx',
    'app/same-chart-ask.tsx',
    'app/compat-picker.tsx',
    'app/compat-view.tsx',
    'app/compat/page.tsx',
    'app/compat/archive.tsx',
    'app/between-view.tsx',
    'app/match-index.tsx',
    'app/service-features.ts',
    'app/ui/failure-line.tsx',
    'app/ui/confirm-dialog.tsx',
    'app/me/actions.ts',
    'app/me/edit-input.tsx',
    'app/me/reading-tabs.tsx',
    'app/me/compat/actions.ts',
    'app/me/compat/screen.tsx',
    'app/me/compat/relation-note.tsx',
    'app/me/compat/not-found.tsx',
    'app/me/people/chart-bits.tsx',
    'app/me/people/page.tsx',
    'app/me/people/manage.tsx',
    'app/me/people/person-menu.tsx',
    'app/me/people/finder.tsx',
    'app/me/people/[personId]/page.tsx',
    'app/me/people/[personId]/not-found.tsx',
    'app/me/reading/reading-result.tsx',
    'app/me/chat/[matchId]/room-compat.ts',
    'src/lib/chat/room/compat.ts',
    'app/me/match/screen.tsx',
    'src/lib/input/query.ts',
    'mobile/src/app/index.tsx',
  ]
    .map(read)
    .join('\n'),
);

const screens = [
  ...['mobile/src/people', 'mobile/src/compat', 'mobile/src/app/me/people', 'mobile/src/app/me/compat'].flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => `${dir}/${name}`),
  ),
];

describe('앱 저장한 사람 · 궁합 화면의 글자', () => {
  it('화면 파일을 찾았다', () => {
    expect(screens.length).toBeGreaterThan(8);
  });

  for (const file of screens) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(read(file)).filter((chunk) => !WEB.includes(flat(chunk)));
      expect(strays).toEqual([]);
    });
  }
});
