import 'server-only';

import { keyedClient } from '@/app/keyed-client';

import { configOf, runExport, type ExportSource, type RunLedger } from './export';
import { s3Upload } from './s3';

/**
 * **운영자 접속기록을 하루 한 번 S3 로 내보낸다** (G-23 ⑩, ADR 0105).
 *
 * DB 안의 기록(`audit.operator_access`)은 추가만 되지만 소유자는 트리거를 끌 수 있다. 지워지지 않는 기록은
 * 밖의 사본이다 — Object Lock 이 걸린 버킷에 날마다 쌓는다. 깨우는 것은 Vercel Cron 하나(`vercel.json`,
 * 하루 한 번 — Hobby 는 하루 한 번까지다)고, 자격은 복구기(`../reading/route.ts`)와 같은 `CRON_SECRET` 이다.
 *
 * **실행마다 DB 에 시작과 결과를 적는다**(`20261014090000`) — 겹쳐 돌면 뒤는 「도는 중」으로 물러나고, 켜는 값이
 * **모두** 없으면 「설정 안 됨」(200, 조용히), **일부만** 있으면 오설정(500, 알림), 실패는 분류와 함께(500, 알림).
 * 실패가 Vercel 로그에만 남지 않는다 — runbook 「반출」의 상태 질의와 DB 의 감시가 본다.
 */

/** 밀린 날이 있어도 스무 파일이면 끝난다 */
export const maxDuration = 60;

/** 오류 문장 대신 코드만 든 오류 — 실패의 분류가 이것을 읽는다 */
const rpcError = (name: string, code: string | undefined) => Object.assign(new Error(name), { code: code ?? 'unknown' });

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('forbidden', { status: 403 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('접속기록 반출');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const ledger: RunLedger = {
    begin: async () => {
      const { data, error } = await keyed.rpc('audit_export_begin').single();
      if (error || !data) throw rpcError('audit_export_begin', error?.code);
      return { attemptId: data.attempt_id, busy: data.busy };
    },
    finish: async (attemptId, result) => {
      const { error } = await keyed.rpc('audit_export_finish', {
        p_attempt_id: attemptId,
        p_outcome: result.outcome,
        p_rows: result.rows ?? 0,
        p_objects: result.objects ?? 0,
        p_first_id: result.firstId ?? undefined,
        p_last_id: result.lastId ?? undefined,
        p_error_class: result.errorClass ?? undefined,
      });
      if (error) throw rpcError('audit_export_finish', error.code);
    },
  };

  const source: ExportSource = {
    batch: async (limit) => {
      const { data, error } = await keyed.rpc('audit_export_batch', { p_limit: limit });
      if (error) throw rpcError('audit_export_batch', error.code);
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
      if (error) throw rpcError('audit_export_done', error.code);
    },
  };

  const config = configOf({
    AUDIT_EXPORT_BUCKET: process.env.AUDIT_EXPORT_BUCKET,
    AUDIT_EXPORT_REGION: process.env.AUDIT_EXPORT_REGION,
    AUDIT_EXPORT_ROLE_ARN: process.env.AUDIT_EXPORT_ROLE_ARN,
    AUDIT_EXPORT_ACCESS_KEY_ID: process.env.AUDIT_EXPORT_ACCESS_KEY_ID,
    AUDIT_EXPORT_SECRET_ACCESS_KEY: process.env.AUDIT_EXPORT_SECRET_ACCESS_KEY,
  });

  let run: Awaited<ReturnType<typeof runExport>>;
  try {
    run = await runExport(ledger, config, source, s3Upload, () => new Date());
  } catch (error) {
    // 시작을 적지 못했다 — DB 에 닿지 못한 것이라 결과도 못 적는다. 까닭은 기록에만
    console.error('audit-export', error);
    return new Response('export failed', { status: 500 });
  }

  switch (run.kind) {
    case 'busy':
      return Response.json({ busy: true });
    case 'off':
      return Response.json({ configured: false });
    case 'misconfigured':
      // 어느 이름이 빠졌는지까지만 — 값은 싣지 않는다
      console.error('audit-export misconfigured', run.problem);
      return new Response('export misconfigured', { status: 500 });
    case 'failed':
      console.error('audit-export failed', run.errorClass);
      return new Response('export failed', { status: 500 });
    case 'succeeded':
      return Response.json({ configured: true, objects: run.result.objects, rows: run.result.rows });
  }
}
