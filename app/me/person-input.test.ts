import { describe, expect, it } from 'vitest';

import { storedInputOf, storedInputsOf } from './person-input';

/**
 * **「없다」와 「터졌다」를 가르는가.**
 *
 * `maybeSingle()` 은 0행일 때도 조회가 터졌을 때도 `data: null` 로 온다. 둘을 가르는 값은
 * `error` 하나뿐이라, 안 보면 네트워크 장애가 「저장된 사주가 없습니다」로 둔갑한다 —
 * 사용자가 고칠 것이 없는 일에 고칠 것이 있는 말이 붙는다.
 *
 * 클라이언트를 인자로 받는 문이라 가짜 하나면 잰다. 앞서는 이 판정이 화면 여섯에 흩어져
 * 있어서 부를 수 있는 자리가 없었다.
 */

const ROW = {
  id: 'p-1',
  calendar: 'solar',
  original_date: '1990-05-15',
  solar_date: '1990-05-15',
  birth_time: '14:30:00',
  gender: 'male',
  city: '서울',
  late_night_rule: 'jo',
  time_basis: 'localMean',
};

/** 한 행을 묻는 문 — `.eq().maybeSingle()` 까지 간다 */
const single = (answer: { data: unknown; error: unknown }) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => answer }) }) }),
  }) as never;

/** 여럿을 묻는 문 — `.in()` 이 곧 결과다 */
const many = (answer: { data: unknown; error: unknown }) =>
  ({ from: () => ({ select: () => ({ in: async () => answer }) }) }) as never;

describe('한 사람을 집어 온다', () => {
  it('행이 있으면 id 와 입력을 든다', async () => {
    const found = await storedInputOf(single({ data: ROW, error: null }), 'p-1');

    expect(found?.id).toBe('p-1');
    expect(found?.input.city).toBe('서울');
  });

  it('0행은 null 이다 — 없는 것과 못 보는 것을 안 가른다', async () => {
    expect(await storedInputOf(single({ data: null, error: null }), 'p-1')).toBeNull();
  });

  /** 여덟 칸은 함께 차거나 함께 빈다 — 한 칸이 그 답을 든다 */
  it('입력이 빈 행도 null 이다', async () => {
    const empty = { ...ROW, calendar: null };

    expect(await storedInputOf(single({ data: empty, error: null }), 'p-1')).toBeNull();
  });

  it('조회가 터진 것은 null 이 아니라 던진다', async () => {
    await expect(
      storedInputOf(single({ data: null, error: { message: 'fetch failed' } }), 'p-1'),
    ).rejects.toThrow();
  });

  /** 던지는 말도 한 문을 지난다 — 영어 원문이 화면에 서지 않는다(`dbFailure`) */
  it('던지는 말에 영어 원문이 안 실린다', async () => {
    await expect(
      storedInputOf(single({ data: null, error: { message: 'fetch failed' } }), 'p-1'),
    ).rejects.toThrow('요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  });
});

describe('여럿을 한 번에 집어 온다', () => {
  it('입력이 빈 사람은 지도에 안 들어간다', async () => {
    const rows = [ROW, { ...ROW, id: 'p-2', calendar: null }];

    const map = await storedInputsOf(many({ data: rows, error: null }), ['p-1', 'p-2']);

    expect(map.has('p-1')).toBe(true);
    expect(map.has('p-2')).toBe(false);
  });

  /** 빈 목록은 왕복을 안 돈다 — 가짜가 터지게 두면 그 사실이 값으로 드러난다 */
  it('물을 사람이 없으면 조회하지 않는다', async () => {
    const explode = {
      from: () => {
        throw new Error('물어보면 안 된다');
      },
    } as never;

    expect((await storedInputsOf(explode, [])).size).toBe(0);
  });

  it('조회가 터진 것은 빈 지도가 아니라 던진다', async () => {
    await expect(
      storedInputsOf(many({ data: null, error: { message: 'fetch failed' } }), ['p-1']),
    ).rejects.toThrow();
  });
});
