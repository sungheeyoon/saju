import { beforeEach, describe, expect, it, vi } from 'vitest';

const keyedRpc = vi.fn();
vi.mock('./keyed-client', () => ({ keyedClient: () => ({ rpc: keyedRpc }) }));

import { digestOf, reportRequestError } from './request-error';

/**
 * **서버 오류 알림은 Production 에서만, 무늬 · 자리 · digest 셋만, 실패는 삼킨다.**
 *
 * 가짜는 열쇠 문 하나다. DB 쪽 — 누가 부를 수 있나 · 모양이 틀리면 던지나 · 하루 한 줄 — 은 `74_ops_alerts` 가 잰다.
 */
describe('reportRequestError', () => {
  beforeEach(() => {
    keyedRpc.mockReset();
    keyedRpc.mockResolvedValue({ data: true, error: null });
  });

  it('Production 에서 무늬 · 자리 · digest 만 보낸다', async () => {
    await reportRequestError('/app/me/[id]/page', 'render', '1234567890', 'production');
    expect(keyedRpc).toHaveBeenCalledWith('report_request_error', {
      p_route: '/app/me/[id]/page',
      p_kind: 'render',
      p_digest: '1234567890',
    });
  });

  it('Preview · 로컬에서는 안 보낸다 — 알림함이 소음이 되지 않게', async () => {
    await reportRequestError('/app/me/page', 'render', null, 'preview');
    await reportRequestError('/app/me/page', 'render', null, undefined);
    expect(keyedRpc).not.toHaveBeenCalled();
  });

  it('모르는 자리는 안 보낸다', async () => {
    await reportRequestError('/app/me/page', 'boom', null, 'production');
    expect(keyedRpc).not.toHaveBeenCalled();
  });

  it('문이 거절하거나 던져도 삼키고 로그에 한 줄 남긴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    keyedRpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'request-error: route' } });
    await expect(reportRequestError('/app/me/page', 'route', null, 'production')).resolves.toBeUndefined();
    keyedRpc.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(reportRequestError('/app/me/page', 'route', null, 'production')).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});

describe('digestOf', () => {
  it('digest 가 있으면 그 값', () => {
    expect(digestOf(Object.assign(new Error('x'), { digest: '42' }))).toBe('42');
  });

  it('없거나 모양이 다르면 null — 오류 문장이 digest 자리로 새지 않는다', () => {
    expect(digestOf(new Error('x'))).toBeNull();
    expect(digestOf('문자열')).toBeNull();
    expect(digestOf(null)).toBeNull();
    expect(digestOf({ digest: 'NEXT_REDIRECT;replace;/me?id=1' })).toBeNull();
  });
});
