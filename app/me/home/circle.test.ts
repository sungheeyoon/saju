import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * **「내 사람」 문 — 한 그림 안에서 엣지 읽기는 한 번이다.**
 *
 * 서버 컴포넌트의 `cache` 는 요청 하나가 범위다. vitest 는 React 의 클라이언트 판을 읽어 `cache` 가 그냥 지나가므로,
 * 여기서는 그림 하나를 흉내 낸다 — `render` 가 새 범위를 연다.
 */
const scope = vi.hoisted(() => ({ held: new Map<unknown, unknown>() }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  cache:
    <T,>(fn: () => T) =>
    (): T => {
      if (!scope.held.has(fn)) scope.held.set(fn, fn());
      return scope.held.get(fn) as T;
    },
}));

import { DbFailure } from '../../db-error';
import { myCircle, myEdge, myEdges, myPeople } from './circle';

type Answer = { data: unknown; error: unknown };

const SELF = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b';
const MOM = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const HIDDEN = '8b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

const ROWS = [
  { person_id: SELF, local_label: '나', note: null, listed: false },
  { person_id: MOM, local_label: '엄마', note: '봄에 태어남', listed: true },
  { person_id: HIDDEN, local_label: '궁합만', note: null, listed: false },
];

const SLOTS = [{ person_limit: 10, used: 1, remaining: 9 }];

const client = (edges: Answer, slots: Answer = { data: SLOTS, error: null }) => {
  const from = vi.fn(() => {
    const link = { select: () => link, order: async () => edges };
    return link;
  });
  const rpc = vi.fn(async () => slots);
  return { supabase: { from, rpc } as never, from, rpc };
};

const render = () => {
  scope.held = new Map();
};

beforeEach(render);

describe('내 사람 문', () => {
  it('엣지를 도메인 말로 한 번 옮긴다 — 저장한 차례 그대로, listed 로 안 거른다', async () => {
    const { supabase } = client({ data: ROWS, error: null });

    expect(await myEdges(supabase)).toEqual([
      { personId: SELF, label: '나', note: null, listed: false },
      { personId: MOM, label: '엄마', note: '봄에 태어남', listed: true },
      { personId: HIDDEN, label: '궁합만', note: null, listed: false },
    ]);
  });

  it('한 그림 안에서 여럿이 불러도 엣지 · 자리 수 읽기는 한 번이다 — 클라이언트가 달라도', async () => {
    const one = client({ data: ROWS, error: null });
    const other = client({ data: ROWS, error: null });

    await Promise.all([
      myPeople(one.supabase),
      myCircle(one.supabase, SELF),
      myEdge(other.supabase, MOM),
      myEdge(other.supabase, HIDDEN),
    ]);

    expect(one.from).toHaveBeenCalledTimes(1);
    expect(one.rpc).toHaveBeenCalledTimes(1);
    expect(other.from).not.toHaveBeenCalled();
  });

  it('그림이 바뀌면 다시 읽는다', async () => {
    const { supabase, from } = client({ data: ROWS, error: null });

    await myEdges(supabase);
    render();
    await myEdges(supabase);

    expect(from).toHaveBeenCalledTimes(2);
  });

  it('엣지 하나만 쓰는 문은 자리 수를 안 부른다', async () => {
    const { supabase, rpc } = client({ data: ROWS, error: null });

    await myEdge(supabase, MOM);

    expect(rpc).not.toHaveBeenCalled();
  });

  it('엣지 하나 — 주소의 대문자 id 도 같은 사람이고, 없으면 null 이다', async () => {
    const { supabase } = client({ data: ROWS, error: null });

    expect((await myEdge(supabase, MOM.toUpperCase()))?.label).toBe('엄마');
    expect(await myEdge(supabase, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('목록에 선 사람과 자리 수를 낸다', async () => {
    const { supabase } = client({ data: ROWS, error: null });

    const mine = await myPeople(supabase);

    expect(mine.listed.map((edge) => edge.personId)).toEqual([MOM]);
    expect(mine.slots).toEqual({ limit: 10, used: 1, remaining: 9 });
  });

  it('홈의 사람들 — 나는 따로, 목록에서는 빠진다', async () => {
    const { supabase } = client({ data: [{ ...ROWS[0], listed: true }, ...ROWS.slice(1)], error: null });

    const circle = await myCircle(supabase, SELF);

    expect(circle.self).toEqual({ personId: SELF, label: '나', note: null });
    expect(circle.people.map((edge) => edge.personId)).toEqual([MOM]);
  });

  it('엣지를 못 읽으면 빈 목록이 아니라 던진다(ADR 0078)', async () => {
    const { supabase } = client({ data: null, error: { message: 'fetch failed' } });

    await expect(myPeople(supabase)).rejects.toBeInstanceOf(DbFailure);
  });

  it('자리 수를 못 읽으면 null 이다 — 0 으로 눕히지 않는다', async () => {
    const { supabase } = client({ data: ROWS, error: null }, { data: null, error: { message: 'fetch failed' } });

    expect((await myPeople(supabase)).slots).toBeNull();
  });
});
