import 'server-only';

import { keyedClient } from '@/app/keyed-client';

import { configOf, exportOnce, type ExportSource } from './export';
import { s3Upload } from './s3';

/**
 * **운영자 접속기록을 하루 한 번 S3 로 내보낸다** (G-23 ⑩, ADR 0105).
 *
 * DB 안의 기록(`audit.operator_access`)은 추가만 되지만 소유자는 트리거를 끌 수 있다. 지워지지 않는 기록은
 * 밖의 사본이다 — Object Lock 이 걸린 버킷에 날마다 쌓는다. 깨우는 것은 Vercel Cron 하나(`vercel.json`,
 * 하루 한 번 — Hobby 는 하루 한 번까지다)고, 자격은 복구기(`../reading/route.ts`)와 같은 `CRON_SECRET` 이다.
 *
 * **켜는 값 넷이 없으면 「설정 안 됨」으로 200 을 내고 끝난다** — AWS 계정이 아직 없다(`configOf`).
 * 켜진 뒤의 실패는 500 이고 Vercel 로그에 남는다. 월 점검이 마지막 반출 시각을 본다(runbook 「운영 주기」).
 */

/** 밀린 날이 있어도 스무 파일이면 끝난다 */
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 });
  }

  const config = configOf({
    AUDIT_EXPORT_BUCKET: process.env.AUDIT_EXPORT_BUCKET,
    AUDIT_EXPORT_REGION: process.env.AUDIT_EXPORT_REGION,
    AUDIT_EXPORT_ACCESS_KEY_ID: process.env.AUDIT_EXPORT_ACCESS_KEY_ID,
    AUDIT_EXPORT_SECRET_ACCESS_KEY: process.env.AUDIT_EXPORT_SECRET_ACCESS_KEY,
  });
  if (config === null) return Response.json({ configured: false });

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('접속기록 반출');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const source: ExportSource = {
    batch: async (limit) => {
      const { data, error } = await keyed.rpc('audit_export_batch', { p_limit: limit });
      if (error) throw new Error(`audit_export_batch: ${error.code}`);
      return data ?? [];
    },
    done: async (bundle) => {
      const { error } = await keyed.rpc('audit_export_done', {
        p_after_id: bundle.head.after_id,
        p_first_id: bundle.head.first_id,
        p_last_id: bundle.head.last_id,
        p_rows: bundle.head.rows,
        p_sha256: bundle.head.sha256,
        p_object_key: bundle.key,
      });
      if (error) throw new Error(`audit_export_done: ${error.code}`);
    },
  };

  try {
    const result = await exportOnce(source, s3Upload(config), () => new Date());
    return Response.json({ configured: true, ...result });
  } catch (error) {
    // 까닭은 기록에만 — 답에는 싣지 않는다(열쇠 · 버킷 이름이 오류 문장에 섞일 수 있다)
    console.error('audit-export', error);
    return new Response('export failed', { status: 500 });
  }
}
