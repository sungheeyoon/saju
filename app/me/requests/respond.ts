import type { SupabaseClient } from '@supabase/supabase-js';
import { after } from 'next/server';

import { REQUEST_STATUSES, type RequestStatus } from '@/src/lib/consent';
import type { Database } from '@/src/lib/db';

import { answerOfThrown, userFacingDbMessage } from '../../db-error';
import { sendAcceptedMatchReading } from '../reading/pipeline';
import { matchOfAcceptedRequest } from './inbox';

/**
 * 받은 요청에 답하는 몸통 — 웹의 액션(`actions.ts`)과 앱의 문(`app/api/mobile/matching/respond`, ADR 0211)이 함께 탄다.
 *
 * **여기서 판정하지 않는다.** 내가 받는 쪽인가, 아직 pending 인가, 잡아 둔 입력 판(`input_version`)이 지금과 같은가 — 셋 다 RPC 안에
 * 있다. 여기서 다시 물으면 답하는 자리가 둘이 되고, 어긋났을 때 열려 있는 쪽은 언제나 더 바깥이다.
 *
 * **제출은 그 사람의 수락이 `accepted` 로 답한 뒤에만 나간다.** 열쇠가 여는 문(`match_run_awaiting_send`)은 요청 id 만 보고 사람을 안
 * 본다. 그래서 「제출만 하는 문」을 앱에 따로 열지 않는다 — 남의 요청 id 를 두드릴 길이 생긴다.
 */
export function statusOf(value: unknown): RequestStatus | null {
  return REQUEST_STATUSES.find((known) => known === value) ?? null;
}

export async function respondAndSend(
  client: SupabaseClient<Database>,
  requestId: string,
  accept: boolean,
): Promise<{ ok: true; status: RequestStatus } | { ok: false; message: string }> {
  const { data, error } = await client.rpc('respond_to_match_request', {
    p_request_id: requestId,
    p_accept: accept,
  });

  if (error) return { ok: false, message: userFacingDbMessage(error, 'respond_to_match_request') };

  const status = statusOf(data);
  if (status === null) return { ok: false, message: '답을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.' };

  /**
   * **동의하면 풀이가 저절로 만들어진다** (ADR 0038).
   *
   * 시도는 수락 트랜잭션 안에서 이미 열렸다 — 청한 사람 이름으로. 여기서 하는 것은
   * 그것을 떠나보내는 일뿐이고, 그 일은 응답 뒤에 돈다: 수락을 누른 사람이 「수락했다」를
   * 보기까지 모델 왕복을 기다릴 이유가 없다(ADR 0020 과 같은 규율).
   *
   * **던지지 않는다.** 응답은 이미 나갔고 부르는 쪽이 없다. 실패하면 `submitFrozen` 이 시도를
   * 닫고, 결과 화면에 만드는 버튼이 돌아온다.
   */
  if (status === 'accepted') {
    after(async () => {
      try {
        await sendAcceptedMatchReading(requestId);
      } catch (thrown) {
        // 여기까지 온 것은 우리가 못 적은 경우다. 복구기가 deadline 에 닫는다 — 까닭만 기록에 남긴다.
        console.error('respond: sendAcceptedMatchReading', thrown);
      }
    });
  }

  return { ok: true, status };
}

/**
 * **수락하면 그 Match 의 채팅방으로 간다**(ADR 0130 「2026-10-11 저녁」) — 단추가 「수락하고 대화하기」다. 그 Match 를 못 찾거나 읽기가
 * 실패해도 수락은 이미 끝났다 — 실패로 답하지 않고 옮길 곳 없이 답한다. 화면은 카드를 내리고 인연 탭에 남는다.
 * 못 읽은 까닭은 `answerOfThrown` 이 기록에 남긴다(DB 실패면 `dbFailure` 가 이미 남겼다).
 */
export const acceptedMatchIdOf = (requestId: string, client?: SupabaseClient<Database>): Promise<string | null> =>
  matchOfAcceptedRequest(requestId, client).catch((thrown: unknown) => {
    answerOfThrown(thrown, 'matchOfAcceptedRequest');
    return null;
  });
