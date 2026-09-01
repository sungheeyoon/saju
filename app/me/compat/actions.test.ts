import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

const begin = vi.fn();
vi.mock('../reading/pipeline', () => ({
  beginReading: (...args: unknown[]) => begin(...args),
}));

const { pairRelationFor, startPairReading } = await import('./actions');

const relationCall = () => rpc.mock.calls.find(([name]) => name === 'set_pair_relation');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  begin.mockReset();
  begin.mockResolvedValue({ ok: true, started: true });
});

/**
 * **「모른다를 골랐다」와 「이 누름에서 안 정했다」는 다른 일이다.**
 *
 * 고르는 칸이 늘 「아직 모르겠음」에서 시작했고 그 값이 그대로 넘어왔다. `null` 은
 * 행을 지우는 답이라(`set_pair_relation`), 지난번에 「가족」이라 답해 둔 두 사람을
 * **다시 고르기만 해도** 그 답이 지워지고 새 풀이가 「모른다」로 났다.
 */
describe('사이를 적는 자리', () => {
  it('이 누름에서 안 정했으면 아무것도 안 적는다', async () => {
    await startPairReading('person-a', 'person-b', undefined, 'key-1');

    expect(relationCall()).toBeUndefined();
    expect(begin).toHaveBeenCalledOnce();
  });

  it('고른 값을 적는다', async () => {
    await startPairReading('person-a', 'person-b', 'family', 'key-1');

    expect(relationCall()?.[1]).toMatchObject({ p_relation: 'family' });
  });

  /** 되돌리는 길은 남는다 — 「아직 모르겠음」을 직접 고르면 그것은 답이다 */
  it('모르겠음을 직접 고르면 지우러 간다', async () => {
    await startPairReading('person-a', 'person-b', null, 'key-1');

    expect(relationCall()?.[1]).toMatchObject({ p_relation: null });
  });

  it('적지 못하면 시도를 열지 않는다 — 옛 값으로 난 글이 남지 않게', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '못 적었습니다' } });

    const result = await startPairReading('person-a', 'person-b', 'partner', 'key-1');

    expect(result).toEqual({ ok: false, message: '못 적었습니다' });
    expect(begin).not.toHaveBeenCalled();
  });
});

/**
 * **못 읽은 것과 「모른다」를 한 값으로 내지 않는다.** 둘을 `null` 로 합치면 읽기가
 * 실패한 순간 화면이 「모른다」로 서고, 그다음 누름이 멀쩡한 값을 지운다.
 */
describe('사이를 읽는 자리', () => {
  it('적어 둔 값을 낸다', async () => {
    rpc.mockResolvedValue({ data: 'friend', error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: 'friend',
    });
  });

  it('행이 없으면 모른다로 낸다', async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: null,
    });
  });

  it('못 읽은 것은 모른다가 아니다', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '못 읽었습니다' } });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({ ok: false });
  });

  /** 우리가 아는 갈래가 아니면 모른다로 눕힌다 — 그럴듯한 쪽으로 세우지 않는다 */
  it('모르는 이름은 모른다로 눕힌다', async () => {
    rpc.mockResolvedValue({ data: 'coworker', error: null });

    await expect(pairRelationFor('person-a', 'person-b')).resolves.toEqual({
      ok: true,
      relation: null,
    });
  });
});
