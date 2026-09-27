import { describe, expect, it } from 'vitest';
import { deckReducer, type DeckState } from './deck-state';
import type { DeckCard } from './deck-card';
const card = (id: string): DeckCard => ({ candidateUserId: id, nickname: id, intro: null, hasPhoto: false, avatarElement: null, exploration: false, previewScore: 70, verdict: '', reason: '', balanceLabel: '', highlights: [] });
const initial = (): DeckState => ({ remaining: ['a','b','c'].map(card), passed: [], history: [], seen: [] });

describe('지나침과 복원의 덱 순서', () => {
  it('서버 재검증은 현재 순서를 보존하면서 새 후보와 철회된 공개 자격을 반영한다', () => {
    const state = deckReducer(initial(), { type: 'sync', cards: ['c','b','new'].map(card), passed: [] });
    expect(state.remaining.map(c => c.candidateUserId)).toEqual(['b','c','new']);
  });

  it('연속 되돌리기마다 대상을 보존하고 현재 카드를 다음에 둔다', () => {
    let state = initial();
    for (const id of ['a', 'b']) {
      state = deckReducer(state, { type: 'pass', card: card(id) });
      state = deckReducer(state, { type: 'leave', id });
    }
    for (const id of ['b','a']) {
      expect(state.history[0].candidateUserId).toBe(id);
      state = deckReducer(state, { type: 'restore', card: card(id) });
    }
    expect(state.remaining.map(c => c.candidateUserId)).toEqual(['a','b','c']);
    expect(state.passed).toEqual([]);
    expect(state.history).toEqual([]);
  });
  it('덱에 없던 사람을 복원하고 중복 복원에도 한 장만 둔다', () => {
    let state = deckReducer(initial(), { type: 'restore', card: card('old') });
    state = deckReducer(state, { type: 'restore', card: card('old') });
    expect(state.remaining.map(c => c.candidateUserId)).toEqual(['old','a','b','c']);
  });
  it('최신 20명만 표시하고 같은 사람을 다시 지나치면 맨 위로 옮긴다', () => {
    let state = initial();
    for (let i=0; i<21; i++) state = deckReducer(state, { type: 'pass', card: card(String(i)) });
    expect(state.passed).toHaveLength(20);
    expect(state.passed.some(c => c.candidateUserId==='0')).toBe(false);
    state = deckReducer(state, { type: 'pass', card: card('2') });
    expect(state.passed).toHaveLength(20);
    expect(state.passed[0].candidateUserId).toBe('2');
  });
  it('이동 중 다른 보관 대상을 복원해도 떠나던 사람을 다시 세우지 않는다', () => {
    const state = deckReducer(deckReducer(initial(), { type: 'pass', card: card('a') }), { type: 'restore', card: card('old') });
    expect(state.remaining.map(c => c.candidateUserId)).toEqual(['old','b','c']);
    expect(state.passed.map(c => c.candidateUserId)).toEqual(['a']);
  });

});

/**
 * **덱은 떠난 만큼 채워진다**(ADR 0115). 서버는 떠난 사람의 자리를 걷고 풀에서 한 명을 뒤에 붙여 준다 —
 * 덱은 그 사람을 뒤에 합치고, 앞 순서와 되돌리기 이력은 그대로 둔다.
 */
describe('채워지는 덱', () => {
  const deckOf = (...ids: string[]): DeckState => ({ remaining: ids.map(card), passed: [], history: [], seen: [] });
  const ids = (state: DeckState) => state.remaining.map((c) => c.candidateUserId);

  it('넘긴 뒤 서버가 채운 사람은 덱 맨 뒤에 붙고 나머지 순서는 그대로다', () => {
    let state = deckOf('a', 'b', 'c', 'd', 'e', 'f');
    state = deckReducer(state, { type: 'pass', card: card('a') });
    state = deckReducer(state, { type: 'leave', id: 'a' });
    state = deckReducer(state, { type: 'sync', cards: ['b', 'c', 'd', 'e', 'f', 'g'].map(card), passed: [card('a')] });
    expect(ids(state)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
    expect(state.history.map((c) => c.candidateUserId)).toEqual(['a']);
  });

  it('응답이 떠나는 중인 사람을 아직 들고 와도 다시 세우지 않는다', () => {
    let state = deckOf('a', 'b');
    state = deckReducer(state, { type: 'pass', card: card('a') });
    state = deckReducer(state, { type: 'leave', id: 'a' });
    state = deckReducer(state, { type: 'sync', cards: ['a', 'b', 'c'].map(card), passed: [card('a')] });
    expect(ids(state)).toEqual(['b', 'c']);
  });

  it('여러 번 넘기고 채워도 되돌리기 이력은 끊기지 않는다 — 되돌린 사람은 맨 앞, 덱은 잠시 일곱', () => {
    let state = deckOf('a', 'b', 'c', 'd', 'e', 'f');
    for (const [gone, fresh] of [['a', 'g'], ['b', 'h']]) {
      state = deckReducer(state, { type: 'pass', card: card(gone) });
      state = deckReducer(state, { type: 'leave', id: gone });
      state = deckReducer(state, { type: 'sync', cards: [...ids(state), fresh].map(card), passed: state.passed });
    }
    expect(ids(state)).toEqual(['c', 'd', 'e', 'f', 'g', 'h']);
    expect(state.history.map((c) => c.candidateUserId)).toEqual(['b', 'a']);
    state = deckReducer(state, { type: 'restore', card: card('b') });
    expect(ids(state)).toEqual(['b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(state.history.map((c) => c.candidateUserId)).toEqual(['a']);
  });

  it('풀이 비어 서버가 아무도 안 채우면 덱은 줄다 빈다', () => {
    let state = deckOf('a');
    state = deckReducer(state, { type: 'pass', card: card('a') });
    state = deckReducer(state, { type: 'leave', id: 'a' });
    state = deckReducer(state, { type: 'sync', cards: [], passed: [card('a')] });
    expect(state.remaining).toEqual([]);
  });
});
