import type { DeckCard } from './deck-card';

export const PASSED_LIMIT = 20;
export type DeckState = {
  remaining: readonly DeckCard[];
  passed: readonly DeckCard[];
  history: readonly DeckCard[];
  seen: readonly string[];
};
type DeckEvent =
  | { type: 'sync'; cards: readonly DeckCard[]; passed: readonly DeckCard[] }
  | { type: 'pass'; card: DeckCard }
  | { type: 'unpass'; card: DeckCard; before: { passed: readonly DeckCard[]; history: readonly DeckCard[] } }
  | { type: 'leave'; id: string }
  | { type: 'restore'; card: DeckCard; passed?: readonly DeckCard[] };

/**
 * 순번은 표시용이다. 이동·복원은 언제나 그 동작을 시작한 사람의 ID를 따른다.
 *
 * **지나침은 서버보다 먼저 선다**(ADR 0115 「2026-10-08 덧」). `pass` 는 누르는 순간 보관함 · 이력에 넣고, `leave` 가 덱에서
 * 빼며 `seen` 에 적는다. 서버가 못 받았으면 `unpass` 가 그 셋을 한 사람 몫만 되돌린다 — 서버가 확인한 복원(`restore`)과
 * 이름을 가르는 까닭은 `restore` 는 서버가 보낸 보관함을 그대로 믿고, `unpass` 는 서버에 아무 일도 없었다는 것을 믿기 때문이다.
 */
/**
 * 물린 지나침이 밀어냈던 사람을 끝에 되세운다. `pass` 는 맨 앞에 넣고 `PASSED_LIMIT` 로 자르므로, 꽉 찬 목록에서는 끝 사람이
 * 밀려난다 — 실패해서 그 사람 몫만 빼면 목록이 하나 준다. 밀려난 사람은 지나치기 전 목록(`before`)에서 다시 셈한다.
 */
function withoutPass(current: readonly DeckCard[], before: readonly DeckCard[], id: string): readonly DeckCard[] {
  const kept = current.filter((card) => card.candidateUserId !== id);
  const pushedOut = before.filter((card) => card.candidateUserId !== id).slice(PASSED_LIMIT - 1);
  const back = pushedOut.filter((card) => !kept.some((k) => k.candidateUserId === card.candidateUserId));
  return [...kept, ...back].slice(0, PASSED_LIMIT);
}

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
  /*
    떠나기 전에 실패가 오면 그 사람은 아직 맨 앞에 서 있고, 떠난 뒤면 덱에 없다 — 어느 쪽이든 맨 앞에 한 장이다. `seen` 에서도
    빼야 뒤에 오는 서버 목록(`sync`)이 그 사람을 다시 걸러 내지 않는다.
  */
  if (event.type === 'unpass') return {
    remaining: [
      state.remaining.find((card) => card.candidateUserId === id) ?? event.card,
      ...state.remaining.filter((card) => card.candidateUserId !== id),
    ],
    passed: withoutPass(state.passed, event.before.passed, id),
    history: withoutPass(state.history, event.before.history, id),
    seen: state.seen.filter((seen) => seen !== id),
  };
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
