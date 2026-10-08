/**
 * **웹 푸시의 열쇠 셋을 짓는다**(ADR 0156) — 사람이 운영에 넣을 값과 로컬에서 쓸 값이 같은 모양이다.
 *
 *   node scripts/push-vapid-keys.mjs
 *
 * 찍는 것은 넷이다. 앞의 셋은 Vercel 환경변수, 마지막 하나(배달 비밀)는 Supabase Vault 의 `push_dispatch_secret` 에도
 * **같은 값**으로 들어간다. 어디에 무엇을 넣는지는 `docs/ops/runbook/secret-leak.md` 의 줄과 PR 의 설정 목록이 든다.
 *
 * 이 스크립트는 아무 데도 쓰지 않는다 — 찍기만 한다. 비밀 열쇠 둘이 터미널에 남으니 붙여 넣은 뒤 화면을 지운다.
 * VAPID 열쇠 쌍을 바꾸면 이미 맺은 구독은 새 쌍으로 못 받는다(사람마다 다시 켜야 한다) — 한 번 짓고 오래 쓴다.
 */
import { randomBytes } from 'node:crypto';

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${privateKey}`);
console.log('WEB_PUSH_SUBJECT=mailto:<운영 연락 주소>   # 없으면 배포의 https 주소를 쓴다');
console.log(`PUSH_DISPATCH_SECRET=${randomBytes(32).toString('base64url')}   # Vault push_dispatch_secret 에도 같은 값`);
