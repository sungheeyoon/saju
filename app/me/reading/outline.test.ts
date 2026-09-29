import { describe, expect, it } from 'vitest';

import { selfSectionTitlesOf } from '@/src/lib/reading';

import { readingOutline } from './outline';
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

  it('본문을 다 썼거나 가져가는 중이면 절은 다 완료 · 마지막 검토가 검토 중이다', () => {
    for (const progress of [at('submitted', 9, true), at('retrieving', 4), at('submitted', 2, true)]) {
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
    expect(states(readingOutline(null, at('retrieving', 5)))).toEqual([
      'done', 'done', 'done', 'done', 'done', 'reviewing',
    ]);
  });
});
