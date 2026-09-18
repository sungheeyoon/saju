import { describe, expect, it } from 'vitest';
import { deckReducer, type DeckState } from './deck-state';
import type { DeckCard } from './matching-experience';
const card = (id: string): DeckCard => ({ candidateUserId: id, nickname: id, intro: null, hasPhoto: false, exploration: false, previewScore: 70, verdict: '', reason: '', balanceLabel: '', highlights: [] });
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
