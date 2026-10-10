import { beforeEach, describe, expect, it, vi } from 'vitest';

/* 무르는 부름을 차례대로 적는다 — 기다리던 칸은 이 응답 말고 화면을 따로 다시 읽지 않는다(ADR 0016 덧) */
const cacheCalls = vi.hoisted(() => [] as string[]);
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => cacheCalls.push(`revalidatePath ${path}`),
  refresh: () => cacheCalls.push('refresh'),
}));
vi.mock('./current', () => ({ lastReadingRun: vi.fn() }));
vi.mock('./pipeline', () => ({ beginReading: vi.fn() }));
vi.mock('../../taste-visitor', () => ({ forgetTasteClaim: vi.fn(async () => {}) }));
vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import type { LastRun } from './current';
import { lastReadingRun } from './current';
import { markReadingReadyRead, readingRunState } from './actions';
import { supabaseOnServer } from '../../auth/server-client';

const run = (status: LastRun['status']): LastRun => ({
  status,
  failureCode: null,
  createdAt: '2026-10-08T00:00:00.000Z',
  progress: null,
});

beforeEach(() => {
  cacheCalls.length = 0;
});

describe('기다리는 칸이 묻는 문', () => {
  it('도는 중이면 아무것도 안 무른다 — 3초마다의 물음이 화면을 다시 그리게 하지 않는다', async () => {
    vi.mocked(lastReadingRun).mockResolvedValue(run('running'));

    await readingRunState({ kind: 'self' });

    expect(cacheCalls).toEqual([]);
  });

  it('가리킬 시도가 없어도 안 무른다', async () => {
    vi.mocked(lastReadingRun).mockResolvedValue(null);

    await readingRunState({ kind: 'self' });

    expect(cacheCalls).toEqual([]);
  });

  /**
   * **끝난 것을 본 응답이 지금 화면을 싣는다.** 칸이 선 주소가 `readingPathsOf` 와 달라도(보관함 틀의
   * `/me/readings/match/<id>`) 그 화면이 다시 그려지게 `refresh()` 를 부르고, 경로 무르기보다 **먼저** 부른다 — 뒤에
   * 부르면 「정적까지 무름」이 「동적만」으로 덮인다(`app/refresh.ts` 의 `refreshPaths`).
   */
  it.each(['succeeded', 'failed'] as const)('%s 를 보면 지금 화면을 먼저 다시 그리고 대상의 주소를 무른다', async (status) => {
    vi.mocked(lastReadingRun).mockResolvedValue(run(status));

    await readingRunState({ kind: 'match', matchId: 'm-1' });

    expect(cacheCalls).toEqual(['refresh', 'revalidatePath /me/match/m-1']);
  });
});

describe('결과 화면이 그 풀이의 완성 소식을 읽음으로 바꾸는 문', () => {
  const answering = (answer: { data: number | null; error: { code: string; message: string } | null }) => {
    const rpc = vi.fn(async () => answer);
    vi.mocked(supabaseOnServer).mockResolvedValue({ rpc } as never);
    return rpc;
  };

  it('그 풀이의 id 하나로 묻는다 — 어느 소식이 그 풀이 · 내 것인지는 DB 가 답한다', async () => {
    const rpc = answering({ data: 1, error: null });

    await markReadingReadyRead('reading-1');

    expect(rpc).toHaveBeenCalledWith('mark_reading_ready_read', { p_reading_id: 'reading-1' });
  });

  it('바꾼 수를 싣는다 — 다시 열어 바꿀 것이 없으면 0 이다', async () => {
    answering({ data: 1, error: null });
    expect(await markReadingReadyRead('reading-1')).toEqual({ ok: true, marked: 1 });

    answering({ data: 0, error: null });
    expect(await markReadingReadyRead('reading-1')).toEqual({ ok: true, marked: 0 });
  });

  it('화면을 무르지 않는다 — 결과 화면에는 소식이 안 선다', async () => {
    answering({ data: 1, error: null });

    await markReadingReadyRead('reading-1');

    expect(cacheCalls).toEqual([]);
  });

  it('못 바꾸면 원문을 싣지 않고 값으로 낸다', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    answering({ data: null, error: { code: '42501', message: 'permission denied for function mark_reading_ready_read' } });

    const answer = await markReadingReadyRead('reading-1');

    expect(answer.ok).toBe(false);
    expect(answer.ok === false && answer.message).not.toContain('permission denied');
    quiet.mockRestore();
  });
});
