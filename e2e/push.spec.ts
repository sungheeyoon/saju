import type { BrowserContext, Page } from '@playwright/test';

import { SERVICE_NAME } from '@/src/lib/brand';
import { pushPayloadFor } from '@/src/lib/push';

import { expect, sql, test } from './session';

/**
 * **설정의 「새 메시지 알림」 줄** — 켜고 끄고, 계정이 바뀌면 꺼진 것으로 보인다(ADR 0156).
 *
 * ## 가짜인 것 하나 — 푸시 서비스에 맺는 구독
 *
 * 헤드리스 Chromium 은 FCM 에 구독을 맺지 못한다(`pushManager.subscribe` 가 「push service error」). 그래서
 * `PushManager.prototype.subscribe` · `getSubscription` 만 페이지 안에서 가짜 구독을 돌려주게 바꾼다(`addInitScript`).
 * 나머지는 진짜다 — 권한(`grantPermissions`), 서비스 워커 등록(`/sw.js`), 서버 액션, DB 의 구독 줄.
 * 가짜 구독의 endpoint 는 FCM 모양(`https://fcm.googleapis.com/fcm/send/e2e-…` — 받는 푸시 서비스만 남긴다)이지만 이 시험의
 * 서버에는 VAPID 비밀 열쇠도 배달 비밀도 없어 어디로도 안 간다. 실제 송신과 암호화는 흐름 검사
 * `scripts/check-push.mjs` 가 가짜 푸시 서비스로 잰다.
 *
 * 이 시험은 VAPID 공개 열쇠가 실린 dev 서버가 필요하다 — 없으면 줄이 「지원 안 함」으로 선다.
 */

/** 가짜 구독 — 창마다 하나, 다시 열어도 같은 것(브라우저가 구독을 들고 있는 것처럼 `localStorage` 에 둔다) */
async function fakePushService(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const KEY = 'e2e-fake-push-subscription';
    const bytes = (length: number, fill: number) => {
      const out = new Uint8Array(length);
      out.fill(fill);
      out[0] = length === 65 ? 4 : fill;
      return out;
    };
    const b64url = (raw: Uint8Array) =>
      btoa(String.fromCharCode(...raw)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

    const make = (endpoint: string, key: ArrayBuffer | null) => ({
      endpoint,
      expirationTime: null,
      options: { userVisibleOnly: true, applicationServerKey: key },
      toJSON: () => ({ endpoint, keys: { p256dh: b64url(bytes(65, 7)), auth: b64url(bytes(16, 9)) } }),
      unsubscribe: async () => {
        localStorage.removeItem(KEY);
        return true;
      },
    });

    const held = () => {
      const saved = localStorage.getItem(KEY);
      if (saved === null) return null;
      const { endpoint, key } = JSON.parse(saved) as { endpoint: string; key: number[] };
      return make(endpoint, new Uint8Array(key).buffer);
    };

    if (!('PushManager' in window)) return;
    PushManager.prototype.getSubscription = async function () {
      return held() as unknown as PushSubscription;
    };
    PushManager.prototype.subscribe = async function (options?: PushSubscriptionOptionsInit) {
      const key = options?.applicationServerKey;
      const raw = key instanceof Uint8Array ? Array.from(key as Uint8Array) : [];
      const endpoint = `https://fcm.googleapis.com/fcm/send/e2e-${crypto.randomUUID()}`;
      localStorage.setItem(KEY, JSON.stringify({ endpoint, key: raw }));
      return held() as unknown as PushSubscription;
    };
  });
}

const subscriptionsOf = (email: string) =>
  Number(
    sql(`select count(*) from public.push_subscription s join auth.users u on u.id = s.user_id
         where u.email = '${email}'`),
  );

const row = (page: Page) => page.locator('section', { has: page.getByRole('heading', { name: '알림' }) });

/**
 * **새 헤드리스(`channel: 'chromium'`)로 돈다.** Playwright 의 기본인 headless shell 은 `grantPermissions` 를 해도
 * `Notification.permission` 이 늘 `denied` 다(2026-10-08 에 잼 — 새 헤드리스는 `granted`).
 */
test.use({ channel: 'chromium' });

