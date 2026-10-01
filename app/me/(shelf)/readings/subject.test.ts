import { describe, expect, it, vi } from 'vitest';

import { DbFailure } from '../../../db-error';
import { savedPersonOf } from './subject';

/**
 * **사주풀이 글 화면의 엣지 — 못 읽은 것을 「없는 사람」으로 내지 않는다**(ADR 0078).
 *
 * 앞서는 화면이 `error` 를 버려 DB 실패가 404 로 섰다. 주소가 uuid 모양이 아닌 것은 DB 에 묻기 전에 「없음」이다 —
 * 묻고 나면 DB 의 형식 거절이 오류 화면이 된다.
 */

type Answer = { data: unknown; error: unknown };

const answering = (answer: Answer) => {
  const from = vi.fn(() => {
    const link = { select: () => link, eq: () => link, maybeSingle: async () => answer };
    return link;
  });
  return { client: { from } as never, from };
};

const ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';

describe('글 화면의 저장한 사람', () => {
  it('내 목록에 있으면 사람 id 와 부르는 이름이다', async () => {
    const { client } = answering({ data: { person_id: ID, local_label: '엄마' }, error: null });

    expect(await savedPersonOf(client, ID)).toEqual({ personId: ID, localLabel: '엄마' });
  });

  it('없으면 null 이다', async () => {
    const { client } = answering({ data: null, error: null });

    expect(await savedPersonOf(client, ID)).toBeNull();
  });

  it('모양이 틀린 주소는 묻지 않고 null 이다', async () => {
    const { client, from } = answering({ data: null, error: { message: 'invalid input syntax for type uuid' } });

    expect(await savedPersonOf(client, 'not-a-person')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('못 읽으면 null 이 아니라 던진다', async () => {
    const { client } = answering({ data: null, error: { message: 'fetch failed' } });

    await expect(savedPersonOf(client, ID)).rejects.toBeInstanceOf(DbFailure);
  });
});
