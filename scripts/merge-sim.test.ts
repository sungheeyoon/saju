/**
 * `merge:sim` 의 순수한 판단 — 인자 · vitest 보고 읽기 · 린트와 타입 출력 읽기 · 요약 문장. git 과 `gh` 를 부르는 쪽은
 * 여기서 안 잰다(임시 워크트리를 열고 PR 가지를 받는 일이라 시험이 네트워크에 매인다).
 */
import { describe, expect, it } from 'vitest';

import { EXIT, HELP, Refusal, conflictMessage, lintProblemsOf, parseArgs, summaryOf, testsOf, typeErrorsOf } from './merge-sim.mjs';

const ROOT = '/tmp/merge-sim-abc';

describe('merge:sim — 인자는 머지할 순서 그대로의 PR 번호다', () => {
  it('적은 차례를 그대로 든다 — `#` 는 떼고 읽는다', () => {
    expect(parseArgs(['291', '#289', '290'])).toEqual({ help: false, prs: [291, 289, 290] });
  });

  it('빈 목록 · 번호가 아닌 것 · 겹친 번호는 거절한다 — 열린 PR 을 알아서 모으지 않는다', () => {
    for (const argv of [[], ['abc'], ['0'], ['12', '-3'], ['1.5'], ['289', '289']]) {
      expect(() => parseArgs(argv), argv.join(' ')).toThrow(Refusal);
    }
    try {
      parseArgs(['289', '289']);
    } catch (thrown) {
      expect((thrown as Refusal).message).toContain('#289');
      expect((thrown as Refusal & { code: number }).code).toBe(EXIT.unable);
    }
  });

  it('도움말은 스택 검사를 안 돈다고 말한다 — 그것은 각 PR 의 CI 몫이다', () => {
    expect(parseArgs(['--help'])).toEqual({ help: true });
    expect(parseArgs(['289', '-h'])).toEqual({ help: true });
    expect(HELP).toContain('pgTAP');
    expect(HELP).toContain('각 PR 의 CI 몫');
    expect(HELP).toContain('npm run merge:sim -- ');
  });
});

describe('merge:sim — vitest 보고를 셋으로 가른다', () => {
  const report = {
    testResults: [
      {
        name: `${ROOT}/src/lib/a.test.ts`,
        status: 'passed',
        assertionResults: [
          { status: 'passed', fullName: 'a 는 참이다' },
          { status: 'skipped', fullName: '잠긴 것' },
        ],
      },
      {
        name: `${ROOT}/scripts/code-rules.test.ts`,
        status: 'failed',
        assertionResults: [
          { status: 'passed', fullName: '이름은 kebab 이다' },
          { status: 'failed', fullName: '입구 문서가 가리키는 경로 백틱 안의 뿌리 경로는 있다' },
        ],
      },
      { name: `${ROOT}/scripts/layers.test.ts`, status: 'passed', assertionResults: [{ status: 'passed', fullName: '층' }] },
      { name: `${ROOT}/app/broken.test.ts`, status: 'failed', message: "\nFailed to load url ./gone\n  at …", assertionResults: [] },
    ],
  };

  it('두 잠금 시험은 따로 세고, 나머지는 단위 시험이다', () => {
    const buckets = testsOf(report, ROOT);
    expect(buckets.unit).toEqual({ passed: 1, skipped: 1, failed: ['app/broken.test.ts > (파일) Failed to load url ./gone'] });
    expect(buckets['code-rules']).toEqual({
      passed: 1,
      skipped: 0,
      failed: ['scripts/code-rules.test.ts > 입구 문서가 가리키는 경로 백틱 안의 뿌리 경로는 있다'],
    });
    expect(buckets.layers).toEqual({ passed: 1, skipped: 0, failed: [] });
  });

  it('보고가 비면 붉은 것도 없다고 읽는다 — 보고가 없는 경우는 부르는 쪽이 따로 붉힌다', () => {
    expect(testsOf({}, ROOT).unit).toEqual({ passed: 0, skipped: 0, failed: [] });
  });
});

describe('merge:sim — 린트 · 타입 출력에서 문제 줄만', () => {
  it('tsc 는 `error TS` 줄이다', () => {
    const output = "> saju@0.1.0 typecheck\n\napp/a.ts(3,5): error TS2322: Type 'x' is not assignable.\nFound 1 error.";
    expect(typeErrorsOf(output)).toEqual(["app/a.ts(3,5): error TS2322: Type 'x' is not assignable."]);
  });

  it('eslint stylish 는 파일 머리줄 아래 `줄:칸 error 말 규칙` 이다', () => {
    const output = [
      '',
      `${ROOT}/app/a.ts`,
      "  12:3  error  Unexpected console statement  no-console",
      "  14:1  warning  Unused eslint-disable directive  ",
      '',
      '✖ 1 problem (1 error, 0 warnings)',
    ].join('\n');
    expect(lintProblemsOf(output, ROOT)).toEqual(['app/a.ts:12 no-console — Unexpected console statement']);
  });
});

describe('merge:sim — 요약은 한 화면에 들고 붉은 이름을 든다', () => {
  it('글자 충돌은 어느 PR 이 누구 위에서 어느 파일인지 말한다', () => {
    const text = conflictMessage({ pr: 293, before: [289, 292], files: ['scripts/ci-plan.mjs'] });
    expect(text).toContain('#293 가 origin/main + #289 → #292 위에서 글자 충돌');
    expect(text).toContain('- scripts/ci-plan.mjs');
    expect(conflictMessage({ pr: 1, before: [], files: [] })).toContain('#1 가 origin/main 위에서');
  });

  it('다 통과하면 초록이라고, 스택 검사는 CI 가 잰다고 말한다', () => {
    const text = summaryOf({
      base: 'a51e4e0',
      prs: [289, 290],
      checks: [
        { label: '단위 시험', ok: true, count: '2647 통과', problems: [] },
        { label: '린트', ok: true, problems: [] },
      ],
    });
    expect(text).toContain('origin/main(a51e4e0) + #289 → #290');
    expect(text).toContain('단위 시험: 통과 (2647 통과)');
    expect(text).toContain('결론: 초록');
    expect(text).toContain('각 PR 의 CI');
  });

  it('붉으면 붉은 검사와 시험 이름을 든다 — 스물을 넘으면 수만', () => {
    const many = Array.from({ length: 23 }, (_, n) => `scripts/code-rules.test.ts > 시험 ${n}`);
    const text = summaryOf({
      base: 'a51e4e0',
      prs: [292, 293, 296],
      checks: [
        { label: 'scripts/code-rules.test.ts', ok: false, count: '40 통과 · 23 실패', problems: many },
        { label: '타입', ok: true, problems: [] },
      ],
      dependenciesChanged: true,
    });
    expect(text).toContain('scripts/code-rules.test.ts: 붉음 23 (40 통과 · 23 실패)');
    expect(text).toContain('- scripts/code-rules.test.ts > 시험 19');
    expect(text).not.toContain('시험 20');
    expect(text).toContain('… 그 밖 3');
    expect(text).toContain('package-lock.json');
    expect(text).toContain('결론: 붉음 — scripts/code-rules.test.ts.');
  });
});
