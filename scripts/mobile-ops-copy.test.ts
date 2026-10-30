import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **앱 운영 화면의 글자는 웹의 글자 그대로이고, 앱은 웹의 막음을 약하게 하지 않는다**(ADR 0209 · 0103).
 *
 * 판정과 라벨은 `src/lib/ops` 를 함께 쓴다. 화면에 박힌 짧은 말은 두 코드에 각자 서므로 앱의 글자가 웹 코드에 그대로 있는지 잰다.
 * 막음은 시험이 코드로 잰다 — 앱에서 DB 를 실제로 안 부르므로, 빠지면 안 되는 줄을 글자로 본다.
 */
const ROOT = join(import.meta.dirname, '..');

const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  );
const textOf = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const flat = (text: string) => text.replace(/\s+/g, ' ');
const withoutComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const koreanChunks = (text: string) =>
  [...withoutComments(text).matchAll(/[가-힣][^'"`{}<>\n]*/g)]
    /* 앱은 값을 템플릿에, 웹은 JSX 에 끼운다 — 값 자리와 가운뎃점에서 끊어 조각끼리 견준다 */
    .flatMap((match) => match[0].split(/\$| · /))
    .map((chunk) => chunk.replace(/^·\s*|\s*·$/g, '').trim())
    .filter((chunk) => /[가-힣]/.test(chunk));

const OPS_APP = walk('mobile/src/ops');

/** 이 화면의 읽기 실패 줄 — 웹은 오류 경계로 던지는 자리라 글자가 없다. 운영자 전용 글자는 사전 승인을 안 거친다(ADR 0103) */
const APP_ONLY = new Set(['오늘의 숫자를 읽지 못했습니다.']);

describe('앱 운영 화면의 글자', () => {
  const web = flat(
    [
      ...walk('app/ops').filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file)),
      ...walk('src/lib/ops').filter((file) => !/\.test\.ts$/.test(file)),
      'app/not-found.tsx',
      'app/ui/failure-line.tsx',
      'app/ui/action-answer.ts',
    ]
      .map(textOf)
      .join('\n'),
  );

  for (const file of OPS_APP) {
    it(`${file} 의 글자는 웹 코드에 그대로 있다`, () => {
      const strays = koreanChunks(textOf(file)).filter((chunk) => !web.includes(flat(chunk)) && !APP_ONLY.has(chunk));
      expect(strays).toEqual([]);
    });
  }
});

describe('앱 운영 화면의 막음', () => {
  const write = textOf('mobile/src/ops/write.ts');
  const exportedBodies = [...write.matchAll(/^export async function (\w+)/gm)].map((start, i, all) => ({
    name: start[1],
    body: write.slice(start.index, all[i + 1]?.index ?? write.length),
  }));

  it('쓰기는 내보낸 함수마다 문보다 먼저 두 번째 요소를 묻는다', () => {
    expect(exportedBodies.length).toBeGreaterThanOrEqual(5);
    const stray = exportedBodies.filter(({ body }) => {
      const gate = body.indexOf('await writeWithoutSecondFactor(');
      const door = body.indexOf('.rpc(');
      return gate < 0 || (door >= 0 && door < gate);
    });
    expect(stray.map(({ name }) => name)).toEqual([]);
  });

  it('화면은 전부 useOpsRead 를 지난다 — 2단계 인증 화면만 뺀다', () => {
    const screens = OPS_APP.filter((file) => /-screen\.tsx$/.test(file) && !file.endsWith('second-factor-screen.tsx'));
    expect(screens.length).toBe(6);
    expect(screens.filter((file) => !textOf(file).includes('useOpsRead('))).toEqual([]);
  });

  it('앱은 준비 취소 문을 안 부른다 — PortOne 확인을 앱에서 못 한다', () => {
    const called = OPS_APP.filter((file) => /operator_release_reading_refund'/.test(withoutComments(textOf(file))));
    expect(called).toEqual([]);
  });

  it('머리의 길은 문이 답한 뒤에만 선다 — 기다릴 때와 거절일 때 운영 머리가 없다', () => {
    const parts = textOf('mobile/src/ops/parts.tsx');
    const waiting = parts.slice(parts.indexOf('export const OpsWaiting'), parts.indexOf('/** 운영 머리와 본문'));
    expect(waiting).not.toContain('OpsShell');
    const absent = parts.slice(parts.indexOf('export function OpsAbsent'), parts.indexOf('/** 읽는 동안은'));
    expect(absent).not.toContain('OPERATOR_LINKS');
  });

  it('앱에 서비스 키 · 서버 전용 문이 없다', () => {
    const stray = OPS_APP.filter((file) => /service_role|SERVICE_ROLE|PORTONE/.test(textOf(file)));
    expect(stray).toEqual([]);
  });

  it('운영 화면으로 가는 길은 ops 밖 앱 코드에 없다', () => {
    const outside = walk('mobile/src').filter((file) => !file.startsWith('mobile/src/ops/') && !file.startsWith('mobile/src/app/ops/'));
    expect(outside.filter((file) => /['"`]\/ops[/'"`]/.test(textOf(file)))).toEqual([]);
  });
});
