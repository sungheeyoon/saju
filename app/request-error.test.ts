import { beforeEach, describe, expect, it, vi } from 'vitest';

const keyedRpc = vi.fn();
const answer = vi.fn();
const signals: AbortSignal[] = [];
/** 빌더의 모양 — `.rpc(...)` 뒤에 `.abortSignal(...)` 이 붙고, 그것을 기다리면 답이 온다 */
vi.mock('./keyed-client', () => ({
  keyedClient: () => ({
    rpc: (...args: unknown[]) => {
      keyedRpc(...args);
      return {
        abortSignal: (signal: AbortSignal) => {
          signals.push(signal);
          return answer();
        },
      };
    },
  }),
}));

import { digestOf, forgetSentReports, REPORT_TIMEOUT_MS, reportRequestError } from './request-error';

/**
 * **서버 오류 알림은 Production 에서만, 무늬 · 자리 · digest 셋만, 실패는 삼킨다.**
 *
 * 가짜는 열쇠 문 하나다. DB 쪽 — 누가 부를 수 있나 · 모양이 틀리면 던지나 · 하루 한 줄 — 은 `74_ops_alerts` 가 잰다.
 */
describe('reportRequestError', () => {
  beforeEach(() => {
    keyedRpc.mockReset();
    answer.mockReset();
    answer.mockResolvedValue({ data: true, error: null });
    signals.length = 0;
    forgetSentReports();
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
    answer.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'request-error: route' } });
    await expect(reportRequestError('/app/me/page', 'route', null, 'production')).resolves.toBeUndefined();
    answer.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expect(reportRequestError('/app/other/page', 'route', null, 'production')).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});

describe('reportRequestError — 오류 응답을 붙들지 않는다', () => {
  beforeEach(() => {
    keyedRpc.mockReset();
    answer.mockReset();
    answer.mockResolvedValue({ data: true, error: null });
    signals.length = 0;
    forgetSentReports();
  });

  it(`부름에 ${REPORT_TIMEOUT_MS}ms 시간 제한을 건다 — Next 가 오류 응답 전에 이 부름을 기다린다`, async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await reportRequestError('/app/me/page', 'render', null, 'production');
    expect(timeout).toHaveBeenCalledWith(REPORT_TIMEOUT_MS);
    expect(signals).toHaveLength(1);
    expect(REPORT_TIMEOUT_MS).toBeLessThanOrEqual(2000);
    timeout.mockRestore();
  });

  it('시간이 다 되어 끊겨도 삼킨다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    answer.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    await expect(reportRequestError('/app/me/page', 'render', null, 'production')).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith('request-error: report_request_error', 'TimeoutError');
    logged.mockRestore();
  });

  it('한 인스턴스 안에서 같은 날 같은 자리 · 라우트는 한 번만 보낸다 — 실패했어도 다시 두드리지 않는다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const noon = new Date('2026-09-30T03:00:00Z');
    answer.mockRejectedValueOnce(new TypeError('fetch failed'));
    await reportRequestError('/app/me/page', 'render', '1', 'production', noon);
    await reportRequestError('/app/me/page', 'render', '2', 'production', noon);
    await reportRequestError('/app/me/page', 'render', '3', 'production', noon);
    expect(keyedRpc).toHaveBeenCalledTimes(1);

    await reportRequestError('/app/me/page', 'action', null, 'production', noon);
    await reportRequestError('/app/you/page', 'render', null, 'production', noon);
    expect(keyedRpc).toHaveBeenCalledTimes(3);
    logged.mockRestore();
  });

  it('서울 날짜가 바뀌면 다시 보낸다', async () => {
    await reportRequestError('/app/me/page', 'render', null, 'production', new Date('2026-09-30T14:59:00Z'));
    await reportRequestError('/app/me/page', 'render', null, 'production', new Date('2026-09-30T15:01:00Z'));
    expect(keyedRpc).toHaveBeenCalledTimes(2);
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
