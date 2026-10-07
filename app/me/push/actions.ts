'use server';

import { pushSubscriptionShapeOk, type PushSubscriptionKeys } from '@/src/lib/push';

import { supabaseOnServer } from '../../auth/server-client';
import { userFacingDbMessage } from '../../db-error';
import type { SaveResult } from '../../save-result';

/**
 * 이 기기의 웹 푸시 구독 — **로그인한 사람의 세션으로** 남기고 지운다(ADR 0156).
 *
 * 누구의 구독인지는 DB 가 `auth.uid()` 로 정한다. 앱은 사람 id 를 싣지 않는다. 같은 endpoint 를 다른 계정이 남기면
 * DB 가 그 endpoint 를 새 계정으로 옮긴다 — 한 기기가 앞 사람의 통보를 받지 않는다.
 */

const SHAPE_REFUSED = '이 브라우저의 알림 정보를 읽지 못했어요. 다시 시도해 주세요.';

export async function savePushSubscription(keys: PushSubscriptionKeys): Promise<SaveResult> {
  if (!pushSubscriptionShapeOk(keys)) return { ok: false, message: SHAPE_REFUSED };

  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: keys.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'save_push_subscription') };
  return { ok: true };
}

/** 지울 구독이 서버에 없어도 됐다고 답한다 — 끄려던 상태가 이미 그렇다 */
export async function removePushSubscription(endpoint: string): Promise<SaveResult> {
  const supabase = await supabaseOnServer();
  const { error } = await supabase.rpc('remove_push_subscription', { p_endpoint: endpoint });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'remove_push_subscription') };
  return { ok: true };
}

/**
 * 이 브라우저의 구독이 **지금 계정에** 남아 있는가. 앞 계정이 켠 구독이 브라우저에 남아 있으면 거짓이다 — 설정 줄은
 * 그때 「꺼짐」이다.
 */
export async function pushSubscriptionRegistered(
  endpoint: string,
): Promise<{ ok: true; registered: boolean } | { ok: false; message: string }> {
  const supabase = await supabaseOnServer();
  const { data, error } = await supabase.rpc('push_subscription_registered', { p_endpoint: endpoint });
  if (error) return { ok: false, message: userFacingDbMessage(error, 'push_subscription_registered') };
  return { ok: true, registered: data === true };
}
