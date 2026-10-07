/**
 * **로컬 스택의 Vault 에 배달 문의 주소와 비밀을 넣는다**(ADR 0157) — 운영 자리에는 닿지 않는다.
 *
 *   node scripts/push-local.mjs                 # 이 워크트리의 dev 포트(`SAJU_WEB_PORT`) · 새 비밀
 *   node scripts/push-local.mjs --port 3030 --secret <값>
 *
 * 쓰는 길은 `docker exec <이 워크트리의 DB 컨테이너> psql` 하나다(`scripts/checks.mjs` 의 `sql`) — 원격 프로젝트로 가는
 * 길이 이 파일에 없다. 운영 Vault 는 사람이 SQL Editor 에서 넣는다(PR 의 설정 목록).
 *
 * 주소는 `http://host.docker.internal:<포트>/api/push/dispatch` 다. DB 의 `pg_net` 은 컨테이너 안에서 돌므로 호스트의
 * 앱에 닿으려면 이 이름을 쓴다 — Supabase CLI 가 컨테이너에 `host.docker.internal:host-gateway` 를 넣는다. Docker
 * Desktop 은 호스트의 `localhost` 에만 뜬 서버에도 닿고, 리눅스의 docker 엔진은 앱이 `0.0.0.0` 에 떠야 닿는다.
 *
 * 앱 쪽에는 같은 비밀(`PUSH_DISPATCH_SECRET`)과 VAPID 열쇠(`node scripts/push-vapid-keys.mjs`)가 환경변수로 있어야 한다 —
 * 끝에 찍는 줄을 dev 서버를 띄우는 셸에 얹는다.
 */
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { sql } from './checks.mjs';
import { worktreeStack } from '../src/lib/local-env.ts';

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** 이름 하나를 넣거나 고친다 — `vault.create_secret` 은 같은 이름을 두 번 못 만든다 */
function putSecret(name, value) {
  sql(`do $$ begin
    if exists (select 1 from vault.secrets where name = ${quote(name)}) then
      perform vault.update_secret((select id from vault.secrets where name = ${quote(name)}), ${quote(value)});
    else
      perform vault.create_secret(${quote(value)}, ${quote(name)});
    end if;
  end $$;`);
}

/** 로컬 Vault 에 두 값을 넣는다 — `check-push.mjs` 도 부른다 */
export function setLocalPushVault({ url, secret }) {
  putSecret('push_dispatch_url', url);
  putSecret('push_dispatch_secret', secret);
}

export const localDispatchUrl = (port) => `http://host.docker.internal:${port}/api/push/dispatch`;

function main() {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const at = args.indexOf(flag);
    return at < 0 ? undefined : args[at + 1];
  };
  const port = Number(valueOf('--port') ?? worktreeStack().webPort);
  const secret = valueOf('--secret') ?? randomBytes(32).toString('base64url');

  setLocalPushVault({ url: localDispatchUrl(port), secret });

  console.log(`로컬 Vault(${worktreeStack().dbContainer})에 넣었다 — push_dispatch_url = ${localDispatchUrl(port)}`);
  console.log('dev 서버를 띄우는 셸에 얹는다(VAPID 열쇠는 node scripts/push-vapid-keys.mjs):');
  console.log(`  PUSH_DISPATCH_SECRET=${secret}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
