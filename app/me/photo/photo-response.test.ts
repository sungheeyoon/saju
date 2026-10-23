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

const { heldVersionOf, photoResponse } = await import('./photo-response');

/** 브라우저가 보내는 요청 — `If-None-Match` 를 실을 수 있다 */
const asked = (ifNoneMatch?: string): Request =>
  new Request('http://localhost/me/photo/u-1', ifNoneMatch === undefined ? {} : { headers: { 'If-None-Match': ifNoneMatch } });

const VERSION = 1792800000123456;

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

    const answer = await photoResponse(asked(), 'u-1', 1);

    expect(answer.status).toBe(404);
    expect(logged).not.toHaveBeenCalled();
  });

  describe('저장소에 사는 장 — 판정을 지난 줄의 열쇠로 읽는다(G-120 안 A, ADR 0203)', () => {
    beforeEach(async () => {
      storeOn = true;
      await memory.store.put(`${KEY}/card`, Uint8Array.from([1]), 'image/webp');
      await memory.store.put(`${KEY}/large`, Uint8Array.from([2, 2]), 'image/webp');
    });

    it('큰 벌이 기본이고 `card` 를 고르면 작은 벌이다 — 캐시 머리는 바이트 줄과 같다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY, version: VERSION }], error: null });

      const large = await photoResponse(asked(), 'u-1', 1);
      const card = await photoResponse(asked(), 'u-1', 1, 'card');

      expect(new Uint8Array(await large.arrayBuffer())).toEqual(Uint8Array.from([2, 2]));
      expect(new Uint8Array(await card.arrayBuffer())).toEqual(Uint8Array.from([1]));
      expect(large.headers.get('Cache-Control')).toBe('private, no-cache');
      expect(large.headers.get('ETag')).toBe(`"${VERSION}"`);
      expect(large.headers.get('Content-Type')).toBe('image/webp');
    });

    it('든 판본이면 304 이고 저장소에 안 닿는다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY, version: VERSION }], error: null });
      const get = vi.spyOn(memory.store, 'get');

      const answer = await photoResponse(asked(`"${VERSION}"`), 'u-1', 1);

      expect(answer.status).toBe(304);
      expect(get).not.toHaveBeenCalled();
      get.mockRestore();
    });

    it('판정에서 막힌 사람은 저장소에 안 닿는다 — 줄이 안 나온다', async () => {
      rpc.mockResolvedValue({ data: [], error: null });
      const get = vi.spyOn(memory.store, 'get');

      expect((await photoResponse(asked(), 'u-1', 1)).status).toBe(404);
      expect(get).not.toHaveBeenCalled();
      get.mockRestore();
    });

    it('객체가 없으면 없는 장과 같은 404, 저장소가 꺼졌으면 500', async () => {
      rpc.mockResolvedValue({
        data: [{ content_type: 'image/webp', base64: null, object_key: KEY.replace('7e6d', '0000'), version: VERSION }],
        error: null,
      });
      expect((await photoResponse(asked(), 'u-1', 1)).status).toBe(404);

      storeOn = false;
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY, version: VERSION }], error: null });
      expect((await photoResponse(asked(), 'u-1', 1)).status).toBe(500);
    });

    it('저장소가 던지면(권한 403 등) 404 로 숨기지 않고 500 이다 — 없는 객체(null)만 404', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, object_key: KEY, version: VERSION }], error: null });
      const get = vi.spyOn(memory.store, 'get').mockRejectedValue(Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }));
      const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      expect((await photoResponse(asked(), 'u-1', 1)).status).toBe(500);
      expect(logged).toHaveBeenCalled();
      get.mockRestore();
      logged.mockRestore();
    });
  });

  it('DB 가 고장 나면 500 이고 그 까닭이 기록에 남는다', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } });

    const answer = await photoResponse(asked(), 'u-1', 2);

    expect(answer.status).toBe(500);
    expect(await answer.text()).toBe('');
    expect(logged).toHaveBeenCalledWith('photo_at 2', '57014', 'canceling statement due to statement timeout');
  });
  /**
   * **판본 대조(G-119 안 C)** — 판정은 `photo_at` 이 먼저 하고(못 보면 0행 → 404), 그 줄의 판본이 브라우저가 든 판본과 같을 때만
   * 304 다. 304 · 200 모두 `private, no-cache` 와 같은 `ETag` 를 단다.
   */
  describe('판본 대조', () => {
    it('든 판본을 물으면 304 이고 판본이 DB 로 간다 — 바이트 없음, 캐시 머리는 그대로', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/png', base64: null, version: VERSION }], error: null });

      const answer = await photoResponse(asked(`"${VERSION}"`), 'u-1', 1);

      expect(rpc).toHaveBeenCalledWith('photo_at', { p_user_id: 'u-1', p_position: 1, p_version: VERSION });
      expect(answer.status).toBe(304);
      expect(await answer.text()).toBe('');
      expect(answer.headers.get('ETag')).toBe(`"${VERSION}"`);
      expect(answer.headers.get('Cache-Control')).toBe('private, no-cache');
    });

    it('처음 열면 판본을 안 넘기고 바이트와 ETag 를 낸다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/png', base64: 'AQI=', version: VERSION }], error: null });

      const answer = await photoResponse(asked(), 'u-1', 1);

      expect(rpc).toHaveBeenCalledWith('photo_at', { p_user_id: 'u-1', p_position: 1 });
      expect(answer.status).toBe(200);
      expect(new Uint8Array(await answer.arrayBuffer())).toEqual(Uint8Array.from([1, 2]));
      expect(answer.headers.get('ETag')).toBe(`"${VERSION}"`);
      expect(answer.headers.get('Cache-Control')).toBe('private, no-cache');
      expect(answer.headers.get('Content-Type')).toBe('image/png');
    });

    it('판본이 다르면(사진을 바꿨거나 다른 장이 앉음) 새 바이트다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/png', base64: 'AQI=', version: VERSION + 1 }], error: null });

      const answer = await photoResponse(asked(`"${VERSION}"`), 'u-1', 1);

      expect(answer.status).toBe(200);
      expect(answer.headers.get('ETag')).toBe(`"${VERSION + 1}"`);
    });

    it('못 보게 된 사람은 판본을 맞혀도 404 다 — 판정이 판본보다 먼저다', async () => {
      rpc.mockResolvedValue({ data: [], error: null });

      const answer = await photoResponse(asked(`"${VERSION}"`), 'u-1', 1);

      expect(answer.status).toBe(404);
      expect(answer.headers.get('ETag')).toBeNull();
    });

    it('바이트도 열쇠도 없는 줄은 판본이 다르면 304 가 아니라 404 다 — 빈 바이트는 「같은 판본」이 아니다', async () => {
      rpc.mockResolvedValue({ data: [{ content_type: 'image/webp', base64: null, version: VERSION }], error: null });

      expect((await photoResponse(asked(), 'u-1', 1)).status).toBe(404);
      expect((await photoResponse(asked(`"${VERSION - 1}"`), 'u-1', 1)).status).toBe(404);
    });
  });

  it('If-None-Match 는 우리가 단 꼴 하나만 판본으로 읽는다 — 약한 표지는 받고, 목록 · * · 다른 꼴은 바이트를 보낸다', () => {
    expect(heldVersionOf(`"${VERSION}"`)).toBe(VERSION);
    expect(heldVersionOf(`W/"${VERSION}"`)).toBe(VERSION);
    expect(heldVersionOf(null)).toBeNull();
    expect(heldVersionOf('*')).toBeNull();
    expect(heldVersionOf(`"${VERSION}", "1"`)).toBeNull();
    expect(heldVersionOf('"abc"')).toBeNull();
    expect(heldVersionOf('"99999999999999999"')).toBeNull();
  });
});
