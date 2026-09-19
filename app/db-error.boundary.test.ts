import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **영어 원문이 사용자 화면에 서는 길이 있는가** (#67).
 *
 * `userFacingDbMessage` 는 잘 지어졌는데 **두 자리에서만** 불렸다. 나머지 서른 몇 자리가
 * `error.message` 를 그대로 냈고, 그래서 `42883`·`42501`·`PGRST202` 의 영어 원문이 화면에
 * 섰다 — 사용자는 할 수 있는 것이 없고 그 문장은 우리 스키마의 속을 말한다.
 *
 * 고친 뒤에 남는 문제는 **되돌아오는 것**이다. 서버 액션을 새로 하나 쓰면서
 * `if (error) return { ok: false, message: error.message }` 를 적는 것이 가장 짧은 길이고,
 * 그 줄은 아무 시험에도 안 걸린다. 화면에는 글자가 서고, 영어라는 것은 그 오류가 실제로
 * 날 때까지 아무도 모른다.
 *
 * 그래서 원본을 읽어서 잠근다. 이 시험이 재는 것은 계산이 아니라 **배선**이다.
 */

const ROOTS = ['app', 'src'];
const CODE = /\.tsx?$/;

/** 우리가 안 쓴 문장이 사용자에게 가는 모양 — 오류의 `message` 를 직접 집는다 */
const RAW = /\berror\.message\b|\bError\.message\b/;

/**
 * **그대로 집어도 되는 자리와 그 까닭.**
 *
 * 목록이지 예외가 아니다 — 새 파일이 여기 들어오려면 까닭을 적어야 하고, 까닭을 적다 보면
 * 대개 「한 문을 지나면 된다」는 답이 나온다.
 */
const ALLOWED: Readonly<Record<string, string>> = {
  'app/db-error.ts': '한 문 그 자체 — 여기서 가른다',
  'app/db-error.test.ts': '그 문을 재는 시험',
  'app/db-error.boundary.test.ts': '이 시험이 찾는 낱말을 스스로 들고 있다',

  /* 오류 경계 — 여기 닿는 Error 는 이미 한 문을 지나 우리말이다(`dbFailure`) */
  'app/me/page.tsx': '오류 경계 — 던지는 자리가 이미 번역한 Error 를 세운다',
  'app/me/people/[personId]/page.tsx': '오류 경계 — 같다',
  'app/me/requests/page.tsx': '오류 경계 — 같다',

  /* 엔진이 우리말로 내는 오류 — DB 거절이 아니다 */
  'app/birth-form.tsx': 'LunarConversionError — 엔진이 우리말로 낸다',
  'src/lib/input/revision.ts': 'LunarConversionError — 같다',
  'src/lib/input/chart.ts': '명식 계산 실패 — 엔진 오류지 DB 거절이 아니다',
  'app/me/people/page.tsx': 'UnreadableRevisionError — 우리가 우리말로 지은 것',
  'app/me/compat/page.tsx': 'UnreadableRevisionError — 같다',

  /* 사용자 화면이 아닌 자리 */
  'app/me/reading/pipeline.ts': '화면이 아니라 DB 에 적는다(`p_failure_detail`)',
  'app/me/reading/collect.ts': 'webhook 수집기 — 사람이 보는 화면이 없다',
  'app/me/match/inputs.ts': '열쇠 문 — #70 이 이 문을 통째로 지운다',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);

    return CODE.test(entry) ? [path] : [];
  });
}

/** 저장소 어디서든 같은 이름으로 부르게 — 윈도우의 `\` 가 비교를 조용히 깨뜨린다 */
const asPosix = (path: string) => relative(process.cwd(), path).split(sep).join('/');

describe('DB 거절은 한 문을 지난다', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
    path: asPosix(path),
    text: readFileSync(path, 'utf8'),
  }));

  it('오류 원문을 직접 집는 파일은 까닭이 적힌 것들뿐이다', () => {
    const raw = files
      .filter(({ text }) => RAW.test(text))
      .map(({ path }) => path)
      .sort();

    expect(raw).toEqual(Object.keys(ALLOWED).sort());
  });

  /**
   * **목록이 실물보다 오래 살지 않게.** 지워진 파일 이름이 남아 있으면 그 줄은 아무것도
   * 안 잠그면서 잠그는 것처럼 읽힌다.
   */
  it('까닭이 적힌 파일은 다 실재한다', () => {
    const present = new Set(files.map(({ path }) => path));

    expect(Object.keys(ALLOWED).filter((path) => !present.has(path))).toEqual([]);
  });

  /**
   * **서버 액션은 하나도 없다.** 위 목록이 길어지는 것 자체는 막지 않지만, 사용자가 누른
   * 결과로 도는 자리가 거기 끼면 그것은 곧 화면에 서는 글자다.
   */
  it('사용자가 누르는 자리는 목록에 없다', () => {
    const actions = Object.keys(ALLOWED).filter((path) => path.endsWith('actions.ts'));

    expect(actions).toEqual([]);
  });
});
