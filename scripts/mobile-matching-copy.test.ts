import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 인연 화면의 짧은 말은 웹의 글자 그대로다.**
 *
 * 판정과 긴 문장은 `src/lib/matching` · `src/lib/consent` 를 함께 쓴다. 단추 이름 같은 짧은 말은 두 화면의 코드에 각자 선다 —
 * 앱의 글자가 웹 코드에 그대로 있는지 여기서 잰다. 웹에서 글자를 고치면 이 시험이 앱 쪽 옛 글자를 이름으로 댄다.
 *
 * **고지 문장은 상수 그대로다** — 요청 · 수락 · 거절 · 차단의 글자를 앱이 손으로 적지 않는 것도 여기서 잰다(사용자 약속이다).
 */
const ROOT = join(import.meta.dirname, '..');

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const sourcesIn = (dir: string, ending: RegExp) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((name) => ending.test(name))
    .map((name) => ({ name: `${dir}/${name}`, text: read(`${dir}/${name}`) }));

const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const flat = (text: string) => text.replace(/\s+/g, ' ');

/** 한글로 시작해 따옴표 · 중괄호 · 꺾쇠 · 줄바꿈 앞까지 — 글자 조각 하나 */
const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)].map((match) => match[0].trim());

const web = flat(
  [
    ...sourcesIn('app/me/matching', /\.tsx?$/),
    ...sourcesIn('app/me/requests', /\.tsx?$/),
    ...sourcesIn('app/me/match', /\.tsx?$/),
    ...sourcesIn('app/me/discovery', /\.tsx?$/),
    ...sourcesIn('src/lib/matching', /\.ts$/),
    ...['app/me/partner-sheet.tsx', 'app/compat-view.tsx', 'app/ui/failure-line.tsx', 'app/ui/confirm-dialog.tsx', 'app/ui/sheet.tsx', 'app/service-features.ts', 'app/me/candidates.ts', 'app/me/discovery/actions.ts'].map((file) => ({
      name: file,
      text: read(file),
    })),
  ]
    .map((source) => source.text)
    .join('\n'),
);

/** 웹 코드에 글자로 없는 것 — 까닭을 적는다. 늘리지 않는다 */
const APP_ONLY = new Set([
  /* 앱에 빌드 설정이 없을 때의 말 — 가입 화면(`mobile/src/auth/signup.ts`)과 같은 글자다. 웹에는 이 자리가 없다 */
  '이 빌드에서는 로그인할 수 없어요.',
  /* 부름이 던졌을 때 — 원문을 안 세우는 대신이다. 웹은 같은 자리에서 `FEEDBACK_UNEXPECTED_NOTE` 나 일반 문장을 쓴다 */
  '잠시 뒤 다시 시도해 주세요.',
  /* 머리의 ← 를 읽는 이름 — 웹은 온 곳의 이름을 읽는다. 앱은 스택의 앞 화면으로 간다 */
  '뒤로',
]);

const screens = [...sourcesIn('mobile/src/matching', /\.tsx?$/), ...['mobile/src/app/me/matching/index.tsx', 'mobile/src/app/me/matching/history.tsx', 'mobile/src/app/me/requests.tsx', 'mobile/src/app/me/discovery.tsx', 'mobile/src/app/me/match/[matchId].tsx', 'mobile/src/ui/sheet.tsx'].map((file) => ({ name: file, text: read(file) }))];

describe('앱 인연 화면의 글자', () => {
  for (const { name, text } of screens) {
    it(`${name} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(text).filter((chunk) => !web.includes(flat(chunk)) && !APP_ONLY.has(chunk));
      expect(strays).toEqual([]);
    });
  }

  it('고지 문장은 앱이 손으로 적지 않고 상수로 읽는다', () => {
    const all = screens.map((one) => withoutComments(one.text)).join('\n');
    for (const name of ['MATCH_ACCEPT_HEAD', 'MATCH_ACCEPT_OPENS', 'MATCH_ACCEPT_HIDDEN', 'REJECTION_IS_FINAL_NOTE', 'BLOCK_NOTE', 'BLOCK_KEEPS_NOTE', 'BLOCK_FINAL_NOTE', 'REPORT_NOTE', 'REPORT_DONE', 'REQUEST_RESERVES_NOTE']) {
      expect(all, name).toContain(name);
    }
    for (const line of ['서로의 사주팔자 여덟 글자가 공개돼요', '정확한 생년월일시 · 출생지는 공개되지 않아요', '차단은 되돌릴 수 없어요', '돌려드려요.\'']) {
      expect(all, line).not.toContain(line);
    }
  });
});
