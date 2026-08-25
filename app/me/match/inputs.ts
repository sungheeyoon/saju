import { createClient } from '@supabase/supabase-js';

import type { StoredRevision } from '../../revision';

/**
 * **매인 판본의 계산 입력을 읽는 유일한 자리 — 열쇠를 드는 유일한 자리이기도 하다.**
 *
 * 이 저장소는 사용자 경로에 `service_role` 을 쓰지 않는다(ADR 0003·0006). 여기가
 * ADR 0010 이 뚫은 한 구멍이고, 구멍의 모양은 DB 가 정해 뒀다:
 *
 * - 열쇠가 부를 수 있는 함수는 **`match_calculation_inputs` 하나**다. 표 권한은
 *   여전히 하나도 없다.
 * - 그 함수는 **`match_id` 만 받는다.** 판본 id 를 손으로 댈 자리가 없으므로,
 *   어떤 Match 도 매지 않은 판본은 이 문으로 나오지 않는다.
 * - **사용자 id 를 넘기지 않는다.** 볼 자격은 여기 오기 전에 `my_match_scope` 가
 *   `auth.uid()` 로 답한다 — 앱이 「이 사람입니다」를 대는 모양은 ADR 0004 가
 *   거부한 것이다.
 *
 * 그리고 여기서 읽은 것은 **브라우저로 나가지 않는다.** 나가는 것은 잘린 결과뿐이다
 * (`result.ts`). 그 규율이 지켜지는지는 밖에서 잰다 — 흐름 검사가 결과 화면 본문에
 * 상대의 생년월일과 출생지가 없는지 실제 스택에 대고 본다.
 */

/**
 * 열쇠가 없거나, 있어도 그 Match 의 판본이 나오지 않았다.
 *
 * **없는 Match 와 다른 말이다.** Match 와 두 사람의 동의는 그대로 있고 읽는 쪽이 지금
 * 못 읽는 것이므로, 그렇게 말하고 멈춘다(`UnreadableRevisionError` 와 같은 규율).
 */
export class ResultClosedError extends Error {
  constructor(reason: string) {
    super(`공유 결과를 열지 못했습니다 — ${reason}`);
    this.name = 'ResultClosedError';
  }
}

/** `match_calculation_inputs` 가 내주는 한 줄 — 판본 하나의 계산 입력 */
type InputRow = StoredRevision & { revision_id: string };

/**
 * 그 Match 가 매어 둔 두 판본의 계산 입력 — **판본 id 로 찾을 수 있게 돌려준다.**
 *
 * 어느 쪽이 내 것인지는 여기서 정하지 않는다. 그 답은 `my_match_scope` 가 이미
 * 냈고, 두 번 판정하면 두 자리가 언젠가 갈린다.
 *
 * @throws {ResultClosedError} 열쇠가 없거나 두 판본이 다 나오지 않을 때.
 */
export async function pinnedInputs(matchId: string): Promise<Map<string, StoredRevision>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  /**
   * 이름 둘을 다 본다 — Vercel 통합이 넣어 주는 이름과 Supabase CLI 가 내주는 이름이
   * 다르다. 없는 것을 빈 문자열로 메우지 않는다: 빈 키로 만든 client 는 조용히
   * 「권한 없음」을 내고, 그러면 열쇠가 없는 배포와 정말 못 보는 Match 가 같은 얼굴이 된다.
   */
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new ResultClosedError(
      '서버에 계산 입력을 읽을 열쇠가 없습니다 (SUPABASE_SECRET_KEY)',
    );
  }

  const keyed = createClient(url, key, {
    // 이 client 에는 사용자가 없다. 쿠키도 세션도 들지 않는다 — 들면 그 세션이
    // 열쇠의 권한으로 도는 순간이 생긴다.
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await keyed.rpc('match_calculation_inputs', { p_match_id: matchId });
  if (error) throw new ResultClosedError(error.message);

  const rows = (data ?? []) as InputRow[];

  /**
   * **둘이 다 나와야 한다.** 하나만 나오면 한쪽 명식으로 궁합을 지어낼 수 없고,
   * 지어낼 수 없는 것을 기본값으로 메우면 두 사람이 동의한 적 없는 결과가 선다.
   */
  if (rows.length !== 2) {
    throw new ResultClosedError(`매인 판본 둘 중 ${rows.length}개만 읽혔습니다`);
  }

  return new Map(
    rows.map(({ revision_id, ...revision }) => [revision_id, revision as StoredRevision]),
  );
}
