import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('next/cache', () => ({
  refresh: () => calls.push('refresh'),
  revalidatePath: (path: string) => calls.push(`revalidatePath ${path}`),
}));

const { REFRESH_SCREENS, THIS_SCREEN, refresh } = await import('./refresh');

/**
 * **지금 화면은 경로보다 먼저 다시 그린다.** Next 의 `refresh()` 는 액션의 표지를 「동적만」으로 덮어써서, 경로를 먼저
 * 무르면 브라우저가 미리 받아 둔 다른 화면을 버리지 않는다(`app/refresh.ts` 의 `refresh`).
 */
describe('refresh 의 차례', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it.each(['requests-changed', 'consent-changed'] as const)('%s 는 refresh 를 모든 revalidatePath 앞에 부른다', (changed) => {
    refresh(changed);

    expect(calls[0]).toBe('refresh');
    expect(calls.filter((call) => call === 'refresh')).toHaveLength(1);
    expect(calls.slice(1).every((call) => call.startsWith('revalidatePath '))).toBe(true);
    expect(calls.length).toBe(REFRESH_SCREENS[changed].length);
  });

  it('지금 화면을 적은 이름은 모두 refresh 로 시작한다', () => {
    for (const changed of Object.keys(REFRESH_SCREENS) as (keyof typeof REFRESH_SCREENS)[]) {
      if (!REFRESH_SCREENS[changed].includes(THIS_SCREEN)) continue;
      calls.length = 0;
      refresh(changed);
      expect(calls[0], changed).toBe('refresh');
    }
  });
});
