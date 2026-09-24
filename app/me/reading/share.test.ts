import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dbFailure } from '../../db-error';

const rpc = vi.fn();
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

const current = vi.fn();
vi.mock('./current', () => ({
  currentReading: (...args: unknown[]) => current(...args),
}));

const { shareMyReading } = await import('./share');

/**
 * **공유 링크를 못 만든 것도 값으로 낸다**(ADR 0078).
 *
 * 풀이를 못 읽으면 문이 던진다(`currentReading` → `dbFailure`). 액션이 그대로 던지면 운영의
 * Next 가 문장을 영어 안내로 바꾸고, 버튼은 제 일반 문장밖에 못 세운다 — 문이 이미 지은
 * 까닭이 사라진다.
 */

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rpc.mockReset();
  current.mockReset();
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => logged.mockRestore());

describe('풀이 공유', () => {
  it('풀이를 못 읽으면 문이 지은 문장을 값으로 낸다', async () => {
    current.mockRejectedValue(dbFailure({ message: '이용이 정지된 계정입니다', code: '42501' }, 'my_reading'));

    await expect(shareMyReading({ kind: 'self' })).resolves.toEqual({
      ok: false,
      message: '이용이 정지된 계정입니다',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('우리가 안 쓴 오류는 이 버튼의 문장으로 선다', async () => {
    current.mockRejectedValue(new TypeError('fetch failed'));

    await expect(shareMyReading({ kind: 'self' })).resolves.toEqual({
      ok: false,
      message: '공유 링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    });
  });
});
