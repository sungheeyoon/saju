/**
 * **S3 에 나간 접속기록을 다시 내려받아 DB 의 반출 기록과 대조한다** (G-23 ⑩, ADR 0105, `20261014090000`).
 *
 *     AWS_PROFILE=saju-audit-verify AUDIT_VERIFY_BUCKET=<버킷> AUDIT_VERIFY_REGION=ap-northeast-2 \
 *       npm run audit:verify [-- --since <첫 번호>]
 *
 * 반출 기록(`audit.operator_access_export` — 범위 · 행 수 · 본문 sha256 · 객체 키)은 `npm run db:remote` 로 읽는다
 * (목적이 접속기록에 남는다). 개인을 가리키는 값이 없는 표다. 객체는 **읽기 전용 역할**로 내려받는다 — 반출의
 * 쓰기 자격(`s3:PutObject` 만)과 따로다(runbook 「반출」 — 검증). 자격은 AWS SDK 의 기본 사슬(`AWS_PROFILE` 등)이
 * 고른다 — 이 스크립트는 열쇠를 받지 않는다.
 *
 * 한 객체마다 재는 것:
 *   - 첫 줄(머리)이 읽히고 종류가 맞다
 *   - 머리의 행 수 · 첫/마지막 번호 · 이어지는 자리 · sha256 이 DB 의 기록과 같다
 *   - 머리를 뗀 나머지의 sha256 이 머리와 같다(내용이 바뀌지 않았다)
 *   - 본문의 줄 수가 행 수와 같고, 번호가 이어지는 자리 뒤에서 차례로 서며 첫/마지막이 범위와 같다
 * 기록 전체에 대해: 범위가 빠짐도 겹침도 없이 이어진다(각 기록의 `first_id` 는 앞 기록의 `last_id` 보다 크다).
 *
 * 어긋난 것이 하나라도 있으면 1 로 끝난다. 객체 본문(운영자 id · 신고 id)은 화면에 찍지 않는다 — 어긋남의 이름만.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * 객체 하나를 기록 하나와 대조한다.
 *
 * @param {{ first_id: number, last_id: number, rows: number, sha256: string, object_key: string }} record
 * @param {string | null} body 내려받은 본문. 객체가 없으면 null
 * @param {number} afterId 이 기록이 이어져야 하는 자리 — 앞 기록의 `last_id`, 처음이면 0
 * @returns {string[]} 어긋난 것의 이름들. 비면 맞다
 */
export function verifyObject(record, body, afterId) {
  if (body === null) return ['객체가 없다'];

  const cut = body.indexOf('\n');
  if (cut < 0) return ['머리가 없다'];
  let head;
  try {
    head = JSON.parse(body.slice(0, cut));
  } catch {
    return ['머리가 JSON 이 아니다'];
  }
  const rows = body.slice(cut + 1);
  const problems = [];

  if (head.kind !== 'saju-operator-access' || ![1, 2].includes(head.version)) problems.push('머리의 종류가 아니다');
  for (const [name, want] of [['rows', record.rows], ['first_id', record.first_id], ['last_id', record.last_id],
    ['sha256', record.sha256], ['after_id', afterId]]) {
    if (head[name] !== want) problems.push(`머리의 ${name} 값이 기록과 다르다`);
  }
  if (sha256Hex(rows) !== head.sha256) problems.push('본문의 sha256 이 머리와 다르다');

  const lines = rows.split('\n');
  if (lines.at(-1) !== '') problems.push('본문이 줄바꿈으로 끝나지 않는다');
  const parsed = [];
  for (const line of lines.slice(0, -1)) {
    try {
      parsed.push(JSON.parse(line));
    } catch {
      problems.push('JSON 이 아닌 줄이 있다');
      break;
    }
  }
  if (parsed.length !== record.rows) problems.push('줄 수가 행 수와 다르다');
  let previous = afterId;
  for (const one of parsed) {
    if (!(Number.isSafeInteger(one.id) && one.id > previous)) {
      problems.push('번호가 차례가 아니다');
      break;
    }
    previous = one.id;
  }
  if (parsed.length > 0 && (parsed[0].id !== record.first_id || parsed.at(-1).id !== record.last_id)) {
    problems.push('첫/마지막 번호가 범위와 다르다');
  }
  return problems;
}

/**
 * 기록 전부를 차례로 대조한다.
 *
 * @param {readonly { first_id: number, last_id: number, rows: number, sha256: string, object_key: string }[]} records
 *        `first_id` 차례로
 * @param {(key: string) => Promise<string | null>} fetchObject 없으면 null
 * @param {number} [startAfter] 첫 기록이 이어져야 하는 자리 — 중간부터 볼 때 그 앞 기록의 `last_id`
 * @returns {Promise<{ key: string, problems: string[] }[]>} 기록마다
 */
export async function verifyAll(records, fetchObject, startAfter = 0) {
  const results = [];
  let afterId = startAfter;
  for (const record of records) {
    const problems = [];
    if (record.first_id <= afterId) problems.push('범위가 앞 기록과 겹친다');
    const body = await fetchObject(record.object_key);
    problems.push(...verifyObject(record, body, afterId));
    results.push({ key: record.object_key, problems });
    afterId = record.last_id;
  }
  return results;
}

/** `db query` 의 JSON 출력에서 줄들을 집는다 */
export function rowsOf(stdout) {
  const parsed = JSON.parse(stdout.slice(stdout.indexOf('{')));
  return (parsed.rows ?? []).map((row) => ({
    first_id: Number(row.first_id),
    last_id: Number(row.last_id),
    rows: Number(row.rows),
    sha256: String(row.sha256),
    object_key: String(row.object_key),
    after_id: Number(row.after_id),
  }));
}

export function recordsSqlOf(since) {
  if (!Number.isSafeInteger(since) || since < 0) throw new Error('--since 는 0 이상의 번호다');
  return `select e.first_id, e.last_id, e.rows, e.sha256, e.object_key,
    coalesce((select max(p.last_id) from audit.operator_access_export p where p.last_id < e.first_id), 0) as after_id
    from audit.operator_access_export e where e.first_id >= ${since} order by e.first_id`;
}

async function main() {
  const bucket = process.env.AUDIT_VERIFY_BUCKET?.trim();
  const region = process.env.AUDIT_VERIFY_REGION?.trim() || 'ap-northeast-2';
  if (!bucket) {
    console.error('AUDIT_VERIFY_BUCKET 이 없다 — runbook 「반출」의 검증 절');
    process.exit(2);
  }
  const at = process.argv.indexOf('--since');
  const since = at >= 0 ? Number(process.argv[at + 1]) : 0;

  const listed = spawnSync('npm', ['run', '--silent', 'db:remote', '--', '--purpose', '접속기록 반출 객체 검증',
    recordsSqlOf(since)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (listed.status !== 0) {
    console.error('반출 기록을 못 읽었다.');
    process.exit(listed.status ?? 1);
  }
  const records = rowsOf(listed.stdout);

  const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({ region });
  const fetchObject = async (key) => {
    try {
      const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return await got.Body.transformToString('utf-8');
    } catch (error) {
      if (error?.name === 'NoSuchKey') return null;
      throw error;
    }
  };

  const results = await verifyAll(records, fetchObject, records[0]?.after_id ?? 0);
  let bad = 0;
  for (const one of results) {
    if (one.problems.length === 0) continue;
    bad += 1;
    console.log(`FAIL ${one.key} — ${one.problems.join(' · ')}`);
  }
  console.log(`\n객체 ${results.length}개 · 어긋남 ${bad}개`);
  if (bad > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
