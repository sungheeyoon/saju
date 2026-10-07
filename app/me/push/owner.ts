import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/src/lib/db';

import { read, unread, type SkippableRead } from '../../db-error';

/**
 * **이 브라우저의 푸시 구독이 지금 계정의 것이 아니면 푼다**(ADR 0156 「로그아웃 · 계정 전환」).
 *
 * 로그아웃 단추는 구독을 서버에서 먼저 지운다. 그런데 세션이 만료되거나 쿠키만 바뀌어 다른 계정으로 들어오면 그 길을 안
 * 지난다 — 브라우저에는 앞 계정의 구독이 남고, 앞 계정에게 메시지가 올 때마다 이 기기에 본문 없는 알림이 선다. 그래서
 * 로그인한 화면이 서면 한 번 묻는다 — 이 브라우저의 구독이 **지금 계정에** 있나(`push_subscription_registered`). 없다고
 * 답하면 브라우저 구독을 푼다. 앞 계정의 서버 줄은 지울 권한이 없어 남지만, 다음 송신에 푸시 서비스가 404/410 을 답하고
 * 배달 문이 지운다.
 *
 * 모르면(서버 실패 · 지원 안 함) 아무것도 안 한다 — 켜 둔 사람의 알림을 잘못 끄지 않는다. 같은 계정이 다시 로그인했으면
 * 답이 참이라 그대로다. 브라우저 클라이언트로 곧장 묻는다 — 사람이 낸 요청이 아니라 활동으로 적히지 않게(G-76).
 *
 * @returns 풀었으면 참
 */
export async function releaseOthersPush(client: SupabaseClient<Database>): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || typeof PushManager === 'undefined') {
    return false;
  }
  // 워커를 등록하지 않는다 — 알림을 켠 적 없는 브라우저에는 아무것도 없다
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription === null) return false;

  const registered = await registeredToMe(client, subscription.endpoint);
  if (!registered.ok || registered.value) return false;

  return subscription.unsubscribe();
}

/** 이 endpoint 가 지금 계정에 있나 — 못 읽으면 「모른다」다(부르는 쪽이 아무것도 안 한다) */
async function registeredToMe(client: SupabaseClient<Database>, endpoint: string): Promise<SkippableRead<boolean>> {
  const { data, error } = await client.rpc('push_subscription_registered', { p_endpoint: endpoint });
  if (error) return unread(error, 'push_subscription_registered');
  return read(data === true);
}
