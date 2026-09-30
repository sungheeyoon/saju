/**
 * 흐름 검사 일곱 벌이 함께 쓰는 **재는 도구 한 벌.**
 *
 * 리포터가 일곱 벌로 복사돼 있었다 — 바이트까지 같았다(md5 `0815851d…`). `sql()` 은 네 벌.
 * 같은 것이 일곱 자리에 있으면 고칠 일이 생겼을 때 여섯 자리가 안 고쳐지고, 그 여섯은
 * **안 고쳐진 줄도 모르는 채로** 돈다.
 *
 * ## 끝내는 일이 여기 있는 까닭
 *
 * 앞서는 스크립트마다 끝에서 `process.exit()` 를 불렀다. 그러면 러너가 이 파일들을
 * `import` 하는 순간 첫 스크립트가 **러너까지 함께 죽인다.** 그래서 두 가지를 바꿨다 —
 * 러너는 자식 프로세스로 돌리고(`run-checks.mjs`), 여기서는 `process.exitCode` 만 적는다.
 * 그러면 출력과 뒷정리가 끝날 기회가 남는다.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { worktreeStack } from '../src/lib/local-env.ts';

/**
 * 재는 자리 하나를 연다.
 *
 * `finish()` 를 부르면 사람이 읽는 요약 한 줄을 찍고, **러너가 읽을 값**을 따로 남긴다
 * (`CHECK_RESULT_FILE`). 사람이 보는 줄과 러너가 세는 수가 같은 자리에서 나므로
 * 둘이 갈라질 수 없다.
 */
export function createChecks(name) {
  const checks = [];

  const check = (label, pass, detail = '') => {
    checks.push({ label, pass, detail });
    console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  };

  const finish = () => {
    const failed = checks.filter((one) => !one.pass);
    console.log(`\n${checks.length - failed.length}/${checks.length} 통과`);

    const to = process.env.CHECK_RESULT_FILE;
    if (to) {
      writeFileSync(to, JSON.stringify({
        name,
        total: checks.length,
        passed: checks.length - failed.length,
        failed: failed.map((one) => one.label),
      }));
    }

    /** **`process.exit` 가 아니다** — 뒷정리가 끝날 기회를 남긴다 */
    if (failed.length > 0) process.exitCode = 1;
  };

  return { check, finish };
}

/** 운영자만 읽는 표를 SQL 로 본다 — 앱이 아니라 그게 그 표의 유일한 읽는 길이다 */
export const sql = (statement) =>
  execFileSync('docker', ['exec', '-i', worktreeStack().dbContainer, 'psql', '-U', 'postgres', '-tAq', '-c', statement],
    { encoding: 'utf8' }).trim();

/**
 * 매칭 풀에 서는 데 드는 **필요한 기운 요약** 한 벌(ADR 0113) — 셈 이름은 지금 DB 의 이름을 읽는다.
 *
 * 앱은 엔진의 억부로 짓는다. 흐름 검사가 재는 것은 요청 · 수락이 이어지는가라 모양만 맞으면 된다. 이름을 여기 적으면
 * 엔진이 규칙을 올리는 날 모든 흐름이 조용히 풀에서 빠진다.
 */
export const testNeed = () => ({ primary: '木', heaviest: '金', rule: sql('select public.discovery_need_rule()') });

/**
 * **본문을 끝까지 받은 뒤에 돌려주는 fetch** — 화면을 「열었다」는 곧 서버가 그 화면을 다 그렸다는 뜻이다.
 *
 * `fetch` 는 헤더가 오면 끝난다. 탭마다 `loading.tsx` 가 선 뒤로(ADR 0116) 서버는 헤더와 뼈대를 먼저 흘려보내고 페이지의
 * 일(홈을 열면 풀에 드는 참여 · 읽음 표시 등)은 그 뒤에 끝낸다 — 본문을 안 읽은 검사가 그 일이 끝나기 전에 DB 를 들여다봐
 * 「홈을 한 번 여는 것만으로 풀에 든다」가 붉었다(2026-09-27). 받은 본문으로 새 `Response` 를 지어 돌려주므로 부르는 쪽은
 * `status` · `headers` · `text()` 를 전처럼 쓴다.
 */
export async function fetchWhole(url, init) {
  const response = await fetch(url, init);
  const body = await response.arrayBuffer();
  const empty = [101, 204, 205, 304].includes(response.status);
  return new Response(empty ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

/**
 * 풀에 오르는 값을 쓰는 문 넷을 **그 사람으로** 부른다 — 앱의 열쇠 모듈이 하는 일을 흐름 검사가 흉내 낸다(G-64, ADR 0136).
 *
 * `create_self_person` · `edit_person_input` · `set_discovery_participation` · `ensure_discovery_participation` 은
 * `service_role` 에만 열려 있고 첫 인자로 사람 id 를 받는다. 앱에서는 `app/me/keyed-chart-writes.ts` 가 세션에서 그 id 를
 * 얻는다. 여기서는 로그인한 클라이언트의 세션에서 얻어 로컬 스택의 열쇠로 부른다 — 나머지 인자는 옛 판과 같고 답의 모양
 * (`{ data, error }`)도 같아서, 부르던 자리는 `client.rpc(이름, …)` 를 `keyedRpc(client, 이름, …)` 로 바꾸기만 했다.
 * 사용자 역할이 이 문을 직접 못 부르는 것은 pgTAP(`72_pool_values_keyed`)이 잰다.
 */
let keyedOnce = null;
export async function keyedRpc(client, name, args) {
  if (keyedOnce === null) {
    const { createClient } = await import('@supabase/supabase-js');
    const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }));
    keyedOnce = createClient(status.API_URL, status.SECRET_KEY ?? status.SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id ?? null;
  return keyedOnce.rpc(name, { p_user_id: userId, ...versionsFor(name, userId), ...args });
}

/**
 * 참여의 두 문은 **요약을 지은 입력의 판 둘**을 더 받는다(ADR 0136). 흐름 검사의 요약은 모양만 맞는 한 벌이라 지은 입력이
 * 따로 없으므로 **지금 저장된 판**을 싣는다 — 판이 엇갈린 갈래는 pgTAP `71_pool_summary_is_stamped_with_its_input` 이 잰다.
 */
const WITH_VERSIONS = new Set(['set_discovery_participation', 'ensure_discovery_participation']);
function versionsFor(name, userId) {
  if (!WITH_VERSIONS.has(name) || userId === null) return {};
  const [input, engine] = sql(
    `select p.input_version || '|' || p.chart_engine_version from public.app_user u
     join public.person p on p.id = u.self_person_id where u.id = '${userId}'`,
  ).split('|');
  return input ? { p_input_version: Number(input), p_chart_engine_version: engine } : { p_input_version: null, p_chart_engine_version: null };
}
