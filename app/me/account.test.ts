import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('../db-error', () => ({ recordDbFailure: () => {} }));

import { readAccount } from './account';

type Answer = { data: unknown; error: unknown };

const client = (answer: Answer) => {
  const selected: string[] = [];
  const supabase = {
    from: (table: string) => ({
      select: (columns: string) => {
        selected.push(`${table}: ${columns}`);
        return { maybeSingle: async () => answer };
      },
    }),
  } as never;
  return { supabase, selected };
};

/**
 * **청한 칸이 곧 모양이다** — 칸은 목록으로 받고, 돌려주는 행의 타입은 그 목록에서 나온다(2026-09-30).
 *
 * 전에는 칸을 글자로, 모양을 따로 적은 `T` 로 받아 둘이 어긋나도 컴파일이 됐다(밤샘 감사의 `readAccount<T>(string)`).
 */
describe('readAccount', () => {
  it('목록의 칸을 그대로 청하고, 행의 타입은 그 칸들이다', async () => {
    const { supabase, selected } = client({ data: { status: 'active', nickname: '하늘' }, error: null });

    const { state, row } = await readAccount(supabase, ['status', 'nickname']);

    expect(selected).toEqual(['app_user: status, nickname']);
    expect(row?.nickname).toBe('하늘');
    expect(state.kind).toBe('active');
    expectTypeOf(row).toEqualTypeOf<{ status: string; nickname: string | null } | null>();
  });

  it('칸을 안 적으면 온보딩까지 묻는 두 칸이다', async () => {
    const { supabase, selected } = client({ data: { status: 'active', self_person_id: null }, error: null });

    const { state, row } = await readAccount(supabase);

    expect(selected).toEqual(['app_user: status, self_person_id']);
    expect(state.kind).toBe('onboarding');
    expectTypeOf(row).toEqualTypeOf<{ status: string; self_person_id: string | null } | null>();
  });

  it('내 사람 칸을 안 청한 화면에는 온보딩이 안 나온다', async () => {
    const { supabase } = client({ data: { status: 'active' }, error: null });

    expect((await readAccount(supabase, ['status'])).state.kind).toBe('active');
  });

  it('못 읽은 것과 없는 것을 가른다', async () => {
    expect((await readAccount(client({ data: null, error: { message: 'boom' } }).supabase, ['status'])).state.kind).toBe(
      'unreachable',
    );
    expect((await readAccount(client({ data: null, error: null }).supabase, ['status'])).state.kind).toBe('missing');
  });
});
