/**
 * **DB 에 사는 사진(bytea)을 저장소(S3)로 옮긴다** — 사람이 한 번 돌리는 도구(G-120, `20261227090000`).
 *
 *     AWS_PROFILE=saju-photo-admin PHOTO_STORE_BUCKET=<버킷> PHOTO_STORE_REGION=ap-northeast-2 \
 *       NEXT_PUBLIC_SUPABASE_URL=<주소> SUPABASE_SECRET_KEY=<열쇠> npm run photo:move [-- --execute] [--limit N]
 *
 * `--execute` 가 없으면 **아무것도 안 옮기고** 옮길 장의 수만 센다(바이트를 안 받는다). 절차 · 까닭 · 되돌리기는
 * `docs/ops/runbook/photo-store.md` 「옛 사진 옮기기」. **사람만 돌린다** — 얼굴은 개인정보이고, 이 도구는 열쇠로 DB 의 바이트를
 * 받는다(화면에 안 찍는다). 대장에 먼저 적는다(`docs/ops/runbook/access.md` 「개인정보는 화면으로만」).
 *
 * 한 장마다: 새 열쇠(`photos/{user}/{uuid}`)를 짓고 **원본 바이트를 그대로 두 벌**(`card` · `large`)로 쓴 뒤
 * `photo_bytes_moved` 로 적는다. 다시 굽지 않는다 — 옛 사진은 긴 변 512px 로 이미 줄여 저장됐고 **옮긴다고 화질이 돌아오지
 * 않는다.** 판본(`?v=`)은 그대로다. 그 사이 사람이 그 장을 바꿨으면 DB 가 적지 않고 올린 객체를 지울 줄에 넣는다(청소기가 지운다).
 *
 * 두 번 돌려도 된다 — 이미 옮긴 장은 `photo_bytes_to_move` 에 안 나온다.
 */
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * 옮기기 한 번 — DB 의 두 문과 저장소의 쓰기를 밖에서 받는다(시험이 가짜로 잰다, `photo-move.test.ts`).
 *
 * @param {{
 *   toMove: (limit: number) => Promise<{ user_id: string, position: number, version: number, content_type: string, base64: string }[]>,
 *   moved: (userId: string, position: number, version: number, key: string) => Promise<boolean>,
 * }} db
 * @param {(key: string, body: Uint8Array, contentType: string) => Promise<void>} put
 * @param {{ limit?: number, newId?: () => string, rounds?: number }} [options]
 * @returns {Promise<{ moved: number, skipped: number }>}
 */
export async function movePhotos(db, put, { limit = 50, newId = randomUUID, rounds = 1000 } = {}) {
  let moved = 0;
  let skipped = 0;
  for (let round = 0; round < rounds; round += 1) {
    const rows = await db.toMove(limit);
    if (rows.length === 0) break;
    let progress = 0;
    for (const row of rows) {
      const key = `photos/${row.user_id}/${newId()}`;
      const body = Uint8Array.from(Buffer.from(row.base64, 'base64'));
      await put(`${key}/card`, body, row.content_type);
      await put(`${key}/large`, body, row.content_type);
      if (await db.moved(row.user_id, row.position, row.version, key)) {
        moved += 1;
        progress += 1;
      } else skipped += 1;
    }
    /* 한 차례에 하나도 못 적었으면(모두 그 사이 바뀜) 같은 줄을 끝없이 받지 않게 멈춘다 — 다시 돌리면 이어진다 */
    if (progress === 0) break;
  }
  return { moved, skipped };
}

async function main() {
  const execute = process.argv.includes('--execute');
  const at = process.argv.indexOf('--limit');
  const limit = at >= 0 ? Number(process.argv[at + 1]) : 50;
  const bucket = process.env.PHOTO_STORE_BUCKET?.trim();
  const region = process.env.PHOTO_STORE_REGION?.trim() || 'ap-northeast-2';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!bucket || !url || !secret) {
    console.error('PHOTO_STORE_BUCKET · NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SECRET_KEY 가 필요하다 — docs/ops/runbook/photo-store.md 「옛 사진 옮기기」');
    process.exit(2);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, secret, { auth: { persistSession: false } });

  if (!execute) {
    const { count, error } = await supabase.from('profile_photo').select('user_id', { count: 'exact', head: true }).not('bytes', 'is', null);
    if (error) {
      /* 표는 열쇠에도 RLS 를 지난다 — 세지 못하면 문으로 한 차례만 받아 수만 말한다 */
      console.error('세지 못했다 —', error.code);
      process.exit(1);
    }
    console.log(`옮길 장 ${count ?? 0}개 — 옮기려면 --execute`);
    return;
  }

  const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const client = new S3Client({ region });
  const put = (key, body, contentType) =>
    client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ChecksumSHA256: createHash('sha256').update(body).digest('base64'),
    }));

  const db = {
    toMove: async (n) => {
      const { data, error } = await supabase.rpc('photo_bytes_to_move', { p_limit: n });
      if (error) throw Object.assign(new Error('photo_bytes_to_move'), { code: error.code });
      return data ?? [];
    },
    moved: async (userId, position, version, key) => {
      const { data, error } = await supabase.rpc('photo_bytes_moved', {
        p_user_id: userId, p_position: position, p_version: version, p_object_key: key,
      });
      if (error) throw Object.assign(new Error('photo_bytes_moved'), { code: error.code });
      return data === true;
    },
  };

  const result = await movePhotos(db, put, { limit });
  console.log(`옮김 ${result.moved}장 · 그 사이 바뀌어 건너뜀 ${result.skipped}장(올린 객체는 지울 줄에 갔다)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
