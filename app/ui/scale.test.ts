import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { filesUnder, lengthPx, scaleTokens } from './source-files';
import { BADGE, TYPE_BODY, TYPE_CAPTION, TYPE_META, TYPE_NAME, TYPE_SECTION, TYPE_TITLE } from './surfaces';

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
 * 따라 크는 `em`, 로고다. 책 표지의 네 귀 따로 모서리 · 첫 화면 탭 묶음의 0.9rem 은 모서리 세 단(2026-10-24)으로 걷었다. 파일마다 몇 번 적혔는지까지 잰다 — 새 자리는 토큰을 쓰고,
 * 정말 단 밖이어야 하면 여기에 까닭과 함께 더한다. 지운 자리는 여기서도 지운다.
 */
const OUTSIDE_SCALE: { at: string; value: string; n?: number; why: string }[] = [
  { at: 'app/me/matching/today-card.tsx', value: '2.25rem', why: '오늘의 인연 카드의 별명 — 사진 위의 큰 이름' },
  { at: 'app/me/matching/today-card.tsx', value: '2.75rem', why: '카드의 점수 숫자 강조' },
  { at: 'app/me/matching/today-card.tsx', value: 'min(9rem,18dvh)', why: '사진 없는 카드의 첫 글자 — 화면 높이를 따른다' },
  { at: 'app/me/matching/today-card.tsx', value: '9rem', why: '같은 첫 글자의 넓은 폭' },
  { at: 'app/me/matching/candidate-photo.tsx', value: '1.2em', why: '사진 없는 자리의 첫 글자 — 칸의 글자를 따라 큰다' },
  { at: 'app/me/matching/passed-connections.tsx', value: '3rem', why: '지난 인연 칸의 첫 글자(장식)' },
  { at: 'app/match-index.tsx', value: '3.5rem', why: '궁합 지수 숫자 강조' },
  { at: 'app/saju/pillars.tsx', value: '3.75rem', why: '사주 기둥 글자의 넓은 폭(큰 디스플레이)' },
  { at: 'app/me/reading/reading-result.tsx', value: '5rem', why: '비유 앞 큰 따옴표(장식)' },
  { at: 'app/me/reading/markdown.tsx', value: '0.9em', why: '풀이 글 안의 코드 — 둘레 글자를 따른다' },
  { at: 'app/ui/logo.tsx', value: '1.3rem', why: '로고의 이름 — 브랜드 그림과 함께 정한다(ADR 0149)' },
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
    // 같은 값의 이름이 여럿이면(옛 이름 `paper` = `card`) 먼저 적힌 새 이름을 권한다
    if (px !== null && !out.has(px)) out.set(px, name);
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
    expect(text).toMatchObject({ tag: '11px', fine: '12px', small: '13px', body: '15px', field: '16px', lead: '17px', heading: '20px', title: '26px', display: '30px' });
    expect(radius).toMatchObject({ card: '20px', cell: '12px' });
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

/** 주석을 걷은 소스 — 주석은 옛 값 · 까닭을 이름으로 적는다 */
const code = (path: string): string =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** `pattern` 이 걸린 수를 파일마다 — `{ 'app/x.tsx': 2 }` */
function countBy(pattern: RegExp): Record<string, number> {
  const out: Record<string, number> = {};
  for (const path of sources()) {
    const n = [...code(path).matchAll(pattern)].length;
    if (n > 0) out[path] = n;
  }
  return out;
}

describe('텍스트 스타일 일곱 벌(ADR 0109 추기 2026-10-24)', () => {
  const styles = { TYPE_TITLE, TYPE_SECTION, TYPE_NAME, TYPE_BODY, TYPE_META, TYPE_CAPTION, BADGE };
  const TITLES = { TYPE_TITLE, TYPE_SECTION, TYPE_NAME };
  /** 변형(`lg:`)을 뺀 기본 크기의 px */
  const sizeOf = (style: string, variant = ''): number | null => {
    const name = style
      .split(' ')
      .map((c) => (variant === '' ? (c.includes(':') ? '' : c) : c.startsWith(`${variant}:`) ? c.slice(variant.length + 1) : ''))
      .map((c) => /^text-([a-z]+)$/.exec(c)?.[1])
      .find((n) => n !== undefined && n in text);
    return name === undefined ? null : lengthPx(text[name]);
  };

  it('크기는 화면 제목 → 딱지로 줄곧 작아진다', () => {
    const sizes = Object.values(styles).map((style) => sizeOf(style));
    expect(sizes.every((px) => px !== null)).toBe(true);
    expect(sizes).toEqual([...sizes].sort((a, b) => (b ?? 0) - (a ?? 0)));
    expect(new Set(sizes).size).toBe(sizes.length);
  });

  it('폭마다 크기가 바뀌는 것은 화면 제목의 넓은 화면(lg) 한 단뿐이다 — 운영자 2026-10-24', () => {
    expect(Object.entries(styles).filter(([, style]) => /(?:^|\s)(?:sm|md|lg|xl):text-/.test(style)).map(([name]) => name)).toEqual(['TYPE_TITLE']);
    expect([sizeOf(TYPE_TITLE), sizeOf(TYPE_TITLE, 'lg')]).toEqual([26, 30]);
  });

  it('제목 셋은 고운돋움이고 굵기를 주지 않는다 — 서체 교체는 운영자가 「아직 미적용」으로 보류했다', () => {
    for (const style of Object.values(TITLES)) {
      expect(style).toMatch(/(?:^|\s)font-rounded(?:\s|$)/);
      expect(style).not.toMatch(/(?:^|\s)font-(?:thin|light|normal|medium|semibold|bold|extrabold|black)(?:\s|$)/);
    }
  });

  it('둥근 서체에 굵기를 붙이지 않는다 — 고운돋움은 400 하나뿐이라 브라우저가 획을 덧칠한 가짜 굵기가 선다', () => {
    const offenders = sources().flatMap((path) =>
      [...code(path).matchAll(/['"`]([^'"`]*)['"`]/g)]
        .map((match) => match[1])
        .filter((value) => /(?<![\w-])font-rounded(?![\w-])/.test(value) && /(?<![\w:-])font-(?:medium|semibold|bold|extrabold|black)(?![\w-])/.test(value))
        .map((value) => `${path} — ${value}`),
    );
    expect(offenders).toEqual([]);
  });

  it('옛 이름(표시 단 `TYPE_DISPLAY` · 24px `text-section` · 32px `text-headline`)은 다시 서지 않는다', () => {
    expect(countBy(/(?<![\w-])(?:TYPE_DISPLAY|text-section|text-headline)(?![\w-])/g)).toEqual({});
    expect(Object.keys(text)).not.toContain('section');
    expect(Object.keys(text)).not.toContain('headline');
  });
});

describe('모서리는 카드 · 칸 · 알약 세 단이다(ADR 0109 추기 2026-10-24)', () => {
  const SIDE = '(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?';

  it('Tailwind 의 기본 단(sm · md · lg · xl · 2xl · 3xl · 맨 rounded)을 부르지 않는다 — `rounded-cell` 을 쓴다', () => {
    // 뒤가 `.` 인 것은 JS 이름이다. 예외 하나 — 말풍선의 꼬리 귀(첫 말풍선의 한 귀만 6px)는 모양이지 단이 아니다
    expect(countBy(new RegExp(`(?<![\\w.-])rounded${SIDE}(?:-(?:sm|md|lg|xl|2xl|3xl))?(?![\\w.\\[-])`, 'g'))).toEqual({
      'app/me/chat/[matchId]/bubble-row.tsx': 2,
    });
  });

  it('옛 이름(paper · tile · row)은 걷었다 — 토큰도 소스도 없다', () => {
    expect(Object.keys(radius).sort()).toEqual(['card', 'cell']);
    expect(countBy(new RegExp(`(?<![\\w-])rounded${SIDE}-(?:paper|tile|row)(?![\\w-])`, 'g'))).toEqual({});
  });
});
