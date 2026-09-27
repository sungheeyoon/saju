import { describe, expect, it } from 'vitest';

import { ELEMENT_ANGLE } from '../../ui/orbit';
import type { DeckCard } from './deck-card';
import { GEOMETRY, MAP_LIMIT, anglesOf, departureOf, queueOf, type MapStatus, type Shape } from './orbit-seats';

const card = (id: string, element?: string): DeckCard => ({
  candidateUserId: id,
  nickname: id,
  intro: null,
  hasPhoto: false,
  avatarElement: null,
  exploration: false,
  previewScore: 70,
  verdict: '',
  reason: '',
  balanceLabel: '',
  highlights: element === undefined ? [] : [{ element, text: '' }],
});

/** 한 방향에 몰린 날 — 木 쪽에 셋, 채우는 기운이 없는 사람 하나 */
const CROWD = [['a', '木'], ['b', '火'], ['c', '水'], ['d', '木'], ['e', '木'], ['f'], ['g', '火']].map(([id, element]) => card(id, element));

const statusBy = (table: Record<string, MapStatus>) => (one: DeckCard) => table[one.candidateUserId] ?? 'waiting';
const ids = (cards: readonly DeckCard[]) => cards.map((one) => one.candidateUserId);

/** 둘레를 따라 이웃한 두 자리 사이의 가장 좁은 각도 — 원은 끝과 처음도 이웃이다 */
function narrowestGap(shape: Shape, angles: readonly number[]) {
  const sorted = [...angles].sort((x, y) => x - y);
  const gaps = sorted.slice(1).map((at, i) => at - sorted[i]);
  if (GEOMETRY[shape].bounds === null && sorted.length > 1) gaps.push(sorted[0] + 360 - sorted[sorted.length - 1]);
  return Math.min(...gaps);
}

describe('지도에 서는 줄', () => {
  it('지금 사람이 맨 앞이고 기다리는 사람은 받은 차례대로 여섯까지 서며, 넘친 수를 센다', () => {
    const cards = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((id) => card(id));
    const { shown, overflow } = queueOf(cards, statusBy({ a: 'passed', b: 'requested', c: 'current' }));
    expect(ids(shown)).toEqual(['c', 'd', 'e', 'f', 'g', 'h']);
    expect(shown).toHaveLength(MAP_LIMIT);
    expect(overflow).toBe(2);
  });

  it('덱이 늘 여섯을 채우면 넘치지 않고, 되돌리기로 잠깐 일곱이 되면 하나가 넘친다', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => card(id));
    expect(queueOf(six, statusBy({ a: 'current' })).overflow).toBe(0);
    const restored = [...six, card('back')];
    const { shown, overflow } = queueOf(restored, statusBy({ back: 'current' }));
    expect(ids(shown)[0]).toBe('back');
    expect(overflow).toBe(1);
  });

  it('지나친 인연 보기의 보관된 사람은 모두 기다리는 자리에 선다', () => {
    const kept = ['a', 'b', 'c'].map((id) => card(id));
    expect(ids(queueOf(kept, () => 'kept').shown)).toEqual(['a', 'b', 'c']);
  });
});

describe('바깥 궤도의 자리', () => {
  it('혼자 선 사람은 제가 채워 주는 오행의 각도에 선다', () => {
    expect(anglesOf('round', [card('a', '火')]).a).toBe(ELEMENT_ANGLE.火);
    expect(anglesOf('arc', [card('a', '土')]).a).toBe(GEOMETRY.arc.angle.土);
  });

  it.each(['round', 'arc'] as const)('%s — 지도의 상한만큼 서도, 떠나는 한 사람이 더해져도 이웃은 서로 겹치지 않는다', (shape) => {
    for (const count of [MAP_LIMIT, MAP_LIMIT + 1]) {
      const angles = Object.values(anglesOf(shape, CROWD.slice(0, count)));
      expect(angles).toHaveLength(count);
      expect(narrowestGap(shape, angles)).toBeGreaterThanOrEqual(GEOMETRY[shape].gap - 0.05);
    }
  });

  it('폰 띠의 사람은 띠의 두 끝 안에 선다', () => {
    const [low, high] = GEOMETRY.arc.bounds ?? [-180, 0];
    const crowd = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => card(id, '木'));
    for (const at of Object.values(anglesOf('arc', crowd))) {
      expect(at).toBeGreaterThanOrEqual(low);
      expect(at).toBeLessThanOrEqual(high);
    }
  });
});

describe('떠난 순간', () => {
  it('「지금」이던 사람이 지나침이나 요청으로 바뀐 순간만 떠남이다', () => {
    expect(departureOf({ a: 'current', b: 'waiting' }, { a: 'passed', b: 'current' })).toEqual({ id: 'a', kind: 'passed' });
    expect(departureOf({ a: 'current' }, { a: 'requested' })).toEqual({ id: 'a', kind: 'requested' });
  });

  it('처음 그릴 때와 기다리던 사람이 빠질 때는 떠남이 없다 — 옛날에 요청한 사람에게 물결이 서지 않는다', () => {
    expect(departureOf({}, { a: 'requested', b: 'current' })).toBeNull();
    expect(departureOf({ a: 'waiting' }, { a: 'passed' })).toBeNull();
  });
});
