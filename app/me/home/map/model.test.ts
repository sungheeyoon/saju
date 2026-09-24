import { describe, expect, it } from 'vitest';

import { chartOf } from '@/src/lib/input/chart';
import { DEFAULT_QUERY } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../reading/current';
import { compatHrefOf, mapModelOf, pairWithSelf, readingOf, type HomePerson } from './model';

const entry = (over: Partial<ReadingEntry>): ReadingEntry => ({
  kind: 'private',
  personA: null,
  personB: null,
  matchId: null,
  labelA: null,
  labelB: null,
  score: null,
  metaphor: null,
  createdAt: '2026-09-24T00:00:00Z',
  fromCurrentChart: true,
  dayMasterA: null,
  dayMasterB: null,
  ...over,
});

const saju = chartOf({ ...DEFAULT_QUERY, date: '1990-05-15', time: '14:30' });
const person = (personId: string, label: string): HomePerson => ({
  personId,
  label,
  note: null,
  chart: { ok: true, saju },
});

describe('관계 지도의 값', () => {
  it('나와의 궁합은 두 사람의 차례를 안 가리고 가장 최근 글을 고른다', () => {
    const newer = entry({ personA: 'p1', personB: 'me', score: 81 });
    const older = entry({ personA: 'me', personB: 'p1', score: 60 });
    expect(pairWithSelf([newer, older], 'me', 'p1')).toBe(newer);
    expect(pairWithSelf([newer], 'me', 'p2')).toBeNull();
  });

  it('본 궁합이 없으면 두 칸이 찬 궁합 화면으로, 있으면 그 글로 간다', () => {
    expect(compatHrefOf(null, 'me', 'p1')).toBe('/compat#a.person=me&b.person=p1');
    expect(compatHrefOf(entry({ personA: 'me', personB: 'p1' }), 'me', 'p1')).not.toContain('/compat#');
  });

  it('사람의 풀이는 그 사람 한 명의 글이고 궁합 글이 아니다', () => {
    const pair = entry({ personA: 'p1', personB: 'me' });
    const own = entry({ kind: 'person', personA: 'p1' });
    expect(readingOf([pair, own], 'p1')).toBe(own);
    expect(readingOf([pair], 'p1')).toBeNull();
  });

  it('풀이나 궁합을 본 사람은 안쪽 궤도에, 저장만 한 사람은 바깥 궤도에 앉는다', () => {
    const model = mapModelOf({
      self: { personId: 'me', label: '나', saju },
      people: [person('p1', '어머니'), person('p2', '아버지'), person('p3', '친구')],
      readings: [entry({ personA: 'me', personB: 'p1', score: 78 }), entry({ kind: 'person', personA: 'p2' })],
    });
    expect(model.people.map((one) => [one.id, one.ring, one.compat.seen, one.compat.score])).toEqual([
      ['p1', 'inner', true, 78],
      ['p2', 'inner', false, null],
      ['p3', 'outer', false, null],
    ]);
    expect(model.people[0].tileHref).toBe('#person-p1');
  });

  it('저장한 두 사람 사이의 선은 둘 다 지도에 있을 때만, 같은 쌍은 한 번만 선다', () => {
    const model = mapModelOf({
      self: { personId: 'me', label: '나', saju },
      people: [person('p1', '어머니'), person('p2', '아버지')],
      readings: [
        entry({ personA: 'p1', personB: 'p2', labelA: '어머니', labelB: '아버지', score: 64 }),
        entry({ personA: 'p2', personB: 'p1', score: 50 }),
        entry({ personA: 'p1', personB: 'gone', score: 70 }),
      ],
    });
    expect(model.links).toHaveLength(1);
    expect(model.links[0]).toMatchObject({ a: 'p1', b: 'p2', score: 64, label: '어머니 × 아버지' });
  });
});
