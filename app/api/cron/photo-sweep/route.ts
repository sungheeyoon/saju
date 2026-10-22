import 'server-only';

import { keyedClient } from '@/app/keyed-client';

import { s3PhotoStore } from '../../../me/photo/s3-store';
import { photoStoreState } from '../../../me/photo/store-env';
import { cronAuthorized } from '../authorized';
import { sweepOnce, type TrashLedger } from './sweep';

/**
 * **사진 저장소를 하루 한 번 치운다** (G-120, `20261227090000`).
 *
 * 깨우는 것은 Vercel Cron 하나(`vercel.json`)고, 자격은 다른 크론과 같은 `CRON_SECRET` 이다. 저장소의 켜는 값이 **모두** 없으면
 * DB 에도 안 닿고 「설정 안 됨」(200, 조용히)이다 — 꺼진 배포에는 지울 객체가 없다. **일부만** 있으면 오설정(500)이다 —
 * 켜려던 것이라 Vercel 로그와 크론의 실패로 드러난다. 다섯 번 넘게 못 지운 객체는 DB 가 운영 알림을 낸다.
 */

export const maxDuration = 60;

const rpcError = (name: string, code: string | undefined) => Object.assign(new Error(name), { code: code ?? 'unknown' });

export async function GET(request: Request): Promise<Response> {
  if (!cronAuthorized(request)) {
    return new Response('forbidden', { status: 403 });
  }

  const state = photoStoreState();
  if (state.state === 'off') return Response.json({ configured: false });
  if (state.state === 'partial') {
    console.error('photo-sweep misconfigured', state.problem);
    return new Response('sweep misconfigured', { status: 500 });
  }

  let keyed: ReturnType<typeof keyedClient>;
  try {
    keyed = keyedClient('사진 저장소 청소');
  } catch {
    return new Response('not configured', { status: 503 });
  }

  const ledger: TrashLedger = {
    sweepTickets: async () => {
      const { data, error } = await keyed.rpc('photo_sweep_tickets');
      if (error) throw rpcError('photo_sweep_tickets', error.code);
      return data ?? 0;
    },
    batch: async (limit) => {
      const { data, error } = await keyed.rpc('photo_trash_batch', { p_limit: limit });
      if (error) throw rpcError('photo_trash_batch', error.code);
      return data ?? [];
    },
    settle: async (deleted, failed, errorClass) => {
      const { data, error } = await keyed.rpc('photo_trash_settle', {
        p_deleted: [...deleted],
        p_failed: [...failed],
        p_error_class: errorClass ?? '',
      });
      if (error) throw rpcError('photo_trash_settle', error.code);
      return data ?? false;
    },
  };

  try {
    const result = await sweepOnce(ledger, s3PhotoStore(state.config));
    if (result.failed > 0) {
      console.error('photo-sweep: 못 지운 객체', result.failed, result.errorClass);
      return Response.json(result, { status: 500 });
    }
    return Response.json(result);
  } catch (error) {
    // DB 에 닿지 못했다 — 분류만 기록에(오류 문장에는 버킷 · 역할이 섞일 수 있다)
    const code = (error as { code?: unknown } | null)?.code;
    console.error('photo-sweep failed', typeof code === 'string' ? code : 'unknown');
    return new Response('sweep failed', { status: 500 });
  }
}
