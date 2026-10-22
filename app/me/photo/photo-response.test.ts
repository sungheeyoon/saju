import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();

vi.mock('../../auth/server-client', () => ({
  supabaseOnServer: async () => ({ rpc }),
}));

/** 저장소 — 메모리 저장소를 쓰고, 꺼짐은 `null` 로 */
const { memoryPhotoStore } = await import('./store');
const memory = memoryPhotoStore();
let storeOn = true;
vi.mock('./s3-store', () => ({ photoStoreIfReady: () => (storeOn ? memory.store : null) }));

const KEY = 'photos/0f8b2f6e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918';

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

  describe('저장소에 사는 장 — 판정을 지난 줄의 열쇠로 읽는다(G-120 안 A, draft)', () => {
    beforeEach(async () => {
      storeOn = true;
      await memory.store.put(`${KEY}/card`, Uint8Array.from([1]), 'image/webp');
      await memory.store.put(`${KEY}/large`, Uint8Array.from([2, 2]), 'image/webp');
    });

    it('큰 벌이 기본이고 `card` 를 고르면 작은 벌이다 — 캐시는 지금과 같다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY }], error: null });

      const large = await photoResponse('u-1', 1);
      const card = await photoResponse('u-1', 1, 'card');

      expect(new Uint8Array(await large.arrayBuffer())).toEqual(Uint8Array.from([2, 2]));
      expect(new Uint8Array(await card.arrayBuffer())).toEqual(Uint8Array.from([1]));
      expect(large.headers.get('Cache-Control')).toBe('private, max-age=60');
      expect(large.headers.get('Content-Type')).toBe('image/webp');
    });

    it('판정에서 막힌 사람은 저장소에 안 닿는다 — 줄이 안 나온다', async () => {
      rpc.mockResolvedValue({ data: [], error: null });
      const get = vi.spyOn(memory.store, 'get');

      expect((await photoResponse('u-1', 1)).status).toBe(404);
      expect(get).not.toHaveBeenCalled();
    });

    it('객체가 없으면 없는 장과 같은 404, 저장소가 꺼졌으면 500', async () => {
      rpc.mockResolvedValue({
        data: [{ content_type: 'image/webp', base64: null, object_key: KEY.replace('7e6d', '0000') }],
        error: null,
      });
      expect((await photoResponse('u-1', 1)).status).toBe(404);

      storeOn = false;
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY }], error: null });
      expect((await photoResponse('u-1', 1)).status).toBe(500);
    });
  });

  it('DB 가 고장 나면 500 이고 그 까닭이 기록에 남는다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });

    const answer = await photoResponse('u-1', 2);

    expect(answer.status).toBe(500);
    expect(await answer.text()).toBe('');
    expect(logged).toHaveBeenCalledWith('photo_at 2', '57014', 'canceling statement due to statement timeout');
  });
});