test.describe('새 메시지 알림 (ADR 0156)', () => {
  test('켜면 이 기기의 구독이 서버에 서고, 끄면 지워진다 — 기본은 꺼짐이다', async ({ page, context, signedIn }) => {
    await context.grantPermissions(['notifications']);
    await fakePushService(context);

    await page.goto('/me/settings');
    const section = row(page);
    await expect(section.getByText('새 메시지 알림')).toBeVisible();
    await expect(section.getByRole('button', { name: '알림 켜기' })).toBeVisible();
    expect(subscriptionsOf(signedIn.email)).toBe(0);

    await section.getByRole('button', { name: '알림 켜기' }).click();
    await expect(section.getByRole('button', { name: '알림 끄기' })).toBeVisible();
    expect(subscriptionsOf(signedIn.email)).toBe(1);

    // 다시 열어도 켜짐이다 — 브라우저 구독과 서버 줄이 같은 것을 가리킨다
    await page.reload();
    await expect(row(page).getByRole('button', { name: '알림 끄기' })).toBeVisible();

    await row(page).getByRole('button', { name: '알림 끄기' }).click();
    await expect(row(page).getByRole('button', { name: '알림 켜기' })).toBeVisible();
    expect(subscriptionsOf(signedIn.email)).toBe(0);
  });

  test('앞 계정의 구독이 브라우저에 남은 채 다른 계정이 들어오면 그 구독을 풀고, 다음 계정은 꺼짐에서 새로 켠다', async ({
    page,
    context,
    signedIn,
    openAs,
  }) => {
    await context.grantPermissions(['notifications']);
    await fakePushService(context);

    await page.goto('/me/settings');
    await row(page).getByRole('button', { name: '알림 켜기' }).click();
    await expect(row(page).getByRole('button', { name: '알림 끄기' })).toBeVisible();

    // 같은 브라우저에 다른 계정의 쿠키만 갈아 끼운다 — 로그아웃을 안 거친 계정 전환
    const other = await openAs({ selfPerson: true });
    const theirs = await other.page.context().cookies();
    await other.page.close();
    await context.clearCookies();
    await context.addCookies(theirs);

    const before = await page.evaluate(() => localStorage.getItem('e2e-fake-push-subscription'));
    expect(before).not.toBeNull();

    await page.goto('/me/settings');
    await expect(row(page).getByRole('button', { name: '알림 켜기' })).toBeVisible();
    // 앞 계정의 구독은 이 브라우저에서 풀린다 — 앞 계정의 메시지 통보가 이 기기에 안 선다(`app/me/push/owner.ts`)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('e2e-fake-push-subscription'))).toBeNull();

    await row(page).getByRole('button', { name: '알림 켜기' }).click();
    await expect(row(page).getByRole('button', { name: '알림 끄기' })).toBeVisible();
    expect(subscriptionsOf(other.account.email)).toBe(1);
    const after = await page.evaluate(() => localStorage.getItem('e2e-fake-push-subscription'));
    expect(after).not.toBe(before);
    // 앞 계정의 서버 줄은 지울 권한이 없어 남는다 — 다음 송신에 푸시 서비스가 410 을 답하면 배달 문이 지운다
    expect(subscriptionsOf(signedIn.email)).toBe(1);
  });

  test('로그아웃하면 이 기기의 구독이 서버에서 지워진다', async ({ page, context, signedIn }) => {
    await context.grantPermissions(['notifications']);
    await fakePushService(context);

    await page.goto('/me/settings');
    await row(page).getByRole('button', { name: '알림 켜기' }).click();
    await expect(row(page).getByRole('button', { name: '알림 끄기' })).toBeVisible();
    expect(subscriptionsOf(signedIn.email)).toBe(1);

    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(subscriptionsOf(signedIn.email)).toBe(0);
  });

  test('브라우저가 알림을 막았으면 브라우저 설정으로 보낸다 — 켜기가 서지 않는다', async ({ page, context, signedIn }) => {
    expect(signedIn.email).toBeTruthy();
    await context.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'denied' });
    });

    await page.goto('/me/settings');
    await expect(row(page).getByText('브라우저 설정에서 이 사이트의 알림을 허용해 주세요', { exact: false })).toBeVisible();
    await expect(row(page).getByRole('button', { name: '알림 켜기' })).toHaveCount(0);
  });

  test('서비스 워커는 푸시를 받으면 서비스명과 한 줄만 세운다 — 닉네임 · 본문이 없다', async ({ page, context, signedIn }) => {
    expect(signedIn.email).toBeTruthy();
    await context.grantPermissions(['notifications']);
    await fakePushService(context);

    await page.goto('/me/settings');
    await row(page).getByRole('button', { name: '알림 켜기' }).click();
    await expect(row(page).getByRole('button', { name: '알림 끄기' })).toBeVisible();

    // 진짜 워커의 진짜 처리기에 PushEvent 를 넘긴다 — 페이로드에 다른 칸이 끼어 와도 옮기지 않는지까지
    const matchId = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    const notes = await worker.evaluate(async (text) => {
      // 워커 전역의 타입(WebWorker lib)은 이 저장소의 tsconfig 에 없다 — 쓰는 만큼만 적는다
      const scope = self as unknown as {
        PushEvent: new (type: string, init: { data: Uint8Array }) => Event;
        dispatchEvent: (event: Event) => boolean;
        registration: { getNotifications: () => Promise<Notification[]> };
      };
      const event = new scope.PushEvent('push', { data: new TextEncoder().encode(text) });
      const pending: Promise<unknown>[] = [];
      Object.defineProperty(event, 'waitUntil', { value: (work: Promise<unknown>) => pending.push(work) });
      scope.dispatchEvent(event);
      await Promise.all(pending);
      const listed = await scope.registration.getNotifications();
      return listed.map((note) => ({ title: note.title, body: note.body, tag: note.tag, data: note.data }));
    }, JSON.stringify({ ...pushPayloadFor(matchId), body: '비밀 본문', nickname: '민지' }));

    expect(notes).toEqual([
      { title: SERVICE_NAME, body: '새 메시지가 왔어요', tag: `chat-${matchId}`, data: { url: `/me/chat/${matchId}` } },
    ]);
  });
});
