import { describe, expect, it } from 'vitest';

import { decide, reportOf } from './main-red.mjs';

const MAIN = 'a'.repeat(40);
const OLD = 'b'.repeat(40);

describe('ci-main-red — main 의 결과로 이슈 하나를 든다 (ADR 0097)', () => {
  it('붉으면 연다 — 이미 열려 있으면 댓글이다(이슈는 하나)', () => {
    expect(decide({ branch: 'main', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: null }).action).toBe('open');
    expect(decide({ branch: 'main', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: 7 }).action).toBe('comment');
    expect(decide({ branch: 'main', conclusion: 'timed_out', sha: OLD, mainHead: MAIN, openIssue: null }).action).toBe('open');
  });

  it('끊긴 실행은 실패가 아니다 — 새 main 이 옛 실행을 끊는 것은 정책이다', () => {
    for (const conclusion of ['cancelled', 'skipped', 'neutral']) {
      expect(decide({ branch: 'main', conclusion, sha: MAIN, mainHead: MAIN, openIssue: 7 }).action, conclusion).toBe('none');
    }
  });

  it('초록은 지금 main 머리일 때만 닫는다 — 늦게 끝난 옛 실행은 닫지 않는다', () => {
    expect(decide({ branch: 'main', conclusion: 'success', sha: MAIN, mainHead: MAIN, openIssue: 7 }).action).toBe('close');
    expect(decide({ branch: 'main', conclusion: 'success', sha: OLD, mainHead: MAIN, openIssue: 7 }).action).toBe('none');
    expect(decide({ branch: 'main', conclusion: 'success', sha: MAIN, mainHead: MAIN, openIssue: null }).action).toBe('none');
  });

  it('main 밖의 실행은 보지 않는다', () => {
    expect(decide({ branch: 'fix/x', conclusion: 'failure', sha: MAIN, mainHead: MAIN, openIssue: null }).action).toBe('none');
  });

  it('보고는 실행 · 커밋 · 마지막 초록부터의 범위를 든다', () => {
    const text = reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD });
    expect(text).toContain('https://x/run/1');
    expect(text).toContain(`git log --oneline ${OLD.slice(0, 7)}..${MAIN.slice(0, 7)}`);
    expect(text).toContain('새 작업보다 먼저');
  });

  it('붉은 차선을 적고, audit 만 붉으면 밖의 advisory 부터 보게 한다 (G-23 ①)', () => {
    const onlyAudit = reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD, failedJobs: ['audit', 'gate'] });
    expect(onlyAudit).toContain('붉은 차선: `audit`');
    expect(onlyAudit).not.toContain('`gate`');
    expect(onlyAudit).toContain('새로 뜬 advisory');

    const withOthers = reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD, failedJobs: ['audit', 'verify', 'gate'] });
    expect(withOthers).toContain('`audit` · `verify`');
    expect(withOthers).not.toContain('새로 뜬 advisory');

    expect(reportOf({ runUrl: 'https://x/run/1', sha: MAIN, lastGreen: OLD })).not.toContain('붉은 차선');
  });
});
