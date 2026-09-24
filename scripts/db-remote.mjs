/**
 * 운영 DB 에 SQL 하나를 보낸다 — **보내기 전에 목적과 해시를 접속기록에 적는다** (G-23 ⑩, ADR 0105).
 *
 *     npm run db:remote -- --purpose "미검토 신고 건수 확인" "select count(*) from public.report where reviewed_at is null"
 *
 * `npm run db:remote` 는 `remote-lock.mjs` 가 이 파일을 감싸 부른다 — 기계 전체에서 한 번에 하나(ADR 0096)는 그대로고,
 * 적는 것과 보내는 것이 같은 잠금 안에서 차례로 돈다.
 *
 * ## 적는 것 — 원문이 아니라 목적과 해시
 *
 * 사람의 결정(2026-09-24): CLI 로 보낸 SQL 은 **원문을 남기지 않는다.** 원문에는 이메일 · 신고 id 같은 이용자
 * 자료가 섞이고, 기록은 지울 수 없는 곳(S3 Compliance)으로 나간다. 남기는 것은 넷 — 목적(사람이 적은 말) ·
 * SQL 의 sha256 · 실행자 · 시각(DB 가 찍는다). 같은 SQL 을 다시 가져오면 해시로 「그때 보낸 것이 이것인가」에 답한다.
 *
 * - **목적 없이는 안 돈다.** 4~200자, `@` 가 들면(이메일) 거절한다 — 목적도 반출된다.
 * - **적지 못하면 안 보낸다.** 적는 호출이 실패하면 SQL 은 나가지 않는다.
 * - **끝난 뒤 결과를 한 줄 더 적는다**(`audit.note_cli_result`, `20261014090000`) — 앞 줄을 고치지 않고 새 줄이 그
 *   번호를 가리킨다. 성공/실패와 **오류 분류**(`sql` · `connection` · `unknown`)만 — 오류 문장에는 이용자 자료가
 *   섞일 수 있어 안 적는다. 결과를 적지 못하면 경고만 한다(SQL 은 이미 나갔다).
 * - 실행자는 git 의 `user.name`, 없으면 OS 사용자다. 에이전트 세션(`CLAUDECODE` · `AI_AGENT`)이면 뒤에 `(agent)` 가
 *   붙는다 — **에이전트는 운영 개인정보를 직접 조회하지 않는다**(ADR 0105, `docs/agents/delegation.md` 등급 3).
 *
 * 개인정보를 읽는 SQL 은 이 명령으로 보내지 않는다 — 그것은 break-glass 이고 사람만 한다(runbook 「break-glass」).
 * 이 기록은 그것을 막지 못한다. 목적과 해시가 남아 **뒤에 물을 수 있게** 할 뿐이다.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { userInfo } from 'node:os';
import { fileURLToPath } from 'node:url';

const USAGE = '쓰는 법: npm run db:remote -- --purpose "<목적>" "<sql>"';

/**
 * @param {readonly string[]} argv `node db-remote.mjs` 뒤의 인자
 * @returns {{ ok: true, purpose: string, sql: string } | { ok: false, message: string }}
 */
export function parseArgs(argv) {
  let purpose = null;
  const rest = [];
  for (let at = 0; at < argv.length; at += 1) {
    const arg = argv[at];
    if (arg === '--purpose') {
      purpose = argv[at + 1] ?? '';
      at += 1;
    } else if (arg.startsWith('--purpose=')) {
      purpose = arg.slice('--purpose='.length);
    } else {
      rest.push(arg);
    }
  }

  if (purpose === null) return { ok: false, message: `목적이 없다 — ${USAGE}` };
  const trimmed = purpose.trim();
  if (trimmed.length < 4 || trimmed.length > 200) return { ok: false, message: '목적은 4~200자다' };
  if (trimmed.includes('@')) return { ok: false, message: '목적에 이메일을 적지 않는다 — 목적도 반출된다' };
  if (rest.length !== 1 || rest[0].trim() === '') return { ok: false, message: `SQL 은 하나다 — ${USAGE}` };
  return { ok: true, purpose: trimmed, sql: rest[0] };
}

export const sqlHashOf = (sql) => createHash('sha256').update(sql, 'utf8').digest('hex');

