import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

import { SERVICE_NAME } from '@/src/lib/brand';
import { pushPayloadFor } from '@/src/lib/push';

/**
 * **서비스 워커(`public/sw.js`)의 처리기를 가짜 `self` 안에서 돌린다.** 번들러를 안 지나는 파일이라 앱의 상수를 못
 * 부르므로, 서비스명과 주소 모양이 앱과 같은지도 여기서 견준다(ADR 0157).
 */
const SOURCE = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://app.example';
const MATCH = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

type FakeClient = {
  url: string;
  focused: boolean;
  visibilityState: 'visible' | 'hidden';
  focus: ReturnType<typeof vi.fn>;
  navigate: ReturnType<typeof vi.fn>;
};

const client = (url: string, focused = false, visible = focused): FakeClient => {
  const self: FakeClient = {
    url,
    focused,
    visibilityState: visible ? 'visible' : 'hidden',
    focus: vi.fn(async () => self),
    navigate: vi.fn(async () => self),
  };
  return self;
};

function worker(windows: FakeClient[] = []) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: Array<{ title: string; options: Record<string, unknown> }> = [];
  const opened: string[] = [];
  const posted: Array<{ url: string; body: unknown }> = [];
  const subscribe = vi.fn();
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async (url: string) => {
        opened.push(url);
      }),
    },
    registration: {
      showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
      }),
      pushManager: { subscribe },
    },
  };
  const fetch = vi.fn(async (url: string, init: { body: string }) => {
    posted.push({ url, body: JSON.parse(init.body) });
    return new Response(null, { status: 204 });
  });
  runInNewContext(SOURCE, { self, URL, fetch, JSON });

  /** 처리기를 부르고 `waitUntil` 에 넘긴 일을 끝까지 기다린다 */
  const fire = async (type: string, event: Record<string, unknown>) => {
    const pending: Promise<unknown>[] = [];
    handlers[type]({ ...event, waitUntil: (work: Promise<unknown>) => pending.push(work) });
    await Promise.all(pending);
  };
  return { fire, shown, opened, posted, subscribe, self };
}

const pushEvent = (value: unknown) => ({
  data: { json: () => (typeof value === 'string' ? JSON.parse(value) : value) },
});

describe('push — 알림을 세운다', () => {
  it('제목은 서비스명, 본문은 한 줄 — 닉네임 · 본문을 세울 자리가 없다', async () => {
    const { fire, shown } = worker();

    await fire('push', pushEvent(pushPayloadFor(MATCH)));

    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe(SERVICE_NAME);
    expect(shown[0].options).toMatchObject({
      body: '새 메시지가 왔어요',
      tag: `chat-${MATCH}`,
      data: { url: `/me/chat/${MATCH}` },
      silent: false,
      renotify: true,
    });
  });

  it('페이로드에 다른 칸이 끼어 와도 알림에 옮기지 않는다', async () => {
    const { fire, shown } = worker();

    await fire('push', pushEvent({ ...pushPayloadFor(MATCH), body: '안녕', nickname: '민지' }));

    expect(JSON.stringify(shown[0])).not.toMatch(/안녕|민지/);
  });

  it('모르는 모양이어도 알림은 세운다 — 대화 목록으로 간다', async () => {
    const { fire, shown } = worker();

    await fire('push', pushEvent({ url: 'https://evil.example/', tag: 'x' }));
    await fire('push', { data: { json: () => { throw new Error('not json'); } } });
    await fire('push', { data: null });

    expect(shown).toHaveLength(3);
    for (const { options } of shown) expect(options.data).toEqual({ url: '/me/chat' });
  });

  it('그 방을 앞에 띄워 보고 있어도 알림은 세우되 조용히 바꾼다', async () => {
    const { fire, shown } = worker([client(`${ORIGIN}/me/chat/${MATCH}`, true)]);

    await fire('push', pushEvent(pushPayloadFor(MATCH)));

    expect(shown).toHaveLength(1);
    expect(shown[0].options).toMatchObject({ silent: true, renotify: false, tag: `chat-${MATCH}` });
  });

  it('다른 방을 보고 있으면 울린다', async () => {
    const { fire, shown } = worker([client(`${ORIGIN}/me/chat`, true)]);

    await fire('push', pushEvent(pushPayloadFor(MATCH)));

    expect(shown[0].options).toMatchObject({ silent: false });
  });
});

