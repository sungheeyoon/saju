'use client';

import {
  applicationServerKeyOf,
  looksLikeIos,
  pushRowState,
  type PushEnvironment,
  type PushRowState,
  type PushToggleResult,
} from '@/src/lib/push';

import { pushSubscriptionRegistered, removePushSubscription, savePushSubscription } from './actions';

/**
 * **이 브라우저의 웹 푸시** — 서비스 워커 · 권한 · 구독을 재고 바꾼다(ADR 0156). 설정 줄(`app/me/settings/push-row.tsx`)과
 * 로그아웃(`app/auth/sign-out.ts`)이 부른다.
 *
 * 서비스 워커는 알림을 켤 때 처음 등록한다 — 켜지 않은 사람의 브라우저에는 워커가 서지 않는다. 등록 범위는 사이트
 * 전체(`/`)다: 알림을 눌렀을 때 열린 창이 어느 주소에 있든 그 창을 방으로 옮기려면 그 창을 이 워커가 맡아야 한다.
 */

const WORKER_URL = '/sw.js';

/** 빌드 때 박히는 공개 열쇠 — 없으면 이 배포는 웹 푸시를 안 켠다 */
const PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function standalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function sameKey(held: ArrayBuffer | null, wanted: Uint8Array): boolean {
  if (held === null) return false;
  const bytes = new Uint8Array(held);
  return bytes.length === wanted.length && bytes.every((byte, i) => byte === wanted[i]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** 줄이 설 상태 — 재지 못하면(서버 확인 실패) 던지지 않고 `off` 로 본다. 켜진 척하지 않는다 */
export async function readPushRowState(): Promise<PushRowState> {
  const env: PushEnvironment = {
    supported: supported(),
    configured: PUBLIC_KEY !== '',
    ios: looksLikeIos(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    standalone: standalone(),
    permission: 'Notification' in window ? Notification.permission : 'default',
    subscribed: false,
    registered: false,
  };
  if (!env.supported || !env.configured) return pushRowState(env);

  const subscription = await currentSubscription().catch(() => null);
  env.subscribed = subscription !== null;
  if (subscription !== null && env.permission === 'granted') {
    const answer = await pushSubscriptionRegistered(subscription.endpoint).catch(() => null);
    env.registered = answer?.ok === true && answer.registered;
  }
  return pushRowState(env);
}

/**
 * 켠다 — **누름 안에서 곧장** 권한을 묻는다. Safari 는 사용자 제스처 밖의 권한 요청을 거절하므로 이 함수의 첫 `await`
 * 가 `Notification.requestPermission()` 이다. 그 뒤 워커를 등록하고 구독을 맺어 서버에 남긴다. 이미 구독이 있으면
 * (앞 계정이 켠 것 포함) 같은 구독을 돌려받아 지금 계정으로 다시 남긴다.
 */
export async function turnOnPush(): Promise<PushToggleResult> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'denied', state: permission === 'denied' ? 'denied' : 'off' };
  }

  try {
    await navigator.serviceWorker.register(WORKER_URL, { scope: '/', updateViaCache: 'none' });
    const registration = await navigator.serviceWorker.ready;
    const key = applicationServerKeyOf(PUBLIC_KEY);
    let subscription = await registration.pushManager.getSubscription();
    // 열쇠를 바꾼 뒤의 옛 구독은 새 열쇠로 못 보낸다 — 풀고 다시 맺는다
    if (subscription !== null && !sameKey(subscription.options.applicationServerKey, key)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

    const json = subscription.toJSON();
    const saved = await savePushSubscription({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    });
    if (!saved.ok) return { ok: false, reason: 'failed', state: 'off' };
    return { ok: true, state: 'on' };
  } catch {
    return { ok: false, reason: 'failed', state: 'off' };
  }
}

/** 끈다 — 서버의 구독을 먼저 지우고 브라우저 구독을 푼다. 서버에서 못 지웠으면 브라우저 것도 그대로 둔다 */
export async function turnOffPush(): Promise<PushToggleResult> {
  try {
    const subscription = await currentSubscription();
    if (subscription === null) return { ok: true, state: 'off' };
    const removed = await removePushSubscription(subscription.endpoint);
    if (!removed.ok) return { ok: false, reason: 'failed', state: 'on' };
    await subscription.unsubscribe();
    return { ok: true, state: 'off' };
  } catch {
    return { ok: false, reason: 'failed', state: 'on' };
  }
}

/** 로그아웃이 기다리는 최대 시간 — 넘으면 이 기기의 구독을 못 지운 채 나간다 */
const SIGN_OUT_WAIT_MS = 3000;

/**
 * 로그아웃 전에 이 기기의 구독을 서버에서 지운다. **실패해도 던지지 않는다** — 로그아웃은 그대로 간다. 서버에 남은
 * 구독은 다음 계정이 같은 브라우저에서 켜면 옮겨지고(DB), 아니면 브라우저 구독을 풀었으니 보낼 때 410 을 받고 지워진다.
 */
export async function forgetThisDevicePush(): Promise<void> {
  const work = (async () => {
    const subscription = await currentSubscription();
    if (subscription === null) return;
    await removePushSubscription(subscription.endpoint).catch(() => undefined);
    await subscription.unsubscribe().catch(() => false);
  })().catch(() => undefined);
  await Promise.race([work, new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
}
