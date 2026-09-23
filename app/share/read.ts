import { dbFailure } from '../db-error';

import type { ShareKind } from './path';
import { supabaseForShared } from './public-client';

/**
 * **공유본을 읽는 문** — 로그인 없이 지나는 유일한 읽기다(ADR 0063·0078).
 *
 * 화면에서 꺼내 둔 까닭은 둘이다. 하나는 이 읽기가 **익명에게 열린 유일한 문**이라
 * 무엇이 나가는지가 한 자리에 적혀 있어야 하고, 다른 하나는 화면 안에 있는 동안
 * 「없는 링크일 때」와 「문이 터졌을 때」를 재는 자리가 없었기 때문이다.
 *
 * ## 없는 링크와 못 여는 링크는 여전히 안 가른다
 *
 * 문이 0행으로 답하므로 여기에도 가를 값이 없다 — 토큰이 틀렸든 지워진 계정의 것이든
 * `null` 하나다. 갈래가 다른 토큰도 같다: 주소가 맡은 갈래와 다르면 **안 연다**.
 * 미리보기가 거짓말을 하는 자리라 화면이 아니라 이 문이 막는다.
 *
 * ## 그러나 **터진 것은 없는 것이 아니다**
 *
 * 앞서는 `error` 와 0행이 같은 `notFound()` 로 갔다. 그러면 DB 가 멎은 동안 멀쩡한
 * 링크를 받은 사람 전부가 「없어진 풀이」를 보고, 보낸 사람에게 다시 달라고 한다.
 * 던지면 오류 화면이 서고 **그 말은 다시 와 보라는 말**이다(ADR 0078).
 *
 * 노출은 안 넓어진다 — 던지는 말은 한 문을 지나 우리 문장으로만 나가고(`dbFailure`),
 * 토큰이 실재하는지는 여전히 아무 답도 안 한다.
 */
type SharedReading = {
  readonly metaphor: string | null;
  readonly score: number | null;
  readonly body: string;
  readonly nameA: string | null;
  readonly nameB: string | null;
};

export async function sharedReadingOf(
  token: string,
  expect: ShareKind,
): Promise<SharedReading | null> {
  const supabase = supabaseForShared();

  const { data, error } = await supabase.rpc('shared_reading', { p_token: token });
  if (error) throw dbFailure(error, 'shared_reading');

  const row = (data ?? [])[0];
  if (row === undefined || row.kind !== expect) return null;

  /* 생성 타입은 **반환의 `null` 허용을 안 적는다** — 한 사람 글에는 `name_b` 가 없다 */
  return {
    metaphor: row.metaphor ?? null,
    score: row.score ?? null,
    body: row.body,
    nameA: row.name_a ?? null,
    nameB: row.name_b ?? null,
  };
}
