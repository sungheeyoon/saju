import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from '../ui/source-files';

/**
 * **운영자 문의 거절은 `deniedAmong` 하나를 지난다**(ADR 0105 · 0191).
 *
 * 거절 코드(`42501`)를 가르는 글자와 `DENIED` 를 손으로 내는 자리가 `app/ops/denial.ts` 밖에 있으면 붉다 — 새 문이 거절을 알아차리고도
 * 접속기록에 적지 않는 길이 그 둘이다.
 */

const HOME = 'app/ops/denial.ts';

const sources = (): { file: string; text: string }[] =>
  filesUnder('app/ops')
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .map((path) => ({ file: asPosix(path), text: readFileSync(path, 'utf8') }))
    .filter(({ file }) => file !== HOME);

/** 주석은 빼고 잰다 — 문서가 코드를 말하는 것은 막지 않는다 */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('운영자 문의 거절', () => {
  it('거절 코드 42501 을 가르는 글자는 denial.ts 밖에 없다', () => {
    const stray = sources().filter(({ text }) => /['"`]42501['"`]/.test(code(text)));
    expect(stray.map(({ file }) => file)).toEqual([]);
  });

  it('DENIED 를 손으로 내는 자리는 denial.ts 밖에 없다 — 문은 deniedAmong 의 값을 그대로 낸다', () => {
    const stray = sources().filter(({ text }) => /return\s+DENIED\b|['"`]denied['"`]/.test(code(text)));
    expect(stray.map(({ file }) => file)).toEqual([]);
  });
});
