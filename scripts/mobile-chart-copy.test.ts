import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 명식 화면의 짧은 말은 웹의 글자 그대로다.**
 *
 * 문단과 판단은 `src/lib/saju/view` 를 함께 쓴다. 칸 이름 같은 짧은 말은 두 화면의 코드에 각자 선다 — 웹 표의 태그 사이에
 * 끼어 있어 상수로 빼면 표를 읽을 수 없다. 대신 앱의 글자가 웹 코드에 그대로 있는지 여기서 잰다. 웹에서 글자를 고치면
 * 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 */
const ROOT = join(import.meta.dirname, '..');

const sourcesIn = (dir: string, ending: RegExp) =>
  readdirSync(join(ROOT, dir))
    .filter((name) => ending.test(name))
    .map((name) => ({ name: `${dir}/${name}`, text: readFileSync(join(ROOT, dir, name), 'utf8') }));

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** 한글로 시작해 따옴표 · 중괄호 · 꺾쇠 · 줄바꿈 앞까지 — 글자 조각 하나 */
const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

describe('앱 명식 화면의 글자', () => {
  const web = flat(
    [
      ...sourcesIn('app/saju', /\.tsx$/),
      { name: 'app/utterances.tsx', text: readFileSync(join(ROOT, 'app/utterances.tsx'), 'utf8') },
      ...sourcesIn('src/lib/saju/view', /\.ts$/),
    ]
      .map((source) => source.text)
      .join('\n'),
  );

  for (const { name, text } of sourcesIn('mobile/src/chart', /\.tsx$/)) {
    it(`${name} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(text).filter((chunk) => !web.includes(flat(chunk)));
      expect(strays).toEqual([]);
    });
  }
});
