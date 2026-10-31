/**
 * 화면이 읽기를 부르는 길 — **던져도 그 화면의 실패 값으로 끝난다.** 받지 않은 거절은 첫 읽기를 기다리는 화면을 빈 채로 멈춘다.
 * 망이 끊긴 것은 supabase-js 가 `{ error }` 로 답하니 던지는 것은 저장소 실패와 응답을 옮기는 코드다.
 * 까닭은 기록에만 간다 — 화면의 글자는 `fallback` 이 고른다. `scripts/mobile-reads.test.ts` 가 받지 않은 `.then(` 을 센다.
 */
export function settled<T, F>(reading: Promise<T>, where: string, fallback: () => F): Promise<T | F> {
  return reading.catch((thrown: unknown) => {
    console.error(where, thrown instanceof Error ? thrown.name : 'unknown');
    return fallback();
  });
}
