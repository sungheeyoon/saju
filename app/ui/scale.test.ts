import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { filesUnder, lengthPx, scaleTokens } from './source-files';

/**
 * **글자 크기 · 모서리는 토큰으로 부른다**(ADR 0109 추기, 2026-10-12). `app/globals.css` 의 `@theme inline` 에 단이 있는
 * 값을 화면이 `text-[13px]` · `rounded-[1.75rem]` 로 다시 적으면 붉다 — `text-small` · `rounded-card` 를 쓴다. 단위만 바꾼
 * 같은 값(`text-[0.8125rem]` = 13px)도 같은 값이다. 단에 없는 값(`text-[1.3rem]` 같은 이상값)은 이 시험 밖이다 — 옮기면
 * 모양이 바뀌어 그 자리마다 따로 정한다.
 *
 * 보는 것: `app/**` 의 `.ts` · `.tsx`(시험 제외). 앞에 변형(`sm:` · `placeholder:`)이 붙어도 같은 클래스다. 모서리는 네 귀
 * 한 벌(`rounded-`)과 한쪽(`rounded-t-` · `rounded-tl-` …)을 함께 본다. 네 귀를 따로 적은 값(`[0.5rem_1.5rem_…]`)은 단이 아니다.
 */

/**
 * **단과 같은 px 를 rem 으로 적은 자리** — 토큰(px)으로 옮기면 브라우저의 기본 글자 크기를 바꾼 사람에게 크기가 달라져
 * 옮기지 않았다(2026-10-12). 수는 줄기만 한다 — 새 자리는 토큰을 쓴다.
 */
const REM_SPELLINGS: Record<string, number> = { '1.0625rem': 5, '0.9375rem': 1, '1rem': 2 };

const sources = (): string[] =>
  filesUnder('app').filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

const { text, radius } = scaleTokens();

function byPx(tokens: Record<string, string>): Map<number, string> {
  const out = new Map<number, string>();
  for (const [name, value] of Object.entries(tokens)) {
    const px = lengthPx(value);
    if (px !== null) out.set(px, name);
  }
  return out;
}

const TEXT_BY_PX = byPx(text);
const RADIUS_BY_PX = byPx(radius);

/** `source` 의 임의값 클래스 — 앞이 낱말 글자나 `-` 가 아니어야 한다(`leading-[…]` 안의 글자를 잡지 않게) */
function arbitrary(source: string, pattern: RegExp): { value: string; whole: string }[] {
  return [...source.matchAll(pattern)].map((match) => ({ whole: match[0], value: match.at(-1) ?? '' }));
}

const TEXT_CLASS = /(?<![\w-])text-\[([^\]\s]+)\]/g;
const RADIUS_CLASS = /(?<![\w-])rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-\[([^\]\s]+)\]/g;

describe('글자 크기 · 모서리의 단', () => {
  it('토큰이 globals.css 에 서 있다', () => {
    expect(text).toMatchObject({ small: '13px', body: '15px', field: '16px', title: '1.75rem' });
    expect(radius).toMatchObject({ paper: '2rem', card: '1.75rem', tile: '1.5rem', row: '1.25rem' });
  });

  it('단이 있는 글자 크기를 임의값으로 다시 적지 않는다', () => {
    const remSeen: Record<string, number> = {};
    const offenders = sources().flatMap((path) =>
      arbitrary(readFileSync(path, 'utf8'), TEXT_CLASS).flatMap(({ value, whole }) => {
        const px = lengthPx(value);
        const token = px === null ? undefined : TEXT_BY_PX.get(px);
        if (token === undefined) return [];
        if (value in REM_SPELLINGS) {
          remSeen[value] = (remSeen[value] ?? 0) + 1;
          return [];
        }
        return [`${path} — ${whole} → text-${token}`];
      }),
    );
    expect(offenders).toEqual([]);
    for (const [value, count] of Object.entries(remSeen)) expect(count, value).toBeLessThanOrEqual(REM_SPELLINGS[value]);
  });

  it('단이 있는 모서리를 임의값으로 다시 적지 않는다', () => {
    const offenders = sources().flatMap((path) =>
      arbitrary(readFileSync(path, 'utf8'), RADIUS_CLASS).flatMap(({ value, whole }) => {
        const px = lengthPx(value);
        const token = px === null ? undefined : RADIUS_BY_PX.get(px);
        return token === undefined ? [] : [`${path} — ${whole} → rounded-…-${token}`];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('토큰 이름이 색 이름과 겹치지 않는다 — `text-secondary` 는 색이라 크기 토큰이 같은 이름이면 둘 중 하나가 진다', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const colors = new Set([...css.matchAll(/--color-([a-z-]+):/g)].map((match) => match[1]));
    expect(Object.keys(text).filter((name) => colors.has(name))).toEqual([]);
  });
});
