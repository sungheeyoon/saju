import { describe, expect, it } from 'vitest';

import { FALLBACK_EVERY_MS, RETRY_MAX_MS, opened, openingEffects, retryDelay, step, type Connection, type Input } from './connection';

const run = (start: Connection, inputs: readonly Input[]) =>
  inputs.reduce(
    (acc, input) => {
      const next = step(acc.state, input);
      return { state: next.state, effects: [...acc.effects, ...next.effects] };
    },
    { state: start, effects: [] as ReturnType<typeof step>['effects'][number][] },
  );

describe('채널의 상태', () => {
  it('뒤물림은 1초에서 두 배씩 늘어 60초에서 멈춘다', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(retryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000]);
    expect(retryDelay(100)).toBe(RETRY_MAX_MS);
  });

  it('보이는 화면에서 열면 채널이 서기 전부터 대체 조회가 돌고, 서면 멈추고 다시 대조한다', () => {
    const start = opened(true);
    expect(openingEffects(start)).toEqual([{ type: 'start-polling', every: FALLBACK_EVERY_MS }]);
    const { state, effects } = step(start, { type: 'subscribed' });
    expect(state.phase).toBe('subscribed');
    expect(effects).toEqual([{ type: 'cancel-retry' }, { type: 'resync' }, { type: 'stop-polling' }]);
  });

  it('숨은 화면에서 열면 대체 조회를 돌지 않는다', () => {
    expect(openingEffects(opened(false))).toEqual([]);
  });

  it('끊기면 뒤물림을 세우고 대체 조회를 시작하며, 다시 서면 다시 대조한다', () => {
    const up = step(opened(true), { type: 'subscribed' }).state;
    const down = step(up, { type: 'failed' });
    expect(down.state).toMatchObject({ phase: 'down', failures: 1 });
    expect(down.effects).toEqual([
      { type: 'schedule-retry', ms: 1_000 },
      { type: 'start-polling', every: FALLBACK_EVERY_MS },
    ]);

    const retried = step(down.state, { type: 'retry-due' });
    expect(retried.effects).toEqual([{ type: 'rejoin' }]);
    const again = step(retried.state, { type: 'subscribed' });
    expect(again.effects).toContainEqual({ type: 'resync' });
    expect(again.state.failures).toBe(0);
  });

  it('연이은 실패마다 뒤물림이 길어지고, 오류 뒤의 닫힘 같은 메아리는 세지 않는다', () => {
    const { effects } = run(opened(false), [
      { type: 'failed' },
      { type: 'failed' },
      { type: 'retry-due' },
      { type: 'failed' },
      { type: 'retry-due' },
      { type: 'failed' },
    ]);
    expect(effects.filter((one) => one.type === 'schedule-retry')).toEqual([
      { type: 'schedule-retry', ms: 1_000 },
      { type: 'schedule-retry', ms: 2_000 },
      { type: 'schedule-retry', ms: 4_000 },
    ]);
  });

  it('대체 조회는 채널이 서 있지 않고 보일 때만 다시 대조한다', () => {
    const down = run(opened(true), [{ type: 'failed' }]).state;
    expect(step(down, { type: 'poll-due' }).effects).toEqual([{ type: 'resync' }]);

    const hidden = step(down, { type: 'hidden' });
    expect(hidden.effects).toEqual([{ type: 'stop-polling' }]);
    expect(step(hidden.state, { type: 'poll-due' }).effects).toEqual([]);

    const up = run(opened(true), [{ type: 'subscribed' }]).state;
    expect(step(up, { type: 'poll-due' }).effects).toEqual([]);
  });

  it('다시 보이면 다시 대조하고, 내려가 있으면 뒤물림을 기다리지 않고 바로 다시 붙는다', () => {
    const up = run(opened(true), [{ type: 'subscribed' }, { type: 'hidden' }]).state;
    expect(step(up, { type: 'visible' }).effects).toEqual([{ type: 'resync' }]);

    const down = run(opened(false), [{ type: 'failed' }]).state;
    const back = step(down, { type: 'visible' });
    expect(back.state.phase).toBe('joining');
    expect(back.effects).toEqual([
      { type: 'cancel-retry' },
      { type: 'rejoin' },
      { type: 'resync' },
      { type: 'start-polling', every: FALLBACK_EVERY_MS },
    ]);
  });

  it('망이 돌아오거나 · bfcache 에서 돌아오거나 · 토큰이 새로 나면 다시 대조한다', () => {
    const up = run(opened(true), [{ type: 'subscribed' }]).state;
    for (const input of [{ type: 'online' }, { type: 'restored' }, { type: 'token-refreshed' }] as const) {
      expect(step(up, input).effects).toEqual([{ type: 'resync' }]);
    }
    const down = run(opened(true), [{ type: 'failed' }]).state;
    expect(step(down, { type: 'online' }).effects).toEqual([{ type: 'cancel-retry' }, { type: 'rejoin' }, { type: 'resync' }]);
  });

  it('붙는 중에 온 뒤물림 끝은 버린다 — 채널을 둘 열지 않는다', () => {
    const joining = run(opened(true), [{ type: 'failed' }, { type: 'online' }]).state;
    expect(joining.phase).toBe('joining');
    expect(step(joining, { type: 'retry-due' }).effects).toEqual([]);
  });
});
