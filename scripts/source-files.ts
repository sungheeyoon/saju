import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * **scripts 쪽 시험이 저장소를 훑는 자리** — 층 · 코드 규칙 · CI 계획 · 비밀 시험이 저마다 적던 재귀 탐색을 한 벌로 모았다(G-109).
 * app 쪽 시험은 `app/ui/source-files.ts` 를 부른다 — `scripts` 는 `app` 을 모르고(`scripts/layers.test.ts`), 앱도 `scripts` 를 안 부르므로 두 벌이다.
 */

/** 읽는 확장자 — `eslint.config.mjs` 의 glob 과 같은 목록이다. `tsconfig` 가 `.mts` 를 포함한다 */
export const SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** `root` 아래의 파일 전부(절대 경로면 절대 경로로) — `node_modules` 와 점으로 시작하는 이름은 건너뛴다. 거르기는 부르는 쪽이 한다 */
export function filesUnder(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    const path = join(root, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** `root` 아래의 소스 파일 — `SOURCE_EXTENSIONS` 이고 선언 파일(`.d.ts`)이 아닌 것 */
export const sourceFilesUnder = (root: string): string[] =>
  filesUnder(root).filter((file) => SOURCE_EXTENSIONS.includes(extname(file)) && !file.endsWith('.d.ts'));
