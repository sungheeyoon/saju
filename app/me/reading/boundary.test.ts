import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **사용자 화면에 근거 절이 새지 않는가.**
 *
 * 저장된 원문 뒤에는 절마다 한 줄씩 「어디서 온 말인가」가 붙는다. 그것은 되짚으려고
 * 만든 값이지 상품이 아니다 — 경로 이름과 `[사실]` 딱지는 읽는 사람에게 기계 부스러기다.
 *
 * 지금 그것을 막는 것은 **한 줄**이다. `currentReading` 이 서버 경계에서 `readingBody`
 * 로 잘라 내고, 그 함수가 사용자 화면에 결과를 먹이는 유일한 자리다. 그래서 근거 절은
 * 브라우저까지 내려가지도 않는다.
 *
 * 그런데 그 옆에 **안 자른 것을 주는 함수**가 나란히 선다(`readingGroundingOf`).
 * 되짚는 화면이 읽어야 해서 있는 것인데, 나란히 있는 한 나중에 화면을 만드는 사람이
 * 옆의 것을 집어 갈 수 있다. 파일 주석에 「한 함수가 두 벌을 다 내주면 언젠가 사용자
 * 화면이 그 값을 세운다」고 적어 두었지만, **주석이 잠그는 것은 아무것도 잠그지 않는다.**
 *
 * 그래서 원본을 읽어서 잠근다. 이 시험이 재는 것은 계산이 아니라 **배선**이다 —
 * 안 자른 쪽을 부르는 파일이 되짚는 화면 하나뿐인가.
 */

const ROOTS = ['app', 'src'];
const CODE = /\.tsx?$/;

/** 되짚는 화면 하나만 안 자른 쪽을 읽는다 */
const ALLOWED = 'app/me/reading/inspect/page.tsx';

/** 함수가 사는 곳 — 정의는 당연히 자기 이름을 들고 있다 */
const DEFINITION = 'app/me/reading/current.ts';

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

describe('되짚기용 값이 사용자 화면으로 새지 않는다', () => {
  const files = ROOTS.flatMap((root) => sourceFiles(root)).map((path) => ({
    path: asPosix(path),
    text: readFileSync(path, 'utf8'),
  }));

  it('안 자른 근거를 읽는 곳은 되짚는 화면 하나뿐이다', () => {
    const callers = files
      .filter(({ path }) => path !== DEFINITION && !path.endsWith('boundary.test.ts'))
      .filter(({ text }) => text.includes('readingGroundingOf'))
      .map(({ path }) => path);

    expect(callers).toEqual([ALLOWED]);
  });

  /**
   * **자르지 않은 원문을 그대로 내주는 자리가 생기면 여기서 걸린다.**
   *
   * 위의 시험은 지금 있는 함수 하나를 잡는다. 이것은 그 함수를 안 거치고 RPC 의
   * `output` 을 통째로 들고 나가는 새 길을 잡는다 — 이름을 바꿔 우회하는 쪽이
   * 실제로는 더 흔하다.
   */
  it('사용자 화면용 값은 반드시 자르는 함수를 거친다', () => {
    const current = files.find(({ path }) => path === DEFINITION);
    expect(current, `${DEFINITION} 를 찾지 못했다`).toBeDefined();

    const raw = current!.text.match(/row\.output as string/g) ?? [];
    const cut = current!.text.match(/reading(?:Body|Grounding)\(row\.output as string\)/g) ?? [];

    // 원문을 읽는 자리마다 자르는 함수가 하나씩 감싸고 있어야 한다
    expect(cut.length).toBe(raw.length);
    expect(raw.length).toBeGreaterThan(0);
  });

  /**
   * 사용자에게 나가는 화면이 근거 절의 머리말을 **문자열로 들고 있지 않은가.**
   *
   * 들고 있다면 그 화면은 근거 절을 알아보려 하고 있다는 뜻이고, 알아보려 한다는 것은
   * 언젠가 세우려 한다는 뜻이다. 자르는 규칙은 한 자리에만 있어야 한다.
   */
  it('사용자 화면이 근거 절 머리말을 직접 알지 않는다', () => {
    const knowing = files
      .filter(({ path }) => path.startsWith('app/'))
      .filter(({ path }) => !path.startsWith('app/me/reading/'))
      .filter(({ text }) => text.includes('### 근거'))
      .map(({ path }) => path);

    expect(knowing).toEqual([]);
  });
});
