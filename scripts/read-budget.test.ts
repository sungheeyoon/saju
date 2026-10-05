/**
 * 읽기량의 셈(`scripts/read-budget.mjs`, ADR 0145 · 0147)을 작은 가짜 저장소로 잰다 — 절만 센다 · 「닿을 때 여는 것」은 안
 * 센다 · 선택지는 고정이 센 바이트를 다시 세지 않는다 · 천장은 눈금의 배수다. 진짜 역할 문서의 값과 천장은
 * `scripts/code-rules.test.ts` 가 잰다.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { CEILING_STEP, ceilingFor, readBudgetOf } from './read-budget.mjs';

/** 제목 둘 — 「가」 절은 400 바이트 남짓, 「나」 절은 그보다 크다 */
const SOURCE = ['# 원본', '', '## 가 절', '', 'ㄱ'.repeat(130), '', '## 나 절', '', 'ㄴ'.repeat(600), ''].join('\n');
const AT = (text: string, heading: string) => {
  const start = Buffer.byteLength(text.slice(0, text.indexOf(heading)));
  const next = text.indexOf('\n## ', text.indexOf(heading) + 1);
  return (next === -1 ? Buffer.byteLength(text) : Buffer.byteLength(text.slice(0, next + 1))) - start;
};

let root = '';
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

/** 가짜 저장소 — `docs/roles/x.md` 의 칸을 받아 세운다 */
function repo(sections: Record<string, string>) {
  root = mkdtempSync(join(tmpdir(), 'read-budget-'));
  const files: Record<string, string> = {
    'docs/source.md': SOURCE,
    'docs/other.md': '# 다른 원본\n\n' + 'ㄷ'.repeat(200) + '\n',
    'docs/adr/README.md': '# 색인\n',
    'docs/roles/x.md': ['# 역할', '', ...Object.entries(sections).flatMap(([heading, body]) => [`## ${heading}`, '', body, ''])].join('\n'),
  };
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const own = () => readBudgetOf('x', root).fixed.find((one) => one.file === 'docs/roles/x.md')?.bytes ?? 0;
const sourceBytes = (budget: ReturnType<typeof readBudgetOf>) => budget.fixed.find((one) => one.file === 'docs/source.md')?.bytes;

describe('읽기량 — 절을 가리키면 그 절만 센다 (ADR 0147)', () => {
  it('`경로` 「절」 은 그 절만, 절 없이 한 번이라도 가리키면 파일 전부다', () => {
    repo({ '먼저 읽는 것': '- `docs/source.md` 「가 절」' });
    expect(sourceBytes(readBudgetOf('x', root))).toBe(AT(SOURCE, '## 가 절'));

    repo({ '먼저 읽는 것': '- `docs/source.md` 「가 절」', '끝날 때 고치는 것': '- [ ] 그 뒤 → `docs/source.md`' });
    expect(sourceBytes(readBudgetOf('x', root))).toBe(Buffer.byteLength(SOURCE));
  });

  it('링크의 앵커도 절이고, 같은 절을 두 번 가리켜도 한 번 센다', () => {
    repo({ '먼저 읽는 것': '- `docs/source.md` 「나 절」', '이 저장소의 방식': '- [나](../source.md#나-절) — 같은 절' });
    expect(sourceBytes(readBudgetOf('x', root))).toBe(AT(SOURCE, '## 나 절'));
  });

  it('없는 절을 가리키면 셈이 멈춘다 — 0 바이트로 초록이 되지 않게', () => {
    repo({ '먼저 읽는 것': '- `docs/source.md` 「없는 절」' });
    expect(() => readBudgetOf('x', root)).toThrow(/없는 절/);
    repo({ '이 저장소의 방식': '- [없음](../source.md#없는-절) — 앵커' });
    expect(() => readBudgetOf('x', root)).toThrow(/없는-절/);
  });
});

describe('읽기량 — 「닿을 때 여는 것」은 세지 않는다 (ADR 0147)', () => {
  it('같은 줄이 세는 칸에 있으면 세고, 「닿을 때 여는 것」에 있으면 역할 문서의 바이트만 는다', () => {
    repo({ '이 저장소의 방식': '- [다른 원본](../other.md) — 통째로' });
    const counted = readBudgetOf('x', root);
    expect(counted.fixed.map((one) => one.file)).toContain('docs/other.md');

    repo({ '닿을 때 여는 것': '- 그 일이면 → [다른 원본](../other.md) — 통째로' });
    const onDemand = readBudgetOf('x', root);
    expect(onDemand.fixed.map((one) => one.file)).toEqual(['docs/roles/x.md']);
    expect(onDemand.total).toBe(own());
  });
});

describe('읽기량 — 선택지는 고정이 센 바이트를 다시 세지 않는다', () => {
  it('고정이 「가」 절을 셌으면 선택지의 같은 파일 전부는 나머지만 더한다', () => {
    repo({
      '먼저 읽는 것': [
        '- `docs/source.md` 「가 절」',
        '- 하나를 고른다 — 고칠 자리',
        '  - 하나 — `docs/source.md`',
        '  - 둘 — `docs/other.md`',
      ].join('\n'),
    });
    const budget = readBudgetOf('x', root);
    const one = budget.choices[0].options.find((option) => option.name === '하나');
    expect(one?.files[0].inFixed).toBe(true);
    expect(one?.bytes).toBe(Buffer.byteLength(SOURCE) - AT(SOURCE, '## 가 절'));
    expect(budget.total).toBe(budget.fixedBytes + budget.choiceBytes);
  });
});

describe('천장 — 눈금의 배수이고 정할 때 눈금 반 이상이 남는다 (ADR 0147)', () => {
  it('합에서 눈금 반을 더해 올린 배수다', () => {
    expect(ceilingFor(61_055)).toBe(65_000);
    expect(ceilingFor(62_600)).toBe(70_000);
    expect(ceilingFor(65_000)).toBe(70_000);
    for (const total of [1, 49_999, 91_703, 123_456]) {
      const ceiling = ceilingFor(total);
      expect(ceiling % CEILING_STEP, String(total)).toBe(0);
      expect(ceiling - total, String(total)).toBeGreaterThanOrEqual(CEILING_STEP / 2);
      expect(ceiling - total, String(total)).toBeLessThan(CEILING_STEP * 1.5);
    }
  });
});
