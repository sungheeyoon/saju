/**
 * **DB 의 열쇠 줄마다 저장소에 두 벌이 있는가** — 사람이 돌리는 검증(G-120, `20261227090000`).
 *
 *     AWS_PROFILE=saju-photo-admin PHOTO_STORE_BUCKET=<버킷> PHOTO_STORE_REGION=ap-northeast-2 \
 *       NEXT_PUBLIC_SUPABASE_URL=<주소> SUPABASE_SECRET_KEY=<열쇠> node scripts/photo-verify.mjs
 *
 * 월 점검에 돈다(옛 사진은 옮기지 않는다 — DB 에 남는다, `20261227150000`). 열쇠마다 `card` · `large` 를 **머리만**(`HeadObject`) 보고 — 바이트를 안 받는다 —
 * 있는가 · 비지 않았나 · 형식이 DB 와 같은가를 잰다. 어긋난 것이 하나라도 있으면 1 로 끝난다. 찍는 것은 열쇠와 어긋남의
 * 이름뿐이다(열쇠의 앞 칸은 계정 id 다 — 이 출력을 저장소 · 이슈에 붙이지 않는다).
 *
 * 저장소에만 있고 DB 가 모르는 객체(고아)는 여기서 안 센다 — 그것은 청소기의 지울 줄이 든다(`docs/ops/runbook/photo-store.md`).
 */
import { fileURLToPath } from 'node:url';

/**
 * @param {{ object_key: string, content_type: string }} row
 * @param {(key: string) => Promise<{ contentType: string | undefined, length: number | undefined } | null>} head
 * @returns {Promise<string[]>} 어긋남의 이름들. 비면 맞다
 */
export async function verifyRow(row, head) {
  const problems = [];
  for (const variant of ['card', 'large']) {
    const got = await head(`${row.object_key}/${variant}`);
    if (got === null) problems.push(`${variant} 가 없다`);
    else {
      if (!got.length) problems.push(`${variant} 가 비었다`);
      if (got.contentType !== row.content_type) problems.push(`${variant} 의 형식이 DB 와 다르다`);
    }
  }
  return problems;
}

/**
 * @param {(after: string, limit: number) => Promise<{ object_key: string, content_type: string }[]>} page
 * @param {Parameters<typeof verifyRow>[1]} head
 */
export async function verifyAll(page, head, limit = 500) {
  const results = [];
  let after = '';
  for (;;) {
    const rows = await page(after, limit);
    for (const row of rows) results.push({ key: row.object_key, problems: await verifyRow(row, head) });
    if (rows.length < limit) break;
    after = rows.at(-1).object_key;
  }
  return results;
}

async function main() {
  const bucket = process.env.PHOTO_STORE_BUCKET?.trim();
  const region = process.env.PHOTO_STORE_REGION?.trim() || 'ap-northeast-2';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!bucket || !url || !secret) {
    console.error('PHOTO_STORE_BUCKET · NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SECRET_KEY 가 필요하다 — docs/ops/runbook/photo-store.md 「열쇠 줄 재기」');
    process.exit(2);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, secret, { auth: { persistSession: false } });
  const { HeadObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({ region });

  const page = async (after, limit) => {
    const { data, error } = await supabase.rpc('photo_object_keys', { p_after: after, p_limit: limit });
    if (error) throw Object.assign(new Error('photo_object_keys'), { code: error.code });
    return data ?? [];
  };
  const head = async (key) => {
    try {
      const got = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { contentType: got.ContentType, length: got.ContentLength };
    } catch (error) {
      if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  };

  const results = await verifyAll(page, head);
  let bad = 0;
  for (const one of results) {
    if (one.problems.length === 0) continue;
    bad += 1;
    console.log(`FAIL ${one.key} — ${one.problems.join(' · ')}`);
  }
  console.log(`\n열쇠 ${results.length}개 · 어긋남 ${bad}개`);
  if (bad > 0) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
