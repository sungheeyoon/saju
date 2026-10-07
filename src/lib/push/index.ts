/**
 * 새 메시지 웹 푸시의 정책 — **무엇을 싣고, 얼마나 살리고, 답을 어떻게 읽나** (ADR 0156).
 *
 * 보내는 일(암호화 · 요청)은 앱 층의 배달 문(`app/api/push/dispatch/`)이 `web-push` 로 하고, 여기는 그 문이 묻는
 * 값만 낸다 — 이 층은 실행 환경도 패키지도 모른다(`docs/architecture.md` 「층 넷」). 설정 줄이 고를 상태도 여기서
 * 판정한다(브라우저가 무엇을 지원하는지는 화면이 재서 넘긴다).
 *
 * ## 싣지 않는 것
 *
 * 페이로드는 이동할 주소와 묶음 표 둘뿐이다. 본문 · 닉네임 · 사진 · 상대 id 는 없다 — 잠금 화면에 안 서고, 암호를
 * 풀기 전의 푸시 서비스도 크기 말고는 볼 것이 없다. 알림의 글자(서비스명 · 「새 메시지」 한 줄)는 서비스 워커가
 * 제 안에서 세운다(`public/sw.js`).
 */

/**
 * 푸시 서비스가 기기에 못 닿은 채로 들고 있을 시간 — **1시간**.
 *
 * 알림은 이미 나간 뒤에 거둘 길이 없다. 꺼져 있던 전화가 반나절 뒤에 켜지며 「새 메시지」를 세우면, 그 사이 다른
 * 기기에서 읽은 메시지일 가능성이 크다 — 그때 진실은 앱 안의 딱지와 목록이 든다(ADR 0155). 한 시간 안이면 아직
 * 알려 줄 값이 있는 소식으로 본다. 기본값(4주)은 쓰지 않는다 — 머리가 없으면 `web-push` 가 그 값을 싣는다.
 */
export const PUSH_TTL_SECONDS = 3600;

/** 사람이 기다리는 소식이다 — 절전 중인 안드로이드도 바로 깨운다(RFC 8030 §5.3) */
export const PUSH_URGENCY = 'high' as const;

/** 깨움 한 번에 잠그는 배달 줄 — 남으면 다음 깨움(배달 줄의 생성 · 1분 크론)이 집는다 */
export const PUSH_CLAIM_LIMIT = 50;

/** 한 번에 열어 두는 송신 — 푸시 서비스 하나에 몰아 429 를 부르지 않을 만큼 */
export const PUSH_SEND_CONCURRENCY = 6;

/** 송신 하나를 기다리는 최대 시간(ms) — 넘으면 연결 실패와 같이 다시 보낸다 */
export const PUSH_SEND_TIMEOUT_MS = 10_000;

/** 배달 줄을 닫는 말 — `settle_push_delivery(p_result)` 가 받는 넷 */
export type SettleResult = 'sent' | 'gone' | 'retry' | 'unconfigured';

/** 서비스 워커가 받는 값 전부 */
export type PushPayload = { url: string; tag: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 방 하나의 페이로드. 주소는 우리 안의 상대 경로라 서비스 워커가 다른 출처를 열 길이 없다.
 *
 * @throws {Error} `matchId` 가 uuid 가 아닐 때 — DB 가 낸 값이 아니면 주소에 이어 붙이지 않는다.
 */
export function pushPayloadFor(matchId: string): PushPayload {
  if (!UUID.test(matchId)) throw new Error(`방 id 가 uuid 가 아니다: ${matchId}`);
  const id = matchId.toLowerCase();
  return { url: `/me/chat/${id}`, tag: `chat-${id}` };
}

/**
 * 푸시 서비스의 `Topic` — 같은 방의 아직 안 간 통보를 새 것으로 바꾼다(RFC 8030 §5.4).
 *
 * 규격은 URL-safe base64 글자 32개 이하다. uuid 의 하이픈을 빼면 16진 32글자 — 그 글자들은 모두 base64url 안에
 * 있다. 방마다 다르고 같은 방이면 늘 같다.
 */
export function pushTopicFor(matchId: string): string {
  if (!UUID.test(matchId)) throw new Error(`방 id 가 uuid 가 아니다: ${matchId}`);
  return matchId.toLowerCase().replaceAll('-', '');
}

/**
 * 푸시 서비스의 답 → 배달 줄을 닫는 말.
 *
 * - `2xx` → `sent`
 * - `404` · `410` → `gone` — 그 구독은 끝났다(브라우저가 풀었거나 만료). DB 가 구독을 지운다
 * - 그 밖 전부(`429` · `5xx` · 연결 실패 · 시간 초과 · 다른 `4xx`) → `retry` — DB 가 뒤물림으로 다시 기한을 세우고
 *   다섯 번째에 접는다(ADR 0156)
 *
 * **`403` · `400` · `413` 을 `gone` 으로 읽지 않는다.** 그 셋은 대개 우리 쪽 설정(VAPID 열쇠가 구독 때와 다름 ·
 * 잘못 지은 요청)이고, 그것을 「구독이 끝났다」로 읽으면 설정 실수 하나가 모든 사람의 구독을 지운다. 다시 보내다
 * 접히는 편이 되돌릴 수 있다. `429` 의 `Retry-After` 는 배달 줄의 뒤물림(1분 · 5분 · 30분)이 대신한다.
 *
 * @param status 받은 답의 상태 코드. 답을 못 받았으면(연결 실패 · 시간 초과) `null`
 */
export function settleResultOf(status: number | null): Exclude<SettleResult, 'unconfigured'> {
  if (status === null) return 'retry';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 404 || status === 410) return 'gone';
  return 'retry';
}

