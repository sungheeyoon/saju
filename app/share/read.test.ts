import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sharedReadingOf } from './read';

vi.mock('./public-client', () => ({ supabaseForShared: vi.fn() }));

import { supabaseForShared } from './public-client';

/**
 * **익명에게 열린 유일한 문**이 무엇을 답하는가(ADR 0063·0078).
 *
 * 앞서는 이 읽기가 화면 안에 있어서 부를 자리가 없었고, `error` 와 0행이 같은
 * `notFound()` 로 갔다 — DB 가 멎은 동안 멀쩡한 링크를 받은 사람 전부가 「없어진
 * 풀이」를 봤다.
 */

const answering = (answer: { data: unknown; error: unknown }) =>
  vi.mocked(supabaseForShared).mockReturnValue({ rpc: async () => answer } as never);

const ROW = {
  kind: 'self',
  metaphor: '한 문장',
  score: null,
  body: '## 본문',
  name_a: '민수',
  name_b: null,
  created_at: '2026-09-21T00:00:00.000Z',
};

beforeEach(() => vi.mocked(supabaseForShared).mockReset());

describe('공유본을 읽는 문', () => {
  it('맡은 갈래의 토큰이면 사본을 낸다', async () => {
    answering({ data: [ROW], error: null });

    const shared = await sharedReadingOf('t', 'self');

    expect(shared?.body).toBe('## 본문');
    expect(shared?.nameA).toBe('민수');
    expect(shared?.nameB).toBeNull();
  });

  it('0행은 null 이다 — 없는 토큰과 지워진 것을 안 가른다', async () => {
    answering({ data: [], error: null });

    expect(await sharedReadingOf('t', 'self')).toBeNull();
  });

  /** 미리보기가 거짓말을 하는 자리라 화면이 아니라 문이 막는다 */
  it('주소가 맡은 갈래와 다르면 안 연다', async () => {
    answering({ data: [ROW], error: null });

    expect(await sharedReadingOf('t', 'private')).toBeNull();
  });

  /**
   * **터진 것은 없는 것이 아니다.**
   *
   * 삼키면 DB 가 멎은 동안 받은 사람이 「없어진 풀이」를 보고 보낸 사람에게 다시
   * 달라고 한다. 던지면 오류 화면이 서고 그 말은 다시 와 보라는 말이다.
   */
  it('문이 터진 것은 「없는 링크」가 아니라 던진다', async () => {
    answering({ data: null, error: { message: 'fetch failed' } });

    await expect(sharedReadingOf('t', 'self')).rejects.toThrow(
      '요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  });
});
