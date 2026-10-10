import { describe, expect, it } from 'vitest';

import { selfSectionTitlesOf } from '@/src/lib/reading';

import { SELF_READING_MAKING } from './making';
import {
  READING_PREPARING,
  makingPeopleOf,
  makingSelf,
  runningHref,
  runningName,
  runningStage,
} from './running-line';
import type { RunningReading } from './running';

const fresh = { jobStatus: 'frozen', sectionsBegun: 0, bodyWritten: false } as const;

const one = (
  target: RunningReading['target'],
  progress: RunningReading['progress'] = fresh,
  labelA: string | null = null,
  labelB: string | null = null,
): RunningReading => ({ target, labelA, labelB, createdAt: '2026-10-09T00:00:00Z', progress });

describe('만드는 중인 풀이는 무엇인지 말한다', () => {
  it('갈래마다 보관함과 같은 이름에 「풀이」를 붙인다', () => {
    expect(runningName(one({ kind: 'self' }))).toBe('내 사주풀이');
    expect(runningName(one({ kind: 'person', personId: 'p' }, fresh, '엄마'))).toBe('엄마 사주풀이');
    expect(runningName(one({ kind: 'private', personA: 'a', personB: 'b' }, fresh, '엄마', '아빠'))).toBe(
      '엄마 × 아빠 궁합풀이',
    );
    expect(runningName(one({ kind: 'match', matchId: 'm' }, fresh, '지영'))).toBe('지영 님과의 인연 궁합');
  });

  it('이름이 없으면 사람을 지어 부르지 않는다 — 두 사람 궁합만 보관함처럼 「이름 없음」이다', () => {
    expect(runningName(one({ kind: 'person', personId: 'p' }))).toBe('사주풀이');
    expect(runningName(one({ kind: 'match', matchId: 'm' }))).toBe('인연 궁합');
    expect(runningName(one({ kind: 'private', personA: 'a', personB: 'b' }, fresh, '엄마'))).toBe(
      '엄마 × 이름 없음 궁합풀이',
    );
  });
});

/** 진행은 서버가 적은 값 그대로다(ADR 0127) — 시간으로 앞서 가지 않고, 비율을 세우지 않는다 */
describe('어디쯤인지는 풀이 화면의 목차와 같은 줄로 말한다', () => {
  const titles = selfSectionTitlesOf();

  it('아무 절도 안 섰으면 준비 중이다', () => {
    expect(runningStage(one({ kind: 'self' }))).toBe(READING_PREPARING);
    expect(runningStage(one({ kind: 'private', personA: 'a', personB: 'b' }))).toBe(READING_PREPARING);
  });

  it('한 사람 풀이는 지금 쓰는 절의 이름을 든다', () => {
    const second = { jobStatus: 'submitted', sectionsBegun: 2, bodyWritten: false };
    expect(runningStage(one({ kind: 'self' }, second))).toBe(`${titles[1]} 작성 중…`);
    expect(runningStage(one({ kind: 'person', personId: 'p' }, second))).toBe(`${titles[1]} 작성 중…`);
  });

  it('궁합은 몇 번째 이야기인지만 든다', () => {
    const third = { jobStatus: 'submitted', sectionsBegun: 3, bodyWritten: false };
    expect(runningStage(one({ kind: 'private', personA: 'a', personB: 'b' }, third))).toBe('세 번째 이야기 작성 중…');
  });

  it('본문을 다 썼으면 마지막 검토다', () => {
    expect(runningStage(one({ kind: 'self' }, { jobStatus: 'submitted', sectionsBegun: 4, bodyWritten: true }))).toBe(
      '마지막 검토 중…',
    );
  });

  /** 복구기가 집었다 놓는 표시라 끝의 근거가 아니다(ADR 0127 「2026-10-10 덧」) — 풀이 화면의 목차와 같은 줄이다 */
  it('가져가는 중(`retrieving`)이라는 표시만으로는 마지막 검토로 가지 않는다', () => {
    expect(
      runningStage(one({ kind: 'match', matchId: 'm' }, { jobStatus: 'retrieving', sectionsBegun: 0, bodyWritten: false })),
    ).toBe(READING_PREPARING);
    expect(runningStage(one({ kind: 'self' }, { jobStatus: 'retrieving', sectionsBegun: 4, bodyWritten: false }))).not.toBe(
      '마지막 검토 중…',
    );
  });

  it('어느 단계도 비율로 말하지 않는다', () => {
    for (const begun of [0, 1, 5, 60]) {
      const stage = runningStage(one({ kind: 'self' }, { jobStatus: 'submitted', sectionsBegun: begun, bodyWritten: false }));
      expect(stage).not.toMatch(/%|\d+\s*\/\s*\d+/);
    }
  });
});

describe('누르면 그 풀이 화면으로 간다', () => {
  it('풀이 화면의 주소에 홈에서 왔다는 표시를 든다', () => {
    expect(runningHref({ kind: 'self' })).toBe('/me/readings/self?from=me');
    expect(runningHref({ kind: 'person', personId: 'p1' })).toBe('/me/readings/p1?from=me');
    expect(runningHref({ kind: 'private', personA: 'a', personB: 'b' })).toBe('/me/compat?a=a&b=b&from=me');
    expect(runningHref({ kind: 'match', matchId: 'm1' })).toBe('/me/match/m1?from=me');
  });
});

describe('내 사주풀이를 만드는 중이면 「받기」를 권하지 않는다', () => {
  it('내 사주풀이가 도는 동안만 참이다', () => {
    expect(makingSelf([one({ kind: 'self' })])).toBe(true);
    expect(makingSelf([one({ kind: 'person', personId: 'p' })])).toBe(false);
    expect(makingSelf([])).toBe(false);
  });

  it('저장한 사람은 사주풀이를 만드는 중인 사람만 든다 — 궁합 · 내 사주는 안 든다', () => {
    const making = makingPeopleOf([
      one({ kind: 'person', personId: 'p1' }),
      one({ kind: 'private', personA: 'p2', personB: 'p3' }),
      one({ kind: 'self' }),
    ]);
    expect([...making]).toEqual(['p1']);
  });

  it('카드와 빈 표지가 드는 말은 진행 중의 꼴이다', () => {
    expect(SELF_READING_MAKING).toMatch(/ 중…$/);
    expect(SELF_READING_MAKING).not.toContain('받기');
  });
});
