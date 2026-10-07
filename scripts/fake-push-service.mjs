/**
 * **가짜 푸시 서비스** — 로컬에서 웹 푸시를 끝까지 재는 받는 쪽(ADR 0157). 운영의 FCM · Mozilla · Apple 자리에 선다.
 *
 * 하는 일은 셋이다.
 *
 * 1. 구독을 짓는다 — 받는 쪽의 ECDH 열쇠(P-256)와 `auth` 16바이트를 이 모듈이 들고, 브라우저가 서버에 넘기는 세 칸
 *    (`endpoint` · `p256dh` · `auth`)을 낸다. endpoint 는 이 서버의 주소다.
 * 2. 받는다 — 배달 문이 `web-push` 로 보낸 요청을 받아 머리(TTL · Urgency · Topic · VAPID)를 적고, 든 열쇠로
 *    본문(aes128gcm)을 **풀어** 페이로드를 확인한다. 푼 것은 `web-push` 와 같은 구현(`http_ece`)이다.
 * 3. 답한다 — endpoint 마다 낼 상태 코드를 시험이 정한다(201 · 410 · 500 …).
 *
 * `web-push` 는 늘 `https` 로 보내므로 이 서버도 TLS 다. 인증서는 그 자리에서 `openssl` 로 지은 자기 서명 하나이고,
 * 보내는 쪽(검사용 Next 서버)은 `NODE_EXTRA_CA_CERTS` 로 그것만 더 믿는다 — 앱 코드에 시험용 갈래가 없다.
 */
import { createECDH, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ece from 'http_ece';

/** 자기 서명 인증서 한 벌 — `localhost` · `127.0.0.1` 에 맞는다 */
function selfSigned() {
  const dir = mkdtempSync(join(tmpdir(), 'fake-push-'));
  const key = join(dir, 'key.pem');
  const cert = join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes',
    '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-addext', 'basicConstraints=critical,CA:TRUE',
  ], { stdio: 'ignore' });
  return { dir, key, cert };
}

/**
 * @returns `{ origin, certPath, subscription(name), answer(name, status), received, waitFor(pred, ms), stop }`
 */
export async function startFakePushService() {
  const tls = selfSigned();
  /** 이름 → { ecdh, auth, status } */
  const subscribers = new Map();
  /** 받은 요청 — `{ name, status, headers, payload, error }` */
  const received = [];

  const server = createServer({ key: readFileSync(tls.key), cert: readFileSync(tls.cert) }, (request, response) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const name = decodeURIComponent((request.url ?? '/').replace(/^\/push\//, ''));
      const one = subscribers.get(name);
      const status = one?.status ?? 404;
      let payload = null;
      let error = null;
      if (one) {
        try {
          const plain = ece.decrypt(Buffer.concat(chunks), {
            version: 'aes128gcm',
            privateKey: one.ecdh,
            authSecret: one.auth.toString('base64url'),
          });
          payload = JSON.parse(plain.toString('utf8'));
        } catch (thrown) {
          error = String(thrown);
        }
      }
      received.push({ name, status, headers: { ...request.headers }, payload, error, at: Date.now() });
      response.writeHead(status, { 'content-type': 'text/plain' });
      response.end(status < 300 ? '' : 'fake push service says no');
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `https://localhost:${port}`;

  return {
    origin,
    certPath: tls.cert,
    received,
    /** 받는 쪽 한 벌을 짓는다. 처음 답은 201 이다 */
    subscription(name) {
      const ecdh = createECDH('prime256v1');
      ecdh.generateKeys();
      const auth = randomBytes(16);
      subscribers.set(name, { ecdh, auth, status: 201 });
      return {
        endpoint: `${origin}/push/${encodeURIComponent(name)}`,
        p256dh: ecdh.getPublicKey().toString('base64url'),
        auth: auth.toString('base64url'),
      };
    },
    answer(name, status) {
      subscribers.get(name).status = status;
    },
    async waitFor(predicate, ms = 15_000) {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        const hit = received.find(predicate);
        if (hit) return hit;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    },
    stop() {
      server.close();
      rmSync(tls.dir, { recursive: true, force: true });
    },
  };
}
