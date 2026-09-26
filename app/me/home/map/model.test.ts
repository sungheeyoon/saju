import { describe, expect, it } from 'vitest';

import { chartOf } from '@/src/lib/input/chart';
import { DEFAULT_QUERY } from '@/src/lib/input/query';

import type { ReadingEntry } from '../../reading/current';
import { compatHrefOf, linksOf, mapModelOf, pairWithSelf, readingOf, type HomePerson } from './model';

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

  it('나와의 궁합은 본 사람에게만 점수와 그 궁합풀이의 비유가 붙고, 사주풀이만 본 사람은 궁합이 없는 사람과 같다', () => {
    const model = mapModelOf({
      self: { personId: 'me', label: '나', saju },
      people: [person('p1', '어머니'), person('p2', '아버지'), person('p3', '친구')],
      readings: [
        entry({ personA: 'me', personB: 'p1', score: 78, metaphor: '궁합의 비유', fromCurrentChart: false }),
        entry({ kind: 'person', personA: 'p2', metaphor: '아버지 혼자의 비유' }),
      ],
    });
    expect(model.people.map((one) => [one.id, one.compat.seen, one.compat.score, one.compat.metaphor, one.compat.current])).toEqual([
      ['p1', true, 78, '궁합의 비유', false],
      ['p2', false, null, null, true],
      ['p3', false, null, null, true],
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

  it('누른 사람의 카드는 그 사람과 이미 본 다른 사람의 궁합만 든다', () => {
    const model = mapModelOf({
      self: { personId: 'me', label: '나', saju },
      people: [person('p1', '어머니'), person('p2', '아버지'), person('p3', '친구')],
      readings: [entry({ personA: 'p2', personB: 'p1', score: 64 })],
    });
    expect(linksOf(model, 'p1')).toEqual([{ otherLabel: '아버지', score: 64, href: model.links[0].href }]);
    expect(linksOf(model, 'p3')).toEqual([]);
  });
});
