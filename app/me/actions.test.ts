import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_QUERY, type Query } from '@/src/lib/input/query';

import { dbFailure } from '../db-error';

const rpc = vi.fn();
vi.mock('../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

/** 같은 명식을 찾는 일은 제 시험이 잰다(`same-chart.test.ts`) — 여기서는 그 문이 터진 뒤를 본다 */
const sameChart = vi.fn();
vi.mock('./same-chart', () => ({
  sameChartInMyList: (...args: unknown[]) => sameChart(...args),
}));

const { addManagedPerson, savePersonForReading } = await import('./actions');

/**
 * **서버 액션은 던지지 않고 값으로 답한다**(ADR 0078).
 *
 * 액션이 던지면 운영의 Next 는 그 문장을 지우고 영어 안내로 바꿔 보낸다 — 문이 이미 우리말로
 * 지은 문장(`dbFailure`)도 거기서 사라진다. 폼은 `kind: 'failed'` 의 문장을 세울 줄 아니까,
 * 문이 터진 것도 그 모양으로 낸다. **저장은 멈춘다** — 같은 명식인지 모르는 채로 밀지 않는다.
 */

const QUERY: Query = { ...DEFAULT_QUERY, name: '어머니', date: '1990-05-15', time: '14:30' };

/** 우리가 쓴 거절 — 문을 지나도 그대로 선다 */
const SUSPENDED = '이용이 정지된 계정입니다';

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: 'new-person', error: null });
  sameChart.mockReset();
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => logged.mockRestore());

const saved = () => rpc.mock.calls.filter(([name]) => name === 'create_managed_person');

describe.each([
  ['addManagedPerson', () => addManagedPerson(QUERY, '')],
  ['savePersonForReading', () => savePersonForReading(QUERY)],
])('%s — 같은 명식을 못 물으면', (_, save) => {
  it('문이 지은 우리말 문장을 값으로 낸다 — 던지지 않고 저장도 안 민다', async () => {
    sameChart.mockRejectedValue(dbFailure({ message: SUSPENDED, code: '42501' }, 'app_user.self_person_id'));

    await expect(save()).resolves.toEqual({ ok: false, kind: 'failed', message: SUSPENDED });
    expect(saved()).toEqual([]);
  });

  it('우리가 안 쓴 오류는 안 옮긴다 — 일반 문장으로 선다', async () => {
    sameChart.mockRejectedValue(new Error('Cannot read properties of undefined'));

    await expect(save()).resolves.toEqual({
      ok: false,
      kind: 'failed',
      message: '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    });
    expect(saved()).toEqual([]);
  });
});
