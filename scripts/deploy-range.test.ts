/**
 * 묶음 배포 범위 명령이 GitHub 응답을 **좁게** 읽는가(ADR 0159). 진짜 GitHub 를 부르지 않는다 — 응답 모양을 넣어 잰다.
 * 범위의 판정 자체(커밋마다 · `--from` · main 이 붉음)는 `ci-plan.test.ts` 「묶음 배포의 기다림」이 잰다.
 */
import { describe, expect, it } from 'vitest';

import { gateRunsPath, latestGatePassed, mergedHeadsOf } from './deploy-range.mjs';

/** `GET /repos/{repo}/commits/{sha}/check-runs?check_name=gate` 의 응답 — 실행마다 `[id, 시작, status, conclusion]` */
const checks = (...runs: [number, string, string, string | null][]) => ({
  total_count: runs.length,
  check_runs: runs.map(([id, started_at, status, conclusion]) => ({ id, name: 'gate', started_at, status, conclusion })),
});
const T1 = '2026-10-09T01:00:00Z';
const T2 = '2026-10-09T02:00:00Z';

describe('PR 의 gate — 가장 최근 실행 하나만 본다', () => {
  it('최신 실행이 끝났고 성공일 때만 참이다 — 성공 뒤 다시 돌린 것도 성공이면 참', () => {
    expect(latestGatePassed(checks([1, T1, 'completed', 'success']))).toBe(true);
    expect(latestGatePassed(checks([1, T1, 'completed', 'success'], [2, T2, 'completed', 'success']))).toBe(true);
    // 앞이 실패했어도 최신이 성공이면 참이다
    expect(latestGatePassed(checks([1, T1, 'completed', 'failure'], [2, T2, 'completed', 'success']))).toBe(true);
  });

  it('최신 실행이 진행 중 · 취소 · 실패 · 건너뜀이면 앞의 성공이 있어도 거짓이다', () => {
    for (const [status, conclusion] of [
      ['in_progress', null],
      ['queued', null],
      ['completed', 'cancelled'],
      ['completed', 'failure'],
      ['completed', 'skipped'],
      ['completed', 'timed_out'],
      ['completed', 'neutral'],
    ] as const) {
      expect(latestGatePassed(checks([1, T1, 'completed', 'success'], [2, T2, status, conclusion])), `${status}/${conclusion}`).toBe(false);
    }
  });

  it('목록의 차례가 아니라 시작 시각 · id 로 최신을 고른다', () => {
    expect(latestGatePassed(checks([2, T2, 'completed', 'cancelled'], [1, T1, 'completed', 'success']))).toBe(false);
    expect(latestGatePassed(checks([5, T1, 'completed', 'failure'], [4, T1, 'completed', 'success']))).toBe(false);
    expect(latestGatePassed(checks([4, T1, 'completed', 'failure'], [5, T1, 'completed', 'success']))).toBe(true);
  });

  it('실행 없음 · 모르는 응답 · 받은 것보다 많음은 거짓이다', () => {
    expect(latestGatePassed(checks())).toBe(false);
    expect(latestGatePassed(null)).toBe(false);
    expect(latestGatePassed({})).toBe(false);
    expect(latestGatePassed({ message: 'Not Found' })).toBe(false);
    expect(latestGatePassed({ check_runs: 'x' })).toBe(false);
    expect(latestGatePassed({ total_count: 2, check_runs: [{ id: 1, name: 'gate', started_at: T1, status: 'completed', conclusion: 'success' }] })).toBe(false);
    expect(latestGatePassed({ check_runs: [{ id: 1, name: 'core', started_at: T1, status: 'completed', conclusion: 'success' }] })).toBe(false);
    expect(latestGatePassed({ check_runs: [{ id: 1, name: 'gate', started_at: null, status: 'completed', conclusion: 'success' }] })).toBe(false);
    expect(latestGatePassed({ check_runs: [{ name: 'gate', started_at: T1, status: 'completed', conclusion: 'success' }] })).toBe(false);
    expect(latestGatePassed({ check_runs: [null] })).toBe(false);
  });
});

describe('gate 실행을 읽는 경로', () => {
  it('filter=all 로 전부 받는다 — 기본 latest 는 completed_at 으로 골라 진행 중인 재실행을 숨길 수 있다', () => {
    const path = new URL(`https://api.github.com/${gateRunsPath('o/r', 'h1')}`);
    expect(path.pathname).toBe('/repos/o/r/commits/h1/check-runs');
    expect(path.searchParams.get('check_name')).toBe('gate');
    expect(path.searchParams.get('filter')).toBe('all');
  });
});

describe('커밋을 들인 PR — 머지된 것의 head 만, 모양을 모르면 null', () => {
  it('머지된 PR 의 head 를 든다', () => {
    expect(mergedHeadsOf([{ merged_at: T1, head: { sha: 'h1' } }, { merged_at: null, head: { sha: 'h2' } }])).toEqual(['h1']);
    expect(mergedHeadsOf([])).toEqual([]);
  });

  it('모르는 모양은 null 이다', () => {
    expect(mergedHeadsOf({ message: 'Not Found' })).toBeNull();
    expect(mergedHeadsOf([{ head: { sha: 'h1' } }])).toBeNull();
    expect(mergedHeadsOf([{ merged_at: T1, head: {} }])).toBeNull();
    expect(mergedHeadsOf([null])).toBeNull();
  });
});
