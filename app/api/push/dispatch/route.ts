import 'server-only';

import { after } from 'next/server';

import { keyedClient } from '@/app/keyed-client';

import { bearerAuthorized } from '../../cron/authorized';
import { dispatchPushBatch } from './dispatch';
import { pushSender } from './send';

/**
 * **웹 푸시의 배달 문** — DB 가 깨우면 기한이 된 배달 줄 한 묶음을 보낸다(ADR 0157).
 *
 * 깨우는 쪽은 DB 하나다. 배달 줄이 생기면 그 트랜잭션이 커밋된 뒤 `pg_net` 이, 그리고 1분마다 `pg_cron` 이 Vault 의
 * `push_dispatch_url` 로 `Authorization: Bearer <push_dispatch_secret>` 를 들고 POST 한다. 이 주소는 로그인 관문
 * 밖이라 아무나 두드릴 수 있다 — 두드려서 할 수 있는 일은 「기한이 된 것을 지금 보내라」뿐이지만, 그래도 비밀을
 * 든 깨움만 연다.
 *
 * **답은 먼저, 보내기는 뒤에**(`after`). `pg_net` 은 답을 오래 기다리지 않는다 — 송신 쉰 개를 다 기다리게 하면
 * 그쪽이 시간 초과를 남긴다. 받았다(202)고 답한 뒤 같은 함수 시간 안에서 보낸다.
 */

/** 송신 한 묶음(50 · 동시 6 · 하나 10초)이 넉넉히 들어간다 */
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!bearerAuthorized(request, process.env.PUSH_DISPATCH_SECRET)) {
    return new Response('unauthorized', { status: 401 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('웹 푸시 배달');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const sender = pushSender();
  after(async () => {
    await dispatchPushBatch(keyed, sender);
  });

  return Response.json({ accepted: true, configured: sender !== null }, { status: 202 });
}
