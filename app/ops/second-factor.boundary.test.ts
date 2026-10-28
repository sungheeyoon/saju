import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { asPosix, filesUnder } from '../ui/source-files';

/**
 * **운영 화면 전부와 운영 액션 전부가 두 번째 요소를 먼저 묻는다**(ADR 0209).
 *
 * 화면은 머리에서 `secondFactorGate` 를, 액션은 내보낸 함수마다 `writeWithoutSecondFactor` 를 문(`.rpc(`)보다 먼저 부른다. 새 화면 ·
 * 새 액션이 그 한 줄을 빠뜨리면 붉다. 확인 화면 자신(`/ops/mfa`)만 뺀다 — 거기는 aal1 세션이 오는 자리다.
 */

const OWN = 'app/ops/mfa/';

const files = (name: RegExp): { file: string; text: string }[] =>
  filesUnder('app/ops')
    .map((path) => asPosix(path))
    .filter((file) => name.test(file) && !file.startsWith(OWN))
    .map((file) => ({ file, text: readFileSync(file, 'utf8') }));

/** 내보낸 async 함수의 몸 — 다음 내보낸 함수 앞까지 */
const exportedBodies = (text: string): { name: string; body: string }[] => {
  const starts = [...text.matchAll(/^export async function (\w+)/gm)];
  return starts.map((start, i) => ({
    name: start[1],
    body: text.slice(start.index, starts[i + 1]?.index ?? text.length),
  }));
};

describe('운영 화면의 두 번째 요소', () => {
  it('운영 화면(page.tsx)은 전부 secondFactorGate 를 부른다', () => {
    const pages = files(/\/page\.tsx$/);
    expect(pages.length).toBeGreaterThanOrEqual(6);
    expect(pages.filter(({ text }) => !text.includes('await secondFactorGate(')).map(({ file }) => file)).toEqual([]);
  });

  it('운영 액션은 내보낸 함수마다 문보다 먼저 writeWithoutSecondFactor 를 부른다', () => {
    const actions = files(/\/actions\.ts$/);
    expect(actions.length).toBeGreaterThanOrEqual(3);
    const stray = actions.flatMap(({ file, text }) =>
      exportedBodies(text)
        .filter(({ body }) => {
          const gate = body.indexOf('await writeWithoutSecondFactor(');
          const door = body.indexOf('.rpc(');
          return gate < 0 || (door >= 0 && door < gate);
        })
        .map(({ name }) => `${file}::${name}`),
    );
    expect(stray).toEqual([]);
  });
});