/** 에이전트 세션이면 그렇다고 적는다 */
export function actorOf({ gitName, osName, env }) {
  const name = (env.SAJU_ACTOR ?? gitName ?? '').trim() || osName;
  const agent = Boolean(env.CLAUDECODE || env.AI_AGENT);
  return (agent ? `${name} (agent)` : name).slice(0, 100);
}

/** 글자를 SQL 문자열로 싣지 않고 16진으로 싣는다 — 목적에 따옴표가 들어도 문장이 안 깨진다 */
const textOf = (value) => `convert_from(decode('${Buffer.from(value, 'utf8').toString('hex')}', 'hex'), 'UTF8')`;

export function noteSqlOf({ actor, purpose, sha256 }) {
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error('해시 모양이 아니다');
  return `select audit.note_cli_query(${textOf(actor)}, ${textOf(purpose)}, '${sha256}') as access_log_id`;
}

/** `db query` 의 JSON 출력에서 적은 줄의 번호를 집는다. 못 집으면 null */
export function accessIdOf(stdout) {
  try {
    const parsed = JSON.parse(stdout.slice(stdout.indexOf('{')));
    const id = Number(parsed?.rows?.[0]?.access_log_id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** 실패의 분류 — 문장은 안 적는다. 분류는 DB 의 검사식 `^[a-z0-9_.:-]{1,60}$` 안에 든다 */
export function errorClassOf({ status, signal, output }) {
  if (status === 0) return null;
  if (signal) return 'signal';
  if (/failed to execute query/i.test(output)) return 'sql';
  if (/connect|dial tcp|timeout|timed out|password|login role|network|refused/i.test(output)) return 'connection';
  return 'unknown';
}

export function resultSqlOf({ id, errorClass }) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('번호 모양이 아니다');
  if (errorClass !== null && !/^[a-z0-9_.:-]{1,60}$/.test(errorClass)) throw new Error('분류 모양이 아니다');
  return errorClass === null
    ? `select audit.note_cli_result(${id}, 'succeeded') as result_log_id`
    : `select audit.note_cli_result(${id}, 'failed', '${errorClass}') as result_log_id`;
}

function gitUserName() {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

const supabase = (sql, stdio) =>
  spawnSync('npx', ['supabase', 'db', 'query', '--linked', sql], { stdio, encoding: 'utf8' });

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.message);
    process.exit(2);
  }

  const actor = actorOf({ gitName: gitUserName(), osName: userInfo().username, env: process.env });
  const sha256 = sqlHashOf(parsed.sql);

  const noted = supabase(noteSqlOf({ actor, purpose: parsed.purpose, sha256 }), ['ignore', 'pipe', 'pipe']);
  if (noted.status !== 0) {
    console.error('접속기록에 적지 못해 SQL 을 보내지 않았다.');
    console.error(noted.stderr || noted.stdout);
    process.exit(noted.status ?? 1);
  }
  console.error(`접속기록에 적었다 — 목적 「${parsed.purpose}」 · sha256 ${sha256.slice(0, 12)}… · ${actor}`);

  const accessId = accessIdOf(noted.stdout ?? '');

  // 결과를 가르려면 출력을 봐야 한다 — 받아서 그대로 다시 낸다
  const ran = supabase(parsed.sql, ['inherit', 'pipe', 'pipe']);
  if (ran.stdout) process.stdout.write(ran.stdout);
  if (ran.stderr) process.stderr.write(ran.stderr);

  const errorClass = errorClassOf({ status: ran.status, signal: ran.signal, output: `${ran.stdout}${ran.stderr}` });
  if (accessId === null) {
    console.error('경고: 적은 줄의 번호를 못 읽어 결과를 적지 않았다.');
  } else {
    const told = supabase(resultSqlOf({ id: accessId, errorClass }), ['ignore', 'pipe', 'pipe']);
    if (told.status !== 0) console.error('경고: 접속기록에 결과를 적지 못했다 — SQL 은 이미 나갔다.');
    else console.error(`접속기록에 결과를 적었다 — ${errorClass === null ? '성공' : `실패(${errorClass})`}`);
  }
  process.exit(ran.status ?? 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
