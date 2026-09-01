import { after } from 'next/server';

import { keyedClient } from '@/app/keyed-client';

import { collectReadingResult } from '../../../me/reading/collect';
import { verifyReadingWebhook } from '../../../me/reading/model';

/**
 * provider 가 두드리는 문 — **우리 다른 문과 규칙이 다르다.**
 *
 * 여기 오는 것은 인증된 사용자가 아니다. 세션도 쿠키도 없고, 자격은 요청 본문의 서명이
 * 든다. 그래서 `proxy.ts` 의 matcher 밖에 선다 — 로그인 관문을 지나게 하면 provider 가
 * 로그인 화면을 받는다.
 *
 * ## 하는 일은 셋까지다
 *
 *   서명 검증 → 도착을 적는다 → 2xx
 *
 * 회수·검사·저장은 **응답을 보낸 뒤**에 한다. 몇 초 안에 2xx 가 없으면 provider 는 최대
 * 72시간 같은 사건을 다시 보내는데, 무거운 일을 응답 전에 하면 그 시간이 길어질수록
 * 재전송이 늘고 늘어난 재전송이 다시 같은 일을 시킨다 — 스스로 커지는 고리다.
 *
 * ## 뒤 일이 실패해도 잃지 않는다
 *
 * `after` 안에서 던지면 아무도 못 듣는다. 그래도 도착은 이미 DB 에 적혀 있고 일감은
 * 아직 `submitted` 이므로, 복구기가 다음 바퀴에 집는다(ADR 0020).
 */

/** 뒤 일이 짧다 — 모델을 기다리는 것이 아니라 끝난 것을 가져오는 것이다 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  /**
   * **raw body 그대로 읽는다.** 파싱한 뒤 다시 문자열로 만들면 바이트가 달라져 서명이
   * 안 맞는다 — 공백 하나, 키 순서 하나면 충분하다.
   */
  const payload = await request.text();

  const event = await verifyReadingWebhook(payload, request.headers);
  if (!event.ok) {
    // 401 이다. 서명이 안 맞는 것은 우리 잘못이 아니라 그 요청이 우리 것이 아니라는 뜻이고,
    // 재전송을 부르지 않아야 한다.
    return new Response(event.detail, { status: 401 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('webhook 영수증');
  } catch {
    /**
     * 열쇠가 없으면 적지 못한다. **5xx 로 답해 재전송을 부른다** — 설정이 고쳐지면 그
     * 사건이 다시 와야 하고, 여기서 2xx 를 주면 그 결과는 영영 안 붙는다.
     */
    return new Response('not configured', { status: 503 });
  }

  const { data: fresh, error } = await keyed.rpc('record_reading_webhook_event', {
    p_event_id: event.id,
    p_response_id: event.responseId,
    p_event_type: event.type,
  });

  if (error) return new Response('could not record', { status: 503 });

  /**
   * **이미 적힌 사건은 다시 집지 않는다.** 재전송은 정상이고, 두 번 집으면 회수도 두 번
   * 돈다. 판정은 DB 가 했다 — 여기서 다시 세지 않는다.
   */
  if (fresh === true) {
    after(async () => {
      await collectReadingResult(event.responseId);
    });
  }

  return new Response(null, { status: 204 });
}
