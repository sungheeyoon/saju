import { describe, expect, it } from 'vitest';

import { selfSectionTitlesOf } from '@/src/lib/reading';

import { progressSoFar, readingOutline } from './outline';
import type { RunProgress } from './current';

/** 서버가 넘기는 절 이름 — 자기 풀이 · 다른 사람 풀이 */
const SOLO = selfSectionTitlesOf();

const at = (jobStatus: string | null, sectionsBegun: number, bodyWritten = false): RunProgress => ({
  jobStatus,
  sectionsBegun,
  bodyWritten,
});

const states = (rows: ReturnType<typeof readingOutline>) => rows.map((row) => row.state);

/**
 * **목차는 서버가 적은 값보다 앞서 가지 않는다**(ADR 0127).
 */
describe('기다리는 화면의 목차', () => {
  it('자기 풀이는 프롬프트의 절 아홉 줄에 마지막 검토 한 줄이다', () => {
    const rows = readingOutline(SOLO, null);
    expect(rows).toHaveLength(10);
    expect(rows[0].label).toBe('먼저 볼 핵심 세 가지');
    expect(rows[9].label).toBe('마지막 검토');
    expect(new Set(states(rows))).toEqual(new Set(['waiting']));
  });

  it('제출 전 · 첫 머리 전에는 아무 줄도 안 움직인다 — 시간으로 채우지 않는다', () => {
    for (const progress of [at('frozen', 0), at('submitting', 0), at('submitted', 0), at(null, 0)]) {
      expect(new Set(states(readingOutline(SOLO, progress)))).toEqual(new Set(['waiting']));
    }
  });

  it('셋째 절을 시작했으면 둘은 완료 · 셋째는 작성 중 · 나머지는 기다림이다', () => {
    expect(states(readingOutline(SOLO, at('submitted', 3)))).toEqual([
      'done', 'done', 'writing', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting',
    ]);
  });

  it('시킨 것보다 소제목을 더 달면 마지막 절에 머문다', () => {
    const rows = states(readingOutline(SOLO, at('submitted', 14)));
    expect(rows.slice(0, 8)).toEqual(Array(8).fill('done'));
    expect(rows[8]).toBe('writing');
    expect(rows[9]).toBe('waiting');
  });

  it('본문을 다 썼으면 절은 다 완료 · 마지막 검토가 검토 중이다', () => {
    for (const progress of [at('submitted', 9, true), at('retrieving', 9, true), at('submitted', 2, true)]) {
      const rows = states(readingOutline(SOLO, progress));
      expect(rows.slice(0, 9)).toEqual(Array(9).fill('done'));
      expect(rows[9]).toBe('reviewing');
    }
  });

  it('궁합은 시작한 만큼만 「n번째 이야기」로 선다 — 몇 개가 될지 모르는 줄을 미리 세우지 않는다', () => {
    expect(readingOutline(null, at('submitted', 0)).map((row) => row.label)).toEqual([
      '첫 번째 이야기',
      '마지막 검토',
    ]);
    const rows = readingOutline(null, at('submitted', 3));
    expect(rows.map((row) => row.label)).toEqual(['첫 번째 이야기', '두 번째 이야기', '세 번째 이야기', '마지막 검토']);
    expect(states(rows)).toEqual(['done', 'done', 'writing', 'waiting']);
    expect(states(readingOutline(null, at('retrieving', 5, true)))).toEqual([
      'done', 'done', 'done', 'done', 'done', 'reviewing',
    ]);
  });
});

/**
 * **한 번 앞선 줄은 뒤로 가지 않는다**(2026-10-10 운영 smoke — 「마지막 검토까지 완료됐다가 다시 위로 올라간다」).
 *
 * 복구기(`reading-recovery`, 1분마다)는 도는 작업을 집어 `retrieving` 으로 표시하고, 아직 쓰는 중이면 `submitted` 로 놓는다
 * (`release_reading_job`). 그 사이에 물으면 `retrieving` 이 온다 — 그것을 「본문을 다 썼다」로 읽으면 목차가 끝까지 갔다가
 * 놓는 순간 쓰던 절로 되돌아간다.
 */
describe('목차가 지나온 값', () => {
  /** 화면이 3초마다 받은 값을 차례로 접는다 — `panel.tsx` 가 하는 그대로 */
  const fold = (seen: readonly (RunProgress | null)[]) => {
    let progress: RunProgress | null = null;
    return seen.map((value) => {
      progress = progressSoFar(progress, value);
      return states(readingOutline(SOLO, progress));
    });
  };

  it('복구기가 집었다 놓은 작업의 `retrieving` 은 본문을 다 쓴 것이 아니다', () => {
    expect(states(readingOutline(SOLO, at('retrieving', 4)))).toEqual(states(readingOutline(SOLO, at('submitted', 4))));
  });

  it('쓰는 중 · 복구기가 집음 · 놓음 · 끝 — 어느 물음에서도 줄이 뒤로 가지 않는다', () => {
    const seen = fold([at('submitted', 4), at('retrieving', 4), at('submitted', 4), at('submitted', 9, true), null]);
    const rank = { waiting: 0, writing: 1, reviewing: 1, done: 2 } as const;
    for (let step = 1; step < seen.length; step += 1) {
      seen[step].forEach((state, row) => expect(rank[state]).toBeGreaterThanOrEqual(rank[seen[step - 1][row]]));
    }
  });

  it('끝난 시도 · 못 본 시도로 진행이 비어 와도 목차를 비우지 않는다', () => {
    const [, last] = fold([at('submitted', 9, true), null]);
    expect(last.slice(0, 9)).toEqual(Array(9).fill('done'));
    expect(last[9]).toBe('reviewing');
  });

  it('늦게 온 작은 값이 앞선 절을 되돌리지 못한다', () => {
    const [, later] = fold([at('submitted', 5), at('submitted', 3)]);
    expect(later[3]).toBe('done');
    expect(later[4]).toBe('writing');
  });
});
