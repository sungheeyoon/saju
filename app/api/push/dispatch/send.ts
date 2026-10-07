import 'server-only';

import webpush, { WebPushError } from 'web-push';

import {
  PUSH_SEND_TIMEOUT_MS,
  PUSH_TTL_SECONDS,
  PUSH_URGENCY,
  pushPayloadFor,
  pushTopicFor,
  settleResultOf,
  type SettleResult,
} from '@/src/lib/push';

import { siteUrl } from '../../../site-url';

/** 배달 줄 하나가 든 구독 — `claim_push_deliveries` 의 칸 그대로 */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** 구독 하나에 방 하나를 알리고, 배달 줄을 닫을 말을 낸다. 던지지 않는다 */
export type PushSender = (target: PushTarget, matchId: string) => Promise<Exclude<SettleResult, 'unconfigured'>>;

type VapidDetails = { subject: string; publicKey: string; privateKey: string };

/**
 * VAPID 의 주체(`sub`) — 푸시 서비스가 문제가 생기면 연락할 곳이다.
 *
 * `WEB_PUSH_SUBJECT`(`mailto:` · `https:`)가 있으면 그것, 없으면 이 배포의 주소가 `https:` 일 때 그 주소다. 로컬의
 * `http://localhost` 는 규격 밖이고 Apple 은 `localhost` 를 거절한다 — 그때는 설정 안 됨이다.
 */
function subjectOf(): string | null {
  const configured = process.env.WEB_PUSH_SUBJECT?.trim();
  if (configured) return /^(mailto|https):/.test(configured) ? configured : null;
  const site = siteUrl();
  return site.protocol === 'https:' ? site.origin : null;
}

const bytesOf = (base64url: string) => Buffer.from(base64url, 'base64url').length;

/**
 * 열쇠 셋이 다 있고 모양이 맞는가. 하나라도 어긋나면 `null` — 배달 줄은 「설정 안 됨」으로 남고 잃지 않는다(ADR 0157).
 *
 * 공개 열쇠는 P-256 비압축 점 65바이트, 비밀 열쇠는 32바이트다. 모양이 틀린 열쇠로 보내면 `web-push` 가 요청마다
 * 던지는데, 그것을 「다시 보내기」로 세면 설정 실수가 다섯 번 뒤 모든 배달을 접는다.
 */
function vapidDetails(): VapidDetails | null {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = subjectOf();
  if (!publicKey || !privateKey || subject === null) return null;
  if (bytesOf(publicKey) !== 65 || bytesOf(privateKey) !== 32) return null;
  return { subject, publicKey, privateKey };
}

/**
 * 웹 푸시 송신기 — 설정이 없으면 `null` 이다.
 *
 * 한 번 보낼 때마다 `vapidDetails` 를 함께 넘긴다 — `webpush.setVapidDetails` 의 모듈 전역 상태를 두지 않는다.
 * 암호화(aes128gcm)와 VAPID 서명은 `web-push` 가 한다. 송신은 늘 `https` 다.
 */
export function pushSender(): PushSender | null {
  const vapid = vapidDetails();
  if (vapid === null) return null;

  return async (target, matchId) => {
    try {
      const { statusCode } = await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(pushPayloadFor(matchId)),
        {
          vapidDetails: vapid,
          TTL: PUSH_TTL_SECONDS,
          urgency: PUSH_URGENCY,
          topic: pushTopicFor(matchId),
          timeout: PUSH_SEND_TIMEOUT_MS,
        },
      );
      return settleResultOf(statusCode);
    } catch (thrown) {
      // 답을 받은 실패는 상태 코드로, 못 받은 실패(연결 · 시간 초과 · 구독 열쇠 모양)는 다시 보내기로
      return settleResultOf(thrown instanceof WebPushError ? thrown.statusCode : null);
    }
  };
}
