import { describe, expect, it, vi } from 'vitest';

import { dbFailure, userFacingDbMessage } from './db-error';

describe('userFacingDbMessage', () => {
  it('DB 가 우리말로 쓴 거절은 그대로 옮긴다', () => {
    const message = userFacingDbMessage(
      { message: '풀이권을 다 쓰셨습니다. 테스트 기간에는 5번까지 만들 수 있어요.', code: 'P0001' },
      'start_reading_run',
      '대신 쓸 말',
    );

    expect(message).toBe('풀이권을 다 쓰셨습니다. 테스트 기간에는 5번까지 만들 수 있어요.');
  });

  it('우리가 안 쓴 오류는 사용자에게 안 보내고 기록에 남긴다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const message = userFacingDbMessage(
      {
        message: 'new row violates row-level security policy for table "reading_run"',
        code: '42501',
      },
      'start_reading_run',
      '대신 쓸 말',
    );

    expect(message).toBe('대신 쓸 말');
    expect(logged).toHaveBeenCalledWith(
      'start_reading_run',
      '42501',
      'new row violates row-level security policy for table "reading_run"',
    );

    logged.mockRestore();
  });

  /**
   * **코드로는 못 가른다.** `42501` 은 우리가 「중지된 계정입니다」로 쓰는 코드이면서 정책이
   * 이름 없이 막을 때의 코드이기도 하다 — 두 줄이 같은 코드를 들고 갈린다.
   */
  it('같은 코드라도 우리말이면 옮기고 아니면 막는다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(userFacingDbMessage({ message: '중지된 계정입니다.', code: '42501' }, 'x', '대신')).toBe(
      '중지된 계정입니다.',
    );
    expect(userFacingDbMessage({ message: 'permission denied', code: '42501' }, 'x', '대신')).toBe(
      '대신',
    );

    logged.mockRestore();
  });

  it('코드가 없어도 기록은 남는다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    userFacingDbMessage({ message: 'fetch failed' }, 'leave_reading_feedback', '대신');

    expect(logged).toHaveBeenCalledWith('leave_reading_feedback', '', 'fetch failed');

    logged.mockRestore();
  });
});

/**
 * **문턱이 없어야 쓰인다** (#67).
 *
 * 이 함수가 두 자리에서만 불리던 까닭은 `fallback` 이 필수였기 때문이다 — 쓰려면 한국어
 * 문장을 새로 짓고 그 문장이 살 자리부터 찾아야 했다. 아래가 재는 것은 **인자 없이도
 * 말이 되는가**다.
 */
describe('대신 쓸 말을 안 줬을 때', () => {
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

  it('함수를 못 찾은 것은 우리 쪽이 어긋난 것으로 말한다', () => {
    const logged = quiet();

    expect(
      userFacingDbMessage(
        { message: 'function public.save_reading(...) does not exist', code: '42883' },
        'save_reading',
      ),
    ).toBe('서비스가 잠시 어긋났습니다. 잠시 뒤 다시 시도해 주세요.');

    logged.mockRestore();
  });

  /** PostgREST 가 스키마 캐시로 거절한 것도 같은 갈래다 — 배포가 어긋난 모양이다 */
  it('스키마 캐시가 문을 못 찾은 것도 같은 말로 선다', () => {
    const logged = quiet();

    expect(
      userFacingDbMessage(
        { message: 'Could not find the function in the schema cache', code: 'PGRST202' },
        'share_my_reading',
      ),
    ).toBe('서비스가 잠시 어긋났습니다. 잠시 뒤 다시 시도해 주세요.');

    logged.mockRestore();
  });

  it('이름 없이 막힌 것은 권한으로 말한다', () => {
    const logged = quiet();

    expect(
      userFacingDbMessage(
        { message: 'new row violates row-level security policy', code: '42501' },
        'request_match',
      ),
    ).toBe('이 작업을 할 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.');

    logged.mockRestore();
  });

  /**
   * **모르는 것은 모른다고 하지 않고, 짐작도 안 적는다.** 할 수 있는 일만 적는다 —
   * 까닭을 지어 주면 사용자는 있지도 않은 원인을 고치려 든다.
   */
  it('모르는 코드는 할 수 있는 일만 적는다', () => {
    const logged = quiet();

    expect(userFacingDbMessage({ message: 'fetch failed' }, 'my_readings')).toBe(
      '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );

    logged.mockRestore();
  });

  /**
   * **코드 표는 한국어 문턱 뒤에 있다.** `42501` 은 우리가 「중지된 계정입니다」로 쓰는
   * 코드이기도 해서, 표가 앞서면 우리 문장을 가로챈다.
   */
  it('우리가 쓴 문장은 코드 표가 가로채지 않는다', () => {
    expect(userFacingDbMessage({ message: '중지된 계정입니다.', code: '42501' }, 'x')).toBe(
      '중지된 계정입니다.',
    );
  });

  it('대신 쓸 말을 주면 그것이 코드 표보다 앞선다', () => {
    const logged = quiet();

    expect(
      userFacingDbMessage({ message: 'permission denied', code: '42501' }, 'x', '이 자리의 말'),
    ).toBe('이 자리의 말');

    logged.mockRestore();
  });

  it('인자를 줄여도 기록은 그대로 남는다', () => {
    const logged = quiet();

    userFacingDbMessage({ message: 'permission denied', code: '42501' }, 'request_match');

    expect(logged).toHaveBeenCalledWith('request_match', '42501', 'permission denied');

    logged.mockRestore();
  });
});

/**
 * 던지는 자리도 **같은 문을 지난다.**
 *
 * 화면 몇은 거절을 값으로 안 받고 던져서 오류 경계가 받는데, 그 경계는 `error.message` 를
 * 그대로 세운다. 값으로 내는 자리만 고치면 영어가 화면에 서는 길이 그대로 남는다.
 */
describe('dbFailure', () => {
  it('우리말 거절은 그대로 든 Error 가 된다', () => {
    const failure = dbFailure({ message: '이미 보낸 요청이 있습니다.', code: 'P0001' }, 'x');

    expect(failure).toBeInstanceOf(Error);
    expect(failure.message).toBe('이미 보낸 요청이 있습니다.');
  });

  it('영어 원문은 Error 에도 안 실린다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const failure = dbFailure({ message: 'permission denied', code: '42501' }, 'my_candidates');

    expect(failure.message).toBe('이 작업을 할 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.');
    expect(failure.message).not.toContain('permission denied');

    logged.mockRestore();
  });
});
