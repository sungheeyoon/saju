import type { ReadingNewsRead } from './actions';
import type { PageVisibility } from './watch-run';

/**
 * **결과 화면이 보인 글의 완성 소식을 읽음으로 바꾼다** — 언제 · 몇 번 부르는가만 든다(ADR 0157 「2026-10-10 덧」).
 * 무엇을 바꾸는가는 DB 가 답한다(`mark_reading_ready_read` — 그 풀이 · 내 것 · 안 읽은 것만).
 *
 * 브라우저에서 화면이 선 뒤에만 부른다. 서버가 그리는 자리에서 부르면 링크의 미리 가져오기만으로도 읽은 셈이 된다(소식 화면의
 * `ReadNotificationsOnVisit` 와 같은 까닭). 숨긴 탭에서 열린 화면은 보일 때까지 기다린다 — 아무도 안 본 글이다.
 *
 * DOM 을 모른다 — 보이는가는 `visibility` 가, 부르는 것은 `mark` 가 든다. 그래서 손으로 든 값으로 그대로 잰다(`news-read.test.ts`).
 */

/* 글의 열쇠는 기다림의 판단과 함께 쓴다(ADR 0211) */
export { newsKeyOf } from '@/src/lib/reading/reading-flow';

/**
 * 탭이 보이면 `send` 를 **한 번** 부른다 — 지금 보이면 곧바로, 숨어 있으면 처음 보일 때. 돌려준 함수가 기다리기를 걷는다.
 */
export function readNewsWhenSeen({
  visibility,
  send,
}: {
  visibility: PageVisibility;
  send: () => void;
}): () => void {
  let waiting = true;
  let stopListening: () => void = () => {};

  const tryNow = () => {
    if (!waiting || visibility.hidden()) return;
    waiting = false;
    stopListening();
    send();
  };

  stopListening = visibility.onChange(tryNow);
  tryNow();

  return () => {
    waiting = false;
    stopListening();
  };
}

/**
 * 읽음으로 바꾸고, **실제로 바뀐 것이 있을 때만** 머리글의 종을 다시 세게 한다.
 *
 * 부속이다 — 못 바꿔도 화면에는 아무것도 안 세운다. 소식은 안 읽은 채 남고 소식 화면에 들어가면 읽음이 된다. 던져도(끊긴 왕복)
 * 같다. 그래서 답을 기다리는 사람이 없다.
 */
export async function markAndAnnounce(
  readingId: string,
  mark: (readingId: string) => Promise<ReadingNewsRead>,
  announce: () => void,
): Promise<void> {
  let answer: ReadingNewsRead;
  try {
    answer = await mark(readingId);
  } catch {
    return;
  }
  if (answer.ok && answer.marked > 0) announce();
}
