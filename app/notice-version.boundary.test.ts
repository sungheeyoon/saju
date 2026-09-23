import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **안내 판본을 직접 견주는 자리가 있는가**(ADR 0095, G-05).
 *
 * 2026-09-23 에 셋이었다 — 관문(`gate.ts`) · 가입 화면 · 계정 관리가 각자
 * `!== NOTICE_VERSION` 으로 견줬다. 재확인 기준을 판본에서 떼면서 셋을
 * `noticeAckHolds` 하나로 모았다. 넷째가 돌아와 `=== NOTICE_VERSION` 을 적으면 그 화면만
 * 표현을 고친 개정에도 「다시 보여 드립니다」라고 말한다 — 그 줄은 아무 시험에도 안 걸린다.
 *
 * 그래서 원본을 읽어서 잠근다. 재는 것은 계산이 아니라 **배선**이다.
 */

const ROOTS = ['app', 'src', 'proxy.ts'];
const CODE = /\.tsx?$/;

/** 판본을 `===` · `!==` 로 견주는 모양 — 상수든 행의 칸이든 */
const VERSION = String.raw`(?:NOTICE_VERSION|NOTICE_ACK_FLOOR|notice_version|noticeVersion)`;
const COMPARED = new RegExp(String.raw`${VERSION}\s*[!=]==|[!=]==\s*[\w.?]*${VERSION}`);

/** 견주어도 되는 곳 — 판정 그 자체 */
const ALLOWED = new Set(['src/lib/consent/notice.ts']);

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((entry) =>
    entry === 'node_modules' || entry.startsWith('.') ? [] : sourceFiles(join(path, entry)),
  );
}

const files = ROOTS.flatMap(sourceFiles)
  .filter((path) => CODE.test(path) && !path.endsWith('.test.ts'))
  .map((path) => relative('.', path).split(sep).join('/'));

describe('안내 판본을 견주는 자리', () => {
  it('판본을 직접 견주는 자리는 `noticeAckHolds` 하나뿐이다', () => {
    const comparing = files.filter(
      (path) => !ALLOWED.has(path) && COMPARED.test(readFileSync(path, 'utf8')),
    );
    expect(comparing).toEqual([]);
  });

  /** 부재로 통과하지 않게 — 훑는 파일이 실제로 있고, 판정이 그 안에 있다 */
  it('훑는 자리에 관문과 판정이 든다', () => {
    expect(files).toContain('src/lib/consent/gate.ts');
    expect(files).toContain('app/me/settings/page.tsx');
    expect(files).toContain('proxy.ts');
    expect(readFileSync('src/lib/consent/notice.ts', 'utf8')).toContain('noticeAckHolds');
  });
});
