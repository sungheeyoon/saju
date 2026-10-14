import { describe, expect, it } from 'vitest';

import { readReadingCredits } from './remaining';

/**
 * **남은 풀이권은 부속 정보다**(ADR 0078) — 못 읽으면 던지지 않고 값으로 말하고, 화면은 그 자리만 생략한다.
 * 문이 성공했는데 행이 없는 것만 `null` 이다.
 */

const answering = (answer: { data: unknown; error: unknown }) => ({ rpc: async () => answer }) as never;

const BROKEN = { data: null, error: { message: 'fetch failed' } };

describe('부속 정보는 값으로 말한다', () => {
  it('풀이권을 못 읽으면 던지지 않고 못 읽었다고 답한다', async () => {
    const credits = await readReadingCredits(answering(BROKEN));

    expect(credits.ok).toBe(false);
  });

  /** 화면은 이 자리만 생략한다 — 그러려면 까닭이 값으로 와야 한다 */
  it('못 읽은 까닭이 사용자 문장으로 실린다', async () => {
    const credits = await readReadingCredits(answering(BROKEN));

    expect(credits.ok === false && credits.reason).toBe('요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
  });

  it('문이 성공했고 행이 없으면 「읽었고 값이 없다」다', async () => {
    expect(await readReadingCredits(answering({ data: [], error: null }))).toEqual({ ok: true, value: null });
  });

  it('DB 의 칸 이름을 도메인의 말로 옮긴다', async () => {
    const row = { credit_limit: 5, used: 1, reserved: 1, requested: 1, available: 2 };

    expect(await readReadingCredits(answering({ data: [row], error: null }))).toEqual({
      ok: true,
      value: { limit: 5, used: 1, reserved: 1, requested: 1, available: 2 },
    });
  });
});
