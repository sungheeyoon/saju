import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * **app 쪽 시험이 소스를 훑는 자리** — 경계 시험 · 화면 훑기가 저마다 적던 재귀 탐색을 한 벌로 모았다. 화면이 부르지 않는다.
 * `app/ui` 에 사는 까닭은 공용 부품의 시험(`fields` · `buttons` · `scale`)도 이것을 부르는데, 그 폴더는 app 안에서 제 폴더만 알기 때문이다.
 */

/** `root` 아래의 파일 전부 — `root` 가 파일이면 그 하나. `node_modules` 와 점으로 시작하는 이름은 건너뛴다. 거르기는 부르는 쪽이 한다 */
export function filesUnder(root: string): string[] {
  if (!statSync(root).isDirectory()) return [root];
  return readdirSync(root).flatMap((entry) =>
    entry === 'node_modules' || entry.startsWith('.') ? [] : filesUnder(join(root, entry)),
  );
}

/** 저장소 어디서든 같은 이름으로 부르게 — 윈도우의 `\` 가 비교를 조용히 깨뜨린다 */
export const asPosix = (path: string, from: string = process.cwd()): string => relative(from, path).split(sep).join('/');

/**
 * **디자인 체계의 단** — `app/globals.css` 의 `@theme inline` 안에 적힌 글자 크기(`--text-*`) · 모서리(`--radius-*`) 토큰.
 * 이름 → 적힌 값(`13px` · `1.75rem`). 잠금(`scale.test.ts`)과 입력 칸 시험(`fields.test.ts`)이 함께 읽는다.
 */
export function scaleTokens(css: string = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')): {
  text: Record<string, string>;
  radius: Record<string, string>;
} {
  const theme = /@theme inline\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const pick = (prefix: string): Record<string, string> =>
    Object.fromEntries(
      [...theme.matchAll(new RegExp(`--${prefix}-([a-z-]+):\\s*([^;]+);`, 'g'))].map(([, name, value]) => [name, value.trim()]),
    );
  return { text: pick('text'), radius: pick('radius') };
}

/** `13px` · `0.8125rem` 을 px 수로 — 뿌리 글자 크기를 바꾸지 않으므로 1rem 은 16px 다. 길이 하나가 아니면 null */
export function lengthPx(value: string): number | null {
  const match = /^(\d*\.?\d+)(px|rem)$/.exec(value);
  if (match === null) return null;
  return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}
