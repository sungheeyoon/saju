import { describe, expect, it } from 'vitest';

import {
  PUSH_TTL_SECONDS,
  applicationServerKeyOf,
  extraPushHostsOf,
  looksLikeIos,
  pushEndpointAllowed,
  pushPayloadFor,
  pushRowState,
  pushSubscriptionShapeOk,
  pushTopicFor,
  settleResultOf,
  type PushEnvironment,
} from '.';

const MATCH = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('페이로드 (ADR 0156)', () => {
  it('페이로드는 방으로 가는 주소와 묶음 표 둘뿐이다', () => {
    const payload = pushPayloadFor(MATCH);
    expect(payload).toEqual({ url: `/me/chat/${MATCH}`, tag: `chat-${MATCH}` });
    expect(Object.keys(payload).sort()).toEqual(['tag', 'url']);
  });

  it('페이로드에 본문 · 닉네임을 실을 자리가 없다 — 직렬화한 글자가 주소와 표 말고 아무것도 없다', () => {
    const text = JSON.stringify(pushPayloadFor(MATCH));
    expect(text).toBe(`{"url":"/me/chat/${MATCH}","tag":"chat-${MATCH}"}`);
    expect(text).not.toMatch(/body|title|nickname|message|text/i);
  });

  it('uuid 가 아닌 방 id 는 주소에 이어 붙이지 않는다', () => {
    expect(() => pushPayloadFor('../../ops')).toThrow();
    expect(() => pushPayloadFor(`${MATCH}?x=1`)).toThrow();
  });
});

