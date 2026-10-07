/**
 * 서비스 워커 — **새 메시지 웹 푸시만 든다**(ADR 0156). 화면을 캐시하지 않고 요청을 가로채지 않는다(`fetch` 처리기가
 * 없다) — 오프라인 지원은 이 파일의 일이 아니다.
 *
 * 번들러를 안 지나는 파일이라 앱의 상수를 부르지 못한다. 서비스명은 `src/lib/brand` 의 `SERVICE_NAME`, 이동할 주소의
 * 모양은 `src/lib/push` 의 `pushPayloadFor` 와 같아야 한다 — `app/sw.test.ts` 가 둘을 견준다.
 *
 * ## 알림에 싣는 것
 *
 * 제목은 서비스명, 본문은 「새 메시지」 한 줄뿐이다. 페이로드는 이동할 주소와 묶음 표만 실어 오므로 닉네임 · 본문을
 * 세울 값이 애초에 없다 — 잠금 화면에 서는 글자가 늘 같다.
 *
 * ## 푸시마다 알림을 세운다
 *
 * Safari 는 알림 없이 끝난 푸시(조용한 푸시)를 몇 번 보면 이 사이트의 푸시 권한을 거둔다(WebKit, 2023-02). Chrome 과
 * Firefox 도 `userVisibleOnly` 를 어기면 대신 「백그라운드에서 갱신됐다」를 세우거나 몫을 깎는다. 그래서 그 방을 보고
 * 있어도 알림은 세운다 — 소리 · 진동만 끈다(`silent`). 보고 있는 방의 메시지는 대개 DB 가 먼저 거른다: 배달 줄을
 * 보낼 때 받는 사람이 이미 그 메시지까지 읽었으면 보내지 않는다.
 */

const SERVICE_NAME = '만날지도';
const MESSAGE_LINE = '새 메시지가 왔어요';
const ICON = '/apple-icon.png';

/** 모르는 모양의 페이로드가 오면 대화 목록으로 — 알림은 그래도 세운다(위 「푸시마다」) */
const FALLBACK = { url: '/me/chat', tag: 'chat' };
const CHAT_URL = /^\/me\/chat\/[0-9a-f-]{36}$/;
const CHAT_TAG = /^chat-[0-9a-f-]{36}$/;

/** @param {PushEvent} event */
function payloadOf(event) {
  try {
    const value = event.data ? event.data.json() : null;
    if (value && CHAT_URL.test(value.url) && CHAT_TAG.test(value.tag)) return { url: value.url, tag: value.tag };
  } catch {
    // 암호를 못 풀었거나 JSON 이 아니다 — 아래 대체
  }
  return FALLBACK;
}

/** 같은 출처의 창 중 지금 앞에 보이는 것이 그 주소인가 */
async function watching(url) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windows.some(
    (client) => client.focused && client.visibilityState === 'visible' && new URL(client.url).pathname === url,
  );
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 이미 열린 창도 이 워커가 맡는다 — 그래야 알림을 눌렀을 때 그 창을 옮길 수 있다(`navigate`)
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = payloadOf(event);
  event.waitUntil(
    (async () => {
      const quiet = await watching(payload.url);
      await self.registration.showNotification(SERVICE_NAME, {
        body: MESSAGE_LINE,
        tag: payload.tag,
        // 같은 방의 알림은 쌓이지 않고 바뀐다 — 바뀔 때 다시 울리되, 그 방을 보고 있으면 조용히
        renotify: !quiet,
        silent: quiet,
        icon: ICON,
        data: { url: payload.url },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const wanted = event.notification.data && event.notification.data.url;
  const target = new URL(typeof wanted === 'string' && wanted.startsWith('/') ? wanted : FALLBACK.url, self.location.origin);
  // 주소는 늘 우리 출처다 — `//다른곳` 같은 값이 와도 밖으로 나가지 않는다
  const href = target.origin === self.location.origin ? target.href : new URL(FALLBACK.url, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const ours = windows.filter((client) => new URL(client.url).origin === self.location.origin);
      const open = ours.find((client) => client.focused) || ours.find((client) => client.visibilityState === 'visible') || ours[0];

      if (open) {
        try {
          const focused = await open.focus();
          // `navigate` 는 이 워커가 맡은 창에서만 된다 — 안 되면 새 창으로
          await (focused || open).navigate(href);
          return;
        } catch {
          // 아래로
        }
      }
      await self.clients.openWindow(href);
    })(),
  );
});

/**
 * 브라우저가 구독을 바꿨다(만료 · 열쇠 교체). 새 구독을 서버에 다시 남기고 옛 것을 지운다 — 서버 쪽은 로그인 세션의
 * 쿠키로 부른다(`app/me/push/subscription/route.ts`). 로그아웃 상태면 서버가 거절하고, 그 기기는 설정에서 다시 켤 때까지
 * 「꺼짐」이다.
 *
 * 새 구독을 브라우저가 주지 않으면(Chrome · Firefox 의 대부분) 옛 구독의 열쇠로 다시 맺는다. 옛 열쇠도 모르면
 * 아무것도 안 한다.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription || null;
      let next = event.newSubscription || null;
      if (!next) {
        const key = old && old.options ? old.options.applicationServerKey : null;
        if (!key) return;
        next = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      }
      const json = next.toJSON();
      await fetch('/me/push/subscription', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          oldEndpoint: old ? old.endpoint : null,
          endpoint: json.endpoint,
          p256dh: json.keys && json.keys.p256dh,
          auth: json.keys && json.keys.auth,
        }),
      });
    })(),
  );
});
