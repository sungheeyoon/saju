import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** **앱의 오류 · 없는 주소 화면은 웹의 글자 그대로다** — 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다 */
const ROOT = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const chunks = (text: string) => [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n$]*/g)].map((match) => match[0].trim());

describe.each([
  ['mobile/src/ui/error-screen.tsx', 'app/error-screen.tsx'],
  ['mobile/src/app/+not-found.tsx', 'app/not-found.tsx'],
])('%s', (app, web) => {
  it('글자가 웹과 같다', () => {
    const written = chunks(read(app));
    expect(written.length).toBeGreaterThan(1);
    expect(written.toSorted()).toEqual(chunks(read(web)).toSorted());
  });
});
