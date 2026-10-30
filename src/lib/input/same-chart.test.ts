import { describe, expect, it } from 'vitest';

import { chartFingerprint, chartOf } from './chart';
import { DEFAULT_QUERY, type Query } from './query';
import { sameChartAmong } from './same-chart';
import type { StoredInput } from './stored';

const query: Query = { ...DEFAULT_QUERY, name: '엄마', date: '1965-03-12', time: '09:30', hourKnown: true };
const input: StoredInput = {
  calendar: 'solar',
  original_date: '1965-03-12',
  solar_date: '1965-03-12',
  birth_time: '09:30:00',
  gender: query.gender,
  city: query.city,
  late_night_rule: query.rule,
  time_basis: query.basis,
};
const mine = chartFingerprint(chartOf(query));
const edge = (personId: string, listed: boolean) => ({ personId, label: personId, listed });

describe('sameChartAmong', () => {
  it('목록에 선 사람을 숨은 사람보다 먼저 찾는다 — 차례가 뒤여도', () => {
    const found = sameChartAmong(mine, [edge('hidden', false), edge('shown', true)], new Map([['hidden', input], ['shown', input]]), null);
    expect(found).toEqual({ personId: 'shown', label: 'shown', isSelfPerson: false, listed: true });
  });

  it('숨은 사람뿐이면 그 사람을 낸다 — 묻지 않고 쓰려고', () => {
    expect(sameChartAmong(mine, [edge('hidden', false)], new Map([['hidden', input]]), null)?.listed).toBe(false);
  });

  it('나면 나라고 답한다', () => {
    expect(sameChartAmong(mine, [edge('me', true)], new Map([['me', input]]), 'me')?.isSelfPerson).toBe(true);
  });

  it('다른 명식 · 입력이 없는 사람 · 못 읽는 입력은 같다고 하지 않는다', () => {
    const other = { ...input, original_date: '1970-01-01', solar_date: '1970-01-01' };
    const unreadable = { ...input, city: '없는 곳' };
    const found = sameChartAmong(mine, [edge('other', true), edge('none', true), edge('bad', true)], new Map([['other', other], ['bad', unreadable]]), null);
    expect(found).toBeNull();
  });
});
