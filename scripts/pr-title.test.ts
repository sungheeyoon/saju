/**
 * PR 제목의 꼴(`scripts/pr-title.mjs`) — squash 가 제목을 main 의 커밋 제목으로 쓴다.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TYPES, titleProblem } from './pr-title.mjs';

describe('PR 제목의 꼴', () => {
  it.each([
    'perf(matching): 지나치기는 누르는 즉시 카드를 넘긴다 (ADR 0115)',
    'ui(home,form): 로그인 전 홈은 폼 한 장이다 (ADR 0132 덧)',
    'docs: 슬롭 감사가 남긴 문서 노후를 맞춘다 (정책 변경 없음)',
    'chore(agents): 무거운 실행은 하나씩 돈다',
  ])('받는다 — %s', (title) => {
    expect(titleProblem(title)).toBeNull();
  });

  it.each([
    ['ops(deploy): 배포한다', '목록에 없다'],
    ['Perf(matching): 대문자', '목록에 없다'],
    ['fix 콜론이 없다', '꼴이다'],
    ['fix(matching):붙여 쓴 문장', '꼴이다'],
    ['[초안] ci(plan): 앞에 꼬리표', '꼴이다'],
    ['', '꼴이다'],
  ])('거절한다 — %s', (title, said) => {
    expect(titleProblem(title)).toContain(said);
  });

  it('허용 목록은 locks.md 「커밋과 PR」의 목록과 같다', () => {
    const locks = readFileSync(resolve(__dirname, '../docs/agents/code-rules/locks.md'), 'utf8');
    const line = /^type 은 (.+?), 문장은/m.exec(locks)?.[1] ?? '';
    expect([...line.matchAll(/`([a-z]+)`/g)].map((match) => match[1])).toEqual(TYPES);
  });

  it('verify 의 plan 이 PR 에서 제목을 잰다 — gate 가 plan 을 기다린다', () => {
    const verify = readFileSync(resolve(__dirname, '../.github/workflows/verify.yml'), 'utf8');
    expect(verify).toMatch(/PR_TITLE: \$\{\{ github\.event\.pull_request\.title \}\}/);
    expect(verify).toMatch(/run: node scripts\/pr-title\.mjs/);
    expect(verify).toMatch(/gate:\n\s+needs: \[plan,/);
  });
});
