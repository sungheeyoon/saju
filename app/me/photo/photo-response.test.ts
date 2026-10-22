import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

const { photoResponse } = await import('./photo-response');

/**
 * **못 보는 것은 없는 것과 같은 404, 고장 난 것만 500 이고 기록에 남는다**(ADR 0078) — 기록에는 자리 이름 · 자리 번호 ·
 * 오류 코드만 간다. 답에는 원문이 안 실린다.
 */
describe('사진 한 장을 내주는 자리', () => {
  let logged: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    rpc.mockReset();
    logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => logged.mockRestore());

  it('문이 닫힌 사람은 404 이고 기록에 안 남는다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });

    const answer = await photoResponse('u-1', 1);

    expect(answer.status).toBe(404);
    expect(logged).not.toHaveBeenCalled();
  });

  it('바이트가 저장소에 사는 장(base64 가 빔)은 열람 방식을 정하기 전까지 없는 장과 같은 404 다', async () => {
    rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null }], error: null });

    const answer = await photoResponse('u-1', 1);

    expect(answer.status).toBe(404);
    expect(logged).not.toHaveBeenCalled();
  });

  it('DB 가 고장 나면 500 이고 그 까닭이 기록에 남는다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });

    const answer = await photoResponse('u-1', 2);

    expect(answer.status).toBe(500);
    expect(await answer.text()).toBe('');
    expect(logged).toHaveBeenCalledWith('photo_at 2', '57014', 'canceling statement due to statement timeout');
  });
});
