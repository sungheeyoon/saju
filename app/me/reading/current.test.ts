import { beforeEach, describe, expect, it, vi } from 'vitest';

import { unreadCount } from '../requests/inbox';
import { myReadings, readingCredits } from './current';

vi.mock('../../auth/server-client', () => ({ supabaseOnServer: vi.fn() }));

import { supabaseOnServer } from '../../auth/server-client';

/**
 * **읽는 문이 실패를 어떻게 말하는가**(ADR 0078).
 *
 * 세 갈래를 가른다 — 화면의 본체는 던지고, 부속 정보는 값으로 내고, 문이 성공했는데
 * 자료가 없는 것만 `null`·`[]`·`0` 이다.
 *
 * 앞서는 열네 자리가 `if (error) return []` 한 줄로 **「DB 성공 + 자료 없음」과
 * 「DB 실패 + 못 읽음」을 한 값으로 합쳤다.** 그래서 소식 배지가 사라진 화면과 읽을
 * 것이 없는 화면이 같은 얼굴이었고, 어느 쪽인지 묻는 자리가 없었다.
 *
 * 지난 라운드가 같은 종류를 리뷰에서 걸렸다(`bb4f464`) — 문을 모은 뒤에는 **그 문이
 * 실패할 때**를 따로 재야 한다.
 */

const answering = (answer: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseOnServer).mockResolvedValue({ rpc: async () => answer } as never);

const BROKEN = { data: null, error: { message: 'fetch failed' } };

beforeEach(() => vi.mocked(supabaseOnServer).mockReset());

describe('화면의 본체는 던진다', () => {
  it('목록을 못 읽으면 빈 목록이 아니라 던진다', async () => {
    answering(BROKEN);

    await expect(myReadings()).rejects.toThrow();
  });

  /** 던지는 말도 한 문을 지난다 — 영어 원문이 화면에 서지 않는다(`dbFailure`) */
  it('던지는 말에 영어 원문이 안 실린다', async () => {
    answering(BROKEN);

    await expect(myReadings()).rejects.toThrow('요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  });

  it('문이 성공했고 0행이면 빈 목록이다', async () => {
    answering({ data: [], error: null });

    expect(await myReadings()).toEqual([]);
  });
});

describe('부속 정보는 값으로 말한다', () => {
  it('풀이권을 못 읽으면 던지지 않고 못 읽었다고 답한다', async () => {
    answering(BROKEN);

    const credits = await readingCredits();

    expect(credits.ok).toBe(false);
  });

  /** 화면은 이 자리만 생략한다 — 그러려면 까닭이 값으로 와야 한다 */
  it('못 읽은 까닭이 사용자 문장으로 실린다', async () => {
    answering(BROKEN);

    const credits = await readingCredits();

    expect(credits.ok === false && credits.reason).toBe(
      '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  });

  it('문이 성공했고 행이 없으면 「읽었고 값이 없다」다', async () => {
    answering({ data: [], error: null });

    expect(await readingCredits()).toEqual({ ok: true, value: null });
  });

  /**
   * **0 과 「모른다」는 다른 값이다.**
   *
   * 앞서는 둘 다 `0` 이라, 배지를 못 읽은 사람과 읽을 소식이 없는 사람이 같은 화면을
   * 봤다. 못 읽은 쪽은 띠를 안 세우는 것이 맞고, 0 인 쪽도 안 세우는 것이 맞지만 —
   * **같은 이유로 안 세우는 것이 아니다.**
   */
  it('소식 0건은 읽어서 안 값이고, 못 읽은 것과 갈린다', async () => {
    answering({ data: 0, error: null });
    expect(await unreadCount()).toEqual({ ok: true, value: 0 });

    answering(BROKEN);
    expect((await unreadCount()).ok).toBe(false);
  });
});
