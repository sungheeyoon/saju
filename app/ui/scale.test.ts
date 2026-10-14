import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { filesUnder, lengthPx, scaleTokens } from './source-files';

/**
 * **글자 크기 · 모서리는 토큰으로 부른다**(ADR 0109 추기, 2026-10-12). `app/globals.css` 의 `@theme inline` 에 단이 있는
 * 값을 화면이 `text-[13px]` · `rounded-[1.75rem]` 로 다시 적으면 붉다 — `text-small` · `rounded-card` 를 쓴다. 단위만 바꾼
 * 같은 값(`text-[0.8125rem]` = 13px)도 같은 값이다 — rem 으로 적은 같은 px 도 2026-10-14 부터 토큰으로 옮겼다(천장 0).
 * **단에 없는 값은 아래 허용 목록뿐이다**(ADR 0109 추기, 2026-10-14) — 목록 밖의 임의 글자 크기 · 모서리는 붉다.
 *
 * 보는 것: `app/**` 의 `.ts` · `.tsx`(시험 제외). 앞에 변형(`sm:` · `placeholder:`)이 붙어도 같은 클래스다. 모서리는 네 귀
 * 한 벌(`rounded-`)과 한쪽(`rounded-t-` · `rounded-tl-` …)을 함께 본다. 네 귀를 따로 적은 값(`[0.5rem_1.5rem_…]`)은 단이 아니다.
 */

/**
 * **토큰 밖 허용 목록** — 가까운 단과 2px 넘게 떨어지거나(제목 2.25rem), 장식 · 숫자 강조 · 큰 디스플레이 값, 둘레 글자를
 * 따라 크는 `em`, 로고, 등이 각진 책 표지의 네 귀 따로 모서리다. 파일마다 몇 번 적혔는지까지 잰다 — 새 자리는 토큰을 쓰고,
 * 정말 단 밖이어야 하면 여기에 까닭과 함께 더한다. 지운 자리는 여기서도 지운다.
 */
const OUTSIDE_SCALE: { at: string; value: string; n?: number; why: string }[] = [
  { at: 'app/ui/surfaces.ts', value: '2.25rem', why: 'TYPE_DISPLAY 의 넓은 폭 — 2rem · 2.5rem 둘 다 4px 떨어진다' },
  { at: 'app/me/matching/today-card.tsx', value: '2.25rem', why: '오늘의 인연 카드의 별명 — 위와 같은 큰 제목' },
  { at: 'app/me/matching/today-card.tsx', value: '2.75rem', why: '카드의 점수 숫자 강조' },
  { at: 'app/me/matching/today-card.tsx', value: 'min(9rem,18dvh)', why: '사진 없는 카드의 첫 글자 — 화면 높이를 따른다' },
  { at: 'app/me/matching/today-card.tsx', value: '9rem', why: '같은 첫 글자의 넓은 폭' },
  { at: 'app/me/matching/candidate-photo.tsx', value: '1.2em', why: '사진 없는 자리의 첫 글자 — 칸의 글자를 따라 큰다' },
  { at: 'app/me/matching/passed-connections.tsx', value: '3rem', why: '지난 인연 칸의 첫 글자(장식)' },
  { at: 'app/match-index.tsx', value: '3.5rem', why: '궁합 지수 숫자 강조' },
  { at: 'app/saju/pillars.tsx', value: '3.75rem', why: '사주 기둥 글자의 넓은 폭(큰 디스플레이)' },
  { at: 'app/me/reading/panel.tsx', value: '5rem', why: '비유 앞 큰 따옴표(장식)' },
  { at: 'app/me/reading/markdown.tsx', value: '0.9em', why: '풀이 글 안의 코드 — 둘레 글자를 따른다' },
  { at: 'app/ui/logo.tsx', value: '1.3rem', why: '로고의 이름 — 브랜드 그림과 함께 정한다(ADR 0149)' },
  { at: 'app/home-hero.tsx', value: '0.9rem', why: '첫 화면 탭 묶음 — 안의 칸(rounded-xl)을 p-0.5 만큼 감싼다. 같은 값의 기본 단이 없다' },
  { at: 'app/me/(shelf)/readings/shelf.tsx', value: '0.5rem_1.5rem_1.5rem_0.5rem', n: 3, why: '책 표지 — 등만 각지다' },
  { at: 'app/me/(shelf)/readings/shelf.tsx', value: '0.5rem_1.25rem_1.25rem_0.5rem', n: 2, why: '작은 책 표지' },
  { at: 'app/me/(shelf)/loading.tsx', value: '0.5rem_1.5rem_1.5rem_0.5rem', n: 2, why: '책 표지의 뼈대' },
  { at: 'app/me/(home)/loading.tsx', value: '0.5rem_1.25rem_1.25rem_0.5rem', why: '작은 책 표지의 뼈대' },
  { at: 'app/me/(home)/loading.tsx', value: '0.5rem_1.5rem_1.5rem_0.5rem', why: '같은 뼈대의 넓은 폭' },
  { at: 'app/me/matching/history/loading.tsx', value: '0.5rem_1.5rem_1.5rem_0.5rem', n: 2, why: '책 표지의 뼈대' },
];

/** 글자 크기인 임의값 — `text-[var(--ink)]` 같은 색은 뺀다 */
const isSize = (value: string): boolean => /^(?:length:)?(?:\d|\.|min\(|max\(|clamp\(|calc\()/.test(value);

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
    const offenders = sources().flatMap((path) =>
      arbitrary(readFileSync(path, 'utf8'), TEXT_CLASS).flatMap(({ value, whole }) => {
        const px = lengthPx(value);
        const token = px === null ? undefined : TEXT_BY_PX.get(px);
        if (token === undefined) return [];
        return [`${path} — ${whole} → text-${token}`];
      }),
    );
    expect(offenders).toEqual([]);
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

  it('단에 없는 글자 크기 · 모서리는 허용 목록뿐이다', () => {
    const found = sources().flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return [
        ...arbitrary(source, TEXT_CLASS).filter(({ value }) => isSize(value)),
        ...arbitrary(source, RADIUS_CLASS),
      ].map(({ value }) => `${path} — ${value}`);
    });
    const allowed = OUTSIDE_SCALE.flatMap(({ at, value, n = 1 }) => Array.from({ length: n }, () => `${at} — ${value}`));
    expect(found.sort()).toEqual(allowed.sort());
  });

  it('토큰 이름이 색 이름과 겹치지 않는다 — `text-secondary` 는 색이라 크기 토큰이 같은 이름이면 둘 중 하나가 진다', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const colors = new Set([...css.matchAll(/--color-([a-z-]+):/g)].map((match) => match[1]));
    expect(Object.keys(text).filter((name) => colors.has(name))).toEqual([]);
  });
});
