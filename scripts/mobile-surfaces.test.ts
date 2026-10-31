import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SURFACE_EXCEPTIONS } from '../src/lib/design/contract';

/**
 * **앱의 면은 `mobile/src/ui/` 의 부품으로만 선다**(ADR 0109 추기 2026-10-31). 운영자가 「카드가 화면마다 살짝씩 다르다」고 짚었다 — 면을 손으로 쓰는 길을
 * 닫는다. 값(카드 모서리 · 그림자)을 화면이 직접 들면 붉다. 칸(`RADIUS.cell`) · 알약(`RADIUS.pill`)은 면이 아니라 허락한다. 예외는 `SURFACE_EXCEPTIONS` 의 표다 —
 * 사유 없이 늘지 않고, 그 자리가 사라지면 표의 줄도 지운다. CI 에 앱 패키지가 없어 글자로 읽는다.
 */
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'mobile', 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** 면을 손으로 쓰는 글자 — 표기가 달라도(별칭 · 값 · 네 귀퉁이) 걸린다 */
const HAND_MADE: readonly { what: string; pattern: RegExp }[] = [
  { what: '모서리 날값', pattern: /\bborder(?:Top|Bottom)?(?:Left|Right|Start|End)?Radius:\s*-?[\d.]+/g },
  { what: '카드 모서리를 직접', pattern: /\b(?:RADIUS|DESIGN_RADIUS)\.(?:card|panel|control)\b/g },
  { what: '토큰 이름 바꿔 부르기', pattern: /\bRADIUS as (?!CORNER\b)\w+|\bCORNER\.(?:card|panel|control)\b/g },
  { what: '그림자 직접', pattern: /\bboxShadow:|\bshadow(?:Color|Offset|Opacity|Radius):|\belevation:\s*\d/g },
  { what: '옛 판 `Panel`', pattern: /<Panel(?=[\s>])(?!\s*\|)/g },
];

function handMadeIn(text: string): { what: string; found: string }[] {
  return HAND_MADE.flatMap(({ what, pattern }) => [...text.matchAll(pattern)].map((match) => ({ what, found: match[0] })));
}

const files = walk(SRC)
  .filter((path) => !relative(SRC, path).startsWith('ui/'))
  .map((path) => ({ file: relative(ROOT, path), text: readFileSync(path, 'utf8') }));

describe('앱 화면의 면', () => {
  it('화면 파일을 실제로 읽었다', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('`mobile/src/ui/` 밖에서 면을 손으로 쓰지 않는다 — 예외는 표가 사유와 함께 든다', () => {
    const found = files.flatMap(({ file, text }) =>
      handMadeIn(text)
        .filter(({ found: glyphs }) => !SURFACE_EXCEPTIONS.some((one) => one.file === file && one.found === glyphs))
        .map(({ what, found: glyphs }) => `${file}: ${what} — ${glyphs}`),
    );
    expect(found).toEqual([]);
  });

  it('표의 줄마다 그 자리가 아직 있고 사유가 있다', () => {
    for (const one of SURFACE_EXCEPTIONS) {
      const text = files.find(({ file }) => file === one.file)?.text ?? '';
      expect(text.includes(one.found), `${one.file} 에 ${one.found} 가 없다 — 표의 줄을 지운다`).toBe(true);
      expect(one.why.length, one.file).toBeGreaterThan(0);
    }
  });

  it('판을 잡는 글자가 표기를 달리 써도 걸린다', () => {
    for (const bad of ['borderRadius: 20', 'borderTopLeftRadius: 8', 'borderRadius: RADIUS.card', 'RADIUS as FOO', 'boxShadow: x', 'shadowOpacity: 0.2', 'elevation: 3', '<Panel style={a}>']) {
      expect(handMadeIn(bad), bad).not.toEqual([]);
    }
    for (const fine of ['borderRadius: RADIUS.cell', 'borderRadius: RADIUS.pill']) expect(handMadeIn(fine), fine).toEqual([]);
  });
});
