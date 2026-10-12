import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * **app 쪽 시험이 소스를 훑는 자리** — 경계 시험 · 화면 훑기가 저마다 적던 재귀 탐색을 한 벌로 모았다. 화면이 부르지 않는다.
 * `app/ui` 에 사는 까닭은 공용 부품의 시험(`fields` · `buttons`)도 이것을 부르는데, 그 폴더는 app 안에서 제 폴더만 알기 때문이다.
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
