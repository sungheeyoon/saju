import type { BetaDates, Operator } from './notice';

/**
 * 적힌 값인가 — **`null` 만 보면 안 된다.**
 *
 * 타입 단언 뒤에 `=== null` 만 보고 있었다. 그러면 빈 문자열과, 마이그레이션보다 앱이
 * 먼저 배포됐을 때의 `undefined` 가 그대로 지나간다 — 「연락처가 있다」로 판정되면서
 * 화면에는 아무것도 안 적히는 자리가 된다. 없는 것보다 나쁘다.
 */
const filled = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * 지금 안내를 서버에서 읽는다 — 날짜와 **누가 약속하는가**. 하나라도 없으면 `null`.
 *
 * `null` 을 「모른다」로 흘려보내지 않는다. 부르는 화면은 날짜를 못 받으면 안내를 세울
 * 수 없고, 그러면 스스로 「아직 시작할 수 없습니다」를 말한다(ADR 0024).
 *
 * 로그인 없이도 읽힌다 — 처리방침은 초대 메일에 실리므로 그래야 한다. 내주는 것은
 * 날짜 둘뿐이고 그 둘은 처리방침이 이미 공개하는 값이다.
 */
export async function scheduleFrom(
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ scheduleId: number; dates: BetaDates; operator: Operator } | null> {
  const { data, error } = await rpc('current_beta_schedule');
  if (error) return null;

  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (row === undefined) return null;

  /*
    **셋이 다 있어야 안내가 선다.** 날짜만 있고 연락처가 없으면 열람·정정·삭제를
    어디에 요구하는지 말할 수 없다 — 지키는 것이 없는 문장만 남는다. 반쪽은 안 낸다.
  */
  const name = filled(row.operator_name);
  const officer = filled(row.operator_officer);
  const contact = filled(row.operator_contact);
  if (name === null || officer === null || contact === null) return null;

  return {
    scheduleId: row.schedule_id as number,
    dates: {
      endsOn: row.ends_on as string,
      purgeBy: row.purge_by as string,
      purgeWithinDays: row.purge_within_days as number,
    },
    operator: { name, officer, contact },
  };
}
