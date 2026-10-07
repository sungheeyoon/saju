import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '@/src/lib/db';

import { dispatchPushBatch } from './dispatch';
import type { PushSender } from './send';

const row = (n: number) => ({
  delivery_id: `delivery-${n}`,
  endpoint: `https://push.example/${n}`,
  p256dh: 'p256dh',
  auth: 'auth',
  match_id: `00000000-0000-4000-8000-00000000000${n}`,
  attempts: 0,
});

function fakeDb(rows: ReturnType<typeof row>[], settleError: (id: string) => boolean = () => false) {
  const settled: Array<{ id: string; result: string }> = [];
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'claim_push_deliveries') return { data: rows, error: null };
    if (name === 'settle_push_delivery') {
      const id = args.p_delivery_id as string;
      if (settleError(id)) return { data: null, error: { code: '57014', message: 'timeout' } };
      settled.push({ id, result: args.p_result as string });
      return { data: null, error: null };
    }
    throw new Error(`모르는 문: ${name}`);
  });
  return { db: { rpc } as unknown as SupabaseClient<Database>, rpc, settled };
}

describe('배달 한 묶음 (ADR 0157)', () => {
  it('잠근 줄마다 보내고, 받은 답대로 닫는다', async () => {
    const { db, settled } = fakeDb([row(1), row(2), row(3)]);
    const answers: Record<string, 'sent' | 'gone' | 'retry'> = {
      'https://push.example/1': 'sent',
      'https://push.example/2': 'gone',
      'https://push.example/3': 'retry',
    };
    const sender: PushSender = async (target) => answers[target.endpoint];

    const summary = await dispatchPushBatch(db, sender);

    expect(summary?.claimed).toBe(3);
    expect(summary?.settled).toEqual({ sent: 1, gone: 1, retry: 1, unconfigured: 0 });
    expect(settled.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: 'delivery-1', result: 'sent' },
      { id: 'delivery-2', result: 'gone' },
      { id: 'delivery-3', result: 'retry' },
    ]);
  });

  it('송신기에 방 id 와 구독만 넘긴다', async () => {
    const { db } = fakeDb([row(1)]);
    const sender = vi.fn<PushSender>(async () => 'sent');

    await dispatchPushBatch(db, sender);

    expect(sender).toHaveBeenCalledWith(
      { endpoint: 'https://push.example/1', p256dh: 'p256dh', auth: 'auth' },
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('송신기가 없으면(설정 안 됨) 보내지 않고 줄마다 unconfigured 로 닫는다', async () => {
    const { db, settled } = fakeDb([row(1), row(2)]);

    const summary = await dispatchPushBatch(db, null);

    expect(summary?.settled.unconfigured).toBe(2);
    expect(settled.map(({ result }) => result)).toEqual(['unconfigured', 'unconfigured']);
  });

  it('송신기가 던져도 그 줄은 다시 보내기로 닫는다 — 묶음이 멈추지 않는다', async () => {
    const { db, settled } = fakeDb([row(1), row(2)]);
    const sender: PushSender = async (target) => {
      if (target.endpoint.endsWith('/1')) throw new Error('boom');
      return 'sent';
    };

    await dispatchPushBatch(db, sender);

    expect(settled.sort((a, b) => a.id.localeCompare(b.id)).map(({ result }) => result)).toEqual(['retry', 'sent']);
  });

  it('닫기를 못 한 줄은 센다 — 다른 줄은 그대로 닫는다', async () => {
    const { db } = fakeDb([row(1), row(2)], (id) => id === 'delivery-1');
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await dispatchPushBatch(db, async () => 'sent');

    expect(summary?.unsettled).toBe(1);
    expect(summary?.settled.sent).toBe(1);
    quiet.mockRestore();
  });

  it('잠그기를 못 하면 아무것도 보내지 않는다', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: '42501', message: 'denied' } }));
    const sender = vi.fn<PushSender>(async () => 'sent');
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    const summary = await dispatchPushBatch({ rpc } as unknown as SupabaseClient<Database>, sender);

    expect(summary).toBeNull();
    expect(sender).not.toHaveBeenCalled();
    quiet.mockRestore();
  });

  it('동시에 여는 송신은 여섯을 넘지 않는다', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ ...row(1), delivery_id: `d-${i}`, endpoint: `e-${i}` }));
    const { db } = fakeDb(rows);
    let open = 0;
    let most = 0;
    const sender: PushSender = async () => {
      open += 1;
      most = Math.max(most, open);
      await new Promise((resolve) => setTimeout(resolve, 2));
      open -= 1;
      return 'sent';
    };

    const summary = await dispatchPushBatch(db, sender);

    expect(summary?.settled.sent).toBe(20);
    expect(most).toBeLessThanOrEqual(6);
    expect(most).toBeGreaterThan(1);
  });
});
