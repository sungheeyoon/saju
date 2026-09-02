import type { BetaDates } from './notice';

/**
 * 지금 일정을 서버에서 읽는다 — **없으면 `null`.**
 *
 * `null` 을 「모른다」로 흘려보내지 않는다. 부르는 화면은 날짜를 못 받으면 안내를 세울
 * 수 없고, 그러면 스스로 「아직 시작할 수 없습니다」를 말한다(ADR 0024).
 *
 * 로그인 없이도 읽힌다 — 처리방침은 초대 메일에 실리므로 그래야 한다. 내주는 것은
 * 날짜 둘뿐이고 그 둘은 처리방침이 이미 공개하는 값이다.
 */
export async function scheduleFrom(
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<BetaDates | null> {
  const { data, error } = await rpc('current_beta_schedule');
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  return {
    endsOn: row.ends_on as string,
    purgeBy: row.purge_by as string,
    purgeWithinDays: row.purge_within_days as number,
  };
}
