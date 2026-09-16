import { describe, expect, it, vi } from 'vitest';

import { userFacingDbMessage } from './db-error';

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