describe('Topic (RFC 8030)', () => {
  it('32글자 이하의 URL-safe base64 글자다', () => {
    const topic = pushTopicFor(MATCH);
    expect(topic.length).toBeLessThanOrEqual(32);
    expect(topic).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('같은 방이면 같고 다른 방이면 다르다 — 대소문자에 흔들리지 않는다', () => {
    expect(pushTopicFor(MATCH.toUpperCase())).toBe(pushTopicFor(MATCH));
    expect(pushTopicFor('00000000-0000-4000-8000-000000000000')).not.toBe(pushTopicFor(MATCH));
  });
});

describe('푸시 서비스의 답 → 배달 줄', () => {
  it.each([
    [201, 'sent'],
    [200, 'sent'],
    [202, 'sent'],
    [404, 'gone'],
    [410, 'gone'],
    [429, 'retry'],
    [500, 'retry'],
    [502, 'retry'],
    [503, 'retry'],
    [null, 'retry'],
    // 우리 쪽 설정 실수일 수 있는 것은 구독을 지우지 않는다
    [400, 'retry'],
    [403, 'retry'],
    [413, 'retry'],
  ] as const)('%s → %s', (status, result) => {
    expect(settleResultOf(status)).toBe(result);
  });

  it('TTL 은 0 보다 크고 하루보다 짧다 — 기본값(4주)을 쓰지 않는다', () => {
    expect(PUSH_TTL_SECONDS).toBeGreaterThan(0);
    expect(PUSH_TTL_SECONDS).toBeLessThanOrEqual(86_400);
  });
});

describe('VAPID 공개 열쇠', () => {
  it('base64url 을 65바이트 비압축 점으로 푼다', () => {
    const bytes = new Uint8Array(65);
    bytes[0] = 0x04;
    bytes[64] = 0xff;
    const encoded = Buffer.from(bytes).toString('base64url');
    expect([...applicationServerKeyOf(encoded)]).toEqual([...bytes]);
  });

  it('길이가 틀리면 던진다', () => {
    expect(() => applicationServerKeyOf(Buffer.from([4, 1, 2]).toString('base64url'))).toThrow();
  });
});

const base: PushEnvironment = {
  supported: true,
  configured: true,
  ios: false,
  standalone: false,
  permission: 'default',
  subscribed: false,
  registered: false,
};

describe('설정 줄의 상태', () => {
  it('처음은 꺼짐이다', () => {
    expect(pushRowState(base)).toBe('off');
  });

  it('허용 · 구독 · 서버 등록이 다 있어야 켜짐이다', () => {
    expect(pushRowState({ ...base, permission: 'granted', subscribed: true, registered: true })).toBe('on');
  });

  it('앞 계정의 구독이 브라우저에 남았어도 지금 계정에 등록이 없으면 꺼짐이다', () => {
    expect(pushRowState({ ...base, permission: 'granted', subscribed: true, registered: false })).toBe('off');
  });

  it('허용했지만 브라우저 구독이 풀렸으면 꺼짐이다', () => {
    expect(pushRowState({ ...base, permission: 'granted', subscribed: false, registered: true })).toBe('off');
  });

  it('거부했으면 거부됨이다 — 구독이 남아 있어도', () => {
    expect(pushRowState({ ...base, permission: 'denied', subscribed: true, registered: true })).toBe('denied');
  });

  it('지원하지 않거나 서버에 공개 열쇠가 없으면 지원 안 함이다', () => {
    expect(pushRowState({ ...base, supported: false })).toBe('unsupported');
    expect(pushRowState({ ...base, configured: false })).toBe('unsupported');
  });

  it('iOS 의 브라우저 탭이면 홈 화면 안내가 지원 안 함보다 먼저다', () => {
    expect(pushRowState({ ...base, ios: true, supported: false })).toBe('ios-not-installed');
  });

  it('iOS 의 홈 화면 앱이면 다른 브라우저와 같이 판정한다', () => {
    expect(pushRowState({ ...base, ios: true, standalone: true })).toBe('off');
    expect(pushRowState({ ...base, ios: true, standalone: true, supported: false })).toBe('unsupported');
  });
});

describe('iOS 가르기', () => {
  it.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15', 5, true],
    ['iPadOS(데스크톱 UA)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, true],
    ['Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, false],
    ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129', 5, false],
  ] as const)('%s', (_, ua, touch, ios) => {
    expect(looksLikeIos(ua, touch)).toBe(ios);
  });
});

describe('구독의 모양', () => {
  const good = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    p256dh: Buffer.alloc(65, 4).toString('base64url'),
    auth: Buffer.alloc(16, 1).toString('base64url'),
  };

  it('https 주소 · 65바이트 공개 점 · 16바이트 auth 면 받는다', () => {
    expect(pushSubscriptionShapeOk(good)).toBe(true);
  });

  it.each([
    ['http 주소', { ...good, endpoint: 'http://push.example/x' }],
    ['주소가 아니다', { ...good, endpoint: 'not a url' }],
    ['공개 점이 짧다', { ...good, p256dh: Buffer.alloc(33, 4).toString('base64url') }],
    ['auth 가 짧다', { ...good, auth: Buffer.alloc(8, 1).toString('base64url') }],
    ['base64url 이 아니다', { ...good, auth: 'a b c' }],
  ])('%s — 받지 않는다', (_, keys) => {
    expect(pushSubscriptionShapeOk(keys)).toBe(false);
  });
});

describe('받는 푸시 서비스 (ADR 0156)', () => {
  it.each([
    ['Chrome(FCM)', 'https://fcm.googleapis.com/fcm/send/abc'],
    ['Firefox', 'https://updates.push.services.mozilla.com/wpush/v2/abc'],
    ['Edge(WNS)', 'https://wns2-par02p.notify.windows.com/w/?token=abc'],
    ['Safari', 'https://web.push.apple.com/QKabc'],
    ['대문자 호스트', 'https://FCM.googleapis.com/fcm/send/abc'],
  ])('%s — 받는다', (_, endpoint) => {
    expect(pushEndpointAllowed(endpoint)).toBe(true);
  });

  it.each([
    ['모르는 호스트', 'https://evil.example/push'],
    ['알려진 이름을 앞에 단 남의 호스트', 'https://fcm.googleapis.com.evil.example/x'],
    ['사용자 칸을 끼운 주소', 'https://evil.example@fcm.googleapis.com/x'],
    ['포트를 적은 주소', 'https://fcm.googleapis.com:8443/x'],
    ['접미사만 있는 호스트', 'https://push.apple.com/x'],
    ['내부 주소', 'https://169.254.169.254/latest/meta-data'],
    ['http', 'http://fcm.googleapis.com/x'],
    ['주소가 아니다', 'not a url'],
  ])('%s — 받지 않는다', (_, endpoint) => {
    expect(pushEndpointAllowed(endpoint)).toBe(false);
  });

  it('시험용 호스트는 넘겨받을 때만 열린다 — 포트는 아무것이나', () => {
    expect(pushEndpointAllowed('https://localhost:4443/push/b')).toBe(false);
    expect(pushEndpointAllowed('https://localhost:4443/push/b', extraPushHostsOf(' localhost , '))).toBe(true);
    expect(extraPushHostsOf(undefined)).toEqual([]);
  });
});
