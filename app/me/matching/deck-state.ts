import type { DeckCard } from './matching-experience';

export const PASSED_LIMIT = 20;
export type DeckState = {
  remaining: readonly DeckCard[];
  passed: readonly DeckCard[];
  history: readonly DeckCard[];
  seen: readonly string[];
};
export type DeckEvent =
  | { type: 'sync'; cards: readonly DeckCard[]; passed: readonly DeckCard[] }
  | { type: 'pass'; card: DeckCard }
  | { type: 'leave'; id: string }
  | { type: 'restore'; card: DeckCard; passed?: readonly DeckCard[] };

/** 순번은 표시용이다. 이동·복원은 언제나 그 동작을 시작한 사람의 ID를 따른다. */
export function deckReducer(state: DeckState, event: DeckEvent): DeckState {
  if (event.type === 'sync') {
    const available = new Map(event.cards.map((card) => [card.candidateUserId, card]));
    const kept = state.remaining.flatMap((card) => {
      const current = available.get(card.candidateUserId);
      if (!current) return [];
      available.delete(card.candidateUserId);
      return [current];
    });
    return {
      ...state,
      remaining: [...kept, ...available.values()].filter((card) => !state.seen.includes(card.candidateUserId)),
      passed: event.passed.slice(0, PASSED_LIMIT),
      history: state.history.filter((card) => event.passed.some((passed) => passed.candidateUserId === card.candidateUserId)),
    };
  }
  if (event.type === 'leave') return {
    ...state,
    remaining: state.remaining.filter((card) => card.candidateUserId !== event.id),
    seen: [...state.seen.filter((id) => id !== event.id), event.id],
  };
  const id = event.card.candidateUserId;
  if (event.type === 'pass') return {
    ...state,
    passed: [event.card, ...state.passed.filter((card) => card.candidateUserId !== id)].slice(0, PASSED_LIMIT),
    history: [event.card, ...state.history.filter((card) => card.candidateUserId !== id)].slice(0, PASSED_LIMIT),
  };
  return {
    remaining: [event.card, ...state.remaining.filter((card) => card.candidateUserId !== id && !state.passed.some((passed) => passed.candidateUserId === card.candidateUserId))],
    passed: event.passed ?? state.passed.filter((card) => card.candidateUserId !== id),
    history: state.history.filter((card) => card.candidateUserId !== id),
    seen: state.seen.filter((seen) => seen !== id),
  };
}