describe('notificationclick — 그 방으로', () => {
  const click = (url: unknown) => ({ notification: { close: vi.fn(), data: { url } } });

  it('열린 창이 있으면 앞으로 가져와 그 방으로 옮긴다 — 새 창을 열지 않는다', async () => {
    const tab = client(`${ORIGIN}/me/home`);
    const { fire, opened } = worker([tab]);

    await fire('notificationclick', click(`/me/chat/${MATCH}`));

    expect(tab.focus).toHaveBeenCalled();
    expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/me/chat/${MATCH}`);
    expect(opened).toEqual([]);
  });

  it('앞에 있는 창을 고른다', async () => {
    const back = client(`${ORIGIN}/me/home`);
    const front = client(`${ORIGIN}/me/discovery`, true);
    const { fire } = worker([back, front]);

    await fire('notificationclick', click(`/me/chat/${MATCH}`));

    expect(front.navigate).toHaveBeenCalled();
    expect(back.navigate).not.toHaveBeenCalled();
  });

  it('창이 없으면 새 창을 연다', async () => {
    const { fire, opened } = worker([]);

    await fire('notificationclick', click(`/me/chat/${MATCH}`));

    expect(opened).toEqual([`${ORIGIN}/me/chat/${MATCH}`]);
  });

  it('창을 옮기지 못하면(이 워커가 안 맡은 창) 새 창을 연다', async () => {
    const tab = client(`${ORIGIN}/me/home`);
    tab.navigate.mockRejectedValue(new TypeError('not controlled'));
    const { fire, opened } = worker([tab]);

    await fire('notificationclick', click(`/me/chat/${MATCH}`));

    expect(opened).toEqual([`${ORIGIN}/me/chat/${MATCH}`]);
  });

  it.each([['https://evil.example/'], ['//evil.example/x'], [null]])('주소가 %s 여도 우리 출처 밖으로 가지 않는다', async (url) => {
    const { fire, opened } = worker([]);

    await fire('notificationclick', click(url));

    expect(new URL(opened[0]).origin).toBe(ORIGIN);
  });
});

describe('pushsubscriptionchange — 새 구독을 서버에 다시 남긴다', () => {
  const sub = (endpoint: string) => ({
    endpoint,
    options: { applicationServerKey: new Uint8Array([4]) },
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
  });

  it('브라우저가 새 구독을 주면 옛 것과 함께 보낸다', async () => {
    const { fire, posted } = worker();

    await fire('pushsubscriptionchange', { oldSubscription: sub('https://push/old'), newSubscription: sub('https://push/new') });

    expect(posted).toEqual([
      { url: '/me/push/subscription', body: { oldEndpoint: 'https://push/old', endpoint: 'https://push/new', p256dh: 'p', auth: 'a' } },
    ]);
  });

  it('새 구독이 없으면 옛 열쇠로 다시 맺는다', async () => {
    const { fire, posted, subscribe } = worker();
    subscribe.mockResolvedValue(sub('https://push/again'));

    await fire('pushsubscriptionchange', { oldSubscription: sub('https://push/old'), newSubscription: null });

    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(posted[0].body).toMatchObject({ oldEndpoint: 'https://push/old', endpoint: 'https://push/again' });
  });

  it('열쇠도 모르면 아무것도 안 한다', async () => {
    const { fire, posted } = worker();

    await fire('pushsubscriptionchange', { oldSubscription: null, newSubscription: null });

    expect(posted).toEqual([]);
  });
});
