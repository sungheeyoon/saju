import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **화면 안 실패 줄은 `FailureLine` 하나다**(`app/ui/failure-line.tsx`, ADR 0164 「덧」).
 *
 * `role="alert"` 를 손으로 적은 자리는 아래 목록뿐이다 — 까닭이 있어 부품 밖에 남은 것. 목록 밖에서 새로 적거나 적힌 수를 넘으면 붉다. 부품 밖의 붉은 글씨는 `FAILURE_TEXT` 를 든다.
 */

const KEPT: Readonly<Record<string, { count: number; why: string }>> = {
  'app/error-screen.tsx': { count: 1, why: '화면 전체의 오류 경계 — 화면 안의 줄이 아니다' },
  'app/pair-taste.tsx': { count: 1, why: '누른 단추 곁의 빈 칸 안내 — 단추가 aria-describedby 로 가리킨다' },
  'app/saju-calculator.tsx': {
    count: 2,
    why: '단추 곁의 빈 칸 안내 · 계산이 거절한 입력을 결과 자리에 세우는 카드(고칠 입력을 말한다)',
  },
  'app/me/compat/screen.tsx': { count: 1, why: '같은 사람을 둘 고른 것을 결과 자리에 세우는 카드 — 고를 것을 말한다' },
  'app/signup/form.tsx': { count: 4, why: '칸 곁의 거절 · 검증 문장 — 칸이 aria-describedby 로 가리킨다' },
  /* 옮길 자리인데 다른 작업이 맡았다 — 줄어들기만 한다 */
  'app/me/chat/composer.tsx': { count: 1, why: '채팅 작업이 맡은 파일 — 옮길 자리(ADR 0164 「덧」)' },
};

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return entry.endsWith('.tsx') && !entry.endsWith('.test.tsx') ? [path] : [];
  });
}

const asPosix = (path: string) => relative(process.cwd(), path).split(sep).join('/');

function alertsByFile(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const path of tsxFiles('app')) {
    const file = asPosix(path);
    if (file === 'app/ui/failure-line.tsx') continue;
    const count = (readFileSync(path, 'utf8').match(/role="alert"/g) ?? []).length;
    if (count > 0) found[file] = count;
  }
  return found;
}

describe('화면 안 실패 줄', () => {
  it('부품 밖의 role="alert" 는 까닭이 적힌 자리뿐이다', () => {
    const found = alertsByFile();
    const stray = Object.keys(found).filter((file) => !(file in KEPT));
    expect(stray).toEqual([]);
  });

  it('남긴 자리는 적힌 수를 넘지 않는다 — 줄어들기만 한다', () => {
    const found = alertsByFile();
    const over = Object.entries(KEPT).filter(([file, { count }]) => (found[file] ?? 0) > count);
    expect(over.map(([file]) => file)).toEqual([]);
  });
});