/**
 * VAPID 공개 열쇠(base64url) → `pushManager.subscribe` 의 `applicationServerKey`.
 *
 * @throws {Error} P-256 공개 열쇠(65바이트, `0x04` 로 시작)가 아닐 때
 */
export function applicationServerKeyOf(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.trim().replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  if (bytes.length !== 65 || bytes[0] !== 0x04) throw new Error('VAPID 공개 열쇠가 P-256 비압축 점(65바이트)이 아니다');
  return bytes;
}

/**
 * 설정의 「새 메시지 알림」 줄이 설 상태.
 *
 * - `unsupported` — 이 브라우저에는 웹 푸시가 없다(또는 서버에 공개 열쇠가 없다)
 * - `ios-not-installed` — iOS · iPadOS 인데 홈 화면에 추가한 앱으로 연 것이 아니다. 그 밖에서는 푸시가 없다
 *   (WebKit 16.4)
 * - `denied` — 이 브라우저가 이 사이트의 알림을 막았다. 다시 묻는 길이 없어 브라우저 설정으로 보낸다
 * - `off` · `on` — 이 기기가 **지금 계정으로** 서버에 구독을 두었는가
 */
export type PushRowState = 'unsupported' | 'ios-not-installed' | 'denied' | 'off' | 'on';

export type PushEnvironment = {
  /** `serviceWorker` · `PushManager` · `Notification` 이 다 있다 */
  supported: boolean;
  /** 서버가 VAPID 공개 열쇠를 실었다 */
  configured: boolean;
  ios: boolean;
  /** `display-mode: standalone`(또는 iOS 의 `navigator.standalone`) */
  standalone: boolean;
  permission: NotificationPermission;
  /** 이 브라우저에 푸시 구독이 있다 */
  subscribed: boolean;
  /**
   * 그 구독이 **지금 계정에** 서버에 있다(`push_subscription_registered`). 같은 브라우저에서 앞 계정이 켠 구독이
   * 남아 있으면 브라우저 구독은 있어도 이 값은 거짓이다 — 그 줄은 「꺼짐」이다(ADR 0156 「로그아웃 · 계정 전환」).
   */
  registered: boolean;
};

export function pushRowState(env: PushEnvironment): PushRowState {
  // iOS 의 브라우저 탭에는 `PushManager` 가 아예 없다 — 「지원 안 함」보다 이 안내가 먼저다
  if (env.ios && !env.standalone) return 'ios-not-installed';
  if (!env.supported || !env.configured) return 'unsupported';
  if (env.permission === 'denied') return 'denied';
  if (env.permission === 'granted' && env.subscribed && env.registered) return 'on';
  return 'off';
}

/**
 * iOS · iPadOS 인가 — 사용자 에이전트와 터치 점 수로 가른다.
 *
 * iPadOS 13 부터 Safari 는 데스크톱 Mac 의 사용자 에이전트를 낸다. 그래서 「Macintosh 인데 터치 점이 여럿」을
 * iPad 로 본다(Mac 은 터치 화면이 없다).
 */
export function looksLikeIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}

/** 브라우저가 낸 구독 하나 — `PushSubscription.toJSON()` 의 세 칸 */
export type PushSubscriptionKeys = { endpoint: string; p256dh: string; auth: string };

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const decodedLength = (value: string) => Math.floor((value.replace(/=+$/, '').length * 3) / 4);

/**
 * 서버에 남기기 전에 모양을 본다 — endpoint 는 `https:` 주소, `p256dh` 는 P-256 공개 점(65바이트), `auth` 는
 * 16바이트(RFC 8291). 모양이 틀린 구독은 남겨도 보낼 때마다 실패해 배달 줄만 접힌다.
 */
export function pushSubscriptionShapeOk(keys: PushSubscriptionKeys): boolean {
  let endpoint: URL;
  try {
    endpoint = new URL(keys.endpoint);
  } catch {
    return false;
  }
  if (endpoint.protocol !== 'https:' || keys.endpoint.length > 2048) return false;
  if (!BASE64URL.test(keys.p256dh) || !BASE64URL.test(keys.auth)) return false;
  return decodedLength(keys.p256dh) === 65 && decodedLength(keys.auth) === 16;
}
