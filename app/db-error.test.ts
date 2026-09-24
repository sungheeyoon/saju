import { describe, expect, it, vi } from 'vitest';

import { answerOfThrown, dbFailure, userFacingDbMessage } from './db-error';

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
   * **코드로는 못 가른다.** `42501` 은 우리가 「이용이 정지된 계정입니다」로 쓰는 코드이면서 정책이
   * 이름 없이 막을 때의 코드이기도 하다 — 두 줄이 같은 코드를 들고 갈린다.
   */
  it('같은 코드라도 우리말이면 옮기고 아니면 막는다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(userFacingDbMessage({ message: '이용이 정지된 계정입니다.', code: '42501' }, 'x', '대신')).toBe(
      '이용이 정지된 계정입니다.',
    );
    expect(userFacingDbMessage({ message: 'permission denied', code: '42501' }, 'x', '대신')).toBe(
      '대신',
    );

    logged.mockRestore();
  });

  /**
   * **한글이 들었다고 우리 것은 아니다.**
   *
   * 시스템 오류가 사용자가 보낸 한글을 되돌려 실을 수 있다. 한글 한 자를 근거로 통과시키면
   * 영어 원문이 통째로 화면에 서고, 그것이 이 함수가 막으려던 바로 그 일이다.
   */
  it.each([
    ['uuid 자리에 한글이 들어간 것', 'invalid input syntax for type uuid: "한글"', '22P02'],
    ['표 이름과 함께 한글 값이 실린 것', 'duplicate key value violates unique constraint "닉네임_key"', '23505'],
    ['정책 문장에 한글 표 이름이 실린 것', 'new row violates row-level security policy for table "사람"', '42501'],
  ])('%s 은 사용자에게 안 간다', (_label, message, code) => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const shown = userFacingDbMessage({ message, code }, 'x', '대신 쓸 말');

    expect(shown).toBe('대신 쓸 말');
    expect(shown).not.toContain(message);
    expect(logged).toHaveBeenCalledWith('x', code, message);

    logged.mockRestore();
  });

  /**
   * 가드가 **우리 것을 막지 않는가.** 마이그레이션의 84종을 재어 보니 큰따옴표가 든 것이
   * 하나도 없었다 — 그 사실이 깨지면 여기가 먼저 빨개진다.
   */
  it.each([
    '풀이권을 다 쓰셨습니다. 테스트 기간에는 5번까지 만들 수 있어요.',
    'JPG · PNG · WebP 만 올릴 수 있습니다.',
    '등록할 수 있는 사람은 20명까지입니다.',
    '보낸 인연 요청이 풀이권을 잡고 있어요. 요청을 거두거나 상대의 답을 기다려 주세요.',
  ])('우리가 쓴 %j 는 그대로 간다', (message) => {
    expect(userFacingDbMessage({ message, code: 'P0001' }, 'x', '대신')).toBe(message);
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
   * **코드 표는 한국어 문턱 뒤에 있다.** `42501` 은 우리가 「이용이 정지된 계정입니다」로 쓰는
   * 코드이기도 해서, 표가 앞서면 우리 문장을 가로챈다.
   */
  it('우리가 쓴 문장은 코드 표가 가로채지 않는다', () => {
    expect(userFacingDbMessage({ message: '이용이 정지된 계정입니다.', code: '42501' }, 'x')).toBe(
      '이용이 정지된 계정입니다.',
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

/**
 * 서버 액션이 받은 예외를 **값으로 낼 문장으로.** 액션이 던지면 운영의 Next 가 문장을 영어
 * 안내로 바꾸므로, 액션은 받아서 이 문을 지난다(ADR 0078).
 */
describe('answerOfThrown', () => {
  it('문이 지은 거절은 그대로 옮긴다 — 이미 번역됐다', () => {
    const thrown = dbFailure({ message: '이미 보낸 요청이 있습니다.', code: 'P0001' }, 'x');

    expect(answerOfThrown(thrown, 'y')).toBe('이미 보낸 요청이 있습니다.');
  });

  it('문을 안 지난 예외는 한국어가 들었어도 옮기지 않고 기록에 남긴다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const thrown = new Error('Supabase 접속값이 없습니다 — NEXT_PUBLIC_SUPABASE_URL 을 확인하세요');

    expect(answerOfThrown(thrown, 'same_chart')).toBe('요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    expect(answerOfThrown(thrown, 'share_my_reading', '대신 쓸 말')).toBe('대신 쓸 말');
    expect(logged).toHaveBeenCalledWith('same_chart', 'Error', thrown.message);

    logged.mockRestore();
  });

  it('Error 가 아닌 것을 던져도 문장이 선다', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(answerOfThrown('boom', 'x')).toBe('요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');

    logged.mockRestore();
  });
});
