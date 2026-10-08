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

/**
 * **지나침은 서버보다 먼저 선다**(ADR 0115 「2026-10-08 덧」). 화면은 누르는 순간 `pass` → (0.46초 뒤) `leave` 를 밟고, 서버가 못
 * 받으면 `unpass` 를 밟는다. 실패는 떠나기 전에도, 떠난 뒤에도 올 수 있고, 그 뒤에 서버 목록(`sync`)이 늦게 올 수 있다.
 */
describe('서버가 못 받은 지나침', () => {
  const ids = (cards: readonly DeckCard[]) => cards.map((c) => c.candidateUserId);
  const passedAndLeft = (state: DeckState, id: string) =>
    deckReducer(deckReducer(state, { type: 'pass', card: card(id) }), { type: 'leave', id });

  it('떠나기 전에 실패하면 카드는 맨 앞 그대로이고 보관함 · 이력이 비어 있던 대로 돌아온다', () => {
    let state = deckReducer(initial(), { type: 'pass', card: card('a') });
    state = deckReducer(state, { type: 'unpass', card: card('a') });
    expect(state).toEqual(initial());
  });

  it('떠난 뒤에 실패하면 맨 앞에 한 장으로 되서고 seen 에서도 빠진다', () => {
    let state = passedAndLeft(initial(), 'a');
    expect(ids(state.remaining)).toEqual(['b', 'c']);
    state = deckReducer(state, { type: 'unpass', card: card('a') });
    expect(state).toEqual(initial());
  });

  it('앞서 서버가 받은 지나침은 그대로 둔다 — 실패한 사람 몫만 물린다', () => {
    let state = passedAndLeft(initial(), 'a');
    state = passedAndLeft(state, 'b');
    state = deckReducer(state, { type: 'unpass', card: card('b') });
    expect(ids(state.remaining)).toEqual(['b', 'c']);
    expect(ids(state.passed)).toEqual(['a']);
    expect(ids(state.history)).toEqual(['a']);
    expect(state.seen).toEqual(['a']);
  });

  it('물린 뒤 늦게 온 서버 목록이 그 사람을 다시 세우거나 겹쳐 세우지 않는다', () => {
    let state = passedAndLeft(initial(), 'a');
    state = deckReducer(state, { type: 'unpass', card: card('a') });
    /* 서버는 a 를 못 받았으니 a 는 아직 후보이고 보관함에 없다 — 덱 뒤에 채운 사람이 붙어 와도 a 는 맨 앞 한 장이다 */
    state = deckReducer(state, { type: 'sync', cards: ['a', 'b', 'c', 'd'].map(card), passed: [] });
    expect(ids(state.remaining)).toEqual(['a', 'b', 'c', 'd']);
    expect(state.passed).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it('물리지 않았으면 늦게 온 옛 목록이 떠난 사람을 되살리지 않는다 — seen 을 지우는 것은 물림뿐이다', () => {
    const state = deckReducer(passedAndLeft(initial(), 'a'), { type: 'sync', cards: ['a', 'b', 'c'].map(card), passed: [card('a')] });
    expect(ids(state.remaining)).toEqual(['b', 'c']);
  });

  it('실패 뒤의 실행 취소는 그 앞에 서버가 받은 사람을 꺼낸다', () => {
    let state = passedAndLeft(initial(), 'a');
    state = passedAndLeft(state, 'b');
    state = deckReducer(state, { type: 'unpass', card: card('b') });
    expect(state.history[0].candidateUserId).toBe('a');
    state = deckReducer(state, { type: 'restore', card: card('a'), passed: [] });
    expect(ids(state.remaining)).toEqual(['a', 'b', 'c']);
    expect(state.history).toEqual([]);
  });

  it('첫 지나침이 실패하면 되돌릴 이력이 없다 — 실행 취소가 서지 않는다', () => {
    const state = deckReducer(passedAndLeft(initial(), 'a'), { type: 'unpass', card: card('a') });
    expect(state.history[0]).toBeUndefined();
  });
});
